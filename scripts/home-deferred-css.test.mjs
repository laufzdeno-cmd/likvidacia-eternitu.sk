import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('homepage keeps above-fold CSS critical and loads below-fold CSS without render blocking', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const critical = readFileSync('app/home-critical.css', 'utf8');
  const deferred = readFileSync('public/assets/home-below-fold.css', 'utf8');
  const loader = readFileSync('app/home-deferred-styles.tsx', 'utf8');
  assert.match(page, /import '\.\/home-critical\.css'/);
  assert.match(page, /<HomeDeferredStyles \/>/);
  assert.match(critical, /--home-route-css:\s*1/);
  assert.match(critical, /\.hero-photo\b/);
  assert.doesNotMatch(critical, /\.included-group-card\b/);
  assert.match(deferred, /--home-deferred-css:\s*1/);
  assert.match(deferred, /\.included-group-card\b/);
  assert.match(loader, /media="print"/);
  assert.match(loader, /linkRef\.current\.media = 'all'/);
  assert.match(loader, /<noscript><link rel="stylesheet"/);
});
