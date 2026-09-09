import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
if (!connectionString) throw new Error('DATABASE_URL or POSTGRES_URL is required');
const db = new Pool({ connectionString });

try {
  const active = await db.query<{ id: string; email: string }>(
    `SELECT id, email FROM leads
     WHERE email LIKE 'qa-production-%@example.test'
       AND created_at > now() - interval '2 hours'
       AND status <> 'archivovane'`,
  );
  await db.query('BEGIN');
  for (const row of active.rows) {
    await db.query("UPDATE leads SET status = 'archivovane', updated_at = now() WHERE id = $1", [row.id]);
    await db.query('UPDATE business_jobs SET deleted_at = now(), updated_at = now() WHERE customer_email = $1 AND deleted_at IS NULL', [row.email]);
    await db.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
      [randomUUID(), 'lead', row.id, 'qa_soft_archived', 'system', { email: row.email, reason: 'recovered QA measurement test trace' }],
    );
  }
  await db.query('COMMIT');
  const remaining = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM leads
     WHERE email LIKE 'qa-production-%@example.test'
       AND created_at > now() - interval '2 hours'
       AND status <> 'archivovane'`,
  );
  assert.equal(remaining.rows[0]?.count, 0, 'no active production QA traces remain');
  console.log(`PASS — soft-archived ${active.rowCount} previously active production QA trace(s).`);
} catch (error) {
  await db.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await db.end();
}
