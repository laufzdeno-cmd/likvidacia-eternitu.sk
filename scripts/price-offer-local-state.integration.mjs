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
  for (const validUntil of ['2027-02-31', '2026-13-01', '2027-02-29']) {
    await assert.rejects(
      savePriceOffer({ ...input, validUntil, sourceInquiry: `test:${randomUUID()}` }, 'local-integration-test'),
      /skutočný kalendárny dátum/,
    );
  }
  const leapDayOffer = await savePriceOffer({ ...input, validUntil: '2028-02-29', sourceInquiry: `test:${randomUUID()}` }, 'local-integration-test');
  assert.equal(leapDayOffer.validUntil, '2028-02-29');
  const stateAfterDateValidation = JSON.parse(await readFile(databasePath, 'utf8'));
  assert.equal(stateAfterDateValidation.priceOffers.length, 1, 'neplatné dátumy nesmú vytvoriť lokálnu ponuku');
  assert.equal(stateAfterDateValidation.auditLogs.filter((entry) => entry.action === 'price_offer_created').length, 1,
    'neplatné dátumy nesmú vytvoriť lokálny audit');

  const concurrentOffers = await Promise.all(Array.from({ length: 8 }, () => savePriceOffer({ ...input, sourceInquiry: `test:${randomUUID()}` }, 'local-integration-test')));
  assert.equal(new Set(concurrentOffers.map((item) => item.number)).size, concurrentOffers.length, 'súbežné lokálne ponuky musia mať jedinečné čísla');
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
  await assert.rejects(
    savePriceOffer({ ...input, areaM2: 11 }, 'local-integration-test', offer.id),
    /Odoslanú alebo prijatú cenovú ponuku nie je možné upraviť/,
  );
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
  console.log('PASS: lokálna CP používa jedinečné čísla, nemennú odoslanú verziu, atómový claim, prijatie a audit.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
