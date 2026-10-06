import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'astana-price-offer-local-'));
const databasePath = path.join(temporaryDirectory, 'local-db.json');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.ASTANA_LOCAL_DB_PATH = databasePath;
process.env.ADMIN_EMAIL = '';

const {
  savePriceOffer,
  claimPriceOfferForSending,
  finishPriceOfferSending,
  getPriceOffer,
  updatePriceOfferStatus,
} = await import(`../src/server/db.ts?local-offer-test=${randomUUID()}`);

const input = {
  objectType: 'Rodinný dom', objectAddress: 'Testovacia 1', municipality: 'Poprad', district: 'Popradský',
  contactPerson: 'Test', phone: '0900000000', email: 'test@example.com', realizationTerm: 'Dohodou',
  materialType: 'VLNITY_ETERNIT', areaM2: 10, pricePerM2WithoutVat: 10, documentationFeeWithoutVat: 0,
  includeDocumentation: false, documentationPromotion: false, includeTransport: false, transportFrom: '', transportTo: '',
  transportRoundTripKm: 0, transportPricePerKm: 0.7, validUntil: '2027-12-31', sourceInquiry: `test:${randomUUID()}`,
};

try {
  const offer = await savePriceOffer(input, 'local-integration-test');
  assert.equal(await updatePriceOfferStatus(offer.id, 'PRIJATA', 'local-integration-test'), null);
  const claims = await Promise.all([
    claimPriceOfferForSending(offer.id, 'local-integration-test'),
    claimPriceOfferForSending(offer.id, 'local-integration-test'),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  const claimed = claims.find(Boolean);
  assert.ok(claimed?.sendAttemptId);
  assert.equal((await finishPriceOfferSending(offer.id, claimed.sendAttemptId, 'sent', 'local-integration-test'))?.status, 'ODOSLANA');
  const accepted = await Promise.all([
    updatePriceOfferStatus(offer.id, 'PRIJATA', 'local-integration-test'),
    updatePriceOfferStatus(offer.id, 'PRIJATA', 'local-integration-test'),
  ]);
  assert.equal(accepted.filter(Boolean).length, 1);
  assert.equal((await getPriceOffer(offer.id))?.status, 'PRIJATA');

  const local = JSON.parse(await readFile(databasePath, 'utf8'));
  const actions = local.auditLogs.filter((entry) => entry.entityId === offer.id).map((entry) => entry.action);
  assert.equal(actions.filter((action) => action === 'price_offer_send_claimed').length, 1);
  assert.equal(actions.filter((action) => action === 'price_offer_send_sent').length, 1);
  assert.equal(actions.filter((action) => action === 'price_offer_status_changed').length, 1);
  console.log('PASS: lokálna CP používa atómový claim, odoslanie, prijatie a audit bez zacyklenia.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
