import type { Pool, PoolClient } from 'pg';
/** Run only through a separately approved migration, never from page/request initialization. */
export async function migrateJobWorkspaceSchema(db: Pick<Pool | PoolClient, 'query'>) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS job_workspaces (
      job_id uuid PRIMARY KEY REFERENCES business_jobs(id) ON DELETE CASCADE,
      number text NOT NULL UNIQUE,
      revision integer NOT NULL CHECK (revision > 0),
      operations jsonb NOT NULL,
      settlement jsonb NOT NULL,
      price_override boolean NOT NULL DEFAULT false,
      actual_date_override boolean NOT NULL DEFAULT false,
      timeline jsonb NOT NULL DEFAULT '[]',
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      updated_by text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_workspace_manual_offers (
      id uuid PRIMARY KEY,
      original_number_key text NOT NULL UNIQUE,
      file_sha256 text NOT NULL UNIQUE,
      source_message_id text UNIQUE,
      job_id uuid REFERENCES business_jobs(id) ON DELETE RESTRICT,
      revision integer NOT NULL,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_workspace_notices (
      id uuid PRIMARY KEY,
      job_id uuid NOT NULL REFERENCES business_jobs(id) ON DELETE CASCADE,
      operation_id text NOT NULL,
      data jsonb NOT NULL,
      UNIQUE(job_id, operation_id)
    );
    CREATE TABLE IF NOT EXISTS job_workspace_documents (
      id uuid PRIMARY KEY,
      job_id uuid REFERENCES business_jobs(id) ON DELETE RESTRICT,
      data jsonb NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_workspace_communications (
      id uuid PRIMARY KEY,
      job_id uuid NOT NULL REFERENCES business_jobs(id) ON DELETE CASCADE,
      source_message_id text UNIQUE,
      data jsonb NOT NULL
    );
    CREATE INDEX IF NOT EXISTS job_workspace_manual_offers_job_idx ON job_workspace_manual_offers(job_id);
    CREATE INDEX IF NOT EXISTS job_workspace_documents_job_idx ON job_workspace_documents(job_id);
    CREATE INDEX IF NOT EXISTS job_workspace_communications_job_idx ON job_workspace_communications(job_id);
    ALTER TABLE business_jobs ALTER COLUMN demolition_date DROP NOT NULL;
    ALTER TABLE business_jobs ALTER COLUMN total_price DROP NOT NULL;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS total_price_overridden boolean NOT NULL DEFAULT false;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS actual_date_overridden boolean NOT NULL DEFAULT false;
    ALTER TABLE job_workspaces ADD COLUMN IF NOT EXISTS price_override boolean NOT NULL DEFAULT false;
    ALTER TABLE job_workspaces ADD COLUMN IF NOT EXISTS actual_date_override boolean NOT NULL DEFAULT false;
  `);
}
