import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

const globalCssFiles = [
  'src/styles.css',
  'src/premium-overrides.css',
  'src/final-visual-polish.css',
  'src/responsive-audit-hotfix.css',
];
const isRouteSelector = (selector) =>
  /\.realizations-|\.real-gallery-|\.gallery-(?:filters|actions|lightbox)|\.published-realization-|:has\(\.realizations-page\)/.test(selector);

test('realizations-only presentation is owned by the /realizacie route', () => {
  const layout = readFileSync('app/realizacie/layout.tsx', 'utf8');
  const routeCss = readFileSync('app/realizacie/realizations-route.css', 'utf8');
  const criticalCss = readFileSync('app/realizacie/realizations-critical.css', 'utf8');
  const page = readFileSync('app/realizacie/page.tsx', 'utf8');
  const client = readFileSync('app/realizations-client-boundary.tsx', 'utf8');
  const deferredCss = readFileSync('public/assets/realizations-below-fold.css', 'utf8');
  assert.match(layout, /import '\.\/realizations-critical\.css'/);
  assert.match(criticalCss, /--realizations-critical-css:\s*1/);
  assert.match(criticalCss, /\.realizations-hero-strip figure:nth-child\(n \+ 3\)/);
  assert.match(page, /<noscript><link rel="stylesheet" href="\/assets\/realizations-below-fold\.css" \/><\/noscript>/);
  assert.match(client, /document\.createElement\('link'\)/);
  assert.match(client, /deferredStyles\.href = '\/assets\/realizations-below-fold\.css'/);
  assert.match(client, /deferredStyles\.fetchPriority = 'low'/);
  assert.match(client, /document\.head\.append\(deferredStyles\)/);
  assert.match(page, /fetchPriority=\{index === 0 \? 'high' : 'low'\}/);
  assert.match(client, /window\.location\.hash === galleryHash/);
  assert.match(client, /initializeRealizationsGalleryClient\(\)/);
  assert.doesNotMatch(client, /import\('\.\/realizations-gallery-client'\)/);
  assert.match(client, /cancelAnimationFrame\(styleFrame\)/);
  assert.match(client, /if \(createdDeferredStyles\) deferredStyles\?\.remove\(\)/);
  assert.match(criticalCss, /\.realizations-gallery-section\s*\{/);
  assert.match(criticalCss, /\.real-gallery-grid\s*\{/);
  assert.match(criticalCss, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(criticalCss, /@media \(max-width:\s*1180px\)[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(criticalCss, /@media \(max-width:\s*760px\)[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(criticalCss, /\.real-gallery-card\s*\{[^}]*min-height:\s*240px/);
  assert.match(criticalCss, /\.real-gallery-card picture,\s*\n\.real-gallery-card img\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%/);
  assert.match(criticalCss, /\.real-gallery-card img\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*object-fit:\s*cover/);
  assert.match(criticalCss, /\.gallery-filters button\s*\{[^}]*min-height:\s*42px;[^}]*padding:\s*10px 15px/);
  assert.match(criticalCss, /\.gallery-filters button\s*\{[^}]*border:\s*1px solid/,
    'critical gallery filters must reserve the final 1px border geometry');
  assert.equal(
    deferredCss.replace(/\r\n/g, '\n').trimEnd(),
    routeCss.replace(/\r\n/g, '\n').trimEnd(),
    'the preloaded public stylesheet must match the reviewed route presentation',
  );
  assert.match(routeCss, /--realizations-route-css:\s*1/);
  assert.match(routeCss, /\.realizations-hero-strip figure:nth-child\(n \+ 3\)/,
    'mobile route CSS must keep two distinct proof images in the initial viewport');
  assert.match(routeCss, /\.realizations-hero-strip\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    'the two mobile proof images must stay in a compact two-column composition');
  assert.match(routeCss, /body:has\(\.realizations-page\) \.whatsapp-btn[^{]*\{[^}]*display:\s*none !important;/,
    'mobile route CSS must keep the floating contact action away from realization content');

  const routeRoot = postcss.parse(routeCss, { from: 'app/realizacie/realizations-route.css' });
  let routeRules = 0;
  routeRoot.walkRules(() => { routeRules += 1; });
  assert.ok(routeRules > 80, `expected route CSS to retain the realizations presentation, got ${routeRules}`);

  for (const file of globalCssFiles) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      for (const selector of rule.selectors ?? []) {
        assert.equal(isRouteSelector(selector), false, `${file} still contains route-only selector: ${selector}`);
      }
    });
  }
});
