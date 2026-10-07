import { hasAnalyticsConsent, marketingConsentChangedEvent } from './marketing-consent';
import {
  getAnalyticsSessionId,
  getLeadAttribution,
  preserveCampaignAttributionOnInternalLink,
} from './analytics-attribution-client';

type AnalyticsEvent = (eventType: string, metadata?: Record<string, unknown>) => void;
type AnalyticsEngine = { trackAnalyticsEvent: AnalyticsEvent };
type DeferredAnalyticsOptions = {
  hasConsent?: () => boolean;
  getPageViewKey?: () => string;
  loadEngine?: () => Promise<AnalyticsEngine>;
  maximumQueuedEvents?: number;
  subscribeConsentChanges?: (listener: () => void) => () => void;
};

const defaultMaximumQueuedEvents = 100;

function getBrowserPageViewKey() {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function subscribeToBrowserConsentChanges(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(marketingConsentChangedEvent, listener);
  return () => window.removeEventListener(marketingConsentChangedEvent, listener);
}

export function createDeferredAnalyticsDispatcher({
  hasConsent = hasAnalyticsConsent,
  getPageViewKey = getBrowserPageViewKey,
  loadEngine = () => import('./analytics-event-engine'),
  maximumQueuedEvents = defaultMaximumQueuedEvents,
  subscribeConsentChanges = subscribeToBrowserConsentChanges,
}: DeferredAnalyticsOptions = {}) {
  const queuedEvents: Array<{
    eventType: string;
    metadata: Record<string, unknown>;
    consentRevision: number;
    pageViewKey?: string;
  }> = [];
  const queueLimit = Math.max(1, Math.floor(maximumQueuedEvents));
  let engine: AnalyticsEngine | null = null;
  let enginePromise: Promise<AnalyticsEngine | null> | null = null;
  let consentRevision = 0;
  let consentGranted = hasConsent();
  let lastPageViewKey: string | null = null;

  const unsubscribeConsentChanges = subscribeConsentChanges(() => {
    const nextConsent = hasConsent();
    if (nextConsent === consentGranted) return;
    consentGranted = nextConsent;
    consentRevision += 1;
    if (!nextConsent) {
      queuedEvents.length = 0;
      lastPageViewKey = null;
    }
  });

  const ensureEngine = () => {
    if (engine) return Promise.resolve(engine);
    if (enginePromise) return enginePromise;

    enginePromise = loadEngine()
      .then((loadedEngine) => {
        engine = loadedEngine;
        const pending = queuedEvents.splice(0);
        pending.forEach(({ eventType, metadata, consentRevision: queuedRevision }) => {
          if (hasConsent() && queuedRevision === consentRevision) {
            loadedEngine.trackAnalyticsEvent(eventType, metadata);
          }
        });
        return loadedEngine;
      })
      .catch(() => {
        enginePromise = null;
        return null;
      });
    return enginePromise;
  };

  const trackAnalyticsEvent: AnalyticsEvent = (eventType, metadata = {}) => {
    if (!hasConsent()) return;
    let pageViewKey = '';
    if (eventType === 'page_view') {
      pageViewKey = getPageViewKey();
      if (pageViewKey && pageViewKey === lastPageViewKey) {
        if (!engine && !enginePromise) void ensureEngine();
        return;
      }
      if (pageViewKey) lastPageViewKey = pageViewKey;
    }
    if (engine) {
      engine.trackAnalyticsEvent(eventType, metadata);
      return;
    }

    queuedEvents.push({ eventType, metadata: { ...metadata }, consentRevision, ...(pageViewKey ? { pageViewKey } : {}) });
    while (queuedEvents.length > queueLimit) {
      const dropped = queuedEvents.shift();
      if (dropped?.pageViewKey && dropped.pageViewKey === lastPageViewKey) lastPageViewKey = null;
    }
    void ensureEngine();
  };

  return {
    trackAnalyticsEvent,
    waitForEngine: () => enginePromise ?? Promise.resolve(engine),
    dispose: () => {
      queuedEvents.length = 0;
      unsubscribeConsentChanges();
    },
  };
}

const deferredAnalytics = createDeferredAnalyticsDispatcher();

export function trackAnalyticsEvent(eventType: string, metadata: Record<string, unknown> = {}) {
  deferredAnalytics.trackAnalyticsEvent(eventType, metadata);
}

export function createAnalyticsTracker(): AnalyticsEvent {
  return trackAnalyticsEvent;
}

export {
  getAnalyticsSessionId,
  getLeadAttribution,
  preserveCampaignAttributionOnInternalLink,
};
