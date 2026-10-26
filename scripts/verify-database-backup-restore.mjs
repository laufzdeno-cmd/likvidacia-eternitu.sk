import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { get, list } from '@vercel/blob';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';

// This drill reads the newest private production backup, recreates the current
// application schema in an in-memory PGlite database and restores every row
// there. The production database is queried only for its table inventory.
const requiredTables = [
  'admin_users',
  'application_notification_outbox',
  'audit_logs',
  'business_jobs',
  'career_applications',
  'leads',
  'price_offers',
  'quotes',
  'realizations',
  'review_requests',
  'testimonials',
];

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function listAllBackups() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: 'backup/', cursor });
    blobs.push(...page.blobs.filter((blob) => blob.pathname.endsWith('/db-backup.json')));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
}

function normalizeValue(value, dataType) {
  if (value === null || value === undefined) return null;
  if (dataType === 'bytea' && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }
  return value;
}

const productionDatabaseUrl = process.env.DATABASE_URL?.trim();
assert.ok(productionDatabaseUrl, 'DATABASE_URL is required.');
assert.ok(process.env.BLOB_READ_WRITE_TOKEN, 'BLOB_READ_WRITE_TOKEN is required.');

let productionPool;
let isolatedDatabase;
let isolatedServer;
let isolatedAppPool;

try {
  const backups = await listAllBackups();
  assert.ok(backups.length > 0, 'No database backup was found.');
  const latest = backups[0];
  assert.ok(latest.size > 0 && latest.size <= 100 * 1024 * 1024, 'Latest backup has an invalid size.');

  const downloaded = await get(latest.pathname, { access: 'private', useCache: false });
  assert.ok(downloaded && downloaded.statusCode === 200 && downloaded.stream, 'Latest backup could not be read.');
  const raw = await new Response(downloaded.stream).text();
  assert.equal(Buffer.byteLength(raw), latest.size, 'Downloaded backup size does not match list metadata.');
  const backup = JSON.parse(raw);
  assert.equal(backup.driver, 'postgres', 'Latest backup is not a PostgreSQL export.');
  assert.ok(Number.isFinite(Date.parse(backup.exportedAt)), 'Latest backup has no valid export timestamp.');
  assert.ok(backup.tables && typeof backup.tables === 'object' && !Array.isArray(backup.tables), 'Latest backup has no table map.');
  for (const table of requiredTables) assert.ok(Array.isArray(backup.tables[table]), `Required table is missing: ${table}`);
  for (const [table, rows] of Object.entries(backup.tables)) {
    assert.match(table, /^[a-zA-Z0-9_]+$/);
    assert.ok(Array.isArray(rows), `Backup table is not an array: ${table}`);
  }

  productionPool = new pg.Pool({ connectionString: productionDatabaseUrl, max: 1 });
  const productionTablesResult = await productionPool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name
  `);
  const productionTables = productionTablesResult.rows.map((row) => String(row.table_name));
  const backupTables = Object.keys(backup.tables).sort();
  assert.deepEqual(backupTables, productionTables, 'Backup table inventory does not match the current production schema.');
  await productionPool.end();
  productionPool = undefined;

  const port = await freePort();
  isolatedDatabase = await PGlite.create();
  isolatedServer = new PGLiteSocketServer({ db: isolatedDatabase, port, host: '127.0.0.1', maxConnections: 8 });
  await isolatedServer.start();

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_restore:astana_restore@127.0.0.1:${port}/astana_restore`;
  process.env.DATABASE_POOL_MAX = '1';
  for (const key of ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH', 'ADMIN_2FA_SECRET']) delete process.env[key];

  const appDatabase = await import('../src/server/db.ts');
  await appDatabase.listLeadSummaries();
  isolatedAppPool = appDatabase.getServerDatabasePool();
  const migrationClient = await isolatedAppPool.connect();
  try {
    await migrationClient.query('BEGIN');
    await appDatabase.migrateAdminAssistantSchemaOnce(migrationClient);
    await appDatabase.migrateAdminPracticalSchemaOnce(migrationClient);
    await migrationClient.query('COMMIT');
  } catch (error) {
    await migrationClient.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    migrationClient.release();
  }
  const facebookDatabase = await import('../src/server/facebook-messenger-db.ts');
  await facebookDatabase.ensureFacebookMessengerSchema();

  const targetTablesResult = await isolatedDatabase.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name
  `);
  const targetTables = targetTablesResult.rows.map((row) => String(row.table_name));
  const missingTargetTables = backupTables.filter((table) => !targetTables.includes(table));
  assert.deepEqual(missingTargetTables, [], `Restore target is missing tables: ${missingTargetTables.join(', ')}`);

  await isolatedDatabase.exec('BEGIN');
  try {
    await isolatedDatabase.exec('SET session_replication_role = replica');
    if (targetTables.length) {
      await isolatedDatabase.exec(`TRUNCATE TABLE ${targetTables.map(quoteIdentifier).join(', ')} RESTART IDENTITY CASCADE`);
    }
    for (const table of backupTables) {
      const columnsResult = await isolatedDatabase.query(
        `SELECT column_name, udt_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'
         ORDER BY ordinal_position`,
        [table],
      );
      const targetColumns = new Map(columnsResult.rows.map((row) => [String(row.column_name), String(row.udt_name)]));
      for (const row of backup.tables[table]) {
        const columns = Object.keys(row).filter((column) => targetColumns.has(column));
        assert.ok(columns.length > 0, `Restore row has no compatible columns: ${table}`);
        const values = columns.map((column) => normalizeValue(row[column], targetColumns.get(column)));
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        await isolatedDatabase.query(
          `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`,
          values,
        );
      }
    }
    await isolatedDatabase.exec('SET session_replication_role = origin');
    await isolatedDatabase.exec('COMMIT');
  } catch (error) {
    await isolatedDatabase.exec('ROLLBACK');
    throw error;
  }

  let restoredRows = 0;
  for (const table of backupTables) {
    const result = await isolatedDatabase.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(table)}`);
    const restored = Number(result.rows[0]?.count || 0);
    const expected = backup.tables[table].length;
    assert.equal(restored, expected, `Restored row count mismatch: ${table}`);
    restoredRows += restored;
  }

  const [leadCounts, applicationHealth] = await Promise.all([
    appDatabase.getLeadQueueCounts(new Date().toISOString().slice(0, 10)),
    appDatabase.getApplicationNotificationHealth(),
  ]);
  assert.ok(leadCounts && typeof leadCounts === 'object');
  assert.ok(applicationHealth && typeof applicationHealth === 'object');

  console.log(JSON.stringify({
    ok: true,
    backupPath: latest.pathname,
    exportedAt: new Date(backup.exportedAt).toISOString(),
    storedBackups: backups.length,
    tableCount: backupTables.length,
    restoredRows,
    schemaInventoryMatches: true,
    rowCountsMatch: true,
    applicationReadChecks: true,
  }));
} finally {
  try { await productionPool?.end(); } catch {}
  try { await isolatedAppPool?.end(); } catch {}
  try { await isolatedServer?.stop(); } catch {}
  try { await isolatedDatabase?.close(); } catch {}
}
