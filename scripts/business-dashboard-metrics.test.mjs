import assert from 'node:assert/strict';
import test from 'node:test';

function job({ id, status, totalPrice, m2, directCosts = 0, reward = 0, paymentType = 'FAKTURA' }) {
  return {
    id, status, totalPrice, m2, paymentType, rewardsTotal: reward, wasteKg: 0,
    costs: { total: directCosts },
  };
}

test('dashboard separates cancelled values and labels remaining job sums as evidence, not receipts', async () => {
  const { summarizeBusinessJobs } = await import('../src/lib/business-dashboard-metrics.ts');
  const result = summarizeBusinessJobs([
    job({ id: 'dopyt', status: 'DOPYT', totalPrice: 1000, m2: 100 }),
    job({ id: 'work', status: 'DOKONCENA', totalPrice: 5000, m2: 50, directCosts: 1000, reward: 500, paymentType: 'CASH' }),
    job({ id: 'cancelled', status: 'ZRUSENA', totalPrice: 9000, m2: 10 }),
  ]);

  assert.equal(result.recordedOrderValue, 6000);
  assert.equal(result.cancelledValue, 9000);
  assert.equal(result.activeJobs.length, 2);
  assert.equal(result.cancelledJobs.length, 1);
  assert.equal(result.invoiceTypeValue, 1000);
  assert.equal(result.cashTypeValue, 5000);
  assert.equal(result.averageRecordedPricePerM2, 40);
  assert.equal(result.preOverheadRemainder, 4500);
  assert.equal(result.jobsWithoutRecordedDirectCosts, 1);
  assert.equal('paidRevenue' in result, false, 'current data has no verified payment ledger');
});

test('dashboard reports an undefined weighted average when area is zero', async () => {
  const { summarizeBusinessJobs } = await import('../src/lib/business-dashboard-metrics.ts');
  assert.equal(summarizeBusinessJobs([job({ id: 'zero-area', status: 'DOPYT', totalPrice: 250, m2: 0 })]).averageRecordedPricePerM2, null);
});

test('offer history counts sent and accepted dates even if the offer is later cancelled', async () => {
  const { summarizeOfferEvents } = await import('../src/lib/business-dashboard-metrics.ts');
  const { isBusinessDateInPeriod } = await import('../src/lib/business-period.ts');
  const result = summarizeOfferEvents([{
    createdAt: '2026-01-20T12:00:00.000Z',
    sentAt: '2026-01-31T23:30:00.000Z',
    acceptedAt: '2026-02-03T09:00:00.000Z',
  }], '2026-02-01', '2026-02-28', isBusinessDateInPeriod);
  assert.deepEqual(result, { created: 0, sent: 1, accepted: 1 });
});

test('local stale snapshots cannot undo an audited test-lead classification', async () => {
  const { mergeLatestTestClassifications } = await import('../src/server/local-lead-test-classification.ts');
  const stale = [{ id: 'lead-1', isTestData: false }, { id: 'lead-2' }];
  const audits = [
    { entityType: 'lead', entityId: 'lead-1', action: 'lead_test_classification_changed', createdAt: '2026-10-01T10:00:00.000Z', changes: { next: true } },
    { entityType: 'lead', entityId: 'lead-1', action: 'lead_test_classification_changed', createdAt: '2026-10-01T10:00:00.001Z', changes: { next: false } },
    { entityType: 'business_job', entityId: 'lead-2', action: 'lead_test_classification_changed', createdAt: '2026-10-01T10:00:00.002Z', changes: { next: true } },
  ];
  assert.deepEqual(mergeLatestTestClassifications(stale, audits, 'lead'), [
    { id: 'lead-1', isTestData: false },
    { id: 'lead-2', isTestData: false },
  ]);
  assert.equal(mergeLatestTestClassifications(stale, [audits[0]], 'lead')[0].isTestData, true);
  assert.equal(mergeLatestTestClassifications([{ id: 'job-1', isTestData: false }], [
    { entityType: 'business_job', entityId: 'job-1', action: 'business_job_test_classification_changed', createdAt: '2026-10-01T10:00:00.000Z', changes: { next: true } },
  ], 'business_job')[0].isTestData, true);
});

test('annual report uses the shared cancelled-job separation and avoids accounting-profit labels', async () => {
  const { readFile } = await import('node:fs/promises');
  const page = await readFile(new URL('../app/admin/(protected)/rok/page.tsx', import.meta.url), 'utf8');
  const jobsPage = await readFile(new URL('../app/admin/(protected)/zakazky/page.tsx', import.meta.url), 'utf8');
  const detailPage = await readFile(new URL('../app/admin/(protected)/zakazky/[id]/page.tsx', import.meta.url), 'utf8');
  const exportRoute = await readFile(new URL('../app/admin/(protected)/zakazky/export/route.ts', import.meta.url), 'utf8');
  assert.match(page, /const metrics = summarizeBusinessJobs\(monthJobs\)/);
  assert.match(page, /cancelledCount: metrics\.cancelledJobs\.length/);
  assert.match(page, /Evidovaná suma/);
  assert.match(page, /Orientačný rozdiel/);
  assert.match(page, /Zrušené záznamy sú oddelené/);
  assert.match(page, /limit: null/);
  assert.doesNotMatch(page, /Načítanie dosiahlo limit 1 000 záznamov/);
  assert.doesNotMatch(page, /<th>Tržby €<\/th>|<th>Zisk €<\/th>|<th>Marža %<\/th>/);
  assert.match(jobsPage, /countBusinessJobs\(filters\)/);
  assert.match(jobsPage, /getBusinessJobsSummary\(\{ \.\.\.filters, excludeTestData: true \}\)/);
  assert.match(jobsPage, /súhrny v päte tabuľky ich vylučujú/);
  assert.match(jobsPage, /limit: pageSize, offset:/);
  assert.match(jobsPage, /totals\.recordedValue/);
  assert.match(jobsPage, /totals\.canceledValue/);
  assert.match(jobsPage, /totals\.archivedCount/);
  assert.match(jobsPage, /oddelene od aktívnych súčtov/);
  assert.match(jobsPage, /Orientačný rozdiel €/);
  assert.match(jobsPage, /Súčet nezahŕňa zrušené záznamy; tie uvádzame osobitne/);
  assert.match(detailPage, /Orientačný rozdiel po zadaných nákladoch a odmenách/);
  assert.doesNotMatch(detailPage, /<span>Tržba<\/span>|<span>Zisk<\/span>/);
  assert.match(exportRoute, /evidovaná suma/);
  assert.match(exportRoute, /dohodnutý spôsob vyúčtovania \(nie dôkaz úhrady\)/);
  assert.match(exportRoute, /orientačný rozdiel po zadaných nákladoch a odmenách/);
  assert.match(exportRoute, /limit: null/);
  assert.match(exportRoute, /countBusinessJobs\(filters\)/);
  assert.match(exportRoute, /matchingCount > 10_000/);
  assert.match(exportRoute, /workerId:/);
  assert.match(exportRoute, /q:/);
  assert.match(exportRoute, /status,/);
  assert.match(exportRoute, /paymentType,/);
  assert.match(exportRoute, /includeArchived/);
  assert.match(exportRoute, /job\.deletedAt \? 'áno' : 'nie'/);
  assert.doesNotMatch(exportRoute, /'zisk €'/);
});

test('admin dashboard aggregates complete periods and loads only bounded lead previews', async () => {
  const { readFile } = await import('node:fs/promises');
  const dashboard = await readFile(new URL('../app/admin/(protected)/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /listBusinessJobs\(\{ \.\.\.bounds, limit: null, excludeTestData: true \}\)/);
  const yearReport = await readFile(new URL('../app/admin/(protected)/rok/page.tsx', import.meta.url), 'utf8');
  assert.match(yearReport, /excludeTestData: true/);
  assert.match(dashboard, /listBusinessJobDashboardRows\(allJobsFrom, `\$\{currentYear\}-12-31`\)/);
  assert.doesNotMatch(dashboard, /const \[jobs, allJobs,/);
  assert.match(dashboard, /getLeadDashboardMetrics\(bounds\.from, bounds\.to, today\)/);
  assert.match(dashboard, /getPriceOfferEventMetrics\(bounds\.from, bounds\.to\)/);
  assert.match(dashboard, /excludeTestData: true/);
  assert.match(dashboard, /getLeadQueueCounts\(today, true\)/);
  assert.match(dashboard, /listLeadSummaryPage\(\{ page: 1, pageSize: 10, status: 'nevyslo', excludeTestData: true \}\)/);
  assert.doesNotMatch(dashboard, /listLeadSummaries\(|SelectionMayBeTruncated|technical limit|technický limit/);
  const { readFile: readSource } = await import('node:fs/promises');
  const db = await readSource(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert.match(db, /export async function listBusinessJobDashboardRows/);
  assert.match(db, /SELECT j\.id, j\.demolition_date, j\.status, j\.total_price,/);
  assert.doesNotMatch(db.slice(db.indexOf('export async function listBusinessJobDashboardRows'), db.indexOf('export async function getLeadDashboardMetrics')), /SELECT j\.\*/);
  assert.match(db, /count\(\*\) FILTER \(WHERE created_at >= \$3::timestamptz AND created_at < \$4::timestamptz\)::int AS new_today/);
  assert.match(db, /is_test_data boolean NOT NULL DEFAULT false/);
  assert.match(db, /lead_test_classification_changed/);
  assert.match(db, /NOT EXISTS \(SELECT 1 FROM leads test_lead WHERE test_lead\.id = j\.lead_id AND test_lead\.is_test_data = true\)/);
  assert.match(db, /COALESCE\(j\.is_test_data, false\) = false/);
  assert.match(db, /COALESCE\(l\.is_test_data, false\) = false/);
  const leadDetail = await readFile(new URL('../app/admin/(protected)/dopyty/[id]/page.tsx', import.meta.url), 'utf8');
  const leadActions = await readFile(new URL('../app/admin/(protected)/dopyty/[id]/actions.ts', import.meta.url), 'utf8');
  assert.match(leadDetail, /adminUser\.role === 'SUPER_ADMIN'/);
  assert.match(leadDetail, /setLeadTestDataAction/);
  assert.match(leadDetail, /V CRM zostáva zachovaný/);
  assert.match(leadActions, /await verifyCsrf\(formData\);[\s\S]*?requireSuperAdmin\(\)/);
  const jobDetail = await readFile(new URL('../app/admin/(protected)/zakazky/[id]/page.tsx', import.meta.url), 'utf8');
  const jobActions = await readFile(new URL('../app/admin/(protected)/zakazky/actions.ts', import.meta.url), 'utf8');
  assert.match(jobDetail, /setBusinessJobTestDataAction/);
  assert.match(jobDetail, /csrfTokenForEmail\(adminUser\.email\)/);
  assert.match(jobActions, /setBusinessJobTestDataAction[\s\S]*?requireSuperAdmin\(\)/);
  assert.match(jobActions, /verifyCsrf\(formData\)/);
  assert.match(db, /business_job_test_classification_changed/);
});

test('admin browser QA asserts current evidence labels and the business chart, not accounting claims', async () => {
  const { readFile } = await import('node:fs/promises');
  const adminQa = await readFile(new URL('./admin-test.ts', import.meta.url), 'utf8');
  assert.match(adminQa, /locator\('\.admin-stat-grid'\)\)\.toContainText\(\/Evidovaná suma\/i\)/);
  assert.match(adminQa, /locator\('\.business-chart svg'\)\)\.toBeVisible\(\)/);
  assert.match(adminQa, /locator\('\.admin-table thead'\)\)\.not\.toContainText\(\/Tržby €\|Zisk €\|Marža %\/i\)/);
  assert.doesNotMatch(adminQa, /toContainText\(\/Tržby\/i\)|toContainText\(\/Zisk\/i\)/);
});
