import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current acceptance matrix names only the latest immutable application checkpoint and evidence counts', async () => {
  const [matrix, rawBuildEvidence] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-5eb585ee.json', import.meta.url), 'utf8'),
  ]);
  const buildEvidence = JSON.parse(rawBuildEvidence);

  assert.match(matrix, /commit `5eb585ee`/);
  assert.match(matrix, /\*\*366\/366 MJS \+ 32\/32 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.equal(buildEvidence.sourceCommit, '5eb585eeb9b6173d2a3002c0caa315675b355bd1');
  assert.equal(buildEvidence.sourceTree, '5fa98d7a88d52cb188a5b4eb37fafe41cefcdc16');
  assert.equal(buildEvidence.result, 'PASS');
  assert.equal(buildEvidence.buildId, 'AJ7BlBzKxDGqIzxiddIpg');
  assert.equal(buildEvidence.generatedRouteCount, 99);
  assert.equal(buildEvidence.staticSeoUrlCount, 32);
  assert.equal(buildEvidence.unitMjsCount, 366);
  assert.equal(buildEvidence.unitTypeScriptCount, 32);
  assert.equal(buildEvidence.databaseIntegrationCount, 8);
  assert.equal(buildEvidence.productionAccess, false);
  assert.equal(buildEvidence.temporaryDatabaseStopped, true);
  assert.equal(buildEvidence.temporaryDatabaseRemoved, true);
  assert.equal(buildEvidence.rollbackSourceCommit, 'c98c630c1af467c51c615980841630a4cabf6c29');
  assert.equal(buildEvidence.rollbackCompatibility, 'PASS');
  assert.equal(buildEvidence.independentReview, 'PASS');
  assert.equal(buildEvidence.securityDiffScan.coverage, 'complete');
  assert.equal(buildEvidence.securityDiffScan.scanId, 'b6501f8a-8a5f-4792-adbe-6fb19a99243b');
  assert.equal(buildEvidence.securityDiffScan.changedFilesReviewed, 11);
  assert.equal(buildEvidence.securityDiffScan.reportableFindings, 0);
  assert.equal(buildEvidence.browserReview.focusedMobile320, 'PASS');
  assert.equal(buildEvidence.browserReview.fullCurrentMatrix, 'PASS');
  assert.equal(buildEvidence.browserReview.routes, 20);
  assert.equal(buildEvidence.browserReview.viewportStates, 220);
  assert.equal(buildEvidence.browserReview.screenshots, 25);
  assert.equal(buildEvidence.browserReview.formsSubmitted, 0);
  assert.equal(buildEvidence.browserReview.blockedBrowserOrigins, 0);
  assert.equal(buildEvidence.browserReview.leadNoPhoto, 'PASS');
  assert.equal(buildEvidence.browserReview.leadTenPhotos, 'PASS');
  assert.equal(buildEvidence.browserReview.careerAndRoofer, 'PASS');
  assert.equal(buildEvidence.browserReview.testimonial, 'PASS');
  assert.equal(buildEvidence.browserReview.production, 'NOT_VERIFIED');
  assert.match(matrix, new RegExp(buildEvidence.securityDiffScan.scanId));
  assert.match(matrix, /úplnú browser maticu budúceho stagingového deploymentu/);
  assert.match(matrix, new RegExp(buildEvidence.buildId));
  assert.match(matrix, new RegExp('Najnovší samostatný zdrojový build checkpointu `5eb585ee` je `' + buildEvidence.buildId + '`'));
  assert.doesNotMatch(matrix, /Najnovší lokálny checkpoint[\s\S]{0,1000}`(?:35f93fa6|d6fd3268|293bf313)`/u);
  assert.match(matrix, /kompletná browser matica[^.\n]*\*\*PASS\*\*/iu);
  assert.match(matrix, /produkci(?:a|u)[^.\n]*\*\*NOT VERIFIED\*\*/iu);
  assert.doesNotMatch(matrix, /najnovší[^.\n]*`PbffkjJF2blfWHCZP2t5Z`/iu);
  assert.doesNotMatch(matrix, /f4f1eb31|0ed98252|ae206c0f|5402285b|918477e5|854fac66|302\/302|326\/326|346\/346|349\/349|351\/351|96\/96/);
});
