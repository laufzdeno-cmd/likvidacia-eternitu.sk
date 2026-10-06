import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [page, formClient, routeCss, styles, premium, finalPolish, hotfix, buildHarness] = await Promise.all([
  readFile(new URL('../app/kariera/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/career-form-client.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/kariera/career.module.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/premium-overrides.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/final-visual-polish.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/responsive-audit-hotfix.css', import.meta.url), 'utf8'),
  readFile(new URL('./photo-intake-browser.integration.mjs', import.meta.url), 'utf8'),
]);

test('career presentation is loaded only by the career route', () => {
  assert.match(page, /import styles from '\.\/career\.module\.css';/);
  assert.match(formClient, /import styles from '\.\/kariera\/career\.module\.css';/);
  assert.match(routeCss, /--career-route-css:\s*1/);
  for (const selector of [
    '.page', '.hero', '.expectations', '.applicationSection', '.applicationForm',
    '.formGrid', '.checks', '.submit', '.faq',
  ]) assert.ok(routeCss.includes(selector), `${selector} must remain in the route-only stylesheet`);
  assert.doesNotMatch(styles, /\.career-/);
  assert.doesNotMatch(premium, /\.career-/);
  assert.doesNotMatch(finalPolish, /\.career-/);
});

test('career mobile WhatsApp collision guard remains available without leaking realizations CSS', () => {
  assert.match(hotfix, /body:has\(\.career-page\) \.whatsapp-btn/);
  assert.doesNotMatch(hotfix, /body:has\(\.realizations-page\) \.whatsapp-btn/);
});

test('isolated production build verifies the actual route CSS chunks', () => {
  assert.match(buildHarness, /readBuiltRouteCssSource/);
  assert.match(buildHarness, /careerCssLoadedOnlyOnCareer/);
  assert.match(buildHarness, /--career-route-css/);
  assert.match(buildHarness, /must not load career-only presentation CSS/);
});
