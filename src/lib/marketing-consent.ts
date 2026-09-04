export const cookieConsentStorageKey = 'astana-cookies-v2';
export const marketingConsentCookieName = 'astana_marketing_consent';
export const marketingConsentSubjectCookieName = 'astana_marketing_consent_subject';
export const marketingConsentChangedEvent = 'astana:marketing-consent';
export const pendingMetaLeadStorageKey = 'astana:pending-meta-lead';

export type MarketingConsent = 'granted' | 'denied';

function readBrowserCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const prefix = `${encodeURIComponent(name)}=`;
  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) || '';
}

function isConsentSubject(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function marketingConsentSubject() {
  return readBrowserCookie(marketingConsentSubjectCookieName);
}

export function ensureMarketingConsentSubject() {
  if (typeof window === 'undefined') return '';
  const existing = marketingConsentSubject();
  if (isConsentSubject(existing)) return existing;
  const subject = window.crypto?.randomUUID?.();
  if (!subject || !isConsentSubject(subject)) return '';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(marketingConsentSubjectCookieName)}=${subject}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  return subject;
}

export function marketingConsent(): MarketingConsent {
  if (typeof window === 'undefined') return 'denied';
  try {
    const stored = window.localStorage.getItem(cookieConsentStorageKey);
    if (stored === 'marketing') return 'granted';
    if (stored === 'necessary') return 'denied';
  } catch {
    // Strict browser privacy modes can block localStorage; no marketing tracking is the safe default.
  }
  return readBrowserCookie(marketingConsentCookieName) === 'granted' ? 'granted' : 'denied';
}

export function hasMarketingConsent() {
  return marketingConsent() === 'granted';
}

export function saveMarketingConsent(value: MarketingConsent) {
  if (typeof window === 'undefined') return;
  const stored = value === 'granted' ? 'marketing' : 'necessary';
  try {
    window.localStorage.setItem(cookieConsentStorageKey, stored);
  } catch {
    // The cookie below is enough for the server-side gate when localStorage is unavailable.
  }
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(marketingConsentCookieName)}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  if (value === 'granted') ensureMarketingConsentSubject();
  window.dispatchEvent(new CustomEvent(marketingConsentChangedEvent, { detail: { value } }));
}

export function revokePendingMetaCapiOutbox() {
  if (typeof window === 'undefined' || !isConsentSubject(marketingConsentSubject())) return;
  void fetch('/api/marketing-consent/revoke/', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    keepalive: true,
  }).catch(() => undefined);
}

export type PendingMetaLead = {
  eventId: string;
  material: 'vlnity' | 'plocha' | 'iny' | 'neviem';
};

export function rememberPendingMetaLead(event: PendingMetaLead) {
  try {
    window.sessionStorage.setItem(pendingMetaLeadStorageKey, JSON.stringify(event));
  } catch {
    // Session storage is an enhancement only; the server event can still be sent independently.
  }
}

function parsePendingMetaLead(raw: string | null): PendingMetaLead | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingMetaLead>;
    if (
      typeof parsed.eventId !== 'string' ||
      !/^[A-Za-z0-9._:-]{16,128}$/.test(parsed.eventId) ||
      !['vlnity', 'plocha', 'iny', 'neviem'].includes(String(parsed.material))
    ) {
      return null;
    }
    return parsed as PendingMetaLead;
  } catch {
    return null;
  }
}

export function peekPendingMetaLead(): PendingMetaLead | null {
  try {
    return parsePendingMetaLead(window.sessionStorage.getItem(pendingMetaLeadStorageKey));
  } catch {
    return null;
  }
}

export function takePendingMetaLead(): PendingMetaLead | null {
  try {
    const event = parsePendingMetaLead(window.sessionStorage.getItem(pendingMetaLeadStorageKey));
    window.sessionStorage.removeItem(pendingMetaLeadStorageKey);
    return event;
  } catch {
    return null;
  }
}
