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
const { reconcileAdminAutopilot } = await import('../src/server/admin-autopilot.ts');

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
  const offerJob = await db.saveBusinessJob(jobInput('DOPYT', 'ponuka'), 'superadmin@local.test');
  const completedJob = await db.saveBusinessJob(jobInput('DOKONCENA', 'referencia'), 'superadmin@local.test');
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
  assert.equal(local.auditLogs.some((entry) => entry.action === 'price_offer_send_sent'), true);
  assert.equal(local.auditLogs.some((entry) => entry.action === 'review_request_delivery_claimed'), false,
    'asistent nesmie prvú žiadosť sám odoslať');
  assert.equal(local.auditLogs.filter((entry) => entry.action === 'price_offer_created').length, 1);
  assert.equal(JSON.stringify(local.auditLogs).includes('Zákazník si vybral inú ponuku'), false,
    'voľný text dôvodu nesmie byť duplikovaný v auditnom logu');
  console.log('PASS: asistent pripravuje idempotentne, nič sám neodosiela a bezpečne eviduje výsledok CP.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
