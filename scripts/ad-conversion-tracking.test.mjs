import assert from 'node:assert/strict';
import test from 'node:test';
import { attachAcceptedLeadConversionTracking, publishAcceptedLeadConversion, publishAcceptedLeadResponse } from '../src/lib/ad-conversion-engine.mjs';

function harness({ consent = false, metaPixelId = '123456789012345', googleAdsConversionId = 'AW-123456789', googleAdsConversionLabel = 'AbCd_123' } = {}) {
  const listeners = new Map();
  const storage = new Map();
  const scripts = [];
  const window = {
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    addEventListener: (name, listener) => listeners.set(name, [...(listeners.get(name) || []), listener]),
    removeEventListener: (name, listener) => listeners.set(name, (listeners.get(name) || []).filter((item) => item !== listener)),
    dispatchEvent: (event) => { for (const listener of listeners.get(event.type) || []) listener(event); },
  };
  const document = {
    head: { appendChild: (script) => scripts.push(script) },
    createElement: () => ({ dataset: {}, async: false, src: '' }),
    querySelector: (selector) => scripts.find((script) => selector.includes('google-ads')
      ? script.dataset.astanaGoogleAds
      : selector.includes('meta-pixel') ? script.dataset.astanaMetaPixel : false) || null,
  };
  const cleanup = attachAcceptedLeadConversionTracking({
    window,
    document,
    hasMarketingConsent: () => consent,
    metaPixelId,
    googleAdsConversionId,
    googleAdsConversionLabel,
  });
  const remount = () => attachAcceptedLeadConversionTracking({
    window,
    document,
    hasMarketingConsent: () => consent,
    metaPixelId,
    googleAdsConversionId,
    googleAdsConversionLabel,
  });
  return {
    window,
    scripts,
    cleanup,
    setConsent: (value) => { consent = value; window.dispatchEvent({ type: 'astana:marketing-consent' }); },
    dispatch: (detail) => publishAcceptedLeadConversion(detail),
    respond: (result) => publishAcceptedLeadResponse(result),
    remount,
  };
}

const event = { eventId: `lead:${'a'.repeat(64)}`, material: 'vlnity' };

test('marketing consent loads tags on the landing page, but only an accepted lead sends a conversion', () => {
  const testHarness = harness();
  testHarness.dispatch(event);
  assert.equal(testHarness.scripts.length, 0, 'no third-party tag before consent');

  testHarness.setConsent(true);
  assert.deepEqual(testHarness.scripts.map((script) => new URL(script.src).hostname).sort(), [
    'connect.facebook.net',
    'www.googletagmanager.com',
  ]);

  const googleCalls = testHarness.window.dataLayer;
  assert.equal(googleCalls.filter(([command, name]) => command === 'event' && name === 'conversion').length, 0,
    'granting consent does not send a lead conversion');
  assert.equal(testHarness.window.fbq.queue.filter(([command, name]) => command === 'track' && name === 'Lead').length, 0,
    'granting consent does not send a lead conversion');
  testHarness.dispatch(event);

  assert.ok(googleCalls.some(([command, name, payload]) => command === 'event' && name === 'conversion'
    && payload.send_to === 'AW-123456789/AbCd_123' && payload.transaction_id === event.eventId));
  assert.ok(googleCalls.some(([command, state, payload]) => command === 'consent' && state === 'default'
    && payload.ad_storage === 'denied' && payload.ad_user_data === 'denied'));
  const metaCalls = testHarness.window.fbq.queue;
  const leadCall = metaCalls.find(([command, name]) => command === 'track' && name === 'Lead');
  assert.deepEqual(leadCall, ['track', 'Lead', { content_name: 'vlnity' }, { eventID: event.eventId }]);
  assert.deepEqual(Object.keys(leadCall[2]), ['content_name']);
  assert.deepEqual(Object.keys(googleCalls.find(([command, name]) => command === 'event' && name === 'conversion')[2]).sort(), ['send_to', 'transaction_id']);
  assert.ok(metaCalls.some(([command, setting, enabled]) => command === 'set' && setting === 'autoConfig' && enabled === false));

  testHarness.dispatch(event);
  assert.equal(googleCalls.filter(([command, name]) => command === 'event' && name === 'conversion').length, 1);
  assert.equal(metaCalls.filter(([command, name]) => command === 'track' && name === 'Lead').length, 1);

  testHarness.setConsent(false);
  assert.ok(googleCalls.some(([command, state, payload]) => command === 'consent' && state === 'update'
    && payload.ad_storage === 'denied'));
  assert.ok(metaCalls.some(([command, state]) => command === 'consent' && state === 'revoke'));
  testHarness.dispatch({ eventId: `lead:${'b'.repeat(64)}`, material: 'plocha' });
  assert.equal(googleCalls.filter(([command, name]) => command === 'event' && name === 'conversion').length, 1,
    'a new accepted lead after consent withdrawal must not send a Google conversion');
  assert.equal(metaCalls.filter(([command, name]) => command === 'track' && name === 'Lead').length, 1,
    'a new accepted lead after consent withdrawal must not send a Meta conversion');
  testHarness.cleanup();
});

test('invalid conversions and incomplete provider configuration do not send events', () => {
  const noConsent = harness({ consent: false, googleAdsConversionLabel: '' });
  noConsent.dispatch({ ...event, eventId: 'lead:customer@example.com' });
  assert.equal(noConsent.scripts.length, 0);
  noConsent.setConsent(true);
  noConsent.dispatch(event);
  assert.equal(noConsent.scripts.filter((script) => script.dataset.astanaGoogleAds).length, 0,
    'a Google tag without its conversion label stays disabled');
  assert.equal(noConsent.scripts.filter((script) => script.dataset.astanaMetaPixel).length, 1);
  assert.equal(noConsent.window.fbq.queue.filter(([command, name]) => command === 'track' && name === 'Lead').length, 1);
  noConsent.cleanup();
});

test('page-lifetime provider dedupe survives tracker remount without claiming delivery', () => {
  const first = harness({ consent: true, googleAdsConversionId: '', googleAdsConversionLabel: '' });
  assert.equal(first.scripts.length, 1, 'existing consent loads the tag during tracker initialization');
  assert.equal(first.window.fbq.queue.filter(([command, name]) => command === 'track' && name === 'Lead').length, 0,
    'existing consent alone does not send a lead');
  first.dispatch(event);
  const firstMetaQueue = first.window.fbq.queue;
  first.cleanup();
  const secondCleanup = first.remount();
  first.dispatch(event);
  assert.equal(first.window.fbq.queue.filter(([command, name]) => command === 'track' && name === 'Lead').length, 1,
    'remounting the tracker on the same page does not queue a duplicate');
  assert.ok(firstMetaQueue.some(([command]) => command === 'track'));
  secondCleanup();
});

test('a page reload can retry a queued conversion using the same provider dedupe ID', () => {
  const first = harness({ consent: true, googleAdsConversionId: '', googleAdsConversionLabel: '' });
  first.dispatch(event);
  const firstLead = first.window.fbq.queue.find(([command, name]) => command === 'track' && name === 'Lead');
  first.cleanup();

  const reloadedPage = harness({ consent: true, googleAdsConversionId: '', googleAdsConversionLabel: '' });
  reloadedPage.dispatch(event);
  const retriedLead = reloadedPage.window.fbq.queue.find(([command, name]) => command === 'track' && name === 'Lead');
  assert.equal(firstLead[3].eventID, event.eventId);
  assert.equal(retriedLead[3].eventID, event.eventId,
    'Meta gets the stable ID needed to deduplicate if the first queue attempt later arrives');
  assert.equal(reloadedPage.window.sessionStorage.getItem('astana_sent_ad_conversion_ids'), null,
    'an enqueue attempt is not persisted as proof of provider delivery');
  reloadedPage.cleanup();
});

test('a forged global DOM event cannot publish an accepted lead conversion', () => {
  const testHarness = harness({ consent: true });
  testHarness.window.dispatchEvent({ type: 'astana:meta-lead', detail: event });
  assert.equal(testHarness.window.dataLayer.filter(([command, name]) => command === 'event' && name === 'conversion').length, 0);
  assert.equal(testHarness.window.fbq.queue.filter(([command, name]) => command === 'track' && name === 'Lead').length, 0);
  testHarness.dispatch(event);
  assert.equal(testHarness.window.dataLayer.filter(([command, name]) => command === 'event' && name === 'conversion').length, 1);
  assert.equal(testHarness.window.fbq.queue.filter(([command, name]) => command === 'track' && name === 'Lead').length, 1);
  testHarness.cleanup();
});

test('the landing form publishes only a valid conversion from an accepted API response', () => {
  const accepted = harness({ consent: true });
  accepted.respond({ ok: true, metaLead: event });
  assert.equal(accepted.window.dataLayer.filter(([command, name]) => command === 'event' && name === 'conversion').length, 1);
  assert.equal(accepted.window.fbq.queue.filter(([command, name]) => command === 'track' && name === 'Lead').length, 1);
  accepted.cleanup();

  const failed = harness({ consent: true });
  failed.respond({ ok: false, metaLead: event });
  failed.respond({ ok: true });
  failed.respond({ ok: true, metaLead: { ...event, eventId: 'invalid' } });
  assert.equal(failed.window.dataLayer.filter(([command, name]) => command === 'event' && name === 'conversion').length, 0);
  assert.equal(failed.window.fbq.queue.filter(([command, name]) => command === 'track' && name === 'Lead').length, 0);
  failed.cleanup();
});

test('revoking consent clears stored identifiers but prevents a duplicate after remount and re-consent in the same page', () => {
  const testHarness = harness({ consent: true });
  testHarness.dispatch(event);
  assert.equal(testHarness.window.dataLayer.filter(([command, name]) => command === 'event' && name === 'conversion').length, 1);
  assert.equal(testHarness.window.fbq.queue.filter(([command, name]) => command === 'track' && name === 'Lead').length, 1);

  testHarness.setConsent(false);
  assert.equal(testHarness.window.sessionStorage.getItem('astana_sent_ad_conversion_ids'), null,
    'conversion queue attempts are not persisted in session storage');
  testHarness.cleanup();

  const cleanupAfterRemount = testHarness.remount();
  testHarness.setConsent(true);
  testHarness.dispatch(event);
  assert.equal(testHarness.window.dataLayer.filter(([command, name]) => command === 'event' && name === 'conversion').length, 1);
  assert.equal(testHarness.window.fbq.queue.filter(([command, name]) => command === 'track' && name === 'Lead').length, 1);
  cleanupAfterRemount();
});

test('Meta Pixel forwards queued-stub calls to the loaded SDK and revocation blocks later lead events', () => {
  const testHarness = harness({ consent: true, googleAdsConversionId: '', googleAdsConversionLabel: '' });
  const pixel = testHarness.window.fbq;
  assert.equal(typeof pixel.callMethod, 'undefined');
  assert.ok(pixel.queue.some(([command, name]) => command === 'init' && name === '123456789012345'));

  const sdkCalls = [];
  pixel.callMethod = (...args) => sdkCalls.push(args);
  pixel.queue.length = 0;

  testHarness.dispatch(event);
  assert.ok(sdkCalls.some(([command, name, payload, options]) => command === 'track' && name === 'Lead'
    && payload.content_name === event.material && options.eventID === event.eventId),
  'an accepted lead is forwarded through the loaded Pixel SDK, not left in the stub queue');

  testHarness.setConsent(false);
  assert.ok(sdkCalls.some(([command, state]) => command === 'consent' && state === 'revoke'),
    'consent revocation is forwarded to the loaded Pixel SDK');
  const trackCallsBeforeNewLead = sdkCalls.filter(([command, name]) => command === 'track' && name === 'Lead').length;
  testHarness.dispatch({ eventId: `lead:${'c'.repeat(64)}`, material: 'plocha' });
  assert.equal(sdkCalls.filter(([command, name]) => command === 'track' && name === 'Lead').length, trackCallsBeforeNewLead,
    'a new accepted lead after revocation does not reach the Pixel SDK');
  assert.equal(pixel.queue.length, 0, 'SDK-ready calls never fall back to a disconnected local queue');
  testHarness.cleanup();
});
