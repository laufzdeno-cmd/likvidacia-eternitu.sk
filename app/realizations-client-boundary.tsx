'use client';

import { useEffect } from 'react';
import initializeRealizationsGalleryClient from './realizations-gallery-client';

const galleryHash = '#realizacie-galeria';
const galleryAnchorSelector = 'a[href="#realizacie-galeria"]';

export default function RealizationsClientBoundary() {
  useEffect(() => {
    const gallery = document.getElementById('realizacie-galeria');
    let deferredStyles = document.querySelector<HTMLLinkElement>('link[data-realizations-deferred-styles]');
    let styleFrame = 0;
    let createdDeferredStyles = false;
    let cancelled = false;
    const ensureDeferredStyles = () => {
      if (cancelled || deferredStyles) return;
      deferredStyles = document.createElement('link');
      deferredStyles.rel = 'stylesheet';
      deferredStyles.href = '/assets/realizations-below-fold.css';
      deferredStyles.fetchPriority = 'low';
      deferredStyles.dataset.realizationsDeferredStyles = 'true';
      document.head.append(deferredStyles);
      createdDeferredStyles = true;
    };
    if (window.location.hash === galleryHash) {
      ensureDeferredStyles();
    } else {
      styleFrame = window.requestAnimationFrame(() => {
        styleFrame = window.requestAnimationFrame(ensureDeferredStyles);
      });
    }
    let cleanup: void | (() => void);
    let activated = false;
    let ready = false;
    let pendingAction: HTMLElement | null = null;
    const deferredPictures = Array.from(
      document.querySelectorAll<HTMLPictureElement>('picture[data-deferred-responsive-image]'),
    );
    const activateDeferredPicture = (picture: HTMLPictureElement) => {
      const source = picture.querySelector<HTMLSourceElement>('source[data-deferred-srcset]');
      const deferredImage = picture.querySelector<HTMLImageElement>('img[data-deferred-src]');
      if (!source || !deferredImage) return;
      if (source.dataset.deferredSizes) source.sizes = source.dataset.deferredSizes;
      if (source.dataset.deferredSrcset) source.srcset = source.dataset.deferredSrcset;
      if (deferredImage.dataset.deferredSizes) deferredImage.sizes = deferredImage.dataset.deferredSizes;
      if (deferredImage.dataset.deferredSrcset) deferredImage.srcset = deferredImage.dataset.deferredSrcset;
      if (deferredImage.dataset.deferredSrc) deferredImage.src = deferredImage.dataset.deferredSrc;
      deferredImage.alt = deferredImage.dataset.deferredAlt || '';
      picture.removeAttribute('aria-hidden');
      picture.removeAttribute('data-deferred-responsive-image');
    };
    let imageObserver: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const picture = entry.target as HTMLPictureElement;
          activateDeferredPicture(picture);
          imageObserver?.unobserve(picture);
        });
      }, { rootMargin: '240px 0px', threshold: 0.01 });
      deferredPictures.forEach((picture) => imageObserver?.observe(picture));
    } else {
      deferredPictures.forEach(activateDeferredPicture);
    }

    const activate = () => {
      if (activated) return;
      activated = true;
      cleanup = initializeRealizationsGalleryClient();
      ready = true;
      const target = pendingAction;
      pendingAction = null;
      if (target?.isConnected) target.click();
    };
    const activateFromIntent = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(`#realizacie-galeria, ${galleryAnchorSelector}`)) {
        ensureDeferredStyles();
        activate();
      }
    };
    const preserveFirstGalleryAction = (event: MouseEvent) => {
      if (ready || cancelled) return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-gallery-card], [data-gallery-filter], [data-gallery-load-more]')
        : null;
      if (!target || !gallery?.contains(target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingAction ??= target;
      activate();
    };

    document.addEventListener('pointerover', activateFromIntent, true);
    document.addEventListener('focusin', activateFromIntent, true);
    document.addEventListener('touchstart', activateFromIntent, { capture: true, passive: true });
    document.addEventListener('click', preserveFirstGalleryAction, true);

    return () => {
      cancelled = true;
      if (styleFrame) window.cancelAnimationFrame(styleFrame);
      if (createdDeferredStyles) deferredStyles?.remove();
      imageObserver?.disconnect();
      document.removeEventListener('pointerover', activateFromIntent, true);
      document.removeEventListener('focusin', activateFromIntent, true);
      document.removeEventListener('touchstart', activateFromIntent, true);
      document.removeEventListener('click', preserveFirstGalleryAction, true);
      pendingAction = null;
      cleanup?.();
    };
  }, []);

  return null;
}
