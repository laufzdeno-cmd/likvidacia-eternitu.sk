import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

const runToken = process.env.ASTANA_ISOLATED_PG_RUN_TOKEN;
const suppliedUrl = process.env.ASTANA_ISOLATED_PG_URL;
const legacyRoot = process.env.ASTANA_LEGACY_MIGRATION_ROOT;
assert.match(runToken || '', /^[a-f0-9]{32}$/, 'Disposable PostgreSQL runner token required.');
assert.ok(suppliedUrl && legacyRoot && path.isAbsolute(legacyRoot), 'Runner URL and absolute legacy checkout required.');
const parsed = new URL(suppliedUrl);
const port = Number(parsed.port);
assert.ok(
  ['postgres:', 'postgresql:'].includes(parsed.protocol)
  && parsed.hostname === '127.0.0.1'
  && parsed.username === 'astana_test'
  && !parsed.password && !parsed.search && !parsed.hash
  && parsed.pathname === `/astana_isolated_${runToken}`
  && Number.isInteger(port) && port > 0 && port <= 65535,
  'Only the runner-owned loopback PostgreSQL database may be tested.',
);
const connectionString = `postgres://astana_test@127.0.0.1:${port}/astana_isolated_${runToken}`;
const inspectPool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
const bootstrapAdminEmail = 'mixed-main@example.invalid';
const legacyModule = pathToFileURL(path.join(legacyRoot, 'src/server/db.ts')).href;

function launch(mode) {
  assert.ok(mode === 'legacy' || mode === 'new');
  const child = fork(fileURLToPath(import.meta.url), ['--worker', mode], {
    execArgv: ['--import', 'tsx'],
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      NODE_ENV: 'test',
      VERCEL_ENV: '',
      ADMIN_EMAIL: bootstrapAdminEmail,
    },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString('utf8')).slice(-3000); });
  const timeout = setTimeout(() => child.kill(), 90_000);
  const ready = new Promise((resolve, reject) => {
    child.on('message', (message) => { if (message?.type === 'ready') resolve(); });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`${mode} worker exited before ready (${code}): ${stderr}`)));
  });
  const result = new Promise((resolve, reject) => {
    let reportedResult;
    child.on('message', (message) => {
      if (message?.type === 'result') reportedResult = message;
      if (message?.type === 'error') reject(new Error(`${mode} worker failed (${message.code}): ${message.message}`));
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) reject(new Error(`${mode} worker exited (${code}): ${stderr}`));
      else if (!reportedResult) reject(new Error(`${mode} worker exited without a result.`));
      else resolve(reportedResult);
    });
  });
  return { child, ready, result, timeout };
}

function stop(worker) {
  clearTimeout(worker.timeout);
  if (worker.child.exitCode === null) worker.child.kill();
}

try {
  const marker = await inspectPool.query('SELECT run_token FROM astana_isolated_runner_guard WHERE run_token = $1', [runToken]);
  assert.equal(marker.rowCount, 1, 'The database must belong to this runner invocation.');

  if (process.argv.includes('--worker')) {
    const mode = process.argv.at(-1);
    assert.ok(mode === 'legacy' || mode === 'new');
    const database = mode === 'legacy' ? await import(legacyModule) : await import('../src/server/db.ts');
    process.send?.({ type: 'ready' });
    process.once('message', async (message) => {
      try {
        assert.equal(message?.type, 'go');
        const leads = await database.listLeads();
        process.send?.({ type: 'result', count: leads.length }, () => process.exit(0));
      } catch (error) {
        process.send?.({ type: 'error', code: error?.code || 'unknown', message: error?.message || 'unknown' }, () => process.exit(1));
      }
    });
  } else {
    const children = [];
    try {
      const initial = launch('legacy');
      children.push(initial);
      await initial.ready;
      initial.child.send({ type: 'go' });
      assert.equal((await initial.result).count, 0);

      const leadId = randomUUID();
      await inspectPool.query(
        `INSERT INTO leads (id, full_name, phone, email, city, object_type, material_type, area_estimate)
         VALUES ($1, 'Syntetický dopyt', '0000000000', 'mixed-main@example.invalid', 'Test', 'Rodinný dom', 'Vlnitý eternit', 100)`,
        [leadId],
      );
      await inspectPool.query("UPDATE admin_users SET role = 'OPERATOR', active = false WHERE lower(email) = $1", [bootstrapAdminEmail]);
      const beforeRevision = await inspectPool.query("SELECT to_regclass('astana_schema_revisions') AS relation");
      assert.equal(beforeRevision.rows[0].relation, null, 'This must be the first new-version migration.');

      const mixed = ['legacy', 'new', 'legacy', 'new'].map(launch);
      children.push(...mixed);
      await Promise.all(mixed.map((worker) => worker.ready));
      for (const worker of mixed) worker.child.send({ type: 'go' });
      const results = await Promise.all(mixed.map((worker) => worker.result));
      assert.ok(results.every((item) => item.count === 1), 'Both versions must see the same preserved lead.');

      const lead = await inspectPool.query('SELECT status, deleted_at FROM leads WHERE id = $1', [leadId]);
      assert.equal(lead.rowCount, 1);
      assert.equal(lead.rows[0].deleted_at, null);
      const revision = await inspectPool.query('SELECT count(*)::int AS count FROM astana_schema_revisions');
      assert.equal(revision.rows[0].count, 1, 'New DDL should be marked exactly once.');
      const workers = await inspectPool.query('SELECT count(*)::int AS count FROM workers');
      assert.equal(workers.rows[0].count, 3, 'Fully initialized old workers must remain unchanged.');
      const admin = await inspectPool.query('SELECT role, active FROM admin_users WHERE lower(email) = $1', [bootstrapAdminEmail]);
      assert.deepEqual(admin.rows, [{ role: 'OPERATOR', active: false }]);

      console.log('PASS: concurrent E1A/main first upgrade preserved the synthetic lead, workers and disabled admin.');
    } finally {
      for (const child of children) stop(child);
    }
  }
} finally {
  await inspectPool.end();
}
