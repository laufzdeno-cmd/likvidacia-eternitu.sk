import assert from 'node:assert/strict';
import test from 'node:test';
import consentModule from '../src/lib/marketing-consent.ts';

const { saveConsentPreferences } = consentModule;

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test('withdrawing marketing consent removes every click ID but keeps analytics UTMs', () => {
  const session = storage({
    astana_analytics_session: 'session',
    astana_analytics_last_activity: '1700000000000',
    astana_analytics_attribution: JSON.stringify({
      utmSource: 'google', utmCampaign: 'roofing',
      gclid: 'g-click', fbclid: 'f-click', gbraid: 'g-braid', wbraid: 'w-braid',
    }),
  });
  const local = storage({ astana_analytics_session: 'session', astana_analytics_attribution: 'old' });
  const priorWindow = globalThis.window;
  const priorDocument = globalThis.document;
  const priorCustomEvent = globalThis.CustomEvent;
  const priorEvent = globalThis.Event;
  const dispatched = [];
  try {
    globalThis.Event = class Event { constructor(type, options) { this.type = type; this.detail = options?.detail; } };
    globalThis.CustomEvent = globalThis.Event;
    globalThis.window = {
      sessionStorage: session,
      localStorage: local,
      location: { protocol: 'https:' },
      dispatchEvent(event) { dispatched.push(event); },
    };
    globalThis.document = { cookie: '' };

    saveConsentPreferences({ analytics: true, marketing: false });

    assert.deepEqual(JSON.parse(session.getItem('astana_analytics_attribution')), {
      utmSource: 'google', utmCampaign: 'roofing',
    });
    assert.equal(local.getItem('astana_analytics_attribution'), 'old');
    assert.match(document.cookie, /astana_marketing_consent=denied/);
    assert.equal(dispatched.length, 1);

    saveConsentPreferences({ analytics: false, marketing: false });
    assert.equal(session.getItem('astana_analytics_session'), null);
    assert.equal(session.getItem('astana_analytics_attribution'), null);
    assert.equal(session.getItem('astana_analytics_last_activity'), null, 'analytics opt-out clears the activity timestamp too');
  } finally {
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow;
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
    if (priorCustomEvent === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = priorCustomEvent;
    if (priorEvent === undefined) delete globalThis.Event; else globalThis.Event = priorEvent;
  }
});
