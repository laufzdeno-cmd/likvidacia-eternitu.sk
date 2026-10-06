export const analyticsConsentCookieName = 'astana_analytics_consent';
export const marketingConsentCookieName = 'astana_marketing_consent';
export const marketingConsentChangedEvent = 'astana:marketing-consent';

export type MarketingConsent = 'granted' | 'denied';
export type ConsentPreferences = { analytics: boolean; marketing: boolean };

const consentMaxAge = 31536000;
const analyticsSessionStorageKey = 'astana_analytics_session';
const analyticsAttributionStorageKey = 'astana_analytics_attribution';
const analyticsLastActivityStorageKey = 'astana_analytics_last_activity';

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

export function hasAnalyticsConsent() {
  return readConsentPreferences()?.analytics === true;
}

export function marketingConsent(): MarketingConsent {
  return readConsentPreferences()?.marketing === true ? 'granted' : 'denied';
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
