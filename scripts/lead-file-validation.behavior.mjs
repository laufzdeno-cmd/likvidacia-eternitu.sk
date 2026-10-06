import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { collectSubmittedLeadPhotos, detectLeadFileContentType, validateLeadFileHeader, validateLeadFileMetadata, validateLeadImageBytes, validateUploadedLeadFile } = require('../src/server/file-validation.ts');

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('rejects an image extension paired with an unsafe or conflicting declared MIME type', () => {
  assert.match(validateLeadFileMetadata({ name: 'strecha.jpg', size: 4, type: 'text/html' }) || '', /Povolené sú iba/);
  assert.match(validateLeadFileMetadata({ name: 'strecha.jpg', size: 4, type: 'image/png' }) || '', /Povolené sú iba/);
});

test('allows an absent browser MIME type only when the image header matches its extension', () => {
  const file = { name: 'strecha.jpg', size: 4, type: 'application/octet-stream' };
  assert.equal(validateLeadFileMetadata(file), null);
  assert.equal(validateLeadFileHeader(file, jpeg), null);
  assert.ok(validateLeadFileHeader(file, png));
});

test('admin-serving MIME is derived from image bytes rather than stored upload metadata', () => {
  assert.equal(detectLeadFileContentType(jpeg), 'image/jpeg');
  assert.equal(detectLeadFileContentType(png), 'image/png');
  assert.equal(detectLeadFileContentType(new TextEncoder().encode('<script>alert(1)</script>')), null);
});

test('optional empty browser file placeholder is ignored but a named empty attachment is rejected', () => {
  const placeholder = new File([], '', { type: 'application/octet-stream' });
  const emptyPhoto = new File([], 'strecha.png', { type: 'image/png' });
  assert.deepEqual(collectSubmittedLeadPhotos([placeholder]), { files: [], error: null });
  const selected = collectSubmittedLeadPhotos([placeholder, emptyPhoto]);
  assert.equal(selected.error, null);
  assert.deepEqual(selected.files, [emptyPhoto]);
  assert.equal(validateLeadFileMetadata(selected.files[0]), 'Nahraný súbor je prázdny.');
  assert.match(collectSubmittedLeadPhotos(['not-a-file']).error || '', /Fotky sa nepodarilo spracovať/);
});

test('lead image validation decodes real photos and rejects damaged or oversized pixel data', async () => {
  const valid = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#e0e0e0' } }).png().toBuffer();
  const details = (bytes) => ({ name: 'strecha.png', type: 'image/png', size: bytes.length });
  assert.equal(await validateLeadImageBytes(details(valid), valid), null);
  assert.equal(await validateUploadedLeadFile(new File([valid], 'strecha.png', { type: 'image/png' })), null);

  const corrupt = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.match(await validateLeadImageBytes(details(corrupt), corrupt), /nepodarilo prečítať|poškodená/);
  assert.match(await validateUploadedLeadFile(new File([corrupt], 'strecha.png', { type: 'image/png' })), /nepodarilo prečítať|poškodená/);
  const truncated = valid.subarray(0, valid.length - 12);
  assert.match(await validateLeadImageBytes(details(truncated), truncated), /poškodená|nedá otvoriť/);
  const jpegBytes = await sharp(valid).jpeg().toBuffer();
  assert.equal(await validateLeadImageBytes({ name: 'strecha.jpg', type: 'image/jpeg', size: jpegBytes.length }, jpegBytes), null);
  const truncatedJpeg = jpegBytes.subarray(0, jpegBytes.length - 2);
  assert.match(await validateLeadImageBytes({ name: 'strecha.jpg', type: 'image/jpeg', size: truncatedJpeg.length }, truncatedJpeg), /poškodená|nedá otvoriť/);
  const webpBytes = await sharp(valid).webp().toBuffer();
  assert.equal(await validateLeadImageBytes({ name: 'strecha.webp', type: 'image/webp', size: webpBytes.length }, webpBytes), null);
  const truncatedWebp = webpBytes.subarray(0, webpBytes.length - 2);
  assert.match(await validateLeadImageBytes({ name: 'strecha.webp', type: 'image/webp', size: truncatedWebp.length }, truncatedWebp), /poškodená|nedá otvoriť/);

  // HEIC is excluded until a decoder can validate and sanitize actual pixels.
  const heicHeader = Buffer.from([0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  assert.match(await validateLeadImageBytes({ name: 'strecha.heic', type: 'image/heic', size: heicHeader.length }, heicHeader), /iba JPG, JPEG, PNG alebo WEBP/);

  const huge = await sharp({ create: { width: 8_000, height: 6_500, channels: 3, background: '#e0e0e0' } }).png().toBuffer();
  assert.ok(huge.length < 10 * 1024 * 1024);
  assert.match(await validateLeadImageBytes(details(huge), huge), /viac ako 50 megapixelov/);
});
