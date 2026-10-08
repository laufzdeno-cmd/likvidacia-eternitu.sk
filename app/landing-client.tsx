'use client';

import { useEffect } from 'react';
import { getAnalyticsSessionId, getLeadAttribution, preserveCampaignAttributionOnInternalLink, trackAnalyticsEvent } from '@/src/lib/analytics-client';
import { publishAcceptedLeadResponse } from '@/src/lib/ad-conversion-tracking.mjs';

export default function LandingClient() {
  useEffect(() => {
    const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
    const nav = document.querySelector<HTMLElement>('#site-nav');
    const header = document.querySelector<HTMLElement>('.site-header');
    const form = document.querySelector<HTMLFormElement>('.lead-form');
    const testimonialForm = document.querySelector<HTMLFormElement>('.testimonial-submit-form');
    const rooferRegistrationForm = document.querySelector<HTMLFormElement>('.roofer-registration-form');
    const fileInput = document.querySelector<HTMLInputElement>('#photos');
    const selectedRooferInput = document.querySelector<HTMLInputElement>('#selectedRooferId');
    const rooferSelect = document.querySelector<HTMLSelectElement>('#roofer');
    const fileDrop = document.querySelector<HTMLElement>('.file-drop');
    const preview = document.querySelector<HTMLElement>('.file-preview');
    const status = document.querySelector<HTMLElement>('.form-status');
    const testimonialStatus = document.querySelector<HTMLElement>('.testimonial-form-status');
    const rooferRegistrationStatus = document.querySelector<HTMLElement>('.roofer-registration-status');
    const rooferRegionsError = document.querySelector<HTMLElement>('#roofer-regions-error');
    const rooferSpecializationsError = document.querySelector<HTMLElement>('#roofer-specializations-error');
    const stickyCta = document.querySelector<HTMLElement>('.mobile-sticky-cta');
    const whatsappButton = document.querySelector<HTMLElement>('.whatsapp-btn');
    const quoteSection = document.getElementById('dopyt');
    const galleryCards = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-gallery-card]'));
    const galleryFilters = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-gallery-filter]'));
    const homeGalleryCards = Array.from(document.querySelectorAll<HTMLElement>('[data-home-gallery-card]'));
    const homeGalleryFilters = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-home-gallery-filter]'));
    const reviewsToggle = document.querySelector<HTMLButtonElement>('[data-reviews-toggle]');
    const extraReviewCards = Array.from(document.querySelectorAll<HTMLElement>('[data-review-extra="true"]'));
    const heroCounterRoot = document.querySelector<HTMLElement>('[data-hero-counters]');
    const heroCounters = Array.from(document.querySelectorAll<HTMLElement>('[data-hero-counter]'));
    const galleryLoadMore = document.querySelector<HTMLButtonElement>('[data-gallery-load-more]');
    const galleryLightbox = document.querySelector<HTMLElement>('[data-gallery-lightbox]');
    const lightboxImage = document.querySelector<HTMLImageElement>('[data-lightbox-image]');
    const lightboxCaption = document.querySelector<HTMLElement>('[data-lightbox-caption]');
    const lightboxClose = document.querySelector<HTMLButtonElement>('[data-lightbox-close]');
    const lightboxPrev = document.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
    const lightboxNext = document.querySelector<HTMLButtonElement>('[data-lightbox-next]');
    const navLinks = Array.from(nav?.querySelectorAll<HTMLAnchorElement>('a') || []);
    let selectedFiles: File[] = [];
    let disposed = false;
    let cleanupPriceCalculators: (() => void) | undefined;
    let leadSnapshotModulePromise: Promise<typeof import('@/src/lib/lead-form-snapshot')> | undefined;
    const loadLeadSnapshotModule = () => {
      if (!leadSnapshotModulePromise) {
        leadSnapshotModulePromise = import('@/src/lib/lead-form-snapshot').catch((error: unknown) => {
          leadSnapshotModulePromise = undefined;
          throw error;
        });
      }
      return leadSnapshotModulePromise;
    };
    let activeGallery = galleryCards.slice(0, 12);
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
    let activeGalleryIndex = 0;
    let galleryTrigger: HTMLButtonElement | null = null;
    let isQuoteSectionVisible = false;
    let formStarted = false;
    let quoteSectionTracked = false;
    let rooferRegistrationSubmitting = false;
    let rooferRegistrationMayHaveSaved = false;
    let lastLeadSnapshot = '';
    let lastLeadSubmissionId = '';
    let leadSnapshotInProgress = false;

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


    const updateFileInput = () => {
      if (!fileInput) return;
      const transfer = new DataTransfer();
      selectedFiles.slice(0, 10).forEach((file) => transfer.items.add(file));
      fileInput.files = transfer.files;
    };

    const ensureLeadSubmissionId = () => {
      if (!form) return null;
      let input = form.querySelector<HTMLInputElement>('input[name="submissionId"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'submissionId';
        form.append(input);
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.value)) {
        input.value = window.crypto?.randomUUID?.() || '';
      }
      return input;
    };

    const trackRooferEvent = (rooferId: string, eventType: 'card_viewed' | 'contact_revealed' | 'quote_selected', region?: string) => {
      if (!rooferId) return;
      const payload = JSON.stringify({
        rooferId,
        eventType,
        region: region || '',
        page: window.location.pathname,
        referrer: document.referrer || '',
      });
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon('/api/roofer-event/', new Blob([payload], { type: 'application/json' }));
        if (sent) return;
      }
      void fetch('/api/roofer-event/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    };

    const applyRooferSelectionFromUrl = () => {
      if (!form || !rooferSelect) return;
      const params = new URLSearchParams(window.location.search);
      const selectedRooferId = params.get('selectedRooferId') || '';
      const wantsRoofer = params.get('wantsRooferRecommendation') === 'true';
      if (selectedRooferId && selectedRooferInput) {
        selectedRooferInput.value = selectedRooferId;
      }
      if (selectedRooferId || wantsRoofer) {
        rooferSelect.value = 'Chcem odporučiť strechára podľa regiónu';
      }
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
      if (!fileInput?.files) return;
      addFiles(fileInput.files);
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
          '<span>Chv&#237;&#318;u po&#269;kajte, nahr&#225;vame &#250;daje a posielame potvrdenie.</span>',
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

    const setStatus = (message: string, type?: 'success' | 'error' | 'loading', variant?: 'submit', email?: string) => {
      if (!status) return;
      status.classList.toggle('is-submit-success', type === 'success' && variant === 'submit');
      status.classList.toggle('is-success', type === 'success');
      status.classList.toggle('is-error', type === 'error');
      status.classList.toggle('is-loading', type === 'loading');
      if (type === 'loading') {
        status.innerHTML = '<span class="form-loading-bar" aria-hidden="true"></span><strong>Odosielame dopyt...</strong><span>Chv&#237;&#318;u po&#269;kajte, uklad&#225;me &#250;daje a posielame potvrdenie.</span>';
        return;
      }
      if (type === 'success' && variant === 'submit') {
        status.innerHTML = [
          '<span class="success-check" aria-hidden="true">&#10003;</span>',
          '<strong>Dopyt sme prijali</strong>',
          `<span>Cenov&uacute; ponuku v&aacute;m po&scaron;leme do 24 hod&iacute;n na email:<br><b>${escapeHtml(email || 'zadaný email')}</b></span>`,
          '<div class="success-next"><em>&#268;o sa stane &#271;alej:</em><span>1. Skontrolujeme v&aacute;&scaron; dopyt</span><span>2. Priprav&iacute;me cenov&uacute; ponuku</span><span>3. Po&scaron;leme v&aacute;m ju do 24 hod&iacute;n</span></div>',
          '<small>M&aacute;te ot&aacute;zky? Zavolajte:</small>',
          '<a class="success-phone" href="tel:+421905217946">0905 217 946</a>',
          '<small>Po&ndash;Pia 7:00&ndash;18:00</small>',
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
      } else if (errorMessage) {
        setStatus(errorMessage, 'error');
      }
      url.searchParams.delete('odoslane');
      url.searchParams.delete('chyba');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    };

    const clearStatus = () => {
      if (!status) return;
      status.classList.remove('is-submit-success', 'is-success', 'is-error', 'is-loading');
      status.textContent = '';
    };

    const submitLeadForm = async (payload: FormData) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch('/api/dopyt/', {
          method: 'POST',
          body: payload,
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') || '';
        const result = contentType.includes('application/json')
          ? ((await response.json()) as { ok?: boolean; message?: string; metaLead?: { eventId: string; material: 'vlnity' | 'plocha' | 'iny' | 'neviem' } })
          : { ok: false, message: (await response.text()).trim().slice(0, 180) };
        if (!response.ok || !result.ok) {
          throw new Error(result.message || 'Dopyt sa nepodarilo odoslať. Skúste znova alebo zavolajte 0905 217 946.');
        }
        return result;
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const onSubmit = async (event: SubmitEvent) => {
      if (!form) return;
      if (form.classList.contains('is-submitting') || leadSnapshotInProgress) {
        event.preventDefault();
        return;
      }
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
        return;
      }
      event.preventDefault();
      clearStatus();
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const submissionIdInput = ensureLeadSubmissionId();
      if (!submissionIdInput?.value) {
        setStatus('Bezpečné odoslanie nie je v tomto prehliadači dostupné. Obnovte stránku alebo zavolajte 0905 217 946.', 'error');
        return;
      }
      const payload = new FormData(form);
      payload.set('leadAttribution', JSON.stringify(getLeadAttribution()));
      const analyticsSessionId = getAnalyticsSessionId();
      if (analyticsSessionId) payload.set('analyticsSessionId', analyticsSessionId);
      const submittedEmail = String(payload.get('email') || '').trim();
      if (button && !button.dataset.defaultLabel) button.dataset.defaultLabel = button.innerHTML;
      setFormSubmitting(true, button);

      try {
        leadSnapshotInProgress = true;
        const { createLeadFormSnapshot } = await loadLeadSnapshotModule();
        const snapshot = await createLeadFormSnapshot(payload, selectedFiles);
        let submissionId = submissionIdInput.value;
        if (lastLeadSnapshot && snapshot !== lastLeadSnapshot && submissionId === lastLeadSubmissionId) {
          submissionId = window.crypto?.randomUUID?.() || '';
          if (!submissionId) throw new Error('Bezpečné odoslanie nie je v tomto prehliadači dostupné. Obnovte stránku alebo zavolajte 0905 217 946.');
          submissionIdInput.value = submissionId;
          payload.set('submissionId', submissionId);
        }
        lastLeadSnapshot = snapshot;
        lastLeadSubmissionId = submissionId;
        const result = await submitLeadForm(payload);
        if (result.metaLead) publishAcceptedLeadResponse(result);
        form.reset();
        selectedFiles = [];
        updateFileInput();
        if (preview) preview.innerHTML = '';
        lastLeadSnapshot = '';
        lastLeadSubmissionId = '';
        submissionIdInput.value = window.crypto?.randomUUID?.() || '';
        form.classList.add('is-submitted');
        setStatus(result.message || 'Dopyt sme prijali. Ozveme sa v\u00e1m s \u010fal\u0161\u00edm postupom.', 'success', 'submit', submittedEmail);
      } catch (error) {
        setFormSubmitting(false, button);
        const serverMessage = error instanceof Error ? error.message : 'Nepodarilo sa overiť výsledok odoslania.';
        setStatus(`${serverMessage} Údaje zostali vo formulári. Pri opakovaní bez úprav systém použije rovnaké ID dopytu, aby nevznikla duplicita. Ak problém trvá, zavolajte 0905 217 946.`, 'error');
      } finally {
        leadSnapshotInProgress = false;
        if (form.classList.contains('is-submitted')) {
          button?.setAttribute('disabled', 'true');
        }
      }
    };
    const onRooferContactClick = (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const rooferId = button.dataset.rooferContact || '';
      const region = button.dataset.rooferRegion || '';
      const targetId = button.getAttribute('aria-controls');
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;
      const hidden = target.hasAttribute('hidden');
      target.toggleAttribute('hidden', !hidden);
      button.setAttribute('aria-expanded', String(hidden));
      button.textContent = hidden ? 'Kontakt zobrazený' : 'Zobraziť kontakt';
      if (hidden) trackRooferEvent(rooferId, 'contact_revealed', region);
    };

    const onRooferQuoteClick = (event: Event) => {
      const link = event.currentTarget as HTMLAnchorElement;
      trackRooferEvent(link.dataset.rooferQuote || '', 'quote_selected', link.dataset.rooferRegion || '');
    };

    const onTestimonialSubmit = async (event: SubmitEvent) => {
      if (!testimonialForm) return;
      event.preventDefault();
      if (testimonialStatus) {
        testimonialStatus.textContent = '';
        testimonialStatus.classList.remove('is-success', 'is-error');
      }
      const button = testimonialForm.querySelector<HTMLButtonElement>('button[type="submit"]');
      button?.setAttribute('disabled', 'true');

      try {
        const response = await fetch(testimonialForm.action, {
          method: 'POST',
          body: new FormData(testimonialForm),
          headers: { Accept: 'application/json' },
        });
        const result = (await response.json()) as { ok?: boolean; message?: string };
        if (!response.ok || !result.ok) {
          throw new Error(result.message || 'Referenciu sa nepodarilo odoslať.');
        }
        testimonialForm.reset();
        if (testimonialStatus) {
          testimonialStatus.textContent = result.message || 'Ďakujeme. Referenciu zobrazíme po schválení.';
          testimonialStatus.classList.add('is-success');
        }
      } catch (error) {
        if (testimonialStatus) {
          testimonialStatus.textContent = error instanceof Error ? error.message : 'Referenciu sa nepodarilo odoslať.';
          testimonialStatus.classList.add('is-error');
        }
      } finally {
        button?.removeAttribute('disabled');
      }
    };

    const setRooferRegistrationId = () => {
      const input = rooferRegistrationForm?.querySelector<HTMLInputElement>('input[name="submissionId"]');
      if (input) input.value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    };

    const onRooferRegistrationEdit = () => {
      if (rooferRegionsError && rooferRegistrationForm?.querySelector('input[name="serviceRegions[]"]:checked')) {
        rooferRegionsError.textContent = '';
        rooferRegionsError.hidden = true;
      }
      if (rooferSpecializationsError && rooferRegistrationForm?.querySelector('input[name="specializations[]"]:checked')) {
        rooferSpecializationsError.textContent = '';
        rooferSpecializationsError.hidden = true;
      }
      if (!rooferRegistrationMayHaveSaved || rooferRegistrationSubmitting) return;
      setRooferRegistrationId();
      rooferRegistrationMayHaveSaved = false;
    };

    const onRooferRegistrationSubmit = async (event: SubmitEvent) => {
      if (!rooferRegistrationForm) return;
      event.preventDefault();
      if (rooferRegistrationSubmitting) return;
      if (rooferRegistrationStatus) {
        rooferRegistrationStatus.textContent = '';
        rooferRegistrationStatus.classList.remove('is-success', 'is-error');
        rooferRegistrationStatus.setAttribute('role', 'status');
        rooferRegistrationStatus.setAttribute('aria-live', 'polite');
      }
      if (!rooferRegistrationForm.checkValidity()) {
        rooferRegistrationForm.reportValidity();
        return;
      }
      const selectedRegions = rooferRegistrationForm.querySelectorAll<HTMLInputElement>('input[name="serviceRegions[]"]:checked');
      if (!selectedRegions.length) {
        if (rooferRegionsError) {
          rooferRegionsError.textContent = 'Vyberte aspoň jeden kraj, v ktorom pracujete.';
          rooferRegionsError.hidden = false;
        }
        rooferRegistrationForm.querySelector<HTMLInputElement>('input[name="serviceRegions[]"]')?.focus();
        return;
      }
      const selectedSpecializations = rooferRegistrationForm.querySelectorAll<HTMLInputElement>('input[name="specializations[]"]:checked');
      if (!selectedSpecializations.length) {
        if (rooferSpecializationsError) {
          rooferSpecializationsError.textContent = 'Vyberte aspoň jednu špecializáciu.';
          rooferSpecializationsError.hidden = false;
        }
        rooferRegistrationForm.querySelector<HTMLInputElement>('input[name="specializations[]"]')?.focus();
        return;
      }
      const submissionIdInput = rooferRegistrationForm.querySelector<HTMLInputElement>('input[name="submissionId"]');
      if (submissionIdInput && !submissionIdInput.value) {
        submissionIdInput.value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      rooferRegistrationSubmitting = true;
      const button = rooferRegistrationForm.querySelector<HTMLButtonElement>('button[type="submit"]');
      const defaultButtonLabel = button?.textContent || '';
      const payload = new FormData(rooferRegistrationForm);
      const fields = Array.from(rooferRegistrationForm.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]), select, textarea',
      ));
      const priorDisabledStates = fields.map((field) => field.disabled);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 30_000);
      rooferRegistrationMayHaveSaved = true;
      rooferRegistrationForm.setAttribute('aria-busy', 'true');
      fields.forEach((field) => { field.disabled = true; });
      button?.setAttribute('disabled', 'true');
      if (button) button.textContent = 'Odosielame…';

      try {
        const response = await fetch(rooferRegistrationForm.action, {
          method: 'POST',
          body: payload,
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = (await response.json()) as { ok?: boolean; message?: string };
        if (!response.ok || !result.ok) {
          throw new Error(result.message || 'Registráciu sa nepodarilo odoslať.');
        }
        rooferRegistrationMayHaveSaved = false;
        rooferRegistrationForm.reset();
        setRooferRegistrationId();
        if (rooferRegistrationStatus) {
          rooferRegistrationStatus.textContent =
            result.message || 'Ďakujeme! Registráciu sme prijali a najprv si ju interne skontrolujeme.';
          rooferRegistrationStatus.classList.add('is-success');
          rooferRegistrationStatus.focus();
        }
        trackAnalytics('roofer_registration_success', { form: 'roofer_registration' });
      } catch (error) {
        if (rooferRegistrationStatus) {
          rooferRegistrationStatus.textContent = error instanceof Error && error.name === 'AbortError'
            ? 'Odpoveď servera neprišla do 30 sekúnd. Údaje zostali vo formulári. Bez úprav môžete skúsiť odoslanie znova bez založenia duplicitnej registrácie; ak údaje zmeníte, pôjde o novú registráciu.'
            : error instanceof Error ? error.message : 'Registráciu sa nepodarilo odoslať.';
          rooferRegistrationStatus.classList.add('is-error');
          rooferRegistrationStatus.setAttribute('role', 'alert');
          rooferRegistrationStatus.setAttribute('aria-live', 'assertive');
          rooferRegistrationStatus.focus();
        }
      } finally {
        window.clearTimeout(timeoutId);
        rooferRegistrationSubmitting = false;
        rooferRegistrationForm.removeAttribute('aria-busy');
        fields.forEach((field, index) => { field.disabled = priorDisabledStates[index]; });
        button?.removeAttribute('disabled');
        if (button) button.textContent = defaultButtonLabel;
      }
    };

    const refreshGalleryActiveItems = () => {
      activeGallery = galleryCards.filter((card) => !card.hidden);
      if (!activeGallery.length) activeGallery = galleryCards.slice(0, 12);
    };

    const openGalleryLightbox = (card: HTMLButtonElement) => {
      if (!galleryLightbox || !lightboxImage || !lightboxCaption) return;
      refreshGalleryActiveItems();
      galleryTrigger = card;
      activeGalleryIndex = Math.max(0, activeGallery.indexOf(card));
      const image = activeGallery[activeGalleryIndex];
      lightboxImage.src = image.dataset.galleryWebp || image.dataset.galleryJpg || '';
      lightboxImage.alt = image.dataset.galleryAlt || '';
      lightboxCaption.textContent = image.dataset.galleryTitle || '';
      galleryLightbox.hidden = false;
      document.body.classList.add('is-lightbox-open');
      lightboxClose?.focus({ preventScroll: true });
    };

    const closeGalleryLightbox = () => {
      if (!galleryLightbox) return;
      galleryLightbox.hidden = true;
      document.body.classList.remove('is-lightbox-open');
      if (galleryTrigger?.isConnected) galleryTrigger.focus({ preventScroll: true });
      galleryTrigger = null;
    };

    const moveGalleryLightbox = (direction: 1 | -1) => {
      if (!galleryLightbox || galleryLightbox.hidden || !lightboxImage || !lightboxCaption) return;
      refreshGalleryActiveItems();
      if (!activeGallery.length) return;
      activeGalleryIndex = (activeGalleryIndex + direction + activeGallery.length) % activeGallery.length;
      const image = activeGallery[activeGalleryIndex];
      lightboxImage.src = image.dataset.galleryWebp || image.dataset.galleryJpg || '';
      lightboxImage.alt = image.dataset.galleryAlt || '';
      lightboxCaption.textContent = image.dataset.galleryTitle || '';
    };

    const onGalleryFilter = (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const category = button.dataset.galleryFilter || 'vsetko';
      let visibleMatches = 0;
      galleryFilters.forEach((filter) => {
        const active = filter === button;
        filter.classList.toggle('is-active', active);
        filter.setAttribute('aria-pressed', String(active));
      });
      galleryCards.forEach((card) => {
        const matches = category === 'vsetko' || card.dataset.galleryCategory === category;
        if (matches && visibleMatches < 12) {
          card.hidden = false;
          visibleMatches += 1;
        } else {
          card.hidden = true;
        }
      });
      if (galleryLoadMore) {
        let matchingIndex = 0;
        const hasHiddenMatches = galleryCards.some((card) => {
          const matches = category === 'vsetko' || card.dataset.galleryCategory === category;
          if (!matches) return false;
          matchingIndex += 1;
          return matchingIndex > 12;
        });
        galleryLoadMore.hidden = !hasHiddenMatches;
        galleryLoadMore.dataset.galleryCurrentFilter = category;
      }
      trackAnalytics('gallery_filter', { gallery: 'realizacie', category });
    };

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

    const onReviewsToggle = () => {
      const isExpanded = reviewsToggle?.getAttribute('aria-expanded') === 'true';
      extraReviewCards.forEach((card) => {
        card.hidden = isExpanded;
      });
      if (reviewsToggle) {
        reviewsToggle.setAttribute('aria-expanded', String(!isExpanded));
        reviewsToggle.textContent = isExpanded ? 'Zobraziť všetky' : 'Skryť';
      }
    };

    const onFormStart = () => {
      void loadLeadSnapshotModule().catch(() => undefined);
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

    const onGalleryLoadMore = () => {
      const category = galleryLoadMore?.dataset.galleryCurrentFilter || 'vsetko';
      let shown = 0;
      galleryCards.forEach((card) => {
        const matches = category === 'vsetko' || card.dataset.galleryCategory === category;
        if (!matches || shown >= 12) return;
        if (card.hidden) {
          card.hidden = false;
          shown += 1;
        }
      });
      if (galleryLoadMore) {
        const hasMore = galleryCards.some((card) => {
          const matches = category === 'vsetko' || card.dataset.galleryCategory === category;
          return matches && card.hidden;
        });
        galleryLoadMore.hidden = !hasMore;
      }
    };

    const onGalleryKeyDown = (event: KeyboardEvent) => {
      if (!galleryLightbox || galleryLightbox.hidden) return;
      if (event.key === 'Tab') {
        const controls = [lightboxClose, lightboxPrev, lightboxNext].filter((button): button is HTMLButtonElement => Boolean(button && !button.disabled));
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (!controls.includes(document.activeElement as HTMLButtonElement)) {
          event.preventDefault();
          first.focus();
        }
      }
      if (event.key === 'Escape') { event.preventDefault(); closeGalleryLightbox(); }
      if (event.key === 'ArrowRight') { event.preventDefault(); moveGalleryLightbox(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); moveGalleryLightbox(-1); }
    };

    const onScroll = () => {
      header?.classList.toggle('is-compact', window.scrollY > 28);
      if (!stickyCta) return;
      const isMobile = window.innerWidth <= 760;
      const shouldShow = form
        ? isMobile && !isQuoteSectionVisible && form.getBoundingClientRect().bottom < 120
        : isMobile && window.scrollY > 280;
      stickyCta.classList.toggle('is-visible', shouldShow);
      stickyCta.inert = !shouldShow;
      whatsappButton?.classList.toggle('is-hidden-by-sticky-cta', shouldShow);
      if (whatsappButton) whatsappButton.inert = shouldShow;
    };

    menuToggle?.addEventListener('click', onMenuClick);
    navLinks.forEach((link) => link.addEventListener('click', closeMenu));
    applyRooferSelectionFromUrl();
    applyNativeSubmitResult();
    fileInput?.addEventListener('change', onFilesChange);
    fileDrop?.addEventListener('dragover', (event) => {
      event.preventDefault();
      fileDrop.classList.add('is-dragging');
    });
    fileDrop?.addEventListener('dragleave', () => fileDrop.classList.remove('is-dragging'));
    fileDrop?.addEventListener('drop', (event) => {
      event.preventDefault();
      fileDrop.classList.remove('is-dragging');
      if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
    });
    form?.addEventListener('submit', onSubmit);
    form?.addEventListener('focusin', onFormStart);
    form?.addEventListener('input', onFormStart);
    document.addEventListener('click', onAnalyticsClick);
    document.addEventListener('click', preserveCampaignAttributionOnInternalLink, true);
    trackAnalytics('page_view');
    testimonialForm?.addEventListener('submit', onTestimonialSubmit);
    rooferRegistrationForm?.addEventListener('submit', onRooferRegistrationSubmit);
    rooferRegistrationForm?.addEventListener('input', onRooferRegistrationEdit);
    rooferRegistrationForm?.addEventListener('change', onRooferRegistrationEdit);
    const rooferRegionInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="serviceRegions[]"]'));
    const allRegionsInput = rooferRegionInputs.find((input) => input.dataset.allRegions !== undefined);
    const individualRegionInputs = rooferRegionInputs.filter((input) => input !== allRegionsInput);
    const syncRooferRegions = (changed: HTMLInputElement) => {
      if (!allRegionsInput) return;
      if (changed === allRegionsInput && allRegionsInput.checked) {
        individualRegionInputs.forEach((input) => { input.checked = true; });
        return;
      }
      if (changed === allRegionsInput && !allRegionsInput.checked) {
        individualRegionInputs.forEach((input) => { input.checked = false; });
        return;
      }
      if (!changed.checked) allRegionsInput.checked = false;
      if (individualRegionInputs.length && individualRegionInputs.every((input) => input.checked)) allRegionsInput.checked = true;
    };
    rooferRegionInputs.forEach((input) => input.addEventListener('change', () => syncRooferRegions(input)));
    const otherSpecialization = document.querySelector<HTMLElement>('[data-other-specialization]');
    const otherSpecializationInput = document.querySelector<HTMLInputElement>('input[data-specialization="Iné"]');
    const syncOtherSpecialization = () => {
      if (!otherSpecialization || !otherSpecializationInput) return;
      otherSpecialization.hidden = !otherSpecializationInput.checked;
      if (!otherSpecializationInput.checked) {
        const input = otherSpecialization.querySelector<HTMLInputElement>('input[name="otherSpecialization"]');
        if (input) input.value = '';
      }
    };
    otherSpecializationInput?.addEventListener('change', syncOtherSpecialization);
    syncOtherSpecialization();
    const contactButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-roofer-contact]'));
    const quoteLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-roofer-quote]'));
    const rooferCards = Array.from(document.querySelectorAll<HTMLElement>('[data-roofer-card]'));
    contactButtons.forEach((button) => button.addEventListener('click', onRooferContactClick));
    quoteLinks.forEach((link) => link.addEventListener('click', onRooferQuoteClick));
    galleryFilters.forEach((button) => button.addEventListener('click', onGalleryFilter));
    galleryFilters[0]?.classList.add('is-active');
    homeGalleryFilters.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', onHomeGalleryFilter);
    });
    reviewsToggle?.setAttribute('aria-expanded', 'false');
    reviewsToggle?.addEventListener('click', onReviewsToggle);
    if (document.querySelector('[data-price-calculator], .price-calculator')) {
      void import('@/src/lib/price-calculator').then(({ initializePriceCalculators }) => {
        const cleanup = initializePriceCalculators(trackAnalytics);
        if (disposed) cleanup();
        else cleanupPriceCalculators = cleanup;
      });
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
    galleryLoadMore?.addEventListener('click', onGalleryLoadMore);
    galleryCards.forEach((card) => card.addEventListener('click', () => openGalleryLightbox(card)));
    lightboxClose?.addEventListener('click', closeGalleryLightbox);
    lightboxPrev?.addEventListener('click', () => moveGalleryLightbox(-1));
    lightboxNext?.addEventListener('click', () => moveGalleryLightbox(1));
    galleryLightbox?.addEventListener('click', (event) => {
      if (event.target === galleryLightbox) closeGalleryLightbox();
    });
    window.addEventListener('keydown', onGalleryKeyDown);
    let observer: IntersectionObserver | undefined;
    let sectionObserver: IntersectionObserver | undefined;
    let revealObserver: IntersectionObserver | undefined;
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
        counterObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            runHeroCounters();
            counterObserver?.disconnect();
          });
        }, { threshold: 0.35 });
        counterObserver.observe(heroCounterRoot);
      } else {
        runHeroCounters();
      }
    }
    const viewedRoofers = new Set<string>();
    if ('IntersectionObserver' in window && rooferCards.length) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const card = entry.target as HTMLElement;
          const rooferId = card.dataset.rooferCard || '';
          if (!rooferId || viewedRoofers.has(rooferId)) return;
          viewedRoofers.add(rooferId);
          trackRooferEvent(rooferId, 'card_viewed', card.dataset.rooferRegion || '');
          observer?.unobserve(card);
        });
      }, { threshold: 0.45 });
      rooferCards.forEach((card) => observer?.observe(card));
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

    const motionAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>(
      '.hero, .trust-bar, .section, .transport-banner, .final-cta, .site-footer, .roofer-hero, .roofer-final',
    ));
    if (motionAllowed) {
      document.documentElement.classList.add('has-enhanced-motion');
      revealTargets.forEach((item) => item.classList.add('reveal-on-scroll'));
    }
    if (motionAllowed && 'IntersectionObserver' in window && revealTargets.length) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver?.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      revealTargets.forEach((item) => revealObserver?.observe(item));
    } else {
      revealTargets.forEach((item) => item.classList.add('is-visible'));
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('hashchange', onHashChange);
    onScroll();

    return () => {
      disposed = true;
      cleanupPriceCalculators?.();
      menuToggle?.removeEventListener('click', onMenuClick);
      navLinks.forEach((link) => link.removeEventListener('click', closeMenu));
      fileInput?.removeEventListener('change', onFilesChange);
      form?.removeEventListener('submit', onSubmit);
      form?.removeEventListener('focusin', onFormStart);
      form?.removeEventListener('input', onFormStart);
      document.removeEventListener('click', onAnalyticsClick);
      document.removeEventListener('click', preserveCampaignAttributionOnInternalLink, true);
      testimonialForm?.removeEventListener('submit', onTestimonialSubmit);
      rooferRegistrationForm?.removeEventListener('submit', onRooferRegistrationSubmit);
      rooferRegistrationForm?.removeEventListener('input', onRooferRegistrationEdit);
      rooferRegistrationForm?.removeEventListener('change', onRooferRegistrationEdit);
      contactButtons.forEach((button) => button.removeEventListener('click', onRooferContactClick));
      quoteLinks.forEach((link) => link.removeEventListener('click', onRooferQuoteClick));
      galleryFilters.forEach((button) => button.removeEventListener('click', onGalleryFilter));
      homeGalleryFilters.forEach((button) => button.removeEventListener('click', onHomeGalleryFilter));
      reviewsToggle?.removeEventListener('click', onReviewsToggle);
      galleryLoadMore?.removeEventListener('click', onGalleryLoadMore);
      lightboxClose?.removeEventListener('click', closeGalleryLightbox);
      document.body.classList.remove('is-lightbox-open');
      window.removeEventListener('keydown', onGalleryKeyDown);
      observer?.disconnect();
      sectionObserver?.disconnect();
      revealObserver?.disconnect();
      document.documentElement.classList.remove('has-enhanced-motion');
      revealTargets.forEach((item) => item.classList.remove('reveal-on-scroll', 'is-visible'));
      counterObserver?.disconnect();
      quoteSectionObserver?.disconnect();
      hashScrollTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return null;
}
