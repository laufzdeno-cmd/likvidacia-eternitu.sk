'use client';

import { useEffect } from 'react';

export default function LandingClient() {
  useEffect(() => {
    const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
    const nav = document.querySelector<HTMLElement>('#site-nav');
    const form = document.querySelector<HTMLFormElement>('.lead-form');
    const testimonialForm = document.querySelector<HTMLFormElement>('.testimonial-submit-form');
    const fileInput = document.querySelector<HTMLInputElement>('#photos');
    const selectedRooferInput = document.querySelector<HTMLInputElement>('#selectedRooferId');
    const rooferSelect = document.querySelector<HTMLSelectElement>('#roofer');
    const fileDrop = document.querySelector<HTMLElement>('.file-drop');
    const preview = document.querySelector<HTMLElement>('.file-preview');
    const status = document.querySelector<HTMLElement>('.form-status');
    const testimonialStatus = document.querySelector<HTMLElement>('.testimonial-form-status');
    const stickyCta = document.querySelector<HTMLElement>('.mobile-sticky-cta');
    let selectedFiles: File[] = [];

    const onMenuClick = () => {
      if (!menuToggle || !nav) return;
      const open = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    };

    const updateFileInput = () => {
      if (!fileInput) return;
      const transfer = new DataTransfer();
      selectedFiles.slice(0, 10).forEach((file) => transfer.items.add(file));
      fileInput.files = transfer.files;
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

    const setStatus = (message: string, type?: 'success' | 'error') => {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('is-success', type === 'success');
      status.classList.toggle('is-error', type === 'error');
    };

    const onSubmit = async (event: SubmitEvent) => {
      if (!form) return;
      event.preventDefault();
      setStatus('');
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      button?.setAttribute('disabled', 'true');

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        const result = (await response.json()) as { ok?: boolean; message?: string };
        if (!response.ok || !result.ok) {
          throw new Error(result.message || 'Dopyt sa nepodarilo odoslať.');
        }
        form.reset();
        selectedFiles = [];
        updateFileInput();
        if (preview) preview.innerHTML = '';
        setStatus(result.message || 'Dopyt sme prijali. Ozveme sa vám s ďalším postupom.', 'success');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Dopyt sa nepodarilo odoslať.', 'error');
      } finally {
        button?.removeAttribute('disabled');
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

    const onScroll = () => {
      if (!stickyCta || !form) return;
      const formBottom = form.getBoundingClientRect().bottom;
      const shouldShow = window.innerWidth <= 760 && formBottom < 120;
      stickyCta.classList.toggle('is-visible', shouldShow);
    };

    menuToggle?.addEventListener('click', onMenuClick);
    applyRooferSelectionFromUrl();
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
    testimonialForm?.addEventListener('submit', onTestimonialSubmit);
    const contactButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-roofer-contact]'));
    const quoteLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-roofer-quote]'));
    const rooferCards = Array.from(document.querySelectorAll<HTMLElement>('[data-roofer-card]'));
    contactButtons.forEach((button) => button.addEventListener('click', onRooferContactClick));
    quoteLinks.forEach((link) => link.addEventListener('click', onRooferQuoteClick));
    let observer: IntersectionObserver | undefined;
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
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    return () => {
      menuToggle?.removeEventListener('click', onMenuClick);
      fileInput?.removeEventListener('change', onFilesChange);
      form?.removeEventListener('submit', onSubmit);
      testimonialForm?.removeEventListener('submit', onTestimonialSubmit);
      contactButtons.forEach((button) => button.removeEventListener('click', onRooferContactClick));
      quoteLinks.forEach((link) => link.removeEventListener('click', onRooferQuoteClick));
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return null;
}
