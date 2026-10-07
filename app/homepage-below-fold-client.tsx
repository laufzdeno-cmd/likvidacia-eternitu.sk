'use client';

import { useEffect } from 'react';
import { createAnalyticsTracker } from '@/src/lib/analytics-client';

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
    const motionAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealTargets = Array.from(
      document.querySelectorAll<HTMLElement>('.section, .transport-banner, .final-cta, .site-footer'),
    ).filter((item) => !item.closest('#dopyt') && !item.closest('.hero') && !item.closest('.trust-bar'));

    if (motionAllowed) {
      document.documentElement.classList.add('has-enhanced-motion');
      revealTargets.forEach((item) => item.classList.add('reveal-on-scroll'));
    }
    if (motionAllowed && 'IntersectionObserver' in window && revealTargets.length) {
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
      document.documentElement.classList.remove('has-enhanced-motion');
      revealTargets.forEach((item) => item.classList.remove('reveal-on-scroll', 'is-visible'));
    };
  }, []);

  return null;
}
