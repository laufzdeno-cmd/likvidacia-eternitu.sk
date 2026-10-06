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

const isProcessRouteSelector = (selector) =>
  /\.postup-process(?:-|\b)/.test(selector)
  || /:has\(\.postup-process-page\)/.test(selector);

test('process-page presentation is owned by the /postup route', () => {
  const page = readFileSync('app/postup/page.tsx', 'utf8');
  const layout = readFileSync('app/postup/layout.tsx', 'utf8');
  const routeCss = readFileSync('app/postup/postup-route.css', 'utf8');
  const buildHarness = readFileSync('scripts/photo-intake-browser.integration.mjs', 'utf8');

  assert.match(page, /<main className="seo-page postup-process-page"/);
  assert.match(layout, /import '\.\/postup-route\.css'/);
  assert.match(routeCss, /--postup-route-css:\s*1/);
  assert.match(routeCss, /body:has\(\.postup-process-page\) \.whatsapp-btn/);
  assert.match(buildHarness, /processCssLoadedOnlyOnProcess:\s*true/);
  assert.match(buildHarness, /--postup-route-css/);

  const routeRoot = postcss.parse(routeCss, { from: 'app/postup/postup-route.css' });
  let routeRules = 0;
  routeRoot.walkRules((rule) => {
    if (rule.selector !== ':root') routeRules += 1;
  });
  assert.equal(routeRules, 120, `expected all 120 process-page rules, got ${routeRules}`);

  for (const file of globalCssFiles) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      for (const selector of rule.selectors ?? []) {
        assert.equal(
          isProcessRouteSelector(selector),
          false,
          `${file} still contains process-route selector: ${selector}`,
        );
      }
    });
  }
});
