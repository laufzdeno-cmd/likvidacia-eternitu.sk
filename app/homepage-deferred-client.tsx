'use client';

import { useEffect, useState } from 'react';

type BelowFoldModule = typeof import('./homepage-below-fold-client');

export default function HomepageDeferredClient() {
  const [BelowFoldClient, setBelowFoldClient] = useState<BelowFoldModule['default'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: IntersectionObserver | null = null;

    const loadBelowFold = () => {
      void import('./homepage-below-fold-client').then((mod) => {
        if (!cancelled) setBelowFoldClient(() => mod.default);
      });
    };

    if (!('IntersectionObserver' in window)) {
      loadBelowFold();
      return () => {
        cancelled = true;
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
    };
  }, []);

  return BelowFoldClient ? <BelowFoldClient /> : null;
}
