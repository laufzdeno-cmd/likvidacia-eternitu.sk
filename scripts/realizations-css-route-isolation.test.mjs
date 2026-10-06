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
  assert.match(layout, /import '\.\/realizations-route\.css'/);
  assert.match(routeCss, /--realizations-route-css:\s*1/);
  assert.match(routeCss, /\.realizations-hero-strip figure:nth-child\(n \+ 2\)/,
    'mobile route CSS must keep only the first proof image in the initial viewport');
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
