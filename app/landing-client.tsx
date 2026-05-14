'use client';

import { useEffect } from 'react';

export default function LandingClient() {
  useEffect(() => {
    const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
    const nav = document.querySelector<HTMLElement>('#site-nav');
    const form = document.querySelector<HTMLFormElement>('.lead-form');
    const fileInput = document.querySelector<HTMLInputElement>('#photos');
    const preview = document.querySelector<HTMLElement>('.file-preview');
    const status = document.querySelector<HTMLElement>('.form-status');
    const stickyCta = document.querySelector<HTMLElement>('.mobile-sticky-cta');

    const onMenuClick = () => {
      if (!menuToggle || !nav) return;
      const open = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    };

    const onFilesChange = () => {
      if (!fileInput || !preview) return;
      preview.innerHTML = '';
      Array.from(fileInput.files || []).forEach((file) => {
        const chip = document.createElement('span');
        chip.className = 'file-chip';
        chip.textContent = `${file.name} (${Math.round(file.size / 1024)} kB)`;
        preview.appendChild(chip);
      });
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
        if (preview) preview.innerHTML = '';
        setStatus(result.message || 'Dopyt sme prijali. Ozveme sa vám s ďalším postupom.', 'success');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Dopyt sa nepodarilo odoslať.', 'error');
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
    fileInput?.addEventListener('change', onFilesChange);
    form?.addEventListener('submit', onSubmit);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    return () => {
      menuToggle?.removeEventListener('click', onMenuClick);
      fileInput?.removeEventListener('change', onFilesChange);
      form?.removeEventListener('submit', onSubmit);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return null;
}
