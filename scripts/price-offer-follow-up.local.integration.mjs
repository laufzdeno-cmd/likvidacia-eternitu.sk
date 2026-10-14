import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ownedTestRoot = path.join(process.cwd(), 'tmp');
await mkdir(ownedTestRoot, { recursive: true });
const temporaryDirectory = await mkdtemp(path.join(ownedTestRoot, 'astana-offer-follow-up-local-'));
const databasePath = path.join(temporaryDirectory, 'local-db.json');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.ASTANA_LOCAL_DB_PATH = databasePath;
process.env.ADMIN_EMAIL = '';

const {
  claimPriceOfferFollowUp,
  claimPriceOfferForSending,
  finishPriceOfferFollowUp,
  finishPriceOfferSending,
  listPriceOfferFollowUps,
  listPlannerActions,
  markPlannerNotificationSent,
  resolveUnknownPriceOfferFollowUp,
  savePlannerAction,
  savePriceOffer,
} = await import(`../src/server/db.ts?offer-follow-up-local=${randomUUID()}`);

const actor = 'admin@local.test';
const offerInput = {
  objectType: 'Rodinný dom', objectAddress: 'Testovacia 1', municipality: 'Poprad', district: 'Popradský',
  contactPerson: 'Test', phone: '0900000000', email: 'zakaznik@example.test', realizationTerm: 'Dohodou',
  materialType: 'VLNITY_ETERNIT', areaM2: 10, pricePerM2WithoutVat: 10, documentationFeeWithoutVat: 0,
  includeDocumentation: false, documentationPromotion: false, includeTransport: false, transportFrom: '', transportTo: '',
  transportRoundTripKm: 0, transportPricePerKm: 0.7, validUntil: '2027-12-31', sourceInquiry: `test:${randomUUID()}`,
};

const plannerInput = {
  date: '2026-11-20', timeFrom: '08:00', timeTo: '12:00', type: 'DEMONTAZ', address: 'Poprad', jobId: '',
  workers: 'Ján', customerName: 'Test', customerEmail: 'zakaznik@example.test', customerPhone: '0900000000',
  note: 'Pôvodná poznámka', status: 'NAPLANOVANA', notify2Days: true, notify1Day: true, notifyCustomer: true,
};

try {
  const offer = await savePriceOffer(offerInput, actor);
  const sendClaim = await claimPriceOfferForSending(offer.id, actor);
  assert.ok(sendClaim?.sendAttemptId);
  await finishPriceOfferSending(offer.id, sendClaim.sendAttemptId, 'sent', actor);

  const operationId = randomUUID();
  const followUpInput = { offerId: offer.id, operationId, subject: 'Kontrola cenovej ponuky', body: 'Dobrý deň, prosíme o spätnú väzbu k cenovej ponuke.', actorEmail: actor };
  const claims = await Promise.all([
    claimPriceOfferFollowUp(followUpInput),
    claimPriceOfferFollowUp(followUpInput),
  ]);
  assert.equal(claims.filter(Boolean).length, 1, 'rovnaká operácia smie získať iba jeden claim');
  const claim = claims.find(Boolean);
  assert.equal(claim.recipient, offerInput.email);
  assert.equal(await claimPriceOfferFollowUp({ ...followUpInput, operationId: randomUUID() }), null, 'súbežne nesmie vzniknúť druhý follow-up');
  await finishPriceOfferFollowUp(claim.id, 'not_sent', '', 'SMTP refused zakaznik@example.test', actor);
  assert.equal(await claimPriceOfferFollowUp(followUpInput), null, 'použité operationId sa nesmie opätovne odoslať');

  const staleClaim = await claimPriceOfferFollowUp({ ...followUpInput, operationId: randomUUID() });
  assert.ok(staleClaim);
  const interruptedSnapshot = JSON.parse(await readFile(databasePath, 'utf8'));
  interruptedSnapshot.priceOfferFollowUps.find((item) => item.id === staleClaim.id).updatedAt = new Date(Date.now() - 16 * 60_000).toISOString();
  await writeFile(databasePath, JSON.stringify(interruptedSnapshot, null, 2), 'utf8');
  const recoveredHistory = await listPriceOfferFollowUps(offer.id);
  const recovered = recoveredHistory.find((item) => item.id === staleClaim.id);
  assert.equal(recovered?.status, 'unknown', 'prerušený claim sa po limite musí zmeniť na unknown');
  assert.equal(await claimPriceOfferFollowUp({ ...followUpInput, operationId: randomUUID() }), null, 'neistý výsledok musí zablokovať opakovanie');
  const notSentResolutionId = randomUUID();
  const notSentResolution = { id: staleClaim.id, offerId: offer.id, expectedRevision: recovered.revision,
    resolution: 'not_sent', evidenceCode: 'provider_no_record', operationId: notSentResolutionId, actorEmail: actor };
  const resolvedNotSent = await resolveUnknownPriceOfferFollowUp(notSentResolution);
  assert.equal(resolvedNotSent?.status, 'failed');
  assert.equal((await resolveUnknownPriceOfferFollowUp(notSentResolution))?.revision, resolvedNotSent.revision,
    'opakované manuálne potvrdenie musí byť idempotentné');

  const retryClaim = await claimPriceOfferFollowUp({ ...followUpInput, operationId: randomUUID() });
  assert.ok(retryClaim, 'nový pokus je povolený až po výslovnom potvrdení not_sent');
  await finishPriceOfferFollowUp(retryClaim.id, 'unknown', '<smtp-message-id>', 'Timeout zakaznik@example.test', actor);
  const retryUnknown = (await listPriceOfferFollowUps(offer.id)).find((item) => item.id === retryClaim.id);
  const resolvedSent = await resolveUnknownPriceOfferFollowUp({ id: retryClaim.id, offerId: offer.id,
    expectedRevision: retryUnknown.revision, resolution: 'sent', evidenceCode: 'sent_folder_verified',
    operationId: randomUUID(), actorEmail: actor });
  assert.equal(resolvedSent?.status, 'sent');
  const history = await listPriceOfferFollowUps(offer.id);
  assert.deepEqual(history.map((item) => item.status).sort(), ['failed', 'failed', 'sent']);
  assert.equal('recipient' in history[0], false, 'história nesmie vracať adresáta');
  assert.equal('body' in history[0], false, 'história nesmie vracať telo správy');

  const planner = await savePlannerAction(plannerInput, actor);
  await markPlannerNotificationSent(planner.id, 'notify2DaysSent');
  await markPlannerNotificationSent(planner.id, 'notify1DaySent');
  await markPlannerNotificationSent(planner.id, 'notifyCustomerSent');
  const noteOnly = await savePlannerAction({ ...plannerInput, note: 'Iba zmenená poznámka' }, actor, planner.id);
  assert.deepEqual([noteOnly.notify2DaysSent, noteOnly.notify1DaySent, noteOnly.notifyCustomerSent], [true, true, true]);
  const recipientChanged = await savePlannerAction({ ...plannerInput, note: 'Iba zmenený adresát', customerEmail: 'iny@example.test' }, actor, planner.id);
  assert.deepEqual([recipientChanged.notify2DaysSent, recipientChanged.notify1DaySent, recipientChanged.notifyCustomerSent], [true, true, false]);
  await markPlannerNotificationSent(planner.id, 'notifyCustomerSent');
  const timeChanged = await savePlannerAction({ ...plannerInput, customerEmail: 'iny@example.test', timeFrom: '09:00' }, actor, planner.id);
  assert.deepEqual([timeChanged.notify2DaysSent, timeChanged.notify1DaySent, timeChanged.notifyCustomerSent], [false, false, false]);
  assert.equal((await listPlannerActions()).length, 1);

  const local = JSON.parse(await readFile(databasePath, 'utf8'));
  const followUpAudits = local.auditLogs.filter((entry) => entry.action.startsWith('price_offer_follow_up_'));
  assert.equal(followUpAudits.length, 8);
  for (const entry of followUpAudits) {
    const changes = JSON.stringify(entry.changes);
    assert.doesNotMatch(changes, /zakaznik@example\.test|Dobrý deň|Timeout|SMTP refused/);
  }
  assert.deepEqual(local.priceOfferFollowUps.map((item) => item.errorCode).sort(), ['manual_not_sent', 'manual_smtp_accepted', 'smtp_not_sent']);
  console.log('PASS: lokálny follow-up je idempotentný, fail-closed a audit neobsahuje PII; plánovač resetuje iba relevantné potvrdenia.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
