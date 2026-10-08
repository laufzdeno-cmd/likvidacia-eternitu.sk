import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('acceptance evidence distinguishes the current application and QA checkpoints from the historical visual baseline', async () => {
  const [matrix, rawCurrentEvidence, rawBaselineBuild, rawBaselineVisual] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-5587258c.json', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-452c4f75.json', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/VISUAL-EVIDENCE-SUMMARY-452c4f75.json', import.meta.url), 'utf8'),
  ]);
  const current = JSON.parse(rawCurrentEvidence);
  const baselineBuild = JSON.parse(rawBaselineBuild);
  const baselineVisual = JSON.parse(rawBaselineVisual);

  assert.equal(current.applicationCommit, '5587258cc20c740d54bd57cb7cce5badd4166c03');
  assert.equal(current.applicationTree, 'c391dfe3ea8022a15ee019daf9e1be7073fc6bb4');
  assert.equal(current.qaCommit, '439f75dcae5b6f536cfcd6ca04204903eccdf4ee');
  assert.equal(current.qaTree, 'f3933874879d7ed0bdd0c1b4706f48eee071f148');
  assert.equal(current.visualEvidenceCommit, '088ac8f3a0f83211a9337a7cdbb8565620e531fe');
  assert.equal(current.visualEvidenceTree, '033816e5f6fb61056a500b0e7aee026b2b7aa887');
  assert.equal(current.result, 'PASS');
  assert.equal(current.buildId, 'MCh2KF31jp2mdDfBbZhIH');
  assert.equal(current.generatedRouteCount, 99);
  assert.equal(current.staticSeoUrlCount, 32);
  assert.equal(current.unitMjsCount, 389);
  assert.equal(current.unitTypeScriptCount, 34);
  assert.equal(current.productionAccess, false);
  assert.equal(current.temporaryDatabaseStopped, true);
  assert.equal(current.temporaryDatabaseRemoved, true);
  assert.equal(current.originMainAncestor, true);
  assert.equal(current.originMainRevision, 'd314826537c6b94cb019164fc19140d10a014669');
  assert.equal(current.divergenceMeasuredAtCommit, current.visualEvidenceCommit);
  assert.deepEqual(current.originMainDivergence, { candidateOnlyCommits: 88, originMainOnlyCommits: 0 });
  assert.ok(Date.parse(current.recordedAt) > Date.parse('2026-10-08T11:03:26+02:00'),
    'evidence record must be created after the security scan completed');
  assert.equal(current.browserReview.consentTimeoutRecovery, 'PASS');
  assert.equal(current.browserReview.viewport, '320x568');
  assert.equal(current.browserReview.timeoutFailClosed, true);
  assert.equal(current.browserReview.keyboardRetry, true);
  assert.equal(current.browserReview.realPosts, 0);
  assert.equal(current.browserReview.blockedBrowserOrigins, 0);
  assert.equal(current.browserReview.fullPublicVisualMatrix, 'PASS');
  assert.equal(current.browserReview.routes, 20);
  assert.equal(current.browserReview.viewportStates, 220);
  assert.equal(current.browserReview.screenshots, 25);
  assert.equal(current.browserReview.formsSubmitted, 0);
  assert.equal(current.browserReview.hydrationErrors, 0);
  assert.equal(current.browserReview.fullMatrixBlockedBrowserOrigins, 0);
  assert.equal(current.browserReview.temporaryRootRemoved, true);
  assert.equal(current.browserReview.production, 'NOT_VERIFIED');
  assert.equal(current.securityDiffScan.scanId, 'c93c78ce-787d-4f57-844d-766a59044e24');
  assert.equal(current.securityDiffScan.changedFilesReviewed, 5);
  assert.equal(current.securityDiffScan.coverage, 'complete');
  assert.equal(current.securityDiffScan.reportableFindings, 0);
  assert.equal(current.historicalVisualBaseline.commit, baselineBuild.sourceCommit);
  assert.equal(current.historicalVisualBaseline.viewportStates, baselineVisual.matrix.stateCount);
  assert.equal(current.historicalVisualBaseline.status, 'PASS_AT_BASELINE_ONLY');
  assert.equal(current.releaseGuardTests.count, 12);
  assert.equal(current.releaseGuardTests.result, 'PASS');
  assert.match(current.releaseGuardExecution, /^WAITING_/);
  assert.equal(current.staging, 'NOT_VERIFIED');
  assert.equal(current.production, 'NOT_VERIFIED');

  assert.match(matrix, /aplikačný checkpoint je commit `5587258c`/);
  assert.match(matrix, /consent QA checkpoint je `439f75dc`/);
  assert.match(matrix, /\*\*389\/389 MJS \+ 34\/34 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.match(matrix, new RegExp(current.buildId));
  assert.match(matrix, new RegExp(current.securityDiffScan.scanId));
  assert.match(matrix, /čistom dôkazovom commite `088ac8f3`/);
  assert.match(matrix, /220\/220 stavov/);
  assert.match(matrix, /\| S08 \| PASS baseline \|/);
  assert.match(matrix, /\| U05 \| PASS baseline \/ targeted current \|/);
  assert.match(matrix, /\| U01 \| PASS local current \|/);
  assert.match(matrix, /\| U04 \| PASS local current \|/);
  assert.match(matrix, /\| U07 \| PASS local current \|/);
  assert.match(matrix, /\| U08 \| PASS local current \|/);
  assert.match(matrix, /databázové integrácie kompatibilného checkpointu `4d0b6bfb`: \*\*12\/12 PASS\*\*/);
  assert.match(matrix, /produkci(?:a|u)[^\n]*\*\*NOT VERIFIED\*\*/iu);
  assert.doesNotMatch(matrix, /celá matica sa na ňom ešte nezopakovala/);
  assert.doesNotMatch(matrix, /Aktuálny aplikačný zdroj je uložený ako lokálny QA checkpoint `452c4f75`/);

  assert.equal(baselineBuild.sourceCommit, '452c4f75c7ab0f976d6e4b19099afdb9aa1428b7');
  assert.equal(baselineVisual.sourceCommit, baselineBuild.sourceCommit);
  assert.equal(baselineVisual.sourceTree, baselineBuild.sourceTree);
  assert.equal(baselineVisual.result, 'PASS');
  assert.equal(baselineVisual.matrix.stateCount, 220);
  assert.equal(baselineVisual.verification.formsSubmitted, 0);
  assert.equal(baselineVisual.verification.hydrationErrors, 0);
  assert.equal(baselineVisual.verification.blockedBrowserOrigins, 0);
  assert.equal(baselineVisual.production, 'NOT_VERIFIED');
});
