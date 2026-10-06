import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./lead-private-blob-browser.integration.mjs', import.meta.url), 'utf8');

test('visual evidence export is opt-in, path-bounded and lossless', () => {
  assert.match(source, /ASTANA_HARNESS_VISUAL_EVIDENCE_LABEL/);
  assert.match(source, /\^\[a-z0-9-\]\{1,40\}\$/);
  assert.match(source, /'tmp', 'visual-evidence-exports', visualEvidenceLabel/);
  assert.match(source, /visual evidence label already exists and must not be overwritten/);
  assert.match(source, /trackedDiffSha256/);
  assert.match(source, /untrackedFilesSha256/);
  assert.match(source, /browser: page\.context\(\)\.browser\(\)\?\.version\(\)/);
  assert.match(source, /manifest\.json/);
  assert.match(source, /computedStyleSnapshots/);
  assert.match(source, /\.career-form-grid input:focus/);
  assert.match(source, /route: 'home'/);
  assert.match(source, /'\.hero', '\.hero-copy', '\.hero-photo', '\.hero-photo img', '\.quote-card'/);
  assert.match(source, /'\.price-calculator-section', '\.included-group-card'/);
  assert.match(source, /\{ width: 760, height: 900 \}, \{ width: 761, height: 900 \}/);
  assert.match(source, /flag: 'wx'/);
  assert.match(source, /type: 'png'/);
  assert.doesNotMatch(source, /visual-evidence[^\n]+type: 'jpeg'/);
  assert.match(source, /reducedMotion: 'reduce'/);
  assert.match(source, /deviceScaleFactor: 1/);
  assert.match(source, /transition-duration: 0s !important/);
});
