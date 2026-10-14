import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

let pglite;
let server;
let exitCode = 0;

try {
  const port = await availablePort();
  pglite = await PGlite.create();
  server = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.ADMIN_EMAIL = '';

  const {
    claimPriceOfferFollowUp,
    claimPriceOfferForSending,
    finishPriceOfferFollowUp,
    finishPriceOfferSending,
    listPriceOfferFollowUps,
    markPlannerNotificationSent,
    resolveUnknownPriceOfferFollowUp,
    savePlannerAction,
    savePriceOffer,
  } = await import(`../src/server/db.ts?offer-follow-up-postgres=${randomUUID()}`);

  const actor = 'admin@postgres.test';
  const offer = await savePriceOffer({
    objectType: 'Rodinný dom', objectAddress: 'Testovacia 1', municipality: 'Poprad', district: 'Popradský',
    contactPerson: 'Test', phone: '0900000000', email: 'zakaznik@example.test', realizationTerm: 'Dohodou',
    materialType: 'VLNITY_ETERNIT', areaM2: 10, pricePerM2WithoutVat: 10, documentationFeeWithoutVat: 0,
    includeDocumentation: false, documentationPromotion: false, includeTransport: false, transportFrom: '', transportTo: '',
    transportRoundTripKm: 0, transportPricePerKm: 0.7, validUntil: '2027-12-31', sourceInquiry: `test:${randomUUID()}`,
  }, actor);
  const sendClaim = await claimPriceOfferForSending(offer.id, actor);
  assert.ok(sendClaim?.sendAttemptId);
  await finishPriceOfferSending(offer.id, sendClaim.sendAttemptId, 'sent', actor);

  const operationId = randomUUID();
  const followUpInput = { offerId: offer.id, operationId, subject: 'Kontrola cenovej ponuky', body: 'Dobrý deň, prosíme o spätnú väzbu k cenovej ponuke.', actorEmail: actor };
  const claims = await Promise.all([
    claimPriceOfferFollowUp(followUpInput),
    claimPriceOfferFollowUp(followUpInput),
  ]);
  assert.equal(claims.filter(Boolean).length, 1, 'PostgreSQL musí atómovo povoliť iba jeden claim');
  const claim = claims.find(Boolean);
  assert.equal(await claimPriceOfferFollowUp({ ...followUpInput, operationId: randomUUID() }), null);
  await finishPriceOfferFollowUp(claim.id, 'not_sent', '', 'SMTP refused zakaznik@example.test', actor);
  assert.equal(await claimPriceOfferFollowUp(followUpInput), null, 'operationId musí zostať jednorazové');

  const staleClaim = await claimPriceOfferFollowUp({ ...followUpInput, operationId: randomUUID() });
  assert.ok(staleClaim);
  await pglite.query("UPDATE price_offer_follow_ups SET updated_at = now() - interval '16 minutes' WHERE id = $1", [staleClaim.id]);
  const recoveredHistory = await listPriceOfferFollowUps(offer.id);
  const recovered = recoveredHistory.find((item) => item.id === staleClaim.id);
  assert.equal(recovered?.status, 'unknown', 'prerušený PostgreSQL claim sa po limite musí zmeniť na unknown');
  assert.equal(await claimPriceOfferFollowUp({ ...followUpInput, operationId: randomUUID() }), null, 'neistý výsledok musí zablokovať opakovanie');
  const notSentResolutionId = randomUUID();
  const notSentResolution = { id: staleClaim.id, offerId: offer.id, expectedRevision: recovered.revision,
    resolution: 'not_sent', evidenceCode: 'provider_no_record', operationId: notSentResolutionId, actorEmail: actor };
  const resolvedNotSent = await resolveUnknownPriceOfferFollowUp(notSentResolution);
  assert.equal(resolvedNotSent?.status, 'failed');
  assert.equal((await resolveUnknownPriceOfferFollowUp(notSentResolution))?.revision, resolvedNotSent.revision);

  const retryClaim = await claimPriceOfferFollowUp({ ...followUpInput, operationId: randomUUID() });
  assert.ok(retryClaim, 'retry musí byť povolený až po výslovnom potvrdení not_sent');
  await finishPriceOfferFollowUp(retryClaim.id, 'unknown', '<smtp-message-id>', 'Timeout zakaznik@example.test', actor);
  const retryUnknown = (await listPriceOfferFollowUps(offer.id)).find((item) => item.id === retryClaim.id);
  const resolvedSent = await resolveUnknownPriceOfferFollowUp({ id: retryClaim.id, offerId: offer.id,
    expectedRevision: retryUnknown.revision, resolution: 'sent', evidenceCode: 'sent_folder_verified',
    operationId: randomUUID(), actorEmail: actor });
  assert.equal(resolvedSent?.status, 'sent');
  assert.deepEqual((await listPriceOfferFollowUps(offer.id)).map((item) => item.status).sort(), ['failed', 'failed', 'sent']);

  const plannerInput = {
    date: '2026-11-20', timeFrom: '08:00', timeTo: '12:00', type: 'DEMONTAZ', address: 'Poprad', jobId: '',
    workers: 'Ján', customerName: 'Test', customerEmail: 'zakaznik@example.test', customerPhone: '0900000000',
    note: 'Pôvodná poznámka', status: 'NAPLANOVANA', notify2Days: true, notify1Day: true, notifyCustomer: true,
  };
  const planner = await savePlannerAction(plannerInput, actor);
  await markPlannerNotificationSent(planner.id, 'notify2DaysSent');
  await markPlannerNotificationSent(planner.id, 'notify1DaySent');
  await markPlannerNotificationSent(planner.id, 'notifyCustomerSent');
  const noteOnly = await savePlannerAction({ ...plannerInput, note: 'Iba zmenená poznámka' }, actor, planner.id);
  assert.deepEqual([noteOnly.notify2DaysSent, noteOnly.notify1DaySent, noteOnly.notifyCustomerSent], [true, true, true]);
  const recipientChanged = await savePlannerAction({ ...plannerInput, customerEmail: 'iny@example.test' }, actor, planner.id);
  assert.deepEqual([recipientChanged.notify2DaysSent, recipientChanged.notify1DaySent, recipientChanged.notifyCustomerSent], [true, true, false]);
  await markPlannerNotificationSent(planner.id, 'notifyCustomerSent');
  const timeChanged = await savePlannerAction({ ...plannerInput, customerEmail: 'iny@example.test', timeTo: '13:00' }, actor, planner.id);
  assert.deepEqual([timeChanged.notify2DaysSent, timeChanged.notify1DaySent, timeChanged.notifyCustomerSent], [false, false, false]);

  const audits = await pglite.query("SELECT changes::text AS changes FROM audit_logs WHERE action LIKE 'price_offer_follow_up_%'");
  assert.equal(audits.rows.length, 8);
  for (const row of audits.rows) assert.doesNotMatch(String(row.changes), /zakaznik@example\.test|Dobrý deň|Timeout|SMTP refused/);
  const persisted = await pglite.query('SELECT status, error_code FROM price_offer_follow_ups ORDER BY created_at');
  assert.deepEqual(persisted.rows.map((row) => [row.status, row.error_code]),
    [['failed', 'smtp_not_sent'], ['failed', 'manual_not_sent'], ['sent', 'manual_smtp_accepted']]);
  console.log('PASS: PostgreSQL follow-up je atómový, idempotentný a fail-closed; plánovač resetuje iba relevantné potvrdenia. Bez SMTP a produkčnej DB.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try {
    await server?.stop();
    await pglite?.close();
  } catch (error) {
    console.error('Cleanup failed:', error);
    exitCode = 1;
  }
}

process.exit(exitCode);
