'use client';

import { useEffect } from 'react';

export default function HomepageCriticalClient() {
  useEffect(() => {
    const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
    const nav = document.querySelector<HTMLElement>('#site-nav');
    const header = document.querySelector<HTMLElement>('.site-header');
    const form = document.querySelector<HTMLFormElement>('.lead-form');
    const fileInput = document.querySelector<HTMLInputElement>('#photos');
    const selectedRooferInput = document.querySelector<HTMLInputElement>('#selectedRooferId');
    const rooferSelect = document.querySelector<HTMLSelectElement>('#roofer');
    const fileDrop = document.querySelector<HTMLElement>('.file-drop');
    const preview = document.querySelector<HTMLElement>('.file-preview');
    const status = document.querySelector<HTMLElement>('.form-status');
    const stickyCta = document.querySelector<HTMLElement>('.mobile-sticky-cta');
    const whatsappButton = document.querySelector<HTMLElement>('.whatsapp-btn');
    const quoteSection = document.getElementById('dopyt');
    const heroCounterRoot = document.querySelector<HTMLElement>('[data-hero-counters]');
    const heroCounters = Array.from(document.querySelectorAll<HTMLElement>('[data-hero-counter]'));
    const navLinks = Array.from(nav?.querySelectorAll<HTMLAnchorElement>('a') || []);
    let selectedFiles: File[] = [];
    let isQuoteSectionVisible = false;
    let formStarted = false;
    let quoteSectionTracked = false;
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);

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

    const trackAnalytics = (eventType: string, metadata: Record<string, unknown> = {}) => {
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

    const updateFileInput = () => {
      if (!fileInput) return;
      const transfer = new DataTransfer();
      selectedFiles.slice(0, 10).forEach((file) => transfer.items.add(file));
      fileInput.files = transfer.files;
    };

    const applyRooferSelectionFromUrl = () => {
      if (!form || !rooferSelect) return;
      const params = new URLSearchParams(window.location.search);
      const selectedRooferId = params.get('selectedRooferId') || '';
      const wantsRoofer = params.get('wantsRooferRecommendation') === 'true';
      if (selectedRooferId && selectedRooferInput) selectedRooferInput.value = selectedRooferId;
      if (selectedRooferId || wantsRoofer) rooferSelect.value = 'Chcem odporučiť strechára podľa regiónu';
    };

    const setStatus = (message: string, type?: 'success' | 'error' | 'loading', variant?: 'submit', email?: string) => {
      if (!status) return;
      status.classList.toggle('is-submit-success', type === 'success' && variant === 'submit');
      status.classList.toggle('is-success', type === 'success');
      status.classList.toggle('is-error', type === 'error');
      status.classList.toggle('is-loading', type === 'loading');
      if (type === 'loading') {
        status.innerHTML =
          '<span class="form-loading-bar" aria-hidden="true"></span><strong>Odosielame dopyt...</strong><span>Chvíľu počkajte, ukladáme údaje a posielame potvrdenie.</span>';
        return;
      }
      if (type === 'success' && variant === 'submit') {
        status.innerHTML = [
          '<span class="success-check" aria-hidden="true">&#10003;</span>',
          '<strong>Dopyt sme prijali</strong>',
          `<span>Cenovú ponuku vám pošleme do 24 hodín na email:<br><b>${escapeHtml(email || 'zadaný email')}</b></span>`,
          '<div class="success-next"><em>Čo sa stane ďalej:</em><span>1. Skontrolujeme váš dopyt</span><span>2. Pripravíme cenovú ponuku</span><span>3. Pošleme vám ju do 24 hodín</span></div>',
          '<small>Máte otázky? Zavolajte:</small>',
          '<a class="success-phone" href="tel:+421905217946">0905 217 946</a>',
          '<small>Po-Pia 7:00-18:00</small>',
        ].join('');
        return;
      }
      status.textContent = message;
    };

    const renderFiles = () => {
      if (!fileInput || !preview) return;
      preview.innerHTML = '';
      selectedFiles.forEach((file, index) => {
        const chip = document.createElement('span');
        chip.className = 'file-chip';
        const label = document.createElement('span');
        label.textContent = `${file.name} (${Math.round(file.size / 1024)} kB)`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Odstrániť ${file.name}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          selectedFiles.splice(index, 1);
          updateFileInput();
          renderFiles();
        });
        chip.append(label, remove);
        preview.appendChild(chip);
      });
    };

    const addFiles = (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const accepted: File[] = [];
      for (const file of incoming) {
        if (selectedFiles.length + accepted.length >= 10) {
          setStatus('Nahrať môžete maximálne 10 súborov.', 'error');
          break;
        }
        if (file.size > 10 * 1024 * 1024) {
          setStatus(`Súbor ${file.name} je väčší ako 10 MB.`, 'error');
          continue;
        }
        accepted.push(file);
      }
      selectedFiles = [...selectedFiles, ...accepted];
      updateFileInput();
      renderFiles();
      if (accepted.length) setStatus(`Vybrané fotky: ${selectedFiles.length}.`, 'success');
    };

    const onFilesChange = () => {
      if (fileInput?.files) addFiles(fileInput.files);
    };

    const loadingIcon =
      '<svg class="submit-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';

    const ensureSubmitProgress = () => {
      if (!form) return;
      let progress = form.querySelector<HTMLElement>('.submit-progress');
      if (!progress) {
        progress = document.createElement('div');
        progress.className = 'submit-progress';
        progress.setAttribute('role', 'status');
        progress.setAttribute('aria-live', 'polite');
        progress.innerHTML = [
          '<span class="submit-progress-bar" aria-hidden="true"></span>',
          '<span class="submit-progress-spinner" aria-hidden="true"></span>',
          '<strong>Odosielame dopyt</strong>',
          '<span>Chvíľu počkajte, nahrávame údaje a posielame potvrdenie.</span>',
        ].join('');
        const submit = form.querySelector<HTMLButtonElement>('.form-submit');
        submit?.insertAdjacentElement('afterend', progress);
      }
      progress.hidden = false;
    };

    const hideSubmitProgress = () => {
      form?.querySelector<HTMLElement>('.submit-progress')?.setAttribute('hidden', 'true');
    };

    const setFormSubmitting = (submitting: boolean, button?: HTMLButtonElement | null) => {
      if (!form) return;
      form.classList.toggle('is-submitting', submitting);
      Array.from(form.elements).forEach((element) => {
        const control = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
        control.disabled = submitting;
      });
      if (button) {
        button.disabled = submitting;
        button.classList.toggle('is-submitting', submitting);
        if (submitting) {
          button.innerHTML = `${loadingIcon}<span>Odosielam...</span>`;
          ensureSubmitProgress();
        } else if (button.dataset.defaultLabel) {
          button.innerHTML = button.dataset.defaultLabel;
          hideSubmitProgress();
        }
      }
    };

    const clearStatus = () => {
      if (!status) return;
      status.classList.remove('is-submit-success', 'is-success', 'is-error', 'is-loading');
      status.textContent = '';
    };

    const onSubmit = async (event: SubmitEvent) => {
      if (!form) return;
      event.preventDefault();
      clearStatus();
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const payload = new FormData(form);
      const submittedEmail = String(payload.get('email') || '').trim();
      if (button && !button.dataset.defaultLabel) button.dataset.defaultLabel = button.innerHTML;
      setFormSubmitting(true, button);

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: payload,
          headers: { Accept: 'application/json' },
        });
        const result = (await response.json()) as { ok?: boolean; message?: string };
        if (!response.ok || !result.ok) throw new Error(result.message || 'Dopyt sa nepodarilo odoslať.');
        form.reset();
        selectedFiles = [];
        updateFileInput();
        if (preview) preview.innerHTML = '';
        trackAnalytics('form_submit_success', { form: 'lead' });
        form.classList.add('is-submitted');
        setStatus(result.message || 'Dopyt sme prijali. Ozveme sa vám s ďalším postupom.', 'success', 'submit', submittedEmail);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Dopyt sa nepodarilo odoslať.', 'error');
        trackAnalytics('form_submit_error', { form: 'lead', message: error instanceof Error ? error.message : 'unknown' });
        setFormSubmitting(false, button);
      } finally {
        if (form.classList.contains('is-submitted')) button?.setAttribute('disabled', 'true');
      }
    };

    const onFormStart = () => {
      if (formStarted) return;
      formStarted = true;
      trackAnalytics('form_start', { form: 'lead' });
    };

    const onAnalyticsClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a,button') : null;
      if (!target) return;
      const label = target.textContent?.trim().slice(0, 80) || '';
      if (target instanceof HTMLAnchorElement && target.href.startsWith('tel:')) {
        trackAnalytics('phone_click', { label, href: target.getAttribute('href') || '' });
        return;
      }
      const href = target instanceof HTMLAnchorElement ? target.getAttribute('href') || '' : '';
      if (href.includes('#dopyt') || target.classList.contains('form-submit')) {
        trackAnalytics('cta_click', { label, href });
      }
    };

    const formatCounterValue = (value: number, suffix: string, format?: string) =>
      `${format === 'plain' ? String(value) : new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 }).format(value)}${suffix}`;

    const runHeroCounters = () => {
      heroCounters.forEach((counter) => {
        const target = Number(counter.dataset.counterTarget || 0);
        const start = Number(counter.dataset.counterStart || 0);
        const suffix = counter.dataset.counterSuffix || '';
        const format = counter.dataset.counterFormat || 'locale';
        const duration = 1500;
        const startedAt = performance.now();
        const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

        const tick = (now: number) => {
          const progress = Math.min(Math.max((now - startedAt) / duration, 0), 1);
          const value = Math.round(start + (target - start) * easeOutQuart(progress));
          counter.textContent = formatCounterValue(value, suffix, format);
          if (progress < 1) requestAnimationFrame(tick);
        };

        counter.textContent = formatCounterValue(start, suffix, format);
        requestAnimationFrame(tick);
      });
    };

    const onScroll = () => {
      header?.classList.toggle('is-compact', window.scrollY > 28);
      const isMobile = window.innerWidth <= 760;
      whatsappButton?.classList.toggle('is-hidden-over-form', isMobile && isQuoteSectionVisible);
      if (!stickyCta) return;
      const shouldShow = form
        ? isMobile && !isQuoteSectionVisible && form.getBoundingClientRect().bottom < 120
        : isMobile && window.scrollY > 280;
      stickyCta.classList.toggle('is-visible', shouldShow);
    };

    menuToggle?.addEventListener('click', onMenuClick);
    navLinks.forEach((link) => link.addEventListener('click', closeMenu));
    applyRooferSelectionFromUrl();
    fileInput?.addEventListener('change', onFilesChange);
    const onFileDragOver = (event: DragEvent) => {
      event.preventDefault();
      fileDrop?.classList.add('is-dragging');
    };
    const onFileDragLeave = () => fileDrop?.classList.remove('is-dragging');
    const onFileDrop = (event: DragEvent) => {
      event.preventDefault();
      fileDrop?.classList.remove('is-dragging');
      if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
    };
    fileDrop?.addEventListener('dragover', onFileDragOver);
    fileDrop?.addEventListener('dragleave', onFileDragLeave);
    fileDrop?.addEventListener('drop', onFileDrop);
    form?.addEventListener('submit', onSubmit);
    form?.addEventListener('focusin', onFormStart);
    form?.addEventListener('input', onFormStart);
    document.addEventListener('click', onAnalyticsClick);
    trackAnalytics('page_view');

    let quoteSectionObserver: IntersectionObserver | null = null;
    if (quoteSection && stickyCta) {
      quoteSectionObserver = new IntersectionObserver(
        ([entry]) => {
          isQuoteSectionVisible = entry.isIntersecting;
          if (entry.isIntersecting && !quoteSectionTracked) {
            quoteSectionTracked = true;
            trackAnalytics('quote_section_view');
          }
          onScroll();
        },
        { threshold: 0.1 },
      );
      quoteSectionObserver.observe(quoteSection);
    }

    let counterObserver: IntersectionObserver | undefined;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (heroCounters.length) {
      if (prefersReducedMotion) {
        heroCounters.forEach((counter) => {
          const target = Number(counter.dataset.counterTarget || 0);
          const suffix = counter.dataset.counterSuffix || '';
          const format = counter.dataset.counterFormat || 'locale';
          counter.textContent = formatCounterValue(target, suffix, format);
        });
      } else if ('IntersectionObserver' in window && heroCounterRoot) {
        counterObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              runHeroCounters();
              counterObserver?.disconnect();
            });
          },
          { threshold: 0.35 },
        );
        counterObserver.observe(heroCounterRoot);
      } else {
        runHeroCounters();
      }
    }

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
      sectionObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible?.target instanceof HTMLElement) setActiveNav(`#${visible.target.id}`);
        },
        { rootMargin: '-18% 0px -62% 0px', threshold: [0.16, 0.35, 0.55] },
      );
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

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('hashchange', onHashChange);
    onScroll();

    return () => {
      menuToggle?.removeEventListener('click', onMenuClick);
      navLinks.forEach((link) => link.removeEventListener('click', closeMenu));
      fileInput?.removeEventListener('change', onFilesChange);
      fileDrop?.removeEventListener('dragover', onFileDragOver);
      fileDrop?.removeEventListener('dragleave', onFileDragLeave);
      fileDrop?.removeEventListener('drop', onFileDrop);
      form?.removeEventListener('submit', onSubmit);
      form?.removeEventListener('focusin', onFormStart);
      form?.removeEventListener('input', onFormStart);
      document.removeEventListener('click', onAnalyticsClick);
      quoteSectionObserver?.disconnect();
      counterObserver?.disconnect();
      sectionObserver?.disconnect();
      hashScrollTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return null;
}
