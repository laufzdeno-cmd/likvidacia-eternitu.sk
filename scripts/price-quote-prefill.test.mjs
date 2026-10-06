import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { applyPriceQuoteDraft, createPriceQuoteDraft, savePriceQuoteDraft, takePriceQuoteDraft } = require('../src/lib/price-quote-prefill.ts');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('all calculator choices map exactly to lead material and carry area and optional city', () => {
  const expected = [
    ['vlnity', 'Vlnitý eternit'],
    ['hladky', 'Hladký / štvorcový eternit'],
    ['boleticky', 'Boletické panely'],
    ['neviem', 'Neviem posúdiť'],
  ];
  for (const [key, material] of expected) {
    assert.deepEqual(createPriceQuoteDraft('120', key, '  Spišská   Nová Ves  ', 1000), {
      area: 120, material, city: 'Spišská Nová Ves', createdAt: 1000,
    });
  }
  assert.equal(createPriceQuoteDraft('500', 'vlnity', '', 1000)?.city, '');
  assert.equal(createPriceQuoteDraft('0', 'vlnity', '', 1000), null);
  assert.equal(createPriceQuoteDraft('501', 'vlnity', '', 1000), null);
  assert.equal(createPriceQuoteDraft('120', 'injected', '', 1000), null);
});

test('cross-page draft is one-use, short-lived and rejects edited browser storage', () => {
  const storage = memoryStorage();
  const draft = createPriceQuoteDraft('200', 'hladky', 'Poprad', 1000);
  assert.equal(savePriceQuoteDraft(draft, storage), true);
  assert.deepEqual(takePriceQuoteDraft(storage, 2000), draft);
  assert.equal(takePriceQuoteDraft(storage, 2000), null);
  savePriceQuoteDraft(draft, storage);
  assert.equal(takePriceQuoteDraft(storage, 1000 + 10 * 60_000 + 1), null);
  storage.setItem('astana:price-quote-draft:v1', JSON.stringify({ ...draft, material: '<script>', city: 'X' }));
  assert.equal(takePriceQuoteDraft(storage, 2000), null);
  assert.equal(savePriceQuoteDraft(draft, { setItem() { throw new Error('storage blocked'); } }), false);
});

test('prefill changes only quote fields and preserves existing contact, consent and city when no city was entered', () => {
  const fields = {
    areaEstimate: { value: '' }, materialType: { value: '', options: [
      { value: 'Vlnitý eternit' }, { value: 'Hladký / štvorcový eternit' }, { value: 'Boletické panely' }, { value: 'Neviem posúdiť' },
    ] }, city: { value: 'Kežmarok' }, email: { value: 'existing@example.test' }, consent: { checked: true },
  };
  const form = { querySelector: (selector) => fields[selector.match(/name="([^"]+)"/)?.[1]] || null };
  applyPriceQuoteDraft(form, createPriceQuoteDraft('300', 'boleticky', ''));
  assert.equal(fields.areaEstimate.value, '300');
  assert.equal(fields.materialType.value, 'Boletické panely');
  assert.equal(fields.city.value, 'Kežmarok');
  assert.equal(fields.email.value, 'existing@example.test');
  assert.equal(fields.consent.checked, true);
  applyPriceQuoteDraft(form, createPriceQuoteDraft('100', 'neviem', 'Poprad'));
  assert.equal(fields.city.value, 'Poprad');
});
