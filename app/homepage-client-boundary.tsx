'use client';

import { useEffect, useRef, useState } from 'react';
import { trackAnalyticsEvent } from '@/src/lib/analytics-client';
import PublicBaseClient from './public-base-client';

type CriticalClientProps = {
  pageViewAlreadyTracked?: boolean;
  clickAnalyticsAlreadyTracked?: boolean;
};
type CriticalInitializer = (props: CriticalClientProps) => void | (() => void);

const activationHashes = new Set(['#dopyt', '#orientacna-cena']);

export default function HomepageClientBoundary() {
  const [active, setActive] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [initializeCriticalClient, setInitializeCriticalClient] = useState<CriticalInitializer | null>(null);
  const criticalReady = useRef(false);
  const criticalLoadFailed = useRef(false);
  const nativeFallbackInProgress = useRef(false);
  const pendingAction = useRef<HTMLElement | null>(null);
  const pendingFiles = useRef<File[]>([]);

  const restorePendingFiles = () => {
    const files = pendingFiles.current;
    if (!files.length) return null;
    const input = document.querySelector<HTMLInputElement>('#photos');
    if (!input) return null;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    return input;
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    if (
      activationHashes.has(url.hash) ||
      url.searchParams.has('odoslane') ||
      url.searchParams.has('dopyt_receipt') ||
      url.searchParams.has('chyba')
    ) {
      setActive(true);
    }

    const activateFromClick = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('#dopyt, #orientacna-cena, a[href="#dopyt"], a[href="#orientacna-cena"]')) {
        setActive(true);
      }
    };
    const preserveFirstCriticalAction = (event: MouseEvent) => {
      if (criticalReady.current || nativeFallbackInProgress.current) return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-price-material], [data-price-quote], .form-submit')
        : null;
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingAction.current ??= target;
      setActive(true);
      if (criticalLoadFailed.current) {
        criticalLoadFailed.current = false;
        setLoadAttempt((attempt) => attempt + 1);
      }
    };
    const preservePendingFiles = (event: Event) => {
      if (criticalReady.current) return;
      const input = event.target instanceof HTMLInputElement && event.target.id === 'photos'
        ? event.target
        : null;
      if (!input?.files?.length) return;
      event.stopImmediatePropagation();
      pendingFiles.current = Array.from(input.files);
      setActive(true);
    };
    const activateFromFileDrag = (event: DragEvent) => {
      if (criticalReady.current) return;
      const target = event.target instanceof Element ? event.target.closest('.file-drop') : null;
      if (!target) return;
      event.preventDefault();
      setActive(true);
    };
    const preserveFirstFileDrop = (event: DragEvent) => {
      if (criticalReady.current) return;
      const target = event.target instanceof Element ? event.target.closest('.file-drop') : null;
      if (!target || !event.dataTransfer?.files?.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingFiles.current = Array.from(event.dataTransfer.files);
      setActive(true);
    };
    const activateFromFocus = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('#dopyt, #orientacna-cena')) setActive(true);
    };
    const activateFromHash = () => {
      if (activationHashes.has(window.location.hash)) setActive(true);
    };
    const trackHomepageClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a,button') : null;
      if (!target) return;
      const label = target.textContent?.trim().slice(0, 80) || '';
      const href = target instanceof HTMLAnchorElement ? target.getAttribute('href') || '' : '';
      if (target instanceof HTMLAnchorElement && target.href.startsWith('tel:')) {
        trackAnalyticsEvent('phone_click', { label, href });
        return;
      }
      if (href.includes('#dopyt') || target.classList.contains('form-submit')) {
        trackAnalyticsEvent('cta_click', { label, href });
      }
    };

    document.addEventListener('click', preserveFirstCriticalAction, true);
    document.addEventListener('click', activateFromClick, true);
    document.addEventListener('click', trackHomepageClick, true);
    document.addEventListener('focusin', activateFromFocus, true);
    document.addEventListener('change', preservePendingFiles, true);
    document.addEventListener('dragover', activateFromFileDrag, true);
    document.addEventListener('drop', preserveFirstFileDrop, true);
    window.addEventListener('hashchange', activateFromHash);

    return () => {
      document.removeEventListener('click', preserveFirstCriticalAction, true);
      document.removeEventListener('click', activateFromClick, true);
      document.removeEventListener('click', trackHomepageClick, true);
      document.removeEventListener('focusin', activateFromFocus, true);
      document.removeEventListener('change', preservePendingFiles, true);
      document.removeEventListener('dragover', activateFromFileDrag, true);
      document.removeEventListener('drop', preserveFirstFileDrop, true);
      window.removeEventListener('hashchange', activateFromHash);
    };
  }, []);

  useEffect(() => {
    if (!active || initializeCriticalClient) return;
    let cancelled = false;
    let retryTimer: number | undefined;
    void import('./homepage-critical-client').then((module) => {
      if (!cancelled) {
        criticalLoadFailed.current = false;
        setInitializeCriticalClient(() => module.default);
      }
    }).catch(() => {
      if (cancelled) return;
      if (loadAttempt < 1) {
        retryTimer = window.setTimeout(() => setLoadAttempt((attempt) => attempt + 1), 250);
        return;
      }
      criticalLoadFailed.current = true;
      restorePendingFiles();
      pendingFiles.current = [];
      const target = pendingAction.current;
      pendingAction.current = null;
      if (target?.isConnected) {
        nativeFallbackInProgress.current = true;
        target.click();
        window.setTimeout(() => {
          nativeFallbackInProgress.current = false;
        }, 0);
      }
    });
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [active, initializeCriticalClient, loadAttempt]);

  useEffect(() => {
    if (!initializeCriticalClient) return;
    const cleanup = initializeCriticalClient({ pageViewAlreadyTracked: true, clickAnalyticsAlreadyTracked: true });
    criticalReady.current = true;
    document.documentElement.dataset.homepageCriticalClient = 'loaded';
    const input = restorePendingFiles();
    pendingFiles.current = [];
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    const target = pendingAction.current;
    pendingAction.current = null;
    if (target?.isConnected) target.click();
    return () => {
      criticalReady.current = false;
      delete document.documentElement.dataset.homepageCriticalClient;
      cleanup?.();
    };
  }, [initializeCriticalClient]);

  return initializeCriticalClient ? null : <PublicBaseClient analyticsScope="none" />;
}
