import { trackAnalyticsEvent } from '@/src/lib/analytics-client';
import { galleryReferences } from '@/src/data/azbestReferences';

const optimizedImageUrl = (src: string, width: number) =>
  `/_next/image/?url=${encodeURIComponent(src)}&w=${width}&q=75`;

const categoryBadgeCopy: Record<string, string> = {
  'rodinne-domy': 'rodinný dom',
  'hospodarske-budovy': 'hospodárska budova',
  priemysel: 'priemyselný objekt',
  interier: 'interiér',
  'balenie-odvoz': 'balenie a odvoz',
  strechari: 'strecha pripravená pre strechára',
};

const appendDeferredGalleryCards = (grid: HTMLElement, renderedCount: number) => {
  galleryReferences.slice(renderedCount).forEach((photo, offset) => {
    const index = renderedCount + offset;
    const card = document.createElement('button');
    card.className = 'real-gallery-card';
    card.type = 'button';
    card.dataset.galleryCard = '';
    card.dataset.galleryIndex = String(index);
    card.dataset.galleryCategory = photo.category;
    card.dataset.galleryWebp = photo.webp;
    card.dataset.galleryJpg = photo.jpg;
    card.dataset.galleryTitle = photo.title;
    card.dataset.galleryAlt = photo.alt;
    card.hidden = index >= 12;

    const picture = document.createElement('picture');
    const source = document.createElement('source');
    source.type = 'image/webp';
    source.sizes = '(max-width: 760px) 300px, 25vw';
    source.srcset = [384, 640, 828]
      .map((width) => `${optimizedImageUrl(photo.webp, width)} ${width}w`)
      .join(', ');
    const image = document.createElement('img');
    image.src = optimizedImageUrl(photo.jpg, 640);
    image.srcset = [384, 640, 828]
      .map((width) => `${optimizedImageUrl(photo.jpg, width)} ${width}w`)
      .join(', ');
    image.sizes = '(max-width: 760px) 300px, 25vw';
    image.alt = photo.alt;
    image.title = photo.title;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.width = 520;
    image.height = 420;
    picture.append(source, image);

    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = photo.title;
    const badge = document.createElement('small');
    badge.textContent = categoryBadgeCopy[photo.category] || 'realizácia ASTANA';
    copy.append(title, badge);
    card.append(picture, copy);
    grid.append(card);
  });
};

export default function initializeRealizationsGalleryClient() {
    const grid = document.querySelector<HTMLElement>('#realizacie-galeria .real-gallery-grid');
    const renderedCards = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-gallery-card]'));
    if (grid && renderedCards.length < galleryReferences.length) {
      appendDeferredGalleryCards(grid, renderedCards.length);
    }
    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-gallery-card]'));
    const filters = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-gallery-filter]'));
    const loadMore = document.querySelector<HTMLButtonElement>('[data-gallery-load-more]');
    const lightbox = document.querySelector<HTMLElement>('[data-gallery-lightbox]');
    const image = document.querySelector<HTMLImageElement>('[data-lightbox-image]');
    const caption = document.querySelector<HTMLElement>('[data-lightbox-caption]');
    const closeButton = document.querySelector<HTMLButtonElement>('[data-lightbox-close]');
    const previousButton = document.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
    const nextButton = document.querySelector<HTMLButtonElement>('[data-lightbox-next]');
    if (!cards.length) return;

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
    const revealFilter = (button: HTMLButtonElement) => {
      const strip = button.parentElement;
      if (!strip || strip.scrollWidth <= strip.clientWidth) return;
      const viewport = strip.getBoundingClientRect();
      const target = button.getBoundingClientRect();
      if (target.left < viewport.left || target.right > viewport.right) {
        button.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'auto' });
      }
    };
    const onFilterFocus = (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      // Pointer focus must not move the target before pointerup/click completes.
      if (button.matches(':focus-visible')) revealFilter(button);
    };
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
      revealFilter(button);
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
    cards.forEach((card) => card.addEventListener('click', onCardClick));
    filters.forEach((filter) => {
      const active = filter.dataset.galleryFilter === 'vsetko';
      filter.classList.toggle('is-active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    filters.forEach((filter) => filter.addEventListener('click', onFilterClick));
    filters.forEach((filter) => filter.addEventListener('focus', onFilterFocus));
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
    return () => {
      cards.forEach((card) => card.removeEventListener('click', onCardClick));
      filters.forEach((filter) => filter.removeEventListener('click', onFilterClick));
      filters.forEach((filter) => filter.removeEventListener('focus', onFilterFocus));
      loadMore?.removeEventListener('click', onLoadMore);
      closeButton?.removeEventListener('click', onCloseClick);
      previousButton?.removeEventListener('click', onPreviousClick);
      nextButton?.removeEventListener('click', onNextClick);
      lightbox?.removeEventListener('click', onLightboxClick);
      window.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('is-lightbox-open');
    };
}
