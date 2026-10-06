import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';
import { maxIntakePhotoPixels } from '../src/server/photo-intake-limits.mjs';
const imageModule = await import('../src/server/photo-intake-image.ts');
const { normalizePrivatePhoto, prepareSanitizedPrivatePhoto } = imageModule.default ?? imageModule;

test('private photo decoder creates an EXIF-free JPEG preview', async () => {
  const original = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#c03b2b' } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: 'TEST' } } })
    .toBuffer();
  const normalized = await normalizePrivatePhoto(original);
  const metadata = await sharp(normalized).metadata();

  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 3);
  assert.equal(metadata.height, 2);
  assert.equal(metadata.exif, undefined);
});

test('stored upload is replaced with a metadata-free derivative before it can be reviewed', async () => {
  const route = readFileSync(new URL('../app/api/photo-intake/confirm/route.ts', import.meta.url), 'utf8');
  const reserveCall = route.indexOf('reservePhotoIntakeSanitizationAttempt(');
  const overwriteCall = route.indexOf('await put(attempt.targetStorageKey, sanitized');
  const completeCall = route.indexOf('completePhotoIntakeRecord({');
  assert.ok(reserveCall >= 0 && overwriteCall > reserveCall && completeCall > overwriteCall,
    'a durable attempt and unique private key must exist before upload, then become the media key only after completion');
  assert.match(route, /await put\(attempt\.targetStorageKey, sanitized,\s*\{\s*access: 'private'[\s\S]*allowOverwrite: false/);
  assert.match(route, /mimeType: 'image\/jpeg'/);
  assert.match(route, /contentHash: createHash\('sha256'\)\.update\(sanitized\)/);
});

test('a retry after private overwrite and DB rollback safely sanitizes and persists again', async () => {
  const original = await sharp({ create: { width: 5, height: 4, channels: 3, background: '#315a77' } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: 'TEST GPS SOURCE' } } })
    .toBuffer();
  let stored = original;
  let writes = 0;

  const prepare = () => prepareSanitizedPrivatePhoto(stored, false, async (safeBytes) => {
    stored = Buffer.from(safeBytes);
    writes += 1;
  });

  let first;
  await assert.rejects(async () => {
    first = await prepare();
    throw new Error('simulated final DB completion failure');
  }, /simulated final DB completion failure/);
  assert.equal((await sharp(stored).metadata()).exif, undefined);
  assert.notEqual(first.length, original.length);

  const retry = await prepare();
  assert.deepEqual(retry, stored);
  assert.equal(writes, 2, 'after a rolled-back DB transaction the tracked private key is safely normalized and saved again');
  assert.equal((await sharp(retry).metadata()).exif, undefined);
});

test('private photo decoder rejects malformed image data', async () => {
  await assert.rejects(() => normalizePrivatePhoto(Buffer.from([0xff, 0xd8, 0xff, 0x00])));
});

test('photo resolution limit is rejected with clear guidance before pixel decoding', async () => {
  const oversized = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: '#fff' } }).jpeg().toBuffer();
  await assert.rejects(() => normalizePrivatePhoto(oversized), new RegExp(`${Math.ceil(maxIntakePhotoPixels / 1_000_000)} megapixelov`));
});

test('crew photo preview keeps its locality field styled in desktop and mobile layout', () => {
  const client = readFileSync(new URL('../app/spolupraca/fotky/photo-intake-client.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../app/spolupraca/fotky/photo-intake-route.css', import.meta.url), 'utf8');

  assert.match(client, /className="photo-intake-draft-fields"/);
  assert.match(styles, /\.photo-intake-draft-fields\s*>\s*label input\s*\{/);
  assert.match(styles, /\.photo-intake-draft-content\s*\{[^}]*grid-template-columns:[^}]*\}/);
  assert.match(styles, /\.photo-intake-draft-content\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);\s*\}/);
});
