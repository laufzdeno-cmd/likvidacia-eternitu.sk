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

const currentRooferPrefixes = [
  '.roofer-b2b',
  '.roofer-registration',
  '.roofer-form',
  '.roofer-consent',
  '.roofer-checkbox',
  '.roofer-option',
  '.roofer-other',
];

const isLegacyRooferSelector = (selector) => {
  if (/\.(?:region-(?:map|choice|picker)|public-roofer-|empty-roofer-)/.test(selector)) return true;
  if (!selector.includes('.roofer-')) return false;
  return !currentRooferPrefixes.some((prefix) => selector.includes(prefix));
};

test('roofer-only presentation is owned by the /strechari route', () => {
  const page = readFileSync('app/strechari/page.tsx', 'utf8');
  const layout = readFileSync('app/strechari/layout.tsx', 'utf8');
  const routeCss = readFileSync('app/strechari/roofer-route.css', 'utf8');
  assert.match(layout, /import '\.\/roofer-route\.css'/);
  assert.doesNotMatch(page, /roofer\.module\.css|styles\.routeMarker/);
  assert.match(page, /<main className="roofer-b2b-page">/);
  assert.match(page, /<PublicWidgets hideWhatsappOnMobile \/>/,
    'the partner hero must not be covered by the floating WhatsApp control on narrow screens');
  assert.ok(page.indexOf('<div className="hero-actions">') < page.indexOf('<p className="roofer-b2b-hero-trust">'),
    'the primary partner action must precede supporting copy on the smallest viewport');
  assert.match(page, /aria-hidden="true" style=\{\{ marginInlineStart: '0\.45em' \}\}>→<\/span>/,
    'the desktop partner CTA arrow must not merge visually with the preceding word');
  assert.match(routeCss, /--roofer-route-css:\s*1/);
  assert.match(routeCss, /body:has\(main\.roofer-b2b-page\) \.cookie-banner/);

  const routeRoot = postcss.parse(routeCss, { from: 'app/strechari/roofer-route.css' });
  let routeRules = 0;
  routeRoot.walkRules(() => { routeRules += 1; });
  assert.ok(routeRules > 200, `expected the route bundle to retain all extracted rules, got ${routeRules}`);

  for (const file of globalCssFiles) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      const selectors = rule.selectors ?? [];
      const rooferOnly = selectors.length > 0 && selectors.every((selector) => selector.includes('.roofer-'));
      assert.equal(rooferOnly, false, `${file} still contains roofer-only selector: ${rule.selector}`);
      for (const selector of selectors) {
        assert.equal(isLegacyRooferSelector(selector), false, `${file} still contains an obsolete roofer selector: ${selector}`);
      }
    });
  }
});
