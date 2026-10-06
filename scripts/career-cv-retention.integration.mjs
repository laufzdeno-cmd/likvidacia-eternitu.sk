import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';

// tsx loads the TS route through the package's CommonJS entry in this test.
// Use the same SDK constructor so instanceof models the production callback.
const { BlobNotFoundError } = createRequire(import.meta.url)('@vercel/blob');

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

const port = await availablePort();
const memory = await PGlite.create();
const server = new PGLiteSocketServer({ db: memory, port, host: '127.0.0.1', maxConnections: 8 });
await server.start();
const connectionString = `postgres://career_cv_test:career_cv_test@127.0.0.1:${port}/career_cv_test`;
assert.match(connectionString, /^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\//);
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = connectionString;
process.env.VERCEL_PROJECT_ID = 'career-cv-isolated-test';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_isolated_test_only';
process.env.CAREER_CV_RETENTION_DELETE_ENABLED = '1';
process.env.CAREER_CV_PRIVATE_STORE_CONFIRMED = '1';
process.env.CAREER_CV_RETENTION_BINDING_SHA256 = createHash('sha256')
  .update(JSON.stringify([process.env.VERCEL_PROJECT_ID, connectionString, process.env.BLOB_READ_WRITE_TOKEN]), 'utf8').digest('hex');
process.env.CRON_SECRET = 'isolated-cron-secret';
const importedDb = await import('../src/server/db.ts');
const db = importedDb.default ?? importedDb;
const importedRoute = await import('../app/api/cron/career-cv-retention/route.ts');
const route = importedRoute.default ?? importedRoute;
const importedRetention = await import('../src/server/career-cv-retention.ts');
const retention = importedRetention.default ?? importedRetention;
const inspect = new pg.Pool({ connectionString, max: 2 });

async function applicationWithOldReservation(tag) {
  const submissionId = randomUUID().replaceAll('-', '');
  const application = (await db.createCareerApplication({
    submissionId, fullName: `Test ${tag}`, phone: '0905000000', email: `${tag}@example.invalid`, city: 'Poprad',
    cooperationType: 'szco', workRegions: 'Slovensko', hasTradeLicense: true, workAtHeights: true,
    hasAsbestosExperience: false, asbestosExperience: '', experience: '', note: '', privacyConsent: true,
    cvExpected: true,
  })).application;
  const pathname = `career-cv/${submissionId}/${randomUUID()}.pdf`;
  const sha256 = 'a'.repeat(64);
  await db.reserveCareerCvUpload({ submissionId, pathname, originalName: 'zivotopis.pdf', expectedSize: 4096, expectedSha256: sha256 });
  await inspect.query("UPDATE career_cv_uploads SET created_at=now() - interval '25 hours' WHERE pathname=$1", [pathname]);
  return { application, submissionId, pathname, sha256,
    cv: { originalName: 'zivotopis.pdf', storageDriver: 'vercel_blob', storageKey: pathname,
      mimeType: 'application/pdf', sizeBytes: 4096, sha256 } };
}

function privateBlobMock(pathname) {
  let present = true;
  const calls = [];
  return {
    calls,
    get present() { return present; },
    head: async (requested) => {
      assert.equal(requested, pathname);
      if (!present) throw new BlobNotFoundError();
      return { pathname, url: `https://isolated.private.blob.vercel-storage.com/${pathname}`, etag: 'etag-1' };
    },
    del: async (requested, options) => {
      assert.equal(requested, pathname);
      assert.equal(options?.ifMatch, 'etag-1');
      calls.push(requested);
      present = false;
    },
  };
}

async function captureExpectedRetentionFailure(operation, sensitivePathname) {
  const previous = console.error;
  const messages = [];
  console.error = (...parts) => { messages.push(parts.map(String).join(' ')); };
  try {
    const result = await operation();
    assert.ok(messages.length > 0, 'a failed retention run remains observable');
    assert.ok(messages.every((message) => !message.includes(sensitivePathname) && !message.includes('zivotopis.pdf')),
      'operational logs must not contain a private pathname or original file name');
    return result;
  } finally {
    console.error = previous;
  }
}

let failed = false;
try {
  const schedule = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(schedule.crons.find((item) => item.path === '/api/cron/career-cv-retention/')?.schedule, '10 5 * * *');
  assert.equal(retention.careerCvRetentionBound(), true);
  const unauthorized = await route.GET(new Request('http://localhost/api/cron/career-cv-retention'));
  assert.equal(unauthorized.status, 401);
  process.env.CAREER_CV_PRIVATE_STORE_CONFIRMED = '0';
  const disabled = await route.GET(new Request('http://localhost/api/cron/career-cv-retention', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  }));
  assert.equal(disabled.status, 503);
  process.env.CAREER_CV_PRIVATE_STORE_CONFIRMED = '1';

  const auditApplication = (await db.createCareerApplication({
    submissionId: randomUUID().replaceAll('-', ''), fullName: 'Test audit', phone: '0905000000',
    email: 'audit@example.invalid', city: 'Poprad', cooperationType: 'szco', workRegions: 'Slovensko',
    hasTradeLicense: true, workAtHeights: true, hasAsbestosExperience: false, asbestosExperience: '',
    experience: '', note: '', privacyConsent: true, cvExpected: false,
  })).application;
  await inspect.query(`UPDATE application_notification_outbox SET status='unknown'
    WHERE entity_type='career_application' AND entity_id=$1 AND recipient_role='applicant'`, [auditApplication.id]);
  assert.equal(await db.resolveUnknownApplicationNotification({
    entityType: 'career_application', entityId: auditApplication.id, recipient: 'applicant', resolution: 'delivered',
    evidence: 'Našiel som správu pre osoba@example.com, telefón 0905123456', actorEmail: 'qa-admin@example.invalid',
  }), false, 'free-text PII must be rejected at the database boundary');
  assert.equal(await db.resolveUnknownApplicationNotification({
    entityType: 'career_application', entityId: auditApplication.id, recipient: 'applicant', resolution: 'delivered',
    evidence: 'inbox_message_found', actorEmail: 'qa-admin@example.invalid',
  }), true);
  const notificationAudit = await inspect.query(`SELECT changes FROM audit_logs
    WHERE entity_type='career_application' AND entity_id=$1 AND action='application_notification_delivery_confirmed'`, [auditApplication.id]);
  assert.deepEqual(notificationAudit.rows[0].changes, {
    recipient: 'applicant', resolution: 'delivered', evidence: 'inbox_message_found',
  }, 'notification audit stores only the internal evidence code, never free text');

  const attached = await applicationWithOldReservation('attached');
  assert.ok(await db.attachCareerCvUpload(attached.submissionId, attached.pathname, attached.cv));
  assert.equal((await db.claimExpiredCareerCvUploads(25)).length, 0);

  const tooYoung = await applicationWithOldReservation('too-young');
  await inspect.query("UPDATE career_cv_uploads SET created_at=now() - interval '23 hours' WHERE pathname=$1", [tooYoung.pathname]);
  assert.equal((await db.claimExpiredCareerCvUploads(25)).length, 0, 'the 24-hour floor must hold');
  assert.ok(await db.attachCareerCvUpload(tooYoung.submissionId, tooYoung.pathname, tooYoung.cv));

  const legacyReferenced = await applicationWithOldReservation('legacy-reference');
  assert.ok(await db.attachCareerApplicationCv(legacyReferenced.application.id, legacyReferenced.cv));
  assert.equal((await db.claimExpiredCareerCvUploads(25)).length, 0,
    'a fresh application reference protects old manifest rows as well');

  const race = await applicationWithOldReservation('race');
  const [first, second] = await Promise.all([db.claimExpiredCareerCvUploads(25), db.claimExpiredCareerCvUploads(25)]);
  assert.equal(first.length + second.length, 1, 'two workers cannot claim the same private object');
  assert.equal((first[0] ?? second[0]).pathname, race.pathname);
  assert.equal(await db.attachCareerCvUpload(race.submissionId, race.pathname, race.cv), null,
    'atomic attach must not win after deletion_pending');
  await assert.rejects(db.attachCareerApplicationCv(race.application.id, race.cv),
    /bezpečne odstraňuje/, 'legacy attach must be blocked by the DB trigger too');
  const raceRow = await inspect.query('SELECT cv_storage_key FROM career_applications WHERE id=$1', [race.application.id]);
  assert.equal(raceRow.rows[0].cv_storage_key, '');
  assert.equal(await db.mayDeleteClaimedCareerCvUpload(race.pathname, (first[0] ?? second[0]).claimId), true);

  const interrupted = await applicationWithOldReservation('interrupted');
  const privateBlob = privateBlobMock(interrupted.pathname);
  await inspect.query(`CREATE OR REPLACE FUNCTION fail_cv_retention_audit()
    RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='career_cv_orphan_deleted' THEN RAISE EXCEPTION 'intentional cv audit failure'; END IF;
      RETURN NEW;
    END; $$`);
  await inspect.query(`CREATE TRIGGER fail_cv_retention_audit_before_insert
    BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_cv_retention_audit()`);
  const interruptedRun = await captureExpectedRetentionFailure(
    () => retention.runCareerCvRetention(privateBlob), interrupted.pathname);
  assert.equal(interruptedRun.failed, 1);
  assert.equal(privateBlob.calls.length, 1, 'the exact private pathname was deleted once');
  const interruptedRow = await inspect.query('SELECT status FROM career_cv_uploads WHERE pathname=$1', [interrupted.pathname]);
  assert.equal(interruptedRow.rows[0].status, 'deletion_pending', 'DB/audit rollback must preserve retry state');
  await inspect.query('DROP TRIGGER fail_cv_retention_audit_before_insert ON audit_logs');
  await inspect.query("UPDATE career_cv_uploads SET deletion_claimed_until=now() - interval '1 minute' WHERE pathname=$1", [interrupted.pathname]);
  const retry = await retention.runCareerCvRetention(privateBlob);
  assert.equal(retry.failed, 0);
  assert.equal(privateBlob.calls.length, 1, 'provider-confirmed absence must not issue a second delete');
  const completed = await inspect.query('SELECT status, original_name, expected_sha256 FROM career_cv_uploads WHERE pathname=$1', [interrupted.pathname]);
  assert.equal(completed.rows[0].status, 'deleted');
  assert.equal(completed.rows[0].original_name, '');
  assert.equal(completed.rows[0].expected_sha256, '0'.repeat(64));
  const audit = await inspect.query("SELECT changes FROM audit_logs WHERE entity_id=$1 AND action='career_cv_orphan_deleted'", [interrupted.application.id]);
  assert.deepEqual(Object.keys(audit.rows[0].changes), ['pathnameHash'], 'audit must not contain pathname or applicant PII');

  const publicObject = await applicationWithOldReservation('public-guard');
  let publicDeleteCalls = 0;
  const publicRun = await captureExpectedRetentionFailure(() => retention.runCareerCvRetention({
    head: async () => ({ pathname: publicObject.pathname,
      url: `https://isolated.public.blob.vercel-storage.com/${publicObject.pathname}`, etag: 'etag-public' }),
    del: async () => { publicDeleteCalls += 1; },
  }), publicObject.pathname);
  assert.equal(publicRun.failed, 1);
  assert.equal(publicDeleteCalls, 0, 'public Blob URL is never deleted');

  // Recreate the prior table shape/check in this disposable database, then
  // reload the DB module so ensureSchema runs its additive migration again.
  await inspect.query("UPDATE career_cv_uploads SET status='deleting' WHERE status='deletion_pending'");
  await inspect.query('DROP INDEX IF EXISTS career_cv_uploads_retention_due_idx');
  await inspect.query(`ALTER TABLE career_cv_uploads
    DROP COLUMN deletion_claim_id, DROP COLUMN deletion_claimed_until,
    DROP COLUMN deletion_attempts, DROP COLUMN deleted_at`);
  await inspect.query('ALTER TABLE career_cv_uploads DROP CONSTRAINT career_cv_uploads_status_check');
  await inspect.query(`ALTER TABLE career_cv_uploads ADD CONSTRAINT career_cv_uploads_status_check
    CHECK (status IN ('reserved', 'uploaded', 'attached', 'deleting', 'deletion_pending', 'deleted'))`);
  await inspect.query('DELETE FROM astana_schema_revisions');
  const migrationCode = `const mod=await import('./src/server/db.ts'); const db=mod.default??mod;
    if (!await db.getCareerCvUploadByPath(${JSON.stringify(race.submissionId)},${JSON.stringify(race.pathname)})) process.exit(2);
    process.exit(0);`;
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', migrationCode],
      { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk).slice(0, 2000); });
    child.once('error', reject);
      child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Migration child failed: ${stderr}`)));
  });
  const migratedLegacyClaim = await db.claimExpiredCareerCvUploads(25);
  assert.ok(migratedLegacyClaim.some((claim) => claim.pathname === race.pathname),
    'a pre-migration deleting reservation is safely reclaimed after migration');
  const migrationColumns = await inspect.query(`SELECT deletion_claim_id, deletion_claimed_until,
    deletion_attempts, deleted_at, status FROM career_cv_uploads WHERE pathname=$1`, [race.pathname]);
  assert.equal(migrationColumns.rows[0].status, 'deletion_pending');
  assert.ok(migrationColumns.rows[0].deletion_claim_id);
  assert.ok(migrationColumns.rows[0].deletion_claimed_until);
  assert.equal(migrationColumns.rows[0].deletion_attempts, 1);
  await inspect.query("UPDATE career_cv_uploads SET deletion_claimed_until=now() - interval '1 minute' WHERE pathname=$1", [race.pathname]);
  const migratedBlob = privateBlobMock(race.pathname);
  const migratedCleanup = await retention.runCareerCvRetention(migratedBlob);
  assert.equal(migratedCleanup.failed, 0);
  assert.equal(migratedCleanup.deleted, 1, 'the old deleting state reaches the verified private-Blob cleanup path');
  assert.equal(migratedBlob.calls.length, 1);
  assert.equal((await inspect.query('SELECT status FROM career_cv_uploads WHERE pathname=$1', [race.pathname])).rows[0].status, 'deleted');
  console.log('PASS: isolated PGlite career CV retention race, legacy deleting-state recovery, audit rollback/retry, private URL gate');
} catch (error) {
  failed = true;
  console.error('FAIL: isolated career CV retention integration', error);
} finally {
  await inspect.end().catch(() => undefined);
  setTimeout(() => process.exit(failed ? 1 : 0), 100);
}
