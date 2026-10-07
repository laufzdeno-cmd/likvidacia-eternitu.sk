'use client';

import { useEffect, useRef, useState } from 'react';
import { trackAnalyticsEvent } from '@/src/lib/analytics-client';
import { attachAcceptedLeadConversionTracking } from '@/src/lib/ad-conversion-tracking.mjs';
import { ensureMarketingConsentSubject, hasAnalyticsConsent, hasMarketingConsent, hasPendingMarketingRevocation, marketingConsentSubject, readConsentCategoryPreferences, readConsentPreferences, revokePendingMetaCapiOutbox, saveConsentPreferences, type ConsentPreferences } from '@/src/lib/marketing-consent';
import PublicWhatsapp from './public-whatsapp';

const openConsentEvent = 'astana:open-cookie-settings';

export function CookieSettingsTrigger() {
  return <button className="cookie-settings-trigger" type="button" onClick={() => window.dispatchEvent(new Event(openConsentEvent))}>Upraviť nastavenia cookies</button>;
}

export default function PublicWidgets({
  hideWhatsappOnMobile = false,
  renderWhatsapp = true,
  initialOpenSettings = false,
}: {
  hideWhatsappOnMobile?: boolean;
  renderWhatsapp?: boolean;
  initialOpenSettings?: boolean;
}) {
  const [showCookieBanner, setShowCookieBanner] = useState(initialOpenSettings);
  const [preferences, setPreferences] = useState<ConsentPreferences>({ analytics: false, marketing: false });
  const [showCookiePreferences, setShowCookiePreferences] = useState(initialOpenSettings);
  const analyticsCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasMarketingConsent()) ensureMarketingConsentSubject();
    else if (hasPendingMarketingRevocation() || marketingConsentSubject()) void revokePendingMetaCapiOutbox();
    const detachTracking = attachAcceptedLeadConversionTracking({
      window: window as Window & { dataLayer?: unknown[][]; gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void },
      document,
      hasMarketingConsent,
      metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim(),
      googleAdsConversionId: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID?.trim(),
      googleAdsConversionLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim(),
    });
    const retryRevocation = () => {
      if (!hasMarketingConsent() && (hasPendingMarketingRevocation() || marketingConsentSubject())) {
        void revokePendingMetaCapiOutbox();
      }
    };
    const retryVisibleRevocation = () => {
      if (document.visibilityState === 'visible') retryRevocation();
    };
    window.addEventListener('online', retryRevocation);
    document.addEventListener('visibilitychange', retryVisibleRevocation);
    return () => {
      detachTracking();
      window.removeEventListener('online', retryRevocation);
      document.removeEventListener('visibilitychange', retryVisibleRevocation);
    };
  }, []);

  useEffect(() => {
    if (initialOpenSettings) {
      setPreferences(readConsentCategoryPreferences());
    }
    setShowCookieBanner(readConsentPreferences() === null);
    const openSettings = () => {
      setPreferences(readConsentCategoryPreferences());
      setShowCookiePreferences(true);
      setShowCookieBanner(true);
    };
    window.addEventListener(openConsentEvent, openSettings);
    return () => window.removeEventListener(openConsentEvent, openSettings);
  }, [initialOpenSettings]);

  useEffect(() => {
    if (showCookieBanner && showCookiePreferences) analyticsCheckboxRef.current?.focus();
  }, [showCookieBanner, showCookiePreferences]);

  const save = (next: ConsentPreferences) => {
    const analyticsWasGranted = hasAnalyticsConsent();
    saveConsentPreferences(next);
    if (!next.marketing) void revokePendingMetaCapiOutbox();
    setShowCookieBanner(false);
    if (next.analytics && !analyticsWasGranted) trackAnalyticsEvent('page_view');
  };

  return (
    <>
      {renderWhatsapp ? <PublicWhatsapp hideOnMobile={hideWhatsappOnMobile} /> : null}
      {showCookieBanner ? (
        <section className={`cookie-banner${showCookiePreferences ? ' cookie-banner-expanded' : ''}`} role="region" aria-labelledby="cookie-title" aria-describedby="cookie-description">
          <div className="cookie-banner-copy">
            <h2 id="cookie-title">Nastavenia súkromia</h2>
            <p id="cookie-description">Nevyhnutné cookies pre chod webu. Návštevnosť a kampane meriame len so súhlasom. <a href="/cookies/#nastavenia">Podrobnosti</a></p>
            <div className="cookie-preferences" id="cookie-preferences">
              <label><input ref={analyticsCheckboxRef} type="checkbox" checked={preferences.analytics} onChange={(event) => setPreferences((current) => ({ ...current, analytics: event.target.checked }))} />
                <span><strong>Analytika</strong><small>Meranie návštevnosti, navštívených stránok a zdroja kampane pomocou pseudonymného ID v tomto prehliadači.</small></span>
              </label>
              <label><input type="checkbox" checked={preferences.marketing} onChange={(event) => setPreferences((current) => ({ ...current, marketing: event.target.checked }))} />
                <span><strong>Marketingové meranie</strong><small>Po úspešnom dopyte môžeme Google Ads poslať konverznú udalosť. Meta môže dostať aj zahashovaný email a telefón; zahashovanie nie je anonymizácia. Identifikátory kliknutia uložíme iba pri zapnutej analytike aj marketingu.</small></span>
              </label>
            </div>
          </div>
          <div className="cookie-actions">
            <button className="cookie-primary" type="button" onClick={() => save({ analytics: true, marketing: true })}>Prijať všetky</button>
            <button type="button" onClick={() => save({ analytics: false, marketing: false })}>Len nevyhnutné</button>
            <button className="cookie-save" type="button" onClick={() => save(preferences)}>Uložiť výber</button>
            <button className="cookie-customize" type="button" aria-expanded={showCookiePreferences} aria-controls="cookie-preferences" onClick={() => setShowCookiePreferences(true)}>Upraviť výber</button>
          </div>
        </section>
      ) : null}
    </>
  );
}
