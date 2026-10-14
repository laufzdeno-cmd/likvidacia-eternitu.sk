import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('planner mutations authenticate, validate CSRF and keep manual editing', async () => {
  const [action, page, form] = await Promise.all([
    read('app/admin/(protected)/planovac/actions.ts'),
    read('app/admin/(protected)/planovac/page.tsx'),
    read('app/admin/(protected)/planovac/planner-form.tsx'),
  ]);
  assert.match(action, /await verifyCsrf\(formData\)/);
  assert.match(action, /await requireAdmin\(\)/);
  assert.match(action, /timeFrom >= timeTo/);
  assert.match(action, /allowedWorkerNames/);
  assert.match(form, /name="id"/);
  assert.match(form, /name="_csrf"/);
  assert.match(page, /Výber zákazky automaticky doplní/);
  assert.match(page, /findPlannerCollisions/);
  assert.match(page, /weatherFor/);
  assert.match(page, /weatherFor\(selectedJob\?\.district \|\| ''/);
  assert.doesNotMatch(page, /weatherFor\(editAction\?\.address|weatherFor\(selectedJob\?\.location/,
    'private street addresses must never be sent to the external weather geocoder');
  assert.match(page, /okres \$\{district\}, Slovensko/);
  assert.match(form, /setWeatherIsCurrent\(false\)/);
  assert.match(form, /Pôvodná predpoveď už neplatí/);
  assert.match(action, /savedDate\.slice\(0, 7\)/);
  assert.match(page, /preselectedJob!\.demolitionDate\.slice\(0, 7\)/);
});

test('offer follow-up is draft-first, explicit, idempotent and status-gated', async () => {
  const [action, page] = await Promise.all([
    read('app/admin/(protected)/ponuky/actions.ts'),
    read('app/admin/(protected)/ponuky/[id]/follow-up/page.tsx'),
  ]);
  assert.match(action, /formData\.get\('confirmed'\) !== 'yes'/);
  assert.match(action, /offer\.status !== 'ODOSLANA'/);
  assert.match(action, /claimPriceOfferFollowUp/);
  assert.match(action, /finishPriceOfferFollowUp/);
  assert.match(action, /resolveUnknownPriceOfferFollowUpAction/);
  assert.match(action, /confirmedResolution/);
  assert.match(action, /expectedRevision/);
  assert.match(action, /operationId/);
  assert.match(page, /Skontroloval\/a som adresáta/);
  assert.match(page, /Overil\/a som, že email odišiel/);
  assert.match(page, /Overil\/a som, že email neodišiel/);
  assert.match(page, /Povoliť nový pokus/);
  assert.doesNotMatch(page, /mailto:/);
});

test('offer follow-up persistence recovers stale claims fail-closed and requires manual evidence', async () => {
  const database = await read('src/server/db.ts');
  assert.match(database, /recoverStalePriceOfferFollowUps/);
  assert.match(database, /interrupted_after_claim/);
  assert.match(database, /status = 'unknown'/);
  assert.match(database, /resolveUnknownPriceOfferFollowUp/);
  assert.match(database, /resolution_operation_id/);
  assert.match(database, /current\.revision !== input\.expectedRevision/);
  assert.match(database, /price_offer_follow_up_manually_resolved/);
});

test('receivables are superadmin-only and document pack never sends externally', async () => {
  const [receivables, documents] = await Promise.all([
    read('app/admin/(protected)/zakazky/pohladavky/page.tsx'),
    read('app/admin/(protected)/zakazky/[id]/podklady/page.tsx'),
  ]);
  assert.match(receivables, /await requireSuperAdmin\(\)/);
  assert.match(receivables, /excludeTestData: true/);
  assert.match(documents, /Návrhy sa nikam automaticky neodosielajú/);
  assert.match(documents, /Pracovné podklady pre oznámenie RÚVZ/);
  assert.match(documents, /Pracovný list realizácie/);
  assert.match(documents, /Prehľad zneškodnenia a odovzdania odpadu/);
  assert.match(documents, /Odovzdávací protokol a záverečný checklist/);
  assert.match(documents, /Interný prehľad vyúčtovania zákazky/);
  assert.match(documents, /href=\{`\/api\/admin\/ponuka\/\$\{linkedOffer\.id\}\/pdf`\}/);
  assert.match(documents, /Autoritatívnym dokumentom zostáva existujúce PDF CP/);
  assert.match(documents, /linkedOffer\.totalWithVat/);
  assert.match(documents, /selectedDocument === 'all' \|\| selectedDocument === key/);
  assert.match(documents, /Systém nepotvrdzuje právnu úplnosť/);
  assert.match(documents, /requested === 'vyuctovanie' && !isSuperAdmin\) notFound\(\)/);
  assert.match(documents, /isSuperAdmin \? <a className=\{selectedDocument === 'vyuctovanie'/);
  assert.match(documents, /isSuperAdmin && finance && isFinancialBusinessJob\(job\) && show\('vyuctovanie'\)/);
  assert.doesNotMatch(documents, /Finančné údaje<\/dt><dd>Dostupné iba superadminovi/);
  assert.match(documents, /isSuperAdmin \? listPriceOffers\(\{ jobId: id, includeArchived: true \}\) : listBusinessJobOfferEvidence\(id\)/);
  assert.match(documents, /isSuperAdmin \? await getBusinessJobWithActivity\(id\) : await getOperationalBusinessJobWithActivity\(id\)/);
  assert.match(documents, /!offer\.deletedAt && offer\.status === 'PRIJATA'/);
  assert.doesNotMatch(documents, /sendMail|sendPlannerNotificationEmail|action=/);
});

test('documents-only visual harness covers every separately printable document', async () => {
  const harness = await read('scripts/admin-visual.browser.integration.mjs');
  for (const slug of ['ponuka', 'pracovny-list', 'ruvz', 'odpad', 'protokol', 'vyuctovanie']) {
    assert.match(harness, new RegExp(`dokument=${slug.replace('-', '\\-')}`));
  }
  assert.match(harness, /--documents-only/);
});

test('job detail exposes closure checklist, unified timeline and CSRF-protected manual note', async () => {
  const [detail, operations] = await Promise.all([
    read('app/admin/(protected)/zakazky/[id]/page.tsx'),
    read('src/lib/admin-operations.ts'),
  ]);
  assert.match(detail, /buildJobClosureChecklist/);
  assert.match(detail, /buildOperationsTimeline/);
  assert.match(detail, /getJobAttention/);
  assert.match(detail, /name="_csrf" value=\{csrfToken\}/);
  assert.match(detail, /Balík podkladov/);
  assert.match(detail, /catch\(\(\) => null\)/);
  assert.match(detail, /status: 'unknown' as const/);
  assert.match(detail, /listPriceOfferFollowUps/);
  assert.match(detail, /offerNumber: offer\.number/);
  assert.match(operations, /Follow-up ponuky \$\{followUp\.offerNumber\}/);
  assert.match(operations, /Predmet: \$\{followUp\.subject/);
  assert.match(operations, /!financialAuditActions\.has\(log\.action\)/);
  assert.match(operations, /Zmena je zaevidovaná v CRM\./);
  assert.doesNotMatch(operations.slice(operations.indexOf('export function buildOperationalTimeline')), /log\.actorEmail/);
});
