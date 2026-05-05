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
