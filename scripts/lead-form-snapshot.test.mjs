import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobContentTypeNotAllowedError,
  BlobFileTooLargeError,
  BlobServiceRateLimited,
} from '@vercel/blob';

const require = createRequire(import.meta.url);
const { createLeadFormSnapshot, fingerprintLeadPhoto, fingerprintLeadUploadGroup, removeLeadPhotoUploadIfCurrent } = require('../src/lib/lead-form-snapshot.ts');
const { addUniqueLeadPhotos, resetMissingLeadPhotoUpload } = require('../src/lib/lead-photo-selection.ts');
const { leadPhotoUploadErrorMessage } = require('../src/lib/lead-upload-error.ts');
const { createNativeLeadSubmissionId } = require('../src/server/native-lead-id.ts');

test('photo upload errors are actionable Slovak copy without leaking Blob SDK messages', () => {
  const cases = [
    [new BlobFileTooLargeError('server limit'), 'Vyberte menšiu fotku.'],
    [new BlobContentTypeNotAllowedError('type'), 'Vyberte JPG, JPEG, PNG alebo WEBP.'],
    [new BlobServiceRateLimited(60), 'Počkajte pár minút'],
    [new BlobClientTokenExpiredError(), 'Platnosť nahrávania vypršala.'],
    [new BlobAccessError(), 'momentálne nedostupné.'],
    [new Error('Vercel Blob: Failed to retrieve the client token'), 'Fotky sa nepodarilo nahrať.'],
  ];
  for (const [error, expected] of cases) {
    const message = leadPhotoUploadErrorMessage(error, 'strecha.jpg', false);
    assert.ok(message.includes(expected));
    assert.ok(message.includes('Údaje aj vybrané fotky zostali vo formulári.'));
    assert.doesNotMatch(message, /Vercel Blob|client token|server limit/);
  }
  const tokenFailure = leadPhotoUploadErrorMessage(new Error('Vercel Blob: Failed to retrieve the client token'), 'strecha.jpg', false);
  assert.match(tokenFailure, /Dopyt môžete odoslať bez fotiek po ich odstránení z formulára/);
  assert.doesNotMatch(tokenFailure, /Skúste to o chvíľu znova/);
  assert.match(leadPhotoUploadErrorMessage(new Error('network'), 'strecha.jpg', true), /^Nahrávanie súboru strecha\.jpg trvalo príliš dlho\./);
});

test('different photo bytes with identical visible metadata produce different submission snapshots', async () => {
  const first = new File([Uint8Array.from([1, 2, 3, 4])], 'strecha.jpg', { type: 'image/jpeg', lastModified: 123 });
  const replacement = new File([Uint8Array.from([4, 3, 2, 1])], 'strecha.jpg', { type: 'image/jpeg', lastModified: 123 });
  assert.equal(first.size, replacement.size);
  assert.equal(first.name, replacement.name);
  assert.equal(first.type, replacement.type);
  assert.equal(first.lastModified, replacement.lastModified);

  const firstForm = new FormData();
  firstForm.set('city', 'Poprad');
  const replacementForm = new FormData();
  replacementForm.set('city', 'Poprad');

  assert.notEqual(
    await createLeadFormSnapshot(firstForm, [first]),
    await createLeadFormSnapshot(replacementForm, [replacement]),
  );
  assert.notEqual(await fingerprintLeadPhoto(first), await fingerprintLeadPhoto(replacement));
});

test('unchanged photo retries keep a stable content fingerprint', async () => {
  const photo = new File([Uint8Array.from([8, 6, 7, 5, 3, 0, 9])], 'foto.webp', { type: 'image/webp' });
  assert.equal(await fingerprintLeadPhoto(photo), await fingerprintLeadPhoto(photo));
  const uploadGroup = await fingerprintLeadUploadGroup(photo);
  assert.match(uploadGroup, /^[0-9a-f]{64}$/);
  assert.equal(uploadGroup, await fingerprintLeadUploadGroup(photo));
  assert.notEqual(uploadGroup, await fingerprintLeadUploadGroup(new File([await photo.arrayBuffer()], 'iny-nazov.webp', { type: 'image/webp' })));
});

test('analytics consent changes do not change customer submission identity', async () => {
  const before = new FormData();
  before.set('city', 'Poprad');
  before.set('analyticsSessionId', '');
  before.set('leadAttribution', JSON.stringify({ utm_source: 'google' }));
  const after = new FormData();
  after.set('city', 'Poprad');
  after.set('analyticsSessionId', '3a979ee4-1372-4c1a-ae69-61ab2ce35e9e');
  after.set('leadAttribution', JSON.stringify({ utm_source: 'meta', fbclid: 'changed' }));
  assert.equal(await createLeadFormSnapshot(before, []), await createLeadFormSnapshot(after, []));
});

test('a stale failed upload cannot evict the retry upload currently cached for the same photo', async () => {
  const cache = new Map();
  const firstUpload = Promise.reject(new Error('first attempt failed'));
  const retryUpload = Promise.resolve({ pathname: 'retry/photo.jpg' });
  cache.set('photo-hash', { submissionId: 'A', promise: firstUpload });
  cache.set('photo-hash', { submissionId: 'B', promise: retryUpload });

  await assert.rejects(firstUpload, /first attempt failed/);
  removeLeadPhotoUploadIfCurrent(cache, 'photo-hash', firstUpload);
  assert.equal(cache.get('photo-hash')?.promise, retryUpload);
});

test('photo selection deduplicates the same file before upload and preserves distinct photos', async () => {
  const first = { name: 'roof.jpg', bytes: 'same-content' };
  const duplicate = { name: 'roof.jpg', bytes: 'same-content' };
  const second = { name: 'garage.jpg', bytes: 'different-content' };
  const fingerprint = async (file) => `${file.name}:${file.bytes}`;

  const result = await addUniqueLeadPhotos([first], [duplicate, second], fingerprint, 10);
  assert.deepEqual(result.files, [first, second]);
  assert.deepEqual(result.duplicateFiles, [duplicate]);
  assert.deepEqual(result.overflowFiles, []);
});

test('photo selection enforces the limit after ignoring duplicates', async () => {
  const files = Array.from({ length: 12 }, (_, index) => ({ name: `photo-${index}.jpg`, id: String(index) }));
  const result = await addUniqueLeadPhotos(files.slice(0, 9), [files[0], files[9], files[10]], async (file) => file.id, 10);

  assert.equal(result.files.length, 10);
  assert.deepEqual(result.duplicateFiles, [files[0]]);
  assert.deepEqual(result.overflowFiles, [files[10]]);
});

test('native POST retry IDs remain stable for identical payloads within six hours', () => {
  const now = Date.UTC(2026, 9, 1, 12);
  const secret = 'native-retry-test-secret';
  const id = createNativeLeadSubmissionId('payload-hash-a', secret, now);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(createNativeLeadSubmissionId('payload-hash-a', secret, now + 5 * 60 * 60_000), id);
  assert.notEqual(createNativeLeadSubmissionId('payload-hash-b', secret, now), id);
  assert.notEqual(createNativeLeadSubmissionId('payload-hash-a', 'other-secret', now), id);
  assert.notEqual(createNativeLeadSubmissionId('payload-hash-a', secret, now + 6 * 60 * 60_000), id);
  const beforeBoundary = createNativeLeadSubmissionId('payload-hash-a', secret, Date.UTC(2026, 9, 1, 17, 59, 59));
  const afterBoundaryPreviousWindow = createNativeLeadSubmissionId('payload-hash-a', secret, Date.UTC(2026, 9, 1, 18, 0, 1) - 6 * 60 * 60_000);
  assert.equal(afterBoundaryPreviousWindow, beforeBoundary);
  assert.throws(() => createNativeLeadSubmissionId('payload-hash-a', ''), /AUTH_SECRET is required/);
});

test('photo recovery reopens only the missing object and preserves its predecessor path and other reservations', () => {
  const first = { pathname: 'lead-drafts/id/first.jpg', promise: Promise.resolve('first'), replaces: undefined };
  const missing = { pathname: 'lead-drafts/id/missing.jpg', promise: Promise.resolve('missing'), replaces: undefined };
  const last = { pathname: 'lead-drafts/id/last.jpg', promise: Promise.resolve('last'), replaces: undefined };
  const uploads = new Map([['first', first], ['missing', missing], ['last', last]]);

  assert.equal(resetMissingLeadPhotoUpload(uploads, missing.pathname), true);
  assert.equal(missing.promise, undefined);
  assert.equal(missing.pathname, 'lead-drafts/id/missing.jpg');
  assert.equal(uploads.get('first'), first);
  assert.equal(uploads.get('last'), last);
  assert.equal(first.promise instanceof Promise, true);
  assert.equal(last.promise instanceof Promise, true);
  assert.equal(resetMissingLeadPhotoUpload(uploads, 'unknown'), false);
});
