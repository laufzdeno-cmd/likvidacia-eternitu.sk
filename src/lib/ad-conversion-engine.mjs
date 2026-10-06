const marketingConsentChangedEvent = 'astana:marketing-consent';
const acceptedLeadSubscribers = new Set();
const queuedEventsByWindow = new WeakMap();
const maximumQueuedEvents = 100;

function rememberQueuedEvent(queued, key) {
  queued.add(key);
  if (queued.size > maximumQueuedEvents) queued.delete(queued.values().next().value);
}

function inMemoryQueuedEvents(windowObject) {
  let queued = queuedEventsByWindow.get(windowObject);
  if (!queued) {
    queued = new Set();
    queuedEventsByWindow.set(windowObject, queued);
  }
  return queued;
}

/** Deliver a conversion payload from the application flow after lead API success. */
export function publishAcceptedLeadConversion(detail) {
  if (!validEvent(detail)) return;
  for (const subscriber of acceptedLeadSubscribers) subscriber(detail);
}

/** Publish only a conversion explicitly included in a successful lead API response. */
export function publishAcceptedLeadResponse(result) {
  if (!result || typeof result !== 'object' || result.ok !== true || !validEvent(result.metaLead)) return;
  publishAcceptedLeadConversion(result.metaLead);
}

function validEvent(value) {
  if (!value || typeof value !== 'object') return false;
  const event = value;
  return typeof event.eventId === 'string'
    && /^lead:[a-f0-9]{64}$/.test(event.eventId)
    && ['vlnity', 'plocha', 'iny', 'neviem'].includes(String(event.material));
}

function loadGoogleTag({ window: windowObject, document: documentObject, googleAdsConversionId, googleAdsConversionLabel }) {
  if (!googleAdsConversionId || !/^AW-[0-9]{6,20}$/.test(googleAdsConversionId)
    || !googleAdsConversionLabel || !/^[A-Za-z0-9_-]{4,128}$/.test(googleAdsConversionLabel)) return null;

  if (!windowObject.gtag) {
    windowObject.dataLayer ??= [];
    windowObject.gtag = (...args) => windowObject.dataLayer.push(args);
  }

  if (!documentObject.querySelector('script[data-astana-google-ads]')) {
    windowObject.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
    windowObject.gtag('js', new Date());
    windowObject.gtag('config', googleAdsConversionId, { send_page_view: false, allow_enhanced_conversions: false });
    const script = documentObject.createElement('script');
    script.async = true;
    script.dataset.astanaGoogleAds = 'true';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAdsConversionId)}`;
    documentObject.head.appendChild(script);
  }

  return { gtag: windowObject.gtag, sendTo: `${googleAdsConversionId}/${googleAdsConversionLabel}` };
}

function loadMetaPixel({ window: windowObject, document: documentObject, metaPixelId }) {
  if (!metaPixelId || !/^[0-9]{5,20}$/.test(metaPixelId)) return null;

  if (!windowObject.fbq) {
    const fbq = (...args) => {
      if (typeof fbq.callMethod === 'function') {
        return fbq.callMethod.apply(fbq, args);
      }
      fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    windowObject.fbq = fbq;
    windowObject._fbq ??= fbq;
  }

  if (!documentObject.querySelector('script[data-astana-meta-pixel]')) {
    windowObject.fbq('set', 'autoConfig', false, metaPixelId);
    const script = documentObject.createElement('script');
    script.async = true;
    script.dataset.astanaMetaPixel = 'true';
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    documentObject.head.appendChild(script);
    windowObject.fbq('init', metaPixelId);
  }

  return windowObject.fbq;
}

/** Load consented ad tags for landing-page context; emit conversions only for server-confirmed leads. */
export function attachAcceptedLeadConversionTracking(dependencies) {
  const { window: windowObject, hasMarketingConsent } = dependencies;
  const queuedInMemory = inMemoryQueuedEvents(windowObject);

  const handleAcceptedLead = (detail) => {
    if (!hasMarketingConsent()) return;
    if (!validEvent(detail)) return;

    const google = loadGoogleTag(dependencies);
    if (google) {
      const key = `google:${detail.eventId}`;
      if (!queuedInMemory.has(key)) {
        google.gtag('consent', 'update', {
          ad_storage: 'granted',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          analytics_storage: 'denied',
        });
        google.gtag('event', 'conversion', { send_to: google.sendTo, transaction_id: detail.eventId });
        // gtag's dataLayer enqueue is not a provider-delivery receipt. Dedupe only
        // within this page lifetime; Google transaction_id handles repeated IDs.
        rememberQueuedEvent(queuedInMemory, key);
      }
    }

    const fbq = loadMetaPixel(dependencies);
    if (fbq) {
      const key = `meta:${detail.eventId}`;
      if (!queuedInMemory.has(key)) {
        fbq('consent', 'grant');
        fbq('track', 'Lead', { content_name: detail.material }, { eventID: detail.eventId });
        // Pixel queueing is not a provider-delivery receipt. eventID lets Meta
        // deduplicate a retry if the browser had to reload before the SDK loaded.
        rememberQueuedEvent(queuedInMemory, key);
      }
    }
  };

  const handleConsentChange = () => {
    const granted = hasMarketingConsent();
    if (granted) {
      const google = loadGoogleTag(dependencies);
      const fbq = loadMetaPixel(dependencies);
      google?.gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      });
      fbq?.('consent', 'grant');
    } else {
      windowObject.gtag?.('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      });
      if (windowObject.fbq) windowObject.fbq('consent', 'revoke');
    }
  };

  acceptedLeadSubscribers.add(handleAcceptedLead);
  windowObject.addEventListener(marketingConsentChangedEvent, handleConsentChange);
  // Load consented tags on the landing page so they can observe click context
  // before an internal link drops query parameters. Lead events remain gated
  // separately and are sent only after the server confirms persistence.
  handleConsentChange();
  return () => {
    acceptedLeadSubscribers.delete(handleAcceptedLead);
    windowObject.removeEventListener(marketingConsentChangedEvent, handleConsentChange);
  };
}
