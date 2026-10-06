import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(file, 'utf8');

test('public upload clients load the Blob SDK only after a file upload is required', () => {
  const homepage = read('app/homepage-critical-client.tsx');
  const career = read('app/career-form-client.tsx');

  for (const source of [homepage, career]) {
    assert.doesNotMatch(source, /^import \{ upload \} from '@vercel\/blob\/client';/m);
    assert.match(source, /const \{ upload \} = await import\('@vercel\/blob\/client'\);/);
  }
  assert.ok(
    homepage.indexOf("await import('@vercel/blob/client')") > homepage.indexOf('if (!selectedFiles.length) return [];'),
    'homepage must not load the upload client when no photos were selected',
  );
  assert.ok(
    career.indexOf("await import('@vercel/blob/client')") > career.indexOf('if (!completed || completed.result?.uploadMissing)'),
    'career must not load the upload client until a direct CV upload is actually needed',
  );
});
