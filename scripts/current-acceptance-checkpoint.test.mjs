import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current acceptance matrix names only the latest immutable application checkpoint and evidence counts', async () => {
  const [matrix, rawBuildEvidence, rawVisualEvidence] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-452c4f75.json', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/VISUAL-EVIDENCE-SUMMARY-452c4f75.json', import.meta.url), 'utf8'),
  ]);
  const buildEvidence = JSON.parse(rawBuildEvidence);
  const visualEvidence = JSON.parse(rawVisualEvidence);

  assert.match(matrix, /commit `452c4f75`/);
  assert.match(matrix, /\*\*369\/369 MJS \+ 32\/32 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.equal(buildEvidence.sourceCommit, '452c4f75c7ab0f976d6e4b19099afdb9aa1428b7');
  assert.equal(buildEvidence.sourceTree, '46e883535b1d7fcd83ae9bac2559ab32b13dec7b');
  assert.equal(buildEvidence.result, 'PASS');
  assert.equal(buildEvidence.buildId, 'kU2ps9Dzy-l05aYdXXEIC');
  assert.equal(buildEvidence.generatedRouteCount, 99);
  assert.equal(buildEvidence.staticSeoUrlCount, 32);
  assert.equal(buildEvidence.unitMjsCount, 369);
  assert.equal(buildEvidence.unitTypeScriptCount, 32);
  assert.equal(buildEvidence.databaseIntegrationCount, 8);
  assert.equal(buildEvidence.productionAccess, false);
  assert.equal(buildEvidence.temporaryDatabaseStopped, true);
  assert.equal(buildEvidence.temporaryDatabaseRemoved, true);
  assert.equal(buildEvidence.rollbackSourceCommit, 'c98c630c1af467c51c615980841630a4cabf6c29');
  assert.equal(buildEvidence.rollbackCompatibility, 'PASS_UNCHANGED_FROM_5eb585ee');
  assert.equal(buildEvidence.independentReview, 'PASS');
  assert.equal(buildEvidence.securityDiffScan.coverage, 'complete');
  assert.equal(buildEvidence.securityDiffScan.scanId, '5663c1b9-2716-46fe-9fc8-717cc00f27cd');
  assert.equal(buildEvidence.securityDiffScan.artifactFolder, '452c4f75c7ab0f976d6e4b19099afdb9aa1428b7_20261008T043146Z_or507pst');
  assert.equal(buildEvidence.securityDiffScan.changedFilesReviewed, 28);
  assert.equal(buildEvidence.securityDiffScan.reportableFindings, 0);
  assert.equal(buildEvidence.browserReview.fullCurrentMatrix, 'PASS');
  assert.equal(buildEvidence.browserReview.routes, 20);
  assert.equal(buildEvidence.browserReview.viewports, 11);
  assert.equal(buildEvidence.browserReview.viewportStates, 220);
  assert.equal(buildEvidence.browserReview.screenshots, 25);
  assert.equal(buildEvidence.browserReview.formsSubmitted, 0);
  assert.equal(buildEvidence.browserReview.hydrationErrors, 0);
  assert.equal(buildEvidence.browserReview.blockedBrowserOrigins, 0);
  assert.equal(buildEvidence.browserReview.trackedDiffSha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(buildEvidence.browserReview.untrackedFileCount, 0);
  assert.equal(buildEvidence.browserReview.leadNoPhoto, 'PASS_UNCHANGED_FROM_5eb585ee');
  assert.equal(buildEvidence.browserReview.leadTenPhotos, 'PASS_UNCHANGED_FROM_5eb585ee');
  assert.equal(buildEvidence.browserReview.careerAndRoofer, 'PASS_UNCHANGED_FROM_5eb585ee');
  assert.equal(buildEvidence.browserReview.testimonial, 'PASS_UNCHANGED_FROM_5eb585ee');
  assert.equal(buildEvidence.browserReview.production, 'NOT_VERIFIED');
  assert.equal(buildEvidence.browserReview.evidenceSummary, 'docs/upgrade-2026-09-30/VISUAL-EVIDENCE-SUMMARY-452c4f75.json');
  assert.equal(buildEvidence.browserReview.rawManifestSha256, visualEvidence.rawManifest.sha256);
  assert.equal(visualEvidence.sourceCommit, buildEvidence.sourceCommit);
  assert.equal(visualEvidence.sourceTree, buildEvidence.sourceTree);
  assert.equal(visualEvidence.result, 'PASS');
  assert.equal(visualEvidence.routes.length, buildEvidence.browserReview.routes);
  assert.equal(visualEvidence.viewports.length, buildEvidence.browserReview.viewports);
  assert.equal(visualEvidence.routes.length * visualEvidence.viewports.length, visualEvidence.matrix.stateCount);
  assert.equal(visualEvidence.matrix.stateCount, buildEvidence.browserReview.viewportStates);
  assert.equal(visualEvidence.screenshots, buildEvidence.browserReview.screenshots);
  assert.equal(visualEvidence.verification.formsSubmitted, buildEvidence.browserReview.formsSubmitted);
  assert.equal(visualEvidence.verification.hydrationErrors, buildEvidence.browserReview.hydrationErrors);
  assert.equal(visualEvidence.verification.blockedBrowserOrigins, buildEvidence.browserReview.blockedBrowserOrigins);
  assert.equal(visualEvidence.cleanSource.trackedDiffSha256, buildEvidence.browserReview.trackedDiffSha256);
  assert.equal(visualEvidence.cleanSource.untrackedFileCount, buildEvidence.browserReview.untrackedFileCount);
  assert.equal(visualEvidence.production, 'NOT_VERIFIED');
  assert.match(matrix, new RegExp(buildEvidence.securityDiffScan.scanId));
  assert.match(matrix, /úplnú browser maticu budúceho stagingového deploymentu/);
  assert.match(matrix, new RegExp(buildEvidence.buildId));
  assert.match(matrix, new RegExp('Najnovší samostatný zdrojový build checkpointu `452c4f75` je `' + buildEvidence.buildId + '`'));
  assert.doesNotMatch(matrix, /Najnovší lokálny checkpoint[\s\S]{0,1000}`(?:35f93fa6|d6fd3268|293bf313)`/u);
  assert.match(matrix, /čistá browser matica presného commitu je \*\*PASS\*\*/iu);
  assert.match(matrix, /produkci(?:a|u)[^.\n]*\*\*NOT VERIFIED\*\*/iu);
  assert.doesNotMatch(matrix, /najnovší[^.\n]*`PbffkjJF2blfWHCZP2t5Z`/iu);
  assert.doesNotMatch(matrix, /f4f1eb31|0ed98252|ae206c0f|5402285b|918477e5|854fac66|302\/302|326\/326|346\/346|349\/349|351\/351|96\/96/);
});
