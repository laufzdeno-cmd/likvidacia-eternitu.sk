import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import {
  pagePhotoId,
  pagePhotoIds,
  publicPhotoAssignments,
  publicPhotoIdentity,
} from '../src/content/public-photo-assignments.ts';
import {
  azbestReferences,
  galleryCategories,
  galleryReferences,
  getAzbestReference,
  heroPhoto,
  realizationHeroStripReferences,
} from '../src/data/azbestReferences.ts';

const publicRoot = new URL('../public/', import.meta.url);
const slots = Object.entries(publicPhotoAssignments)
  .flatMap(([route, ids]) => ids.map((id, index) => ({ route, index, id })));

test('public photo contexts use globally distinct originals', () => {
  const owner = new Map();
  assert.ok(slots.length > 0);
  for (const { route, index, id } of slots) {
    assert.match(route, /^\/(?:[a-z0-9-]+\/)*$/);
    assert.match(id, /^azbest-\d{3}$/);
    assert.equal(owner.has(id), false, `${id} is assigned to both ${owner.get(id)} and ${route}[${index}]`);
    owner.set(id, `${route}[${index}]`);
    assert.equal(pagePhotoId(route, index), id);
  }
});

test('every assigned original has usable metadata, real JPEG/WebP files and different source bytes', async () => {
  const byId = new Map();
  for (const reference of azbestReferences) {
    assert.equal(byId.has(reference.id), false, `duplicate manifest ID ${reference.id}`);
    byId.set(reference.id, reference);
  }
  const originalHashes = new Map();
  for (const { id, route } of slots) {
    const reference = getAzbestReference(id);
    assert.equal(reference.id, id);
    assert.ok(reference.title.trim().length >= 8, `${id} needs a meaningful title`);
    assert.ok(reference.alt.trim().length >= 20, `${id} needs a meaningful description`);
    assert.ok(reference.recommendedUse.includes(route), `${id} needs a traceable public context`);
    assert.ok(galleryCategories.some(category => category.key === reference.category), `${id} has an unknown category`);
    for (const [format, pathname] of [['jpeg', reference.jpg], ['webp', reference.webp]]) {
      const bytes = await readFile(new URL(pathname.replace(/^\//, ''), publicRoot));
      const image = await sharp(bytes).metadata();
      assert.equal(image.format, format, `${id} ${pathname} must be the advertised image type`);
      assert.ok(image.width >= 320 && image.height >= 240, `${id} is too small for content use`);
      assert.equal(publicPhotoIdentity(pathname), id);
      if (format === 'jpeg') {
        const hash = createHash('sha256').update(bytes).digest('hex');
        assert.equal(originalHashes.has(hash), false, `${id} repeats the source bytes of ${originalHashes.get(hash)}`);
        originalHashes.set(hash, id);
      }
    }
  }
});

test('photo lookup fails on missing pages and slots rather than silently repeating a fallback image', () => {
  assert.throws(() => pagePhotoIds('/not-assigned/'), /Missing public photo assignment/);
  assert.throws(() => pagePhotoIds('/recenzie'), /Missing public photo assignment/);
  assert.throws(() => pagePhotoIds('toString'), /Missing public photo assignment/);
  for (const index of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 100]) {
    assert.throws(() => pagePhotoId('/recenzie/', index), /Missing public photo slot/);
  }
  assert.ok(Object.isFrozen(publicPhotoAssignments));
  assert.ok(Object.isFrozen(pagePhotoIds('/')));
  assert.throws(() => pagePhotoIds('/').push('azbest-001'), TypeError);
});

test('JPEG/WebP/AVIF, hero crops, Next transforms and the price-page crop share an identity', () => {
  const originals = [
    '/assets/azbest/jpg/azbest-087.jpg',
    '/assets/azbest/webp/azbest-087.webp',
    '/assets/azbest/hero/azbest-087-mobile-432.avif',
    '/assets/azbest/hero/azbest-087-desktop-900.webp?width=900',
    'https://www.likvidacia-eternitu.sk/assets/azbest/jpg/azbest-087.jpg',
    'http://127.0.0.1:3147/assets/azbest/webp/azbest-087.webp',
    'https://likvidacia-eternitu-test-laufzdeno.vercel.app/assets/azbest/webp/azbest-087.webp',
  ];
  for (const src of originals) assert.equal(publicPhotoIdentity(src), 'azbest-087', src);
  const transformed = `/_next/image?url=${encodeURIComponent(originals[0])}&w=640&q=75`;
  assert.equal(publicPhotoIdentity(transformed), 'azbest-087');
  assert.equal(publicPhotoIdentity(`/_next/image/?url=${encodeURIComponent(originals[0])}&w=640&q=75`), 'azbest-087');
  assert.equal(publicPhotoIdentity(`/_next/image?url=${encodeURIComponent(transformed)}&w=320&q=75`), 'azbest-087');
  assert.equal(publicPhotoIdentity('/og/cena-strecha-realizacia.jpg'), 'azbest-150');
  assert.equal(publicPhotoIdentity('/assets/azbest/webp/azbest-150.webp'), 'azbest-150');
  assert.equal(publicPhotoIdentity('/assets/azbest/jpg/azbest-013.jpg'), 'azbest-014');
  assert.equal(publicPhotoIdentity('/assets/azbest/webp/azbest-025.webp'), 'azbest-026');
});

test('identity ignores only known brand/UI images and preserves unknown photographs', () => {
  for (const src of ['/assets/astana-logo.png?surface=header', '/assets/astana-logo-dark.png', '/favicon.svg', '/assets/icons/phone.svg', 'data:image/gif;base64,AAAA', 'blob:https://likvidacia-eternitu.sk/example']) {
    assert.equal(publicPhotoIdentity(src), null, src);
  }
  assert.equal(publicPhotoIdentity('/assets/roofers/roofer-installing-new-roof.webp'), '/assets/roofers/roofer-installing-new-roof.webp');
  assert.equal(publicPhotoIdentity('/assets/photos/logo-worker.webp'), '/assets/photos/logo-worker.webp');
  assert.equal(publicPhotoIdentity('https://other.example/assets/azbest/webp/azbest-087.webp'), 'https://other.example/assets/azbest/webp/azbest-087.webp');
  assert.equal(publicPhotoIdentity('https://other-project.vercel.app/assets/astana-logo.png'), 'https://other-project.vercel.app/assets/astana-logo.png');
  assert.throws(() => publicPhotoIdentity('/_next/image?w=300'), /missing its source/);
  assert.throws(() => publicPhotoIdentity('javascript:alert(1)'), /Unsupported public photo URL protocol/);
});

test('historical alias pairs still have byte-identical original JPEGs', async () => {
  for (const [alias, canonical] of [['013', '014'], ['025', '026']]) {
    const [source, target] = await Promise.all([alias, canonical]
      .map(id => readFile(new URL(`assets/azbest/jpg/azbest-${id}.jpg`, publicRoot))));
    assert.ok(source.equals(target), `azbest-${alias} alias needs review after an original changed`);
    assert.equal(publicPhotoIdentity(`/assets/azbest/jpg/azbest-${alias}.jpg`), `azbest-${canonical}`);
  }
});

test('gallery and hero have separate assigned photographs and homepage retains its reviewed hero', () => {
  const assigned = pagePhotoIds('/realizacie/');
  assert.deepEqual(realizationHeroStripReferences.map(image => image.id), assigned.slice(0, 4));
  assert.deepEqual(galleryReferences.map(image => image.id), assigned.slice(4));
  assert.ok(galleryReferences.length >= 20);
  assert.equal(new Set([...galleryReferences, ...realizationHeroStripReferences].map(image => image.id)).size, assigned.length);
  assert.equal(heroPhoto.id, 'azbest-087');
  assert.deepEqual(pagePhotoIds('/'), ['azbest-087', 'azbest-164', 'azbest-057', 'azbest-110']);
});

test('each visible gallery category has a real photograph instead of an empty filter', () => {
  for (const category of galleryCategories) {
    if (category.key === 'vsetko') continue;
    assert.ok(galleryReferences.some(image => image.category === category.key), `${category.label} has no photograph`);
  }
});
