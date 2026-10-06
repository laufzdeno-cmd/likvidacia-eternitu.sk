'use client';

import { useEffect } from 'react';
import { trackAnalyticsEvent } from '@/src/lib/analytics-client';

export default function RealizationsGalleryClient() {
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-gallery-card]'));
    const filters = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-gallery-filter]'));
    const loadMore = document.querySelector<HTMLButtonElement>('[data-gallery-load-more]');
    const lightbox = document.querySelector<HTMLElement>('[data-gallery-lightbox]');
    const image = document.querySelector<HTMLImageElement>('[data-lightbox-image]');
    const caption = document.querySelector<HTMLElement>('[data-lightbox-caption]');
    const closeButton = document.querySelector<HTMLButtonElement>('[data-lightbox-close]');
    const previousButton = document.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
    const nextButton = document.querySelector<HTMLButtonElement>('[data-lightbox-next]');
    const stickyCta = document.querySelector<HTMLElement>('.mobile-sticky-cta');
    const whatsappButton = document.querySelector<HTMLElement>('.whatsapp-btn');
    if (!cards.length) return;

    const deferredPictures = Array.from(
      document.querySelectorAll<HTMLPictureElement>('picture[data-deferred-responsive-image]'),
    );
    const activateDeferredPicture = (picture: HTMLPictureElement) => {
      const source = picture.querySelector<HTMLSourceElement>('source[data-deferred-srcset]');
      const deferredImage = picture.querySelector<HTMLImageElement>('img[data-deferred-src]');
      if (!source || !deferredImage) return;
      const sourceSizes = source.dataset.deferredSizes;
      const sourceSrcSet = source.dataset.deferredSrcset;
      const imageSizes = deferredImage.dataset.deferredSizes;
      const imageSrcSet = deferredImage.dataset.deferredSrcset;
      const imageSrc = deferredImage.dataset.deferredSrc;
      if (sourceSizes) source.sizes = sourceSizes;
      if (sourceSrcSet) source.srcset = sourceSrcSet;
      if (imageSizes) deferredImage.sizes = imageSizes;
      if (imageSrcSet) deferredImage.srcset = imageSrcSet;
      if (imageSrc) deferredImage.src = imageSrc;
      deferredImage.alt = deferredImage.dataset.deferredAlt || '';
      picture.removeAttribute('aria-hidden');
      picture.removeAttribute('data-deferred-responsive-image');
    };
    let galleryImageObserver: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      galleryImageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const picture = entry.target as HTMLPictureElement;
          activateDeferredPicture(picture);
          galleryImageObserver?.unobserve(picture);
        });
      }, { rootMargin: '240px 0px', threshold: 0.01 });
      deferredPictures.forEach((picture) => galleryImageObserver?.observe(picture));
    } else {
      deferredPictures.forEach(activateDeferredPicture);
    }

    let activeCards = cards.slice(0, 12);
    let activeIndex = 0;
    let trigger: HTMLButtonElement | null = null;

    const refreshActiveCards = () => {
      activeCards = cards.filter((card) => !card.hidden);
      if (!activeCards.length) activeCards = cards.slice(0, 12);
    };

    const setLightboxImage = () => {
      const activeCard = activeCards[activeIndex];
      if (!activeCard || !image || !caption) return;
      image.src = activeCard.dataset.galleryWebp || activeCard.dataset.galleryJpg || '';
      image.alt = activeCard.dataset.galleryAlt || '';
      caption.textContent = activeCard.dataset.galleryTitle || '';
    };

    const openLightbox = (card: HTMLButtonElement) => {
      if (!lightbox || !image || !caption) return;
      refreshActiveCards();
      trigger = card;
      activeIndex = Math.max(0, activeCards.indexOf(card));
      setLightboxImage();
      lightbox.hidden = false;
      document.body.classList.add('is-lightbox-open');
      closeButton?.focus({ preventScroll: true });
    };

    const closeLightbox = () => {
      if (!lightbox) return;
      lightbox.hidden = true;
      document.body.classList.remove('is-lightbox-open');
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      trigger = null;
    };

    const moveLightbox = (direction: 1 | -1) => {
      if (!lightbox || lightbox.hidden) return;
      refreshActiveCards();
      if (!activeCards.length) return;
      activeIndex = (activeIndex + direction + activeCards.length) % activeCards.length;
      setLightboxImage();
    };

    const onCardClick = (event: Event) => openLightbox(event.currentTarget as HTMLButtonElement);
    const onFilterClick = (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const category = button.dataset.galleryFilter || 'vsetko';
      let shown = 0;
      filters.forEach((filter) => {
        const active = filter === button;
        filter.classList.toggle('is-active', active);
        filter.setAttribute('aria-pressed', String(active));
      });
      cards.forEach((card) => {
        const matches = category === 'vsetko' || card.dataset.galleryCategory === category;
        card.hidden = !matches || shown >= 12;
        if (matches && !card.hidden) shown += 1;
      });
      if (loadMore) {
        const matchingCount = cards.filter((card) => category === 'vsetko' || card.dataset.galleryCategory === category).length;
        loadMore.hidden = matchingCount <= 12;
        loadMore.dataset.galleryCurrentFilter = category;
      }
      trackAnalyticsEvent('gallery_filter', { gallery: 'realizacie', category });
    };

    const onLoadMore = () => {
      const category = loadMore?.dataset.galleryCurrentFilter || 'vsetko';
      let shown = 0;
      cards.forEach((card) => {
        const matches = category === 'vsetko' || card.dataset.galleryCategory === category;
        if (!matches || shown >= 12) return;
        if (card.hidden) {
          card.hidden = false;
          shown += 1;
        }
      });
      if (loadMore) {
        const hasMore = cards.some((card) =>
          (category === 'vsetko' || card.dataset.galleryCategory === category) && card.hidden,
        );
        loadMore.hidden = !hasMore;
      }
    };

    const onCloseClick = () => closeLightbox();
    const onPreviousClick = () => moveLightbox(-1);
    const onNextClick = () => moveLightbox(1);
    const onLightboxClick = (event: MouseEvent) => {
      if (event.target === lightbox) closeLightbox();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!lightbox || lightbox.hidden) return;
      if (event.key === 'Tab') {
        const controls = [closeButton, previousButton, nextButton]
          .filter((control): control is HTMLButtonElement => Boolean(control && !control.disabled));
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
      if (event.key === 'Escape') { event.preventDefault(); closeLightbox(); }
      if (event.key === 'ArrowRight') { event.preventDefault(); moveLightbox(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); moveLightbox(-1); }
    };
    const onScroll = () => {
      const stickyVisible = window.innerWidth <= 760 && window.scrollY > 280;
      stickyCta?.classList.toggle('is-visible', stickyVisible);
      if (stickyCta) stickyCta.inert = !stickyVisible;
      whatsappButton?.classList.toggle('is-hidden-by-sticky-cta', stickyVisible);
      if (whatsappButton) whatsappButton.inert = stickyVisible;
    };

    cards.forEach((card) => card.addEventListener('click', onCardClick));
    filters.forEach((filter) => {
      const active = filter.dataset.galleryFilter === 'vsetko';
      filter.classList.toggle('is-active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    filters.forEach((filter) => filter.addEventListener('click', onFilterClick));
    if (loadMore) {
      loadMore.dataset.galleryCurrentFilter = 'vsetko';
      loadMore.hidden = cards.length <= 12;
    }
    loadMore?.addEventListener('click', onLoadMore);
    closeButton?.addEventListener('click', onCloseClick);
    previousButton?.addEventListener('click', onPreviousClick);
    nextButton?.addEventListener('click', onNextClick);
    lightbox?.addEventListener('click', onLightboxClick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    return () => {
      galleryImageObserver?.disconnect();
      cards.forEach((card) => card.removeEventListener('click', onCardClick));
      filters.forEach((filter) => filter.removeEventListener('click', onFilterClick));
      loadMore?.removeEventListener('click', onLoadMore);
      closeButton?.removeEventListener('click', onCloseClick);
      previousButton?.removeEventListener('click', onPreviousClick);
      nextButton?.removeEventListener('click', onNextClick);
      lightbox?.removeEventListener('click', onLightboxClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      stickyCta?.classList.remove('is-visible');
      if (stickyCta) stickyCta.inert = true;
      whatsappButton?.classList.remove('is-hidden-by-sticky-cta');
      if (whatsappButton) whatsappButton.inert = false;
      document.body.classList.remove('is-lightbox-open');
    };
  }, []);

  return null;
}
