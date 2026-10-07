import assert from 'node:assert/strict';
import test from 'node:test';

const subject = '019a4321-5e89-4aa9-9b09-775123456789';

function browserHarness() {
  const cookies = new Map([
    ['astana_marketing_consent', 'granted'],
    ['astana_marketing_consent_subject', subject],
  ]);
  const storage = new Map();
  const document = {};
  Object.defineProperty(document, 'cookie', {
    get: () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
    set: (value) => {
      const [pair] = String(value).split(';');
      const separator = pair.indexOf('=');
      cookies.set(decodeURIComponent(pair.slice(0, separator)), pair.slice(separator + 1));
    },
  });
  return {
    cookies,
    document,
    storage,
    window: {
      location: { protocol: 'https:' },
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
    },
  };
}

test('marketing state is read independently when analytics cookie is missing', async () => {
  const harness = browserHarness();
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  try {
    globalThis.window = harness.window;
    globalThis.document = harness.document;
    const consent = await import('../src/lib/marketing-consent.ts');
    assert.equal(consent.readConsentPreferences(), null);
    assert.equal(consent.hasMarketingConsent(), true);
    assert.deepEqual(consent.readConsentCategoryPreferences(), { analytics: false, marketing: true });
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});

test('failed revocation remains pending and a later retry clears the durable marker', async () => {
  const harness = browserHarness();
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.window = harness.window;
    globalThis.document = harness.document;
    const consent = await import('../src/lib/marketing-consent.ts');
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal(await consent.revokePendingMetaCapiOutbox(), false);
    assert.equal(consent.hasPendingMarketingRevocation(), true);

    let fetchCalls = 0;
    let release;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      await new Promise((resolve) => { release = resolve; });
      return { ok: true, json: async () => ({ ok: true, revoked: 1 }) };
    };
    const firstRetry = consent.revokePendingMetaCapiOutbox();
    const duplicateRetry = consent.revokePendingMetaCapiOutbox();
    assert.equal(fetchCalls, 1);
    release();
    assert.equal(await firstRetry, true);
    assert.equal(await duplicateRetry, true);
    assert.equal(consent.hasPendingMarketingRevocation(), false);
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousFetch === undefined) delete globalThis.fetch; else globalThis.fetch = previousFetch;
  }
});
