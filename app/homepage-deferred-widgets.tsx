'use client';

import { useEffect, useState } from 'react';
import PublicWhatsapp from './public-whatsapp';

type PublicWidgetsComponent = typeof import('./public-widgets').default;

const openConsentEvent = 'astana:open-cookie-settings';
const immediateWidgetSelector = '#dopyt, #orientacna-cena, a[href="#dopyt"], a[href="#orientacna-cena"]';

export default function HomepageDeferredWidgets() {
  const [PublicWidgets, setPublicWidgets] = useState<PublicWidgetsComponent | null>(null);
  const [initialOpenSettings, setInitialOpenSettings] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadTimer = 0;
    let loading = false;

    const loadWidgets = (openSettings = false) => {
      if (openSettings) setInitialOpenSettings(true);
      if (cancelled || loading || PublicWidgets) return;
      loading = true;
      void import('./public-widgets').then((module) => {
        if (!cancelled) setPublicWidgets(() => module.default);
      }).catch(() => {
        if (!cancelled) loading = false;
      });
    };
    const scheduleWidgets = () => {
      loadTimer = window.setTimeout(() => loadWidgets(), 3000);
    };
    const loadFromIntent = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(immediateWidgetSelector)) loadWidgets();
    };
    const openSettings = () => loadWidgets(true);

    if (document.readyState === 'complete') scheduleWidgets();
    else window.addEventListener('load', scheduleWidgets, { once: true });
    document.addEventListener('pointerdown', loadFromIntent, true);
    document.addEventListener('focusin', loadFromIntent, true);
    window.addEventListener(openConsentEvent, openSettings);

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
      window.removeEventListener('load', scheduleWidgets);
      document.removeEventListener('pointerdown', loadFromIntent, true);
      document.removeEventListener('focusin', loadFromIntent, true);
      window.removeEventListener(openConsentEvent, openSettings);
    };
  }, []);

  return (
    <>
      <PublicWhatsapp hideOnMobile />
      {PublicWidgets ? (
        <PublicWidgets hideWhatsappOnMobile renderWhatsapp={false} initialOpenSettings={initialOpenSettings} />
      ) : null}
    </>
  );
}
