import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current acceptance matrix names only the latest immutable application checkpoint and evidence counts', async () => {
  const [matrix, rawBuildEvidence] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-d6fd3268.json', import.meta.url), 'utf8'),
  ]);
  const buildEvidence = JSON.parse(rawBuildEvidence);

  assert.match(matrix, /commit `d6fd3268`/);
  assert.match(matrix, /\*\*356\/356 MJS \+ 24\/24 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.equal(buildEvidence.sourceCommit, 'd6fd3268679a7c0c37482e26fbee02aa5e0ec019');
  assert.equal(buildEvidence.sourceTree, '5fd5629a2eef1d3aed2590c67dd2c4bcc8293c0f');
  assert.equal(buildEvidence.result, 'PASS');
  assert.equal(buildEvidence.buildId, 'Ln09kj6_3dgzCiW5Ny2pa');
  assert.equal(buildEvidence.generatedRouteCount, 99);
  assert.equal(buildEvidence.staticSeoUrlCount, 32);
  assert.equal(buildEvidence.productionAccess, false);
  assert.equal(buildEvidence.temporaryDatabaseStopped, true);
  assert.equal(buildEvidence.temporaryDatabaseRemoved, true);
  assert.equal(buildEvidence.rollbackSourceCommit, 'c98c630c1af467c51c615980841630a4cabf6c29');
  assert.equal(buildEvidence.rollbackCompatibility, 'PASS');
  assert.equal(buildEvidence.independentReview, 'PASS');
  assert.match(matrix, new RegExp(buildEvidence.buildId));
  assert.match(matrix, new RegExp('Najnovší samostatný zdrojový build checkpointu `d6fd3268` je `' + buildEvidence.buildId + '`'));
  assert.doesNotMatch(matrix, /najnovší[^.\n]*`PbffkjJF2blfWHCZP2t5Z`/iu);
  assert.doesNotMatch(matrix, /f4f1eb31|0ed98252|ae206c0f|5402285b|918477e5|854fac66|302\/302|326\/326|346\/346|349\/349|351\/351|96\/96/);
});
