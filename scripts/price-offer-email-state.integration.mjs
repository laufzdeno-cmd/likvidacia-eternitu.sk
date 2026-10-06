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
  ({ savePriceOffer, claimPriceOfferForSending, finishPriceOfferSending, getPriceOffer, resetUncertainPriceOfferSend } = await import('../src/server/db.ts'));
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
  assert.equal((await getPriceOffer(offer.id))?.status, 'ODOSIELA');
  assert.equal((await finishPriceOfferSending(offer.id, 'unknown', 'integration-test'))?.status, 'NEISTY_STAV');
  assert.equal(await claimPriceOfferForSending(offer.id, 'integration-test'), null, 'uncertain delivery must not be sent again automatically');
  assert.equal(await resetUncertainPriceOfferSend(offer.id, 'integration-test'), null, 'fresh unknown delivery cannot be reset');

  await pglite.query("UPDATE price_offers SET send_started_at = now() - interval '16 minutes' WHERE id = $1", [offer.id]);
  assert.equal((await resetUncertainPriceOfferSend(offer.id, 'integration-test'))?.status, 'PRIPRAVENA');
  assert.equal((await getPriceOffer(offer.id))?.sendStartedAt, undefined);
}

async function testKnownNoSendAndSuccess() {
  const offer = await savePriceOffer(offerInput(), 'integration-test');
  assert.ok(await claimPriceOfferForSending(offer.id, 'integration-test'));
  assert.equal((await finishPriceOfferSending(offer.id, 'not_sent', 'integration-test'))?.status, 'PRIPRAVENA');
  assert.ok(await claimPriceOfferForSending(offer.id, 'integration-test'), 'a confirmed pre-send failure can be retried');
  assert.equal((await finishPriceOfferSending(offer.id, 'sent', 'integration-test'))?.status, 'ODOSLANA');
  assert.equal(await claimPriceOfferForSending(offer.id, 'integration-test'), null, 'sent offers cannot be resent');
}

let exitCode = 0;
try {
  await startDatabase();
  await testConcurrentClaimAndUnknownDelivery();
  await testKnownNoSendAndSuccess();
  console.log('PASS: izolovaný PostgreSQL offer claim, súbežnosť, unknown delivery, manuálna obnova a retry po potvrdenom no-send. Bez SMTP, Blobu, produkčnej DB alebo deployu.');
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
