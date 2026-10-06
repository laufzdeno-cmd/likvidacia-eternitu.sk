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

const routeOnlyClassNames = [
  'photo-intake-page',
  'photo-intake-content',
  'photo-intake-eyebrow',
  'photo-intake-intro',
  'photo-intake-login',
  'photo-intake-uploader',
  'photo-intake-toolbar',
  'photo-intake-file-picker',
  'photo-intake-draft',
  'photo-intake-draft-title',
  'photo-intake-draft-content',
  'photo-intake-draft-fields',
  'photo-intake-preview',
  'photo-intake-preview-fallback',
  'photo-intake-tags',
  'photo-intake-history',
  'photo-intake-history-edit',
  'photo-intake-grid',
];

const routeOnlySelector = new RegExp(`\\.(?:${routeOnlyClassNames.join('|')})(?:-|\\b)`);

test('private photo-intake presentation is owned by /spolupraca/fotky without taking admin rules', () => {
  const page = readFileSync('app/spolupraca/fotky/page.tsx', 'utf8');
  const client = readFileSync('app/spolupraca/fotky/photo-intake-client.tsx', 'utf8');
  const layout = readFileSync('app/spolupraca/fotky/layout.tsx', 'utf8');
  const routeCss = readFileSync('app/spolupraca/fotky/photo-intake-route.css', 'utf8');
  const globalCss = readFileSync('src/styles.css', 'utf8');
  const adminPage = readFileSync('app/admin/(protected)/realizacie/fotky/page.tsx', 'utf8');
  const buildHarness = readFileSync('scripts/photo-intake-browser.integration.mjs', 'utf8');

  assert.match(page, /photo-intake-page/);
  assert.match(client, /photo-intake-uploader/);
  assert.match(layout, /import '\.\/photo-intake-route\.css'/);
  assert.match(routeCss, /--photo-intake-route-css:\s*1/);
  assert.match(buildHarness, /photoIntakeCssLoadedOnlyOnPrivatePortal:\s*true/);
  assert.match(buildHarness, /--photo-intake-route-css/);

  const routeRoot = postcss.parse(routeCss, { from: 'app/spolupraca/fotky/photo-intake-route.css' });
  const topLevel = routeRoot.nodes.map((node) => node.type === 'atrule' ? `@${node.name} ${node.params}` : node.selector);
  assert.equal(topLevel[0], ':root', 'the route marker must remain first');
  assert.equal(topLevel.at(-1), '@media (max-width: 640px)', 'the original mobile override must remain last');
  assert.equal(routeRoot.nodes.filter((node) => node.type === 'atrule').length, 1, 'keep one original mobile media query');

  routeRoot.walkRules((rule) => {
    if (rule.selector === ':root') return;
    assert.doesNotMatch(rule.selector, /\.photo-admin-/, `admin selector leaked into private route CSS: ${rule.selector}`);
    assert.match(rule.selector, /\.photo-intake-/, `unexpected selector in private route CSS: ${rule.selector}`);
  });

  for (const file of globalCssFiles) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      for (const selector of rule.selectors ?? []) {
        assert.equal(routeOnlySelector.test(selector), false, `${file} still contains private-route selector: ${selector}`);
      }
    });
  }

  for (const sharedClass of ['photo-intake-notice', 'photo-intake-actions', 'photo-intake-quiet', 'photo-intake-pending', 'photo-intake-error', 'photo-intake-metadata-form']) {
    assert.match(adminPage + globalCss, new RegExp(sharedClass), `${sharedClass} must remain available to the admin route`);
    assert.match(globalCss, new RegExp(`\\.${sharedClass}(?:[-\\s:.,>{]|$)`), `${sharedClass} styling must remain global for admin`);
  }
});
