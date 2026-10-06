import { existsSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(process.env.ASTANA_SEO_OUTPUT_ROOT || '.next/server/app');
const sitemapFile = path.join(root, 'sitemap.xml.body');
const buildIdFile = path.resolve(process.env.ASTANA_SEO_BUILD_ID || path.join(root, '..', '..', 'BUILD_ID'));
const origin = 'https://likvidacia-eternitu.sk';
const publicRoot = path.resolve(process.env.ASTANA_SEO_PUBLIC_ROOT || 'public');
const allowedRoutesOutsideSitemap = new Set(['/cena/', '/sitemap.xml', '/robots.txt']);
const dynamicSitemapRoutes = new Set(['/recenzie/', '/realizacie/']);

if (!existsSync(root) || !existsSync(sitemapFile) || !existsSync(buildIdFile)) {
  console.error('Chýba zostavené HTML, sitemap alebo BUILD_ID. Najprv vytvorte a presne určte kandidátsky npm run build.');
  process.exit(1);
}
const buildId = (await readFile(buildIdFile, 'utf8')).trim();
if (!buildId) {
  console.error(`Prázdne BUILD_ID: ${buildIdFile}`);
  process.exit(1);
}

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(full) : entry.isFile() && entry.name.endsWith('.html') ? [full] : [];
  }));
  return nested.flat();
}

function routeForFile(file) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (relative.startsWith('admin/') || ['admin.html', '_not-found.html', '_global-error.html'].includes(relative)) return null;
  const route = relative.slice(0, -'.html'.length).replace(/(^|\/)index$/, '');
  return { relative, pathname: `/${route ? `${route}/` : ''}` };
}

function normalizedPathname(pathname) {
  return pathname === '/' || path.extname(pathname) ? pathname : `${pathname.replace(/\/+$/, '')}/`;
}

const xml = await readFile(sitemapFile, 'utf8');
const sitemapPaths = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => new URL(match[1]).pathname)
  .map(normalizedPathname));
const records = [];
for (const file of await htmlFiles(root)) {
  const route = routeForFile(file);
  if (!route) continue;
  records.push({ ...route, html: await readFile(file, 'utf8') });
}

const candidates = [
  process.env.ASTANA_SEO_BROWSER_PATH,
  chromium.executablePath(),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const executablePath = candidates.find((candidate) => existsSync(candidate));
if (!executablePath) {
  console.error('Nenašiel sa lokálny Chromium/Edge na kontrolu renderovaného HTML.');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-background-networking', '--no-first-run'] });
const errors = new Set();
const titleOwners = new Map();
const descriptionOwners = new Map();
const pages = new Map();
try {
  const context = await browser.newContext();
  await context.route('**/*', (route) => route.abort());
  const page = await context.newPage();
  for (const record of records) {
    const data = await page.evaluate((html) => {
      const document = new DOMParser().parseFromString(html, 'text/html');
      const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
      return {
        robots,
        title: document.title.trim(),
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '',
        h1: [...document.querySelectorAll('h1')].map((element) => element.textContent?.trim() || ''),
        mainText: document.querySelector('main')?.textContent?.replace(/\s+/g, ' ').trim() || '',
        anchors: [...document.querySelectorAll('a[href]')].map((element) => ({
          href: element.getAttribute('href') || '',
          label: (element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 80),
        })),
        ids: [...document.querySelectorAll('[id]')].map((element) => element.id),
      };
    }, record.html);
    if (/\bnoindex\b/i.test(data.robots)) continue;
    pages.set(record.pathname, { ...record, ...data, ids: new Set(data.ids) });
  }
  await context.close();
} finally {
  await browser.close();
}

if (pages.size === 0) errors.add('Build neobsahuje žiadnu statickú indexovateľnú stránku');
for (const pathname of sitemapPaths) {
  if (!pages.has(pathname) && !dynamicSitemapRoutes.has(pathname)) {
    errors.add(`${pathname}: stránka zo sitemapy nemá prerenderované HTML ani výslovne povolenú dynamickú trasu`);
  }
}

for (const [pathname, page] of pages) {
  if (!sitemapPaths.has(pathname)) errors.add(`${pathname}: indexovateľná stránka nie je v sitemape`);
  if (!page.title) errors.add(`${pathname}: chýba title`);
  if (!page.description) errors.add(`${pathname}: chýba meta description`);
  if (page.h1.length !== 1 || !page.h1[0]) errors.add(`${pathname}: očakáva sa presne jeden neprázdny H1, nájdené ${page.h1.length}`);
  if (/^\/likvidacia-azbestu-[a-z-]+\/$/.test(pathname)) {
    if (!page.mainText.includes('so sídlom v Poprade')) {
      errors.add(`${pathname}: regionálna stránka nevysvetľuje, odkiaľ firma na výjazd prichádza`);
    }
    if (!page.mainText.includes('v tejto lokalite nemáme pobočku')) {
      errors.add(`${pathname}: regionálna stránka môže vyvolávať dojem miestnej pobočky`);
    }
    if (!page.anchors.some((anchor) => anchor.href === '/kde-posobime/')) {
      errors.add(`${pathname}: chýba interný odkaz na celoslovenský prehľad výjazdov`);
    }
    if (page.mainText.includes('Typické objekty')) {
      errors.add(`${pathname}: opakuje sa všeobecný blok bez miestnej hodnoty`);
    }
  }
  for (const [value, owners, field] of [[page.title, titleOwners, 'title'], [page.description, descriptionOwners, 'description']]) {
    if (!value) continue;
    const first = owners.get(value);
    if (first) errors.add(`${pathname}: rovnaký ${field} ako ${first}`);
    else owners.set(value, pathname);
  }

  for (const anchor of page.anchors) {
    if (!anchor.href || anchor.href === '#') {
      errors.add(`${pathname}: prázdny odkaz „${anchor.label}“`);
      continue;
    }
    let target;
    try {
      target = new URL(anchor.href, `${origin}${pathname}`);
    } catch {
      errors.add(`${pathname}: neplatný odkaz ${anchor.href}`);
      continue;
    }
    if (target.protocol === 'javascript:') {
      errors.add(`${pathname}: nebezpečný javascript odkaz`);
      continue;
    }
    if (target.origin !== origin) continue;
    const targetPath = normalizedPathname(target.pathname);
    if (!sitemapPaths.has(targetPath) && !allowedRoutesOutsideSitemap.has(targetPath)) {
      let decoded;
      try {
        decoded = decodeURIComponent(target.pathname).replace(/^\/+/, '');
      } catch {
        errors.add(`${pathname}: neplatné kódovanie odkazu ${anchor.href}`);
        continue;
      }
      const asset = path.resolve(publicRoot, decoded);
      if (!asset.startsWith(`${publicRoot}${path.sep}`) || !existsSync(asset) || !statSync(asset).isFile()) {
        errors.add(`${pathname}: interný odkaz nemá známy cieľ ${anchor.href}`);
        continue;
      }
    }
    if (!target.hash) continue;
    const targetPage = pages.get(targetPath);
    if (!targetPage) continue; // Iba výslovne povolená dynamická URL; vyžaduje vlastný HTTP test.
    let fragment;
    try {
      fragment = decodeURIComponent(target.hash.slice(1));
    } catch {
      errors.add(`${pathname}: neplatná kotva ${anchor.href}`);
      continue;
    }
    if (fragment && !targetPage.ids.has(fragment)) errors.add(`${pathname}: kotva ${anchor.href} na statickom cieli neexistuje`);
  }
}

if (errors.size) {
  console.error(`Renderovaný SEO obsah: ${errors.size} nálezov na ${pages.size} statických indexovateľných stránkach.`);
  for (const error of [...errors].sort()) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`PASS: build ${buildId}; H1, title, description a interné odkazy/kotvy na ${pages.size} statických indexovateľných stránkach; dynamické URL vyžadujú samostatný HTTP test.`);
}
