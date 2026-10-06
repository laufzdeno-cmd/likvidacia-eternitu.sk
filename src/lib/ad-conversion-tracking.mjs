const marketingConsentChangedEvent = 'astana:marketing-consent';
const defaultMaximumQueuedEvents = 100;

function validEvent(value) {
  if (!value || typeof value !== 'object') return false;
  return typeof value.eventId === 'string'
    && /^lead:[a-f0-9]{64}$/.test(value.eventId)
    && ['vlnity', 'plocha', 'iny', 'neviem'].includes(String(value.material));
}

export function createDeferredAdConversionTrackingFacade({
  loadEngine = () => import('./ad-conversion-engine.mjs'),
  maximumQueuedEvents = defaultMaximumQueuedEvents,
} = {}) {
  const registrations = new Set();
  const queuedEvents = [];
  const queueLimit = Math.max(1, Math.floor(maximumQueuedEvents));
  let engine = null;
  let enginePromise = null;
  let consentRevision = 0;
  let aggregateMarketingConsent = false;

  const hasConsentedRegistration = () => [...registrations].some(
    (registration) => registration.active && registration.dependencies.hasMarketingConsent(),
  );

  const attachRegistration = (registration) => {
    if (!engine || !registration.active || registration.engineCleanup) return;
    registration.engineCleanup = engine.attachAcceptedLeadConversionTracking(registration.dependencies);
  };

  const ensureEngine = () => {
    if (engine) return Promise.resolve(engine);
    if (enginePromise) return enginePromise;

    enginePromise = loadEngine()
      .then((loadedEngine) => {
        engine = loadedEngine;
        registrations.forEach(attachRegistration);
        const pending = queuedEvents.splice(0);
        pending.forEach(({ detail, consentRevision: queuedRevision }) => {
          if (hasConsentedRegistration() && queuedRevision === consentRevision) {
            loadedEngine.publishAcceptedLeadConversion(detail);
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

  const publishAcceptedLeadConversion = (detail) => {
    if (!validEvent(detail)) return;
    if (engine) {
      engine.publishAcceptedLeadConversion(detail);
      return;
    }

    if (!hasConsentedRegistration()) return;

    queuedEvents.push({ detail, consentRevision });
    while (queuedEvents.length > queueLimit) queuedEvents.shift();
    void ensureEngine();
  };

  const reconcileAggregateConsent = () => {
    const nextConsent = hasConsentedRegistration();
    if (nextConsent === aggregateMarketingConsent) return;
    aggregateMarketingConsent = nextConsent;
    consentRevision += 1;
    if (!nextConsent) queuedEvents.length = 0;
    else void ensureEngine();
  };

  const publishAcceptedLeadResponse = (result) => {
    if (!result || typeof result !== 'object' || result.ok !== true || !validEvent(result.metaLead)) return;
    publishAcceptedLeadConversion(result.metaLead);
  };

  const attachAcceptedLeadConversionTracking = (dependencies) => {
    const registration = { active: true, dependencies, engineCleanup: null };
    const handleConsentChange = () => reconcileAggregateConsent();

    registrations.add(registration);
    dependencies.window.addEventListener(marketingConsentChangedEvent, handleConsentChange);
    if (engine) attachRegistration(registration);
    reconcileAggregateConsent();

    return () => {
      registration.active = false;
      registrations.delete(registration);
      dependencies.window.removeEventListener(marketingConsentChangedEvent, handleConsentChange);
      registration.engineCleanup?.();
      registration.engineCleanup = null;
      reconcileAggregateConsent();
    };
  };

  return {
    attachAcceptedLeadConversionTracking,
    publishAcceptedLeadConversion,
    publishAcceptedLeadResponse,
    waitForEngine: () => enginePromise ?? Promise.resolve(engine),
  };
}

const deferredAdConversion = createDeferredAdConversionTrackingFacade();

/** Deliver a conversion payload from the application flow after lead API success. */
export function publishAcceptedLeadConversion(detail) {
  deferredAdConversion.publishAcceptedLeadConversion(detail);
}

/** Publish only a conversion explicitly included in a successful lead API response. */
export function publishAcceptedLeadResponse(result) {
  deferredAdConversion.publishAcceptedLeadResponse(result);
}

/** Lazily load consented ad tags and preserve accepted events during the import. */
export function attachAcceptedLeadConversionTracking(dependencies) {
  return deferredAdConversion.attachAcceptedLeadConversionTracking(dependencies);
}
