import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';

// Uses existing Windows PostgreSQL binaries to start a disposable loopback-only
// cluster. No installed service, inherited connection, account or real data.
const run = promisify(execFile);
const binaryDirectory = 'C:/Program Files/PostgreSQL/17/bin';
const initdb = path.join(binaryDirectory, 'initdb.exe');
const pgctl = path.join(binaryDirectory, 'pg_ctl.exe');
const root = process.cwd();
const directory = await fs.mkdtemp(path.join(root, '.tmp-analytics-retention-pg-'));
const cluster = path.join(directory, 'cluster');
const logFile = path.join(directory, 'postgres.log');
let started = false;
let inspect;
let sharedPool;
let blackhole;
const blackholeSockets = new Set();
let exitCode = 0;
const listen = (server) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
try {
  await fs.access(initdb);
  await fs.access(pgctl);
  const probe = createServer();
  await listen(probe);
  const port = probe.address().port;
  await close(probe);
  await run(initdb, ['-D', cluster, '-U', 'retention_fixture', '--no-locale', '--encoding=UTF8', '--auth=trust'], { windowsHide: true, timeout: 30_000 });
  await run(pgctl, ['-D', cluster, '-l', logFile, '-w', '-t', '20', 'start', '-o', `-h 127.0.0.1 -p ${port} -F`], { windowsHide: true, timeout: 25_000 });
  started = true;
  const databaseUrl = `postgres://retention_fixture@127.0.0.1:${port}/postgres`;
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: databaseUrl, DATABASE_POOL_MAX: '1', ADMIN_EMAIL: '', VERCEL: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '', CRON_SECRET: 'isolated-retention-timeout-fixture' });
  assert.equal(new URL(databaseUrl).hostname, '127.0.0.1');
  const db = await import('../src/server/db.ts');
  const { GET } = await import('../app/api/cron/analytics-retention/route.ts');
  inspect = new pg.Pool({ connectionString: databaseUrl, max: 3, connectionTimeoutMillis: 3000, query_timeout: 10_000 });
  const clientCount = async () => Number((await inspect.query("SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE application_name='analytics-retention'")).rows[0].count);

  // Cold maintenance must not initialize the full application through the
  // unbounded business pool, including when its own table has not been migrated.
  await assert.rejects(db.purgeExpiredAnalyticsEvents(), (error) => error.code === '42P01');
  assert.equal((await inspect.query("SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public'")).rows[0].count, 0);
  assert.equal(await clientCount(), 0);
  await inspect.query('CREATE TABLE analytics_events (id uuid PRIMARY KEY, created_at timestamptz NOT NULL)');
  await inspect.query('CREATE TABLE retained_business_fixture (id int PRIMARY KEY, payload jsonb NOT NULL)');
  await inspect.query("INSERT INTO retained_business_fixture VALUES (1, '{\"invoice\":12300,\"attribution\":\"kept\"}')");
  const oldId = randomUUID();
  const freshId = randomUUID();
  await inspect.query("INSERT INTO analytics_events VALUES ($1,now()-interval '2 years'),($2,now())", [oldId, freshId]);
  const original = (await inspect.query('SELECT * FROM analytics_events ORDER BY id')).rows;
  const business = (await inspect.query('SELECT * FROM retained_business_fixture')).rows;

  const locker = await inspect.connect();
  try {
    await locker.query('BEGIN');
    await locker.query('LOCK TABLE analytics_events IN ACCESS EXCLUSIVE MODE');
    const start = performance.now();
    await assert.rejects(db.purgeExpiredAnalyticsEvents(), (error) => error.code === '55P03');
    assert.ok(performance.now() - start < 5000, 'lock_timeout must abort before the host deadline');
    const response = await GET(new Request('https://example.invalid/api/cron/analytics-retention/', { headers: { authorization: 'Bearer isolated-retention-timeout-fixture' } }));
    assert.equal(response.status, 503, 'blocked SQL must return a controlled failure');
    assert.deepEqual(await response.json(), { ok: false, error: 'Analytics retention is unavailable.' });
    assert.equal(await clientCount(), 0, 'timeout must not leave an open retention client');
  } finally {
    await locker.query('ROLLBACK');
    locker.release();
  }
  assert.deepEqual((await inspect.query('SELECT * FROM analytics_events ORDER BY id')).rows, original, 'lock timeout rolled back without deletion');

  // A genuine PostgreSQL statement timeout, not a mock or PGlite timer.
  await inspect.query(`CREATE FUNCTION slow_analytics_retention() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(7); RETURN OLD; END $$`);
  await inspect.query('CREATE TRIGGER slow_analytics_retention BEFORE DELETE ON analytics_events FOR EACH ROW EXECUTE FUNCTION slow_analytics_retention()');
  const statementStart = performance.now();
  await assert.rejects(db.purgeExpiredAnalyticsEvents(), (error) => error.code === '57014');
  assert.ok(performance.now() - statementStart < 8000, 'statement_timeout is bounded to five seconds');
  assert.deepEqual((await inspect.query('SELECT * FROM analytics_events ORDER BY id')).rows, original, 'cancelled delete is rolled back');
  assert.equal(await clientCount(), 0);
  await inspect.query('DROP TRIGGER slow_analytics_retention ON analytics_events');
  await inspect.query('DROP FUNCTION slow_analytics_retention()');

  // Emit an idle client error after DELETE has completed but before its caller
  // can issue SELECT/COMMIT. No unhandled EventEmitter error, false success or
  // commit is allowed; ending the dedicated connection rolls back its delete.
  const originalQuery = pg.Client.prototype.query;
  const originalEnd = pg.Client.prototype.end;
  const injected = new Error('Isolated idle transport fixture');
  const issuedQueries = [];
  let endedWithListener = false;
  pg.Client.prototype.query = function (config, ...args) {
    const text = typeof config === 'string' ? config : config.text;
    if (this.connectionParameters.application_name !== 'analytics-retention') return originalQuery.call(this, config, ...args);
    issuedQueries.push(text);
    const promise = originalQuery.call(this, config, ...args);
    if (!text.includes('DELETE FROM analytics_events')) return promise;
    return promise.then((result) => { this.emit('error', injected); return result; });
  };
  pg.Client.prototype.end = function (...args) {
    if (this.connectionParameters.application_name === 'analytics-retention') {
      endedWithListener = this.listenerCount('error') > 0;
      this.emit('error', new Error('Isolated closing transport fixture'));
    }
    return originalEnd.apply(this, args);
  };
  try {
    await assert.rejects(db.purgeExpiredAnalyticsEvents(), (error) => error === injected);
    assert.equal(endedWithListener, true, 'error listener must remain during connection cleanup');
    assert.ok(!issuedQueries.some((text) => text === 'COMMIT' || text.startsWith('SELECT EXISTS')), 'connection failure must prevent subsequent queries and commit');
  } finally {
    pg.Client.prototype.query = originalQuery;
    pg.Client.prototype.end = originalEnd;
  }
  assert.deepEqual((await inspect.query('SELECT * FROM analytics_events ORDER BY id')).rows, original, 'idle error closes the uncommitted transaction');
  assert.equal(await clientCount(), 0);

  // Saturating the application pool cannot block the dedicated maintenance client.
  sharedPool = db.getServerDatabasePool();
  const occupied = await sharedPool.connect();
  try {
    const removed = await db.purgeExpiredAnalyticsEvents();
    assert.equal(removed.deleted, 1);
    assert.equal(removed.remaining, false);
  } finally { occupied.release(); }
  assert.equal(await clientCount(), 0);
  assert.deepEqual((await inspect.query('SELECT * FROM retained_business_fixture')).rows, business);

  // The TCP connection is accepted but never answers the PostgreSQL startup.
  // A separate test process imports db only after binding this fake address.
  blackhole = createServer((socket) => {
    blackholeSockets.add(socket);
    socket.on('close', () => blackholeSockets.delete(socket));
    socket.on('error', () => undefined);
    socket.resume();
  });
  await listen(blackhole);
  const stalledUrl = `postgres://retention_fixture@127.0.0.1:${blackhole.address().port}/postgres`;
  const source = `
    const route = await import('./app/api/cron/analytics-retention/route.ts');
    const started = performance.now();
    const response = await route.GET(new Request('https://example.invalid/api/cron/analytics-retention/', {headers:{authorization:'Bearer isolated-retention-timeout-fixture'}}));
    console.log(JSON.stringify({status:response.status, body:await response.json(), elapsed:performance.now()-started}));
  `;
  const child = await run(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], { cwd: root, windowsHide: true, timeout: 15_000, env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: stalledUrl, VERCEL: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '' } });
  const connectionTimeout = JSON.parse(child.stdout.trim());
  assert.equal(connectionTimeout.status, 503);
  assert.deepEqual(connectionTimeout.body, { ok: false, error: 'Analytics retention is unavailable.' });
  assert.ok(connectionTimeout.elapsed >= 4500 && connectionTimeout.elapsed < 9000, 'connection establishment must time out within its five-second budget');
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(blackholeSockets.size, 0, 'timed-out startup must close its socket');
  assert.equal(await clientCount(), 0);
  console.log('PASS: disposable PostgreSQL17 cold/missing-schema, real lock and statement timeouts, idle/closing errors, rollback, closed clients, saturated business-pool isolation, TCP connect timeout and controlled503; no production access.');
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  for (const socket of blackholeSockets) socket.destroy();
  try { if (blackhole) await close(blackhole); } catch (error) { exitCode = 1; console.error(error); }
  try { await sharedPool?.end(); } catch (error) { exitCode = 1; console.error(error); }
  try { await inspect?.end(); } catch (error) { exitCode = 1; console.error(error); }
  if (started) {
    try { await run(pgctl, ['-D', cluster, '-w', '-t', '15', 'stop', '-m', 'fast'], { windowsHide: true, timeout: 20_000 }); }
    catch (error) { exitCode = 1; console.error(error); started = true; }
  }
  const resolvedDirectory = path.resolve(directory);
  assert.equal(path.dirname(resolvedDirectory), path.resolve(root));
  assert.ok(path.basename(resolvedDirectory).startsWith('.tmp-analytics-retention-pg-'));
  // Never delete a cluster while its shutdown failed.
  const serverPidPresent = await fs.stat(path.join(cluster, 'postmaster.pid')).then(() => true, () => false);
  if (!serverPidPresent) await fs.rm(resolvedDirectory, { recursive: true, force: true });
  else { exitCode = 1; console.error('Isolated cluster was preserved because shutdown is not confirmed.'); }
  process.exit(exitCode);
}
