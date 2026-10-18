import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { toPriceOfferJobOption } = require('../src/lib/price-offer-job-option.ts');
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const allowedKeys = [
  'customerEmail', 'customerName', 'customerPhone', 'district', 'id', 'leadSource',
  'location', 'm2', 'materialType', 'objectType', 'term',
];

test('cenová ponuka serializuje iba minimálny nefinančný DTO zákazky', () => {
  const option = toPriceOfferJobOption({
    id: 'job-1', customerName: 'Test', customerPhone: '0900000000', customerEmail: 'test@example.com',
    location: 'Poprad', district: 'Poprad', materialType: 'Vlnitý eternit', objectType: 'Rodinný dom',
    term: 'Dohodou', leadSource: 'dopyt:lead-1', m2: 120,
    totalPrice: 9_999, pricePerM2: 99, paymentType: 'CASH', costs: { total: 5_000 },
    workers: [{ rate: 40, reward: 4_000 }], rewardsTotal: 4_000, grossProfit: 999, marginPercent: 10,
  });

  assert.deepEqual(Object.keys(option).sort(), allowedKeys);
  for (const forbidden of ['totalPrice', 'pricePerM2', 'paymentType', 'costs', 'workers', 'rewardsTotal', 'grossProfit', 'marginPercent']) {
    assert.equal(Object.hasOwn(option, forbidden), false, forbidden);
  }
});

test('obe stránky ponúk načítajú bezpečnú projekciu a klientsky formulár odmieta celý BusinessJob', async () => {
  const [detail, create, form] = await Promise.all([
    read('app/admin/(protected)/ponuky/[id]/page.tsx'),
    read('app/admin/(protected)/ponuky/nova/page.tsx'),
    read('app/admin/(protected)/ponuky/offer-form.tsx'),
  ]);

  for (const page of [detail, create]) {
    assert.match(page, /listOperationalBusinessJobs\(\)/);
    assert.match(page, /toPriceOfferJobOption/);
    assert.doesNotMatch(page, /listBusinessJobs\(\)/);
  }
  assert.match(form, /jobs: PriceOfferJobOption\[\]/);
  assert.doesNotMatch(form, /\bBusinessJob\b/);
});
