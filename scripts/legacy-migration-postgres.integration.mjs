import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
const bootstrapAdminEmail = 'migration-test@example.invalid';
const legacyModule = pathToFileURL(path.join(legacyRoot, 'src/server/db.ts')).href;

function coldStart(mode) {
  assert.ok(mode === 'legacy' || mode === 'new');
  const child = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--worker', mode], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      NODE_ENV: 'test',
      VERCEL_ENV: '',
      ADMIN_EMAIL: bootstrapAdminEmail,
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(child.status, 0, child.stderr?.slice(-3000) || child.error?.message || `${mode} cold start failed`);
}

try {
  const marker = await inspectPool.query('SELECT run_token FROM astana_isolated_runner_guard WHERE run_token = $1', [runToken]);
  assert.equal(marker.rowCount, 1, 'The database must belong to this runner invocation.');

  if (process.argv.includes('--worker')) {
    const mode = process.argv.at(-1);
    assert.ok(mode === 'legacy' || mode === 'new');
    const database = mode === 'legacy' ? await import(legacyModule) : await import('../src/server/db.ts');
    await database.listLeads();
  } else {
    coldStart('legacy');
    const firstWorkerCount = await inspectPool.query('SELECT count(*)::int AS count FROM workers');
    assert.equal(firstWorkerCount.rows[0].count, 3, 'Old bootstrap must be complete before the migration fixture.');

    await inspectPool.query("UPDATE workers SET name = 'Robo upravený' WHERE name = 'Robo'");
    await inspectPool.query("DELETE FROM workers WHERE name <> 'Robo upravený'");
    const leadId = randomUUID();
    const jobId = randomUUID();
    const secondJobId = randomUUID();
    const offerId = randomUUID();
    const fixedTime = '2026-09-01T12:00:00.000Z';
    await inspectPool.query(
      `INSERT INTO leads (id, updated_at, full_name, phone, email, city, object_type, material_type, area_estimate, roofer, term)
       VALUES ($1, $2, 'Syntetický dopyt', '0000000000', 'migration-test@example.invalid', 'Test', $3, $4, 100, $5, $6)`,
      [leadId, fixedTime, 'Rodinn? dom', 'Vlnit? eternit', 'Nem?m strech?ra', '?o najsk?r'],
    );
    await inspectPool.query(
      `INSERT INTO business_jobs (id, updated_at, demolition_date, customer_name, customer_email, object_type, material_type, term)
       VALUES ($1, $2, current_date, 'Syntetická zákazka', 'migration-test@example.invalid', $3, $4, $5)`,
      [jobId, fixedTime, 'Rodinn? dom', 'Vlnit? eternit', '?o najsk?r'],
    );
    await inspectPool.query(
      `INSERT INTO business_jobs (id, updated_at, demolition_date, customer_name, customer_email)
       VALUES ($1, $2, current_date, 'Druhá syntetická zákazka', 'migration-test@example.invalid')`,
      [secondJobId, fixedTime],
    );
    await inspectPool.query(
      `INSERT INTO price_offers (id, number, job_id, valid_until, contact_person, email, object_type, realization_term)
       VALUES ($1, $2, $3, current_date + 14, 'Syntetická ponuka', 'migration-test@example.invalid', $4, $5)`,
      [offerId, `E1B-${offerId}`, secondJobId, 'Rodinn? dom', '?o najsk?r'],
    );
    for (const associatedJobId of [jobId, secondJobId]) {
      await inspectPool.query(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes)
         VALUES ($1, 'business_job', $2, 'price_offer_updated', $3, $4::jsonb)`,
        [randomUUID(), associatedJobId, bootstrapAdminEmail, JSON.stringify({ number: `E1B-${offerId}` })],
      );
    }
    await inspectPool.query("UPDATE admin_users SET role = 'OPERATOR', active = false WHERE lower(email) = $1", [bootstrapAdminEmail]);

    const beforeRevision = await inspectPool.query("SELECT to_regclass('astana_schema_revisions') AS relation");
    assert.equal(beforeRevision.rows[0].relation, null, 'The new migration must not already have run.');
    coldStart('new');

    const workers = await inspectPool.query('SELECT name FROM workers ORDER BY name');
    assert.deepEqual(workers.rows, [{ name: 'Robo upravený' }], 'First new migration must not refill a pre-existing partial roster.');
    const revisions = await inspectPool.query('SELECT count(*)::int AS count FROM astana_schema_revisions');
    assert.equal(revisions.rows[0].count, 1);
    const admin = await inspectPool.query('SELECT role, active FROM admin_users WHERE lower(email) = $1', [bootstrapAdminEmail]);
    assert.deepEqual(admin.rows, [{ role: 'OPERATOR', active: false }]);

    const lead = await inspectPool.query('SELECT object_type, material_type, roofer, term, updated_at, deleted_at FROM leads WHERE id = $1', [leadId]);
    assert.equal(lead.rowCount, 1);
    assert.deepEqual(
      [lead.rows[0].object_type, lead.rows[0].material_type, lead.rows[0].roofer, lead.rows[0].term],
      ['Rodinný dom', 'Vlnitý eternit', 'Nemám strechára', 'Čo najskôr'],
    );
    assert.equal(new Date(lead.rows[0].updated_at).toISOString(), fixedTime);
    assert.equal(lead.rows[0].deleted_at, null);

    const job = await inspectPool.query('SELECT object_type, material_type, term, updated_at, deleted_at FROM business_jobs WHERE id = $1', [jobId]);
    assert.equal(job.rowCount, 1);
    assert.deepEqual([job.rows[0].object_type, job.rows[0].material_type, job.rows[0].term], ['Rodinný dom', 'Vlnitý eternit', 'Čo najskôr']);
    assert.equal(new Date(job.rows[0].updated_at).toISOString(), fixedTime);
    assert.equal(job.rows[0].deleted_at, null);

    const offer = await inspectPool.query('SELECT object_type, realization_term, deleted_at, source_job_ids FROM price_offers WHERE id = $1', [offerId]);
    assert.equal(offer.rowCount, 1);
    assert.deepEqual([offer.rows[0].object_type, offer.rows[0].realization_term], ['Rodinný dom', 'Čo najskôr']);
    assert.equal(offer.rows[0].deleted_at, null);
    assert.deepEqual(new Set(offer.rows[0].source_job_ids), new Set([jobId, secondJobId]), 'migrácia zachová aktuálnu aj auditovanú staršiu väzbu ponuky');

    console.log('PASS: first migration of old schema preserved partial workers, synthetic CRM records and disabled admin.');
  }
} finally {
  await inspectPool.end();
}

if (process.argv.includes('--worker')) process.exit(0);
