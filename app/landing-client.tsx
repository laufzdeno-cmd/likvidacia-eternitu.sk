'use client';

import { useEffect } from 'react';

export default function LandingClient() {
  useEffect(() => {
    const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
    const nav = document.querySelector<HTMLElement>('#site-nav');
    const form = document.querySelector<HTMLFormElement>('.lead-form');
    const fileInput = document.querySelector<HTMLInputElement>('#photos');
    const fileDrop = document.querySelector<HTMLElement>('.file-drop');
    const preview = document.querySelector<HTMLElement>('.file-preview');
    const status = document.querySelector<HTMLElement>('.form-status');
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

    const onScroll = () => {
      if (!stickyCta || !form) return;
      const formBottom = form.getBoundingClientRect().bottom;
      const shouldShow = window.innerWidth <= 760 && formBottom < 120;
      stickyCta.classList.toggle('is-visible', shouldShow);
    };

    menuToggle?.addEventListener('click', onMenuClick);
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
