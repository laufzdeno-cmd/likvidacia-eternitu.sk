import assert from 'node:assert/strict';
import test from 'node:test';

const subject = '019a4321-5e89-4aa9-9b09-775123456789';

function browserHarness({ storageUnavailable = false } = {}) {
  const cookies = new Map([
    ['astana_marketing_consent', 'granted'],
    ['astana_marketing_consent_subject', subject],
  ]);
  const storage = new Map();
  let uuidCounter = 0;
  const uuids = [
    '019a4321-5e89-4aa9-9b09-775987654321',
    '019a4321-5e89-4aa9-9b09-775987654322',
    '019a4321-5e89-4aa9-9b09-775987654323',
  ];
  const document = {};
  Object.defineProperty(document, 'cookie', {
    get: () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
    set: (value) => {
      const serialized = String(value);
      const [pair] = serialized.split(';');
      const separator = pair.indexOf('=');
      const key = decodeURIComponent(pair.slice(0, separator));
      if (/Max-Age=0(?:;|$)/i.test(serialized)) cookies.delete(key);
      else cookies.set(key, pair.slice(separator + 1));
    },
  });
  return {
    cookies,
    document,
    storage,
    window: {
      location: { protocol: 'https:' },
      crypto: { randomUUID: () => uuids[uuidCounter++] || `019a4321-5e89-4aa9-9b09-${String(uuidCounter).padStart(12, '0')}` },
      dispatchEvent: () => true,
      sessionStorage: {
        getItem: (key) => storage.get(`session:${key}`) ?? null,
        setItem: (key, value) => storage.set(`session:${key}`, value),
        removeItem: (key) => storage.delete(`session:${key}`),
      },
      localStorage: {
        getItem: (key) => {
          if (storageUnavailable) throw new DOMException('blocked', 'SecurityError');
          return storage.get(key) ?? null;
        },
        setItem: (key, value) => {
          if (storageUnavailable) throw new DOMException('blocked', 'SecurityError');
          storage.set(key, value);
        },
        removeItem: (key) => {
          if (storageUnavailable) throw new DOMException('blocked', 'SecurityError');
          storage.delete(key);
        },
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

test('a hanging revocation times out, keeps marketing denied and allows a clean retry', async () => {
  const harness = browserHarness();
  harness.cookies.set('astana_marketing_consent', 'denied');
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.window = harness.window;
    globalThis.document = harness.document;
    const consent = await import('../src/lib/marketing-consent.ts');
    globalThis.fetch = async () => new Promise(() => {});

    assert.equal(await consent.revokePendingMetaCapiOutbox(25), false);
    assert.equal(consent.hasMarketingConsent(), false);
    assert.equal(consent.hasPendingMarketingRevocation(), true);
    assert.equal(consent.marketingConsentSubject(), subject);

    let retryCalls = 0;
    globalThis.fetch = async () => {
      retryCalls += 1;
      return { ok: true, json: async () => ({ ok: true, revoked: 1 }) };
    };
    assert.equal(await consent.revokePendingMetaCapiOutbox(100), true);
    assert.equal(retryCalls, 1);
    assert.equal(consent.hasPendingMarketingRevocation(), false);
    assert.equal(consent.marketingConsentSubject(), '');
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousFetch === undefined) delete globalThis.fetch; else globalThis.fetch = previousFetch;
  }
});

test('a delayed successful revocation cannot erase a newly granted consent subject', async () => {
  const harness = browserHarness();
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.window = harness.window;
    globalThis.document = harness.document;
    const consent = await import('../src/lib/marketing-consent.ts');
    let release;
    globalThis.fetch = async () => {
      await new Promise((resolve) => { release = resolve; });
      return { ok: true, json: async () => ({ ok: true, revoked: 1 }) };
    };

    consent.saveConsentPreferences({ analytics: false, marketing: false });
    const revocation = consent.revokePendingMetaCapiOutbox();
    consent.saveConsentPreferences({ analytics: false, marketing: true });
    assert.equal(consent.marketingConsentSubject(), subject);
    release();
    assert.equal(await revocation, true);
    assert.equal(consent.hasMarketingConsent(), true);
    assert.equal(consent.marketingConsentSubject(), '019a4321-5e89-4aa9-9b09-775987654321');
    assert.equal(consent.hasPendingMarketingRevocation(), false);
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousFetch === undefined) delete globalThis.fetch; else globalThis.fetch = previousFetch;
  }
});

test('an invalid local consent subject is cleared without contacting the server', async () => {
  const harness = browserHarness();
  harness.cookies.set('astana_marketing_consent_subject', 'not-valid');
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.window = harness.window;
    globalThis.document = harness.document;
    globalThis.fetch = async () => { throw new Error('invalid subjects must not be sent'); };
    const consent = await import('../src/lib/marketing-consent.ts');
    assert.equal(await consent.revokePendingMetaCapiOutbox(), true);
    assert.equal(consent.marketingConsentSubject(), '');
    assert.equal(consent.hasPendingMarketingRevocation(), false);
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousFetch === undefined) delete globalThis.fetch; else globalThis.fetch = previousFetch;
  }
});

test('a newer consent choice invalidates an older choice waiting in another tab', async () => {
  const harness = browserHarness();
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  try {
    globalThis.window = harness.window;
    globalThis.document = harness.document;
    const consent = await import('../src/lib/marketing-consent.ts');
    const older = consent.beginConsentPreferenceChange();
    const newer = consent.beginConsentPreferenceChange();
    assert.notEqual(older, newer);
    assert.equal(consent.isCurrentConsentPreferenceChange(older), false);
    assert.equal(consent.isCurrentConsentPreferenceChange(newer), true);
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});

test('an asynchronous grant fails closed when shared storage cannot prove it is the newest choice', async () => {
  const harness = browserHarness({ storageUnavailable: true });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  try {
    globalThis.window = harness.window;
    globalThis.document = harness.document;
    const consent = await import('../src/lib/marketing-consent.ts');
    const revision = consent.beginConsentPreferenceChange();
    assert.ok(revision);
    assert.equal(consent.isCurrentConsentPreferenceChange(revision), false);
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});

test('revocation requests are isolated by subject instead of reusing an older in-flight request', async () => {
  const harness = browserHarness();
  harness.cookies.set('astana_marketing_consent', 'denied');
  const secondSubject = '019a4321-5e89-4aa9-9b09-775987654399';
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  const releases = [];
  try {
    globalThis.window = harness.window;
    globalThis.document = harness.document;
    globalThis.fetch = async () => {
      await new Promise((resolve) => releases.push(resolve));
      return { ok: true, json: async () => ({ ok: true, revoked: 1 }) };
    };
    const consent = await import('../src/lib/marketing-consent.ts');
    const first = consent.revokePendingMetaCapiOutbox();
    harness.cookies.set('astana_marketing_consent_subject', secondSubject);
    const second = consent.revokePendingMetaCapiOutbox();
    assert.equal(releases.length, 2, 'a new subject must start its own revocation request');
    releases[1]();
    assert.equal(await second, true);
    releases[0]();
    assert.equal(await first, true);
    assert.equal(consent.hasPendingMarketingRevocation(), false);
    assert.equal(consent.marketingConsentSubject(), '');
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousFetch === undefined) delete globalThis.fetch; else globalThis.fetch = previousFetch;
  }
});
