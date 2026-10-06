import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const runToken = process.env.ASTANA_ISOLATED_PG_RUN_TOKEN;
const suppliedUrl = process.env.ASTANA_ISOLATED_PG_URL;
assert.match(runToken || '', /^[a-f0-9]{32}$/, 'A disposable PostgreSQL runner token is required.');
assert.ok(suppliedUrl, 'A disposable PostgreSQL runner URL is required.');
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

function launchSchemaWorker() {
  const child = fork(fileURLToPath(import.meta.url), ['--worker'], {
    execArgv: ['--import', 'tsx'],
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      NODE_ENV: 'test',
      ADMIN_EMAIL: '',
    },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString('utf8')).slice(-3000); });
  const timeout = setTimeout(() => child.kill(), 90_000);
  const ready = new Promise((resolve, reject) => {
    child.on('message', (message) => {
      if (message?.type === 'ready') resolve();
    });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`Schema worker exited before ready (${code}): ${stderr}`)));
  });
  const result = new Promise((resolve, reject) => {
    let reportedResult;
    child.on('message', (message) => {
      if (message?.type === 'result') reportedResult = message;
      if (message?.type === 'error') reject(new Error(`Schema worker failed (${message.code}): ${message.message}`));
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Schema worker exited (${code}): ${stderr}`));
      else if (!reportedResult) reject(new Error('Schema worker exited without a result.'));
      else resolve(reportedResult);
    });
  });
  return { child, ready, result, timeout };
}

function stopSchemaWorker(worker) {
  clearTimeout(worker.timeout);
  if (worker.child.exitCode === null) worker.child.kill();
}

try {
  const guard = await inspectPool.query(
    'SELECT run_token FROM astana_isolated_runner_guard WHERE run_token = $1',
    [runToken],
  );
  assert.equal(guard.rowCount, 1, 'The database must belong to this runner invocation.');

  if (process.argv.includes('--worker')) {
    process.env.DATABASE_URL = connectionString;
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_EMAIL = '';
    const { consumeApiRateLimit, listWorkers } = await import('../src/server/db.ts');
    process.send?.({ type: 'ready' });
    process.once('message', async (message) => {
      try {
        assert.equal(message?.type, 'go');
        if (message.operation === 'workers') {
          const rows = await listWorkers(true);
          process.send?.({ type: 'result', count: rows.length }, () => process.exit(0));
          return;
        }
        const windowStart = new Date(message.windowStart);
        const limited = await consumeApiRateLimit(message.key, windowStart, 40);
        process.send?.({ type: 'result', limited }, () => process.exit(0));
      } catch (error) {
        process.send?.({ type: 'error', code: error?.code || 'unknown', message: error?.message || 'unknown' }, () => process.exit(1));
      }
    });
  } else {
    const workerCount = 4;
    const key = `cold-schema:${randomUUID()}`;
    const windowStart = new Date(Math.floor(Date.now() / 600_000) * 600_000);
    const workers = [];
    try {
      for (let index = 0; index < workerCount; index += 1) {
        workers.push(launchSchemaWorker());
      }
      await Promise.all(workers.map((worker) => worker.ready));
      for (const worker of workers) worker.child.send({ type: 'go', key, windowStart: windowStart.toISOString() });
      const results = await Promise.all(workers.map((worker) => worker.result));
      assert.equal(results.length, workerCount);
      assert.ok(results.every((item) => item.limited === false), 'All cold-start requests must pass the rate limit.');
      const bucket = await inspectPool.query(
        'SELECT hit_count FROM api_rate_limit_buckets WHERE bucket_key = $1 AND window_started_at = $2',
        [key, windowStart],
      );
      assert.equal(Number(bucket.rows[0]?.hit_count), workerCount, 'Exactly one bucket hit per worker must be recorded.');
      const seeded = await inspectPool.query('SELECT count(*)::int AS count FROM workers');
      assert.equal(seeded.rows[0].count, 3, 'Schema seeding must not create duplicate workers across instances.');
      const revisions = await inspectPool.query('SELECT count(*)::int AS count FROM astana_schema_revisions');
      assert.equal(revisions.rows[0].count, 1, 'The identical migration must be recorded only once.');

      const warm = launchSchemaWorker();
      workers.push(warm);
      await warm.ready;
      const reader = await inspectPool.connect();
      let warmTimer;
      try {
        await reader.query('BEGIN');
        await reader.query('LOCK TABLE leads IN ACCESS SHARE MODE');
        warm.child.send({ type: 'go', key, windowStart: windowStart.toISOString() });
        const warmResult = await Promise.race([
          warm.result,
          new Promise((_, reject) => {
            warmTimer = setTimeout(() => reject(new Error('A warm instance waited on a lead-table DDL lock.')), 8000);
          }),
        ]);
        assert.equal(warmResult.limited, false, 'A warm instance must accept a request while leads is being read.');
      } finally {
        clearTimeout(warmTimer);
        await reader.query('ROLLBACK');
        reader.release();
      }

      await inspectPool.query("UPDATE workers SET name = 'Robo upravený' WHERE name = 'Robo'");
      const renamed = launchSchemaWorker();
      workers.push(renamed);
      await renamed.ready;
      renamed.child.send({ type: 'go', operation: 'workers' });
      assert.equal((await renamed.result).count, 3);
      const afterRename = await inspectPool.query('SELECT name FROM workers ORDER BY name');
      assert.ok(afterRename.rows.some((row) => row.name === 'Robo upravený'));
      assert.ok(!afterRename.rows.some((row) => row.name === 'Robo'), 'Cold read recreated a renamed worker.');

      await inspectPool.query("DELETE FROM workers WHERE name <> 'Robo upravený'");
      const partial = launchSchemaWorker();
      workers.push(partial);
      await partial.ready;
      partial.child.send({ type: 'go', operation: 'workers' });
      assert.equal((await partial.result).count, 1, 'Partial existing roster must not be replenished.');

      await inspectPool.query('DELETE FROM workers');
      const empty = launchSchemaWorker();
      workers.push(empty);
      await empty.ready;
      empty.child.send({ type: 'go', operation: 'workers' });
      assert.equal((await empty.result).count, 0, 'Intentionally empty roster must remain empty.');

      console.log('PASS: concurrent schema initialization, warm read, and preserved renamed/partial/empty worker rosters.');
    } finally {
      for (const worker of workers) stopSchemaWorker(worker);
    }
  }
} finally {
  await inspectPool.end();
}
