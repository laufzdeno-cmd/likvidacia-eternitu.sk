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

const isReviewsRouteSelector = (selector) => /\.(?:testimonial-(?:public(?:-|\b)|star-)|reviews-(?:page|intro|context)\b|review-(?:form-(?:panel|kicker)|request-body)\b)/.test(selector);

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
  const selectors = new Set();
  routeRoot.walkRules((rule) => {
    for (const selector of rule.selectors) {
      selectors.add(selector);
      assert.ok(selector === ':root' || isReviewsRouteSelector(selector), `unscoped route selector: ${selector}`);
    }
    if (rule.selector === ':root') rule.walkDecls((declaration) => {
      assert.equal(declaration.prop, '--reviews-route-css', 'only the route-load marker may escape the review scope');
    });
  });
  for (const selector of ['.testimonial-public-form', '.testimonial-public-grid', '.testimonial-public-card', '.testimonial-public-consent', '.testimonial-public-honeypot', '.testimonial-star-option']) {
    assert.ok([...selectors].some(value => value.includes(selector)), `required presentation context is missing: ${selector}`);
  }
  const mobile = routeRoot.nodes.find((node) => node.type === 'atrule' && node.name === 'media' && node.params === '(max-width: 640px)');
  assert.ok(mobile, 'reviews need a narrow-screen layout');
  assert.ok(mobile.nodes.some((rule) => rule.selectors?.includes('.testimonial-public-form')
    && rule.nodes.some((declaration) => declaration.prop === 'grid-template-columns' && declaration.value === 'minmax(0, 1fr)')),
  'the form must become one column on narrow screens');

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
