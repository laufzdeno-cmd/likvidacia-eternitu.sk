import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';

// In-memory database, loopback-only socket, no form, Blob, SMTP or external account calls.
async function freeLoopbackPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

const { Pool } = pg;
let database;
let socket;
let inspection;
let exitCode = 0;
try {
  const port = await freeLoopbackPort();
  database = await PGlite.create();
  socket = new PGLiteSocketServer({ db: database, port, host: '127.0.0.1', maxConnections: 4 });
  await socket.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.ADMIN_EMAIL = '';
  assert.match(process.env.DATABASE_URL, /^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\//);

  const { getLeadAttributionReport } = await import('../src/server/db.ts');
  const { getAnalyticsPeriod } = await import('../src/server/analytics-metrics.ts');
  inspection = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, idleTimeoutMillis: 1000 });
  const since = getAnalyticsPeriod(1, new Date('2026-10-01T08:00:00.000Z')).since;
  assert.equal(since, '2026-09-30T22:00:00.000Z');
  await getLeadAttributionReport(1, since); // Initializes only the isolated PGlite schema.

  const leadIds = Object.fromEntries(['both', 'archived-job', 'draft-only', 'test', 'archived-lead', 'old'].map((key) => [key, randomUUID()]));
  for (const [key, id] of Object.entries(leadIds)) {
    await inspection.query(
      `INSERT INTO leads (id, created_at, status, full_name, phone, email, city, object_type, material_type, area_estimate, raw_data, note, deleted_at)
       VALUES ($1,$2,'novy','Local fixture','', 'local@example.invalid', 'Test', 'Test', 'Test', 1,$3::jsonb,$4,$5)`,
      [id, key === 'old' ? '2026-09-30T21:59:59.000Z' : '2026-09-30T22:30:00.000Z',
        JSON.stringify({ attribution: { utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'october' } }),
        key === 'test' ? 'TEST – NEKONTAKTOVAŤ, NEPOSIELAŤ PONUKU' : '',
        key === 'archived-lead' ? '2026-10-01T11:00:00.000Z' : null],
    );
  }

  for (const [key, status] of [['both', 'sent'], ['both', 'accepted'], ['archived-lead', 'accepted'], ['old', 'accepted'], ['draft-only', 'draft']]) {
    await inspection.query(
      `INSERT INTO quotes (id, lead_id, quote_number, status, valid_until, area_estimate, price_per_m2, total_without_vat, total_with_vat, created_by)
       VALUES ($1,$2,$3,$4,DATE '2026-12-31',1,1,1,1,'local-test')`,
      [randomUUID(), leadIds[key], `local-${randomUUID()}`, status],
    );
  }
  const jobIds = Object.fromEntries(['both', 'archived-job', 'draft-only', 'test'].map((key) => [key, randomUUID()]));
  for (const [key, id] of Object.entries(jobIds)) {
    await inspection.query(
      `INSERT INTO business_jobs (id, lead_id, demolition_date, customer_name, deleted_at)
       VALUES ($1,$2,DATE '2026-10-02','Local fixture',$3)`,
      [id, leadIds[key], key === 'archived-job' ? '2026-10-02T00:00:00.000Z' : null],
    );
  }
  for (const [key, status, archived] of [
    ['both', 'PRIJATA', true], ['both', 'ODOSLANA', false],
    ['archived-job', 'ODOSLANA', true], ['draft-only', 'PRIPRAVENA', false],
    ['test', 'ODOSLANA', false],
  ]) {
    await inspection.query(
      `INSERT INTO price_offers (id, number, job_id, valid_until, status, deleted_at)
       VALUES ($1,$2,$3,DATE '2026-12-31',$4,$5)`,
      [randomUUID(), `local-${randomUUID()}`, jobIds[key], status, archived ? '2026-10-03T00:00:00.000Z' : null],
    );
  }
  await inspection.query(
    `INSERT INTO price_offers (id, number, valid_until, status)
     VALUES ($1,$2,DATE '2026-12-31','PRIJATA')`,
    [randomUUID(), `detached-${randomUUID()}`],
  );

  const cohort = (await getLeadAttributionReport(1, since)).find((row) => row.campaign === 'october');
  assert.deepEqual(cohort, {
    source: 'google', medium: 'cpc', campaign: 'october', leads: 4,
    leadsWithIssuedOffer: 3, leadsWithAcceptedOffer: 1, progressedLeads: 0,
  }, 'one lead counts once across documents; archived job/offer outcomes and unmarked test lead remain');

  await inspection.query(
    `INSERT INTO leads (id, created_at, status, full_name, phone, email, city, object_type, material_type, area_estimate, raw_data)
     SELECT gen_random_uuid(), TIMESTAMPTZ '2026-09-30 22:30:00+00', 'novy', 'Local fixture', '', 'local@example.invalid', 'Test', 'Test', 'Test', 1,
       jsonb_build_object('attribution', jsonb_build_object('utmCampaign', 'campaign-' || lpad(n::text, 2, '0')))
     FROM generate_series(0, 54) AS n`,
  );
  assert.equal((await getLeadAttributionReport(1, since)).length, 50, 'UI remains capped at 50 rows');
  assert.equal((await getLeadAttributionReport(1, since, null)).length, 56, 'CSV mode exports all campaign rows');
  console.log('PASS: isolated PGlite CRM campaign cohort; no external calls, forms or email.');
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  try { await inspection?.end(); } catch (error) { exitCode = 1; console.error(error); }
  // The application owns a process-wide pg Pool; this dedicated worker exit closes its loopback socket.
  process.exit(exitCode);
}
