'use client';

import { useEffect, useRef, useState } from 'react';
import { trackAnalyticsEvent } from '@/src/lib/analytics-client';
import { attachAcceptedLeadConversionTracking } from '@/src/lib/ad-conversion-tracking.mjs';
import { hasMarketingConsent } from '@/src/lib/marketing-consent';
import { readConsentPreferences, saveConsentPreferences, type ConsentPreferences } from '@/src/lib/marketing-consent';

const openConsentEvent = 'astana:open-cookie-settings';

export function CookieSettingsTrigger() {
  return <button className="cookie-settings-trigger" type="button" onClick={() => window.dispatchEvent(new Event(openConsentEvent))}>Upraviť nastavenia cookies</button>;
}

export default function PublicWidgets({ hideWhatsappOnMobile = false }: { hideWhatsappOnMobile?: boolean }) {
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({ analytics: false, marketing: false });
  const [showCookiePreferences, setShowCookiePreferences] = useState(false);
  const analyticsCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return attachAcceptedLeadConversionTracking({
      window: window as Window & { dataLayer?: unknown[][]; gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void },
      document,
      hasMarketingConsent,
      metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim(),
      googleAdsConversionId: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID?.trim(),
      googleAdsConversionLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim(),
    });
  }, []);

  useEffect(() => {
    setShowCookieBanner(readConsentPreferences() === null);
    const openSettings = () => {
      setPreferences(readConsentPreferences() ?? { analytics: false, marketing: false });
      setShowCookiePreferences(true);
      setShowCookieBanner(true);
    };
    window.addEventListener(openConsentEvent, openSettings);
    return () => window.removeEventListener(openConsentEvent, openSettings);
  }, []);

  useEffect(() => {
    if (showCookieBanner && showCookiePreferences) analyticsCheckboxRef.current?.focus();
  }, [showCookieBanner, showCookiePreferences]);

  const save = (next: ConsentPreferences) => {
    const previous = readConsentPreferences();
    saveConsentPreferences(next);
    setShowCookieBanner(false);
    if (next.analytics && !previous?.analytics) trackAnalyticsEvent('page_view');
  };

  return (
    <>
      <a
        href="https://wa.me/421905217946"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Napísať na WhatsApp"
        className={`whatsapp-btn${hideWhatsappOnMobile ? ' homepage-mobile-whatsapp' : ''}`}
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="white" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.17 1.542 5.961L0 24l6.178-1.617A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.007-1.371l-.36-.214-3.666.96.977-3.574-.234-.369A9.818 9.818 0 1 1 12 21.818z" />
        </svg>
      </a>
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
                <span><strong>Marketingové meranie</strong><small>Po úspešnom dopyte môžeme Google Ads a Meta poslať konverznú udalosť bez mena, telefónu a emailu. Identifikátory kliknutia uložíme iba pri zapnutej analytike aj marketingu.</small></span>
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
