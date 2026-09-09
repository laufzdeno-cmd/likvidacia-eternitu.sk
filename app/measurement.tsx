'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const consentKey = 'astana_cookie_consent_v2';
const googleAdsConversionId = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID?.trim() || '';
const googleAdsConversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim() || '';
type ConsentChoice = 'accepted' | 'rejected';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown> | IArguments>;
    gtag?: (...args: unknown[]) => void;
  }
}

function updateConsent(choice: ConsentChoice) {
  const granted = choice === 'accepted' ? 'granted' : 'denied';
  window.gtag?.('consent', 'update', {
    analytics_storage: granted,
    ad_storage: granted,
    ad_user_data: granted,
    ad_personalization: granted,
  });
  window.dataLayer?.push({ event: 'astana_consent_update', consent_choice: choice });
}

async function persistMarketingConsent(choice: ConsentChoice) {
  try {
    await fetch('/api/consent/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ choice }),
    });
  } catch {
    // Meranie ostane vypnuté na serveri, kým sa súhlas nepodarí bezpečne uložiť.
  }
}

function hasLocalMarketingConsent() {
  try {
    return window.localStorage.getItem(consentKey) === 'accepted';
  } catch {
    return false;
  }
}

export function MeasurementConsent() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isAdmin) return;
    const stored = window.localStorage.getItem(consentKey) as ConsentChoice | null;
    if (stored === 'accepted' || stored === 'rejected') {
      updateConsent(stored);
      void persistMarketingConsent(stored);
    }
    else setVisible(true);
  }, [isAdmin]);

  async function choose(choice: ConsentChoice) {
    window.localStorage.setItem(consentKey, choice);
    updateConsent(choice);
    await persistMarketingConsent(choice);
    setVisible(false);
  }

  if (isAdmin) return null;
  if (!visible) {
    return <button type="button" className="cookie-settings-trigger" onClick={() => setVisible(true)}>Nastavenie cookies</button>;
  }
  return (
    <aside className="cookie-consent" aria-label="Nastavenie cookies" role="dialog" aria-live="polite">
      <div>
        <strong>Vaše súkromie je dôležité</strong>
        <p>Nevyhnutné úložisko používame na fungovanie webu. Google Analytics a reklamné meranie zapneme iba s vaším súhlasom. <a href="/cookies/">Podrobnosti</a></p>
      </div>
      <div className="cookie-consent-actions">
        <button type="button" className="button button-outline" onClick={() => void choose('rejected')}>Iba nevyhnutné</button>
        <button type="button" className="button button-primary" onClick={() => void choose('accepted')}>Prijať všetky</button>
      </div>
    </aside>
  );
}

export function leadAttribution() {
  const params = new URLSearchParams(window.location.search);
  const current = {
    gclid: params.get('gclid') || '', gbraid: params.get('gbraid') || '', wbraid: params.get('wbraid') || '',
    utmSource: params.get('utm_source') || '', utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '', utmAdGroup: params.get('utm_adgroup') || params.get('adgroup') || '',
    utmTerm: params.get('utm_term') || '', utmContent: params.get('utm_content') || '',
    campaignId: params.get('campaignid') || params.get('campaign_id') || '',
    adGroupId: params.get('adgroupid') || params.get('ad_group_id') || '',
    creativeId: params.get('creative') || params.get('creative_id') || '',
    matchType: params.get('matchtype') || '', network: params.get('network') || '', device: params.get('device') || '',
    landingPage: window.location.href, referrer: document.referrer || '',
  };
  const mayPersist = window.localStorage.getItem(consentKey) === 'accepted';
  const storageKey = 'astana_first_landing_v1';
  let firstLandingPage = current.landingPage;
  let firstLandingAt = new Date().toISOString();
  if (mayPersist) {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { page?: string; at?: string };
        firstLandingPage = parsed.page || firstLandingPage;
        firstLandingAt = parsed.at || firstLandingAt;
      } else window.sessionStorage.setItem(storageKey, JSON.stringify({ page: firstLandingPage, at: firstLandingAt }));
    } catch { /* Atribúcia aktuálnej stránky zostáva funkčná aj bez úložiska. */ }
  }
  return { ...current, firstLandingPage, firstLandingAt };
}

export function trackStoredLead(leadId: string, orderId: string, formName = 'lead') {
  if (!hasLocalMarketingConsent()) return;
  const dedupeKey = 'astana_tracked_lead_ids_v1';
  try {
    const tracked = JSON.parse(window.sessionStorage.getItem(dedupeKey) || '[]') as string[];
    if (tracked.includes(leadId)) return;
    window.sessionStorage.setItem(dedupeKey, JSON.stringify([...tracked.slice(-19), leadId]));
  } catch { /* Meranie pokračuje aj v režime bez sessionStorage. */ }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'astana_lead_saved', lead_id: leadId, lead_reference: orderId, form_name: formName });
  window.gtag?.('event', 'generate_lead', { lead_reference: orderId, form_name: formName });
  if (googleAdsConversionId && googleAdsConversionLabel) {
    window.gtag?.('event', 'conversion', {
      send_to: `${googleAdsConversionId}/${googleAdsConversionLabel}`,
      transaction_id: orderId,
    });
  }
}
