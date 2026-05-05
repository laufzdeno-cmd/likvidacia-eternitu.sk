import './styles.css';

const menuButton = document.querySelector<HTMLButtonElement>('.menu-toggle');
const siteNav = document.querySelector<HTMLElement>('#site-nav');

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  siteNav?.classList.toggle('is-open', !isOpen);
});

document.querySelectorAll<HTMLAnchorElement>('#site-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    siteNav?.classList.remove('is-open');
  });
});

const inquiryForm = document.querySelector<HTMLFormElement>('[data-inquiry-form]');
const formStatus = document.querySelector<HTMLElement>('[data-form-status]');

inquiryForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(inquiryForm);
  const lines: string[] = [
    'Dobrý deň,',
    '',
    'posielam dopyt na likvidáciu eternitu / materiálov obsahujúcich azbest.',
    '',
  ];

  formData.forEach((value, key) => {
    if (value instanceof File) {
      if (value.name) {
        lines.push(`${key}: ${value.name}`);
      }
      return;
    }

    const textValue = String(value).trim();
    if (textValue) {
      lines.push(`${key}: ${textValue}`);
    }
  });

  lines.push(
    '',
    'Fotky strechy, ak ich mám pripravené, priložím do emailu.',
    '',
    'Ďakujem.'
  );

  const payload = {
    createdAt: new Date().toISOString(),
    location: String(formData.get('Obec alebo okres') || ''),
    material: String(formData.get('Čo riešite') || ''),
    roofer: String(formData.get('Strechár') || ''),
  };

  try {
    window.localStorage.setItem(`likvidacia-eternitu-dopyt-${Date.now()}`, JSON.stringify(payload));
  } catch {
    // Local storage is only a convenience for the static GitHub Pages version.
  }

  if (formStatus) {
    formStatus.textContent =
      'Dopyt sme pripravili do emailu. Skontrolujte text, priložte fotky a odošlite ho na ASTANA, s.r.o.';
  }

  const subjectLocation = String(formData.get('Obec alebo okres') || 'Slovensko');
  const subject = encodeURIComponent(`Dopyt na likvidáciu eternitu - ${subjectLocation}`);
  const body = encodeURIComponent(lines.join('\n'));
  window.location.href = `mailto:astana@astana.sk?subject=${subject}&body=${body}`;
});
