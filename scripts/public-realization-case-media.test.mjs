import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  createPublicRealizationPhotoVariantStore,
  getPublicRealizationPhotoVariant,
  parsePublicRealizationImageWidth,
  PublicRealizationMediaBusyError,
  resizePublicRealizationPhoto,
} from '../src/server/public-realization-case-media.ts';

test('public realization media accepts only the three responsive widths', () => {
  assert.equal(parsePublicRealizationImageWidth('https://example.test/photo/'), null);
  for (const width of [360, 720, 1080]) {
    assert.equal(parsePublicRealizationImageWidth(`https://example.test/photo/?w=${width}`), width);
  }
  for (const value of ['0', '80', '361', '1081', '720.5', '720x', '', '-1']) {
    assert.equal(parsePublicRealizationImageWidth(`https://example.test/photo/?w=${value}`), undefined);
  }
});

test('responsive variants have truthful 3:2 dimensions even for a tiny source', async () => {
  const source = await sharp({
    create: { width: 80, height: 120, channels: 3, background: '#8aa0b5' },
  }).jpeg().toBuffer();
  for (const width of [360, 720, 1080]) {
    const output = await resizePublicRealizationPhoto(source, width);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, Math.round(width * 2 / 3));
    assert.equal(metadata.format, 'jpeg');
  }
});

test('same approved storage variant deduplicates work and uses a bounded derivative cache', async () => {
  const source = await sharp({
    create: { width: 720, height: 480, channels: 3, background: '#7c93aa' },
  }).jpeg().toBuffer();
  let loads = 0;
  const load = async () => { loads += 1; return source; };
  const key = `photo-intake/sanitized/test-${Date.now()}/source.jpg`;
  const [first, second] = await Promise.all([
    getPublicRealizationPhotoVariant(key, 360, load),
    getPublicRealizationPhotoVariant(key, 360, load),
  ]);
  const third = await getPublicRealizationPhotoVariant(key, 360, load);
  assert.equal(loads, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(first, third);
});

test('variant cache enforces byte LRU and TTL boundaries', async () => {
  let clock = 1_000;
  const loads = new Map();
  const store = createPublicRealizationPhotoVariantStore({
    maxCacheBytes: 10,
    ttlMs: 50,
    now: () => clock,
    resize: async () => Buffer.alloc(6, 1),
  });
  const load = (key) => async () => {
    loads.set(key, (loads.get(key) || 0) + 1);
    return Buffer.from(key);
  };
  await store.get('a', 360, load('a'));
  await store.get('b', 360, load('b'));
  assert.deepEqual(store.snapshot(), {
    cacheEntries: 1, cacheBytes: 6, inFlight: 0, activeTransforms: 0, queuedTransforms: 0,
  });
  await store.get('a', 360, load('a'));
  assert.equal(loads.get('a'), 2, 'najstarší variant sa musí po prekročení byte limitu znovu načítať');
  clock += 51;
  await store.get('a', 360, load('a'));
  assert.equal(loads.get('a'), 3, 'expirovaný variant sa musí znovu načítať');
});

test('variant store bounds concurrent transforms and clears failed in-flight work', async () => {
  const releases = [];
  const store = createPublicRealizationPhotoVariantStore({
    maxActiveTransforms: 2,
    maxQueuedTransforms: 1,
    resize: async () => new Promise((resolve) => releases.push(() => resolve(Buffer.alloc(4, 2)))),
  });
  const load = async () => Buffer.from('source');
  const first = store.get('first', 360, load);
  const second = store.get('second', 360, load);
  const third = store.get('third', 360, load);
  await assert.rejects(store.get('fourth', 360, load), PublicRealizationMediaBusyError);
  assert.deepEqual(store.snapshot(), {
    cacheEntries: 0, cacheBytes: 0, inFlight: 3, activeTransforms: 2, queuedTransforms: 1,
  });
  releases.shift()?.();
  releases.shift()?.();
  await new Promise((resolve) => setImmediate(resolve));
  releases.shift()?.();
  await Promise.all([first, second, third]);
  assert.equal(store.snapshot().inFlight, 0);
  assert.equal(store.snapshot().activeTransforms, 0);

  let attempts = 0;
  const retryStore = createPublicRealizationPhotoVariantStore({
    resize: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('synthetic resize failure');
      return Buffer.alloc(3, 3);
    },
  });
  await assert.rejects(retryStore.get('retry', 360, load), /synthetic resize failure/);
  assert.equal(retryStore.snapshot().inFlight, 0);
  await retryStore.get('retry', 360, load);
  assert.equal(attempts, 2);
});
