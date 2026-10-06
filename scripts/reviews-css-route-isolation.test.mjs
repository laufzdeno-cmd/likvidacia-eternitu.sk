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

const isReviewsRouteSelector = (selector) => /\.testimonial-public(?:-|\b)/.test(selector);

test('reviews-only presentation is owned by the /recenzie route', () => {
  const page = readFileSync('app/recenzie/page.tsx', 'utf8');
  const form = readFileSync('app/recenzie/testimonial-form.tsx', 'utf8');
  const layout = readFileSync('app/recenzie/layout.tsx', 'utf8');
  const routeCss = readFileSync('app/recenzie/reviews-route.css', 'utf8');
  const buildHarness = readFileSync('scripts/photo-intake-browser.integration.mjs', 'utf8');

  assert.match(page, /testimonial-public-list/);
  assert.match(page, /testimonial-public-grid/);
  assert.match(form, /testimonial-public-form/);
  assert.match(layout, /import '\.\/reviews-route\.css'/);
  assert.match(routeCss, /--reviews-route-css:\s*1/);
  assert.match(buildHarness, /reviewsCssLoadedOnlyOnReviews:\s*true/);
  assert.match(buildHarness, /--reviews-route-css/);

  const routeRoot = postcss.parse(routeCss, { from: 'app/recenzie/reviews-route.css' });
  let routeRules = 0;
  routeRoot.walkRules(() => { routeRules += 1; });
  assert.equal(routeRules, 18, `expected the marker and all 17 reviews-page rules, got ${routeRules}`);
  assert.deepEqual(
    routeRoot.nodes.map((node) => node.type === 'atrule' ? `@${node.name} ${node.params}` : node.selector),
    [
      ':root',
      '.testimonial-public-list',
      '.testimonial-public-grid',
      '.testimonial-public-card',
      '.testimonial-public-card blockquote',
      '.testimonial-public-rating',
      '.testimonial-public-form',
      '.testimonial-public-form label',
      '.testimonial-public-form input:not([type="checkbox"]), .testimonial-public-form select, .testimonial-public-form textarea',
      '.testimonial-public-form textarea',
      '.testimonial-public-wide',
      '.testimonial-public-consent',
      '.testimonial-public-consent input',
      '.testimonial-public-honeypot',
      '.testimonial-public-privacy, .testimonial-public-message',
      '.testimonial-public-message.is-error',
      '@media (max-width: 640px)',
    ],
    'reviews rules and the mobile media query must keep their original order',
  );

  for (const file of globalCssFiles) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      for (const selector of rule.selectors ?? []) {
        assert.equal(
          isReviewsRouteSelector(selector),
          false,
          `${file} still contains reviews-route selector: ${selector}`,
        );
      }
    });
  }
});
