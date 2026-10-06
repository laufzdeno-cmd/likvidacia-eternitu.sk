import assert from 'node:assert/strict';
import test from 'node:test';
import { dedupeCssText } from './dedupe-exact-css.mjs';

test('odstráni iba staršiu identickú kópiu v rovnakom kontexte', () => {
  const source = '.a { color: red; }\n.b { color: blue; }\n.a { color: red; }\n';
  const result = dedupeCssText(source);
  assert.equal(result.removed.length, 1);
  assert.equal((result.css.match(/\.a \{/g) || []).length, 1);
  assert.match(result.css, /\.b \{ color: blue; \}/);
  assert.match(result.css, /\.a \{ color: red; \}\s*$/);
});

test('zachová rovnaké pravidlo v inom media kontexte a všetky keyframes', () => {
  const source = [
    '.a { color: red; }',
    '@media (max-width: 600px) { .a { color: red; } }',
    '@keyframes pulse { from { opacity: 0; } to { opacity: 1; } }',
    '@keyframes pulse-copy { from { opacity: 0; } to { opacity: 1; } }',
  ].join('\n');
  const result = dedupeCssText(source);
  assert.equal(result.removed.length, 0);
  assert.equal((result.css.match(/\.a \{/g) || []).length, 2);
  assert.equal((result.css.match(/from \{/g) || []).length, 2);
});

test('nezlúči podobné pravidlá, rozdielne poradie ani rozdielny important', () => {
  const source = [
    '.a { color: red; background: white; }',
    '.a { background: white; color: red; }',
    '.a { color: red !important; background: white; }',
    '.a, .b { color: red; background: white; }',
  ].join('\n');
  const result = dedupeCssText(source);
  assert.equal(result.removed.length, 0);
});

test('nezlúči selektory s rozdielnymi medzerami v citovanej hodnote', () => {
  const source = [
    '[data-label="a  b"] { color: red; }',
    '[data-label="a b"] { color: red; }',
  ].join('\n');
  const result = dedupeCssText(source);
  assert.equal(result.removed.length, 0);
  assert.match(result.css, /\[data-label="a  b"\]/);
  assert.match(result.css, /\[data-label="a b"\]/);
});
