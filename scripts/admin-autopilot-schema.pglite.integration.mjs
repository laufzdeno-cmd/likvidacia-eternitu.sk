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
  assert.deepEqual(first, { columnsAdded: 5 });
  assert.deepEqual(second, { columnsAdded: 0 });

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
  console.log('Admin autopilot additive schema migration: PASS');
} finally {
  await database.close();
}
