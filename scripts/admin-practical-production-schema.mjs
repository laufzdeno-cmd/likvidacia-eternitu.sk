import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import {
  adminPracticalSchemaRevision,
  migrateAdminPracticalSchemaOnce,
} from '../src/server/db.ts';
import { databasePoolConfig, normalizeDatabaseUrl } from '../src/server/database-config.ts';

const expectedProjectId = 'prj_33bexlmoSP20DpesVJ4gWVHmZtkH';
const expectedSiteOrigin = 'https://likvidacia-eternitu.sk';
const expectedColumns = [
  'action', 'content_hash', 'created_at', 'created_by', 'id', 'restored_from_id', 'values',
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
  const table = await client.query(
    "SELECT to_regclass('public.site_content_versions') IS NOT NULL AS exists",
  );
  const columns = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='site_content_versions'`,
  );
  const constraint = await client.query(
    "SELECT 1 FROM pg_constraint WHERE conname='site_content_versions_action_check'",
  );
  const index = await client.query(
    "SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='site_content_versions_created_idx'",
  );
  const revision = await client.query(
    `SELECT 1 FROM astana_targeted_schema_revisions
     WHERE revision=$1`,
    [adminPracticalSchemaRevision],
  ).catch(() => ({ rowCount: 0 }));
  const presentColumns = new Set(columns.rows.map((row) => String(row.column_name)));
  return {
    missingTable: !table.rows[0]?.exists,
    missingColumns: expectedColumns.filter((column) => !presentColumns.has(column)),
    missingConstraint: !constraint.rowCount,
    missingIndex: !index.rowCount,
    missingRevision: !revision.rowCount,
  };
}

function schemaComplete(state) {
  return !state.missingTable
    && state.missingColumns.length === 0
    && !state.missingConstraint
    && !state.missingIndex
    && !state.missingRevision;
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
    console.log(JSON.stringify({ mode: 'check', revision: adminPracticalSchemaRevision, complete: schemaComplete(before), ...before }));
    process.exitCode = schemaComplete(before) ? 0 : 2;
  } else {
    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL lock_timeout = '10s'");
      await client.query("SET LOCAL statement_timeout = '60s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('astana:admin-practical-schema:v1'))");
      const applied = await migrateAdminPracticalSchemaOnce(client);
      const after = await inspectSchema(client);
      if (!schemaComplete(after)) throw new Error(`Migrácia nedoplnila celý kontrakt: ${JSON.stringify(after)}`);
      await client.query('COMMIT');
      console.log(JSON.stringify({ mode: 'apply', revision: adminPracticalSchemaRevision, complete: true, applied }));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
