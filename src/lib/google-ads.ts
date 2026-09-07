import { hasMarketingConsent } from './marketing-consent';

export const googleAdsId = 'AW-980634648';
export const googleAdsSendTo = 'AW-980634648/sGxDCOjcmOEcEJiYzdMD';
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pending = new Set<string>();
const recorded = new Set<string>();
let initialized = false;
let loaded = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function consentSettings(granted: boolean) {
  const value = granted ? 'granted' : 'denied';
  return { ad_storage: value, ad_user_data: value, ad_personalization: value, analytics_storage: 'denied' };
}

function sendPending() {
  if (!loaded || !hasMarketingConsent()) return;
  for (const id of pending) {
    pending.delete(id);
    window.gtag?.('event', 'conversion', { send_to: googleAdsSendTo, transaction_id: id });
    try { window.sessionStorage.setItem(`astana:ads:${id}`, '1'); } catch { /* Memory guard remains active. */ }
  }
}

export function syncGoogleAdsConsent() {
  if (typeof window === 'undefined' || window.location.pathname.startsWith('/admin')) return;
  try {
    const granted = hasMarketingConsent();
    if (!granted) {
      pending.clear();
      if (initialized) window.gtag?.('consent', 'update', consentSettings(false));
      return;
    }
    if (initialized) {
      window.gtag?.('consent', 'update', consentSettings(true));
      sendPending();
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer?.push(arguments); };
    window.gtag('consent', 'default', consentSettings(false));
    window.gtag('consent', 'update', consentSettings(true));
    window.gtag('js', new Date());
    window.gtag('config', googleAdsId, { send_page_view: false, allow_ad_personalization_signals: false });
    initialized = true;
    const script = document.createElement('script');
    script.id = 'astana-google-ads';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`;
    script.onload = () => { loaded = true; sendPending(); };
    script.onerror = () => { pending.clear(); };
    document.head.appendChild(script);
  } catch { /* Optional measurement must never interrupt the form. */ }
}

export function trackGoogleAdsConversion(submissionId: string) {
  try {
    if (typeof window === 'undefined' || window.location.pathname.startsWith('/admin') || !hasMarketingConsent()) return false;
    const id = submissionId.trim();
    if (!idPattern.test(id) || recorded.has(id)) return false;
    try { if (window.sessionStorage.getItem(`astana:ads:${id}`)) return false; } catch { /* Use memory guard. */ }
    recorded.add(id);
    pending.add(id);
    syncGoogleAdsConsent();
    sendPending();
    return true;
  } catch { return false; }
}
