'use client';

import { useEffect, useState } from 'react';

type BelowFoldModule = typeof import('./homepage-below-fold-client');

const immediateStyleHashes = new Set(['#dopyt', '#orientacna-cena']);
const immediateStyleSelector = 'a[href="#dopyt"], a[href="#orientacna-cena"]';

export default function HomepageDeferredClient() {
  const [BelowFoldClient, setBelowFoldClient] = useState<BelowFoldModule['default'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let styleFrame = 0;
    let deferredStyles = document.querySelector<HTMLLinkElement>('link[data-home-deferred-styles]');
    let createdDeferredStyles = false;

    const activateDeferredStyles = () => {
      if (!cancelled && deferredStyles) deferredStyles.media = 'all';
    };
    const ensureDeferredStyles = (immediate = false) => {
      if (cancelled) return;
      if (deferredStyles) {
        if (immediate) activateDeferredStyles();
        return;
      }
      deferredStyles = document.createElement('link');
      deferredStyles.rel = 'stylesheet';
      deferredStyles.href = '/assets/home-below-fold.css';
      deferredStyles.fetchPriority = 'low';
      deferredStyles.media = immediate ? 'all' : 'print';
      if (!immediate) deferredStyles.addEventListener('load', activateDeferredStyles, { once: true });
      deferredStyles.dataset.homeDeferredStyles = 'true';
      document.head.append(deferredStyles);
      createdDeferredStyles = true;
    };
    const loadStylesFromIntent = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(immediateStyleSelector)) ensureDeferredStyles(true);
    };

    if (immediateStyleHashes.has(window.location.hash)) {
      ensureDeferredStyles(true);
    } else {
      styleFrame = window.requestAnimationFrame(() => {
        styleFrame = window.requestAnimationFrame(() => ensureDeferredStyles());
      });
    }
    document.addEventListener('pointerdown', loadStylesFromIntent, true);
    document.addEventListener('focusin', loadStylesFromIntent, true);

    const loadBelowFold = () => {
      void import('./homepage-below-fold-client').then((mod) => {
        if (!cancelled) setBelowFoldClient(() => mod.default);
      });
    };

    if (!('IntersectionObserver' in window)) {
      loadBelowFold();
      return () => {
        cancelled = true;
        document.removeEventListener('pointerdown', loadStylesFromIntent, true);
        document.removeEventListener('focusin', loadStylesFromIntent, true);
        if (styleFrame) window.cancelAnimationFrame(styleFrame);
        if (createdDeferredStyles) deferredStyles?.remove();
      };
    }

    observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        loadBelowFold();
        observer?.disconnect();
      },
      { rootMargin: '400px 0px' },
    );

    const firstLazySection =
      document.querySelector<HTMLElement>('#realizacie-astana') ||
      document.querySelector<HTMLElement>('#recenzie') ||
      document.querySelector<HTMLElement>('#faq');
    if (firstLazySection) observer.observe(firstLazySection);
    else loadBelowFold();

    return () => {
      cancelled = true;
      observer?.disconnect();
      document.removeEventListener('pointerdown', loadStylesFromIntent, true);
      document.removeEventListener('focusin', loadStylesFromIntent, true);
      if (styleFrame) window.cancelAnimationFrame(styleFrame);
      if (createdDeferredStyles) deferredStyles?.remove();
    };
  }, []);

  return BelowFoldClient ? <BelowFoldClient /> : null;
}
