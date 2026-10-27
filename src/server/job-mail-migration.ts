import { emptyJobMailStore } from './job-mail-store';

/** Explicit deployment migration only. No runtime schema creation and no production invocation from UI. */
export async function migrateJobMailSchema(db: { query: (sql: string, parameters?: unknown[]) => Promise<unknown> }) {
  await db.query(`CREATE TABLE IF NOT EXISTS job_mail_workspace_state (
    id integer PRIMARY KEY CHECK(id=1), payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.query('INSERT INTO job_mail_workspace_state (id,payload) VALUES (1,$1::jsonb) ON CONFLICT(id) DO NOTHING', [JSON.stringify(emptyJobMailStore())]);
}
