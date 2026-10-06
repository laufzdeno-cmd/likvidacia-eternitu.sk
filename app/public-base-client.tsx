'use client';

import { useEffect } from 'react';
import { preserveCampaignAttributionOnInternalLink, trackAnalyticsEvent } from '@/src/lib/analytics-client';

export default function PublicBaseClient() {
  useEffect(() => {
    const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
    const nav = document.querySelector<HTMLElement>('#site-nav');
    const header = document.querySelector<HTMLElement>('.site-header');
    const navLinks = Array.from(nav?.querySelectorAll<HTMLAnchorElement>('a') || []);
    const stickyCta = document.querySelector<HTMLElement>('.mobile-sticky-cta');

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

    const onScroll = () => {
      header?.classList.toggle('is-compact', window.scrollY > 28);
      const stickyVisible = window.innerWidth <= 760 && window.scrollY > 280;
      stickyCta?.classList.toggle('is-visible', stickyVisible);
      if (stickyCta) stickyCta.inert = !stickyVisible;
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
    if ('IntersectionObserver' in window && observedSections.length) {
      sectionObserver = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target instanceof HTMLElement) setActiveNav(`#${visible.target.id}`);
      }, { rootMargin: '-18% 0px -62% 0px', threshold: [0.16, 0.35, 0.55] });
      observedSections.forEach((section) => sectionObserver?.observe(section));
    }

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

    const hashScrollTimers = [
      window.setTimeout(scrollToCurrentHash, 80),
      window.setTimeout(scrollToCurrentHash, 420),
      window.setTimeout(scrollToCurrentHash, 1200),
    ];
    const onHashChange = () => window.setTimeout(scrollToCurrentHash, 20);

    menuToggle?.addEventListener('click', onMenuClick);
    navLinks.forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('click', onAnalyticsClick);
    document.addEventListener('click', preserveCampaignAttributionOnInternalLink, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('hashchange', onHashChange);
    trackAnalytics('page_view');
    onScroll();

    return () => {
      menuToggle?.removeEventListener('click', onMenuClick);
      navLinks.forEach((link) => link.removeEventListener('click', closeMenu));
      document.removeEventListener('click', onAnalyticsClick);
      document.removeEventListener('click', preserveCampaignAttributionOnInternalLink, true);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('hashchange', onHashChange);
      hashScrollTimers.forEach((timer) => window.clearTimeout(timer));
      sectionObserver?.disconnect();
    };
  }, []);

  return null;
}
