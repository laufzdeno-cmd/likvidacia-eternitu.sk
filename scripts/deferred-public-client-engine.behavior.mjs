import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import analyticsModule from '../src/lib/analytics-client.ts';
import { createDeferredAdConversionTrackingFacade } from '../src/lib/ad-conversion-tracking.mjs';

const { createDeferredAnalyticsDispatcher } = analyticsModule;
const acceptedEvent = (marker, material = 'vlnity') => ({ eventId: `lead:${marker.repeat(64)}`, material });

test('analytics remains inert without consent and replays a bounded queue once after the dynamic import', async () => {
  let consent = false;
  let loadCalls = 0;
  let resolveEngine;
  const delivered = [];
  const engineGate = new Promise((resolve) => { resolveEngine = resolve; });
  const dispatcher = createDeferredAnalyticsDispatcher({
    hasConsent: () => consent,
    maximumQueuedEvents: 3,
    loadEngine: () => {
      loadCalls += 1;
      return engineGate;
    },
  });

  dispatcher.trackAnalyticsEvent('without_consent');
  assert.equal(loadCalls, 0, 'analytics engine must not load before analytics consent');

  consent = true;
  dispatcher.trackAnalyticsEvent('first', { order: 1 });
  dispatcher.trackAnalyticsEvent('second', { order: 2 });
  const mutableMetadata = { order: 3 };
  dispatcher.trackAnalyticsEvent('third', mutableMetadata);
  mutableMetadata.order = 99;
  dispatcher.trackAnalyticsEvent('fourth', { order: 4 });
  assert.equal(loadCalls, 1, 'parallel events share one dynamic import');
  assert.deepEqual(delivered, [], 'events stay queued until the engine is ready');

  resolveEngine({
    trackAnalyticsEvent: (eventType, metadata) => delivered.push({ eventType, metadata }),
  });
  await dispatcher.waitForEngine();

  assert.deepEqual(delivered, [
    { eventType: 'second', metadata: { order: 2 } },
    { eventType: 'third', metadata: { order: 3 } },
    { eventType: 'fourth', metadata: { order: 4 } },
  ], 'the bounded facade drops only the oldest overflow and preserves event order');

  dispatcher.trackAnalyticsEvent('after_load', { ready: true });
  assert.deepEqual(delivered.at(-1), { eventType: 'after_load', metadata: { ready: true } });
});

test('analytics drops an event from an earlier consent period while its engine import is in flight', async () => {
  let consent = true;
  let consentListener = () => {};
  let resolveEngine;
  const delivered = [];
  const dispatcher = createDeferredAnalyticsDispatcher({
    hasConsent: () => consent,
    subscribeConsentChanges: (listener) => {
      consentListener = listener;
      return () => { consentListener = () => {}; };
    },
    loadEngine: () => new Promise((resolve) => { resolveEngine = resolve; }),
  });

  dispatcher.trackAnalyticsEvent('old_consent_period');
  consent = false;
  consentListener();
  consent = true;
  consentListener();

  resolveEngine({
    trackAnalyticsEvent: (eventType) => delivered.push(eventType),
  });
  await dispatcher.waitForEngine();

  assert.deepEqual(delivered, [], 'revocation permanently discards events queued under the previous consent');
  dispatcher.trackAnalyticsEvent('new_consent_period');
  assert.deepEqual(delivered, ['new_consent_period']);
  dispatcher.dispose();
});

test('analytics records one page view per route and allows the same route after renewed consent', async () => {
  let consent = true;
  let consentListener = () => {};
  let pageViewKey = '/cena-likvidacie-azbestu/';
  const delivered = [];
  const dispatcher = createDeferredAnalyticsDispatcher({
    hasConsent: () => consent,
    getPageViewKey: () => pageViewKey,
    subscribeConsentChanges: (listener) => {
      consentListener = listener;
      return () => { consentListener = () => {}; };
    },
    loadEngine: async () => ({
      trackAnalyticsEvent: (eventType, metadata) => delivered.push({ eventType, metadata }),
    }),
  });

  dispatcher.trackAnalyticsEvent('page_view');
  dispatcher.trackAnalyticsEvent('page_view');
  dispatcher.trackAnalyticsEvent('cta_click', { label: 'Ponuka' });
  await dispatcher.waitForEngine();
  assert.deepEqual(delivered, [
    { eventType: 'page_view', metadata: {} },
    { eventType: 'cta_click', metadata: { label: 'Ponuka' } },
  ], 'a development remount cannot duplicate the same route page view');

  pageViewKey = '/';
  dispatcher.trackAnalyticsEvent('page_view');
  dispatcher.trackAnalyticsEvent('page_view');
  assert.equal(delivered.filter(({ eventType }) => eventType === 'page_view').length, 2,
    'a different route records exactly one additional page view');

  consent = false;
  consentListener();
  consent = true;
  consentListener();
  dispatcher.trackAnalyticsEvent('page_view');
  assert.equal(delivered.filter(({ eventType }) => eventType === 'page_view').length, 3,
    'renewed consent starts a fresh page-view period on the current route');
  dispatcher.dispose();
});

test('a duplicate page-view call retries a failed engine import without queueing a duplicate event', async () => {
  let loadCalls = 0;
  const delivered = [];
  const dispatcher = createDeferredAnalyticsDispatcher({
    hasConsent: () => true,
    getPageViewKey: () => '/kontakt/',
    loadEngine: async () => {
      loadCalls += 1;
      if (loadCalls === 1) throw new Error('synthetic import failure');
      return { trackAnalyticsEvent: (eventType) => delivered.push(eventType) };
    },
  });

  dispatcher.trackAnalyticsEvent('page_view');
  await dispatcher.waitForEngine();
  dispatcher.trackAnalyticsEvent('page_view');
  await dispatcher.waitForEngine();

  assert.equal(loadCalls, 2, 'the same page-view call can restart a failed lazy import');
  assert.deepEqual(delivered, ['page_view'], 'the retained queue still delivers the page view only once');
  dispatcher.dispose();
});

test('a page view dropped by the bounded queue can be recorded again', async () => {
  let resolveEngine;
  const delivered = [];
  const dispatcher = createDeferredAnalyticsDispatcher({
    hasConsent: () => true,
    getPageViewKey: () => '/faq/',
    maximumQueuedEvents: 2,
    loadEngine: () => new Promise((resolve) => { resolveEngine = resolve; }),
  });

  dispatcher.trackAnalyticsEvent('page_view');
  dispatcher.trackAnalyticsEvent('cta_click', { order: 1 });
  dispatcher.trackAnalyticsEvent('cta_click', { order: 2 });
  dispatcher.trackAnalyticsEvent('page_view');
  resolveEngine({
    trackAnalyticsEvent: (eventType, metadata) => delivered.push({ eventType, metadata }),
  });
  await dispatcher.waitForEngine();

  assert.deepEqual(delivered, [
    { eventType: 'cta_click', metadata: { order: 2 } },
    { eventType: 'page_view', metadata: {} },
  ], 'queue overflow releases only the dropped page-view key and permits one retry');
  dispatcher.dispose();
});

test('accepted lead conversion is dropped without consent and survives an in-flight engine import with event IDs intact', async () => {
  let consent = false;
  let loadCalls = 0;
  let resolveEngine;
  const listeners = new Map();
  const subscribers = new Set();
  const delivered = [];
  const engineGate = new Promise((resolve) => { resolveEngine = resolve; });
  const windowObject = {
    addEventListener: (name, listener) => listeners.set(name, [...(listeners.get(name) || []), listener]),
    removeEventListener: (name, listener) => listeners.set(name, (listeners.get(name) || []).filter((item) => item !== listener)),
    dispatchEvent: (event) => { for (const listener of listeners.get(event.type) || []) listener(event); },
  };
  const facade = createDeferredAdConversionTrackingFacade({
    maximumQueuedEvents: 3,
    loadEngine: () => {
      loadCalls += 1;
      return engineGate;
    },
  });
  const cleanup = facade.attachAcceptedLeadConversionTracking({
    window: windowObject,
    document: {},
    hasMarketingConsent: () => consent,
  });

  facade.publishAcceptedLeadResponse({ ok: true, metaLead: acceptedEvent('a') });
  assert.equal(loadCalls, 0, 'an accepted response without marketing consent is not retained for later consent');

  consent = true;
  windowObject.dispatchEvent({ type: 'astana:marketing-consent' });
  facade.publishAcceptedLeadConversion(acceptedEvent('a'));
  facade.publishAcceptedLeadConversion(acceptedEvent('b', 'plocha'));
  facade.publishAcceptedLeadConversion(acceptedEvent('c', 'iny'));
  facade.publishAcceptedLeadConversion(acceptedEvent('d', 'neviem'));
  assert.equal(loadCalls, 1, 'consent and accepted events share one ad-engine import');
  assert.deepEqual(delivered, []);

  resolveEngine({
    attachAcceptedLeadConversionTracking: (dependencies) => {
      const subscriber = (detail) => {
        if (dependencies.hasMarketingConsent()) delivered.push(detail);
      };
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    publishAcceptedLeadConversion: (detail) => subscribers.forEach((subscriber) => subscriber(detail)),
  });
  await facade.waitForEngine();

  assert.deepEqual(delivered, [
    acceptedEvent('b', 'plocha'),
    acceptedEvent('c', 'iny'),
    acceptedEvent('d', 'neviem'),
  ], 'the bounded queue keeps exact server-issued event IDs and material categories');

  consent = false;
  windowObject.dispatchEvent({ type: 'astana:marketing-consent' });
  facade.publishAcceptedLeadConversion(acceptedEvent('e'));
  assert.equal(delivered.length, 3, 'revoked consent blocks later accepted-lead conversions');

  cleanup();
  consent = true;
  facade.publishAcceptedLeadConversion(acceptedEvent('f'));
  assert.equal(delivered.length, 3, 'an unmounted tracker cannot receive queued conversions');
});

test('ad conversion queued under revoked consent is not replayed after re-consent during import', async () => {
  let consent = true;
  let resolveEngine;
  const listeners = new Map();
  const delivered = [];
  const windowObject = {
    addEventListener: (name, listener) => listeners.set(name, [...(listeners.get(name) || []), listener]),
    removeEventListener: (name, listener) => listeners.set(name, (listeners.get(name) || []).filter((item) => item !== listener)),
    dispatchEvent: (event) => { for (const listener of listeners.get(event.type) || []) listener(event); },
  };
  const facade = createDeferredAdConversionTrackingFacade({
    loadEngine: () => new Promise((resolve) => { resolveEngine = resolve; }),
  });
  const cleanup = facade.attachAcceptedLeadConversionTracking({
    window: windowObject,
    document: {},
    hasMarketingConsent: () => consent,
  });

  facade.publishAcceptedLeadConversion(acceptedEvent('a'));
  consent = false;
  windowObject.dispatchEvent({ type: 'astana:marketing-consent' });
  consent = true;
  windowObject.dispatchEvent({ type: 'astana:marketing-consent' });

  const subscribers = new Set();
  resolveEngine({
    attachAcceptedLeadConversionTracking: (dependencies) => {
      const subscriber = (detail) => {
        if (dependencies.hasMarketingConsent()) delivered.push(detail);
      };
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    publishAcceptedLeadConversion: (detail) => subscribers.forEach((subscriber) => subscriber(detail)),
  });
  await facade.waitForEngine();

  assert.deepEqual(delivered, [], 'the conversion from the revoked consent period must not survive re-consent');
  facade.publishAcceptedLeadConversion(acceptedEvent('b', 'plocha'));
  assert.deepEqual(delivered, [acceptedEvent('b', 'plocha')]);
  cleanup();
});

test('unchanged granted marketing consent preserves one queued conversion during import', async () => {
  let consent = true;
  let resolveEngine;
  const listeners = new Map();
  const delivered = [];
  const windowObject = {
    addEventListener: (name, listener) => listeners.set(name, [...(listeners.get(name) || []), listener]),
    removeEventListener: (name, listener) => listeners.set(name, (listeners.get(name) || []).filter((item) => item !== listener)),
    dispatchEvent: (event) => { for (const listener of listeners.get(event.type) || []) listener(event); },
  };
  const facade = createDeferredAdConversionTrackingFacade({
    loadEngine: () => new Promise((resolve) => { resolveEngine = resolve; }),
  });
  const dependencies = { window: windowObject, document: {}, hasMarketingConsent: () => consent };
  const cleanup = facade.attachAcceptedLeadConversionTracking(dependencies);

  facade.publishAcceptedLeadConversion(acceptedEvent('a'));
  windowObject.dispatchEvent({ type: 'astana:marketing-consent' });
  resolveEngine({
    attachAcceptedLeadConversionTracking: () => () => {},
    publishAcceptedLeadConversion: (detail) => delivered.push(detail),
  });
  await facade.waitForEngine();

  assert.deepEqual(delivered, [acceptedEvent('a')], 'saving unchanged granted consent must preserve the queued conversion');
  cleanup();
});

test('duplicate consent listeners do not invalidate a queued conversion when aggregate consent is unchanged', async () => {
  let consent = true;
  let resolveEngine;
  const listeners = new Map();
  const delivered = [];
  const windowObject = {
    addEventListener: (name, listener) => listeners.set(name, [...(listeners.get(name) || []), listener]),
    removeEventListener: (name, listener) => listeners.set(name, (listeners.get(name) || []).filter((item) => item !== listener)),
    dispatchEvent: (event) => { for (const listener of listeners.get(event.type) || []) listener(event); },
  };
  const facade = createDeferredAdConversionTrackingFacade({
    loadEngine: () => new Promise((resolve) => { resolveEngine = resolve; }),
  });
  const dependencies = { window: windowObject, document: {}, hasMarketingConsent: () => consent };
  const cleanupFirst = facade.attachAcceptedLeadConversionTracking(dependencies);
  const cleanupSecond = facade.attachAcceptedLeadConversionTracking(dependencies);

  facade.publishAcceptedLeadConversion(acceptedEvent('b', 'plocha'));
  windowObject.dispatchEvent({ type: 'astana:marketing-consent' });
  resolveEngine({
    attachAcceptedLeadConversionTracking: () => () => {},
    publishAcceptedLeadConversion: (detail) => delivered.push(detail),
  });
  await facade.waitForEngine();

  assert.deepEqual(delivered, [acceptedEvent('b', 'plocha')],
    'multiple listeners must not advance the consent revision when aggregate consent stayed granted');
  cleanupFirst();
  cleanupSecond();
});

test('two registrations still discard an old conversion across grant revoke grant during import', async () => {
  let consent = true;
  let resolveEngine;
  const listeners = new Map();
  const delivered = [];
  const windowObject = {
    addEventListener: (name, listener) => listeners.set(name, [...(listeners.get(name) || []), listener]),
    removeEventListener: (name, listener) => listeners.set(name, (listeners.get(name) || []).filter((item) => item !== listener)),
    dispatchEvent: (event) => { for (const listener of listeners.get(event.type) || []) listener(event); },
  };
  const facade = createDeferredAdConversionTrackingFacade({
    loadEngine: () => new Promise((resolve) => { resolveEngine = resolve; }),
  });
  const dependencies = { window: windowObject, document: {}, hasMarketingConsent: () => consent };
  const cleanupFirst = facade.attachAcceptedLeadConversionTracking(dependencies);
  const cleanupSecond = facade.attachAcceptedLeadConversionTracking(dependencies);

  facade.publishAcceptedLeadConversion(acceptedEvent('c', 'iny'));
  consent = false;
  windowObject.dispatchEvent({ type: 'astana:marketing-consent' });
  consent = true;
  windowObject.dispatchEvent({ type: 'astana:marketing-consent' });
  resolveEngine({
    attachAcceptedLeadConversionTracking: () => () => {},
    publishAcceptedLeadConversion: (detail) => delivered.push(detail),
  });
  await facade.waitForEngine();

  assert.deepEqual(delivered, [], 'revocation must discard the old queued conversion even with two listeners');
  cleanupFirst();
  cleanupSecond();
});

test('public entry modules contain only facades while provider and transport code stay behind dynamic imports', () => {
  const analyticsFacade = readFileSync(new URL('../src/lib/analytics-client.ts', import.meta.url), 'utf8');
  const analyticsEngine = readFileSync(new URL('../src/lib/analytics-event-engine.ts', import.meta.url), 'utf8');
  const adFacade = readFileSync(new URL('../src/lib/ad-conversion-tracking.mjs', import.meta.url), 'utf8');
  const adEngine = readFileSync(new URL('../src/lib/ad-conversion-engine.mjs', import.meta.url), 'utf8');
  const widgets = readFileSync(new URL('../app/public-widgets.tsx', import.meta.url), 'utf8');

  assert.match(analyticsFacade, /import\('\.\/analytics-event-engine'\)/);
  assert.doesNotMatch(analyticsFacade, /sendBeacon|\/api\/analytics\//);
  assert.match(analyticsEngine, /sendBeacon/);
  assert.match(analyticsEngine, /\/api\/analytics\//);

  assert.match(adFacade, /import\('\.\/ad-conversion-engine\.mjs'\)/);
  assert.doesNotMatch(adFacade, /googletagmanager\.com|connect\.facebook\.net|bzrcdn\.openai\.com|allow_enhanced_conversions/);
  assert.match(adEngine, /googletagmanager\.com/);
  assert.match(adEngine, /connect\.facebook\.net/);
  assert.match(adEngine, /bzrcdn\.openai\.com/);
  assert.match(widgets, /attachAcceptedLeadConversionTracking/);
  assert.match(widgets, /readConsentPreferences/);
  assert.match(widgets, /saveConsentPreferences/);
});

test('homepage contact preference exposes a visible keyboard focus treatment', () => {
  const homeStyles = readFileSync(new URL('../public/assets/home-below-fold.css', import.meta.url), 'utf8');
  assert.match(homeStyles, /\.contact-preference label:has\(input:focus-visible\)/);
  assert.match(homeStyles, /outline:\s*3px solid/);
  assert.match(homeStyles, /outline-offset:\s*3px/);
});
