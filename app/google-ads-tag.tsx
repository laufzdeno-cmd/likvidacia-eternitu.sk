'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { syncGoogleAdsConsent } from '@/src/lib/google-ads';
import { marketingConsentChangedEvent } from '@/src/lib/marketing-consent';

export default function GoogleAdsTag() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname?.startsWith('/admin')) return;
    syncGoogleAdsConsent();
    window.addEventListener(marketingConsentChangedEvent, syncGoogleAdsConsent);
    window.addEventListener('storage', syncGoogleAdsConsent);
    return () => {
      window.removeEventListener(marketingConsentChangedEvent, syncGoogleAdsConsent);
      window.removeEventListener('storage', syncGoogleAdsConsent);
    };
  }, [pathname]);
  return null;
}
