'use client';

import { useEffect } from 'react';
import {
  hasMarketingConsent,
  marketingConsentChangedEvent,
  takePendingMetaLead,
  type PendingMetaLead,
} from '@/src/lib/marketing-consent';

const metaLeadEventName = 'astana:meta-lead';
const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    __astanaMetaPixelId?: string;
  }
}

function ensurePixelLoaded() {
  if (!pixelId || typeof window === 'undefined' || !hasMarketingConsent()) return false;

  if (!window.fbq) {
    const queue: unknown[] = [];
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else queue.push(args);
    }) as Fbq;
    fbq.push = (...args: unknown[]) => queue.push(args);
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = queue;
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  if (window.__astanaMetaPixelId !== pixelId) {
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    window.__astanaMetaPixelId = pixelId;
  }
  return true;
}

function trackLead(event: PendingMetaLead) {
  if (!ensurePixelLoaded() || !window.fbq) return false;
  window.fbq(
    'track',
    'Lead',
    { content_name: 'Cenová ponuka', material: event.material },
    { eventID: event.eventId },
  );
  return true;
}

export default function MetaPixel() {
  useEffect(() => {
    if (!pixelId) return;

    const flushPendingLead = () => {
      if (!hasMarketingConsent() || !ensurePixelLoaded()) return;
      const pending = takePendingMetaLead();
      if (pending) trackLead(pending);
    };

    const onConsentChanged = () => flushPendingLead();
    const onLead = (event: Event) => {
      const detail = (event as CustomEvent<PendingMetaLead>).detail;
      if (!detail || !hasMarketingConsent()) return;
      if (trackLead(detail)) takePendingMetaLead();
    };

    window.addEventListener(marketingConsentChangedEvent, onConsentChanged);
    window.addEventListener(metaLeadEventName, onLead);
    if (hasMarketingConsent()) {
      ensurePixelLoaded();
      window.setTimeout(flushPendingLead, 0);
    }

    return () => {
      window.removeEventListener(marketingConsentChangedEvent, onConsentChanged);
      window.removeEventListener(metaLeadEventName, onLead);
    };
  }, []);

  return null;
}
