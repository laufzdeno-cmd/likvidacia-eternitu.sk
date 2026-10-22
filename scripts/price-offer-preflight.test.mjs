import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePriceOfferPreflight, priceOfferApprovalFingerprint } from '../src/server/price-offer-preflight.ts';

const settings = {
  materialPrices: { VLNITY_ETERNIT: 10, HLADKY_ETERNIT: 10, AZBESTOVE_RURY: 10, PODHLADOVE_DOSKY: 10, BOLETICKY: 10, INE: 10 },
  documentationFee: 161,
  vatRate: 23,
  preparedByName: 'ASTANA',
  preparedByPhone: '0905217946',
  company: { name: 'ASTANA, s.r.o.', street: 'Ulica 1', city: 'Poprad', postalCode: '058 01', phone: '0905217946', email: 'astana@example.test', mainWeb: 'astana.sk', asbestosWeb: 'likvidacia-eternitu.sk', ico: '1', dic: '2', icDph: '3', authorization: 'test', preparedByName: 'ASTANA', preparedByPhone: '0905217946', vatRate: 23 },
};

function offer(overrides = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001', number: '20260001', createdAt: '2026-10-15T08:00:00.000Z', status: 'PRIPRAVENA',
    objectType: 'Rodinný dom', objectAddress: 'Testovacia 1', municipality: 'Poprad', district: 'Poprad', contactPerson: 'Test', phone: '0900000000', email: 'zakaznik@example.test',
    realizationTerm: 'Dohodou', materialType: 'VLNITY_ETERNIT', areaM2: 50, pricePerM2WithoutVat: 10,
    documentationFeeWithoutVat: 0, includeDocumentation: false, documentationPromotion: false,
    includeTransport: false, transportFrom: '', transportTo: '', transportRoundTripKm: 0, transportPricePerKm: 0.7,
    validUntil: '2026-12-31', offerNote: '', internalNote: '', emailSubject: 'Cenová ponuka ASTANA',
    emailBody: 'Dobrý deň, posielame vám pripravenú cenovú ponuku.', sourceInquiry: 'test', vatRate: 23,
    materialPriceWithoutVat: 500, totalWithoutVat: 500, totalWithVat: 615,
    ...overrides,
  };
}

test('platná cenová ponuka prejde deterministickou kontrolou', () => {
  assert.deepEqual(evaluatePriceOfferPreflight(offer(), { now: new Date('2026-10-15T10:00:00+02:00') }), { blockers: [], warnings: [] });
});

test('kontrola zablokuje expiráciu, testovacie dáta, rozpor v cene a účtovanú dopravu nad 100 m2', () => {
  const result = evaluatePriceOfferPreflight(offer({ isTestData: true, validUntil: '2026-10-14', areaM2: 100,
    includeTransport: true, transportFrom: 'Poprad', transportTo: 'Košice', transportRoundTripKm: 220,
    transportPricePerKm: 0.7, materialPriceWithoutVat: 1, totalWithoutVat: 1, totalWithVat: 1 }),
  { now: new Date('2026-10-15T10:00:00+02:00') });
  assert.deepEqual(new Set(result.blockers.map((item) => item.code)), new Set(['test_offer', 'offer_expired', 'price_mismatch', 'transport_over_100']));
});

test('schvaľovací odtlačok sa zmení pri zmene ponuky alebo emailového nastavenia', () => {
  const original = priceOfferApprovalFingerprint(offer(), settings);
  assert.notEqual(priceOfferApprovalFingerprint(offer({ emailBody: 'Dobrý deň, toto je iná schválená verzia ponuky.' }), settings), original);
  assert.notEqual(priceOfferApprovalFingerprint(offer(), { ...settings, preparedByPhone: '0900000001' }), original);
  assert.notEqual(priceOfferApprovalFingerprint(offer({ isTestData: true }), settings), original);
  assert.notEqual(priceOfferApprovalFingerprint(offer({ jobId: '00000000-0000-4000-a000-000000000099' }), settings), original);
  const linkedOffer = offer({ jobId: '00000000-0000-4000-a000-000000000099' });
  assert.notEqual(
    priceOfferApprovalFingerprint(linkedOffer, settings, { linkedJobAvailable: false }),
    priceOfferApprovalFingerprint(linkedOffer, settings, { linkedJobAvailable: true }),
  );
});

test('po atómovom claime preflight prijme iba očakávaný stav odosielania', () => {
  assert.deepEqual(evaluatePriceOfferPreflight(offer({ status: 'ODOSIELA' }), {
    expectedStatus: 'ODOSIELA',
    now: new Date('2026-10-15T10:00:00+02:00'),
  }), { blockers: [], warnings: [] });
  assert.equal(evaluatePriceOfferPreflight(offer({ status: 'ODOSIELA', isTestData: true }), {
    expectedStatus: 'ODOSIELA',
    now: new Date('2026-10-15T10:00:00+02:00'),
  }).blockers.some((item) => item.code === 'test_offer'), true);
});

test('uzavretý dopyt zablokuje odoslanie a zneplatní predchádzajúce schválenie', () => {
  const prepared = offer({ leadId: '00000000-0000-4000-a000-000000000099' });
  const result = evaluatePriceOfferPreflight(prepared, {
    linkedLeadActive: false,
    now: new Date('2026-10-15T10:00:00+02:00'),
  });
  assert.ok(result.blockers.some((item) => item.code === 'parent_lead_closed'));
  assert.notEqual(
    priceOfferApprovalFingerprint(prepared, settings, { linkedLeadActive: true }),
    priceOfferApprovalFingerprint(prepared, settings, { linkedLeadActive: false }),
  );
});
