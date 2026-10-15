import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const ownedTestRoot = path.join(process.cwd(), 'tmp');
await mkdir(ownedTestRoot, { recursive: true });
const temporaryDirectory = await mkdtemp(path.join(ownedTestRoot, 'astana-admin-autopilot-'));
const databasePath = path.join(temporaryDirectory, 'local-db.json');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.ASTANA_LOCAL_DB_PATH = databasePath;
process.env.ADMIN_EMAIL = 'superadmin@local.test';

const db = await import('../src/server/db.ts');
const { classifyAdminAutopilotRun, reconcileAdminAutopilot } = await import('../src/server/admin-autopilot.ts');

function jobInput(status, suffix) {
  return {
    demolitionDate: '2026-10-15',
    customerName: `Zákazník ${suffix}`,
    customerPhone: '0900123456',
    customerEmail: `${suffix}@example.com`,
    location: 'Poprad',
    district: 'Poprad',
    materialType: 'Vlnitý eternit',
    objectType: 'Rodinný dom',
    term: 'dohodou',
    leadSource: 'likvidacia-eternitu.sk',
    preferredContact: 'email',
    m2: 120,
    pricePerM2: 10.5,
    paymentType: 'FAKTURA',
    workType: 'DEMONTAZ_A_ODVOZ',
    wasteKg: 1_000,
    landfill: 'INA',
    status,
    note: '',
    workers: [],
    costs: { fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0 },
  };
}

try {
  const starvationValid = await db.saveBusinessJob(jobInput('DOPYT', 'validny-za-blokovanym'), 'superadmin@local.test');
  const starvationBlockedInput = jobInput('DOPYT', 'blokuje-davku');
  starvationBlockedInput.materialType = '';
  const starvationBlocked = await db.saveBusinessJob(starvationBlockedInput, 'superadmin@local.test');
  const starvationRun = await reconcileAdminAutopilot({ actorEmail: 'system:test-autopilot', actorKind: 'system', trigger: 'test', limit: 1 });
  assert.equal(starvationRun.priceOffersCreated, 1, 'blokovaný prvý kandidát nesmie zadržať neskoršiu platnú CP');
  assert.equal((await db.listPriceOffers({ jobId: starvationValid.id })).length, 1);
  assert.equal(starvationRun.blockedOfferJobIds.some((item) => item.jobId === starvationBlocked.id), true);

  const reviewStarvationValid = await db.saveBusinessJob(jobInput('DOKONCENA', 'referencia-validna-za-blokovanou'), 'superadmin@local.test', undefined, { legacyCompletedImportReason:'TEST_FIXTURE' });
  const reviewStarvationBlockedInput = jobInput('DOKONCENA', 'referencia-blokuje-davku');
  reviewStarvationBlockedInput.customerName = '';
  reviewStarvationBlockedInput.demolitionDate = '2099-12-31';
  const reviewStarvationBlocked = await db.saveBusinessJob(reviewStarvationBlockedInput, 'superadmin@local.test', undefined, { legacyCompletedImportReason:'TEST_FIXTURE' });
  const reviewStarvationRun = await reconcileAdminAutopilot({ actorEmail: 'system:test-autopilot', actorKind: 'system', trigger: 'test', limit: 1 });
  assert.equal(reviewStarvationRun.reviewRequestsPrepared, 1, 'neplatný prvý kandidát nesmie zadržať neskoršiu platnú žiadosť');
  const reviewStarvationRequests = await db.listReviewRequests();
  assert.equal(reviewStarvationRequests.some((item) => item.jobId === reviewStarvationValid.id), true);
  assert.equal(reviewStarvationRequests.some((item) => item.jobId === reviewStarvationBlocked.id), false);

  assert.equal(classifyAdminAutopilotRun(['offers', 'review_requests', 'photo_intake'], 0), 'failed',
    'úplný výpadok bez výstupu musí byť označený ako zlyhanie');
  assert.equal(classifyAdminAutopilotRun(['photo_intake'], 0), 'degraded');

  const offerJob = await db.saveBusinessJob(jobInput('DOPYT', 'ponuka'), 'superadmin@local.test');
  const completedJob = await db.saveBusinessJob(jobInput('DOKONCENA', 'referencia'), 'superadmin@local.test', undefined, { legacyCompletedImportReason:'TEST_FIXTURE' });
  const incompleteJobInput = jobInput('DOPYT', 'bez-materialu');
  incompleteJobInput.materialType = '';
  const incompleteJob = await db.saveBusinessJob(incompleteJobInput, 'superadmin@local.test');

  const first = await reconcileAdminAutopilot({ actorEmail: 'system:test-autopilot' });
  assert.equal(first.priceOffersCreated, 1);
  assert.equal(first.reviewRequestsPrepared, 1);
  assert.deepEqual(first.blockedOfferJobIds.find((item) => item.jobId === incompleteJob.id), {
    jobId: incompleteJob.id,
    reason: 'missing_material_type',
  });

  const offers = await db.listPriceOffers({ jobId: offerJob.id });
  assert.equal(offers.length, 1);
  assert.equal(offers[0].status, 'PRIPRAVENA');
  assert.match(offers[0].emailSubject, /Cenová ponuka/);
  assert.match(offers[0].emailBody, /priloženom PDF/);

  const requests = await db.listReviewRequests();
  assert.equal(requests.filter((item) => item.jobId === completedJob.id).length, 1);
  assert.equal(requests.find((item) => item.jobId === completedJob.id)?.status, 'pending_approval');

  const second = await reconcileAdminAutopilot({ actorEmail: 'system:test-autopilot' });
  assert.equal(second.priceOffersCreated, 0, 'opakovaný beh nesmie vytvoriť druhú CP');
  assert.equal(second.reviewRequestsPrepared, 0, 'opakovaný beh nesmie vytvoriť druhú žiadosť');
  assert.equal((await db.listPriceOffers({ jobId: offerJob.id })).length, 1);
  assert.equal((await db.listReviewRequests()).filter((item) => item.jobId === completedJob.id).length, 1);

  const claim = await db.claimPriceOfferForSending(offers[0].id, 'superadmin@local.test');
  assert.ok(claim?.sendAttemptId);
  await db.finishPriceOfferSending(offers[0].id, claim.sendAttemptId, 'sent', 'superadmin@local.test');
  const deferred = await db.updatePriceOfferStatus(offers[0].id, 'ODLOZENA', 'superadmin@local.test', {
    reason: 'Zákazník čaká na termín rekonštrukcie.',
    nextFollowUpAt: '2099-12-31',
  });
  assert.equal(deferred?.status, 'ODLOZENA');
  assert.equal(deferred?.nextFollowUpAt, '2099-12-31');
  assert.equal((await db.updatePriceOfferStatus(offers[0].id, 'ODOSLANA', 'superadmin@local.test'))?.status, 'ODOSLANA');
  assert.equal((await db.updatePriceOfferStatus(offers[0].id, 'NEUSPESNA', 'superadmin@local.test', {
    reason: 'Zákazník si vybral inú ponuku.',
  }))?.status, 'NEUSPESNA');
  assert.equal((await db.getBusinessJob(offerJob.id))?.status, 'ZRUSENA');

  const local = JSON.parse(await readFile(databasePath, 'utf8'));
  const starvationOffer = local.priceOffers.find((offer) => offer.jobId === starvationValid.id);
  assert.ok(starvationOffer, 'platný kandidát musí mať presne identifikovateľnú pripravenú CP');
  assert.equal(local.auditLogs.some((entry) => entry.action === 'price_offer_send_sent'), true);
  assert.equal(local.auditLogs.some((entry) => entry.action === 'review_request_delivery_claimed'), false,
    'asistent nesmie prvú žiadosť sám odoslať');
  assert.equal(local.auditLogs.filter((entry) => entry.action === 'price_offer_created').length, 2);
  assert.equal(JSON.stringify(local.auditLogs).includes('Zákazník si vybral inú ponuku'), false,
    'voľný text dôvodu nesmie byť duplikovaný v auditnom logu');
  const runs = await db.listAdminAutopilotRuns(10);
  assert.equal(runs.length, 4);
  assert.equal(runs.every((run) => run.finishedAt && run.status === 'degraded'), true,
    'lokálny test nemá databázový foto modul, preto musí byť zhoršený stav trvalo viditeľný');
  assert.equal(runs.every((run) => run.unavailableModules.includes('photo_intake')), true);
  const starvationItems = await db.listAdminAutopilotRunItems(starvationRun.runId);
  assert.equal(starvationItems.some((item) => item.entityId === starvationBlocked.id && item.reasonCode === 'missing_material_type'), true);
  assert.equal(starvationItems.some((item) => item.entityId === starvationOffer.id && item.outcome === 'created'), true,
    'úspešná položka histórie musí ukazovať na presnú pripravenú CP, nie iba na zákazku');
  const serializedLedger = JSON.stringify({ runs, items: starvationItems });
  assert.equal(serializedLedger.includes('@example.com'), false);
  assert.equal(serializedLedger.includes('Zákazník'), false);
  console.log('PASS: asistent pripravuje idempotentne, nič sám neodosiela a bezpečne eviduje výsledok CP.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
