'use client';

import { useEffect } from 'react';
import { upload } from '@vercel/blob/client';
import {
  hasMarketingConsent,
  rememberPendingMetaLead,
  takePendingMetaLead,
  type PendingMetaLead,
} from '@/src/lib/marketing-consent';

const metaLeadEventName = 'astana:meta-lead';
const hasMetaPixelId = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim());

export default function HomepageCriticalClient() {
  useEffect(() => {
    const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
    const nav = document.querySelector<HTMLElement>('#site-nav');
    const header = document.querySelector<HTMLElement>('.site-header');
    const form = document.querySelector<HTMLFormElement>('.lead-form');
    const fileInput = document.querySelector<HTMLInputElement>('#photos');
    const submissionIdInput = document.querySelector<HTMLInputElement>('#submissionId');
    const selectedRooferInput = document.querySelector<HTMLInputElement>('#selectedRooferId');
    const rooferSelect = document.querySelector<HTMLSelectElement>('#roofer');
    const materialSelect = document.querySelector<HTMLSelectElement>('#materialType');
    const fileDrop = document.querySelector<HTMLElement>('.file-drop');
    const preview = document.querySelector<HTMLElement>('.file-preview');
    const status = document.querySelector<HTMLElement>('.form-status');
    const stickyCta = document.querySelector<HTMLElement>('.mobile-sticky-cta');
    const whatsappButton = document.querySelector<HTMLElement>('.whatsapp-btn');
    const quoteSection = document.getElementById('dopyt');
    const heroSection = document.querySelector<HTMLElement>('main > .hero');
    const heroCounters = Array.from(document.querySelectorAll<HTMLElement>('[data-hero-counter]'));
    const navLinks = Array.from(nav?.querySelectorAll<HTMLAnchorElement>('a') || []);
    let selectedFiles: File[] = [];
    let isHeroSectionVisible = true;
    let isQuoteSectionVisible = false;
    let formStarted = false;
    let quoteSectionTracked = false;
    const maxLeadFileSize = 10 * 1024 * 1024;
    const validPhotoExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
    const photoContentType = (fileName: string, declaredType: string) => {
      if (['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(declaredType)) return declaredType;
      const extension = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] || '';
      return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' } as Record<string, string>)[extension] || '';
    };
    const photoExtension = (fileName: string) => fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] || '';
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
    const dispatchMetaLead = (event: PendingMetaLead) => {
      if (!hasMetaPixelId || !hasMarketingConsent()) return;
      rememberPendingMetaLead(event);
      window.dispatchEvent(new CustomEvent(metaLeadEventName, { detail: event }));
    };

    const ensureSubmissionId = () => {
      if (!submissionIdInput) return;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionIdInput.value)) return;
      const id = window.crypto?.randomUUID?.();
      if (id) submissionIdInput.value = id;
    };

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

    const applyMaterialFromUrl = () => {
      if (!form || !materialSelect) return;
      const material = new URLSearchParams(window.location.search).get('material');
      const materialValues: Record<string, string> = {
        vlnity: 'Vlnitý azbest / eternit',
        plocha: 'Plochý azbest / eternitové šablóny',
      };
      const selectedValue = material ? materialValues[material] : undefined;
      if (selectedValue && Array.from(materialSelect.options).some((option) => option.value === selectedValue)) {
        materialSelect.value = selectedValue;
      }
    };

    const setStatus = (message: string, type?: 'success' | 'error' | 'loading', variant?: 'submit', email?: string, emailSent = true) => {
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
          emailSent
            ? `<span>Potvrdenie sme odovzdali e-mailovému serveru pre:<br><b>${escapeHtml(email || 'zadaný email')}</b></span>`
            : '<span>Dopyt už máme uložený. Potvrdzovací e-mail sa teraz nepodarilo odovzdať; formulár neposielajte znova.</span>',
          '<span>Nezáväznú cenovú ponuku vám pošleme čo najskôr, najneskôr do 24 hodín.</span>',
          '<small>Máte otázky? Zavolajte:</small>',
          '<a class="success-phone" href="tel:+421905217946">0905 217 946</a>',
          '<small>Po-Pia 7:00-18:00</small>',
        ].join('');
        return;
      }
      status.textContent = message;
    };

    const applyNativeSubmitResult = () => {
      if (!form) return;
      const url = new URL(window.location.href);
      const submitted = url.searchParams.get('odoslane') === '1';
      const errorMessage = url.searchParams.get('chyba');
      if (!submitted && !errorMessage) return;
      if (submitted) {
        form.classList.add('is-submitted');
        setStatus('Dopyt sme prijali. Ozveme sa vám s ďalším postupom.', 'success');
        const eventId = url.searchParams.get('meta_lead') || '';
        const material = url.searchParams.get('meta_material');
        if (/^[A-Za-z0-9._:-]{16,128}$/.test(eventId) && material && ['vlnity', 'plocha', 'iny', 'neviem'].includes(material)) {
          dispatchMetaLead({ eventId, material: material as PendingMetaLead['material'] });
        }
      } else if (errorMessage) {
        setStatus(errorMessage, 'error');
        takePendingMetaLead();
      }
      url.searchParams.delete('odoslane');
      url.searchParams.delete('chyba');
      url.searchParams.delete('meta_lead');
      url.searchParams.delete('meta_material');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
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
        if (file.size > maxLeadFileSize) {
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
        control.disabled = submitting || control.hasAttribute('data-submit-disabled');
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

    const submitLeadForm = async (payload: FormData) => {
      const endpoints = ['/api/dopyt/'];
      let lastError: Error | null = null;

      for (const endpoint of endpoints) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 30000);
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            body: payload,
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
          });
          const contentType = response.headers.get('content-type') || '';
          const result = contentType.includes('application/json')
            ? ((await response.json()) as { ok?: boolean; message?: string; emailSent?: boolean; metaLead?: PendingMetaLead })
            : { ok: false, message: (await response.text()).trim().slice(0, 180) };
          if (!response.ok || !result.ok) {
            const responseError = new Error(result.message || 'Dopyt sa nepodarilo odoslať. Skúste obnoviť stránku alebo zavolajte 0905 217 946.') as Error & { responseReceived?: boolean };
            responseError.responseReceived = true;
            throw responseError;
          }
          return result;
        } catch (error) {
          if (error instanceof Error && 'responseReceived' in error) throw error;
          lastError = error instanceof Error ? error : new Error('Dopyt sa nepodarilo odoslať. Skúste obnoviť stránku alebo zavolajte 0905 217 946.');
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      throw lastError || new Error('Dopyt sa nepodarilo odoslať. Skúste obnoviť stránku alebo zavolajte 0905 217 946.');
    };

    const uploadLeadPhotos = async () => {
      if (!selectedFiles.length) return [];
      const submissionId = submissionIdInput?.value || '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
        throw new Error('Fotky sa nepodarilo pripraviť na nahratie. Skúste formulár odoslať znova.');
      }

      return Promise.all(selectedFiles.map(async (file) => {
        const extension = photoExtension(file.name);
        const contentType = photoContentType(file.name, file.type);
        if (!validPhotoExtensions.has(extension) || !contentType) {
          throw new Error('Povolené sú iba JPG, JPEG, PNG, WEBP alebo HEIC súbory.');
        }
        if (file.size <= 0 || file.size > maxLeadFileSize) {
          throw new Error(`Súbor ${file.name} môže mať maximálne 10 MB.`);
        }
        const blob = await upload(`lead-drafts/${submissionId}/${crypto.randomUUID()}${extension}`, file, {
          access: 'private',
          contentType,
          handleUploadUrl: '/api/lead-upload/',
          clientPayload: JSON.stringify({ submissionId }),
          multipart: file.size > 5 * 1024 * 1024,
        });
        return { pathname: blob.pathname, originalName: file.name, submissionId };
      }));
    };

    const onSubmit = async (event: SubmitEvent) => {
      if (!form) return;
      if (form.classList.contains('is-submitting')) {
        event.preventDefault();
        return;
      }
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
        return;
      }
      ensureSubmissionId();
      event.preventDefault();
      clearStatus();
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const payload = new FormData(form);
      const submittedEmail = String(payload.get('email') || '').trim();
      if (button && !button.dataset.defaultLabel) button.dataset.defaultLabel = button.innerHTML;
      setFormSubmitting(true, button);

      try {
        const uploadedPhotos = await uploadLeadPhotos();
        if (uploadedPhotos.length) {
          payload.delete('photos');
          payload.set('uploadedPhotos', JSON.stringify(uploadedPhotos));
        }
        const result = await submitLeadForm(payload);
        form.reset();
        selectedFiles = [];
        updateFileInput();
        if (preview) preview.innerHTML = '';
        trackAnalytics('form_submit_success', { form: 'lead' });
        if (result.metaLead) dispatchMetaLead(result.metaLead);
        form.classList.add('is-submitted');
        setStatus(result.message || 'Dopyt sme prijali. Ozveme sa vám s ďalším postupom.', 'success', 'submit', submittedEmail, result.emailSent !== false);
      } catch (error) {
        setFormSubmitting(false, button);
        setStatus(
          error instanceof Error && error.name === 'AbortError'
            ? 'Server neodpovedal včas. Formulár zostal vyplnený, skúste to prosím znova alebo zavolajte 0905 217 946.'
            : error instanceof Error
              ? error.message
              : 'Dopyt sa nepodarilo odoslať. Skontrolujte pripojenie a skúste to znova alebo zavolajte 0905 217 946.',
          'error',
        );
        return;
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

    const isCookieBannerVisible = () => {
      const cookieBanner = document.querySelector<HTMLElement>('.cookie-banner');
      if (!cookieBanner) return false;
      const style = window.getComputedStyle(cookieBanner);
      const rect = cookieBanner.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0 && rect.bottom > 0;
    };

    const onScroll = () => {
      header?.classList.toggle('is-compact', window.scrollY > 28);
      const isMobile = window.innerWidth <= 760;
      if (!stickyCta) return;
      const cookieBannerVisible = isCookieBannerVisible();
      const shouldShow = isMobile && !isHeroSectionVisible && !isQuoteSectionVisible && !cookieBannerVisible;
      stickyCta.classList.toggle('is-visible', shouldShow);
      whatsappButton?.classList.toggle('is-hidden-over-form', isMobile && (isQuoteSectionVisible || shouldShow));
      whatsappButton?.classList.toggle('is-hidden-by-cookie', isMobile && cookieBannerVisible);
    };

    menuToggle?.addEventListener('click', onMenuClick);
    navLinks.forEach((link) => link.addEventListener('click', closeMenu));
    applyMaterialFromUrl();
    applyRooferSelectionFromUrl();
    applyNativeSubmitResult();
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

    let heroSectionObserver: IntersectionObserver | null = null;
    if (heroSection && stickyCta && 'IntersectionObserver' in window) {
      heroSectionObserver = new IntersectionObserver(
        ([entry]) => {
          isHeroSectionVisible = entry.isIntersecting;
          onScroll();
        },
        { threshold: 0.12 },
      );
      heroSectionObserver.observe(heroSection);
    }

    let cookieBannerObserver: MutationObserver | null = null;
    if (stickyCta && 'MutationObserver' in window) {
      cookieBannerObserver = new MutationObserver(onScroll);
      cookieBannerObserver.observe(document.body, { childList: true, subtree: true });
    }

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

    if (heroCounters.length) {
      heroCounters.forEach((counter) => {
        const target = Number(counter.dataset.counterTarget || 0);
        const suffix = counter.dataset.counterSuffix || '';
        const format = counter.dataset.counterFormat || 'locale';
        counter.textContent = formatCounterValue(target, suffix, format);
      });
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
      const mobileFormTarget =
        targetId === 'dopyt' && window.matchMedia('(max-width: 760px)').matches
          ? document.getElementById('quote-title')
          : null;
      const scrollTarget = mobileFormTarget || target;
      const headerHeight = header?.getBoundingClientRect().height || 118;
      const targetTop = scrollTarget.getBoundingClientRect().top + window.scrollY - headerHeight - 18;
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
      heroSectionObserver?.disconnect();
      cookieBannerObserver?.disconnect();
      quoteSectionObserver?.disconnect();
      sectionObserver?.disconnect();
      hashScrollTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return null;
}
