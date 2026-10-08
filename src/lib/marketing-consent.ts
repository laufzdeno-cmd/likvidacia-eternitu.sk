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
const consentChoiceRevisionStorageKey = 'astana_consent_choice_revision';
const marketingRevocationRequests = new Map<string, Promise<boolean>>();
const marketingRevocationTimeoutMs = 8_000;

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

function setMarketingRevocationPending(subject: string) {
  try {
    if (isMarketingConsentSubject(subject)) window.localStorage.setItem(marketingRevocationPendingStorageKey, subject);
    else window.localStorage.removeItem(marketingRevocationPendingStorageKey);
  } catch {
    // Private browsing may disable storage. The immediate request still runs.
  }
}

function clearMarketingRevocationPending(subject?: string) {
  try {
    const pending = window.localStorage.getItem(marketingRevocationPendingStorageKey);
    if (!subject || pending === '1' || pending === subject) {
      window.localStorage.removeItem(marketingRevocationPendingStorageKey);
    }
  } catch {
    // Private browsing may disable storage. The immediate request still runs.
  }
}

function clearMarketingConsentSubject(subject: string) {
  if (marketingConsentSubject() !== subject) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(marketingConsentSubjectCookieName)}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function hasPendingMarketingRevocation() {
  if (typeof window === 'undefined') return false;
  try {
    const pending = window.localStorage.getItem(marketingRevocationPendingStorageKey) || '';
    return pending === '1' || isMarketingConsentSubject(pending);
  } catch {
    return false;
  }
}

export function beginConsentPreferenceChange() {
  if (typeof window === 'undefined') return '';
  const revision = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  try {
    window.localStorage.setItem(consentChoiceRevisionStorageKey, revision);
  } catch {
    // A later asynchronous grant must fail closed when tabs cannot share state.
  }
  return revision;
}

export function isCurrentConsentPreferenceChange(revision: string) {
  if (!revision || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(consentChoiceRevisionStorageKey) === revision;
  } catch {
    return false;
  }
}

export function revokePendingMetaCapiOutbox(timeoutMs = marketingRevocationTimeoutMs) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const subject = marketingConsentSubject();
  if (!isMarketingConsentSubject(subject)) {
    clearMarketingRevocationPending();
    if (subject) clearMarketingConsentSubject(subject);
    return Promise.resolve(true);
  }
  const existingRequest = marketingRevocationRequests.get(subject);
  if (existingRequest) return existingRequest;
  const request = (async () => {
    setMarketingRevocationPending(subject);
    const controller = new AbortController();
    const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : marketingRevocationTimeoutMs;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new Error('Marketing consent revocation timed out.'));
      }, safeTimeoutMs);
    });
    try {
      const response = await Promise.race([
        fetch('/api/marketing-consent/revoke/', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          keepalive: true,
          signal: controller.signal,
        }),
        timeout,
      ]);
      if (!response.ok) return false;
      const body = await Promise.race([
        response.json(),
        timeout,
      ]).catch(() => null) as { ok?: unknown } | null;
      if (body?.ok !== true) return false;
      clearMarketingRevocationPending(subject);
      clearMarketingConsentSubject(subject);
      if (hasMarketingConsent()) ensureMarketingConsentSubject();
      return true;
    } catch {
      return false;
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  })().finally(() => {
    marketingRevocationRequests.delete(subject);
  });
  marketingRevocationRequests.set(subject, request);
  return request;
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
