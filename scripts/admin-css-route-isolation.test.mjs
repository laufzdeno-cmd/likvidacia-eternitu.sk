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

const adminRule = (rule) => {
  const selectors = rule.selectors ?? [];
  return selectors.length > 0
    && selectors.every((selector) => /\.admin(?:-|\b)/.test(selector))
    && selectors.every((selector) => !selector.includes('.admin-pagination'));
};

test('admin-only CSS is route-owned and the shared photo portal pagination remains global', () => {
  const layout = readFileSync('app/admin/layout.tsx', 'utf8');
  const adminCss = readFileSync('app/admin/admin-route.css', 'utf8');
  assert.match(layout, /import '\.\/admin-route\.css'/);
  assert.match(adminCss, /--admin-route-css:\s*1/);
  assert.match(adminCss, /\.admin-shell/);
  assert.match(adminCss, /\.admin-login/);
  assert.doesNotMatch(adminCss, /\.admin-pagination/);

  let sharedPaginationFound = false;
  for (const file of globalCssFiles) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      assert.equal(adminRule(rule), false, `${file} still contains admin-only selector: ${rule.selector}`);
      if (rule.selector.includes('.admin-pagination')) sharedPaginationFound = true;
    });
  }
  assert.equal(sharedPaginationFound, true, 'photo intake pagination must retain shared styling');
});
