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
  loadEngine?: () => Promise<AnalyticsEngine>;
  maximumQueuedEvents?: number;
  subscribeConsentChanges?: (listener: () => void) => () => void;
};

const defaultMaximumQueuedEvents = 100;

function subscribeToBrowserConsentChanges(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(marketingConsentChangedEvent, listener);
  return () => window.removeEventListener(marketingConsentChangedEvent, listener);
}

export function createDeferredAnalyticsDispatcher({
  hasConsent = hasAnalyticsConsent,
  loadEngine = () => import('./analytics-event-engine'),
  maximumQueuedEvents = defaultMaximumQueuedEvents,
  subscribeConsentChanges = subscribeToBrowserConsentChanges,
}: DeferredAnalyticsOptions = {}) {
  const queuedEvents: Array<{
    eventType: string;
    metadata: Record<string, unknown>;
    consentRevision: number;
  }> = [];
  const queueLimit = Math.max(1, Math.floor(maximumQueuedEvents));
  let engine: AnalyticsEngine | null = null;
  let enginePromise: Promise<AnalyticsEngine | null> | null = null;
  let consentRevision = 0;
  let consentGranted = hasConsent();

  const unsubscribeConsentChanges = subscribeConsentChanges(() => {
    const nextConsent = hasConsent();
    if (nextConsent === consentGranted) return;
    consentGranted = nextConsent;
    consentRevision += 1;
    if (!nextConsent) queuedEvents.length = 0;
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
    if (engine) {
      engine.trackAnalyticsEvent(eventType, metadata);
      return;
    }

    queuedEvents.push({ eventType, metadata: { ...metadata }, consentRevision });
    while (queuedEvents.length > queueLimit) queuedEvents.shift();
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
