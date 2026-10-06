import { hasAnalyticsConsent, hasMarketingConsent, marketingConsentChangedEvent } from './marketing-consent';
import { carryConsentedCampaignParameters, selectCampaignTouch, type CampaignTouch } from './attribution-touch';

const sessionStorageKey = 'astana_analytics_session';
const attributionStorageKey = 'astana_analytics_attribution';
const sessionActivityStorageKey = 'astana_analytics_last_activity';
const analyticsSessionIdleTimeoutMs = 30 * 60 * 1000;
type Attribution = CampaignTouch;
let volatileAttribution: Attribution = {};
let volatileSessionId = '';
let volatileLastSessionActivityAt = 0;
let preventCampaignForwardingForPage = false;
let expiredCampaignSignature = '';
let expiredCampaignTouchPending = false;
let consentListenerWindow: Window | undefined;

function campaignTouchSignature(touch: Attribution) {
  const fields = [
    touch.utmSource || '', touch.utmMedium || '', touch.utmCampaign || '', touch.utmContent || '', touch.utmTerm || '', touch.utmId || '',
  ];
  return fields.some(Boolean) ? JSON.stringify(fields) : '';
}

function hasCampaignTouch(touch: Attribution) {
  return Boolean(
    touch.utmSource || touch.utmMedium || touch.utmCampaign || touch.utmContent || touch.utmTerm || touch.utmId ||
    touch.gclid || touch.fbclid || touch.gbraid || touch.wbraid,
  );
}

function campaignTouchFromCurrentUrl(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const touch: Attribution = {};
  if (hasAnalyticsConsent()) {
    const fields = [
      ['utm_source', 'utmSource'], ['utm_medium', 'utmMedium'], ['utm_campaign', 'utmCampaign'],
      ['utm_content', 'utmContent'], ['utm_term', 'utmTerm'], ['utm_id', 'utmId'],
    ];
    for (const [param, key] of fields) {
      const value = safeValue(params.get(param));
      if (value) touch[key as keyof Attribution] = value;
    }
  }
  if (hasMarketingConsent()) {
    for (const key of ['gclid', 'fbclid', 'gbraid', 'wbraid'] as const) {
      const value = safeValue(params.get(key), 512);
      if (value) touch[key] = value;
    }
  }
  return touch;
}

function safeValue(value: string | null, limit = 160) {
  return (value || '').trim().slice(0, limit);
}

function refreshAnalyticsSessionActivity() {
  const now = Date.now();
  let lastActivity = volatileLastSessionActivityAt;
  try {
    const storedSessionId = window.sessionStorage.getItem(sessionStorageKey) || '';
    const storedActivity = Number(window.sessionStorage.getItem(sessionActivityStorageKey));
    if (Number.isFinite(storedActivity) && storedActivity > 0) lastActivity = storedActivity;
    else if (storedSessionId) lastActivity = -1;
  } catch {
    // Use the in-memory activity clock if the browser blocks session storage.
  }

  const sessionExpired = lastActivity === -1 || (lastActivity > 0 && now - lastActivity >= analyticsSessionIdleTimeoutMs);
  if (sessionExpired) {
    let previousTouch = volatileAttribution;
    try {
      const stored = window.sessionStorage.getItem(attributionStorageKey);
      if (stored) previousTouch = JSON.parse(stored) as Attribution;
    } catch {
      // Use the page-memory attribution if storage is blocked.
    }
    if (!hasCampaignTouch(previousTouch)) previousTouch = campaignTouchFromCurrentUrl();
    expiredCampaignSignature = campaignTouchSignature(previousTouch);
    expiredCampaignTouchPending = hasCampaignTouch(previousTouch);
    volatileAttribution = {};
    volatileSessionId = '';
    preventCampaignForwardingForPage = true;
    try {
      window.sessionStorage.removeItem(sessionStorageKey);
      window.sessionStorage.removeItem(attributionStorageKey);
      window.sessionStorage.removeItem(sessionActivityStorageKey);
    } catch {
      // Volatile state is cleared even when the browser storage cannot be changed.
    }
  }

  volatileLastSessionActivityAt = now;
  try {
    window.sessionStorage.setItem(sessionActivityStorageKey, String(now));
  } catch {
    // Activity remains tracked in memory for this page lifetime.
  }
  return sessionExpired;
}

function getSessionId() {
  refreshAnalyticsSessionActivity();
  try {
    const existing = window.sessionStorage.getItem(sessionStorageKey);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const created = window.crypto?.randomUUID?.();
    if (!created) return '';
    window.sessionStorage.setItem(sessionStorageKey, created);
    return created;
  } catch {
    // Keep consented analytics usable for this page lifetime when storage is blocked.
    volatileSessionId ||= window.crypto?.randomUUID?.() || '';
    return volatileSessionId;
  }
}

function ensureConsentListener() {
  if (typeof window === 'undefined' || consentListenerWindow === window) return;
  window.addEventListener(marketingConsentChangedEvent, (event) => {
    const detail = (event as CustomEvent<{ analytics?: boolean; marketing?: boolean }>).detail;
    if (detail?.analytics !== true) {
      volatileAttribution = {};
      volatileSessionId = '';
      volatileLastSessionActivityAt = 0;
      preventCampaignForwardingForPage = false;
      expiredCampaignSignature = '';
      expiredCampaignTouchPending = false;
      try {
        window.sessionStorage.removeItem(sessionActivityStorageKey);
      } catch {
        // Consent revocation must clear in-memory state even if storage is unavailable.
      }
      return;
    }
    if (detail.marketing !== true) {
      delete volatileAttribution.gclid;
      delete volatileAttribution.fbclid;
      delete volatileAttribution.gbraid;
      delete volatileAttribution.wbraid;
    }
  });
  consentListenerWindow = window;
}

function getAttribution(): Attribution {
  ensureConsentListener();
  refreshAnalyticsSessionActivity();
  const currentParams = new URLSearchParams(window.location.search);
  const currentUtm: Attribution = {};
  if (hasAnalyticsConsent()) {
    if (currentParams.has('utm_source')) currentUtm.utmSource = safeValue(currentParams.get('utm_source'));
    if (currentParams.has('utm_medium')) currentUtm.utmMedium = safeValue(currentParams.get('utm_medium'));
    if (currentParams.has('utm_campaign')) currentUtm.utmCampaign = safeValue(currentParams.get('utm_campaign'));
    if (currentParams.has('utm_content')) currentUtm.utmContent = safeValue(currentParams.get('utm_content'));
    if (currentParams.has('utm_term')) currentUtm.utmTerm = safeValue(currentParams.get('utm_term'));
    if (currentParams.has('utm_id')) currentUtm.utmId = safeValue(currentParams.get('utm_id'));
  }
  const currentClickIds: Attribution = {};
  if (hasMarketingConsent()) {
    const gclid = safeValue(currentParams.get('gclid'), 512);
    const fbclid = safeValue(currentParams.get('fbclid'), 512);
    const gbraid = safeValue(currentParams.get('gbraid'), 512);
    const wbraid = safeValue(currentParams.get('wbraid'), 512);
    if (gclid) currentClickIds.gclid = gclid;
    if (fbclid) currentClickIds.fbclid = fbclid;
    if (gbraid) currentClickIds.gbraid = gbraid;
    if (wbraid) currentClickIds.wbraid = wbraid;
  }

  let existing: Attribution = volatileAttribution;
  try {
    const stored = window.sessionStorage.getItem(attributionStorageKey);
    if (stored) existing = JSON.parse(stored) as Attribution;
  } catch {
    // No persistent attribution if the browser blocks session storage.
  }

  const hasCurrentCampaign = Object.keys(currentUtm).length > 0 || Object.keys(currentClickIds).length > 0;
  const carriedLanding = currentParams.get('astana_landing');
  const landingPath = carriedLanding && /^\/(?!\/)[A-Za-z0-9._~/%-]{0,299}$/u.test(carriedLanding)
    ? carriedLanding
    : window.location.pathname.slice(0, 300);
  const currentTouch: Attribution = {
    ...currentUtm,
    ...currentClickIds,
    ...(hasAnalyticsConsent() && hasCurrentCampaign ? { landingPath } : {}),
  };
  const currentCampaignSignature = campaignTouchSignature(currentTouch);
  const isExpiredCampaign = hasCurrentCampaign && expiredCampaignTouchPending && (
    currentCampaignSignature === expiredCampaignSignature || (!currentCampaignSignature && !expiredCampaignSignature)
  );
  if (hasCurrentCampaign && !isExpiredCampaign) {
    preventCampaignForwardingForPage = false;
    expiredCampaignSignature = '';
    expiredCampaignTouchPending = false;
  }
  const attribution = selectCampaignTouch(existing, isExpiredCampaign ? {} : currentTouch);
  if (!hasAnalyticsConsent()) delete attribution.landingPath;
  if (!hasMarketingConsent()) {
    delete attribution.gclid;
    delete attribution.fbclid;
    delete attribution.gbraid;
    delete attribution.wbraid;
  }
  try {
    window.sessionStorage.setItem(attributionStorageKey, JSON.stringify(attribution));
  } catch {
    // Keep attribution for same-page navigation without writing beyond session memory.
  }
  volatileAttribution = attribution;
  return attribution;
}

export function getLeadAttribution() {
  ensureConsentListener();
  const analyticsConsent = hasAnalyticsConsent();
  const marketingConsent = hasMarketingConsent();
  if (!analyticsConsent) return {};

  const attribution = getAttribution();
  return {
    ...(attribution.utmSource ? { utmSource: attribution.utmSource } : {}),
    ...(attribution.utmMedium ? { utmMedium: attribution.utmMedium } : {}),
    ...(attribution.utmCampaign ? { utmCampaign: attribution.utmCampaign } : {}),
    ...(attribution.utmContent ? { utmContent: attribution.utmContent } : {}),
    ...(attribution.utmTerm ? { utmTerm: attribution.utmTerm } : {}),
    ...(attribution.utmId ? { utmId: attribution.utmId } : {}),
    ...(attribution.landingPath ? { landingPath: attribution.landingPath } : {}),
    ...(marketingConsent && attribution.gclid ? { gclid: attribution.gclid } : {}),
    ...(marketingConsent && attribution.fbclid ? { fbclid: attribution.fbclid } : {}),
    ...(marketingConsent && attribution.gbraid ? { gbraid: attribution.gbraid } : {}),
    ...(marketingConsent && attribution.wbraid ? { wbraid: attribution.wbraid } : {}),
  };
}

export function getAnalyticsSessionId() {
  ensureConsentListener();
  return hasAnalyticsConsent() ? getSessionId() : '';
}

export function preserveCampaignAttributionOnInternalLink(event: MouseEvent) {
  if (typeof window === 'undefined' || !hasAnalyticsConsent() || !(event.target instanceof Element)) return;
  refreshAnalyticsSessionActivity();
  if (preventCampaignForwardingForPage) return;
  const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
  if (!anchor || anchor.target && anchor.target !== '_self') return;
  const sourceUrl = new URL(window.location.href);
  const targetUrl = new URL(anchor.href, sourceUrl);
  if (targetUrl.origin !== sourceUrl.origin || targetUrl.pathname.startsWith('/api/') || targetUrl.pathname.startsWith('/admin/')) return;
  if (!carryConsentedCampaignParameters(sourceUrl, targetUrl, {
    analytics: hasAnalyticsConsent(),
    marketing: hasMarketingConsent(),
  })) return;
  anchor.href = targetUrl.toString();
}
