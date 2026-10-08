import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const jpgDir = new URL('../public/assets/azbest/jpg/', import.meta.url);
const webpDir = new URL('../public/assets/azbest/webp/', import.meta.url);

function hasExifGpsPointer(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    const segmentEnd = offset + segmentLength;
    if (marker === 0xe1 && segmentLength >= 16 && bytes.subarray(offset + 2, offset + 8).toString('ascii') === 'Exif\0\0') {
      const tiff = offset + 8;
      if (tiff + 8 > segmentEnd) {
        offset = segmentEnd;
        continue;
      }
      const byteOrder = bytes.subarray(tiff, tiff + 2).toString('ascii');
      const littleEndian = byteOrder === 'II';
      if (littleEndian || byteOrder === 'MM') {
        const readUInt16 = (position) => littleEndian ? bytes.readUInt16LE(position) : bytes.readUInt16BE(position);
        const readUInt32 = (position) => littleEndian ? bytes.readUInt32LE(position) : bytes.readUInt32BE(position);
        if (readUInt16(tiff + 2) === 42) {
          const ifd0 = tiff + readUInt32(tiff + 4);
          if (ifd0 >= tiff && ifd0 + 2 <= segmentEnd) {
            const entries = readUInt16(ifd0);
            for (let index = 0; index < entries; index += 1) {
              const entry = ifd0 + 2 + index * 12;
              if (entry + 12 > segmentEnd) break;
              if (readUInt16(entry) === 0x8825) return true;
            }
          }
        }
      }
    }
    offset = segmentEnd;
  }
  return false;
}

function syntheticGpsPayload(littleEndian) {
  const payload = Buffer.alloc(32);
  payload.write('Exif\0\0', 0, 'ascii');
  payload.write(littleEndian ? 'II' : 'MM', 6, 'ascii');
  const writeUInt16 = littleEndian ? payload.writeUInt16LE.bind(payload) : payload.writeUInt16BE.bind(payload);
  const writeUInt32 = littleEndian ? payload.writeUInt32LE.bind(payload) : payload.writeUInt32BE.bind(payload);
  writeUInt16(42, 8);
  writeUInt32(8, 10);
  writeUInt16(1, 14);
  writeUInt16(0x8825, 16);
  writeUInt16(4, 18);
  writeUInt32(1, 20);
  writeUInt32(26, 24);
  writeUInt32(0, 28);
  return payload;
}

function app1Segment(payload) {
  const segmentLength = payload.length + 2;
  return Buffer.concat([Buffer.from([0xff, 0xe1, segmentLength >> 8, segmentLength & 0xff]), payload]);
}

function syntheticJpeg(...segments) {
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments, Buffer.from([0xff, 0xd9])]);
}

function syntheticJpegWithGpsPointer(littleEndian) {
  return syntheticJpeg(app1Segment(syntheticGpsPayload(littleEndian)));
}

test('legacy realization assets stay location-neutral until owner evidence exists', async () => {
  assert.equal(hasExifGpsPointer(syntheticJpegWithGpsPointer(false)), true, 'big-endian EXIF GPS musí byť rozpoznané');
  assert.equal(hasExifGpsPointer(syntheticJpegWithGpsPointer(true)), true, 'little-endian EXIF GPS musí byť rozpoznané');
  assert.equal(
    hasExifGpsPointer(syntheticJpeg(app1Segment(Buffer.from('Exif\0\0BAD', 'ascii')), app1Segment(syntheticGpsPayload(false)))),
    true,
    'poškodený prvý EXIF segment nesmie skryť ďalší platný GPS segment',
  );
  assert.equal(
    hasExifGpsPointer(syntheticJpeg(Buffer.concat([Buffer.from([0xff]), app1Segment(syntheticGpsPayload(false))]))),
    true,
    'opakované JPEG FF výplňové bajty nesmú skryť EXIF GPS',
  );
  assert.equal(hasExifGpsPointer(Buffer.from([0xff, 0xd8, 0xff, 0xd9])), false);
  const [jpgNames, webpNames, realizationsPage, matrix, inventory] = await Promise.all([
    readdir(jpgDir),
    readdir(webpDir),
    readFile(new URL('../app/realizacie/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/REALIZATION-EVIDENCE-INVENTORY-2026-10-08.md', import.meta.url), 'utf8'),
  ]);
  const jpg = jpgNames.filter((name) => /^azbest-\d{3}\.jpg$/.test(name)).sort();
  const webp = webpNames.filter((name) => /^azbest-\d{3}\.webp$/.test(name)).sort();
  assert.equal(jpg.length, 179);
  assert.equal(webp.length, 179);
  assert.deepEqual(jpg.map((name) => name.replace(/\.jpg$/, '')), webp.map((name) => name.replace(/\.webp$/, '')));

  const gpsTagged = [];
  for (const name of jpg) {
    if (hasExifGpsPointer(await readFile(new URL(name, jpgDir)))) gpsTagged.push(name);
  }
  assert.deepEqual(gpsTagged, [], 'verejné pracovné kópie nesmú obsahovať EXIF GPS');
  assert.match(realizationsPage, /Lokality a m2 pri fotkách nevymýšľame\./);
  assert.match(realizationsPage, /Pri starších fotkách neuvádzame lokalitu ani výmeru\s+bez spoľahlivého podkladu\./);
  assert.match(matrix, /\| G04 \| WAITING \|[^\n]*REALIZATION-EVIDENCE-INVENTORY-2026-10-08\.md/);
  assert.match(matrix, /\| G11 \| WAITING \|[^\n]*REALIZATION-EVIDENCE-INVENTORY-2026-10-08\.md/);
  assert.match(inventory, /\*\*179 JPG\*\* a \*\*179 WebP\*\*/);
  assert.match(inventory, /G04 a publikačná hardgate G11 zostávajú \*\*WAITING\*\*/);
});
