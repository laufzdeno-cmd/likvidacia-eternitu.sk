import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.ASTANA_SEO_OUTPUT_ROOT || '.next/server/app');
const publicRoot = path.resolve(process.env.ASTANA_SEO_PUBLIC_ROOT || 'public');
const sitemapFile = path.join(root, 'sitemap.xml.body');
const buildIdFile = path.resolve(process.env.ASTANA_SEO_BUILD_ID || path.join(root, '..', '..', 'BUILD_ID'));
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

function attribute(tag, name) {
  return tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] || '';
}

function metadata(html, key, value) {
  for (const [tag] of html.matchAll(/<(?:meta|link)\b[^>]*>/g)) {
    if (attribute(tag, key) === value) return attribute(tag, key === 'rel' ? 'href' : 'content');
  }
  return '';
}

const errors = [];
const siteOrigin = 'https://likvidacia-eternitu.sk';
const sitemapXml = await readFile(sitemapFile, 'utf8');
const sitemapUrls = new Set([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
const dynamicSitemapUrls = new Set([`${siteOrigin}/recenzie/`, `${siteOrigin}/realizacie/`]);
const checkedUrls = new Set();
let checked = 0;
for (const file of await htmlFiles(root)) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (relative.startsWith('admin/') || ['admin.html', '_not-found.html', '_global-error.html'].includes(relative)) continue;
  const route = relative.slice(0, -'.html'.length).replace(/(^|\/)index$/, '');
  const expectedUrl = `${siteOrigin}/${route ? `${route}/` : ''}`;
  const html = await readFile(file, 'utf8');
  const robots = [...html.matchAll(/<meta\b[^>]*>/g)]
    .filter(([tag]) => attribute(tag, 'name') === 'robots')
    .map(([tag]) => attribute(tag, 'content'));
  const inSitemap = sitemapUrls.has(expectedUrl);
  if (robots.some((value) => /\bnoindex\b/.test(value))) {
    if (inSitemap) errors.push(`${relative}: stránka zo sitemapy má noindex`);
    continue;
  }
  if (!inSitemap) errors.push(`${relative}: indexovateľná stránka chýba v sitemape`);

  checked += 1;
  checkedUrls.add(expectedUrl);
  const canonical = metadata(html, 'rel', 'canonical');
  const ogUrl = metadata(html, 'property', 'og:url');
  const ogImage = metadata(html, 'property', 'og:image');
  const twitterImage = metadata(html, 'name', 'twitter:image');
  if (canonical !== expectedUrl) errors.push(`${relative}: canonical nesúhlasí so skutočnou cestou ${expectedUrl}`);
  if (ogUrl !== expectedUrl) errors.push(`${relative}: og:url nesúhlasí so skutočnou cestou ${expectedUrl}`);
  if (!ogImage) errors.push(`${relative}: chýba og:image`);
  if (!twitterImage || twitterImage !== ogImage) errors.push(`${relative}: twitter:image nesúhlasí s og:image`);
  for (const image of [ogImage, twitterImage]) {
    if (!image) continue;
    const parsed = new URL(image);
    if (parsed.hostname === 'likvidacia-eternitu.sk' && !existsSync(path.join(publicRoot, decodeURIComponent(parsed.pathname)))) {
      errors.push(`${relative}: zdieľací obrázok neexistuje (${parsed.pathname})`);
    }
  }
}

for (const url of sitemapUrls) {
  if (!checkedUrls.has(url) && !dynamicSitemapUrls.has(url)) errors.push(`sitemap: ${url} nemá skontrolované statické HTML`);
}
for (const url of dynamicSitemapUrls) {
  if (!sitemapUrls.has(url)) errors.push(`sitemap: očakávaná dynamická stránka ${url} chýba`);
}
if (!checked) errors.push('Nenašlo sa žiadne verejné statické HTML na overenie.');
if (errors.length) {
  console.error(`SEO metadáta: ${errors.length} chýb z ${checked} verejných statických stránok.`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`PASS: build ${buildId}; URL, indexovanie a zdieľacie metadáta súhlasia so sitemapou na ${checked} verejných statických stránkach; ${dynamicSitemapUrls.size} dynamická URL vyžaduje osobitnú HTTP kontrolu.`);
}
