import { hasAnalyticsConsent } from './marketing-consent';
import { getAnalyticsSessionId, getLeadAttribution } from './analytics-attribution-client';

function safeReferrerOrigin() {
  try {
    return document.referrer ? new URL(document.referrer).origin : '';
  } catch {
    return '';
  }
}

export function trackAnalyticsEvent(eventType: string, metadata: Record<string, unknown> = {}) {
  if (!hasAnalyticsConsent()) return;
  const sessionId = getAnalyticsSessionId();
  if (!sessionId) return;

  const attribution = getLeadAttribution();
  const { gclid, fbclid, gbraid, wbraid, ...utm } = attribution;
  const analyticsMetadata = gclid || fbclid || gbraid || wbraid
    ? { ...metadata, adClickIds: { ...(gclid ? { gclid } : {}), ...(fbclid ? { fbclid } : {}), ...(gbraid ? { gbraid } : {}), ...(wbraid ? { wbraid } : {}) } }
    : metadata;
  const payload = JSON.stringify({
    sessionId,
    eventType,
    path: `${window.location.pathname}${window.location.hash || ''}`.slice(0, 500),
    referrer: safeReferrerOrigin(),
    device: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
    viewportWidth: window.innerWidth,
    ...utm,
    metadata: analyticsMetadata,
  });
  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon('/api/analytics/', new Blob([payload], { type: 'application/json' }));
    if (sent) return;
  }
  void fetch('/api/analytics/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
