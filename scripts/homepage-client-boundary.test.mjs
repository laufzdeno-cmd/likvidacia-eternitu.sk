import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../app/page.tsx');
const boundary = read('../app/homepage-client-boundary.tsx');
const critical = read('../app/homepage-critical-client.tsx');
const base = read('../app/public-base-client.tsx');

test('homepage keeps navigation and analytics interactive while deferring the heavy lead client', () => {
  assert.match(page, /<HomepageClientBoundary\s*\/>/);
  assert.doesNotMatch(page, /<HomepageCriticalClient\s*\/>/);
  assert.doesNotMatch(boundary, /from 'next\/dynamic'/);
  assert.match(boundary, /if \(!active \|\| initializeCriticalClient\) return/);
  assert.match(boundary, /import\('\.\/homepage-critical-client'\)\.then/);
  assert.match(boundary, /initializeCriticalClient\(\{ pageViewAlreadyTracked: true, clickAnalyticsAlreadyTracked: true \}\)/);
  assert.match(boundary, /return initializeCriticalClient \? null : <PublicBaseClient analyticsScope="none"\s*\/>/);
  assert.match(boundary, /<PublicBaseClient analyticsScope="none"\s*\/>/);
  assert.doesNotMatch(critical, /'use client'/);
  assert.doesNotMatch(critical, /from 'react'/);
  assert.match(critical, /export default function initializeHomepageCriticalClient/);
  assert.match(critical, /if \(!pageViewAlreadyTracked\) trackAnalytics\('page_view'\)/);
  assert.match(critical, /document\.addEventListener\('click', preserveCampaignAttributionOnInternalLink, true\)/);
  assert.match(critical, /document\.removeEventListener\('click', preserveCampaignAttributionOnInternalLink, true\)/);
});

test('the lightweight homepage client preserves phone and lead CTA analytics semantics', () => {
  assert.match(boundary, /trackAnalyticsEvent\('phone_click', \{ label, href \}\)/);
  assert.match(boundary, /trackAnalyticsEvent\('cta_click', \{ label, href \}\)/);
  assert.match(boundary, /document\.addEventListener\('click', trackHomepageClick, true\)/);
  assert.match(boundary, /document\.removeEventListener\('click', trackHomepageClick, true\)/);
  assert.match(base, /if \(analyticsScope !== 'none'\) document\.addEventListener\('click', onAnalyticsClick\)/);
  assert.match(critical, /if \(!clickAnalyticsAlreadyTracked\) document\.addEventListener\('click', onAnalyticsClick\)/);
});

test('lead enhancements activate for direct results and explicit form or calculator intent without viewport preloading', () => {
  assert.match(boundary, /url\.searchParams\.has\('odoslane'\)/);
  assert.match(boundary, /url\.searchParams\.has\('dopyt_receipt'\)/);
  assert.match(boundary, /url\.searchParams\.has\('chyba'\)/);
  assert.match(boundary, /target\?\.closest\('#dopyt, #orientacna-cena/);
  assert.match(boundary, /document\.addEventListener\('click', activateFromClick, true\)/);
  assert.match(boundary, /document\.addEventListener\('focusin', activateFromFocus, true\)/);
  assert.doesNotMatch(boundary, /addEventListener\('pointerdown'/);
  assert.doesNotMatch(boundary, /IntersectionObserver/);
});

test('the first calculator material, quote, submit, file-picker and drop action is preserved while the critical client loads', () => {
  assert.match(boundary, /const criticalReady = useRef\(false\)/);
  assert.match(boundary, /\[data-price-material\], \[data-price-quote\], \.form-submit/);
  assert.match(boundary, /event\.stopImmediatePropagation\(\)/);
  assert.match(boundary, /pendingAction\.current \?\?= target/);
  assert.match(boundary, /pendingFiles\.current = Array\.from\(input\.files\)/);
  assert.match(boundary, /pendingFiles\.current = Array\.from\(event\.dataTransfer\.files\)/);
  assert.match(boundary, /document\.addEventListener\('change', preservePendingFiles, true\)/);
  assert.match(boundary, /document\.addEventListener\('drop', preserveFirstFileDrop, true\)/);
  assert.match(boundary, /const transfer = new DataTransfer\(\)/);
  assert.match(boundary, /if \(target\?\.isConnected\) target\.click\(\)/);
  assert.match(boundary, /pendingAction\.current = null/);
  assert.match(boundary, /pendingFiles\.current = \[\]/);
  assert.match(boundary, /restorePendingFiles\(\)/);
  assert.match(boundary, /input\?\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  assert.match(boundary, /\.catch\(\(\) => \{/);
  assert.match(boundary, /if \(loadAttempt < 1\)/);
  assert.match(boundary, /criticalLoadFailed\.current = true/);
  assert.match(boundary, /nativeFallbackInProgress\.current = true/);
  assert.match(boundary, /target\.click\(\)/);
  assert.match(boundary, /setLoadAttempt\(\(attempt\) => attempt \+ 1\)/);
  assert.match(boundary, /document\.removeEventListener\('change', preservePendingFiles, true\)/);
  assert.match(boundary, /document\.removeEventListener\('drop', preserveFirstFileDrop, true\)/);
  assert.doesNotMatch(critical, /if \(fileInput\?\.files\?\.length\) void addFiles\(fileInput\.files\)/);
});

test('the lightweight homepage client keeps the sticky CTA inert under consent, quote and calculator surfaces', () => {
  assert.match(base, /const isCookieBannerVisible = \(\) =>/);
  assert.match(base, /!isVisibleInViewport\(heroSection\)/);
  assert.match(base, /!isCookieBannerVisible\(\)/);
  assert.match(base, /!isVisibleInViewport\(quoteSection\)/);
  assert.match(base, /!isVisibleInViewport\(priceCalculatorCard\)/);
  assert.match(base, /cookieBannerObserver = new MutationObserver\(onScroll\)/);
  assert.match(base, /cookieBannerObserver\?\.disconnect\(\)/);
  assert.match(base, /window\.addEventListener\('load', startDeferredObservers, \{ once: true \}\)/);
  assert.match(base, /firstObserverFrame = window\.requestAnimationFrame/);
  assert.match(base, /secondObserverFrame = window\.requestAnimationFrame/);
  assert.match(base, /window\.addEventListener\('scroll', onScroll, \{ passive: true \}\)/,
    'scroll behavior stays immediately available while only observers are deferred');
  assert.match(base, /const hashScrollTimers = new Set<number>\(\)/);
  assert.match(base, /hashScrollTimers\.delete\(timer\)/);
  assert.match(base, /const onHashChange = \(\) => scheduleHashScroll\(20\)/,
    'hash-change timers must use the same tracked cleanup path as initial hash scrolling');
  assert.match(base, /window\.removeEventListener\('load', startDeferredObservers\)/);
  assert.match(base, /window\.cancelAnimationFrame\(firstObserverFrame\)/);
  assert.match(base, /window\.cancelAnimationFrame\(secondObserverFrame\)/);
  assert.match(base, /stickyCta\.inert = !stickyVisible/);
});
