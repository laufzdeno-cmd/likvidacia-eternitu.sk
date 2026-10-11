import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { initializePriceCalculators } = require('../src/lib/price-calculator.ts');

class MockEventTarget {
  listeners = new Map();

  addEventListener(type, listener) {
    const current = this.listeners.get(type) || new Set();
    current.add(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    const event = { currentTarget: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
}

class MockClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    const shouldAdd = force ?? !this.values.has(value);
    if (shouldAdd) this.values.add(value);
    else this.values.delete(value);
    return shouldAdd;
  }
}

function createCalculator(area = '120') {
  const input = Object.assign(new MockEventTarget(), { value: area });
  const quoteLink = new MockEventTarget();
  const transferStatus = { hidden: true };
  const areaOutput = { textContent: '' };
  const minOutput = { textContent: '' };
  const maxOutput = { textContent: '' };
  const materials = ['vlnity', 'hladky', 'boleticky', 'neviem'].map((priceMaterial, index) => {
    const button = Object.assign(new MockEventTarget(), {
      dataset: { priceMaterial },
      classList: new MockClassList(index === 0 ? ['is-active'] : []),
      attributes: new Map(),
      setAttribute(name, value) { this.attributes.set(name, value); },
    });
    return button;
  });
  const root = {
    querySelector(selector) {
      return ({
        '[data-price-area]': input,
        '[data-price-area-output]': areaOutput,
        '[data-price-min]': minOutput,
        '[data-price-max]': maxOutput,
        '[data-price-quote]': quoteLink,
        '[data-price-transfer-status]': transferStatus,
      })[selector] || null;
    },
    querySelectorAll(selector) {
      return selector === '[data-price-material]' ? materials : [];
    },
  };
  return { root, input, quoteLink, transferStatus, areaOutput, minOutput, maxOutput, materials };
}

function withCalculators(calculators, run) {
  const previousDocument = globalThis.document;
  globalThis.document = { querySelectorAll: () => calculators.map(({ root }) => root) };
  try {
    return run();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

function assertPrice(actual, expected, message) {
  assert.equal(actual.replace(/\s/g, ' '), expected, message);
}

test('all materials calculate the established ranges, including the smooth-eternit alias', () => {
  const calc = createCalculator();
  withCalculators([calc], () => {
    initializePriceCalculators();
    assert.equal(calc.areaOutput.textContent, '120 m2');
    assertPrice(calc.minOutput.textContent, '960 €');
    assertPrice(calc.maxOutput.textContent, '1 680 €');

    const expected = [
      ['hladky', '1 080 €', '1 800 €'],
      ['boleticky', '1 320 €', '2 160 €'],
      ['neviem', '960 €', '1 920 €'],
      ['vlnity', '960 €', '1 680 €'],
    ];
    for (const [material, minimum, maximum] of expected) {
      calc.materials.find((button) => button.dataset.priceMaterial === material).dispatch('click');
      assertPrice(calc.minOutput.textContent, minimum, material);
      assertPrice(calc.maxOutput.textContent, maximum, material);
    }
  });
});

test('area drag updates the estimate and records one analytics event on completion', () => {
  const calc = createCalculator();
  const analytics = [];
  withCalculators([calc], () => {
    initializePriceCalculators((...event) => analytics.push(event));
    calc.input.value = '200';
    calc.input.dispatch('input');
    assertPrice(calc.minOutput.textContent, '1 600 €');
    assertPrice(calc.maxOutput.textContent, '2 800 €');
    assert.equal(analytics.length, 0, 'continuous slider movement must not flood analytics');

    calc.input.dispatch('change');
    assert.deepEqual(analytics, [['price_calculator_change', { material: 'vlnity', area: '200' }]]);
    assert.equal(JSON.stringify(analytics).includes('Poprad'), false, 'calculator analytics must not include locality');
  });
});

test('multiple calculators stay independent and setup-cleanup-setup does not duplicate handlers', () => {
  const first = createCalculator();
  const second = createCalculator('300');
  const analytics = [];
  withCalculators([first, second], () => {
    const cleanup = initializePriceCalculators((...event) => analytics.push(event));
    first.materials.find((button) => button.dataset.priceMaterial === 'hladky').dispatch('click');
    assertPrice(first.minOutput.textContent, '1 080 €');
    assertPrice(second.minOutput.textContent, '2 400 €');
    cleanup();

    first.input.value = '200';
    first.input.dispatch('input');
    first.input.dispatch('change');
    first.materials.find((button) => button.dataset.priceMaterial === 'neviem').dispatch('click');
    assert.equal(analytics.length, 1, 'listeners are removed after cleanup');

    const cleanupAgain = initializePriceCalculators((...event) => analytics.push(event));
    first.input.dispatch('change');
    first.materials.find((button) => button.dataset.priceMaterial === 'neviem').dispatch('click');
    assert.equal(analytics.length, 3, 'one event per material click and one per completed slider change');
    cleanupAgain();
  });
});

test('campaign parameters prefill only the calculator selection and area', () => {
  const { priceRedirectTarget } = require('../src/server/price-redirect.ts');
  const redirect = priceRedirectTarget({ utm_source: 'google', utm_id: 'campaign-9', material: 'boleticky', plocha: '240', city: 'Poprad' });
  const calc = createCalculator();
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: new URL(redirect, 'https://example.test').search } };
  try {
    const cleanup = withCalculators([calc], () => initializePriceCalculators());
    assert.equal(calc.input.value, '240');
    assert.equal(calc.materials.find((button) => button.classList.contains('is-active')).dataset.priceMaterial, 'boleticky');
    assertPrice(calc.minOutput.textContent, '2 640 €');
    assertPrice(calc.maxOutput.textContent, '4 320 €');
    cleanup();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('calculator quote action fills area and material without touching locality, contact or consent', () => {
  const calc = createCalculator();
  const fields = {
    areaEstimate: { value: '' }, city: { value: 'Poprad' },
    materialType: { value: '', options: [{ value: 'Hladký / štvorcový eternit' }] },
    email: { value: 'existing@example.test' }, consent: { checked: true },
  };
  const form = { querySelector: (selector) => fields[selector.match(/name="([^"]+)"/)?.[1]] || null };
  const previousDocument = globalThis.document;
  globalThis.document = {
    querySelectorAll: () => [calc.root],
    querySelector: (selector) => selector === '.lead-form' ? form : null,
  };
  try {
    const cleanup = initializePriceCalculators();
    calc.input.value = '250';
    calc.materials[1].dispatch('click');
    calc.quoteLink.dispatch('click');
    assert.deepEqual([fields.areaEstimate.value, fields.city.value, fields.materialType.value], ['250', 'Poprad', 'Hladký / štvorcový eternit']);
    assert.equal(fields.email.value, 'existing@example.test');
    assert.equal(fields.consent.checked, true);
    cleanup();
    calc.input.value = '300';
    calc.quoteLink.dispatch('click');
    assert.equal(fields.areaEstimate.value, '250', 'cleanup removes quote prefill listener');
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('blocked browser storage leaves the visitor on the price page with a manual route to the form', () => {
  const calc = createCalculator();
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = { querySelectorAll: () => [calc.root], querySelector: () => null };
  globalThis.window = { sessionStorage: { setItem() { throw new Error('blocked'); } } };
  try {
    const cleanup = initializePriceCalculators();
    const click = calc.quoteLink.dispatch('click');
    assert.equal(click.defaultPrevented, true);
    assert.equal(calc.transferStatus.hidden, false);
    cleanup();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('calculator transfers area/material and preserves an existing inquiry city', () => {
  const calc = createCalculator('200');
  const fields = {
    areaEstimate: { value: '' }, city: { value: 'Poprad' },
    materialType: { value: '', options: [{ value: 'Vlnitý eternit' }] },
    email: { value: 'existing@example.test' }, gdpr: { checked: false },
  };
  const previousDocument = globalThis.document;
  globalThis.document = {
    querySelectorAll: () => [calc.root],
    querySelector: () => ({ querySelector: (selector) => fields[selector.match(/name="([^"]+)"/)?.[1]] || null }),
  };
  try {
    const cleanup = initializePriceCalculators();
    assertPrice(calc.minOutput.textContent, '1 600 €');
    calc.quoteLink.dispatch('click');
    assert.deepEqual([fields.areaEstimate.value, fields.materialType.value, fields.city.value], ['200', 'Vlnitý eternit', 'Poprad']);
    assert.equal(fields.email.value, 'existing@example.test');
    assert.equal(fields.gdpr.checked, false);
    cleanup();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
