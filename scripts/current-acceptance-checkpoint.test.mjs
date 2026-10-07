import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current acceptance matrix names only the latest immutable application checkpoint and evidence counts', async () => {
  const matrix = await readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8');

  assert.match(matrix, /commit `5402285b`/);
  assert.match(matrix, /\*\*346\/346 MJS \+ 24\/24 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.doesNotMatch(matrix, /918477e5|302\/302|326\/326|96\/96/);
});
