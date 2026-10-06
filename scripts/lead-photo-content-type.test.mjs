import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { leadPhotoContentType, leadPhotoExtension } = require('../src/lib/lead-photo-content-type.ts');

test('photo MIME and extension rules match before client upload and server admission', () => {
  assert.equal(leadPhotoContentType('strecha.jpg', 'image/jpeg'), 'image/jpeg');
  assert.equal(leadPhotoContentType('strecha.JPEG', 'application/octet-stream'), 'image/jpeg');
  assert.equal(leadPhotoContentType('strecha.heif', ''), '');
  assert.equal(leadPhotoContentType('strecha.heic', 'image/heif'), '');
  assert.equal(leadPhotoContentType('strecha.jpg', 'image/png'), '');
  assert.equal(leadPhotoContentType('strecha.jpg', 'text/html'), '');
  assert.equal(leadPhotoContentType('strecha.jpg.exe', 'image/jpeg'), '');
  assert.equal(leadPhotoContentType('strecha', 'image/jpeg'), '');
  assert.equal(leadPhotoExtension('strecha.HEIF'), '.heif');
});
