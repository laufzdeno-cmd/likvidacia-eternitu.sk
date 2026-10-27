/** Read-only crawl of an already running isolated local candidate. Never submits a lead. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const origin = process.env.ASTANA_CONTENT_AUDIT_ORIGIN || 'http://127.0.0.1:3147';
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname), 'Use an isolated loopback server.');
const output = path.resolve('tmp/content-audit/browser');
await mkdir(output, { recursive: true });
const executablePath = [process.env.ASTANA_HARNESS_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe', chromium.executablePath()].find(item => item && existsSync(item));
assert.ok(executablePath, 'A local browser is required.');
const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
const errors = [], results = [];
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-first-run', '--disable-background-networking'] });
const representatives = new Set(['/', '/poradna/', '/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/', '/likvidacia-eternitu/', '/likvidacia-azbestu/', '/likvidacia-azbestu-bratislava/', '/likvidacia-azbestu-poprad/', '/spolupracujuci-strechari/', '/kontakt/', '/o-firme/', '/faq/', '/kde-posobime/', '/cookies/', '/podmienky-pouzivania/', '/ochrana-osobnych-udajov/', '/kariera/', '/realizacie/', '/cena-likvidacie-azbestu/', '/recenzie/']);
const normalize = text => text.replace(/\s+/g, ' ').trim();
try {
  const context = await browser.newContext();
  await context.addCookies(['astana_analytics_consent', 'astana_marketing_consent'].map(name => ({name, value:'denied',url:origin})));
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  const essential = page.getByRole('button', { name: 'Len nevyhnutné', exact: true });
  if (await essential.isVisible()) await essential.click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      const errorStart = pageErrors.length;
      const response = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const firstPhoto = page.locator('.editorial-hero img').first();
      if (await firstPhoto.count()) await firstPhoto.evaluate(image => image.decode());
      const data = await page.evaluate(() => {
        const main = document.querySelector('main');
        const text = main?.textContent?.replace(/\s+/g, ' ').trim() || '';
        const graphs = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(script => {
          const value = JSON.parse(script.textContent); return Array.isArray(value) ? value : [value];
        }).flatMap(value => value['@graph'] || [value]);
        const faqs = graphs.filter(value => value['@type'] === 'FAQPage').flatMap(value => value.mainEntity || []);
        const badImages = [...(main?.querySelectorAll('img') || [])].filter(image => !image.closest('[aria-hidden="true"]') && !image.src.startsWith('data:') && !image.getAttribute('alt')?.trim()).map(image => image.getAttribute('src'));
        return { h1: [...document.querySelectorAll('h1')].map(item => item.textContent.trim()),
          title: document.title, description: document.querySelector('meta[name="description"]')?.content || '',
          canonical: document.querySelector('link[rel="canonical"]')?.href || '', text,
          words: text.split(/\s+/).length, photos: main?.querySelectorAll('img:not([data-deferred-src])').length || 0,
          overflow: document.documentElement.scrollWidth > innerWidth + 1, badImages,
          hiddenEditorialText: [...document.querySelectorAll('.editorial-hero .editorial-lead, .editorial-legal > p')].some(item => parseFloat(getComputedStyle(item).fontSize) === 0),
          faqs, anchors: [...(main?.querySelectorAll('a[href]') || [])].map(a => a.getAttribute('href')),
          ids: [...document.querySelectorAll('[id]')].map(item => item.id),
          overflowElements: [...document.querySelectorAll('main *')].filter(item => {
            const rect = item.getBoundingClientRect(); return rect.width > 0 && (rect.right > innerWidth + 2 || rect.left < -2);
          }).slice(0, 5).map(item => `${item.tagName}.${item.className}`),
        };
      });
      if (response.status() !== 200) errors.push(`${width} ${route}: HTTP ${response.status()}`);
      if (data.h1.length !== 1) errors.push(`${width} ${route}: ${data.h1.length} H1`);
      if (!data.title || !data.description) errors.push(`${width} ${route}: metadata missing`);
      if (data.canonical !== `https://likvidacia-eternitu.sk${route}`) errors.push(`${width} ${route}: canonical ${data.canonical}`);
      if (data.overflow) errors.push(`${width} ${route}: horizontal overflow (${data.overflowElements.join(', ')})`);
      if (data.badImages.length) errors.push(`${width} ${route}: missing image descriptions`);
      if (data.hiddenEditorialText) errors.push(`${width} ${route}: editorial text hidden by a style override`);
      for (const faq of data.faqs) {
        if (!data.text.includes(faq.name) || !data.text.includes(faq.acceptedAnswer.text.replace(/\s+/g, ' ').trim())) errors.push(`${width} ${route}: FAQ schema has no matching visible text: ${faq.name}`);
      }
      if (pageErrors.length > errorStart) errors.push(`${width} ${route}: ${pageErrors.slice(errorStart).join(', ')}`);
      const name = route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replaceAll('/', '--');
      if ([1440,390].includes(width) && representatives.has(route)) {
        await page.screenshot({path:path.join(output, `${width}-${name}.png`)});
        if (['/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/', '/likvidacia-azbestu-bratislava/', '/spolupracujuci-strechari/'].includes(route)) await page.screenshot({path:path.join(output, `${width}-${name}-full.png`),fullPage:true});
      }
      results.push({route,width,...data,faqs:data.faqs.length,text:undefined});
    }
    console.log(`Checked ${routes.length} public URLs at ${width}px.`);
  }
  const pages = new Map(results.filter(result=>result.width===1440).map(result=>[result.route,result]));
  for (const [route, result] of pages) for (const href of result.anchors) {
    const url = new URL(href, `https://likvidacia-eternitu.sk${route}`);
    if (url.origin !== 'https://likvidacia-eternitu.sk') continue;
    const target = pages.get(url.pathname);
    if (target && url.hash && !target.ids.includes(decodeURIComponent(url.hash.slice(1)))) errors.push(`${route}: missing fragment ${href}`);
    if (!target && !/^\/(admin|api)\b/.test(url.pathname) && !path.extname(url.pathname)) errors.push(`${route}: internal content target outside sitemap ${href}`);
  }
  await context.close();
} finally { await browser.close(); }
await writeFile(path.join(output, 'report.json'), JSON.stringify({origin,checkedAt:new Date().toISOString(),routes:routes.length,viewports:[1440,768,390,320],errors:[...new Set(errors)],results}, null, 2));
console.log(JSON.stringify({routes:routes.length,checks:results.length,errors:[...new Set(errors)]},null,2));
process.exitCode=errors.length ? 1 : 0;
