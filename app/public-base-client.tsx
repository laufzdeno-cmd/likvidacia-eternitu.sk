'use client';

import { useEffect } from 'react';
import { preserveCampaignAttributionOnInternalLink, trackAnalyticsEvent } from '@/src/lib/analytics-client';

export default function PublicBaseClient({ analyticsScope = 'all' }: { analyticsScope?: 'all' | 'none' }) {
  useEffect(() => {
    const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
    const nav = document.querySelector<HTMLElement>('#site-nav');
    const header = document.querySelector<HTMLElement>('.site-header');
    const navLinks = Array.from(nav?.querySelectorAll<HTMLAnchorElement>('a') || []);
    const stickyCta = document.querySelector<HTMLElement>('.mobile-sticky-cta');
    const whatsappButton = document.querySelector<HTMLElement>('.whatsapp-btn');
    const heroSection = document.querySelector<HTMLElement>('main > .hero');
    const quoteSection = document.getElementById('dopyt');
    const priceCalculatorCard = document.querySelector<HTMLElement>('[data-price-calculator]');

    const trackAnalytics = trackAnalyticsEvent;

    const onMenuClick = () => {
      if (!menuToggle || !nav) return;
      const open = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    };

    const closeMenu = () => {
      if (!menuToggle || !nav) return;
      menuToggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    };

    const onMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || menuToggle?.getAttribute('aria-expanded') !== 'true') return;
      closeMenu();
      menuToggle?.focus();
    };

    const isVisibleInViewport = (element: HTMLElement | null) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    };

    const isCookieBannerVisible = () => {
      const cookieBanner = document.querySelector<HTMLElement>('.cookie-banner');
      if (!cookieBanner) return false;
      const style = window.getComputedStyle(cookieBanner);
      const rect = cookieBanner.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0 && rect.bottom > 0;
    };

    const onScroll = () => {
      header?.classList.toggle('is-compact', window.scrollY > 28);
      const stickyVisible = window.innerWidth <= 760
        && window.scrollY > 280
        && !isVisibleInViewport(heroSection)
        && !isCookieBannerVisible()
        && !isVisibleInViewport(quoteSection)
        && !isVisibleInViewport(priceCalculatorCard);
      stickyCta?.classList.toggle('is-visible', stickyVisible);
      if (stickyCta) stickyCta.inert = !stickyVisible;
      whatsappButton?.classList.toggle('is-hidden-by-sticky-cta', stickyVisible);
      if (whatsappButton) whatsappButton.inert = stickyVisible;
    };

    const onAnalyticsClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a,button') : null;
      if (!target) return;
      const label = target.textContent?.trim().slice(0, 80) || '';
      const href = target instanceof HTMLAnchorElement ? target.getAttribute('href') || '' : '';
      trackAnalytics('cta_click', { label, href });
    };

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    const anchorLinks = navLinks.filter((link) => {
      const linkPath = link.pathname.replace(/\/$/, '') || '/';
      return link.hash && linkPath === currentPath;
    });
    const sectionLinks = new Map(anchorLinks.map((link) => [link.hash, link]));
    const observedSections = Array.from(document.querySelectorAll<HTMLElement>('main section[id], footer[id]')).filter((section) =>
      sectionLinks.has(`#${section.id}`),
    );
    const setActiveNav = (hash: string) => {
      navLinks.forEach((link) => {
        const linkPath = link.pathname.replace(/\/$/, '') || '/';
        const active = linkPath === currentPath && link.hash === hash;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else if (!link.matches('[aria-current="page"][href="/strechari/"]')) link.removeAttribute('aria-current');
      });
    };

    let sectionObserver: IntersectionObserver | undefined;
    let cookieBannerObserver: MutationObserver | null = null;
    let firstObserverFrame = 0;
    let secondObserverFrame = 0;
    const startDeferredObservers = () => {
      firstObserverFrame = window.requestAnimationFrame(() => {
        secondObserverFrame = window.requestAnimationFrame(() => {
          if ('IntersectionObserver' in window && observedSections.length) {
            sectionObserver = new IntersectionObserver((entries) => {
              const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
              if (visible?.target instanceof HTMLElement) setActiveNav(`#${visible.target.id}`);
            }, { rootMargin: '-18% 0px -62% 0px', threshold: [0.16, 0.35, 0.55] });
            observedSections.forEach((section) => sectionObserver?.observe(section));
          }
          if (stickyCta && 'MutationObserver' in window) {
            cookieBannerObserver = new MutationObserver(onScroll);
            cookieBannerObserver.observe(document.body, { childList: true, subtree: true });
          }
        });
      });
    };
    if (document.readyState === 'complete') startDeferredObservers();
    else window.addEventListener('load', startDeferredObservers, { once: true });

    const scrollToCurrentHash = () => {
      const rawHash = window.location.hash;
      if (!rawHash || rawHash.length < 2) return;
      const targetId = decodeURIComponent(rawHash.slice(1));
      const target = document.getElementById(targetId);
      if (!target) return;
      const headerHeight = header?.getBoundingClientRect().height || 118;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight - 18;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' });
      setActiveNav(rawHash);
    };

    const hashScrollTimers = new Set<number>();
    const scheduleHashScroll = (delay: number) => {
      const timer = window.setTimeout(() => {
        hashScrollTimers.delete(timer);
        scrollToCurrentHash();
      }, delay);
      hashScrollTimers.add(timer);
    };
    if (window.location.hash) [80, 420, 1200].forEach(scheduleHashScroll);
    const onHashChange = () => scheduleHashScroll(20);

    menuToggle?.addEventListener('click', onMenuClick);
    document.addEventListener('keydown', onMenuKeyDown);
    navLinks.forEach((link) => link.addEventListener('click', closeMenu));
    if (analyticsScope !== 'none') document.addEventListener('click', onAnalyticsClick);
    document.addEventListener('click', preserveCampaignAttributionOnInternalLink, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('hashchange', onHashChange);
    trackAnalytics('page_view');
    onScroll();

    return () => {
      menuToggle?.removeEventListener('click', onMenuClick);
      document.removeEventListener('keydown', onMenuKeyDown);
      navLinks.forEach((link) => link.removeEventListener('click', closeMenu));
      if (analyticsScope !== 'none') document.removeEventListener('click', onAnalyticsClick);
      document.removeEventListener('click', preserveCampaignAttributionOnInternalLink, true);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('load', startDeferredObservers);
      if (firstObserverFrame) window.cancelAnimationFrame(firstObserverFrame);
      if (secondObserverFrame) window.cancelAnimationFrame(secondObserverFrame);
      hashScrollTimers.forEach((timer) => window.clearTimeout(timer));
      sectionObserver?.disconnect();
      cookieBannerObserver?.disconnect();
      whatsappButton?.classList.remove('is-hidden-by-sticky-cta');
      if (whatsappButton) whatsappButton.inert = false;
    };
  }, [analyticsScope]);

  return null;
}
