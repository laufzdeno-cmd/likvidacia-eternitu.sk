import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

const criticalCss = readFileSync('app/realizacie/realizations-critical.css', 'utf8');
const deferredCss = readFileSync('public/assets/realizations-below-fold.css', 'utf8');
const page = readFileSync('app/realizacie/page.tsx', 'utf8');

function declarationsForMobileSelector(root, selector) {
  const declarations = new Map();

  root.walkAtRules('media', (media) => {
    if (!/max-width:\s*760px/.test(media.params)) return;

    media.walkRules(selector, (rule) => {
      rule.walkDecls((declaration) => {
        declarations.set(declaration.prop, {
          value: declaration.value,
          important: declaration.important,
        });
      });
    });
  });

  return declarations;
}

test('mobile realization filters stay in one accessible horizontal row', () => {
  const criticalRoot = postcss.parse(criticalCss, { from: 'app/realizacie/realizations-critical.css' });
  const mobileFilters = declarationsForMobileSelector(criticalRoot, '.realizations-page .gallery-filters');
  const mobileButtons = declarationsForMobileSelector(criticalRoot, '.realizations-page .gallery-filters button');
  const mobileFocus = declarationsForMobileSelector(criticalRoot, '.realizations-page .gallery-filters button:focus-visible');

  assert.deepEqual(mobileFilters.get('flex-wrap'), { value: 'nowrap', important: true });
  assert.deepEqual(mobileFilters.get('justify-content'), { value: 'flex-start', important: true });
  assert.equal(mobileFilters.get('overflow-x')?.value, 'auto');
  assert.equal(mobileFilters.get('overscroll-behavior-inline')?.value, 'contain');
  assert.match(mobileFilters.get('scroll-snap-type')?.value ?? '', /inline\s+proximity/);
  assert.equal(mobileButtons.get('flex')?.value, '0 0 auto');
  assert.equal(mobileButtons.get('white-space')?.value, 'nowrap');
  assert.match(mobileFocus.get('outline')?.value ?? '', /^3px\s+solid\s+/);
  assert.equal(mobileFocus.get('outline-offset')?.value, '2px');

  assert.match(criticalCss, /\.gallery-filters\s*\{[^}]*flex-wrap:\s*wrap;/s,
    'desktop critical filters must keep their wrapping layout');
  assert.match(deferredCss, /\.gallery-filters\s*\{[^}]*flex-wrap:\s*wrap;/s,
    'desktop deferred filters must keep their wrapping layout');
  assert.match(page, /data-gallery-filter=\{category\.key\}/,
    'the existing gallery filtering contract must remain unchanged');
  assert.match(page, /aria-pressed=\{category\.key === 'vsetko'\}/,
    'filter buttons must keep their accessible pressed state');
});
