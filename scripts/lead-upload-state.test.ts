import assert from 'node:assert/strict';
import { DataType, newDb } from 'pg-mem';
import {
  assertAttachableLeadUploadDraft,
  assertLeadUploadCapacity,
  assertReusableLeadUploadDraft,
  maxLeadUploadDrafts,
} from '../src/server/lead-upload-policy';
import { leadUploadSchemaSql } from '../src/server/lead-upload-schema';
import { attachLeadUploadDraftsInTransaction, reserveLeadUploadDraftWithPool } from '../src/server/db';
import { uploadPrivateLeadPhoto } from '../src/client/lead-photo-upload';
import type { Pool, PoolClient, QueryResult } from 'pg';

async function main() {
assert.equal(maxLeadUploadDrafts, 10);
assert.doesNotThrow(() => assertLeadUploadCapacity(9));
assert.throws(() => assertLeadUploadCapacity(10), /najviac 10 fotiek/);
assert.throws(() => assertLeadUploadCapacity(-1), /nie je platný/);

for (const status of ['uploading', 'uploaded']) {
  assert.doesNotThrow(() => assertReusableLeadUploadDraft(
    { status, contentType: 'image/jpeg', sizeBytes: 1_024 },
    { contentType: 'image/jpeg', sizeBytes: 1_024 },
  ));
}
assert.throws(() => assertReusableLeadUploadDraft(
  { status: 'uploaded', contentType: 'image/jpeg', sizeBytes: 1_024 },
  { contentType: 'image/png', sizeBytes: 1_024 },
), /zmenila/);
assert.throws(() => assertReusableLeadUploadDraft(
  { status: 'attached', contentType: 'image/jpeg', sizeBytes: 1_024 },
  { contentType: 'image/jpeg', sizeBytes: 1_024 },
), /uzavretá/);

const attachment = {
  submissionId: '00000000-0000-4000-8000-000000000001',
  leadId: '00000000-0000-4000-8000-000000000002',
  contentType: 'image/jpeg',
  sizeBytes: 1_024,
};
assert.doesNotThrow(() => assertAttachableLeadUploadDraft({
  ...attachment,
  status: 'uploaded',
}, attachment));
assert.doesNotThrow(() => assertAttachableLeadUploadDraft({
  ...attachment,
  status: 'attached',
}, attachment));
assert.throws(() => assertAttachableLeadUploadDraft({
  ...attachment,
  status: 'attached',
  leadId: '00000000-0000-4000-8000-000000000003',
}, attachment), /inému dopytu/);
assert.throws(() => assertAttachableLeadUploadDraft({
  ...attachment,
  status: 'deleting',
}, attachment), /bezpečne priradiť/);

function fakeClient(results: Array<Partial<QueryResult<Record<string, unknown>>>>) {
  const statements: string[] = [];
  const client = {
    query: async (query: string) => {
      statements.push(query.replace(/\s+/g, ' ').trim());
      const next = results.shift();
      if (!next) throw new Error('Test nemá pripravený výsledok databázového dotazu.');
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [], ...next };
    },
  } as unknown as PoolClient;
  return { client, statements };
}

const storageKey = `${attachment.submissionId}/photo.jpg`;
const uploadedDraft = {
  storage_key: storageKey,
  submission_id: attachment.submissionId,
  content_type: attachment.contentType,
  size_bytes: attachment.sizeBytes,
  status: 'uploaded',
  lead_id: null,
};
const fileInput = [{
  originalName: 'strecha.jpg',
  storageKey,
  mimeType: attachment.contentType,
  sizeBytes: attachment.sizeBytes,
}];
const newAttach = fakeClient([
  { rowCount: 1 },
  { rows: [uploadedDraft], rowCount: 1 },
  { rowCount: 1 },
  { rowCount: 1 },
  { rowCount: 1 },
]);
const newlyAttached = await attachLeadUploadDraftsInTransaction(
  newAttach.client,
  attachment.leadId,
  attachment.submissionId,
  fileInput,
);
assert.equal(newlyAttached.length, 1);
assert.ok(newAttach.statements.some((sql) => sql.includes('pg_advisory_xact_lock')));
assert.ok(newAttach.statements.some((sql) => sql.includes("status = 'attached'")));
assert.ok(newAttach.statements.some((sql) => sql.includes("'files_uploaded'")));

const existingFile = {
  id: '00000000-0000-4000-8000-000000000004',
  lead_id: attachment.leadId,
  original_name: 'strecha.jpg',
  storage_driver: 'vercel_blob',
  storage_key: storageKey,
  mime_type: attachment.contentType,
  size_bytes: attachment.sizeBytes,
  created_at: new Date('2026-10-04T12:00:00Z'),
};
const retryAttach = fakeClient([
  { rowCount: 1 },
  { rows: [{ ...uploadedDraft, status: 'attached', lead_id: attachment.leadId }], rowCount: 1 },
  { rows: [existingFile], rowCount: 1 },
]);
const retryFiles = await attachLeadUploadDraftsInTransaction(
  retryAttach.client,
  attachment.leadId,
  attachment.submissionId,
  fileInput,
);
assert.equal(retryFiles.length, 1);
assert.equal(retryAttach.statements.filter((sql) => sql.includes("'files_uploaded'" )).length, 0);

const claimedForDeletion = fakeClient([
  { rowCount: 1 },
  { rows: [{ ...uploadedDraft, status: 'deleting' }], rowCount: 1 },
]);
await assert.rejects(() => attachLeadUploadDraftsInTransaction(
  claimedForDeletion.client,
  attachment.leadId,
  attachment.submissionId,
  fileInput,
), /bezpečne priradiť/);

class LockingUploadPool {
  private rows = new Map<string, {
    storage_key: string;
    submission_id: string;
    client_file_id: string;
    content_type: string;
    size_bytes: number;
    status: string;
  }>();

  private lockTail: Promise<void> = Promise.resolve();

  async connect() {
    let releaseLock: (() => void) | undefined;
    const query = async (sql: string, params: unknown[] = []) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      if (normalized === 'BEGIN') return { rows: [], rowCount: null };
      if (normalized.includes('pg_advisory_xact_lock')) {
        const previous = this.lockTail;
        this.lockTail = new Promise<void>((resolve) => { releaseLock = resolve; });
        await previous;
        return { rows: [{}], rowCount: 1 };
      }
      if (normalized.startsWith('SELECT storage_key, content_type, size_bytes, status')) {
        const row = [...this.rows.values()].find((item) => item.submission_id === params[0] && item.client_file_id === params[1]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (normalized.startsWith('UPDATE lead_upload_drafts SET updated_at')) {
        return { rows: [], rowCount: 1 };
      }
      if (normalized.startsWith('SELECT COUNT(*)::int AS count')) {
        const count = [...this.rows.values()].filter((item) => item.submission_id === params[0]
          && ['uploading', 'uploaded', 'attached'].includes(item.status)).length;
        // Force an async scheduling point so the test would overbook without the advisory lock.
        await new Promise((resolve) => setTimeout(resolve, 0));
        return { rows: [{ count }], rowCount: 1 };
      }
      if (normalized.startsWith('INSERT INTO lead_upload_drafts')) {
        const row = {
          storage_key: String(params[0]),
          submission_id: String(params[1]),
          client_file_id: String(params[2]),
          content_type: String(params[3]),
          size_bytes: Number(params[4]),
          status: 'uploading',
        };
        this.rows.set(`${row.submission_id}:${row.client_file_id}`, row);
        return { rows: [], rowCount: 1 };
      }
      if (normalized === 'COMMIT' || normalized === 'ROLLBACK') {
        releaseLock?.();
        releaseLock = undefined;
        return { rows: [], rowCount: null };
      }
      throw new Error(`Neočakávaný SQL dotaz v teste: ${normalized}`);
    };
    return { query, release: () => releaseLock?.() } as unknown as PoolClient;
  }

  count() {
    return this.rows.size;
  }
}

const reservationPool = new LockingUploadPool();
const reservationSubmissionId = '00000000-0000-4000-8000-000000000010';
const reservations = await Promise.allSettled(Array.from({ length: 11 }, (_, index) => reserveLeadUploadDraftWithPool(
  reservationPool as unknown as Pick<Pool, 'connect'>,
  {
    submissionId: reservationSubmissionId,
    clientFileId: `00000000-0000-4000-8000-${String(index + 20).padStart(12, '0')}`,
    extension: '.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 2_048,
  },
)));
assert.equal(reservations.filter((result) => result.status === 'fulfilled').length, 10);
assert.equal(reservations.filter((result) => result.status === 'rejected').length, 1);
assert.equal(reservationPool.count(), 10);
const firstReservation = reservations.find((result) => result.status === 'fulfilled');
assert.ok(firstReservation && firstReservation.status === 'fulfilled');
const retriedReservation = await reserveLeadUploadDraftWithPool(
  reservationPool as unknown as Pick<Pool, 'connect'>,
  {
    submissionId: reservationSubmissionId,
    clientFileId: '00000000-0000-4000-8000-000000000020',
    extension: '.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 2_048,
  },
);
assert.equal(retriedReservation.storageKey, firstReservation.value.storageKey);
assert.equal(reservationPool.count(), 10);

const memoryDb = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
memoryDb.public.registerFunction({ name: 'now', returns: DataType.timestamptz, implementation: () => new Date('2026-10-04T12:00:00Z'), impure: true });
memoryDb.public.none(`
  CREATE TABLE leads (id uuid PRIMARY KEY);
  CREATE TABLE lead_files (storage_key text NOT NULL);
  CREATE TABLE lead_upload_drafts (
    storage_key text PRIMARY KEY,
    submission_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'uploaded', 'attached', 'superseded')),
    lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    uploaded_at timestamptz,
    attached_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  INSERT INTO lead_upload_drafts (storage_key, submission_id, status)
  VALUES ('lead-drafts/old/file.jpg', '00000000-0000-4000-8000-000000000099', 'uploaded');
`);
const memoryAdapter = memoryDb.adapters.createPg();
const memoryPool = new memoryAdapter.Pool();
await memoryPool.query(leadUploadSchemaSql);
const migrated = await memoryPool.query(`
  SELECT storage_key, status, client_file_id, content_type, size_bytes, blob_etag
  FROM lead_upload_drafts WHERE storage_key = 'lead-drafts/old/file.jpg'
`);
assert.equal(migrated.rows[0]?.status, 'uploaded');
assert.equal(migrated.rows[0]?.client_file_id, null);
assert.ok(migrated.rows[0]?.content_type === '' || migrated.rows[0]?.content_type === null);
assert.ok(migrated.rows[0]?.size_bytes === 0 || migrated.rows[0]?.size_bytes === null);
await assert.rejects(() => memoryPool.query(`
  INSERT INTO lead_upload_drafts (storage_key, submission_id, client_file_id, content_type, size_bytes, status)
  VALUES ('lead-drafts/bad/file.jpg', '00000000-0000-4000-8000-000000000098',
    '00000000-0000-4000-8000-000000000097', 'image/jpeg', 1024, 'pending')
`));
await memoryPool.end();

let uploadedDespiteNetworkError = false;
let confirmCalls = 0;
const recoveredPathname = 'lead-drafts/00000000-0000-4000-8000-000000000010/recovered.jpg';
const fetchWithUnknownPut: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url === '/api/lead-upload/') {
    const body = JSON.parse(String(init?.body || '{}')) as { action?: string };
    if (body.action === 'prepare') {
      return Response.json({
        ok: true,
        uploaded: false,
        pathname: recoveredPathname,
        presignedUrl: 'https://blob.invalid/upload',
        uploadHeaders: { 'x-vercel-blob-access': 'private' },
      });
    }
    confirmCalls += 1;
    return Response.json({ ok: true, uploaded: uploadedDespiteNetworkError, pathname: recoveredPathname });
  }
  if (url === 'https://blob.invalid/upload' && init?.method === 'PUT') {
    uploadedDespiteNetworkError = true;
    throw new TypeError('Simulovaná strata odpovede po úspešnom PUT');
  }
  throw new Error(`Neočakávaný fetch v teste: ${url}`);
};
const recoveredUpload = await uploadPrivateLeadPhoto({
  file: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
  input: {
    submissionId: reservationSubmissionId,
    fileId: '00000000-0000-4000-8000-000000000096',
    extension: '.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 4,
  },
  fetchImpl: fetchWithUnknownPut,
  prepareTimeoutMs: 1_000,
  uploadTimeoutMs: 1_000,
});
assert.equal(recoveredUpload.pathname, recoveredPathname);
assert.equal(confirmCalls, 1);

console.log('lead-upload state: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
