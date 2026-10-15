import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import {
  adminAssistantSchemaRevision,
  migrateAdminAssistantSchemaOnce,
} from '../src/server/db.ts';
import { databasePoolConfig, normalizeDatabaseUrl } from '../src/server/database-config.ts';

const expectedProjectId = 'prj_33bexlmoSP20DpesVJ4gWVHmZtkH';
const expectedSiteOrigin = 'https://likvidacia-eternitu.sk';
const expectedTables = [
  'admin_autopilot_run_items',
  'admin_autopilot_runs',
  'astana_targeted_schema_revisions',
  'business_job_completion',
];
const expectedColumns = {
  business_jobs: [
    'review_request_blocked_at',
    'review_request_blocked_by',
    'review_request_blocked_reason',
  ],
  price_offers: [
    'customer_requested_follow_up_at',
    'customer_responded_at',
    'customer_response',
    'customer_response_applied_at',
    'customer_response_applied_by',
    'customer_response_dismiss_reason',
    'customer_response_dismissed_at',
    'customer_response_dismissed_by',
    'customer_response_payload_hash',
    'customer_response_reason_code',
    'customer_response_revision',
    'email_body',
    'email_subject',
    'next_follow_up_at',
    'outcome_reason',
    'outcome_updated_at',
    'response_token_expires_at',
    'response_token_hash',
  ],
  review_requests: [
    'approved_at',
    'customer_email',
    'delivery_message_id_hash',
    'delivery_reason_code',
    'job_id',
    'opened_at',
    'published_at',
    'reminder_allowed',
    'reminder_attempted_at',
    'reminder_delivery_reason_code',
    'reminder_due_at',
    'reminder_message_id_hash',
    'reminder_sent_at',
    'reminder_status',
    'reminder_token_expires_at',
    'reminder_token_hash',
    'revision',
    'sent_at',
    'subject',
    'submitted_at',
    'testimonial_id',
    'token_expires_at',
    'token_hash',
  ],
};
const expectedConstraints = [
  'business_job_completion_costs_check',
  'business_job_completion_documents_check',
  'business_job_completion_documents_reason_check',
  'business_job_completion_no_photos_reason_check',
  'business_job_completion_photos_check',
  'business_job_completion_review_check',
  'business_job_completion_zero_costs_reason_check',
  'price_offers_customer_response_check',
];
const expectedIndexes = [
  'admin_autopilot_run_items_run_idx',
  'admin_autopilot_runs_started_idx',
  'admin_autopilot_runs_status_idx',
  'price_offers_response_token_hash_unique_idx',
  'review_requests_job_unique_idx',
];

function argumentsFrom(argv) {
  const mode = argv[0];
  if (mode !== '--check' && mode !== '--apply') {
    throw new Error('Použite --check alebo --apply --confirm-production <git-sha>.');
  }
  if (mode === '--check') {
    if (argv.length !== 1) throw new Error('--check neprijíma ďalšie parametre.');
    return { mode };
  }
  if (argv.length !== 3 || argv[1] !== '--confirm-production' || !/^[0-9a-f]{40}$/i.test(argv[2])) {
    throw new Error('--apply vyžaduje --confirm-production s plným Git SHA.');
  }
  return { mode, confirmedSha: argv[2].toLowerCase() };
}

function canonicalOrigin(value) {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return '';
  }
}

async function inspectSchema(client) {
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name=ANY($1::text[])`,
    [expectedTables],
  );
  const columns = await client.query(
    `SELECT table_name,column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=ANY($1::text[])`,
    [Object.keys(expectedColumns)],
  );
  const constraints = await client.query(
    `SELECT conname FROM pg_constraint WHERE conname=ANY($1::text[])`,
    [expectedConstraints],
  );
  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname=ANY($1::text[])`,
    [expectedIndexes],
  );
  const presentTables = new Set(tables.rows.map((row) => String(row.table_name)));
  const presentColumns = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const presentConstraints = new Set(constraints.rows.map((row) => String(row.conname)));
  const presentIndexes = new Set(indexes.rows.map((row) => String(row.indexname)));
  return {
    missingTables: expectedTables.filter((table) => !presentTables.has(table)),
    missingColumns: Object.entries(expectedColumns).flatMap(([table, names]) => (
      names.filter((name) => !presentColumns.has(`${table}.${name}`)).map((name) => `${table}.${name}`)
    )),
    missingConstraints: expectedConstraints.filter((name) => !presentConstraints.has(name)),
    missingIndexes: expectedIndexes.filter((name) => !presentIndexes.has(name)),
  };
}

function schemaComplete(state) {
  return state.missingTables.length === 0
    && state.missingColumns.length === 0
    && state.missingConstraints.length === 0
    && state.missingIndexes.length === 0;
}

const parsed = argumentsFrom(process.argv.slice(2));
const connectionString = normalizeDatabaseUrl(
  process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING,
);
if (!connectionString) throw new Error('Chýba produkčné nepoolované databázové pripojenie.');
if (process.env.ASTANA_RELEASE_TARGET !== 'production') throw new Error('Chýba explicitný produkčný cieľ migrácie.');
if (process.env.ASTANA_RELEASE_PROJECT_ID !== expectedProjectId) throw new Error('Nesedí potvrdený Vercel project ID.');
if (canonicalOrigin(process.env.ASTANA_RELEASE_SITE_ORIGIN || '') !== expectedSiteOrigin) {
  throw new Error('Chýba explicitné potvrdenie produkčnej domény likvidacia-eternitu.sk.');
}
if (process.env.NEXT_PUBLIC_SITE_URL
  && canonicalOrigin(process.env.NEXT_PUBLIC_SITE_URL) !== expectedSiteOrigin) {
  throw new Error('Produkčná doména vo Vercel prostredí nezodpovedá likvidacia-eternitu.sk.');
}
if (parsed.mode === '--apply') {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim().toLowerCase();
  if (head !== parsed.confirmedSha) throw new Error('Potvrdený Git SHA nezodpovedá aktuálnemu HEAD.');
}

const pool = new Pool({ ...databasePoolConfig(connectionString), max: 1 });
const client = await pool.connect();
try {
  const before = await inspectSchema(client);
  if (parsed.mode === '--check') {
    console.log(JSON.stringify({ mode: 'check', revision: adminAssistantSchemaRevision, complete: schemaComplete(before), ...before }));
    process.exitCode = schemaComplete(before) ? 0 : 2;
  } else {
    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL lock_timeout = '10s'");
      await client.query("SET LOCAL statement_timeout = '120s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('astana:admin-assistant-schema:v2'))");
      const applied = await migrateAdminAssistantSchemaOnce(client);
      await client.query('COMMIT');
      const after = await inspectSchema(client);
      if (!schemaComplete(after)) throw new Error(`Migrácia nedoplnila celý kontrakt: ${JSON.stringify(after)}`);
      console.log(JSON.stringify({ mode: 'apply', revision: adminAssistantSchemaRevision, complete: true, applied }));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
