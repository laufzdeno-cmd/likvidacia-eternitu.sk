import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createHash } from 'node:crypto';
const configModule = await import('../src/server/photo-intake-config.ts');
const policyModule = await import('../src/server/photo-intake-policy.ts');
const mediaAccessModule = await import('../src/server/photo-intake-media-access.ts');
const { photoIntakeRetentionRequested, privatePhotoIntakeEnabled, privatePhotoIntakeStorageReady } = configModule.default ?? configModule;
const { loadAuthorizedPhotoMedia } = mediaAccessModule.default ?? mediaAccessModule;
const {
  isPhotoCategory,
  isApproximateLocality,
  isPublishableRealizationLocality,
  maxIntakePhotoPixels,
  photoCategories,
  photoIntakeRetentionDays,
  allowedIntakePhotoTypes,
  safePhotoName,
  verifiedImageMime,
} = policyModule.default ?? policyModule;

test('only declared photo categories are accepted', () => {
  assert.deepEqual(photoCategories, ['family_house', 'outbuilding', 'garage', 'illegal_dump', 'interior']);
  for (const category of photoCategories) assert.equal(isPhotoCategory(category), true);
  assert.equal(isPhotoCategory('other'), false);
  assert.equal(maxIntakePhotoPixels, 25_000_000);
});

test('photo case-study locality accepts only approximate areas, not street addresses', () => {
  assert.equal(isApproximateLocality('Poprad'), true);
  assert.equal(isApproximateLocality('okres Kežmarok'), true);
  assert.equal(isApproximateLocality('Školská 12, Poprad'), false);
  assert.equal(isApproximateLocality('ul. Školská'), false);
  assert.equal(isApproximateLocality(''), false);
});

test('a sensitive published case may omit its public locality, but precision none never accepts a populated location', () => {
  assert.equal(isPublishableRealizationLocality('', 'none'), true);
  assert.equal(isPublishableRealizationLocality('   ', 'none'), true);
  assert.equal(isPublishableRealizationLocality('Poprad', 'none'), false);
  assert.equal(isPublishableRealizationLocality('', 'municipality'), false);
  assert.equal(isPublishableRealizationLocality('Poprad', 'municipality'), true);
  assert.equal(isPublishableRealizationLocality('okres Kežmarok', 'district'), true);
  assert.equal(isPublishableRealizationLocality('Školská 12, Poprad', 'municipality'), false);
});

test('temporary intake has explicit, bounded status retention windows and daily retry', () => {
  assert.deepEqual(photoIntakeRetentionDays, {
    pendingUpload: 1,
    pendingReview: 30,
    approvedPrivate: 180,
    rejected: 7,
    deletionRetry: 1,
  });
});

test('photo intake requires a dedicated store token and an exact project/database/store binding', () => {
  const keys = ['BLOB_READ_WRITE_TOKEN', 'PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN', 'PHOTO_INTAKE_PRIVATE_STORE_VERIFIED',
    'PHOTO_INTAKE_RETENTION_BINDING_SHA256', 'PHOTO_INTAKE_ENABLED', 'PHOTO_INTAKE_RETENTION_ENABLED', 'PHOTO_UPLOAD_SESSION_SECRET', 'VERCEL_PROJECT_ID', 'DATABASE_URL'];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.BLOB_READ_WRITE_TOKEN = 'shared-existing-token';
    process.env.PHOTO_INTAKE_PRIVATE_STORE_VERIFIED = 'true';
    process.env.PHOTO_INTAKE_ENABLED = 'true';
    process.env.PHOTO_INTAKE_RETENTION_ENABLED = 'true';
    process.env.PHOTO_UPLOAD_SESSION_SECRET = 'x'.repeat(32);
    assert.equal(privatePhotoIntakeStorageReady(), false, 'existing shared upload token must never enable crew photo storage');
    assert.equal(privatePhotoIntakeEnabled(), false);

    process.env.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN = 'dedicated-private-token';
    process.env.VERCEL_PROJECT_ID = 'prj_photo_intake_test';
    process.env.DATABASE_URL = 'postgres://photo-intake-test';
    const binding = createHash('sha256').update(JSON.stringify([
      process.env.VERCEL_PROJECT_ID, process.env.DATABASE_URL, process.env.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN,
    ])).digest('hex');
    process.env.PHOTO_INTAKE_RETENTION_BINDING_SHA256 = binding;
    assert.equal(privatePhotoIntakeStorageReady(), true);
    assert.equal(privatePhotoIntakeEnabled(), true);
    delete process.env.PHOTO_INTAKE_RETENTION_ENABLED;
    assert.equal(privatePhotoIntakeEnabled(), false, 'new intake must stay disabled unless cleanup is explicitly enabled too');
    process.env.PHOTO_INTAKE_RETENTION_ENABLED = 'true';
    process.env.VERCEL_PROJECT_ID = 'prj_different_project';
    assert.equal(privatePhotoIntakeStorageReady(), false, 'a different deployment binding must stop read/write/delete');
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('sample environment documents the complete fail-closed private photo intake contract', async () => {
  const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(envExample, /^PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN=$/m);
  assert.match(envExample, /^PHOTO_INTAKE_PRIVATE_STORE_VERIFIED=$/m);
  assert.match(envExample, /^PHOTO_INTAKE_RETENTION_BINDING_SHA256=$/m);
  assert.match(envExample, /^PHOTO_INTAKE_RETENTION_ENABLED=$/m);
  assert.match(envExample, /^PHOTO_INTAKE_ENABLED=$/m);
  assert.match(envExample, /^PHOTO_UPLOAD_SESSION_SECRET=$/m);
  assert.match(envExample, /Nový foto-intake sa zapne iba vtedy, keď sú obe nasledujúce hodnoty presne true/);
});

test('photo retention is an explicit opt-in and a prerequisite for new uploads', () => {
  const previous = {
    PHOTO_INTAKE_RETENTION_ENABLED: process.env.PHOTO_INTAKE_RETENTION_ENABLED,
    PHOTO_INTAKE_ENABLED: process.env.PHOTO_INTAKE_ENABLED,
  };
  try {
    delete process.env.PHOTO_INTAKE_RETENTION_ENABLED;
    process.env.PHOTO_INTAKE_ENABLED = 'true';
    assert.equal(photoIntakeRetentionRequested(), false, 'missing retention flag must never authorize cron deletion');
    for (const value of ['false', 'True', ' true ', '1', '']) {
      process.env.PHOTO_INTAKE_RETENTION_ENABLED = value;
      assert.equal(photoIntakeRetentionRequested(), false, `malformed or non-exact opt-in ${JSON.stringify(value)} must stay disabled`);
    }
    process.env.PHOTO_INTAKE_RETENTION_ENABLED = 'true';
    process.env.PHOTO_INTAKE_ENABLED = 'false';
    assert.equal(photoIntakeRetentionRequested(), true, 'retention may be enabled independently to clean existing records');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('super-admin photo review remains available when new intake is disabled, without widening worker access', async () => {
  const superAdmin = { active: true, role: 'SUPER_ADMIN' };
  const admin = { active: true, role: 'ADMIN' };
  const record = { id: 'photo-1', inviteId: 'invite-a', status: 'approved_private', storageKey: 'private/photo-1', mimeType: 'image/jpeg' };
  let recordLookups = 0;
  let blobReads = 0;
  const lookup = async () => { recordLookups += 1; return record; };
  const read = async () => { blobReads += 1; return Buffer.from('private-image'); };
  const request = (overrides = {}) => loadAuthorizedPhotoMedia({
    admin: null, hasInvite: true, inviteId: 'invite-a', intakeEnabled: true, storageReady: true,
    photoId: record.id, lookupRecord: lookup, readPrivateBlob: read, ...overrides,
  });

  assert.deepEqual(await request({ admin: superAdmin, hasInvite: false, inviteId: null, intakeEnabled: false }),
    { status: 200, record, bytes: Buffer.from('private-image') });
  assert.equal(blobReads, 1, 'SUPER_ADMIN can inspect stored media while intake is disabled only with the verified store binding');

  recordLookups = 0; blobReads = 0;
  assert.deepEqual(await request({ admin: superAdmin, hasInvite: false, inviteId: null, intakeEnabled: false, storageReady: false }), { status: 503 });
  assert.deepEqual(await request({ admin: null, hasInvite: false, inviteId: null }), { status: 401 });
  assert.deepEqual(await request({ admin, hasInvite: false, inviteId: null }), { status: 403 });
  assert.deepEqual(await request({ admin: null, intakeEnabled: false }), { status: 503 });
  assert.equal(recordLookups, 0, 'preflight denials must not query the media record');
  assert.equal(blobReads, 0, 'preflight denials must not read private storage');

  assert.deepEqual(await request({ inviteId: 'invite-b' }), { status: 401 });
  assert.deepEqual(await request({ admin, inviteId: 'invite-b' }), { status: 403 });
  assert.equal(blobReads, 0, 'cross-invite media must not be read');

  for (const status of ['pending_upload', 'deletion_pending']) {
    assert.deepEqual(await loadAuthorizedPhotoMedia({
      admin: superAdmin, hasInvite: false, inviteId: null, intakeEnabled: false, storageReady: true,
      photoId: record.id, lookupRecord: async () => ({ ...record, status }), readPrivateBlob: read,
    }), { status: 404 });
  }
  assert.equal(blobReads, 0, 'unconfirmed or deletion-pending media must not be read');

  assert.deepEqual(await request(), { status: 200, record, bytes: Buffer.from('private-image') });
  assert.equal(blobReads, 1, 'an enabled worker invite can read only its own media');

  const source = await readFile(new URL('../app/api/photo-intake/media/[id]/route.ts', import.meta.url), 'utf8');
  assert.match(source, /loadAuthorizedPhotoMedia\(/);
  assert.match(source, /readPrivateBlob: readPrivateIntakePhoto/);
});

test('photo retention locks media before checking draft links in a fresh SQL statement', async () => {
  const source = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  const start = source.indexOf('export async function claimDuePhotoIntakeDeletions');
  const end = source.indexOf('export async function markPhotoIntakeDeletionFailed', start);
  const implementation = source.slice(start, end);
  const lockQuery = implementation.indexOf('const due = await client.query(');
  const lockClause = implementation.indexOf('FOR UPDATE OF media SKIP LOCKED', lockQuery);
  const prefilterLinkCheck = implementation.indexOf('NOT EXISTS (', lockQuery);
  const claimUpdate = implementation.indexOf('UPDATE realization_media_intake AS media', lockClause);
  const linkedCaseCheck = implementation.indexOf('NOT EXISTS (', claimUpdate);

  assert.ok(start >= 0 && end > start, 'retention implementation must exist');
  assert.ok(lockQuery >= 0 && lockClause > lockQuery, 'the due rows must be locked before claim');
  assert.ok(prefilterLinkCheck > lockQuery && prefilterLinkCheck < lockClause,
    'existing draft links should be filtered before LIMIT so protected rows cannot starve later batches');
  assert.ok(claimUpdate > lockClause, 'the deletion claim must run in a later SQL statement with a fresh READ COMMITTED snapshot');
  assert.ok(linkedCaseCheck > claimUpdate, 'draft-media links must be checked after the media row is locked');
  assert.match(implementation.slice(claimUpdate), /realization_case_draft_media AS linked[\s\S]*linked\.media_id = media\.id/);
});

test('photo confirmation and moderation reject revoked invites and stale review versions', async () => {
  const source = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  const confirmStart = source.indexOf('export async function completePhotoIntakeRecord');
  const confirmEnd = source.indexOf('export async function listPhotoIntakeRecords', confirmStart);
  const confirm = source.slice(confirmStart, confirmEnd);
  const reviewStart = source.indexOf('export async function reviewPhotoIntakeRecord');
  const reviewEnd = source.indexOf('export async function updatePhotoIntakeMetadata', reviewStart);
  const review = source.slice(reviewStart, reviewEnd);
  const adminAction = await readFile(new URL('../app/admin/(protected)/realizacie/fotky/actions.ts', import.meta.url), 'utf8');
  const adminPage = await readFile(new URL('../app/admin/(protected)/realizacie/fotky/page.tsx', import.meta.url), 'utf8');

  assert.match(confirm, /SELECT id FROM photo_upload_invites[\s\S]*revoked_at IS NULL AND expires_at > now\(\)[\s\S]*FOR UPDATE/,
    'finálne potvrdenie musí po načítaní fotky znova uzamknúť a overiť pozvánku');
  assert.ok(confirm.indexOf('photo_upload_invites') < confirm.indexOf('realization_media_intake'),
    'potvrdenie zamyká pozvánku pred médiom v rovnakom poradí ako jej odvolanie');
  assert.match(confirm, /JOIN photo_intake_sanitization_attempts AS attempt ON attempt\.id = media\.sanitization_attempt_id/);
  assert.match(confirm, /attempt\.status = 'active'[\s\S]*FOR UPDATE OF media, attempt/);
  assert.match(confirm, /SET storage_key = \$1[\s\S]*sanitization_attempt_id = NULL/);
  assert.match(confirm, /SET status = 'committed'[\s\S]*WHERE id = \$1 AND status = 'active'/);
  assert.match(review, /metadata_version = \$4/);
  assert.match(review, /sanitized_at IS NOT NULL/);
  assert.match(adminAction, /expectedMetadataVersion/);
  assert.match(adminPage, /name="metadataVersion" value=\{photo\.metadataVersion\}/);
  assert.match(adminPage, /withdrawApprovedPhotoAction/);
  assert.match(adminAction, /withdrawApprovedPhotoIntakeRecord/);
  assert.match(adminAction, /await verifyCsrf\(formData\);[\s\S]*await requireSuperAdmin\(\)/);
});

test('unsafe path characters are removed from uploaded display names', () => {
  assert.equal(safePhotoName('../strecha\u0000.jpg'), '.._strecha_.jpg');
  assert.equal(safePhotoName('  '), 'fotografia');
});

test('actual image signatures, not browser MIME alone, determine supported type', () => {
  assert.deepEqual(allowedIntakePhotoTypes, ['image/jpeg', 'image/png', 'image/webp']);
  assert.equal(verifiedImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
  assert.equal(verifiedImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(verifiedImageMime(Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')])), 'image/webp');
  assert.equal(verifiedImageMime(Uint8Array.from(Buffer.from('not an image'))), null);
  assert.equal(verifiedImageMime(Uint8Array.from([0, 0, 0, 12, ...Buffer.from('ftypheic')])), null,
    'HEIC must be rejected until the runtime decoder can inspect and sanitize it');
});

test('crew invite labels are required and stay inside private intake surfaces', async () => {
  const [schema, actions, admin, privatePage, publicPage, publicGallery, mediaRoute, mediaAccess, cronRoute, vercelConfig, config, uploadRoute, client] = await Promise.all([
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/fotky/actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/fotky/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/spolupraca/fotky/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/realizacie/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/photo-intake/media/[id]/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/photo-intake-media-access.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/cron/photo-intake-retention/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/photo-intake-config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/photo-intake/upload/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/spolupraca/fotky/photo-intake-client.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(uploadRoute, /const extensions = new Set\(\['jpg', 'jpeg', 'png', 'webp'\]\)/);
  assert.match(client, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(client, /JPG, PNG, WebP alebo HEIC/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS worker_label text NOT NULL DEFAULT ''/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS content_hash text NOT NULL DEFAULT ''/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS sanitized_at timestamptz/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS photo_intake_sanitization_attempts/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS sanitization_attempt_id uuid/);
  assert.match(schema, /cleanup_status text NOT NULL DEFAULT 'pending'/);
  const inviteCreateBody = schema.slice(schema.indexOf('export async function createPhotoUploadInvite'), schema.indexOf('export async function consumePhotoUploadInviteByHash'));
  assert.match(inviteCreateBody, /photo_invite_created/);
  assert.match(inviteCreateBody, /JSON\.stringify\(\{ businessJobId, expiresAt: expiresAt\.toISOString\(\) \}\)/);
  assert.doesNotMatch(inviteCreateBody, /JSON\.stringify\(\{[^}]*workerLabel/);
  assert.match(actions, /workerLabel\.length < 2 \|\| workerLabel\.length > 100/);
  assert.match(actions, /if \(!privatePhotoIntakeStorageReady\(\)\) return/);
  assert.match(actions, /del\(record\.storageKey, \{ token: privatePhotoIntakeBlobToken\(\) \}\)/);
  assert.match(actions, /typeof workerLabelValue !== 'string'/);
  assert.match(actions, /createPhotoUploadInvite\(createHash[\s\S]{0,220}workerLabel, businessJobIdValue\)/);
  assert.match(admin, /invite\.workerLabel/);
  assert.match(privatePage, /invite\?\.workerLabel/);
  assert.match(privatePage, /listPhotoIntakeRecords\(\{ inviteId: invite\.id, page: requestedPageNumber, pageSize: 50 \}\)/);
  assert.match(privatePage, /Stránkovanie odovzdaných fotografií/);
  assert.match(privatePage, /História dočasne nie je dostupná/);
  assert.match(privatePage, /bezpečného uchovávania a odstraňovania fotografií/);
  assert.doesNotMatch(publicPage, /workerLabel|worker_label/);
  assert.doesNotMatch(publicGallery, /workerLabel|worker_label/);
  assert.match(schema, /status IN \('pending_upload', 'pending_review', 'approved_private', 'rejected', 'deletion_pending'\)/);
  assert.match(mediaAccess, /'pending_review', 'approved_private', 'rejected'/);
  assert.doesNotMatch(mediaAccess, /'deletion_pending'/);
  assert.match(cronRoute, /claimDuePhotoIntakeDeletions/);
  assert.match(cronRoute, /claimPhotoIntakeSanitizationCleanups/);
  assert.match(cronRoute, /completePhotoIntakeSanitizationCleanup/);
  assert.match(cronRoute, /markPhotoIntakeDeletionFailed/);
  assert.match(cronRoute, /completePhotoIntakeDeletion/);
  assert.match(cronRoute, /privatePhotoIntakeStorageReady/);
  assert.match(cronRoute, /photoIntakeRetentionRequested/);
  assert.ok(cronRoute.indexOf("if (!secret || token !== secret)") < cronRoute.indexOf('if (!photoIntakeRetentionRequested())'), 'unauthenticated cron requests must be denied before any enabled/disabled result');
  assert.ok(cronRoute.indexOf('if (!photoIntakeRetentionRequested())') < cronRoute.indexOf('claimPhotoIntakeSanitizationCleanups('), 'retention opt-in must be checked before any deletion candidates are claimed');
  assert.ok(cronRoute.indexOf('if (!privatePhotoIntakeStorageReady())') < cronRoute.indexOf('claimPhotoIntakeSanitizationCleanups('), 'private store binding must be checked before any deletion candidates are claimed');
  assert.match(cronRoute, /if \(!photoIntakeRetentionRequested\(\)\) return NextResponse\.json\(\{ ok: true, skipped: true/);
  assert.match(config, /PHOTO_INTAKE_PRIVATE_STORE_VERIFIED/);
  assert.match(config, /PHOTO_INTAKE_RETENTION_BINDING_SHA256/);
  assert.match(config, /PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN/);
  assert.doesNotMatch(config.split('export function privatePhotoIntakeStorageReady')[1].split('export function privatePhotoIntakeEnabled')[0], /BLOB_READ_WRITE_TOKEN/);
  assert.doesNotMatch(config.split('export function privatePhotoIntakeEnabled')[0], /PHOTO_INTAKE_ENABLED|PHOTO_UPLOAD_SESSION_SECRET/);
  assert.match(client, /upload\(pathname, draft\.file, \{[\s\S]{0,100}access: 'private'/);
  assert.match(uploadRoute, /currentPhotoUploadInvite\(\)/);
  assert.match(uploadRoute, /handleUpload\(\{\s*token: privatePhotoIntakeBlobToken\(\)/);
  assert.match(uploadRoute, /request\.headers\.get\('origin'\) !== request\.nextUrl\.origin/);
  assert.match(uploadRoute, /markPhotoIntakeUploadTokenIssued/);
  assert.doesNotMatch(uploadRoute, /await del\(blob\.pathname\)/, 'oneskorený upload callback nesmie mazať podľa zastaraného stavu');
  const confirmationRoute = await readFile(new URL('../app/api/photo-intake/confirm/route.ts', import.meta.url), 'utf8');
  const reservationIndex = confirmationRoute.indexOf('reservePhotoIntakeSanitizationAttempt(');
  const readIndex = confirmationRoute.indexOf('readPrivateIntakePhoto(');
  const writeIndex = confirmationRoute.indexOf('await put(attempt.targetStorageKey, sanitized');
  const finishIndex = confirmationRoute.indexOf('completePhotoIntakeRecord({');
  assert.ok(reservationIndex >= 0 && readIndex > reservationIndex && writeIndex > readIndex && finishIndex > writeIndex,
    'durable private attempt is created before Blob I/O and its unique key is committed only afterwards');
  assert.match(confirmationRoute, /finally \{\s*await abandonPhotoIntakeSanitizationAttempt\(attempt\.id\)/);
  assert.match(confirmationRoute, /maxDuration = 60/);
  assert.match(confirmationRoute, /prepareSanitizedPrivatePhoto\(bytes, Boolean\(attempt\.sanitizedAt && actualMime === 'image\/jpeg'\), async \(\) => undefined\)/);
  assert.match(confirmationRoute, /allowOverwrite: false/);
  assert.match(confirmationRoute, /token: privatePhotoIntakeBlobToken\(\)/);
  assert.match(cronRoute, /deletePrivateBlobOrConfirmAbsent\(cleanup\.storageKey, blobToken\)/);
  assert.match(cronRoute, /BlobNotFoundError, del, head/);
  assert.match(confirmationRoute, /createHash\('sha256'\)\.update\(sanitized\)\.digest\('hex'\)/);
  assert.match(confirmationRoute, /contentHash:/);
  assert.match(confirmationRoute, /isApproximateLocality\(payload\.locality\)/);
  assert.match(schema, /jsonb_array_length\(categories\) > 0/);
  assert.doesNotMatch(publicGallery, /contentHash|content_hash/);
  assert.match(uploadRoute, /stale DB snapshot; retention first claims the row atomically/);
  assert.match(schema, /SET status = 'deletion_pending', deletion_reason = 'revoked_invite_cleanup'[\s\S]*upload_token_issued_at IS NULL OR media\.upload_token_issued_at <= now\(\) - interval '1 day'/);
  assert.match(actions, /completePhotoIntakeDeletion\(record\.id, actorEmail\)/);
  assert.match(schema, /ORDER BY m\.created_at DESC, m\.id DESC LIMIT \$\$\{values\.length \+ 1\} OFFSET \$\$\{values\.length \+ 2\}/);
  assert.match(admin, /Stránkovanie fotografií/);
  assert.match(admin, /Záznamy fotografií sa nepodarilo načítať/);
  assert.match(vercelConfig, /\/api\/cron\/photo-intake-retention[\s\S]{0,100}20 4 \* \* \*/);
});

test('photo-intake invite attempts use the shared database limiter and a pseudonymous trusted-address key', async () => {
  const route = await readFile(new URL('../app/api/photo-intake/session/route.ts', import.meta.url), 'utf8');
  assert.match(route, /consumeApiRateLimit/);
  assert.match(route, /createHmac\('sha256', secret\)/);
  assert.match(route, /photo-intake-session:v1:/);
  assert.match(route, /x-real-ip/);
  assert.match(route, /forwarded\?\.at\(-1\)/);
  assert.doesNotMatch(route, /new Map<string, \{ count: number; resetsAt: number \}>/);
});

test('crew can save changed locality and categories after upload instead of only editing local form state', async () => {
  const [client, privatePage, metadataRoute, adminPage, actions, styles, routeStyles, database, confirmationRoute, storage] = await Promise.all([
    readFile(new URL('../app/spolupraca/fotky/photo-intake-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/spolupraca/fotky/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/photo-intake/metadata/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/fotky/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/fotky/actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/spolupraca/fotky/photo-intake-route.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/photo-intake/confirm/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/photo-intake-storage.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(client, /Uložiť lokalitu a kategórie/);
  assert.match(client, /25 Mpx/);
  assert.match(client, /disabled=\{busy\}/);
  assert.match(client, /disabled=\{busy\} value=\{draft\.locality\}/);
  assert.match(client, /disabled=\{busy\} checked=\{draft\.categories\.includes\(category\)\}/);
  const uploaderFlow = client.split('async function sendDraft(draft: Draft) {')[1]?.split('async function logout() {')[0];
  assert.ok(uploaderFlow, 'uploader save flow must be present');
  assert.match(uploaderFlow, /if \(transferred && metadataVersion\) \{[\s\S]*?await saveMetadata\(metadataVersion\);[\s\S]*?return;/);
  assert.match(uploaderFlow, /fetch\('\/api\/photo-intake\/metadata\/'/);
  assert.match(uploaderFlow, /expectedMetadataVersion/);
  assert.match(uploaderFlow, /if \(metadataChanged\(\)\) await saveMetadata\(result\.metadataVersion\)/);
  assert.match(uploaderFlow, /draft\.categories\.some\(\(category\) => !confirmation\.categories\.includes\(category\)\)/,
    'category comparison must be independent of checkbox order');
  assert.doesNotMatch(uploaderFlow, /JSON\.stringify\(draft\.categories\) !== JSON\.stringify\(confirmation\.categories\)/);
  assert.match(uploaderFlow, /if \(transferred && metadataVersion\) \{\s*if \(metadataChanged\(\)\) await saveMetadata\(metadataVersion\);\s*else updateDraft/,
    'unchanged metadata must not create another version or audit event');
  assert.match(uploaderFlow, /confirmation = \{ locality: draft\.locality, categories: \[\.\.\.draft\.categories\] \};\s*updateDraft\(draft\.key, \{ metadataVersion, confirmation/,
    'successful metadata save must advance the local baseline');
  assert.match(uploaderFlow, /error\.status !== 404/);
  assert.doesNotMatch(uploaderFlow, /error\.status !== 400/);
  assert.match(storage, /if \(!result\) throw new PhotoIntakeSourceMissingError\(\)/);
  assert.match(confirmationRoute, /error instanceof PhotoIntakeSourceMissingError[\s\S]*status: 404/);
  assert.match(confirmationRoute, /Fotografiu sa nepodarilo potvrdiť\. Skúste to znova\.' \}, \{ status: 503 \}/);
  assert.doesNotMatch(confirmationRoute, /NextResponse\.json\(\{ error: error instanceof Error \? error\.message/);
  assert.match(privatePage, /Miesto a kategóriu môžeš doplniť aj neskôr/);
  assert.match(privatePage, /metadataVersion/);
  assert.match(client, /fetch\('\/api\/photo-intake\/metadata\/'/);
  assert.match(client, /data-client-ready=\{clientReady \? 'true' : 'false'\}/);
  assert.match(client, /photo\.status === 'pending_review'/);
  assert.match(metadataRoute, /request\.headers\.get\('origin'\) !== request\.nextUrl\.origin/);
  assert.match(metadataRoute, /currentPhotoUploadInvite\(\)/);
  assert.match(metadataRoute, /inviteId: invite\.id/);
  assert.match(database, /invite_id = \$5 AND status = 'pending_review'/);
  assert.match(database, /SELECT id FROM photo_upload_invites[\s\S]{0,140}revoked_at IS NULL AND expires_at > now\(\)[\s\S]{0,40}FOR UPDATE[\s\S]{0,200}UPDATE realization_media_intake/);
  assert.match(database, /metadata_version = metadata_version \+ 1/);
  assert.match(database, /expectedMetadataVersion/);
  assert.match(adminPage, /updatePhotoIntakeMetadataAction/);
  assert.match(adminPage, /name="locality" defaultValue=\{photo\.locality\}/);
  assert.match(adminPage, /name="categories" value=\{key\} defaultChecked=\{photo\.categories\.includes\(key\)\}/);
  assert.match(actions, /await verifyCsrf\(formData\);[\s\S]*await requireSuperAdmin\(\);[\s\S]*updatePhotoIntakeMetadata/);
  assert.match(styles, /\.photo-intake-metadata-form\s*\{\s*display:\s*grid;/);
  assert.match(routeStyles, /\.photo-intake-history-edit\s*\{\s*display:\s*grid;/);
});

test('crew can securely submit photos with unknown metadata, but internal approval requires locality and category', async () => {
  const [confirmRoute, metadataRoute, database, admin] = await Promise.all([
    readFile(new URL('../app/api/photo-intake/confirm/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/photo-intake/metadata/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/fotky/page.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(confirmRoute, /locality: z\.string\(\)\.trim\(\)\.max\(120\)\.default\(''\)/);
  assert.match(confirmRoute, /categories: z\.array\(z\.string\(\)\.max\(40\)\)\.max\(5\)\.default\(\[\]\)/);
  assert.doesNotMatch(confirmRoute, /if \(!payload\.categories\.length\)/);
  assert.match(confirmRoute, /if \(payload\.locality && !isApproximateLocality\(payload\.locality\)\)/);
  assert.match(metadataRoute, /categories: z\.array\(z\.string\(\)\.max\(40\)\)\.max\(5\)/);
  assert.match(database, /status IN \('pending_review', 'approved_private'\)[\s\S]*status <> 'approved_private' OR \([\s\S]{0,240}char_length\(regexp_replace\(\$1,[\s\S]{0,260}\$1 !~ '\^\[\[:space:\]\]\*\$'[\s\S]{0,260}jsonb_array_length\(\$2::jsonb\) > 0[\s\S]{0,160}\$2::jsonb <@ /);
  assert.match(database, /\$1 <> 'approved_private' OR \([\s\S]{0,300}locality !~ '\^\[\[:space:\]\]\*\$'[\s\S]{0,300}btrim\(locality\) !~ '\[0-9\]'[\s\S]{0,300}jsonb_array_length\(categories\) > 0[\s\S]{0,160}categories <@ /);
  assert.match(admin, /Pred interným schválením doplňte a overte približnú lokalitu a aspoň jeden typ objektu/);
  assert.match(admin, /disabled=\{!isApproximateLocality\(photo\.locality\) \|\| !photo\.categories\.length\}/);
  assert.match(admin, /Návrh technických lehôt – pred zapnutím ich musí potvrdiť majiteľ/);
  assert.match(admin, /Automatické odstránenie začne fungovať až po samostatnom zapnutí a overení retenčného jobu/);
  assert.match(admin, /Samotný konfiguračný príznak režim úložiska nedokazuje/);
  assert.match(admin, /Majiteľ musí osobitne potvrdiť retenčné lehoty/);
});

test('photo upload invite history is paginated so older still-active links remain revocable', async () => {
  const [database, adminPage] = await Promise.all([
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/fotky/page.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(database, /export async function listPhotoUploadInvites\(options: \{ page\?: number; pageSize\?: number \} = \{\}\)/);
  assert.match(database, /COUNT\(\*\)::int AS total FROM photo_upload_invites/);
  assert.match(database, /ORDER BY invite\.created_at DESC, invite\.id DESC LIMIT \$1 OFFSET \$2/);
  assert.match(adminPage, /listPhotoUploadInvites\(\{ page: invitePage, pageSize: 50 \}\)/);
  assert.match(adminPage, /Stránkovanie pozvánok pracovníkov/);
  assert.match(adminPage, /photoAdminPageHref\(photosResult\.data\.page - 1, invitePage\)/);
  assert.match(adminPage, /photoAdminPageHref\(photosResult\.data\.page \+ 1, invitePage\)/);
  assert.match(adminPage, /photoAdminPageHref\(page, invitesResult\.data\.page - 1\)/);
  assert.match(adminPage, /photoAdminPageHref\(page, invitesResult\.data\.page \+ 1\)/);
});

test('withdrawing an approved photo invalidates the public realization gallery cache', async () => {
  const actions = await readFile(new URL('../app/admin/(protected)/realizacie/fotky/actions.ts', import.meta.url), 'utf8');
  const withdrawal = actions.slice(actions.indexOf('export async function withdrawApprovedPhotoAction'));
  assert.match(withdrawal, /if \(!withdrawn\) redirect\('\/admin\/realizacie\/fotky\?review=stale'\);[\s\S]*revalidatePath\('\/realizacie'\);/);
});
