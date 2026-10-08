import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current acceptance matrix names only the latest immutable application checkpoint and evidence counts', async () => {
  const [matrix, rawBuildEvidence] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-293bf313.json', import.meta.url), 'utf8'),
  ]);
  const buildEvidence = JSON.parse(rawBuildEvidence);

  assert.match(matrix, /commit `293bf313`/);
  assert.match(matrix, /\*\*362\/362 MJS \+ 28\/28 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.equal(buildEvidence.sourceCommit, '293bf313507b2b97151ea7ccd9159a418e91ec24');
  assert.equal(buildEvidence.sourceTree, '0607ee3c3b26ab553983e784a663767030f8bf47');
  assert.equal(buildEvidence.result, 'PASS');
  assert.equal(buildEvidence.buildId, 'D0Ikz1z3st4RBFzGf51_5');
  assert.equal(buildEvidence.generatedRouteCount, 99);
  assert.equal(buildEvidence.staticSeoUrlCount, 32);
  assert.equal(buildEvidence.unitMjsCount, 362);
  assert.equal(buildEvidence.unitTypeScriptCount, 28);
  assert.equal(buildEvidence.databaseIntegrationCount, 8);
  assert.equal(buildEvidence.productionAccess, false);
  assert.equal(buildEvidence.temporaryDatabaseStopped, true);
  assert.equal(buildEvidence.temporaryDatabaseRemoved, true);
  assert.equal(buildEvidence.rollbackSourceCommit, 'c98c630c1af467c51c615980841630a4cabf6c29');
  assert.equal(buildEvidence.rollbackCompatibility, 'PASS');
  assert.equal(buildEvidence.independentReview, 'PASS');
  assert.equal(buildEvidence.browserReview.focusedMobile320, 'PASS');
  assert.equal(buildEvidence.browserReview.fullCurrentMatrix, 'NOT_RERUN');
  assert.equal(buildEvidence.browserReview.production, 'NOT_VERIFIED');
  assert.match(matrix, new RegExp(buildEvidence.buildId));
  assert.match(matrix, new RegExp('Najnovší samostatný zdrojový build checkpointu `293bf313` je `' + buildEvidence.buildId + '`'));
  assert.doesNotMatch(matrix, /Najnovší lokálny checkpoint[\s\S]{0,1000}`d6fd3268`/u);
  assert.match(matrix, /kompletná browser matica[^.\n]*\*\*NOT RERUN\*\*/iu);
  assert.match(matrix, /produkci(?:a|u)[^.\n]*\*\*NOT VERIFIED\*\*/iu);
  assert.doesNotMatch(matrix, /najnovší[^.\n]*`PbffkjJF2blfWHCZP2t5Z`/iu);
  assert.doesNotMatch(matrix, /f4f1eb31|0ed98252|ae206c0f|5402285b|918477e5|854fac66|302\/302|326\/326|346\/346|349\/349|351\/351|96\/96/);
});
