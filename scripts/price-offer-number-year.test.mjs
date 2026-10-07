import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { priceOfferNumberYear } from '../src/lib/price-offer-number-year.ts';

test('číslo cenovej ponuky používa slovenský rok pri prechode cez polnoc', () => {
  assert.equal(priceOfferNumberYear(new Date('2026-12-31T22:30:00.000Z')), '2026');
  assert.equal(priceOfferNumberYear(new Date('2026-12-31T23:30:00.000Z')), '2027');
});

test('všetky cesty prideľovania čísla používajú slovenský rok', () => {
  const database = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert.equal((database.match(/priceOfferNumberYear\(\)/g) || []).length, 3);
  assert.doesNotMatch(database.slice(database.indexOf('export async function nextPriceOfferNumber'), database.indexOf('export async function getPriceOffer')), /getFullYear\(\)/);
});
