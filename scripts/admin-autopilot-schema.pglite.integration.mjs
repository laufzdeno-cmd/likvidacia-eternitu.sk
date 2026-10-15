import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrateAdminAssistantSchemaOnce } from '../src/server/db.ts';

const database = new PGlite();

try {
  await database.exec(`
    CREATE TABLE business_jobs (
      id uuid PRIMARY KEY
    );
    CREATE TABLE review_requests (
      id uuid PRIMARY KEY
    );
    CREATE TABLE price_offers (
      id uuid PRIMARY KEY,
      number text NOT NULL,
      status text NOT NULL DEFAULT 'KONCEPT'
    );
  `);

  const first = await migrateAdminAssistantSchemaOnce(database);
  const second = await migrateAdminAssistantSchemaOnce(database);
  assert.deepEqual(first, { columnsAdded: 44, tablesAdded: 3 });
  assert.deepEqual(second, { columnsAdded: 0, tablesAdded: 0 });

  const columns = await database.query(`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'price_offers'
      AND column_name IN (
        'email_subject', 'email_body', 'outcome_reason', 'next_follow_up_at', 'outcome_updated_at',
        'response_token_hash', 'response_token_expires_at', 'customer_response',
        'customer_response_reason_code', 'customer_requested_follow_up_at', 'customer_responded_at',
        'customer_response_payload_hash', 'customer_response_revision', 'customer_response_applied_at',
        'customer_response_applied_by', 'customer_response_dismissed_at', 'customer_response_dismissed_by',
        'customer_response_dismiss_reason'
      )
    ORDER BY column_name
  `);
  assert.equal(columns.rows.length, 18);
  for (const column of columns.rows.filter((row) => ['email_subject', 'email_body', 'outcome_reason'].includes(row.column_name))) {
    assert.equal(column.is_nullable, 'NO');
    assert.match(String(column.column_default), /''::text/);
  }
  assert.equal(columns.rows.find((row) => row.column_name === 'next_follow_up_at')?.is_nullable, 'YES');
  assert.equal(columns.rows.find((row) => row.column_name === 'outcome_updated_at')?.is_nullable, 'YES');
  const tables = await database.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN (
      'admin_autopilot_runs','admin_autopilot_run_items','business_job_completion','astana_targeted_schema_revisions'
    )
    ORDER BY table_name
  `);
  assert.deepEqual(tables.rows.map((row) => row.table_name), [
    'admin_autopilot_run_items', 'admin_autopilot_runs', 'astana_targeted_schema_revisions', 'business_job_completion',
  ]);
  const jobColumns = await database.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='business_jobs'
      AND column_name IN ('review_request_blocked_at','review_request_blocked_by','review_request_blocked_reason')
    ORDER BY column_name
  `);
  assert.equal(jobColumns.rows.length, 3);
  const reviewColumns = await database.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='review_requests'
      AND column_name IN ('job_id','customer_email','subject','token_hash','token_expires_at','sent_at','opened_at',
        'submitted_at','approved_at','published_at','reminder_allowed','reminder_due_at','reminder_attempted_at',
        'reminder_sent_at','reminder_status','reminder_token_hash','reminder_token_expires_at',
        'reminder_delivery_reason_code','reminder_message_id_hash','delivery_reason_code','delivery_message_id_hash',
        'testimonial_id','revision')
    ORDER BY column_name
  `);
  assert.equal(reviewColumns.rows.length, 23);
  const reviewIndex = await database.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND indexname='review_requests_job_unique_idx'
  `);
  assert.equal(reviewIndex.rows.length, 1);
  const revision = await database.query('SELECT revision FROM astana_targeted_schema_revisions');
  assert.deepEqual(revision.rows.map((row) => row.revision), ['admin-assistant-v2.1-2026-10-15']);
  await database.query(`
    INSERT INTO admin_autopilot_runs (id, trigger, actor_kind, status, counts)
    VALUES ('00000000-0000-4000-a000-000000000001','test','system','running','{}'::jsonb)
  `);
  await database.query(`
    INSERT INTO admin_autopilot_run_items (id, run_id, module, entity_id, outcome, reason_code)
    VALUES ('00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000001','offers','00000000-0000-4000-a000-000000000003','blocked','missing_area')
  `);
  const ledger = await database.query('SELECT count(*)::int AS total FROM admin_autopilot_run_items');
  assert.equal(ledger.rows[0].total, 1);
  console.log('Admin assistant additive production schema migration: PASS');
} finally {
  await database.close();
}
