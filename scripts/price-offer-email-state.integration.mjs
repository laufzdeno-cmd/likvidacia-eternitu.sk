import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

let pglite;
let server;
let savePriceOffer;
let claimPriceOfferForSending;
let finishPriceOfferSending;
let getPriceOffer;
let resetUncertainPriceOfferSend;
let updatePriceOfferStatus;

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

async function startDatabase() {
  const port = await availablePort();
  pglite = await PGlite.create();
  server = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.ADMIN_EMAIL = '';
  ({ savePriceOffer, claimPriceOfferForSending, finishPriceOfferSending, getPriceOffer, resetUncertainPriceOfferSend, updatePriceOfferStatus } = await import('../src/server/db.ts'));
}

function offerInput() {
  return {
    objectType: 'Rodinný dom', objectAddress: 'Testovacia 1', municipality: 'Poprad', district: 'Popradský',
    contactPerson: 'Test', phone: '0900000000', email: 'test@example.com', realizationTerm: 'Dohodou',
    materialType: 'VLNITY_ETERNIT', areaM2: 10, pricePerM2WithoutVat: 10, documentationFeeWithoutVat: 0,
    includeDocumentation: false, documentationPromotion: false, includeTransport: false, transportFrom: '', transportTo: '',
    transportRoundTripKm: 0, transportPricePerKm: 0.7, validUntil: '2027-12-31', sourceInquiry: `test:${randomUUID()}`,
  };
}

async function testConcurrentClaimAndUnknownDelivery() {
  const offer = await savePriceOffer(offerInput(), 'integration-test');
  const claims = await Promise.all([
    claimPriceOfferForSending(offer.id, 'integration-test'),
    claimPriceOfferForSending(offer.id, 'integration-test'),
  ]);
  assert.equal(claims.filter(Boolean).length, 1, 'concurrent sends may claim a prepared offer only once');
  const claimed = claims.find(Boolean);
  assert.ok(claimed?.sendAttemptId, 'claimed send must have a unique attempt id');
  assert.equal((await getPriceOffer(offer.id))?.status, 'ODOSIELA');
  assert.equal((await finishPriceOfferSending(offer.id, claimed.sendAttemptId, 'unknown', 'integration-test'))?.status, 'NEISTY_STAV');
  assert.equal(await claimPriceOfferForSending(offer.id, 'integration-test'), null, 'uncertain delivery must not be sent again automatically');
  assert.equal(await resetUncertainPriceOfferSend(offer.id, 'integration-test'), null, 'fresh unknown delivery cannot be reset');

  await pglite.query("UPDATE price_offers SET send_started_at = now() - interval '16 minutes' WHERE id = $1", [offer.id]);
  assert.equal((await resetUncertainPriceOfferSend(offer.id, 'integration-test'))?.status, 'PRIPRAVENA');
  assert.equal((await getPriceOffer(offer.id))?.sendStartedAt, undefined);
}

async function testConcurrentOfferNumbers() {
  const offers = await Promise.all(Array.from({ length: 8 }, () => savePriceOffer(offerInput(), 'integration-test')));
  assert.equal(new Set(offers.map((offer) => offer.number)).size, offers.length, 'concurrent PostgreSQL saves must reserve unique offer numbers');
}

async function testCalendarDateValidation() {
  const valid = await savePriceOffer({ ...offerInput(), validUntil: '2028-02-29' }, 'integration-test');
  assert.equal(valid.validUntil, '2028-02-29');
  const before = await pglite.query("SELECT (SELECT COUNT(*)::int FROM price_offers) AS offers, (SELECT COUNT(*)::int FROM audit_logs WHERE action='price_offer_created') AS audits");
  for (const validUntil of ['2027-02-31', '2026-13-01', '2027-02-29']) {
    await assert.rejects(
      savePriceOffer({ ...offerInput(), validUntil }, 'integration-test'),
      /skutočný kalendárny dátum/,
    );
  }
  const after = await pglite.query("SELECT (SELECT COUNT(*)::int FROM price_offers) AS offers, (SELECT COUNT(*)::int FROM audit_logs WHERE action='price_offer_created') AS audits");
  assert.deepEqual(after.rows[0], before.rows[0], 'neplatné dátumy nesmú vytvoriť PostgreSQL ponuku ani audit');
}

async function testKnownNoSendAndSuccess() {
  const offer = await savePriceOffer(offerInput(), 'integration-test');
  assert.equal(await updatePriceOfferStatus(offer.id, 'PRIJATA', 'integration-test'), null, 'a prepared offer cannot be accepted before it is sent');
  const firstClaim = await claimPriceOfferForSending(offer.id, 'integration-test');
  assert.ok(firstClaim?.sendAttemptId);
  assert.equal((await finishPriceOfferSending(offer.id, firstClaim.sendAttemptId, 'not_sent', 'integration-test'))?.status, 'PRIPRAVENA');
  const secondClaim = await claimPriceOfferForSending(offer.id, 'integration-test');
  assert.ok(secondClaim?.sendAttemptId, 'a confirmed pre-send failure can be retried');
  assert.notEqual(secondClaim.sendAttemptId, firstClaim.sendAttemptId, 'every retry must have a distinct attempt id');
  assert.equal(await finishPriceOfferSending(offer.id, firstClaim.sendAttemptId, 'not_sent', 'integration-test'), null, 'an older attempt cannot finalize the current claim');
  assert.equal((await finishPriceOfferSending(offer.id, secondClaim.sendAttemptId, 'sent', 'integration-test'))?.status, 'ODOSLANA');
  assert.equal(await claimPriceOfferForSending(offer.id, 'integration-test'), null, 'sent offers cannot be resent');
  const acceptResults = await Promise.all([
    updatePriceOfferStatus(offer.id, 'PRIJATA', 'integration-test'),
    updatePriceOfferStatus(offer.id, 'PRIJATA', 'integration-test'),
  ]);
  assert.equal(acceptResults.filter(Boolean).length, 1, 'an already sent offer may be accepted atomically only once');
  assert.equal((await getPriceOffer(offer.id))?.status, 'PRIJATA');
}

let exitCode = 0;
try {
  await startDatabase();
  await testCalendarDateValidation();
  await testConcurrentOfferNumbers();
  await testConcurrentClaimAndUnknownDelivery();
  await testKnownNoSendAndSuccess();
  console.log('PASS: izolovaný PostgreSQL offer numbering, claim, unknown delivery, manuálna obnova a retry po potvrdenom no-send. Bez SMTP, Blobu, produkčnej DB alebo deployu.');
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
