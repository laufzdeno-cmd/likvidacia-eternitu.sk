'use client';

import { useEffect } from 'react';

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
    const stickyCta = document.querySelector<HTMLElement>('.mobile-sticky-cta');
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
    const priceArea = document.querySelector<HTMLInputElement>('[data-price-area]');
    const priceAreaOutput = document.querySelector<HTMLOutputElement>('[data-price-area-output]');
    const priceMin = document.querySelector<HTMLElement>('[data-price-min]');
    const priceMax = document.querySelector<HTMLElement>('[data-price-max]');
    const priceMaterialButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-price-material]'));
    let selectedFiles: File[] = [];
    let activeGallery = galleryCards.slice(0, 12);
    let activeGalleryIndex = 0;
    let activePriceMaterial = 'vlnity';

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

    const priceRates: Record<string, { min: number; max: number }> = {
      vlnity: { min: 8, max: 14 },
      hladky: { min: 9, max: 15 },
      boleticky: { min: 11, max: 18 },
      neviem: { min: 8, max: 16 },
    };

    const formatPrice = (value: number) =>
      `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 }).format(Math.round(value / 10) * 10)} €`;

    const updatePriceCalculator = () => {
      if (!priceArea || !priceAreaOutput || !priceMin || !priceMax) return;
      const area = Number(priceArea.value || 120);
      const rates = priceRates[activePriceMaterial] || priceRates.vlnity;
      priceAreaOutput.textContent = `${area} m²`;
      priceMin.textContent = formatPrice(area * rates.min);
      priceMax.textContent = formatPrice(area * rates.max);
    };

    const onPriceMaterialClick = (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      activePriceMaterial = button.dataset.priceMaterial || 'vlnity';
      priceMaterialButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      updatePriceCalculator();
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

    const onRooferRegistrationSubmit = async (event: SubmitEvent) => {
      if (!rooferRegistrationForm) return;
      event.preventDefault();
      if (rooferRegistrationStatus) {
        rooferRegistrationStatus.textContent = '';
        rooferRegistrationStatus.classList.remove('is-success', 'is-error');
      }
      const button = rooferRegistrationForm.querySelector<HTMLButtonElement>('button[type="submit"]');
      button?.setAttribute('disabled', 'true');

      try {
        const response = await fetch(rooferRegistrationForm.action, {
          method: 'POST',
          body: new FormData(rooferRegistrationForm),
          headers: { Accept: 'application/json' },
        });
        const result = (await response.json()) as { ok?: boolean; message?: string };
        if (!response.ok || !result.ok) {
          throw new Error(result.message || 'Registráciu sa nepodarilo odoslať.');
        }
        rooferRegistrationForm.reset();
        if (rooferRegistrationStatus) {
          rooferRegistrationStatus.textContent =
            result.message || 'Ďakujeme! Vaša registrácia bola prijatá.\nOzveme sa vám do 48 hodín na zadané telefónne číslo.';
          rooferRegistrationStatus.classList.add('is-success');
        }
      } catch (error) {
        if (rooferRegistrationStatus) {
          rooferRegistrationStatus.textContent = error instanceof Error ? error.message : 'Registráciu sa nepodarilo odoslať.';
          rooferRegistrationStatus.classList.add('is-error');
        }
      } finally {
        button?.removeAttribute('disabled');
      }
    };

    const refreshGalleryActiveItems = () => {
      activeGallery = galleryCards.filter((card) => !card.hidden);
      if (!activeGallery.length) activeGallery = galleryCards.slice(0, 12);
    };

    const openGalleryLightbox = (card: HTMLButtonElement) => {
      if (!galleryLightbox || !lightboxImage || !lightboxCaption) return;
      refreshGalleryActiveItems();
      activeGalleryIndex = Math.max(0, activeGallery.indexOf(card));
      const image = activeGallery[activeGalleryIndex];
      lightboxImage.src = image.dataset.galleryWebp || image.dataset.galleryJpg || '';
      lightboxImage.alt = image.dataset.galleryAlt || '';
      lightboxCaption.textContent = image.dataset.galleryTitle || '';
      galleryLightbox.hidden = false;
      document.body.classList.add('is-lightbox-open');
    };

    const closeGalleryLightbox = () => {
      if (!galleryLightbox) return;
      galleryLightbox.hidden = true;
      document.body.classList.remove('is-lightbox-open');
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
      galleryFilters.forEach((filter) => filter.classList.toggle('is-active', filter === button));
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
          const progress = Math.min((now - startedAt) / duration, 1);
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
      if (event.key === 'Escape') closeGalleryLightbox();
      if (event.key === 'ArrowRight') moveGalleryLightbox(1);
      if (event.key === 'ArrowLeft') moveGalleryLightbox(-1);
    };

    const onScroll = () => {
      header?.classList.toggle('is-compact', window.scrollY > 28);
      if (!stickyCta) return;
      const isMobile = window.innerWidth <= 760;
      const shouldShow = form
        ? isMobile && form.getBoundingClientRect().bottom < 120
        : isMobile && window.scrollY > 280;
      stickyCta.classList.toggle('is-visible', shouldShow);
    };

    menuToggle?.addEventListener('click', onMenuClick);
    navLinks.forEach((link) => link.addEventListener('click', closeMenu));
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
    rooferRegistrationForm?.addEventListener('submit', onRooferRegistrationSubmit);
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
    priceArea?.addEventListener('input', updatePriceCalculator);
    priceMaterialButtons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', onPriceMaterialClick);
    });
    updatePriceCalculator();
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

    document.documentElement.classList.add('has-enhanced-motion');
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>(
      '.hero, .trust-bar, .section, .transport-banner, .final-cta, .site-footer, .roofer-hero, .roofer-final',
    ));
    revealTargets.forEach((item) => item.classList.add('reveal-on-scroll'));
    if ('IntersectionObserver' in window && revealTargets.length) {
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
      menuToggle?.removeEventListener('click', onMenuClick);
      navLinks.forEach((link) => link.removeEventListener('click', closeMenu));
      fileInput?.removeEventListener('change', onFilesChange);
      form?.removeEventListener('submit', onSubmit);
      testimonialForm?.removeEventListener('submit', onTestimonialSubmit);
      rooferRegistrationForm?.removeEventListener('submit', onRooferRegistrationSubmit);
      contactButtons.forEach((button) => button.removeEventListener('click', onRooferContactClick));
      quoteLinks.forEach((link) => link.removeEventListener('click', onRooferQuoteClick));
      galleryFilters.forEach((button) => button.removeEventListener('click', onGalleryFilter));
      homeGalleryFilters.forEach((button) => button.removeEventListener('click', onHomeGalleryFilter));
      reviewsToggle?.removeEventListener('click', onReviewsToggle);
      priceArea?.removeEventListener('input', updatePriceCalculator);
      priceMaterialButtons.forEach((button) => button.removeEventListener('click', onPriceMaterialClick));
      galleryLoadMore?.removeEventListener('click', onGalleryLoadMore);
      lightboxClose?.removeEventListener('click', closeGalleryLightbox);
      window.removeEventListener('keydown', onGalleryKeyDown);
      observer?.disconnect();
      sectionObserver?.disconnect();
      revealObserver?.disconnect();
      counterObserver?.disconnect();
      hashScrollTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return null;
}
