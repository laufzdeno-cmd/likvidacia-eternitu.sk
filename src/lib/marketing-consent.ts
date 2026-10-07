export const analyticsConsentCookieName = 'astana_analytics_consent';
export const marketingConsentCookieName = 'astana_marketing_consent';
export const marketingConsentSubjectCookieName = 'astana_marketing_consent_subject';
export const marketingConsentChangedEvent = 'astana:marketing-consent';

export type MarketingConsent = 'granted' | 'denied';
export type ConsentPreferences = { analytics: boolean; marketing: boolean };

const consentMaxAge = 31536000;
const analyticsSessionStorageKey = 'astana_analytics_session';
const analyticsAttributionStorageKey = 'astana_analytics_attribution';
const analyticsLastActivityStorageKey = 'astana_analytics_last_activity';
const marketingRevocationPendingStorageKey = 'astana_marketing_revocation_pending';
let marketingRevocationRequest: Promise<boolean> | null = null;

function removeSessionItem(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Storage may be disabled by the browser; consent changes must still complete.
  }
}

function readBrowserCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const prefix = `${encodeURIComponent(name)}=`;
  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) || '';
}

export function isMarketingConsentSubject(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function marketingConsentSubject() {
  return readBrowserCookie(marketingConsentSubjectCookieName);
}

export function ensureMarketingConsentSubject() {
  if (typeof window === 'undefined') return '';
  const existing = marketingConsentSubject();
  if (isMarketingConsentSubject(existing)) return existing;
  const subject = window.crypto?.randomUUID?.();
  if (!subject || !isMarketingConsentSubject(subject)) return '';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(marketingConsentSubjectCookieName)}=${subject}; Path=/; Max-Age=${consentMaxAge}; SameSite=Lax${secure}`;
  return subject;
}

function setMarketingRevocationPending(pending: boolean) {
  try {
    if (pending) window.localStorage.setItem(marketingRevocationPendingStorageKey, '1');
    else window.localStorage.removeItem(marketingRevocationPendingStorageKey);
  } catch {
    // Private browsing may disable storage. The immediate request still runs.
  }
}

export function hasPendingMarketingRevocation() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(marketingRevocationPendingStorageKey) === '1';
  } catch {
    return false;
  }
}

export function revokePendingMetaCapiOutbox() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (marketingRevocationRequest) return marketingRevocationRequest;
  marketingRevocationRequest = (async () => {
    const subject = marketingConsentSubject();
    if (!isMarketingConsentSubject(subject)) {
      setMarketingRevocationPending(false);
      return true;
    }
    setMarketingRevocationPending(true);
    try {
      const response = await fetch('/api/marketing-consent/revoke/', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        keepalive: true,
      });
      if (!response.ok) return false;
      const body = await response.json().catch(() => null) as { ok?: unknown } | null;
      if (body?.ok !== true) return false;
      setMarketingRevocationPending(false);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    marketingRevocationRequest = null;
  });
  return marketingRevocationRequest;
}

function readConsentCookie(name: string): boolean | null {
  const value = readBrowserCookie(name);
  if (value === 'granted') return true;
  if (value === 'denied') return false;
  return null;
}

export function readConsentPreferences(): ConsentPreferences | null {
  if (typeof window === 'undefined') return null;
  const analytics = readConsentCookie(analyticsConsentCookieName);
  const marketing = readConsentCookie(marketingConsentCookieName);
  return analytics === null || marketing === null ? null : { analytics, marketing };
}

export function readConsentCategoryPreferences(): ConsentPreferences {
  return {
    analytics: readConsentCookie(analyticsConsentCookieName) === true,
    marketing: readConsentCookie(marketingConsentCookieName) === true,
  };
}

export function hasAnalyticsConsent() {
  return readConsentCookie(analyticsConsentCookieName) === true;
}

export function marketingConsent(): MarketingConsent {
  return readConsentCookie(marketingConsentCookieName) === true ? 'granted' : 'denied';
}

export function hasMarketingConsent() {
  return marketingConsent() === 'granted';
}

export function saveConsentPreferences(preferences: ConsentPreferences) {
  if (typeof window === 'undefined') return;
  const normalized = { analytics: Boolean(preferences.analytics), marketing: Boolean(preferences.marketing) };
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(analyticsConsentCookieName)}=${normalized.analytics ? 'granted' : 'denied'}; Path=/; Max-Age=${consentMaxAge}; SameSite=Lax${secure}`;
  document.cookie = `${encodeURIComponent(marketingConsentCookieName)}=${normalized.marketing ? 'granted' : 'denied'}; Path=/; Max-Age=${consentMaxAge}; SameSite=Lax${secure}`;
  if (normalized.marketing) ensureMarketingConsentSubject();
  if (!normalized.analytics) {
    removeSessionItem(analyticsSessionStorageKey);
    removeSessionItem(analyticsAttributionStorageKey);
    removeSessionItem(analyticsLastActivityStorageKey);
    try {
      window.localStorage.removeItem(analyticsSessionStorageKey);
      window.localStorage.removeItem(analyticsAttributionStorageKey);
    } catch {
      // Storage cleanup is best-effort; all analytics reads remain consent-gated.
    }
  }
  if (!normalized.marketing) {
    try {
      const stored = window.sessionStorage.getItem(analyticsAttributionStorageKey);
      const attribution = stored ? JSON.parse(stored) as Record<string, unknown> : {};
      delete attribution.gclid;
      delete attribution.fbclid;
      delete attribution.gbraid;
      delete attribution.wbraid;
      if (Object.keys(attribution).length) window.sessionStorage.setItem(analyticsAttributionStorageKey, JSON.stringify(attribution));
      else window.sessionStorage.removeItem(analyticsAttributionStorageKey);
    } catch {
      removeSessionItem(analyticsAttributionStorageKey);
    }
  }
  window.dispatchEvent(new CustomEvent(marketingConsentChangedEvent, { detail: normalized }));
}

export function saveMarketingConsent(value: MarketingConsent) {
  const current = readConsentPreferences() ?? { analytics: false, marketing: false };
  saveConsentPreferences({ ...current, marketing: value === 'granted' });
}

export type PendingMetaLead = {
  eventId: string;
  material: 'vlnity' | 'plocha' | 'iny' | 'neviem';
};
