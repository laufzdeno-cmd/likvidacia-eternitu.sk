import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const sourceUrl = new URL('../src/server/admin-assistant-metrics.ts', import.meta.url);

async function loadPureMetricsModule() {
  const source = (await readFile(sourceUrl, 'utf8')).replace("import 'server-only';", '');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const hours = (value) => new Date(Date.parse('2026-10-15T12:00:00.000Z') + value * 3_600_000).toISOString();

test('assistant metrics compare equal rolling 30-day periods and contain no PII', async () => {
  const { buildAdminAssistantMetrics } = await loadPureMetricsModule();
  const currentLead = { id: 'lead-current', createdAt: hours(-24 * 10) };
  const previousLead = { id: '22222222-2222-4222-a222-222222222222', createdAt: hours(-24 * 40) };
  const deletedLead = { id: 'lead-deleted', createdAt: hours(-24 * 5), deletedAt: hours(-1) };
  const testLead = { id: 'lead-test', createdAt: hours(-24 * 4), isTestData: true };
  const result = buildAdminAssistantMetrics({
    now: new Date(hours(0)),
    runs: [
      { id: 'run-live', trigger: 'cron' },
      { id: 'run-test', trigger: 'test' },
    ],
    runItems: [
      { runId: 'run-live', module: 'offers', entityId: 'offer-current', outcome: 'created', createdAt: hours(-24 * 10 + 1) },
      { runId: 'run-live', module: 'offers', entityId: 'job-current', outcome: 'blocked', createdAt: hours(-7) },
      { runId: 'run-live', module: 'review_requests', entityId: 'job-previous', outcome: 'failed', createdAt: hours(-24 * 35) },
      { runId: 'run-live', module: 'photo_intake', entityId: 'photo-valid', outcome: 'created', createdAt: hours(-6) },
      { runId: 'run-live', module: 'photo_intake', entityId: 'photo-deleted-source', outcome: 'created', createdAt: hours(-6) },
      { runId: 'run-test', module: 'photo_intake', entityId: 'photo-test', outcome: 'created', createdAt: hours(-6) },
      { runId: 'run-live', module: 'offers', entityId: 'deleted-job', outcome: 'created', createdAt: hours(-5) },
    ],
    leads: [currentLead, previousLead, deletedLead, testLead],
    jobs: [
      { id: 'job-current', leadId: currentLead.id },
      { id: 'job-previous', leadId: previousLead.id },
      { id: 'deleted-job', leadId: deletedLead.id, deletedAt: hours(-1) },
    ],
    offers: [
      { id: 'offer-current', sourceJobIds: ['job-current'], createdAt: hours(-24 * 10 + 2), sentAt: hours(-24 * 9), outcomeUpdatedAt: hours(-24 * 9 + 4) },
      { id: 'offer-current-later', leadId: currentLead.id, createdAt: hours(-24 * 10 + 5) },
      { id: 'offer-previous', sourceInquiry: `dopyt:${previousLead.id}`, createdAt: hours(-24 * 40 + 8), sentAt: hours(-24 * 39), outcomeUpdatedAt: hours(-24 * 39 + 10) },
      { id: 'offer-invalid-outcome', leadId: currentLead.id, createdAt: hours(-20), sentAt: hours(-19), outcomeUpdatedAt: hours(-20) },
      { id: 'manual-replacement', jobId: 'job-current', createdAt: hours(-7), sentAt: hours(-6) },
      { id: 'offer-test', leadId: testLead.id, createdAt: hours(-24 * 4 + 1), sentAt: hours(-24 * 3), outcomeUpdatedAt: hours(-24 * 3 + 1), isTestData: true },
      { id: 'offer-deleted', leadId: deletedLead.id, createdAt: hours(-24 * 5 + 1), deletedAt: hours(-1) },
      { id: 'offer-mixed-source', sourceJobIds: ['job-current', 'deleted-job'], createdAt: hours(-18), sentAt: hours(-17), outcomeUpdatedAt: hours(-16) },
    ],
    eligiblePhotoEntityIds: ['photo-valid'],
  });

  assert.equal(Date.parse(result.current.period.toExclusive) - Date.parse(result.current.period.fromInclusive), 30 * 86_400_000);
  assert.equal(result.current.period.fromInclusive, result.previous.period.toExclusive);
  assert.equal(result.current.autopilot.prepared, 2);
  assert.equal(result.current.autopilot.blocked, 1);
  assert.equal(result.current.autopilot.failed, 0);
  assert.equal(result.current.autopilot.humanApprovedAndSentOffers, 1,
    'počíta sa iba presná ponuka pripravená asistentom, nie neskoršia ručná ponuka tej istej zákazky');
  assert.equal(result.previous.autopilot.failed, 1);
  assert.deepEqual(result.current.leadToFirstPriceOffer, { medianMinutes: 120, p90Minutes: 120, sampleSize: 1, cohortSize: 1 });
  assert.deepEqual(result.previous.leadToFirstPriceOffer, { medianMinutes: 480, p90Minutes: 480, sampleSize: 1, cohortSize: 1 });
  assert.deepEqual(result.current.sentPriceOfferToOutcome, { medianMinutes: 240, p90Minutes: 240, sampleSize: 1, cohortSize: 3 });
  assert.deepEqual(result.previous.sentPriceOfferToOutcome, { medianMinutes: 600, p90Minutes: 600, sampleSize: 1, cohortSize: 1 });
  assert.equal(result.evidenceKind, 'operational_indicators_not_proven_savings');
  assert.match(result.disclaimer, /nie o dokázanú úsporu času/);
  const serialized = JSON.stringify(result);
  for (const forbidden of ['lead-current', 'job-current', 'offer-current', 'customerName', 'email', 'phone']) {
    assert.equal(serialized.includes(forbidden), false, `DTO nesmie obsahovať ${forbidden}`);
  }
});

test('duration statistics use arithmetic median, nearest-rank p90 and expose the sample', async () => {
  const { nearestRankPercentile, summarizeDurationsMinutes } = await loadPureMetricsModule();
  assert.equal(nearestRankPercentile([100, 10, 40, 20, 30], 0.9), 100);
  assert.deepEqual(summarizeDurationsMinutes([10, 20, 30, 40], 7), {
    medianMinutes: 25,
    p90Minutes: 40,
    sampleSize: 4,
    cohortSize: 7,
  });
  assert.deepEqual(summarizeDurationsMinutes([], 3), {
    medianMinutes: null,
    p90Minutes: null,
    sampleSize: 0,
    cohortSize: 3,
  });
});

test('server DTO is superadmin-only, read-only and uses a bounded sixty-day source window', async () => {
  const [source, autopilot] = await Promise.all([
    readFile(sourceUrl, 'utf8'),
    readFile(new URL('../src/server/admin-autopilot.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /^import 'server-only';/);
  assert.match(source, /role !== 'SUPER_ADMIN'/);
  assert.match(source, /listLeadSummaryPage/);
  assert.match(source, /listOperationalBusinessJobs\(\{ limit: null, excludeTestData: true \}\)/);
  assert.match(source, /listAdminAutopilotMetricWindow\(metricWindowFrom, metricWindowTo\)/);
  assert.match(source, /2 \* ROLLING_PERIOD_DAYS \* DAY_MS/);
  assert.doesNotMatch(source, /listAdminAutopilotRuns\(100\)/);
  assert.match(source, /listEligibleAdminAssistantPhotoIds/);
  assert.match(source, /autopilotRunLimitReached: autopilotWindow\.truncated/);
  assert.match(source, /priceOfferLimitReached: offers\.length === 1000/);
  assert.match(autopilot, /entityId: offerId, outcome: 'created'/);
  assert.doesNotMatch(source, /\bsave[A-Z]|\bcreate[A-Z]|\bupdate[A-Z]|\bdelete[A-Z]|\bsend[A-Z]|\bpublish[A-Z]/);
});
