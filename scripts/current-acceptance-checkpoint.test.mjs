import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current acceptance matrix names only the latest immutable application checkpoint and evidence counts', async () => {
  const [matrix, rawBuildEvidence] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-f4f1eb31.json', import.meta.url), 'utf8'),
  ]);
  const buildEvidence = JSON.parse(rawBuildEvidence);

  assert.match(matrix, /commit `f4f1eb31`/);
  assert.match(matrix, /\*\*351\/351 MJS \+ 24\/24 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.equal(buildEvidence.sourceCommit, 'f4f1eb31db5e8c924eb3f436b6f7236ff68ead17');
  assert.equal(buildEvidence.sourceTree, '600837ce9762ce9280436e5225170c65b8ae924d');
  assert.equal(buildEvidence.result, 'PASS');
  assert.equal(buildEvidence.buildId, 'vsB5ZB3zmEVcyjWtZx5R2');
  assert.equal(buildEvidence.generatedRouteCount, 99);
  assert.equal(buildEvidence.staticSeoUrlCount, 32);
  assert.equal(buildEvidence.productionAccess, false);
  assert.equal(buildEvidence.temporaryDatabaseStopped, true);
  assert.equal(buildEvidence.temporaryDatabaseRemoved, true);
  assert.equal(buildEvidence.rollbackSourceCommit, 'c98c630c1af467c51c615980841630a4cabf6c29');
  assert.equal(buildEvidence.rollbackCompatibility, 'PASS');
  assert.equal(buildEvidence.independentReview, 'PASS x2');
  assert.match(matrix, new RegExp(buildEvidence.buildId));
  assert.doesNotMatch(matrix, /0ed98252|ae206c0f|5402285b|918477e5|302\/302|326\/326|346\/346|349\/349|96\/96/);
});
