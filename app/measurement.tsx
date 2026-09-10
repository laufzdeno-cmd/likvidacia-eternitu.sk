'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const consentKey = 'astana_cookie_consent_v2';
const attributionStorageKey = 'astana_paid_attribution_v2';
const googleAdsConversionId = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID?.trim() || '';
const googleAdsConversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim() || '';
const metaPixelId = '1374474630885790';
const metaPixelScriptId = 'astana-meta-pixel';
type ConsentChoice = 'accepted' | 'rejected';

type MetaPixelFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown> | IArguments>;
    gtag?: (...args: unknown[]) => void;
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
    astanaMetaPixelId?: string;
    astanaMetaPageViewPath?: string;
  }
}

const trackedMetaLeadIds = new Set<string>();

function ensureMetaPixel(pathname: string) {
  if (!hasLocalMarketingConsent()) return false;

  if (!window.fbq) {
    const fbq: MetaPixelFunction = (...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else (fbq.queue ||= []).push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
  }

  window.fbq('consent', 'grant');
  if (window.astanaMetaPixelId !== metaPixelId) {
    window.fbq('init', metaPixelId);
    window.astanaMetaPixelId = metaPixelId;
  }

  if (!document.getElementById(metaPixelScriptId)) {
    const script = document.createElement('script');
    script.id = metaPixelScriptId;
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  const pageViewPath = pathname || window.location.pathname;
  if (window.astanaMetaPageViewPath !== pageViewPath) {
    window.fbq('track', 'PageView');
    window.astanaMetaPageViewPath = pageViewPath;
  }
  return true;
}

function revokeMetaConsent() {
  window.fbq?.('consent', 'revoke');
  window.astanaMetaPageViewPath = undefined;
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
  if (choice === 'rejected') revokeMetaConsent();
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

type AttributionSnapshot = {
  gclid: string;
  gbraid: string;
  wbraid: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmAdGroup: string;
  utmTerm: string;
  utmContent: string;
  campaignId: string;
  adGroupId: string;
  creativeId: string;
  matchType: string;
  network: string;
  device: string;
  landingPage: string;
  referrer: string;
  capturedAt: string;
};

function currentAttribution(): AttributionSnapshot {
  const params = new URLSearchParams(window.location.search);
  return {
    gclid: params.get('gclid') || '', gbraid: params.get('gbraid') || '', wbraid: params.get('wbraid') || '',
    utmSource: params.get('utm_source') || '', utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '', utmAdGroup: params.get('utm_adgroup') || params.get('adgroup') || '',
    utmTerm: params.get('utm_term') || '', utmContent: params.get('utm_content') || '',
    campaignId: params.get('campaignid') || params.get('campaign_id') || '',
    adGroupId: params.get('adgroupid') || params.get('ad_group_id') || '',
    creativeId: params.get('creative') || params.get('creative_id') || '',
    matchType: params.get('matchtype') || '', network: params.get('network') || '', device: params.get('device') || '',
    landingPage: window.location.href, referrer: document.referrer || '', capturedAt: new Date().toISOString(),
  };
}

function isPaidAttribution(value: AttributionSnapshot) {
  return Boolean(value.gclid || value.gbraid || value.wbraid || value.utmSource || value.utmMedium || value.utmCampaign);
}

function readStoredAttribution() {
  try {
    return JSON.parse(window.sessionStorage.getItem(attributionStorageKey) || 'null') as { first?: AttributionSnapshot; last?: AttributionSnapshot } | null;
  } catch {
    return null;
  }
}

/** Stores click attribution only after marketing consent, and only for this browser session. */
export function captureLeadAttribution() {
  if (!hasLocalMarketingConsent()) return;
  const current = currentAttribution();
  if (!isPaidAttribution(current)) return;
  try {
    const stored = readStoredAttribution();
    window.sessionStorage.setItem(attributionStorageKey, JSON.stringify({ first: stored?.first || current, last: current }));
  } catch {
    // The current URL remains the safe fallback when session storage is unavailable.
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
      if (stored === 'accepted') {
        captureLeadAttribution();
        ensureMetaPixel(pathname || window.location.pathname);
      }
    }
    else setVisible(true);
  }, [isAdmin]);

  async function choose(choice: ConsentChoice) {
    window.localStorage.setItem(consentKey, choice);
    updateConsent(choice);
    await persistMarketingConsent(choice);
    if (choice === 'accepted') {
      captureLeadAttribution();
      ensureMetaPixel(pathname || window.location.pathname);
    }
    setVisible(false);
  }

  useEffect(() => {
    if (isAdmin || !hasLocalMarketingConsent()) return;
    ensureMetaPixel(pathname || window.location.pathname);
  }, [isAdmin, pathname]);

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
  captureLeadAttribution();
  const current = currentAttribution();
  const mayPersist = window.localStorage.getItem(consentKey) === 'accepted';
  let firstLandingPage = current.landingPage;
  let firstLandingAt = current.capturedAt;
  const storedAttribution = mayPersist ? readStoredAttribution() : null;
  const first = storedAttribution?.first;
  const last = storedAttribution?.last;
  if (mayPersist) {
    try {
      firstLandingPage = first?.landingPage || firstLandingPage;
      firstLandingAt = first?.capturedAt || firstLandingAt;
    } catch { /* Atribúcia aktuálnej stránky zostáva funkčná aj bez úložiska. */ }
  }
  const effective = <K extends keyof AttributionSnapshot>(key: K) => current[key] || last?.[key] || '';
  return {
    ...current,
    gclid: effective('gclid'), gbraid: effective('gbraid'), wbraid: effective('wbraid'),
    utmSource: effective('utmSource'), utmMedium: effective('utmMedium'), utmCampaign: effective('utmCampaign'),
    utmAdGroup: effective('utmAdGroup'), utmTerm: effective('utmTerm'), utmContent: effective('utmContent'),
    campaignId: effective('campaignId'), adGroupId: effective('adGroupId'), creativeId: effective('creativeId'),
    matchType: effective('matchType'), network: effective('network'), device: effective('device'),
    firstLandingPage, firstLandingAt,
  };
}

export function trackStoredLead(leadId: string, orderId: string, formName = 'lead') {
  if (!hasLocalMarketingConsent()) return;
  if (trackedMetaLeadIds.has(leadId)) return;
  const dedupeKey = 'astana_tracked_lead_ids_v1';
  try {
    const tracked = JSON.parse(window.sessionStorage.getItem(dedupeKey) || '[]') as string[];
    if (tracked.includes(leadId)) return;
    window.sessionStorage.setItem(dedupeKey, JSON.stringify([...tracked.slice(-19), leadId]));
  } catch { /* Meranie pokračuje aj v režime bez sessionStorage. */ }
  trackedMetaLeadIds.add(leadId);
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'astana_lead_saved', lead_id: leadId, lead_reference: orderId, form_name: formName, meta_event_id: leadId });
  window.gtag?.('event', 'generate_lead', { lead_reference: orderId, form_name: formName });
  if (googleAdsConversionId && googleAdsConversionLabel) {
    window.gtag?.('event', 'conversion', {
      send_to: `${googleAdsConversionId}/${googleAdsConversionLabel}`,
      transaction_id: orderId,
    });
  }
  if (ensureMetaPixel(window.location.pathname)) {
    window.fbq?.('track', 'Lead', { content_name: formName }, { eventID: leadId });
  }
}
