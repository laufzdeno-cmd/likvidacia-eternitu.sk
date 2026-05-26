'use client';

import { useEffect } from 'react';

type TrackAnalytics = (eventType: string, metadata?: Record<string, unknown>) => void;

function createAnalyticsTracker(): TrackAnalytics {
  const analyticsSessionId = (() => {
    const key = 'astana_analytics_session';
    try {
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      const created = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(key, created);
      return created;
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  })();

  const analyticsDevice = () => {
    if (window.innerWidth < 768) return 'mobile';
    if (window.innerWidth < 1024) return 'tablet';
    return 'desktop';
  };

  const analyticsParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
    };
  };

  return (eventType, metadata = {}) => {
    const payload = JSON.stringify({
      sessionId: analyticsSessionId,
      eventType,
      path: `${window.location.pathname}${window.location.hash || ''}`,
      referrer: document.referrer || '',
      device: analyticsDevice(),
      viewportWidth: window.innerWidth,
      ...analyticsParams(),
      metadata,
    });
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon('/api/analytics/', new Blob([payload], { type: 'application/json' }));
      if (sent) return;
    }
    void fetch('/api/analytics/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  };
}

export default function HomepageBelowFoldClient() {
  useEffect(() => {
    const trackAnalytics = createAnalyticsTracker();
    document.documentElement.dataset.homepageBelowFoldClient = 'loaded';
    const homeGalleryCards = Array.from(document.querySelectorAll<HTMLElement>('[data-home-gallery-card]'));
    const homeGalleryFilters = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-home-gallery-filter]'));

    const onHomeGalleryFilter = (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const category = button.dataset.homeGalleryFilter || 'vsetky';
      homeGalleryFilters.forEach((filter) => {
        const active = filter === button;
        filter.classList.toggle('is-active', active);
        filter.setAttribute('aria-pressed', String(active));
      });
      homeGalleryCards.forEach((card) => {
        const matches = category === 'vsetky' || card.dataset.category === category;
        card.classList.toggle('is-hidden', !matches);
      });
      trackAnalytics('gallery_filter', { gallery: 'home', category });
    };

    homeGalleryFilters.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', onHomeGalleryFilter);
    });

    let revealObserver: IntersectionObserver | undefined;
    document.documentElement.classList.add('has-enhanced-motion');
    const revealTargets = Array.from(
      document.querySelectorAll<HTMLElement>('.section, .transport-banner, .final-cta, .site-footer'),
    ).filter((item) => !item.closest('#dopyt') && !item.closest('.hero') && !item.closest('.trust-bar'));

    revealTargets.forEach((item) => item.classList.add('reveal-on-scroll'));
    if ('IntersectionObserver' in window && revealTargets.length) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            revealObserver?.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
      );
      revealTargets.forEach((item) => revealObserver?.observe(item));
    } else {
      revealTargets.forEach((item) => item.classList.add('is-visible'));
    }

    return () => {
      delete document.documentElement.dataset.homepageBelowFoldClient;
      homeGalleryFilters.forEach((button) => button.removeEventListener('click', onHomeGalleryFilter));
      revealObserver?.disconnect();
    };
  }, []);

  return null;
}
