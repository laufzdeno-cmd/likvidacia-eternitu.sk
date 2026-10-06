'use client';

import { useEffect } from 'react';
import { getAnalyticsSessionId, getLeadAttribution, trackAnalyticsEvent } from '@/src/lib/analytics-client';
import { publishAcceptedLeadConversion } from '@/src/lib/ad-conversion-tracking.mjs';
import { leadPhotoUploadErrorMessage } from '@/src/lib/lead-upload-error';
import { leadPhotoContentType, leadPhotoExtension } from '@/src/lib/lead-photo-content-type';
import { settleLeadPhotoUploadBatch } from '@/src/lib/lead-photo-upload-batch';
import { createLeadFormSnapshot, fingerprintLeadPhoto, fingerprintLeadUploadGroup } from '@/src/lib/lead-form-snapshot';
import { leadMaterialFromCampaignParam } from '@/src/lib/lead-material-query';
import { addUniqueLeadPhotos, resetMissingLeadPhotoUpload } from '@/src/lib/lead-photo-selection';
import { initializePriceCalculators } from '@/src/lib/price-calculator';
import { applyPriceQuoteDraft, takePriceQuoteDraft } from '@/src/lib/price-quote-prefill';
import {
  hasMarketingConsent,
  type PendingMetaLead,
} from '@/src/lib/marketing-consent';

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
    const priceCalculatorCard = document.querySelector<HTMLElement>('[data-price-calculator]');
    const heroSection = document.querySelector<HTMLElement>('main > .hero');
    const heroCounters = Array.from(document.querySelectorAll<HTMLElement>('[data-hero-counter]'));
    const navLinks = Array.from(nav?.querySelectorAll<HTMLAnchorElement>('a') || []);
    let selectedFiles: File[] = [];
    type CachedPhotoUpload = { submissionId: string; pathname: string; previousPathnames: string[]; replacedPathname?: string; promise?: Promise<{ pathname: string; originalName: string; submissionId: string }> };
    const uploadedFilesByFingerprint = new Map<string, CachedPhotoUpload>();
    let lastLeadSnapshot = '';
    let lastLeadSubmissionId = '';
    let leadSnapshotInProgress = false;
    let fileSelectionInProgress = false;
    let nativeReceiptCheckId = 0;
    let isHeroSectionVisible = true;
    let isQuoteSectionVisible = false;
    let formStarted = false;
    let quoteSectionTracked = false;
    const maxLeadFileSize = 10 * 1024 * 1024;
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
    const dispatchMetaLead = (event: PendingMetaLead) => {
      if (!hasMarketingConsent()) return;
      publishAcceptedLeadConversion(event);
    };

    const ensureSubmissionId = () => {
      if (!submissionIdInput) return;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionIdInput.value)) return;
      const id = window.crypto?.randomUUID?.();
      if (id) submissionIdInput.value = id;
    };

    const trackAnalytics = trackAnalyticsEvent;
    const cleanupPriceCalculators = initializePriceCalculators(trackAnalytics);

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
      const selectedValue = leadMaterialFromCampaignParam(material);
      if (selectedValue && Array.from(materialSelect.options).some((option) => option.value === selectedValue)) {
        materialSelect.value = selectedValue;
      }
    };

    const setStatus = (message: string, type?: 'success' | 'error' | 'loading', variant?: 'submit', email?: string, emailSent = false) => {
      if (!status) return;
      status.classList.toggle('is-submit-success', type === 'success' && variant === 'submit');
      status.classList.toggle('is-success', type === 'success');
      status.classList.toggle('is-error', type === 'error');
      status.classList.toggle('is-loading', type === 'loading');
      if (type === 'loading') {
        status.innerHTML =
          '<span class="form-loading-bar" aria-hidden="true"></span><strong>Odosielame dopyt...</strong><span>Chvíľu počkajte, ukladáme dopyt a pripravujeme potvrdenie.</span>';
        return;
      }
      if (type === 'success' && variant === 'submit') {
        status.innerHTML = [
          '<span class="success-check" aria-hidden="true">&#10003;</span>',
          '<strong>Dopyt sme prijali</strong>',
          emailSent
            ? `<span>Potvrdenie sme poslali na email:<br><b>${escapeHtml(email || 'zadaný email')}</b></span>`
            : '<span>Dopyt máme uložený. Potvrdenie emailom ešte overujeme; nemusíte ho odosielať znova.</span>',
          '<span>Nezáväznú cenovú ponuku vám pošleme čo najskôr, najneskôr do 24 hodín.</span>',
          '<small>Máte otázky? Zavolajte:</small>',
          '<a class="success-phone" href="tel:+421905217946">0905 217 946</a>',
          '<small>Po-Pia 7:00-18:00</small>',
        ].join('');
        return;
      }
      status.textContent = message;
    };

    const applyNativeSubmitResult = async () => {
      if (!form) return;
      const url = new URL(window.location.href);
      const submitted = url.searchParams.get('odoslane') === '1';
      const receiptToken = url.searchParams.get('dopyt_receipt') || '';
      const errorMessage = url.searchParams.get('chyba');
      if (!submitted && !errorMessage && !receiptToken) return;
      if (submitted) {
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (button && !button.dataset.defaultLabel) button.dataset.defaultLabel = button.innerHTML;
        setFormSubmitting(true, button);
        setStatus('Overujeme výsledok odoslania…', 'loading');
        const receiptCheckId = ++nativeReceiptCheckId;
        const receiptController = new AbortController();
        const receiptTimeoutId = window.setTimeout(() => receiptController.abort(), 10_000);
        let verifiedReceipt: { accepted?: boolean; emailSent?: boolean } | null = null;
        if (receiptToken.length <= 512) {
          try {
            const response = await fetch(`/api/lead/receipt/?token=${encodeURIComponent(receiptToken)}`, {
              headers: { Accept: 'application/json' },
              cache: 'no-store',
              credentials: 'same-origin',
              signal: receiptController.signal,
            });
            if (response.ok && (response.headers.get('content-type') || '').includes('application/json')) {
              verifiedReceipt = await response.json();
            }
          } catch {
            // An unverifiable native result must never be presented as an accepted lead.
          } finally {
            window.clearTimeout(receiptTimeoutId);
          }
        } else {
          window.clearTimeout(receiptTimeoutId);
        }
        if (receiptCheckId !== nativeReceiptCheckId) return;
        setFormSubmitting(false, button);
        if (verifiedReceipt?.accepted === true) {
          form.classList.add('is-submitted');
          button?.setAttribute('disabled', 'true');
          setStatus(verifiedReceipt.emailSent === true
            ? 'Dopyt sme prijali a potvrdenie sme odoslali.'
            : 'Dopyt sme prijali. Potvrdenie emailom ešte overujeme; nemusíte ho odosielať znova.', 'success');
        } else {
          setStatus('Výsledok odoslania sa nepodarilo bezpečne overiť. Dopyt zatiaľ neposielajte znova; zavolajte nám na 0905 217 946.', 'error');
        }
      } else if (errorMessage) {
        setStatus(errorMessage, 'error');
      }
      url.searchParams.delete('odoslane');
      url.searchParams.delete('potvrdenie');
      url.searchParams.delete('dopyt_receipt');
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
        remove.disabled = fileSelectionInProgress || Boolean(form?.classList.contains('is-submitting'));
        remove.setAttribute('aria-label', `Odstrániť ${file.name}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          if (fileSelectionInProgress || form?.classList.contains('is-submitting')) return;
          selectedFiles.splice(index, 1);
          updateFileInput();
          renderFiles();
        });
        chip.append(label, remove);
        preview.appendChild(chip);
      });
    };

    const addFiles = async (files: FileList | File[]) => {
      if (form?.classList.contains('is-submitting') || leadSnapshotInProgress) {
        setStatus('Dopyt sa už odosiela. Počkajte na výsledok; vybrané fotky počas odosielania nemeníme.', 'error');
        return;
      }
      if (fileSelectionInProgress) {
        setStatus('Počkajte chvíľu, kým overíme vybrané fotky.', 'error');
        return;
      }

      fileSelectionInProgress = true;
      renderFiles();
      if (fileInput) fileInput.disabled = true;
      fileInput?.setAttribute('aria-busy', 'true');
      try {
        const incoming = Array.from(files);
        const eligible: File[] = [];
        const rejected: string[] = [];
        for (const file of incoming) {
          if (file.size <= 0) {
            rejected.push(`${file.name}: súbor je prázdny.`);
            continue;
          }
          if (file.size > maxLeadFileSize) {
            rejected.push(`${file.name}: súbor môže mať najviac 10 MB.`);
            continue;
          }
          if (!leadPhotoContentType(file.name, file.type)) {
            rejected.push(`${file.name}: povolené sú iba JPG, JPEG, PNG alebo WEBP fotky. Fotku z iPhonu uložte ako JPG.`);
            continue;
          }
          eligible.push(file);
        }
        const previousCount = selectedFiles.length;
        const selection = await addUniqueLeadPhotos(selectedFiles, eligible, fingerprintLeadPhoto, 10);
        selectedFiles = selection.files;
        updateFileInput();
        renderFiles();

        if (selection.duplicateFiles.length) {
          rejected.push('Rovnaká fotka už je vybraná; priložte ju iba raz.');
        }
        if (selection.overflowFiles.length) {
          rejected.push('Nahrať môžete maximálne 10 rôznych súborov.');
        }
        if (rejected.length) {
          setStatus(rejected.join(' '), 'error');
        } else if (selectedFiles.length > previousCount) {
          setStatus(`Vybrané fotky: ${selectedFiles.length}.`, 'success');
        }
      } catch {
        setStatus('Vybrané fotky sa nepodarilo bezpečne overiť. Skúste ich vybrať znova.', 'error');
      } finally {
        fileSelectionInProgress = false;
        if (fileInput) fileInput.disabled = form?.classList.contains('is-submitting') || false;
        fileInput?.removeAttribute('aria-busy');
        renderFiles();
      }
    };

    const onFilesChange = () => {
      if (fileInput?.files) void addFiles(fileInput.files);
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
            ? ((await response.json()) as { ok?: boolean; message?: string; emailSent?: boolean; metaLead?: PendingMetaLead; retryPhotoPathname?: string })
            : { ok: false, message: (await response.text()).trim().slice(0, 180) };
          if (!response.ok || !result.ok) {
            const responseError = new Error(result.message || 'Výsledok odoslania sa nepodarilo potvrdiť. Neobnovujte stránku; zachovajte vyplnený formulár a skúste to znova alebo zavolajte 0905 217 946.') as Error & { responseReceived?: boolean; retryPhotoPathname?: string };
            responseError.responseReceived = true;
            responseError.retryPhotoPathname = result.retryPhotoPathname;
            throw responseError;
          }
          return result;
        } catch (error) {
          if (error instanceof Error && 'responseReceived' in error) throw error;
          lastError = error instanceof Error ? error : new Error('Výsledok odoslania sa nepodarilo potvrdiť. Neobnovujte stránku; zachovajte vyplnený formulár a skúste to znova alebo zavolajte 0905 217 946.');
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      throw lastError || new Error('Výsledok odoslania sa nepodarilo potvrdiť. Neobnovujte stránku; zachovajte vyplnený formulár a skúste to znova alebo zavolajte 0905 217 946.');
    };

    const uploadLeadPhotos = async () => {
      if (!selectedFiles.length) return [];
      const { upload } = await import('@vercel/blob/client');
      const submissionId = submissionIdInput?.value || '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
        throw new Error('Fotky sa nepodarilo pripraviť na nahratie. Skúste formulár odoslať znova.');
      }

      const controllers: AbortController[] = [];
      let cancelling = false;
      const uploads = selectedFiles.map(async (file) => {
        const extension = leadPhotoExtension(file.name);
        const contentType = leadPhotoContentType(file.name, file.type);
        if (!contentType) {
          throw new Error('Povolené sú iba JPG, JPEG, PNG alebo WEBP súbory. Fotku z iPhonu uložte ako JPG.');
        }
        if (file.size <= 0 || file.size > maxLeadFileSize) {
          throw new Error(`Súbor ${file.name} môže mať maximálne 10 MB.`);
        }
        const fileFingerprint = await fingerprintLeadPhoto(file);
        if (cancelling) throw new Error('Prerušené nahrávanie fotografií. Skúste odoslanie znova.');
        const uploadGroup = await fingerprintLeadUploadGroup(file);
        if (cancelling) throw new Error('Prerušené nahrávanie fotografií. Skúste odoslanie znova.');
        const cached = uploadedFilesByFingerprint.get(fileFingerprint);
        if (cached?.submissionId === submissionId && cached.promise) return cached.promise;
        const state: CachedPhotoUpload = cached?.submissionId === submissionId
          ? cached
          : { submissionId, pathname: `lead-drafts/${submissionId}/${crypto.randomUUID()}${extension}`, previousPathnames: [] };
        if (cached?.submissionId === submissionId && !cached.promise && cached.pathname) {
          if (!state.previousPathnames.includes(cached.pathname)) state.previousPathnames.push(cached.pathname);
          state.replacedPathname = cached.pathname;
          state.pathname = `lead-drafts/${submissionId}/${crypto.randomUUID()}${extension}`;
        }
        const controller = new AbortController();
        controllers.push(controller);
        const timeoutId = window.setTimeout(() => controller.abort(), 120_000);
        const promise = upload(state.pathname, file, {
          access: 'private',
          contentType,
          handleUploadUrl: '/api/lead-upload/',
          clientPayload: JSON.stringify({ submissionId, replacesPathname: state.replacedPathname, replacesPathnames: state.previousPathnames, fileFingerprint: uploadGroup }),
          multipart: file.size > 5 * 1024 * 1024,
          abortSignal: controller.signal,
        }).then((blob) => ({ pathname: blob.pathname, originalName: file.name, submissionId }));
        state.promise = promise;
        uploadedFilesByFingerprint.set(fileFingerprint, state);
        try {
          const uploaded = await promise;
          state.replacedPathname = undefined;
          return uploaded;
        } catch (error) {
          if (uploadedFilesByFingerprint.get(fileFingerprint) === state && state.promise === promise) {
            state.promise = undefined;
            state.replacedPathname = state.pathname;
          }
          throw new Error(leadPhotoUploadErrorMessage(error, file.name, controller.signal.aborted));
        } finally {
          window.clearTimeout(timeoutId);
        }
      });
      return settleLeadPhotoUploadBatch(uploads, () => {
        cancelling = true;
        controllers.forEach((controller) => controller.abort());
      });
    };

    const onSubmit = async (event: SubmitEvent) => {
      if (!form) return;
      if (fileSelectionInProgress) {
        event.preventDefault();
        setStatus('Počkajte chvíľu, kým dokončíme overenie vybraných fotiek.', 'error');
        return;
      }
      if (form.classList.contains('is-submitting') || leadSnapshotInProgress) {
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
      payload.set('leadAttribution', JSON.stringify(getLeadAttribution()));
      const analyticsSessionId = getAnalyticsSessionId();
      if (analyticsSessionId) payload.set('analyticsSessionId', analyticsSessionId);
      const submittedEmail = String(payload.get('email') || '').trim();
      if (button && !button.dataset.defaultLabel) button.dataset.defaultLabel = button.innerHTML;
      setFormSubmitting(true, button);

      try {
        leadSnapshotInProgress = true;
        const leadSnapshot = await createLeadFormSnapshot(payload, selectedFiles);
        let submissionId = submissionIdInput?.value || '';
        if (lastLeadSnapshot && leadSnapshot !== lastLeadSnapshot && submissionId === lastLeadSubmissionId) {
          submissionId = window.crypto?.randomUUID?.() || '';
          if (!submissionId) throw new Error('Bezpečné odoslanie nie je v tomto prehliadači dostupné. Obnovte stránku alebo zavolajte 0905 217 946.');
          if (submissionIdInput) submissionIdInput.value = submissionId;
          payload.set('submissionId', submissionId);
        }
        lastLeadSnapshot = leadSnapshot;
        lastLeadSubmissionId = submissionId;
        const uploadedPhotos = await uploadLeadPhotos();
        if (uploadedPhotos.length) {
          payload.delete('photos');
          payload.set('uploadedPhotos', JSON.stringify(uploadedPhotos));
        }
        const result = await submitLeadForm(payload);
        form.reset();
        selectedFiles = [];
        uploadedFilesByFingerprint.clear();
        lastLeadSnapshot = '';
        lastLeadSubmissionId = '';
        updateFileInput();
        if (preview) preview.innerHTML = '';
        if (result.metaLead) dispatchMetaLead(result.metaLead);
        form.classList.add('is-submitted');
        setStatus(result.message || 'Dopyt sme prijali. Ozveme sa vám s ďalším postupom.', 'success', 'submit', submittedEmail, result.emailSent === true);
      } catch (error) {
        if (error instanceof Error && 'retryPhotoPathname' in error && typeof error.retryPhotoPathname === 'string') {
          resetMissingLeadPhotoUpload(uploadedFilesByFingerprint, error.retryPhotoPathname);
        }
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
        leadSnapshotInProgress = false;
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
      const calculatorRect = priceCalculatorCard?.getBoundingClientRect();
      const calculatorVisible = Boolean(calculatorRect && calculatorRect.top < window.innerHeight && calculatorRect.bottom > 0);
      const shouldShow = isMobile && !isHeroSectionVisible && !isQuoteSectionVisible && !calculatorVisible && !cookieBannerVisible;
      stickyCta.classList.toggle('is-visible', shouldShow);
      stickyCta.inert = !shouldShow;
      whatsappButton?.classList.toggle('is-hidden-over-form', isMobile && (isQuoteSectionVisible || shouldShow));
      whatsappButton?.classList.toggle('is-hidden-by-cookie', isMobile && cookieBannerVisible);
      if (whatsappButton) whatsappButton.inert = isMobile && (isQuoteSectionVisible || shouldShow || cookieBannerVisible);
    };

    menuToggle?.addEventListener('click', onMenuClick);
    navLinks.forEach((link) => link.addEventListener('click', closeMenu));
    applyMaterialFromUrl();
    if (form) {
      try {
        const priceDraft = takePriceQuoteDraft(window.sessionStorage);
        if (priceDraft) applyPriceQuoteDraft(form, priceDraft);
      } catch { /* Browser storage may be unavailable; leave the form untouched. */ }
    }
    applyRooferSelectionFromUrl();
    void applyNativeSubmitResult();
    fileInput?.addEventListener('change', onFilesChange);
    const onFileDragOver = (event: DragEvent) => {
      event.preventDefault();
      fileDrop?.classList.add('is-dragging');
    };
    const onFileDragLeave = () => fileDrop?.classList.remove('is-dragging');
    const onFileDrop = (event: DragEvent) => {
      event.preventDefault();
      fileDrop?.classList.remove('is-dragging');
      if (event.dataTransfer?.files?.length) void addFiles(event.dataTransfer.files);
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
      cleanupPriceCalculators();
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
