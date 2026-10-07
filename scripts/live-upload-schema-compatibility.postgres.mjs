import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

const runToken = process.env.ASTANA_ISOLATED_PG_RUN_TOKEN;
const suppliedUrl = process.env.ASTANA_ISOLATED_PG_URL;
const rollbackRoot = process.env.ASTANA_LIVE_ROLLBACK_ROOT;
assert.match(runToken || '', /^[a-f0-9]{32}$/, 'Disposable PostgreSQL runner token required.');
assert.ok(suppliedUrl && rollbackRoot && path.isAbsolute(rollbackRoot), 'Runner URL and absolute rollback checkout required.');
const parsed = new URL(suppliedUrl);
const port = Number(parsed.port);
assert.ok(
  ['postgres:', 'postgresql:'].includes(parsed.protocol)
  && parsed.hostname === '127.0.0.1'
  && parsed.username === 'astana_test'
  && !parsed.password && !parsed.search && !parsed.hash
  && parsed.pathname === `/astana_isolated_${runToken}`
  && Number.isInteger(port) && port > 0 && port <= 65535,
  'Only the runner-owned loopback PostgreSQL database may be tested.',
);
const connectionString = `postgres://astana_test@127.0.0.1:${port}/astana_isolated_${runToken}`;
const inspectPool = new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 3000 });
const bootstrapAdminEmail = 'live-upload-compat@example.invalid';
const rollbackModule = pathToFileURL(path.join(rollbackRoot, 'src/server/db.ts')).href;

function worker(mode, action, extraEnv = {}) {
  assert.ok(mode === 'current' || mode === 'rollback');
  const child = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--worker', mode, action], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
      DATABASE_URL: connectionString,
      NODE_ENV: 'test',
      VERCEL_ENV: '',
      ADMIN_EMAIL: bootstrapAdminEmail,
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(child.status, 0, child.stderr?.slice(-3000) || child.error?.message || `${mode}/${action} worker failed.`);
  const resultLine = String(child.stdout || '').split(/\r?\n/u).findLast((line) => line.startsWith('RESULT '));
  return resultLine ? JSON.parse(resultLine.slice(7)) : undefined;
}

function leadInput(submissionId, hash) {
  return {
    submissionId,
    submissionHash: hash,
    fullName: 'Test kompatibility schémy',
    phone: '+421900000001',
    email: bootstrapAdminEmail,
    city: 'Poprad',
    district: 'Poprad',
    objectType: 'Rodinný dom',
    materialType: 'Vlnitý eternit',
    areaEstimate: 1,
    preferredContact: 'Emailom',
    term: 'Test',
    note: 'Izolovaný test, nekontaktovať.',
    gdpr: true,
    source: 'schema-compatibility-test',
  };
}

try {
  const marker = await inspectPool.query('SELECT run_token FROM astana_isolated_runner_guard WHERE run_token = $1', [runToken]);
  assert.equal(marker.rowCount, 1, 'The database must belong to this runner invocation.');

  if (process.argv.includes('--worker')) {
    const mode = process.argv.at(-2);
    const action = process.argv.at(-1);
    assert.ok(mode === 'current' || mode === 'rollback');
    const database = mode === 'rollback' ? await import(rollbackModule) : await import('../src/server/db.ts');

    if (action === 'bootstrap') {
      await database.listLeads();
    } else if (action === 'rollback-seed') {
      assert.equal(mode, 'rollback');
      const uploadingSubmissionId = randomUUID();
      const uploadingClientFileId = randomUUID();
      const uploading = await database.reserveLeadUploadDraft({
        submissionId: uploadingSubmissionId, clientFileId: uploadingClientFileId,
        extension: '.jpg', contentType: 'image/jpeg', sizeBytes: 1024,
      });
      const uploadedSubmissionId = randomUUID();
      const uploadedClientFileId = randomUUID();
      const uploaded = await database.reserveLeadUploadDraft({
        submissionId: uploadedSubmissionId, clientFileId: uploadedClientFileId,
        extension: '.jpg', contentType: 'image/jpeg', sizeBytes: 2048,
      });
      await database.confirmLeadUploadDraft({
        submissionId: uploadedSubmissionId, clientFileId: uploadedClientFileId,
        storageKey: uploaded.storageKey, contentType: 'image/jpeg', sizeBytes: 2048, blobEtag: 'legacy-uploaded-etag',
      });
      const attachedSubmissionId = randomUUID();
      const attachedClientFileId = randomUUID();
      const attached = await database.reserveLeadUploadDraft({
        submissionId: attachedSubmissionId, clientFileId: attachedClientFileId,
        extension: '.jpg', contentType: 'image/jpeg', sizeBytes: 4096,
      });
      await database.confirmLeadUploadDraft({
        submissionId: attachedSubmissionId, clientFileId: attachedClientFileId,
        storageKey: attached.storageKey, contentType: 'image/jpeg', sizeBytes: 4096, blobEtag: 'legacy-attached-etag',
      });
      const created = await database.createLeadSubmission(leadInput(attachedSubmissionId, 'rollback-seed'), [{
        originalName: 'legacy-attached.jpg', storageKey: attached.storageKey, mimeType: 'image/jpeg', sizeBytes: 4096,
      }]);
      console.log(`RESULT ${JSON.stringify({
        rows: [
          { storageKey: uploading.storageKey, status: 'uploading', submissionId: uploadingSubmissionId, clientFileId: uploadingClientFileId },
          { storageKey: uploaded.storageKey, status: 'uploaded', submissionId: uploadedSubmissionId, clientFileId: uploadedClientFileId },
          { storageKey: attached.storageKey, status: 'attached', submissionId: attachedSubmissionId, clientFileId: attachedClientFileId, leadId: created.lead.id },
        ],
      })}`);
    } else if (action === 'rollback-flow') {
      assert.equal(mode, 'rollback');
      const leadId = process.env.ASTANA_COMPAT_LEAD_ID;
      assert.match(leadId || '', /^[0-9a-f-]{36}$/u);
      const attachSubmissionId = randomUUID();
      const attachClientFileId = randomUUID();
      const attached = await database.reserveLeadUploadDraft({
        submissionId: attachSubmissionId, clientFileId: attachClientFileId,
        extension: '.jpg', contentType: 'image/jpeg', sizeBytes: 3072,
      });
      await database.confirmLeadUploadDraft({
        submissionId: attachSubmissionId, clientFileId: attachClientFileId,
        storageKey: attached.storageKey, contentType: 'image/jpeg', sizeBytes: 3072, blobEtag: 'rollback-etag',
      });
      await database.attachLeadUploadDrafts(leadId, attachSubmissionId, [{
        originalName: 'rollback.jpg', storageKey: attached.storageKey, mimeType: 'image/jpeg', sizeBytes: 3072,
      }]);
      const retentionSubmissionId = randomUUID();
      const retentionClientFileId = randomUUID();
      const retained = await database.reserveLeadUploadDraft({
        submissionId: retentionSubmissionId, clientFileId: retentionClientFileId,
        extension: '.jpg', contentType: 'image/jpeg', sizeBytes: 1536,
      });
      await database.confirmLeadUploadDraft({
        submissionId: retentionSubmissionId, clientFileId: retentionClientFileId,
        storageKey: retained.storageKey, contentType: 'image/jpeg', sizeBytes: 1536, blobEtag: 'rollback-retention-etag',
      });
      console.log(`RESULT ${JSON.stringify({ attachedKey: attached.storageKey, retentionKey: retained.storageKey })}`);
    } else if (action === 'rollback-attach-existing') {
      assert.equal(mode, 'rollback');
      const leadId = process.env.ASTANA_COMPAT_LEAD_ID;
      const submissionId = process.env.ASTANA_COMPAT_SUBMISSION_ID;
      const storageKey = process.env.ASTANA_COMPAT_STORAGE_KEY;
      assert.match(leadId || '', /^[0-9a-f-]{36}$/u);
      assert.match(submissionId || '', /^[0-9a-f-]{36}$/u);
      assert.ok(storageKey?.startsWith(`lead-drafts/${submissionId}/`));
      await database.attachLeadUploadDrafts(leadId, submissionId, [{
        originalName: 'candidate-before-rollback.jpg', storageKey, mimeType: 'image/jpeg', sizeBytes: 2560,
      }]);
      console.log(`RESULT ${JSON.stringify({ attachedKey: storageKey })}`);
    } else if (action === 'rollback-retention') {
      assert.equal(mode, 'rollback');
      const expectedKey = process.env.ASTANA_COMPAT_RETENTION_KEY;
      assert.ok(expectedKey?.startsWith('lead-drafts/'));
      const claim = (await database.claimExpiredLeadUploadDrafts(50)).find((row) => row.storageKey === expectedKey);
      assert.ok(claim, 'Exact rollback backend must claim its expired upload.');
      assert.equal(await database.completeLeadUploadDraftDeletion(expectedKey, claim.claimId), true);
      console.log(`RESULT ${JSON.stringify({ deletedKey: expectedKey })}`);
    } else {
      throw new Error(`Unknown worker action: ${action}`);
    }
  } else {
    worker('rollback', 'bootstrap');
    const beforeRevision = await inspectPool.query("SELECT to_regclass('astana_schema_revisions') AS relation");
    assert.equal(beforeRevision.rows[0].relation, null, 'The live backend must not create the candidate revision table.');
    const beforeColumns = await inspectPool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='lead_upload_drafts' ORDER BY column_name`,
    );
    const beforeNames = new Set(beforeColumns.rows.map((row) => row.column_name));
    assert.ok(beforeNames.has('client_file_id') && beforeNames.has('content_type') && beforeNames.has('size_bytes'));
    assert.ok(!beforeNames.has('storage_driver') && !beforeNames.has('file_fingerprint'));
    const seeded = worker('rollback', 'rollback-seed');
    assert.equal(seeded.rows.length, 3);

    worker('current', 'bootstrap');
    const revisions = await inspectPool.query('SELECT count(*)::int AS count FROM astana_schema_revisions');
    assert.equal(revisions.rows[0].count, 1);
    const columns = await inspectPool.query(
      `SELECT column_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name='lead_upload_drafts'
         AND column_name IN ('client_file_id','content_type','size_bytes','storage_driver','file_fingerprint')
       ORDER BY column_name`,
    );
    assert.deepEqual(columns.rows.filter((row) => ['client_file_id', 'content_type', 'size_bytes'].includes(row.column_name)).map((row) => [row.column_name, row.is_nullable]), [
      ['client_file_id', 'YES'], ['content_type', 'NO'], ['size_bytes', 'NO'],
    ]);
    assert.match(String(columns.rows.find((row) => row.column_name === 'content_type')?.column_default), /''::text/u);
    assert.match(String(columns.rows.find((row) => row.column_name === 'size_bytes')?.column_default), /^0$/u);
    assert.ok(columns.rows.some((row) => row.column_name === 'storage_driver'));
    assert.ok(columns.rows.some((row) => row.column_name === 'file_fingerprint'));
    const trigger = await inspectPool.query(
      `SELECT tgenabled FROM pg_trigger
       WHERE tgrelid='lead_files'::regclass AND tgname='lead_files_upload_retention_guard' AND NOT tgisinternal`,
    );
    assert.deepEqual(trigger.rows, [{ tgenabled: 'O' }]);
    const preserved = await inspectPool.query(
      `SELECT storage_key, status, content_type, size_bytes, client_file_id, lead_id
       FROM lead_upload_drafts WHERE storage_key = ANY($1::text[])`,
      [seeded.rows.map((row) => row.storageKey)],
    );
    assert.equal(preserved.rowCount, 3, 'All live uploading/uploaded/attached rows must survive the migration.');
    for (const fixture of seeded.rows) {
      const row = preserved.rows.find((item) => item.storage_key === fixture.storageKey);
      assert.equal(row?.status, fixture.status);
      assert.equal(row?.client_file_id, fixture.clientFileId);
      if (fixture.leadId) assert.equal(row?.lead_id, fixture.leadId);
    }

    process.env.DATABASE_URL = connectionString;
    process.env.NODE_ENV = 'test';
    process.env.VERCEL_ENV = '';
    process.env.ADMIN_EMAIL = bootstrapAdminEmail;
    const database = await import('../src/server/db.ts');
    const submissionId = randomUUID();
    const storageKey = `lead-drafts/${submissionId}/${randomUUID()}.jpg`;
    await database.reserveLeadUploadDraft(submissionId, storageKey, undefined, 'vercel_blob', 'a'.repeat(64), 'image/jpeg', 2048);
    await database.markLeadUploadDraftUploaded(submissionId, storageKey, {
      contentType: 'image/jpeg', sizeBytes: 2048, blobEtag: 'candidate-etag',
    });
    const created = await database.createLeadSubmission(leadInput(submissionId, 'candidate-forward-flow'), [{
      leadId: randomUUID(), originalName: 'candidate.jpg', storageDriver: 'vercel_blob',
      storageKey, mimeType: 'image/jpeg', sizeBytes: 2048,
    }]);
    assert.equal(created.files.length, 1);
    const candidateRow = await inspectPool.query(
      'SELECT status, lead_id, client_file_id, content_type, size_bytes FROM lead_upload_drafts WHERE storage_key=$1',
      [storageKey],
    );
    assert.deepEqual(candidateRow.rows[0], {
      status: 'attached',
      lead_id: created.lead.id,
      client_file_id: storageKey.match(/\/([0-9a-f-]{36})\.jpg$/iu)?.[1],
      content_type: 'image/jpeg',
      size_bytes: 2048,
    });

    const orphanSubmissionId = randomUUID();
    const orphanKey = `lead-drafts/${orphanSubmissionId}/${randomUUID()}.jpg`;
    await database.reserveLeadUploadDraft(orphanSubmissionId, orphanKey, undefined, 'vercel_blob', 'b'.repeat(64), 'image/jpeg', 1536);
    await database.markLeadUploadDraftUploaded(orphanSubmissionId, orphanKey, {
      contentType: 'image/jpeg', sizeBytes: 1536, blobEtag: 'candidate-orphan-etag',
    });
    await inspectPool.query("UPDATE lead_upload_drafts SET updated_at=now()-interval '25 hours' WHERE storage_key=$1", [orphanKey]);
    const claim = (await database.claimExpiredLeadUploadDrafts(50)).find((row) => row.storageKey === orphanKey);
    assert.ok(claim, 'Candidate retention must claim an expired migrated-schema row.');
    assert.ok(!(await database.claimExpiredLeadUploadDrafts(50)).some((row) => row.storageKey === storageKey));
    assert.equal(await database.completeLeadUploadDraftDeletion(orphanKey, claim.claimId), true);
    const retentionAudit = await inspectPool.query(
      `SELECT changes FROM audit_logs WHERE action='lead_upload_retention_deleted' AND entity_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [orphanSubmissionId],
    );
    assert.equal(retentionAudit.rowCount, 1);
    assert.match(String(retentionAudit.rows[0].changes.storageKeyHash), /^[a-f0-9]{64}$/u);
    assert.ok(!JSON.stringify(retentionAudit.rows[0].changes).includes(orphanKey), 'Retention audit must not expose the private key.');

    const preRollbackSubmissionId = randomUUID();
    const preRollbackKey = `lead-drafts/${preRollbackSubmissionId}/${randomUUID()}.jpg`;
    await database.reserveLeadUploadDraft(
      preRollbackSubmissionId, preRollbackKey, undefined, 'vercel_blob', 'c'.repeat(64), 'image/jpeg', 2560,
    );
    // The public alias can already point back to c98, while the signed Blob
    // callback still targets the immutable candidate deployment URL.
    worker('rollback', 'bootstrap');
    await database.markLeadUploadDraftUploaded(preRollbackSubmissionId, preRollbackKey, {
      contentType: 'image/jpeg', sizeBytes: 2560, blobEtag: 'candidate-after-rollback-etag',
    });
    worker('rollback', 'rollback-attach-existing', {
      ASTANA_COMPAT_LEAD_ID: created.lead.id,
      ASTANA_COMPAT_SUBMISSION_ID: preRollbackSubmissionId,
      ASTANA_COMPAT_STORAGE_KEY: preRollbackKey,
    });
    const preRollbackState = await inspectPool.query(
      `SELECT draft.status, draft.lead_id, draft.content_type, draft.size_bytes,
              (SELECT count(*)::int FROM lead_files WHERE storage_key=$1 AND lead_id=$2) AS files
       FROM lead_upload_drafts draft WHERE draft.storage_key=$1`,
      [preRollbackKey, created.lead.id],
    );
    assert.deepEqual(preRollbackState.rows[0], {
      status: 'attached', lead_id: created.lead.id, content_type: 'image/jpeg', size_bytes: 2560, files: 1,
    });

    const rollback = worker('rollback', 'rollback-flow', { ASTANA_COMPAT_LEAD_ID: created.lead.id });
    await inspectPool.query("UPDATE lead_upload_drafts SET updated_at=now()-interval '25 hours' WHERE storage_key=$1", [rollback.retentionKey]);
    worker('rollback', 'rollback-retention', { ASTANA_COMPAT_RETENTION_KEY: rollback.retentionKey });
    const rollbackState = await inspectPool.query(
      `SELECT
         (SELECT count(*)::int FROM lead_files WHERE storage_key=$1 AND lead_id=$2) AS attached_files,
         (SELECT count(*)::int FROM lead_upload_drafts WHERE storage_key=$1 AND status='attached' AND lead_id=$2) AS attached_drafts,
         (SELECT count(*)::int FROM lead_upload_drafts WHERE storage_key=$3 AND status='deleted') AS deleted_drafts`,
      [rollback.attachedKey, created.lead.id, rollback.retentionKey],
    );
    assert.deepEqual(rollbackState.rows[0], { attached_files: 1, attached_drafts: 1, deleted_drafts: 1 });
    assert.equal((await inspectPool.query('SELECT count(*)::int AS count FROM astana_schema_revisions')).rows[0].count, 1);

    console.log('PASS: exact c98 full schema -> candidate migration -> current flow -> actual c98 rollback flow.');
  }
} finally {
  await inspectPool.end();
}

if (process.argv.includes('--worker')) process.exit(0);
