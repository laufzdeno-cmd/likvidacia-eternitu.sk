import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';
import { analyticsRetentionCutoff } from '../src/server/analytics-retention-policy.ts';

// Entirely disposable in-memory PostgreSQL over loopback. No external account or storage.
let database;
let socket;
let inspection;
let exitCode = 0;
try {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  database = await PGlite.create();
  socket = new PGLiteSocketServer({ db: database, port, host: '127.0.0.1', maxConnections: 4 });
  await socket.start();
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`, ADMIN_EMAIL: '', VERCEL: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '', CRON_SECRET: 'isolated-retention-fixture' });
  assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1');
  globalThis.fetch = () => { throw new Error('External requests forbidden in analytics retention test.'); };
  const db = await import('../src/server/db.ts');
  await db.listAnalyticsEvents(); // Initialize only the disposable schema.
  inspection = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, idleTimeoutMillis: 1000 });
  const referenceTime = new Date();
  const cutoff = analyticsRetentionCutoff(referenceTime);
  const old = new Date(Date.parse(cutoff) - 1).toISOString();
  const fresh = referenceTime.toISOString();
  const leads = { old: randomUUID(), oldInvalid: randomUUID(), fresh: randomUUID() };
  for (const [kind, id] of Object.entries(leads)) {
    await inspection.query(`INSERT INTO leads (id, created_at, status, full_name, phone, email, city, object_type, material_type, area_estimate, raw_data)
      VALUES ($1,$2,'novy','Local fixture','','fixture@example.invalid','Test','Test','Test',1,$3::jsonb)`,
    [id, kind === 'fresh' ? fresh : old, JSON.stringify({ analyticsConsentAtSubmit: true, analyticsSessionId: kind === 'oldInvalid' ? 'broken' : randomUUID(), attribution: { utmSource: 'fixture', gclid: 'kept-business-attribution' } })]);
  }
  const jobId = randomUUID();
  const invoiceId = randomUUID();
  await inspection.query(`INSERT INTO business_jobs (id, lead_id, demolition_date, customer_name) VALUES ($1,$2,DATE '2026-10-01','Local fixture')`, [jobId, leads.old]);
  await inspection.query(`INSERT INTO price_offers (id, number, job_id, lead_id, valid_until, status) VALUES ($1,'FIXTURE-CP-001',$2,$3,DATE '2026-12-31','ODOSLANA')`, [randomUUID(), jobId, leads.old]);
  await inspection.query(`INSERT INTO business_job_invoices (id,job_id,operation_id,request_hash,invoice_number,issued_on,amount_without_vat_cents,vat_rate_basis_points,amount_with_vat_cents,created_by)
    VALUES ($1,$2,$3,$4,'FIXTURE-INV-001',DATE '2026-10-01',10000,2300,12300,'fixture')`, [invoiceId, jobId, randomUUID(), 'a'.repeat(64)]);
  await inspection.query(`INSERT INTO business_job_payment_events (id,job_id,invoice_id,operation_id,request_hash,event_type,occurred_on,amount_cents,method,created_by)
    VALUES ($1,$2,$3,$4,$5,'RECEIPT',DATE '2026-10-02',5000,'BANK_TRANSFER','fixture')`, [randomUUID(), jobId, invoiceId, randomUUID(), 'b'.repeat(64)]);
  await inspection.query(`INSERT INTO audit_logs (id,entity_type,entity_id,action,actor_email,created_at) VALUES ($1,'lead',$2,'fixture','fixture',$3)`, [randomUUID(), leads.old, old]);
  const consentSubject = randomUUID();
  await inspection.query(`INSERT INTO lead_meta_capi_consent_subjects (consent_subject) VALUES ($1)`, [consentSubject]);
  await inspection.query(`INSERT INTO lead_meta_capi_outbox (id,lead_id,event_id,consent_subject,event_time,event_source_url,material,status) VALUES ($1,$2,$3,$4,$5,'https://example.invalid/','vlnity','sent')`, [randomUUID(), leads.old, `astana-lead-${leads.old}`, consentSubject, old]);
  await inspection.query(`INSERT INTO meta_capi_outbox (id,event_id,event_time,payload,status) VALUES ($1,$2,1,'{"kept":true}','sent')`, [randomUUID(), randomUUID()]);
  await inspection.query(`INSERT INTO meta_conversion_outbox (id,lead_id,event_name,event_id,event_time,payload,status) VALUES ($1,$2,'Lead',$3,$4,'{"kept":true}','sent')`, [randomUUID(), leads.old, randomUUID(), old]);

  const originalBackup = await db.exportDatabaseBackup();
  assert.equal('analytics_events' in originalBackup.tables, false);
  assert.deepEqual(originalBackup.excludedTables, ['analytics_events']);
  for (const key of ['leads', 'price_offers', 'business_jobs', 'business_job_invoices', 'business_job_payment_events', 'audit_logs', 'lead_meta_capi_outbox', 'lead_meta_capi_consent_subjects', 'meta_capi_outbox', 'meta_conversion_outbox']) assert.ok(originalBackup.tables[key].length, key);

  for (const [createdAt, eventType, id] of [[old, 'page_view', randomUUID()], [old, 'form_submit_success', leads.old], [cutoff, 'page_view', randomUUID()], [fresh, 'page_view', randomUUID()]]) {
    await inspection.query('INSERT INTO analytics_events (id,created_at,session_id,event_type) VALUES ($1,$2,$3,$4)', [id, createdAt, randomUUID(), eventType]);
  }
  // A report must enforce age even before the first physical purge.
  assert.equal((await db.getAnalyticsTrafficSummary()).allTime.pageViews, 1);
  assert.equal((await db.getAnalyticsEventsWithCoverage(365, '2000-01-01T00:00:00.000Z')).events.length, 1);
  assert.deepEqual(await db.purgeExpiredAnalyticsEvents({ referenceTime, batchSize: 1 }), { cutoff, deleted: 1, remaining: true, invalidDates: 0 });
  assert.deepEqual(await db.purgeExpiredAnalyticsEvents({ referenceTime, batchSize: 1 }), { cutoff, deleted: 1, remaining: false, invalidDates: 0 });
  assert.equal((await inspection.query('SELECT COUNT(*)::int AS count FROM analytics_events WHERE created_at = $1', [cutoff])).rows[0].count, 1, 'exact cutoff is retained');
  assert.deepEqual(await db.purgeExpiredAnalyticsEvents({ referenceTime }), { cutoff, deleted: 0, remaining: false, invalidDates: 0 });
  assert.equal(await db.recordAnalyticsEvent({ createdAt: old, eventType: 'page_view', sessionId: randomUUID() }), null);
  assert.deepEqual(await db.recoverAcceptedLeadAnalytics(), { recovered: 1, failed: false, remaining: false, unrecoverable: 0 });
  assert.deepEqual(await db.recoverAcceptedLeadAnalytics(), { recovered: 0, failed: false, remaining: false, unrecoverable: 0 });
  assert.equal((await inspection.query('SELECT COUNT(*)::int AS count FROM analytics_events WHERE id=$1', [leads.old])).rows[0].count, 0);
  const afterBackup = await db.exportDatabaseBackup();
  assert.deepEqual(afterBackup.tables, originalBackup.tables, 'all business, financial, consent and advertising tables are byte-for-byte unchanged');
  await assert.rejects(db.purgeExpiredAnalyticsEvents({ referenceTime: new Date('invalid') }), /Invalid analytics retention clock/);

  await inspection.query(`INSERT INTO analytics_events (id,created_at,session_id,event_type)
    SELECT gen_random_uuid(), $1::timestamptz, '', 'page_view' FROM generate_series(1,40001)`, [old]);
  const { GET } = await import('../app/api/cron/analytics-retention/route.ts');
  const request = () => new Request('https://example.invalid/api/cron/analytics-retention/', { headers: { authorization: 'Bearer isolated-retention-fixture' } });
  const incomplete = await GET(request());
  assert.equal(incomplete.status, 503, 'bounded backlog must not claim successful completion');
  const backlog = await incomplete.json();
  assert.equal(backlog.ok, false);
  assert.equal(backlog.remaining, true);
  assert.equal(backlog.deleted, 40000);
  assert.equal(backlog.batches, 8);
  const completed = await GET(request());
  assert.equal(completed.status, 200);
  assert.equal((await completed.json()).remaining, false);
  assert.deepEqual((await db.exportDatabaseBackup()).tables, originalBackup.tables);
  console.log('PASS: isolated PGlite analytics retention, exact boundary, bounded cron, recovery, business/advertising isolation and backup exclusion.');
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  try { await inspection?.end(); } catch (error) { exitCode = 1; console.error(error); }
  // The application owns its process-wide pool; exiting this dedicated test closes loopback sockets.
  process.exit(exitCode);
}
