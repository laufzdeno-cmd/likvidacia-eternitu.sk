import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(file, 'utf8');

test('public upload clients load the Blob SDK only after a file upload is required', () => {
  const homepage = read('app/homepage-critical-client.tsx');
  const career = read('app/career-form-client.tsx');
  const uploadErrors = read('src/lib/lead-upload-error.ts');
  const uploadDeadline = read('src/lib/lead-photo-upload-deadline.ts');

  for (const source of [homepage, career]) {
    assert.doesNotMatch(source, /^import \{ upload \} from '@vercel\/blob\/client';/m);
  }
  assert.match(homepage, /const \{ uploadLeadPhoto \} = await import\('@\/src\/lib\/lead-photo-browser-upload'\);/);
  assert.match(career, /const \{ upload \} = await import\('@vercel\/blob\/client'\);/);
  assert.ok(
    homepage.indexOf("await import('@/src/lib/lead-photo-browser-upload')") > homepage.indexOf('if (!selectedFiles.length) return [];'),
    'homepage must not load the upload client when no photos were selected',
  );
  const leadUploadModule = readFileSync('src/lib/lead-photo-browser-upload.ts', 'utf8');
  assert.match(leadUploadModule, /import \{ upload \} from '@vercel\/blob\/client'/);
  assert.match(leadUploadModule, /export const uploadLeadPhoto = upload/);
  assert.match(homepage, /withLeadPhotoUploadDeadline\(upload, \(\) => controller\.abort\(\), 120_000\)/);
  assert.match(uploadDeadline, /reject\(new LeadPhotoUploadDeadlineError\(\)\)/,
    'a browser or SDK upload that ignores AbortSignal must still release the form');
  assert.ok(
    career.indexOf("await import('@vercel/blob/client')") > career.indexOf('if (!completed || completed.result?.uploadMissing)'),
    'career must not load the upload client until a direct CV upload is actually needed',
  );
  assert.doesNotMatch(uploadErrors, /from '@vercel\/blob'/,
    'formatting a safe upload error must not pull the Blob SDK into the public client graph');
  assert.match(uploadErrors, /error\.constructor\.name/);
});
