import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('operator job pages use finance-free projections and superadmin keeps the full finance branch', async () => {
  const [detail, list, documents, database] = await Promise.all([
    read('app/admin/(protected)/zakazky/[id]/page.tsx'),
    read('app/admin/(protected)/zakazky/page.tsx'),
    read('app/admin/(protected)/zakazky/[id]/podklady/page.tsx'),
    read('src/server/db.ts'),
  ]);
  const operatorBranch = detail.slice(detail.indexOf('async function OperationalBusinessJobDetailPage'), detail.indexOf('async function SuperAdminBusinessJobDetailPage'));
  const superadminBranch = detail.slice(detail.indexOf('async function SuperAdminBusinessJobDetailPage'));
  assert.match(detail, /const adminUser = await requireAdminUser\(\);[\s\S]*?adminUser\.role !== 'SUPER_ADMIN'/);
  assert.match(operatorBranch, /getOperationalBusinessJobWithActivity/);
  assert.match(operatorBranch, /listBusinessJobOfferEvidence/);
  assert.match(operatorBranch, /buildOperationalTimeline/);
  assert.doesNotMatch(operatorBranch, /getBusinessJobFinance|listLandfillPrices|listWorkers\(|getBusinessSettings|BillingPanel|job\.totalPrice|job\.costs|job\.rewardsTotal|job\.grossProfit/);
  assert.match(superadminBranch, /getBusinessJobFinance/);
  assert.match(superadminBranch, /<BillingPanel/);

  assert.match(list, /isSuperAdmin\s*\?\s*listBusinessJobs[\s\S]*?:\s*listOperationalBusinessJobs/);
  assert.match(list, /isSuperAdmin \? listWorkers\(true\) : listOperationalWorkers\(true\)/);
  assert.match(list, /isSuperAdmin \? getBusinessJobsSummary[\s\S]*?: Promise\.resolve\(null\)/);
  assert.match(documents, /isSuperAdmin \? getBusinessJobFinance\(id\) : Promise\.resolve\(null\)/);
  assert.match(documents, /isSuperAdmin \? await getBusinessJobWithActivity\(id\) : await getOperationalBusinessJobWithActivity\(id\)/);
  assert.match(documents, /requested === 'vyuctovanie' && !isSuperAdmin\) notFound\(\)/);
  assert.match(documents, /\{isSuperAdmin \? <a className=\{selectedDocument === 'vyuctovanie'/);
  assert.match(documents, /isSuperAdmin && finance && isFinancialBusinessJob\(job\) && show\('vyuctovanie'\)/);

  const safeProjection = database.slice(database.indexOf('const operationalBusinessJobColumns'), database.indexOf('export type BusinessJobListFilters'));
  assert.match(safeProjection, /j\.customer_name/);
  assert.doesNotMatch(safeProjection, /price_per_m2|total_price|payment_type|business_job_costs|\brate\b|\breward\b/);
  const safeReader = database.slice(database.indexOf('export async function getOperationalBusinessJobWithActivity'), database.indexOf('const financeReasonCodes'));
  assert.match(safeReader, /operationalBusinessJobAuditActions/);
  assert.doesNotMatch(safeReader, /business_job_invoices|business_job_payment_events|business_job_costs/);
});

test('dashboard and planner gate full job, worker and finance queries before operator data loading', async () => {
  const [dashboard, planner, layout] = await Promise.all([
    read('app/admin/(protected)/dashboard/page.tsx'),
    read('app/admin/(protected)/planovac/page.tsx'),
    read('app/admin/(protected)/layout.tsx'),
  ]);
  const dashboardGate = dashboard.indexOf("if (adminUser.role === 'OPERATOR')");
  const dashboardFullLoad = dashboard.indexOf('const [jobs, chartJobs');
  assert.ok(dashboardGate >= 0 && dashboardGate < dashboardFullLoad, 'operator dashboard must return before full finance/job loading');
  const operatorDashboard = dashboard.slice(dashboardGate, dashboardFullLoad);
  assert.doesNotMatch(operatorDashboard, /listBusinessJobs\(|listBusinessJobDashboardRows\(|listWorkers\(|getBusinessFinanceSummary\(/);
  assert.match(planner, /adminUser\.role === 'SUPER_ADMIN' \? listWorkers\(true\) : listOperationalWorkers\(true\)/);
  assert.match(planner, /adminUser\.role === 'SUPER_ADMIN'[\s\S]+listOperationalBusinessJobs/);
  assert.match(layout, /className="admin-brand" href="\/admin\/asistent"/);
});

test('operator mutations are allowlisted, CSRF-protected and cannot forge finance', async () => {
  const [actions, database, createPage, exportRoute] = await Promise.all([
    read('app/admin/(protected)/zakazky/actions.ts'),
    read('src/server/db.ts'),
    read('app/admin/(protected)/zakazky/nova/page.tsx'),
    read('app/admin/(protected)/zakazky/export/route.ts'),
  ]);
  const fullSave = actions.slice(actions.indexOf('export async function saveBusinessJobAction'), actions.indexOf('const forbiddenOperationalJobFields'));
  const operationalSave = actions.slice(actions.indexOf('export async function saveOperationalBusinessJobAction'), actions.indexOf('export type FinanceActionState'));
  assert.match(fullSave, /await verifyCsrf\(formData\)/);
  assert.match(fullSave, /await requireSuperAdmin\(\)/);
  assert.match(actions, /forbiddenOperationalJobFields/);
  assert.match(actions, /key\.startsWith\('workerRate_'\)/);
  assert.match(actions, /key\.startsWith\('workerReward_'\)/);
  assert.match(operationalSave, /await verifyCsrf\(formData\)/);
  assert.match(operationalSave, /await requireAdmin\(\)/);
  assert.match(operationalSave, /updateBusinessJobOperational/);

  const operationalUpdate = database.slice(database.indexOf('export async function updateBusinessJobOperational'), database.indexOf('export async function saveBusinessJob'));
  assert.match(operationalUpdate, /UPDATE business_jobs SET/);
  assert.match(operationalUpdate, /changes: \{ scope: 'operational' \}/);
  assert.doesNotMatch(operationalUpdate, /price_per_m2|total_price|payment_type|business_job_workers|business_job_costs/);
  assert.match(createPage, /await requireSuperAdmin\(\)/);
  assert.match(createPage, /name="_csrf"/);
  assert.match(exportRoute, /await requireSuperAdmin\(\)/);
});
