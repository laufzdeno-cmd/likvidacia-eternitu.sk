import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

let database;
let server;
let exitCode = 0;
try {
  const port = await availablePort();
  database = await PGlite.create();
  server = new PGLiteSocketServer({ db: database, port, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;

  const db = await import('../src/server/db.ts');
  await database.exec('DROP TABLE IF EXISTS site_content_versions');
  const firstMigration = await db.migrateAdminPracticalSchemaOnce(database);
  const repeatedMigration = await db.migrateAdminPracticalSchemaOnce(database);
  assert.equal(firstMigration.tablesAdded, 1);
  assert.equal(repeatedMigration.tablesAdded, 0);
  assert.ok((await database.query("SELECT to_regclass('public.site_content_versions') AS relation")).rows[0].relation);
  assert.equal((await database.query(
    'SELECT COUNT(*)::int AS count FROM astana_targeted_schema_revisions WHERE revision=$1',
    [db.adminPracticalSchemaRevision],
  )).rows[0].count, 1);
  const actorEmail = 'superadmin@example.invalid';
  const lead = await db.createLead({
    fullName: 'Overovací klient', phone: '+421 905 123 456', email: 'klient@example.invalid',
    city: 'Poprad', district: 'Poprad', objectType: 'Rodinný dom', materialType: 'Vlnitý eternit',
    areaEstimate: 120, preferredContact: 'Email', gdpr: true, source: 'integration-test',
  });
  const job = await db.createBusinessJobFromLead(lead);
  const directory = await db.listCustomerDirectory();
  assert.equal(directory.total, 1);
  assert.equal(directory.items[0].inquiries[0].id, lead.id);
  assert.equal(directory.items[0].jobs[0].id, job.id);

  await db.upsertSiteContentValues({ heroTitle: 'Prvá verzia', heroText: 'Pôvodný text' }, actorEmail);
  const first = (await db.listSiteContentVersions(10))[0];
  await db.upsertSiteContentValues({ heroTitle: 'Druhá verzia', heroText: 'Nový text' }, actorEmail);
  const current = Object.fromEntries((await db.listSiteContent()).map((item) => [item.key, item.value]));
  const restored = await db.restoreSiteContentVersion({
    versionId: first.id,
    expectedCurrentHash: db.siteContentSnapshotHash(current),
    actorEmail,
  });
  assert.equal(restored?.action, 'restored');
  assert.equal(Object.fromEntries((await db.listSiteContent()).map((item) => [item.key, item.value])).heroTitle, 'Prvá verzia');

  const media = await db.listMediaLibraryRecords();
  assert.deepEqual(media.records, []);
  assert.equal(media.total, 0);
  console.log('PASS: PostgreSQL adresár, história obsahu a bezpečný dotaz knižnice médií.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try {
    await server?.stop();
    await database?.close();
  } catch (error) {
    console.error('Cleanup failed:', error);
    exitCode = 1;
  }
}
process.exit(exitCode);
