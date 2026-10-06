import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { settleLeadPhotoUploadBatch } = require('../src/lib/lead-photo-upload-batch.ts');

test('a failed photo waits for delayed cancellation of other uploads before allowing retry', async () => {
  const originalError = new Error('first upload failed');
  let rejectOther;
  const otherUpload = new Promise((_, reject) => { rejectOther = reject; });
  let cancelCalled = 0;
  let batchFinished = false;
  const batch = settleLeadPhotoUploadBatch([Promise.reject(originalError), otherUpload], () => { cancelCalled += 1; })
    .catch((error) => {
      batchFinished = true;
      assert.equal(error, originalError);
    });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelCalled, 1);
  assert.equal(batchFinished, false, 'form must remain locked until the second upload settles');
  rejectOther(new Error('other upload aborted later'));
  await batch;
  assert.equal(batchFinished, true);
});

test('successful photo batch returns every upload without cancellation', async () => {
  let cancelled = false;
  assert.deepEqual(await settleLeadPhotoUploadBatch([Promise.resolve('first'), Promise.resolve('second')], () => { cancelled = true; }), ['first', 'second']);
  assert.equal(cancelled, false);
});
