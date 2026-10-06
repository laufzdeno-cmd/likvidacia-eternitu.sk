import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

test('homepage presentation is route-scoped and absent from the final shared polish layer', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const shared = readFileSync('src/final-visual-polish.css', 'utf8');
  const criticalCss = readFileSync('app/home-critical.css', 'utf8');
  const deferredCss = readFileSync('public/assets/home-below-fold.css', 'utf8');
  const routeCss = `${criticalCss}\n${deferredCss}`;
  assert.match(page, /import '\.\/home-critical\.css'/);
  assert.match(criticalCss, /--home-route-css:\s*1/);
  for (const criticalClass of ['hero-photo', 'quote-card', 'price-calculator-section', 'included-group-card']) {
    assert.match(routeCss, new RegExp(`\\.${criticalClass}\\b`));
    assert.doesNotMatch(shared, new RegExp(`\\.${criticalClass}\\b`));
  }

  const root = postcss.parse(routeCss, { from: 'homepage route CSS layers' });
  let rules = 0;
  root.walkRules(() => { rules += 1; });
  assert.ok(rules > 450, `expected a substantial homepage-only layer, got ${rules} rules`);
});
