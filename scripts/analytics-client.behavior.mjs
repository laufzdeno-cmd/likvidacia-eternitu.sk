import assert from 'node:assert/strict';
import test from 'node:test';
import analyticsModule from '../src/lib/analytics-client.ts';

const { getAnalyticsSessionId, getLeadAttribution, preserveCampaignAttributionOnInternalLink } = analyticsModule;

test('consented campaign attribution survives blocked session storage during same-page navigation', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const listeners = new Map();
  const storage = {
    getItem() { throw new Error('storage blocked'); },
    setItem() { throw new Error('storage blocked'); },
    removeItem() { throw new Error('storage blocked'); },
  };
  globalThis.window = {
    sessionStorage: storage,
    crypto: { randomUUID: () => 'b1e2ac2c-35b2-4c10-8b6d-77a227b7f3a6' },
    location: { search: '?utm_source=google&utm_campaign=Azbest%20%E2%80%93%20Slovensko&gclid=click-123', pathname: '/cena/' },
    addEventListener: (type, listener) => listeners.set(type, listener),
    dispatchEvent: (event) => listeners.get(event.type)?.(event),
  };
  globalThis.document = { cookie: 'astana_analytics_consent=granted; astana_marketing_consent=granted', referrer: '' };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: undefined } });

  try {
    assert.deepEqual(getLeadAttribution(), {
      utmSource: 'google', utmCampaign: 'Azbest – Slovensko', landingPath: '/cena/', gclid: 'click-123',
    });
    window.location = { search: '', pathname: '/' };
    assert.deepEqual(getLeadAttribution(), {
      utmSource: 'google', utmCampaign: 'Azbest – Slovensko', landingPath: '/cena/', gclid: 'click-123',
    });
    assert.equal(getAnalyticsSessionId(), 'b1e2ac2c-35b2-4c10-8b6d-77a227b7f3a6');

    document.cookie = 'astana_analytics_consent=granted; astana_marketing_consent=denied';
    window.dispatchEvent({ type: 'astana:marketing-consent', detail: { analytics: true, marketing: false } });
    assert.deepEqual(getLeadAttribution(), {
      utmSource: 'google', utmCampaign: 'Azbest – Slovensko', landingPath: '/cena/',
    }, 'marketing click IDs are removed while separately consented analytics attribution remains');

    document.cookie = 'astana_analytics_consent=denied; astana_marketing_consent=denied';
    window.dispatchEvent({ type: 'astana:marketing-consent', detail: { analytics: false, marketing: false } });
    assert.deepEqual(getLeadAttribution(), {}, 'withdrawing analytics clears in-memory campaign attribution');
    assert.equal(getAnalyticsSessionId(), '');
  } finally {
    delete globalThis.window;
    delete globalThis.document;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});

test('campaign attribution expires at 30 minutes and legacy sessions without activity timestamps are cleared', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalDateNow = Date.now;
  let now = Date.parse('2026-10-02T10:00:00.000Z');
  let nextSessionId = 0;
  const values = new Map();
  const listeners = new Map();
  Date.now = () => now;
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    crypto: { randomUUID: () => `b1e2ac2c-35b2-4c10-8b6d-77a227b7f3a${++nextSessionId}` },
    location: { search: '?utm_source=google&utm_campaign=search', pathname: '/cena/' },
    addEventListener: (type, listener) => listeners.set(type, listener),
    dispatchEvent: (event) => listeners.get(event.type)?.(event),
  };
  globalThis.document = { cookie: 'astana_analytics_consent=granted; astana_marketing_consent=denied', referrer: '' };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: undefined } });

  try {
    assert.equal(getLeadAttribution().utmCampaign, 'search');
    const firstSessionId = getAnalyticsSessionId();
    assert.ok(firstSessionId);

    now += 30 * 60 * 1000;
    window.location = { search: '', pathname: '/' };
    assert.deepEqual(getLeadAttribution(), {}, 'an old campaign is not credited to a later direct return');
    const nextSessionIdValue = getAnalyticsSessionId();
    assert.ok(nextSessionIdValue);
    assert.notEqual(nextSessionIdValue, firstSessionId, 'idle timeout starts a fresh analytics session');

    values.set('astana_analytics_session', 'b1e2ac2c-35b2-4c10-8b6d-77a227f3a6bb');
    values.set('astana_analytics_attribution', JSON.stringify({ utmSource: 'google', utmCampaign: 'legacy' }));
    values.delete('astana_analytics_last_activity');
    assert.deepEqual(getLeadAttribution(), {}, 'a legacy session without a timestamp cannot keep stale attribution');
    assert.notEqual(getAnalyticsSessionId(), nextSessionIdValue, 'legacy session starts fresh');
  } finally {
    delete globalThis.window;
    delete globalThis.document;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    Date.now = originalDateNow;
  }
});

test('an idle tagged page does not forward its expired campaign on the next internal click', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalElement = Object.getOwnPropertyDescriptor(globalThis, 'Element');
  const originalDateNow = Date.now;
  let now = Date.parse('2026-10-02T10:31:00.000Z');
  const values = new Map([
    ['astana_analytics_session', 'b1e2ac2c-35b2-4c10-8b6d-77a227f3a6aa'],
    ['astana_analytics_attribution', JSON.stringify({ utmSource: 'google', utmCampaign: 'stale', landingPath: '/cena/', fbclid: 'old-click' })],
    ['astana_analytics_last_activity', String(now - 31 * 60 * 1000)],
  ]);
  const listeners = new Map();
  Date.now = () => now;
  class FakeElement {
    closest() { return anchor; }
  }
  let anchor = { href: 'https://likvidacia-eternitu.sk/#dopyt', target: '' };
  globalThis.Element = FakeElement;
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    location: { href: 'https://likvidacia-eternitu.sk/cena/?utm_source=google&utm_campaign=stale&fbclid=old-click', search: '?utm_source=google&utm_campaign=stale&fbclid=old-click', pathname: '/cena/' },
    addEventListener: (type, listener) => listeners.set(type, listener),
    dispatchEvent: (event) => listeners.get(event.type)?.(event),
  };
  globalThis.document = { cookie: 'astana_analytics_consent=granted; astana_marketing_consent=granted' };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: undefined } });

  try {
    assert.deepEqual(getLeadAttribution(), {}, 'the first attribution read cannot revive an expired campaign still present in the page URL');
    assert.deepEqual(JSON.parse(values.get('astana_analytics_attribution')), {}, 'the stale campaign is not restored to session storage');
    document.cookie = 'astana_analytics_consent=granted; astana_marketing_consent=denied';
    window.dispatchEvent({ type: 'astana:marketing-consent', detail: { analytics: true, marketing: false } });
    assert.deepEqual(getLeadAttribution(), {}, 'withdrawing marketing consent cannot turn the old UTM into a fresh touch');
    preserveCampaignAttributionOnInternalLink({ target: new FakeElement() });
    assert.equal(anchor.href, 'https://likvidacia-eternitu.sk/#dopyt', 'expired UTM and click IDs are not copied onto the link');
    assert.deepEqual(JSON.parse(values.get('astana_analytics_attribution')), {}, 'expired stored attribution remains empty');
    assert.equal(values.has('astana_analytics_session'), false, 'expired session ID is removed before the next event creates a new one');

    document.cookie = 'astana_analytics_consent=granted; astana_marketing_consent=granted';
    window.dispatchEvent({ type: 'astana:marketing-consent', detail: { analytics: true, marketing: true } });
    assert.deepEqual(getLeadAttribution(), {}, 're-granting marketing consent on the same old URL cannot revive its expired touch');
    preserveCampaignAttributionOnInternalLink({ target: new FakeElement() });
    assert.equal(anchor.href, 'https://likvidacia-eternitu.sk/#dopyt', 're-grant does not forward the stale click ID');
    window.location = {
      href: 'https://likvidacia-eternitu.sk/realizacie/?utm_source=meta&utm_campaign=fresh&fbclid=click-new',
      search: '?utm_source=meta&utm_campaign=fresh&fbclid=click-new',
      pathname: '/realizacie/',
    };
    assert.equal(getLeadAttribution().utmCampaign, 'fresh', 'a genuinely new campaign is accepted after the expired touch');
    anchor = { href: 'https://likvidacia-eternitu.sk/#dopyt', target: '' };
    preserveCampaignAttributionOnInternalLink({ target: new FakeElement() });
    const forwarded = new URL(anchor.href);
    assert.equal(forwarded.searchParams.get('utm_campaign'), 'fresh', 'the fresh campaign remains available to the next internal form link');
    assert.equal(forwarded.searchParams.get('fbclid'), 'click-new', 'consented fresh click ID is forwarded');

    values.set('astana_analytics_session', 'b1e2ac2c-35b2-4c10-8b6d-77a227f3a6cc');
    values.set('astana_analytics_attribution', JSON.stringify({ fbclid: 'click-only-old' }));
    values.set('astana_analytics_last_activity', String(now - 31 * 60 * 1000));
    window.location = {
      href: 'https://likvidacia-eternitu.sk/cena/?fbclid=click-only-old',
      search: '?fbclid=click-only-old',
      pathname: '/cena/',
    };
    assert.deepEqual(getLeadAttribution(), {}, 'an expired click-ID-only touch is not revived when no UTM fields exist');
    anchor = { href: 'https://likvidacia-eternitu.sk/#dopyt', target: '' };
    preserveCampaignAttributionOnInternalLink({ target: new FakeElement() });
    assert.equal(anchor.href, 'https://likvidacia-eternitu.sk/#dopyt', 'expired click-ID-only touch is not forwarded');
    window.location = {
      href: 'https://likvidacia-eternitu.sk/cena/?utm_source=meta&utm_campaign=fresh-after-click-only&fbclid=click-only-new',
      search: '?utm_source=meta&utm_campaign=fresh-after-click-only&fbclid=click-only-new',
      pathname: '/cena/',
    };
    assert.equal(getLeadAttribution().utmCampaign, 'fresh-after-click-only', 'a new UTM campaign can follow an expired click-ID-only touch');
  } finally {
    delete globalThis.window;
    delete globalThis.document;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    if (originalElement) Object.defineProperty(globalThis, 'Element', originalElement);
    else delete globalThis.Element;
    Date.now = originalDateNow;
  }
});
