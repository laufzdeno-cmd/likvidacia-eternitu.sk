import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current acceptance matrix names only the latest immutable application checkpoint and evidence counts', async () => {
  const matrix = await readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8');

  assert.match(matrix, /commit `ae206c0f`/);
  assert.match(matrix, /\*\*349\/349 MJS \+ 24\/24 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.doesNotMatch(matrix, /5402285b|918477e5|302\/302|326\/326|346\/346|96\/96/);
});
