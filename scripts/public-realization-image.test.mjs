import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { arePublicRealizationImagesAvailable as available, checkPublicRealizationImagesAvailable as check, isSafePublicRealizationImageUrl as policy, normalizePublicRealizationImageUrl as normalize } from '../src/server/public-realization-image.mjs';

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

test('approval checks every local public asset and fails closed on missing or unsafe paths', async () => {
  const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
  const options = { publicRoot, isVercel: false };
  assert.equal(await available([], options), true);
  assert.equal(await available(['/assets/azbest/webp/azbest-001.webp'], options), true);
  assert.equal(await available(['https://likvidacia-eternitu.sk/assets/azbest/webp/azbest-001.webp'], options), true);
  assert.equal(await available(['/assets/azbest/webp/azbest-001.webp', '/assets/azbest/webp/not-present.webp'], options), false);
  assert.equal(await available(['/assets/../storage/private.jpg'], options), false);
});

test('production approval checks the public alias that served the action, not a protected VERCEL_URL', async () => {
  const requests = [];
  const options = {
    isVercel: true,
    vercelEnv: 'production',
    vercelTargetEnv: 'production',
    requestHost: 'likvidacia-eternitu.sk',
    // Simulate an immutable deployment whose unauthenticated HEAD is protected.
    deploymentHost: 'protected-release.vercel.app',
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (new URL(url).hostname.endsWith('.vercel.app')) return new Response(null, { status: 401 });
      return new Response(null, { status: 200, headers: { 'content-type': 'image/webp', 'content-length': '123' } });
    },
  };
  assert.deepEqual(await check(['/assets/azbest/webp/azbest-001.webp'], options), { available: true });
  assert.equal(requests[0].url, 'https://likvidacia-eternitu.sk/assets/azbest/webp/azbest-001.webp');
  assert.equal(requests[0].init.method, 'HEAD');
  assert.equal(requests[0].init.redirect, 'manual');
  assert.equal(requests[0].init.cache, 'no-store');
  assert.ok(requests[0].init.signal instanceof AbortSignal);

  for (const response of [
    new Response(null, { status: 404 }),
    new Response(null, { status: 401 }),
    new Response(null, { status: 307, headers: { location: 'https://elsewhere.example/photo.webp' } }),
    new Response(null, { status: 200, headers: { 'content-type': 'text/html' } }),
    new Response(null, { status: 200, headers: { 'content-type': 'image/webp', 'content-length': '0' } }),
  ]) {
    assert.deepEqual(await check(['/assets/missing.webp'], { ...options, fetchImpl: async () => response }),
      { available: false, reason: 'image-unavailable' });
  }
  assert.equal(await available(['/assets/missing.webp'], { ...options, fetchImpl: async () => { throw new Error('network unavailable'); } }), false);
  assert.deepEqual(await check(['/api/private/photo.webp'], options), { available: false, reason: 'image-unavailable' });
  assert.equal(requests.length, 1, 'invalid paths and failed checks must not contact another origin');
});

test('protected Preview and noncanonical hosts fail closed without probing another deployment or production', async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    return new Response(null, { status: 200, headers: { 'content-type': 'image/webp' } });
  };
  const base = { isVercel: true, vercelEnv: 'production', vercelTargetEnv: 'production', fetchImpl };
  const image = ['/assets/azbest/webp/azbest-001.webp'];
  for (const options of [
    { ...base, vercelEnv: 'preview', requestHost: 'likvidacia-eternitu.sk' },
    { ...base, vercelEnv: 'preview', requestHost: 'protected-preview.vercel.app' },
    { ...base, vercelTargetEnv: 'staging', requestHost: 'likvidacia-eternitu.sk' },
    { ...base, requestHost: 'protected-deployment.vercel.app' },
    { ...base, requestHost: 'example.com' },
    { ...base, requestHost: 'likvidacia-eternitu.sk.evil.example' },
    { ...base, requestHost: 'likvidacia-eternitu.sk:443' },
    { ...base, requestHost: null },
  ]) {
    assert.deepEqual(await check(image, options), { available: false, reason: 'verification-unavailable' });
  }
  assert.deepEqual(await check([], { ...base, vercelEnv: 'preview', requestHost: 'protected-preview.vercel.app' }),
    { available: false, reason: 'verification-unavailable' });
  assert.deepEqual(requests, [], 'an unverifiable environment must never trigger an outbound request');
});

test('admin publication verifies stored draft images before changing status and leaves published records alone', async () => {
  const actions = await readFile(new URL('../app/admin/(protected)/realizacie/actions.ts', import.meta.url), 'utf8');
  const publication = actions.slice(actions.indexOf('export async function updateRealizationStatusAction'));
  assert.match(publication, /if \(status === 'published'\) \{[\s\S]*listRealizations\(\)\)\.find\(\(item\) => item\.id === id\)/);
  assert.match(publication, /if \(realization\.status !== 'published'\) \{[\s\S]*checkPublicRealizationImagesAvailable\(realization\.imageUrls/);
  assert.match(publication, /requestHost: \(await headers\(\)\)\.get\('host'\)/);
  assert.match(publication, /availability\.reason === 'verification-unavailable'[\s\S]*error=foto-overenie/);
  assert.ok(publication.indexOf('checkPublicRealizationImagesAvailable') < publication.indexOf('await updateRealizationStatus('));
  const adminPage = await readFile(new URL('../app/admin/(protected)/realizacie/page.tsx', import.meta.url), 'utf8');
  assert.match(adminPage, /params\?\.error === 'foto-overenie'[\s\S]*verejnú produkčnú doménu/);
  assert.match(adminPage, /params\?\.error === 'fotky-nedostupne'[\s\S]*aktuálnej produkčnej doméne/);
});

test('public realization section reads only records returned by published query', async () => {
  const page = await readFile(new URL('../app/realizacie/page.tsx', import.meta.url), 'utf8');
  const responsiveImage = await readFile(new URL('../src/components/responsive-image.tsx', import.meta.url), 'utf8');
  assert.match(page, /listPublishedRealizations\(24\)/);
  assert.match(page, /publishedRealizations\.map/);
  assert.match(page, /realizationHeroStripReferences\.map\(\(photo, index\) =>/);
  assert.match(page, /loading=\{index === 0 \? 'eager' : 'lazy'\}/);
  assert.match(page, /fetchPriority=\{index === 0 \? 'high' : 'low'\}/);
  assert.match(page, /className="realizations-hero-strip"/);
  assert.match(page, /sizes="\(max-width: 760px\) 300px, 25vw"/,
    'gallery cards must not request viewport-wide images when the mobile card is capped at 300px');
  assert.match(page, /galleryReferences\.slice\(0, 12\)\.map/,
    'the server document must contain only the first twelve reviewed gallery cards');
  assert.match(page, /fetchPriority="low"\s+deferUntilVisible/,
    'the first reviewed cards must stay outside the critical image request path');
  assert.match(responsiveImage, /data-deferred-responsive-image/);
  assert.match(responsiveImage, /<noscript>[\s\S]*?<source srcSet=\{webpSrcSet\}/,
    'the first twelve cards must retain a complete no-JavaScript fallback');
  assert.doesNotMatch(page, /listRealizations\(/);
  assert.match(page, /normalizePublicRealizationImageUrl/);
  assert.match(page, /export const revalidate = 300/);
  assert.match(page, /async function loadPublishedRealizations\(\)[\s\S]*?catch[\s\S]*?return \[\]/,
    'the reviewed gallery must remain available when the approved-record database is temporarily unavailable');
  assert.match(page, /async function loadApprovedCaseStudies\(page: number\)[\s\S]*?catch[\s\S]*?return \{ cases: \[\], total: 0 \}/,
    'approved case studies must fail closed without taking the public gallery offline');
  assert.doesNotMatch(page, /realization\.location|realization\.areaEstimate/);
  assert.match(page, /import PublicBaseClient from '..\/public-base-client'/);
  assert.match(page, /import RealizationsClientBoundary from '..\/realizations-client-boundary'/);
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
  const boundary = await readFile(new URL('../app/realizations-client-boundary.tsx', import.meta.url), 'utf8');
  const publicBase = await readFile(new URL('../app/public-base-client.tsx', import.meta.url), 'utf8');
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
  assert.doesNotMatch(client, /useEffect|['"]use client['"]/);
  assert.match(boundary, /import initializeRealizationsGalleryClient from '\.\/realizations-gallery-client'/);
  assert.match(boundary, /cleanup = initializeRealizationsGalleryClient\(\)/);
  assert.match(boundary, /IntersectionObserver/);
  assert.match(boundary, /rootMargin: '240px 0px'/);
  assert.match(boundary, /activateDeferredPicture/);
  assert.match(boundary, /imageObserver\?\.disconnect\(\)/);
  assert.match(boundary, /document\.addEventListener\('pointerover', activateFromIntent, true\)/);
  assert.match(boundary, /document\.addEventListener\('focusin', activateFromIntent, true\)/);
  assert.match(boundary, /document\.addEventListener\('touchstart', activateFromIntent/);
  assert.match(boundary, /preserveFirstGalleryAction/);
  assert.match(boundary, /event\.stopImmediatePropagation\(\)/);
  assert.match(boundary, /pendingAction \?\?= target/);
  assert.match(boundary, /if \(target\?\.isConnected\) target\.click\(\)/);
  assert.match(boundary, /document\.removeEventListener\('click', preserveFirstGalleryAction, true\)/);
  assert.match(publicBase, /stickyCta\.inert = !stickyVisible/);
  assert.match(publicBase, /whatsappButton\.inert = stickyVisible/);
  assert.match(client, /galleryReferences\.slice\(renderedCount\)/);
  assert.match(client, /appendDeferredGalleryCards\(grid, renderedCards\.length\)/);
  assert.match(client, /image\.loading = 'lazy'/);
  assert.match(client, /card\.hidden = index >= 12/);
  const page = await readFile(new URL('../app/realizacie/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /className=\{category\.key === 'vsetko' \? 'is-active' : undefined\}/);
  assert.match(page, /className="mobile-sticky-cta"[^>]* inert/);
  assert.match(client, /document\.body\.classList\.remove\('is-lightbox-open'\)/);
});
