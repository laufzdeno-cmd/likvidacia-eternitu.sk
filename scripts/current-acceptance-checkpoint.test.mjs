import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current acceptance matrix names only the latest immutable application checkpoint and evidence counts', async () => {
  const [matrix, rawBuildEvidence] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-0ed98252.json', import.meta.url), 'utf8'),
  ]);
  const buildEvidence = JSON.parse(rawBuildEvidence);

  assert.match(matrix, /commit `0ed98252`/);
  assert.match(matrix, /\*\*351\/351 MJS \+ 24\/24 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.equal(buildEvidence.sourceCommit, '0ed98252e3b2c0783df51b4c9f6e6d2ed277d6c0');
  assert.equal(buildEvidence.result, 'PASS');
  assert.equal(buildEvidence.buildId, '4ey56w9UMb8HOU0p4vWan');
  assert.equal(buildEvidence.generatedRouteCount, 99);
  assert.equal(buildEvidence.staticSeoUrlCount, 32);
  assert.equal(buildEvidence.productionAccess, false);
  assert.equal(buildEvidence.temporaryDatabaseStopped, true);
  assert.equal(buildEvidence.temporaryDatabaseRemoved, true);
  assert.match(matrix, new RegExp(buildEvidence.buildId));
  assert.doesNotMatch(matrix, /ae206c0f|5402285b|918477e5|302\/302|326\/326|346\/346|349\/349|96\/96/);
});
