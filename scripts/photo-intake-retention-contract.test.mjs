import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const retentionRouteUrl = new URL('../app/api/cron/photo-intake-retention/route.ts', import.meta.url);
const confirmRouteUrl = new URL('../app/api/photo-intake/confirm/route.ts', import.meta.url);
const uploadRouteUrl = new URL('../app/api/photo-intake/upload/route.ts', import.meta.url);

test('photo retention reconciles an already absent private Blob before completing durable state', async () => {
  const source = await readFile(retentionRouteUrl, 'utf8');
  const helperStart = source.indexOf('async function deletePrivateBlobOrConfirmAbsent');
  const routeStart = source.indexOf('export async function GET');
  const helper = source.slice(helperStart, routeStart);

  assert.ok(helperStart >= 0 && routeStart > helperStart, 'the absence-reconciliation helper must exist before the route');
  assert.match(source, /import \{ BlobNotFoundError, del, head \} from '@vercel\/blob'/);
  assert.match(helper, /await del\(storageKey, \{ token \}\)/);
  assert.match(helper, /deleteError instanceof BlobNotFoundError/);
  assert.match(helper, /await head\(storageKey, \{ token \}\)/);
  assert.match(helper, /headError instanceof BlobNotFoundError/);
  assert.match(helper, /throw headError/);
  assert.match(helper, /throw deleteError/);
});

test('photo retention never reports success when a Blob delete is not committed in the database', async () => {
  const source = await readFile(retentionRouteUrl, 'utf8');

  assert.match(source, /if \(!await completePhotoIntakeSanitizationCleanup\(cleanup\.id\)\) \{[\s\S]*PHOTO_INTAKE_SANITIZATION_CLEANUP_COMPLETION_FAILED/);
  assert.match(source, /if \(!await completePhotoIntakeDeletion\(candidate\.id\)\) \{[\s\S]*PHOTO_INTAKE_RETENTION_COMPLETION_FAILED/);
  assert.ok(source.indexOf('await failPhotoIntakeSanitizationCleanup(cleanup.id)')
    > source.indexOf('completePhotoIntakeSanitizationCleanup(cleanup.id)'), 'an uncommitted cleanup must return to its durable retry state');
  assert.ok(source.indexOf('await markPhotoIntakeDeletionFailed(candidate.id)')
    > source.indexOf('completePhotoIntakeDeletion(candidate.id)'), 'an uncommitted media deletion must return to its durable retry state');
  assert.match(source, /const ok = failed === 0/);
  assert.match(source, /\{ status: ok \? 200 : 503 \}/);
});

test('photo intake routes keep private provider details out of responses and general logs', async () => {
  const [retention, confirm, upload] = await Promise.all([
    readFile(retentionRouteUrl, 'utf8'),
    readFile(confirmRouteUrl, 'utf8'),
    readFile(uploadRouteUrl, 'utf8'),
  ]);

  for (const [name, source] of [['retention', retention], ['confirm', confirm], ['upload', upload]]) {
    assert.doesNotMatch(source, /console\.(?:error|warn|log)\([^\n]*error\.message/, `${name} route must not log provider messages`);
    assert.doesNotMatch(source, /NextResponse\.json\(\{ error: error instanceof Error \? error\.message/, `${name} route must not return internal messages`);
  }
  assert.match(confirm, /error instanceof z\.ZodError/);
  assert.match(confirm, /Photo intake confirmation failed\.', error instanceof Error \? error\.name : 'unknown'/);
  assert.match(upload, /Photo intake upload request rejected\.', error instanceof Error \? error\.name : 'unknown'/);
});

test('retention and private upload authorization remain fail-closed', async () => {
  const [source, confirm, upload] = await Promise.all([
    readFile(retentionRouteUrl, 'utf8'),
    readFile(confirmRouteUrl, 'utf8'),
    readFile(uploadRouteUrl, 'utf8'),
  ]);
  const auth = source.indexOf('if (!secret || token !== secret)');
  const optIn = source.indexOf('if (!photoIntakeRetentionRequested())');
  const storage = source.indexOf('if (!privatePhotoIntakeStorageReady())');
  const cleanupClaim = source.indexOf('claimPhotoIntakeSanitizationCleanups(50)');
  const mediaClaim = source.indexOf('claimDuePhotoIntakeDeletions(50)');

  assert.ok(auth >= 0 && optIn > auth && storage > optIn && cleanupClaim > storage && mediaClaim > cleanupClaim,
    'authorization, opt-in and private-store binding must run before the existing claim order');
  assert.ok(confirm.indexOf("request.headers.get('origin') !== request.nextUrl.origin")
    < confirm.indexOf('currentPhotoUploadInvite()'), 'confirmation must reject a foreign origin before resolving an invite');
  assert.match(confirm, /if \(!invite\) return NextResponse\.json\([^\n]*status: 401/);
  assert.match(upload, /if \(request\.headers\.get\('origin'\) !== request\.nextUrl\.origin\)/);
  assert.match(upload, /onBeforeGenerateToken:[\s\S]*currentPhotoUploadInvite\(\)/);
});
