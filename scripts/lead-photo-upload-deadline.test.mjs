import assert from 'node:assert/strict';
import test from 'node:test';
import { withLeadPhotoUploadDeadline } from '../src/lib/lead-photo-upload-deadline.ts';

test('photo upload deadline rejects and aborts even when the upload promise never settles', async () => {
  let aborted = 0;
  const never = new Promise(() => {});
  await assert.rejects(
    withLeadPhotoUploadDeadline(never, () => { aborted += 1; }, 5),
    (error) => error instanceof Error && error.name === 'AbortError',
  );
  assert.equal(aborted, 1);
});

test('photo upload deadline preserves a successful result without aborting', async () => {
  let aborted = 0;
  const result = await withLeadPhotoUploadDeadline(Promise.resolve({ pathname: 'safe.jpg' }), () => { aborted += 1; }, 50);
  assert.deepEqual(result, { pathname: 'safe.jpg' });
  assert.equal(aborted, 0);
});

test('photo upload deadline preserves an early upload error without aborting', async () => {
  let aborted = 0;
  const original = new Error('upload failed');
  await assert.rejects(
    withLeadPhotoUploadDeadline(Promise.reject(original), () => { aborted += 1; }, 50),
    (error) => error === original,
  );
  assert.equal(aborted, 0);
});
