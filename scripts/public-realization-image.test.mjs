import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isSafePublicRealizationImageUrl as policy, normalizePublicRealizationImageUrl as normalize } from '../src/server/public-realization-image.mjs';

test('public realization image policy accepts same-site asset paths only', () => {
  assert.equal(policy('/assets/realizacie/roof-1.webp'), true);
  assert.equal(policy('/assets/azbest/file.jpg?width=800'), true);
  assert.equal(normalize('https://likvidacia-eternitu.sk/assets/realizacie/roof-1.webp'), '/assets/realizacie/roof-1.webp');
  assert.equal(normalize('https://www.likvidacia-eternitu.sk/assets/realizacie/roof-1.webp'), '/assets/realizacie/roof-1.webp');
  assert.equal(policy('https://example.com/photo.jpg'), false);
  assert.equal(policy('http://likvidacia-eternitu.sk/assets/photo.jpg'), false);
  assert.equal(policy('//example.com/photo.jpg'), false);
  assert.equal(policy('/assets/../private/photo.jpg'), false);
  assert.equal(policy('/assets/%2e%2e/private/photo.jpg'), false);
  assert.equal(policy('/assets/%252e%252e/private/photo.jpg'), false);
  assert.equal(policy('/assets/%2f%2fevil/photo.jpg'), false);
  assert.equal(policy('/api/photo-intake/private-blob'), false);
  assert.equal(policy('/assets/photo.svg'), false);
  assert.equal(policy('/assets\\photo.jpg'), false);
});

test('public realization section reads only records returned by published query', async () => {
  const page = await readFile(new URL('../app/realizacie/page.tsx', import.meta.url), 'utf8');
  const responsiveImage = await readFile(new URL('../src/components/responsive-image.tsx', import.meta.url), 'utf8');
  assert.match(page, /listPublishedRealizations\(24\)/);
  assert.match(page, /publishedRealizations\.map/);
  assert.match(page, /realizationHeroStripReferences\.map\(\(photo, index\) =>/);
  assert.match(page, /loading=\{index === 0 \? 'eager' : 'lazy'\}/);
  assert.match(page, /fetchPriority=\{index === 0 \? 'high' : 'auto'\}/);
  assert.match(page, /className="realizations-hero-strip"/);
  assert.match(page, /sizes="\(max-width: 760px\) 300px, 25vw"/,
    'gallery cards must not request viewport-wide images when the mobile card is capped at 300px');
  assert.match(page, /fetchPriority="low"\s+deferUntilVisible/,
    'only reviewed gallery cards opt into controlled deferred loading');
  assert.match(responsiveImage, /data-deferred-responsive-image/);
  assert.match(responsiveImage, /data-deferred-srcset=\{webpSrcSet\}/);
  assert.match(responsiveImage, /<noscript>[\s\S]*?<source srcSet=\{webpSrcSet\}/,
    'the deferred image must retain a complete no-JavaScript fallback');
  assert.doesNotMatch(page, /listRealizations\(/);
  assert.match(page, /normalizePublicRealizationImageUrl/);
  assert.match(page, /export const revalidate = 300/);
  assert.match(page, /NEXT_PHASE !== 'phase-production-build'\) throw error/);
  assert.doesNotMatch(page, /realization\.location|realization\.areaEstimate/);
  assert.match(page, /import PublicBaseClient from '..\/public-base-client'/);
  assert.match(page, /import RealizationsGalleryClient from '..\/realizations-gallery-client'/);
  assert.doesNotMatch(page, /import LandingClient from '..\/landing-client'/);
  const adminActions = await readFile(new URL('../app/admin/(protected)/realizacie/actions.ts', import.meta.url), 'utf8');
  assert.equal((adminActions.match(/revalidatePath\('\/realizacie'\)/g) ?? []).length, 2);
  assert.match(adminActions, /imageUrls\.map\(normalizePublicRealizationImageUrl\)/);
  assert.match(adminActions, /redirect\('\/admin\/realizacie\?error=fotky'\)/);
  const adminPage = await readFile(new URL('../app/admin/(protected)/realizacie/page.tsx', import.meta.url), 'utf8');
  assert.match(adminPage, /cestu z webu začínajúcu na/);
  assert.match(adminPage, /role="alert"/);
  assert.match(adminPage, /placeholder=\{'.*\/assets\/azbest/);
});

test('realizations-only client preserves filter, paging and accessible lightbox behavior', async () => {
  const client = await readFile(new URL('../app/realizations-gallery-client.tsx', import.meta.url), 'utf8');
  for (const selector of ['[data-gallery-card]', '[data-gallery-filter]', '[data-gallery-load-more]', '[data-gallery-lightbox]']) {
    assert.ok(client.includes(selector), `expected realizations client to bind ${selector}`);
  }
  assert.match(client, /gallery_filter/);
  assert.match(client, /galleryCurrentFilter/);
  assert.match(client, /event\.key === 'Escape'/);
  assert.match(client, /event\.key === 'ArrowRight'/);
  assert.match(client, /event\.key === 'ArrowLeft'/);
  assert.match(client, /event\.key === 'Tab'/);
  assert.match(client, /trigger\.focus\(\{ preventScroll: true \}\)/);
  assert.match(client, /stickyCta\.inert = !stickyVisible/);
  assert.match(client, /whatsappButton\.inert = stickyVisible/);
  assert.match(client, /IntersectionObserver/);
  assert.match(client, /rootMargin: '240px 0px'/);
  assert.match(client, /activateDeferredPicture/);
  assert.match(client, /galleryImageObserver\?\.disconnect\(\)/);
  const page = await readFile(new URL('../app/realizacie/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /className="mobile-sticky-cta"[^>]* inert/);
  assert.match(client, /document\.body\.classList\.remove\('is-lightbox-open'\)/);
});
