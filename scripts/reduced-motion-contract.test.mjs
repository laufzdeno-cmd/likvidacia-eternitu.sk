import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const homepageClient = read('../app/homepage-below-fold-client.tsx');
const landingClient = read('../app/landing-client.tsx');
const browserHarness = read('./lead-private-blob-browser.integration.mjs');

for (const [name, source] of [
  ['homepage below-fold client', homepageClient],
  ['shared landing client', landingClient],
]) {
  test(`${name} skips decorative reveal initialization for reduced motion`, () => {
    assert.match(source, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
    assert.match(source, /if \(motionAllowed\) \{[\s\S]*classList\.add\('has-enhanced-motion'\)/);
    assert.match(source, /if \(motionAllowed && 'IntersectionObserver' in window/);
    assert.match(source, /classList\.remove\('has-enhanced-motion'\)/);
    assert.match(source, /classList\.remove\('reveal-on-scroll', 'is-visible'\)/);
  });
}

test('responsive browser audit proves reduced motion, 200% zoom and landscape coverage', () => {
  assert.match(browserHarness, /reducedMotion: 'reduce'/);
  assert.match(browserHarness, /Emulation\.setPageScaleFactor/);
  assert.match(browserHarness, /pageScaleFactor: 2/);
  assert.match(browserHarness, /zoom200Routes: zoomRoutes\.length/);
  assert.match(browserHarness, /landscapeRoutes: routes\.length/);
  assert.match(browserHarness, /\{ width: 568, height: 320 \}/);
});
