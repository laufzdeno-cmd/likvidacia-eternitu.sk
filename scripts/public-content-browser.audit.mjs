/** Read-only crawl of an already running isolated local candidate. Never submits a lead. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { publicPhotoAssignments, publicPhotoIdentity } from '../src/content/public-photo-assignments.ts';

const origin = process.env.ASTANA_CONTENT_AUDIT_ORIGIN || 'http://127.0.0.1:3147';
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname), 'Use an isolated loopback server.');
const output = path.resolve(process.env.ASTANA_CONTENT_AUDIT_OUTPUT || 'tmp/content-audit/browser');
await mkdir(output, { recursive: true });
const executablePath = [process.env.ASTANA_HARNESS_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe', chromium.executablePath()].find(item => item && existsSync(item));
assert.ok(executablePath, 'A local browser is required.');
const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
const sitemapRoutes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
const requestedRoutes = process.env.ASTANA_CONTENT_AUDIT_ROUTES ? JSON.parse(process.env.ASTANA_CONTENT_AUDIT_ROUTES) : null;
if (requestedRoutes) assert.ok(Array.isArray(requestedRoutes) && requestedRoutes.length > 0
  && requestedRoutes.every(route => typeof route === 'string' && sitemapRoutes.includes(route)), 'Selected paths must belong to the public sitemap.');
const routes = requestedRoutes ? [...new Set(requestedRoutes)] : sitemapRoutes;
const errors = [], results = [];
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-first-run', '--disable-background-networking'] });
const representatives = new Set(['/', '/poradna/', '/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/', '/likvidacia-eternitu/', '/likvidacia-azbestu/', '/likvidacia-azbestu-bratislava/', '/likvidacia-azbestu-poprad/', '/spolupracujuci-strechari/', '/kontakt/', '/o-firme/', '/faq/', '/kde-posobime/', '/cookies/', '/podmienky-pouzivania/', '/ochrana-osobnych-udajov/', '/kariera/', '/realizacie/', '/cena-likvidacie-azbestu/', '/recenzie/']);
const normalize = text => text.replace(/\s+/g, ' ').trim();
const galleryFilterSnapshot = filter => filter.evaluate(button => {
  const container = button.parentElement.getBoundingClientRect();
  const box = button.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(button);
  const clipped = [...range.getClientRects()].some(rect => rect.left < container.left - 2 || rect.right > container.right + 2);
  return { label: button.textContent.trim(), active: button.getAttribute('aria-pressed') === 'true',
    focused: document.activeElement === button,
    fits: box.width <= container.width + 1 && !clipped && button.scrollWidth <= button.clientWidth + 1 };
});
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
      if (route === '/realizacie/') {
        const more = page.locator('[data-gallery-load-more]');
        for (let index = 0; index < 8 && await more.isVisible(); index += 1) {
          await more.click();
          await page.waitForTimeout(120);
        }
        await page.evaluate(() => scrollTo(0, 0));
      }
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
        const visibleText = [...(main?.querySelectorAll('h1,h2,h3,p,li,blockquote,label') || [])].filter(item => {
          const box = item.getBoundingClientRect(), style = getComputedStyle(item);
          return box.width > 2 && box.height > 2 && style.visibility !== 'hidden'
            && !item.closest('[aria-hidden="true"], .testimonial-public-honeypot');
        });
        const clippedText = visibleText.filter(item => {
          const style = getComputedStyle(item);
          return style.webkitLineClamp === 'none' && (item.scrollWidth > item.clientWidth + 2 && (['hidden','clip'].includes(style.overflowX) || item.children.length === 0)
            || item.scrollHeight > item.clientHeight + 2 && ['hidden','clip'].includes(style.overflowY));
        }).map(item => `${item.tagName}.${item.className}: ${item.textContent.trim().slice(0, 50)}`);
        const tightText = visibleText.filter(item => ['P','LI','BLOCKQUOTE'].includes(item.tagName)
          && parseFloat(getComputedStyle(item).fontSize) >= 14
          && parseFloat(getComputedStyle(item).lineHeight) / parseFloat(getComputedStyle(item).fontSize) < 1.4)
          .map(item => item.textContent.trim().slice(0, 50));
        const mainBox = main?.getBoundingClientRect();
        const textClippedByMain = mainBox && ['hidden', 'clip'].includes(getComputedStyle(main).overflowX)
          ? visibleText.filter(item => {
              const range = document.createRange();
              range.selectNodeContents(item);
              return [...range.getClientRects()].some(rect => rect.width > 0 && (rect.left < mainBox.left - 2 || rect.right > mainBox.right + 2));
            }).map(item => item.textContent.trim().slice(0, 80))
          : [];
        const reviewPanel = document.querySelector('#napisat-recenziu'), reviewBox = reviewPanel?.getBoundingClientRect();
        const reviewList = document.querySelector('#schvalene-recenzie'), firstPhoto = main?.querySelector('figure');
        return { h1: [...document.querySelectorAll('h1')].map(item => item.textContent.trim()),
          title: document.title, description: document.querySelector('meta[name="description"]')?.content || '',
          canonical: document.querySelector('link[rel="canonical"]')?.href || '', text,
          words: text.split(/\s+/).length, photos: main?.querySelectorAll('img:not([data-deferred-src])').length || 0,
          overflow: document.documentElement.scrollWidth > innerWidth + 1, badImages,
          hiddenEditorialText: [...document.querySelectorAll('.editorial-hero .editorial-lead, .editorial-legal > p')].some(item => parseFloat(getComputedStyle(item).fontSize) === 0),
          clippedText, tightText, textClippedByMain,
          mainCenterOffset: mainBox ? mainBox.left - (innerWidth - mainBox.width) / 2 : 0,
          readingWidths: [...document.querySelectorAll('.seo-page .seo-section > p:not(.eyebrow), .seo-page .seo-faq p, .editorial-article-body, .editorial-legal-body')]
            .filter(item => item.getBoundingClientRect().height > 0).map(item => Math.round(item.getBoundingClientRect().width)),
          reviewForm: reviewPanel ? {
            centerOffset: reviewBox.left - (innerWidth - reviewBox.width) / 2,
            beforeReviews: Boolean(reviewList && (reviewPanel.compareDocumentPosition(reviewList) & Node.DOCUMENT_POSITION_FOLLOWING)),
            beforePhoto: Boolean(firstPhoto && (reviewPanel.compareDocumentPosition(firstPhoto) & Node.DOCUMENT_POSITION_FOLLOWING)),
            isFirstSection: main?.querySelector('section') === reviewPanel,
            inputs: [...reviewPanel.querySelectorAll('input:not([type="hidden"]):not([type="radio"]),select,textarea,button')]
              .filter(item => !item.closest('[aria-hidden="true"]')).map(item => ({name:item.getAttribute('name') || item.tagName, height:Math.round(item.getBoundingClientRect().height),font:parseFloat(getComputedStyle(item).fontSize)})),
            ratingStars: [...reviewPanel.querySelectorAll('input[type="radio"][name="rating"]')].map(input => ({
              value:input.value, checked:input.checked, width:input.parentElement.getBoundingClientRect().width, height:input.parentElement.getBoundingClientRect().height,
            })),
            textRating: Boolean(reviewPanel.querySelector('select[name="rating"]')),
            buttonBackground: getComputedStyle(reviewPanel.querySelector('button[type="submit"]')).backgroundColor,
            buttonShadow: getComputedStyle(reviewPanel.querySelector('button[type="submit"]')).boxShadow,
          } : null,
          contentImages: [...(main?.querySelectorAll('img') || [])]
            .filter(image => !image.closest('noscript,[data-gallery-lightbox]'))
            .map(image => image.getAttribute('data-deferred-src') || image.getAttribute('src') || ''),
          rooferRecommendation: (() => {
            const input = document.querySelector('#roofer-recommendation-opt-in');
            const box = input?.getBoundingClientRect();
            const text = input?.parentElement?.querySelector('span')?.getBoundingClientRect();
            return box?.width && text ? { width:box.width, height:box.height,
              overlapsText:box.right > text.left + 1 && text.right > box.left + 1 && box.bottom > text.top + 1 && text.bottom > box.top + 1 } : null;
          })(),
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
      if (data.clippedText.length) errors.push(`${width} ${route}: clipped text (${data.clippedText.join('; ')})`);
      if (data.textClippedByMain.length) errors.push(`${width} ${route}: text extends beyond the clipping page (${data.textClippedByMain.join('; ')})`);
      if (data.tightText.length) errors.push(`${width} ${route}: tight line spacing (${data.tightText.join('; ')})`);
      if (Math.abs(data.mainCenterOffset) > 2) errors.push(`${width} ${route}: main content is off center`);
      if (data.readingWidths.some(value => value > 762)) errors.push(`${width} ${route}: reading column exceeds 760px`);
      const photoIds = data.contentImages.map(publicPhotoIdentity).filter(Boolean);
      const expectedPhotos = publicPhotoAssignments[route] || [];
      if (JSON.stringify(photoIds) !== JSON.stringify(expectedPhotos)) errors.push(`${width} ${route}: photos do not match their unique page assignments (${photoIds.join(', ')})`);
      if (route === '/realizacie/') {
        data.galleryFilterChecks = [];
        const filters = page.locator('[data-gallery-filter]');
        for (let index = 0; index < await filters.count(); index += 1) {
          const filter = filters.nth(index);
          await filter.click();
          await page.waitForTimeout(300);
          const check = await galleryFilterSnapshot(filter);
          data.galleryFilterChecks.push(check);
          if (!check.active || !check.fits) errors.push(`${width} ${route}: active gallery filter is clipped (${check.label})`);
        }
        data.galleryKeyboardChecks = [];
        await filters.first().focus();
        await page.keyboard.press('Shift+Tab');
        for (let index = 0; index < await filters.count(); index += 1) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);
          const check = await galleryFilterSnapshot(filters.nth(index));
          data.galleryKeyboardChecks.push(check);
          if (!check.focused || !check.fits) errors.push(`${width} ${route}: focused gallery filter is clipped (${check.label})`);
        }
        await filters.first().click();
        await page.evaluate(() => scrollTo(0, 0));
      }
      if (data.rooferRecommendation && (data.rooferRecommendation.width > 24 || data.rooferRecommendation.height > 24 || data.rooferRecommendation.overlapsText)) errors.push(`${width} ${route}: roofer checkbox has text-field dimensions or overlaps its label`);
      if (route === '/recenzie/') {
        if (!data.reviewForm?.isFirstSection || !data.reviewForm?.beforeReviews || !data.reviewForm?.beforePhoto) errors.push(`${width} ${route}: review form must come before reviews and photo`);
        if (Math.abs(data.reviewForm?.centerOffset ?? 100) > 2) errors.push(`${width} ${route}: form panel is off center`);
        if (data.reviewForm?.textRating || data.reviewForm?.ratingStars.length !== 5
          || data.reviewForm?.ratingStars.some(star => star.width < 44 || star.height < 44)) errors.push(`${width} ${route}: rating needs five accessible star targets`);
        if (data.reviewForm?.buttonBackground !== 'rgb(20, 104, 89)' || data.reviewForm?.buttonShadow !== 'none') errors.push(`${width} ${route}: review button must retain its green background without a red shadow`);
        for (const input of data.reviewForm?.inputs || []) {
          if (input.name === 'consentPublication') continue;
          if (input.height < 44 || input.font < 16) errors.push(`${width} ${route}: control too small (${input.name})`);
        }
      }
      for (const faq of data.faqs) {
        if (!data.text.includes(faq.name) || !data.text.includes(faq.acceptedAnswer.text.replace(/\s+/g, ' ').trim())) errors.push(`${width} ${route}: FAQ schema has no matching visible text: ${faq.name}`);
      }
      if (pageErrors.length > errorStart) errors.push(`${width} ${route}: ${pageErrors.slice(errorStart).join(', ')}`);
      const name = route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replaceAll('/', '--');
      if ([1440,390].includes(width) && representatives.has(route)) {
        await page.screenshot({path:path.join(output, `${width}-${name}.png`)});
        if (['/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/', '/likvidacia-azbestu-bratislava/', '/spolupracujuci-strechari/'].includes(route)) await page.screenshot({path:path.join(output, `${width}-${name}-full.png`),fullPage:true});
      }
      results.push({route,width,...data,photoIds,faqs:data.faqs.length,text:undefined});
    }
    console.log(`Checked ${routes.length} public URLs at ${width}px.`);
  }
  const pages = new Map(results.filter(result=>result.width===1440).map(result=>[result.route,result]));
  const owners = new Map();
  for (const [route, result] of pages) for (const id of result.photoIds) {
    if (owners.has(id)) errors.push(`${route}: photo ${id} already appears on ${owners.get(id)}`);
    owners.set(id, route);
  }
  for (const [route, result] of pages) for (const href of result.anchors) {
    const url = new URL(href, `https://likvidacia-eternitu.sk${route}`);
    if (url.origin !== 'https://likvidacia-eternitu.sk') continue;
    const target = pages.get(url.pathname);
    if (target && url.hash && !target.ids.includes(decodeURIComponent(url.hash.slice(1)))) errors.push(`${route}: missing fragment ${href}`);
    if (!target && !sitemapRoutes.includes(url.pathname) && !/^\/(admin|api)\b/.test(url.pathname) && !path.extname(url.pathname)) errors.push(`${route}: internal content target outside sitemap ${href}`);
  }
  await context.close();
} finally { await browser.close(); }
await writeFile(path.join(output, 'report.json'), JSON.stringify({origin,checkedAt:new Date().toISOString(),scope:requestedRoutes ? 'selected-routes' : 'full-sitemap',sitemapRoutes:sitemapRoutes.length,routes:routes.length,viewports:[1440,768,390,320],errors:[...new Set(errors)],results}, null, 2));
console.log(JSON.stringify({routes:routes.length,checks:results.length,errors:[...new Set(errors)]},null,2));
process.exitCode=errors.length ? 1 : 0;
