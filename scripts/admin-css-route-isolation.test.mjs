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

test('final mobile admin cascade wins over the late 200px desktop sidebar', () => {
  const adminCss = readFileSync('app/admin/admin-route.css', 'utf8');
  const root = postcss.parse(adminCss, { from: 'app/admin/admin-route.css' });
  const topLevelNodes = root.nodes ?? [];

  const desktopSidebarRule = topLevelNodes.findLast((node) => (
    node.type === 'rule'
    && node.selectors?.includes('.admin-sidebar')
    && node.nodes?.some((child) => child.type === 'decl' && child.prop === 'width' && child.value === '200px' && child.important)
  ));
  const finalMobileShell = topLevelNodes.findLast((node) => (
    node.type === 'atrule'
    && node.name === 'media'
    && /max-width:\s*900px/.test(node.params)
  ));
  assert.ok(desktopSidebarRule, 'desktop admin sidebar must retain its 200px width');
  assert.ok(finalMobileShell, 'a final 900px mobile cascade must exist');
  assert.ok(
    topLevelNodes.indexOf(finalMobileShell) > topLevelNodes.indexOf(desktopSidebarRule),
    'the mobile cascade must come after the late desktop sidebar rule',
  );

  const findRule = (container, selector, property) => {
    let result = null;
    container.walkRules((rule) => {
      if (
        rule.selectors?.includes(selector)
        && (!property || rule.nodes?.some((node) => node.type === 'decl' && node.prop === property))
      ) result = rule;
    });
    return result;
  };
  const declaration = (rule, property) => rule?.nodes?.find((node) => node.type === 'decl' && node.prop === property);
  const mobileShellRule = findRule(finalMobileShell, '.admin-shell', 'grid-template-columns');
  const mobileSidebarRule = findRule(finalMobileShell, '.admin-sidebar', 'width');
  const mobileMainMinWidthRule = findRule(finalMobileShell, '.admin-main', 'min-width');
  const mobileMainMaxWidthRule = findRule(finalMobileShell, '.admin-main', 'max-width');
  const mobileTableRule = findRule(finalMobileShell, '.admin-table-wrap', 'overflow-x');
  const mobileFilterRule = findRule(finalMobileShell, '.admin-filter-bar', 'grid-template-columns');

  assert.equal(declaration(mobileShellRule, 'grid-template-columns')?.value, 'minmax(0, 1fr)');
  assert.equal(declaration(mobileSidebarRule, 'width')?.value, '100%');
  assert.equal(declaration(mobileSidebarRule, 'max-width')?.value, '100%');
  assert.equal(declaration(mobileMainMinWidthRule, 'min-width')?.value, '0');
  assert.equal(declaration(mobileMainMaxWidthRule, 'max-width')?.value, '100%');
  assert.equal(declaration(mobileTableRule, 'overflow-x')?.value, 'auto');
  assert.equal(declaration(mobileFilterRule, 'grid-template-columns')?.value, 'minmax(0, 1fr)');

  const compactMobile = topLevelNodes.findLast((node) => (
    node.type === 'atrule'
    && node.name === 'media'
    && /max-width:\s*480px/.test(node.params)
  ));
  assert.ok(compactMobile, 'compact admin controls need a 480px safeguard');
  assert.ok(topLevelNodes.indexOf(compactMobile) > topLevelNodes.indexOf(finalMobileShell));
  assert.equal(
    declaration(findRule(compactMobile, '.admin-sidebar nav'), 'grid-template-columns')?.value,
    'minmax(0, 1fr)',
  );
  assert.equal(declaration(findRule(compactMobile, '.admin-action-row > *'), 'width')?.value, '100%');
});
