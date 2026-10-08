import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('acceptance evidence distinguishes the current application, visual, performance and production gates', async () => {
  const [matrix, rawCurrentEvidence, rawBaselineVisual] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-c18f6f54.json', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/VISUAL-EVIDENCE-SUMMARY-452c4f75.json', import.meta.url), 'utf8'),
  ]);
  const current = JSON.parse(rawCurrentEvidence);
  const baselineVisual = JSON.parse(rawBaselineVisual);

  assert.equal(current.applicationCommit, 'c18f6f545628a8a6713b1098131efb4c1c85e3ef');
  assert.equal(current.applicationTree, '2f96e42f9994b09128db82d525d1146ab0134551');
  assert.equal(current.applicationCodeParent, '358675979d2725c618f53122d13782105298df2e');
  assert.equal(current.qaCommit, '439f75dcae5b6f536cfcd6ca04204903eccdf4ee');
  assert.equal(current.visualEvidenceCommit, '088ac8f3a0f83211a9337a7cdbb8565620e531fe');
  assert.equal(current.performanceEvidenceCommit, 'c882d5eb563940fc88caeef96a071c465a2b4626');
  assert.equal(current.result, 'PASS');
  assert.equal(current.buildId, 'bVLQq_0VJpnqv3VPx66dc');
  assert.equal(current.generatedRouteCount, 99);
  assert.equal(current.staticSeoUrlCount, 32);
  assert.equal(current.dynamicReviews, 'PASS');
  assert.equal(current.dynamicRealizations, 'PASS');
  assert.equal(current.routeCssIsolation, 'PASS');
  assert.equal(current.clientBundleIsolation, 'PASS');
  assert.equal(current.oldRooferRedirect, 'PASS');
  assert.equal(current.unitMjsCount, 393);
  assert.equal(current.unitTypeScriptCount, 34);
  assert.equal(current.productionAccess, false);
  assert.equal(current.temporaryDatabaseStopped, true);
  assert.equal(current.temporaryDatabaseRemoved, true);
  assert.equal(current.temporaryRootRemoved, true);
  assert.equal(current.originMainAncestor, true);
  assert.equal(current.originMainRevision, 'd314826537c6b94cb019164fc19140d10a014669');
  assert.equal(current.divergenceMeasuredAtCommit, current.applicationCommit);
  assert.deepEqual(current.originMainDivergence, { candidateOnlyCommits: 97, originMainOnlyCommits: 0 });
  assert.ok(Date.parse(current.recordedAt) > Date.parse('2026-10-08T13:40:00+02:00'),
    'evidence record must be created after the exact current build completed');

  assert.equal(current.formFocusReview.targetedContracts, 8);
  assert.equal(current.formFocusReview.leadBrowser, 'PASS');
  assert.equal(current.formFocusReview.careerAndRooferBrowser, 'PASS');
  assert.equal(current.formFocusReview.testimonialBrowser, 'PASS');
  assert.equal(current.formFocusReview.repeatedOversizedCvFocusAttempts, 2);
  assert.equal(current.formFocusReview.repeatedOversizedCvPosts, 0);
  assert.equal(current.formFocusReview.productController, 'PASS');
  assert.equal(current.formFocusReview.latestTechnicalController, 'NOT_RUN_QUOTA');
  assert.equal(current.formFocusReview.physicalScreenReader, 'NOT_VERIFIED');

  assert.equal(current.lighthouseS08.result, 'PASS_AT_PERFORMANCE_CHECKPOINT');
  assert.equal(current.lighthouseS08.buildId, 'Wyp6vsSNT67wymqcXaMyB');
  assert.equal(current.lighthouseS08.routes, 5);
  assert.equal(current.lighthouseS08.runsPerRoute, 3);
  assert.equal(current.lighthouseS08.totalRuns, 15);
  assert.deepEqual(current.lighthouseS08.medianPerformanceRange, [97, 98]);
  assert.equal(current.lighthouseS08.accessibility, 100);
  assert.equal(current.lighthouseS08.seo, 100);
  assert.deepEqual(current.lighthouseS08.medianLcpMsRange, [2351, 2467]);
  assert.equal(current.lighthouseS08.maximumMedianCls, 0);
  assert.equal(current.lighthouseS08.productionAccess, false);

  assert.equal(current.securityBaseline.scanId, 'b3026b4f-bc75-4813-8429-d9717b16c1f5');
  assert.equal(current.securityBaseline.changedFilesReviewed, 13);
  assert.equal(current.securityBaseline.coverage, 'complete');
  assert.equal(current.securityBaseline.reportableFindings, 0);
  assert.equal(current.securityBaseline.latestFocusSliceServerSurfaceChanged, false);
  assert.equal(current.historicalVisualBaseline.commit, current.visualEvidenceCommit);
  assert.equal(current.historicalVisualBaseline.viewportStates, baselineVisual.matrix.stateCount);
  assert.equal(current.historicalVisualBaseline.status, 'PASS_AT_REVIEWED_VISUAL_CHECKPOINT');
  assert.match(current.releaseGuardExecution, /^WAITING_/);
  assert.equal(current.staging, 'NOT_VERIFIED');
  assert.equal(current.production, 'NOT_VERIFIED');

  assert.match(matrix, /aplikačný checkpoint je commit `c18f6f54`/);
  assert.match(matrix, /aplikačný kód je commit `35867597`/);
  assert.match(matrix, /consent QA checkpoint je `439f75dc`/i);
  assert.match(matrix, /\*\*393\/393 MJS \+ 34\/34 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.match(matrix, new RegExp(current.buildId));
  assert.match(matrix, new RegExp(current.securityBaseline.scanId));
  assert.match(matrix, /čistom dôkazovom commite `088ac8f3`/);
  assert.match(matrix, /220\/220 stavov/);
  assert.match(matrix, /čistom commite `c882d5eb`/);
  assert.match(matrix, new RegExp(current.lighthouseS08.buildId));
  assert.match(matrix, /\| S08 \| PASS local current \|/);
  assert.match(matrix, /\| U05 \| PASS local current \|/);
  assert.match(matrix, /\| U01 \| PASS local current \|/);
  assert.match(matrix, /\| U02 \| PASS local current \|/);
  assert.match(matrix, /\| U03 \| PASS local current \|/);
  assert.match(matrix, /\| U04 \| PASS local current \|/);
  assert.match(matrix, /\| U07 \| PASS local current \|/);
  assert.match(matrix, /\| U08 \| PASS local current \|/);
  assert.match(matrix, /databázové integrácie kompatibilného checkpointu `4d0b6bfb`: \*\*12\/12 PASS\*\*/);
  assert.match(matrix, /produkci(?:a|u)[^\n]*\*\*NOT VERIFIED\*\*/iu);
  assert.doesNotMatch(matrix, /celá matica sa na ňom ešte nezopakovala/);
  assert.doesNotMatch(matrix, /Aktuálny aplikačný zdroj je uložený ako lokálny QA checkpoint `452c4f75`/);

  assert.equal(baselineVisual.result, 'PASS');
  assert.equal(baselineVisual.matrix.stateCount, 220);
  assert.equal(baselineVisual.verification.formsSubmitted, 0);
  assert.equal(baselineVisual.verification.hydrationErrors, 0);
  assert.equal(baselineVisual.verification.blockedBrowserOrigins, 0);
  assert.equal(baselineVisual.production, 'NOT_VERIFIED');
});
