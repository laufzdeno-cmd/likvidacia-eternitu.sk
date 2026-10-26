import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { databasePoolConfig, normalizeDatabaseUrl } from '../src/server/database-config.ts';
import { deploymentDatabaseIdentity } from '../src/server/preview-safety.ts';

const revision = 'gmail-price-offer-v1-2026-10-26';
const expectedProject = 'prj_33bexlmoSP20DpesVJ4gWVHmZtkH';
const expectedOrigin = 'https://likvidacia-eternitu.sk';
const expectedColumns = {
  gmail_price_offer_connections: [
    'connection_key', 'email_address', 'encrypted_refresh_token', 'active', 'label_id',
    'label_name', 'connected_by', 'connected_at', 'token_validated_at', 'last_success_at',
    'last_error_code', 'updated_at',
  ],
  gmail_price_offer_oauth_states: [
    'state_hash', 'actor_email', 'encrypted_code_verifier', 'expires_at', 'used_at', 'created_at',
  ],
  gmail_price_offer_label_jobs: [
    'id', 'offer_id', 'rfc822_message_id', 'gmail_message_id', 'status', 'attempts',
    'next_attempt_at', 'claim_token', 'claimed_at', 'last_error_code', 'completed_at',
    'created_at', 'updated_at',
  ],
};
const expectedIndexes = [
  'gmail_price_offer_oauth_states_expiry_idx',
  'gmail_price_offer_label_jobs_due_idx',
];

function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === '--check') return { apply: false };
  if (argv.length === 3 && argv[0] === '--apply' && argv[1] === '--confirm-production'
    && /^[a-f0-9]{40}$/i.test(argv[2])) return { apply: true, sha: argv[2].toLowerCase() };
  throw new Error('Použite --check alebo --apply --confirm-production <git-sha>.');
}

async function inspect(client) {
  const columns = await client.query(
    `SELECT table_name,column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=ANY($1::text[])`,
    [Object.keys(expectedColumns)],
  );
  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname='public' AND indexname=ANY($1::text[])`,
    [expectedIndexes],
  );
  const existingColumns = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const existingIndexes = new Set(indexes.rows.map((row) => row.indexname));
  const missingColumns = Object.entries(expectedColumns).flatMap(([table, names]) => (
    names.filter((name) => !existingColumns.has(`${table}.${name}`)).map((name) => `${table}.${name}`)
  ));
  const missingIndexes = expectedIndexes.filter((name) => !existingIndexes.has(name));
  return { complete: missingColumns.length === 0 && missingIndexes.length === 0, missingColumns, missingIndexes };
}

const { apply, sha } = parseArguments(process.argv.slice(2));
if (process.env.ASTANA_RELEASE_TARGET !== 'production'
  || process.env.ASTANA_RELEASE_PROJECT_ID !== expectedProject
  || process.env.ASTANA_RELEASE_SITE_ORIGIN !== expectedOrigin
  || process.env.VERCEL_ENV !== 'production') {
  throw new Error('Produkčný cieľ, projekt, doména alebo prostredie nie sú jednoznačne potvrdené.');
}
const pooledUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
const unpooledUrl = normalizeDatabaseUrl(process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING);
if (!pooledUrl || !unpooledUrl || !process.env.DATABASE_RESOURCE_ID
  || deploymentDatabaseIdentity(pooledUrl) !== deploymentDatabaseIdentity(unpooledUrl)) {
  throw new Error('Produkčné databázové väzby nesedia alebo chýbajú.');
}
if (apply) {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim().toLowerCase();
  if (head !== sha) throw new Error('Potvrdený Git SHA nezodpovedá aktuálnemu HEAD.');
}

const pool = new Pool({ ...databasePoolConfig(unpooledUrl), max: 1 });
const client = await pool.connect();
try {
  const before = await inspect(client);
  if (!apply) {
    console.log(JSON.stringify({ mode: 'check', revision, ...before }));
    process.exitCode = before.complete ? 0 : 2;
  } else {
    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '45s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('astana:gmail-price-offer-schema:v1'))");
      await client.query(`
        CREATE TABLE IF NOT EXISTS gmail_price_offer_connections (
          connection_key text PRIMARY KEY,
          email_address text NOT NULL,
          encrypted_refresh_token text NOT NULL,
          active boolean NOT NULL DEFAULT true,
          label_id text NOT NULL DEFAULT '',
          label_name text NOT NULL DEFAULT '✓ CP odoslaná',
          connected_by text NOT NULL,
          connected_at timestamptz NOT NULL DEFAULT now(),
          token_validated_at timestamptz,
          last_success_at timestamptz,
          last_error_code text NOT NULL DEFAULT '',
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS gmail_price_offer_oauth_states (
          state_hash char(64) PRIMARY KEY,
          actor_email text NOT NULL,
          encrypted_code_verifier text NOT NULL,
          expires_at timestamptz NOT NULL,
          used_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS gmail_price_offer_label_jobs (
          id uuid PRIMARY KEY,
          offer_id uuid NOT NULL REFERENCES price_offers(id) ON DELETE RESTRICT,
          rfc822_message_id text NOT NULL,
          gmail_message_id text NOT NULL DEFAULT '',
          status text NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending','processing','retry','completed','attention')),
          attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
          next_attempt_at timestamptz NOT NULL DEFAULT now(),
          claim_token uuid,
          claimed_at timestamptz,
          last_error_code text NOT NULL DEFAULT '',
          completed_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (offer_id),
          UNIQUE (rfc822_message_id)
        );
        CREATE INDEX IF NOT EXISTS gmail_price_offer_oauth_states_expiry_idx
          ON gmail_price_offer_oauth_states (expires_at);
        CREATE INDEX IF NOT EXISTS gmail_price_offer_label_jobs_due_idx
          ON gmail_price_offer_label_jobs (status, next_attempt_at, created_at);
        CREATE TABLE IF NOT EXISTS astana_targeted_schema_revisions (
          revision text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      const after = await inspect(client);
      if (!after.complete) throw new Error(`Gmail schéma zostala neúplná: ${JSON.stringify(after)}`);
      await client.query(
        'INSERT INTO astana_targeted_schema_revisions (revision) VALUES ($1) ON CONFLICT DO NOTHING',
        [revision],
      );
      await client.query('COMMIT');
      console.log(JSON.stringify({ mode: 'apply', revision, complete: true, tablesAdded: before.missingColumns.length > 0 }));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
