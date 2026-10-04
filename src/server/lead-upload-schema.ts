export const leadUploadSchemaSql = `
  CREATE TABLE IF NOT EXISTS lead_upload_drafts (
    storage_key text PRIMARY KEY,
    submission_id uuid NOT NULL,
    client_file_id uuid NOT NULL,
    content_type text NOT NULL,
    size_bytes integer NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 10485760),
    blob_etag text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'uploading'
      CHECK (status IN ('uploading', 'uploaded', 'attached', 'superseded', 'deleting', 'deleted')),
    lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    uploaded_at timestamptz,
    attached_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    deletion_claim_id uuid,
    deletion_claimed_until timestamptz
  );
  ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS client_file_id uuid;
  ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT '';
  ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS size_bytes integer NOT NULL DEFAULT 0;
  ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS blob_etag text NOT NULL DEFAULT '';
  ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS deletion_claim_id uuid;
  ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS deletion_claimed_until timestamptz;
  ALTER TABLE lead_upload_drafts DROP CONSTRAINT IF EXISTS lead_upload_drafts_status_check;
  ALTER TABLE lead_upload_drafts ADD CONSTRAINT lead_upload_drafts_status_check
    CHECK (status IN ('uploading', 'uploaded', 'attached', 'superseded', 'deleting', 'deleted'));
  CREATE UNIQUE INDEX IF NOT EXISTS lead_upload_drafts_client_file_uq
    ON lead_upload_drafts (submission_id, client_file_id) WHERE client_file_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS lead_upload_drafts_retention_idx
    ON lead_upload_drafts (status, updated_at);

  CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
    bucket_key text NOT NULL,
    window_started_at timestamptz NOT NULL,
    hit_count integer NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
    PRIMARY KEY (bucket_key, window_started_at)
  );
  CREATE INDEX IF NOT EXISTS api_rate_limit_buckets_window_idx
    ON api_rate_limit_buckets (window_started_at);
`;
