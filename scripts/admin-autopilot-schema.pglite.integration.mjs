import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrateAdminAutopilotSchema } from '../src/server/db.ts';

const database = new PGlite();

try {
  await database.exec(`
    CREATE TABLE price_offers (
      id uuid PRIMARY KEY,
      number text NOT NULL,
      status text NOT NULL DEFAULT 'KONCEPT'
    );
  `);

  const first = await migrateAdminAutopilotSchema(database);
  const second = await migrateAdminAutopilotSchema(database);
  assert.deepEqual(first, { columnsAdded: 5, tablesAdded: 2 });
  assert.deepEqual(second, { columnsAdded: 0, tablesAdded: 0 });

  const columns = await database.query(`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'price_offers'
      AND column_name IN ('email_subject', 'email_body', 'outcome_reason', 'next_follow_up_at', 'outcome_updated_at')
    ORDER BY column_name
  `);
  assert.equal(columns.rows.length, 5);
  for (const column of columns.rows.filter((row) => ['email_subject', 'email_body', 'outcome_reason'].includes(row.column_name))) {
    assert.equal(column.is_nullable, 'NO');
    assert.match(String(column.column_default), /''::text/);
  }
  assert.equal(columns.rows.find((row) => row.column_name === 'next_follow_up_at')?.is_nullable, 'YES');
  assert.equal(columns.rows.find((row) => row.column_name === 'outcome_updated_at')?.is_nullable, 'YES');
  const tables = await database.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('admin_autopilot_runs','admin_autopilot_run_items')
    ORDER BY table_name
  `);
  assert.deepEqual(tables.rows.map((row) => row.table_name), ['admin_autopilot_run_items', 'admin_autopilot_runs']);
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
  console.log('Admin autopilot additive schema migration: PASS');
} finally {
  await database.close();
}
