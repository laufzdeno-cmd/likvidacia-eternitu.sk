import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const require = createRequire(import.meta.url);
require.extensions['.css'] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, name) => String(name) }) };
};

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { default: ApprovedCaseMap } = require('../app/realizacie/approved-case-map.tsx');
const { chromium } = await import('@playwright/test');
const sharpModule = await import('sharp');
const sharp = sharpModule.default;

const caseId = '8ef7f943-3993-43b1-9d40-093891872108';
const photoId = '9e369ed8-28c0-4e10-8066-7f27c3955522';
const testCase = {
  id: caseId,
  title: 'TEST – vizuálna kontrola, nezverejňovať',
  locality: 'Poprad',
  localityPrecision: 'municipality',
  objectType: 'rodinný dom',
  materialType: 'vlnitý eternit',
  workDescription: 'Testovací text pre kontrolu zalamovania a čitateľnosti obsahu na mobile aj desktope.',
  resultDescription: 'TEST – ide o syntetické údaje, nie o skutočnú realizáciu ASTANA.',
  areaEstimate: 120,
  workPeriod: 'TEST 2026',
  photoIds: [photoId],
  publishedAt: '2026-10-01T00:00:00.000Z',
};

const html = renderToStaticMarkup(React.createElement(ApprovedCaseMap, { cases: [testCase] }));
assert.match(html, /TEST – vizuálna kontrola, nezverejňovať/);
assert.match(html, /Konkrétne práce, nie iba sľuby/);
assert.match(html, new RegExp(`/api/realization-case-media/${photoId}/\\?w=720`));
assert.match(html, new RegExp(`srcSet="/api/realization-case-media/${photoId}/\\?w=360 360w,`),
  'publikovaná fotografia musí mať responzívny srcset bez zdieľanej image cache');
assert.match(html, /sizes="\(max-width: 700px\) 100vw, \(max-width: 1100px\) 50vw, 33vw"/);
assert.match(html, /href="\/likvidacia-azbestu\/"/);
assert.match(html, /href="\/kde-posobime\/"/);
assert.match(html, new RegExp(`href="#realizacia-${caseId}"`));
assert.doesNotMatch(html, /publicationEvidence|businessJobId|privatePhoto|storageKey/i);
const ambiguousHtml = renderToStaticMarkup(React.createElement(ApprovedCaseMap, {
  cases: [{ ...testCase, id: '7d96e4c4-8e42-4c1c-af11-1fbff597862c', locality: 'Zlatno' }],
}));
assert.match(ambiguousHtml, /Mapu zobrazíme pri prípadoch s bezpečne potvrdenou obcou alebo okresom/);
assert.doesNotMatch(ambiguousHtml, /class="markerLinks"/,
  'pri duplicitnom názve sa nesmie vytvoriť náhodný mapový bod');
assert.match(ambiguousHtml, /TEST – vizuálna kontrola, nezverejňovať/,
  'prípad ostane čitateľný aj bez bezpečného mapového bodu');
assert.equal(renderToStaticMarkup(React.createElement(ApprovedCaseMap, { cases: [] })), '');

const browserPath = process.env.ASTANA_HARNESS_BROWSER
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const evidenceDir = await mkdtemp(path.join(os.tmpdir(), 'astana-approved-map-'));
const keepEvidence = process.env.ASTANA_HARNESS_KEEP_MAP_SCREENSHOTS === '1';
process.on('exit', () => { if (!keepEvidence) rmSync(evidenceDir, { recursive: true, force: true }); });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const mapSvg = await readFile(path.join(projectRoot, 'public/assets/maps/slovakia-admin-3.svg'));
const style = await readFile(path.join(projectRoot, 'app/realizacie/approved-case-map.module.css'), 'utf8');
const photoSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480"><rect width="100%" height="100%" fill="#e7edf4"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="42" fill="#26364c">TEST PHOTO</text></svg>');
const testPhoto = await sharp(photoSvg).jpeg().toBuffer();
const blockedRequests = [];
const origin = 'http://127.0.0.1:4173';
let currentHtml = html;
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) {
    blockedRequests.push(url.origin);
    await route.abort();
    return;
  }
  if (url.pathname === '/') {
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: currentHtml });
    return;
  }
  if (url.pathname === '/assets/maps/slovakia-admin-3.svg') {
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: mapSvg });
    return;
  }
  if (url.pathname === `/api/realization-case-media/${photoId}/`
    && ['360', '720', '1080'].includes(url.searchParams.get('w') || '')) {
    await route.fulfill({ status: 200, contentType: 'image/jpeg', body: testPhoto });
    return;
  }
  await route.abort();
});

currentHtml = `<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif;color:#192945}${style}</style></head><body>${html}</body></html>`;
await page.goto(`${origin}/`);
await page.locator('.map > img').waitFor({ state: 'visible' });
await page.locator('.card > img').waitFor({ state: 'visible' });
assert.equal(await page.locator('.map > img').evaluate((img) => img.naturalWidth > 0), true, 'mapový podklad sa musí načítať');
assert.equal(await page.locator('.card > img').evaluate((img) => img.naturalWidth > 0), true, 'testovacia fotografia sa musí načítať');
assert.equal(await page.getByRole('heading', { name: 'Konkrétne práce, nie iba sľuby' }).count(), 1);
assert.equal(await page.locator('.markerLink').count(), 1, 'Poprad má mať jeden klikací bod');
const marker = page.locator('.markerLink').first();
assert.equal(await marker.getAttribute('href'), `#realizacia-${caseId}`);
assert.match(await marker.getAttribute('aria-label'), /Poprad.*zobraziť realizáciu/);
const markerBox = await marker.boundingBox();
assert.equal(markerBox?.width, 44, 'mapový bod musí mať prístupný dotykový cieľ');
assert.equal(markerBox?.height, 44, 'mapový bod musí mať prístupný dotykový cieľ');
assert.equal(await page.getByText(/Body zobrazujú približnú obec alebo okres/).count(), 1);
assert.deepEqual(blockedRequests, [], 'vizuálny test nesmie volať externé servery');

for (const width of [390, 1440]) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, `obsah nesmie horizontálne pretekať pri šírke ${width}px`);
  const centering = await page.evaluate(() => {
    const card = document.querySelector('.card').getBoundingClientRect();
    const section = document.querySelector('section').getBoundingClientRect();
    return Math.abs((card.left + card.width / 2) - (section.left + section.width / 2));
  });
  assert.ok(centering <= 2, `jediná realizácia musí byť vystredená pri šírke ${width}px (odchýlka ${centering}px)`);
  await page.screenshot({ path: path.join(evidenceDir, `approved-map-${width}-TEST.png`), fullPage: true });
}

await page.keyboard.press('Tab');
assert.equal(await marker.evaluate((element) => document.activeElement === element), true,
  'prvý mapový bod musí byť dosiahnuteľný klávesnicou');
assert.notEqual(await marker.evaluate((element) => getComputedStyle(element).outlineStyle), 'none',
  'klávesnicový fokus mapového bodu musí byť viditeľný');
await marker.click();
assert.equal(await page.evaluate(() => window.location.hash), `#realizacia-${caseId}`,
  'klik na bod musí prejsť na príslušnú realizáciu');
assert.equal(await page.locator(`#realizacia-${caseId}:target`).count(), 1,
  'cieľová karta sa musí zvýrazniť po navigácii');

const clusteredHtml = renderToStaticMarkup(React.createElement(ApprovedCaseMap, {
  cases: [testCase, {
    ...testCase,
    id: '6b064460-1b56-4638-9e38-3bb76c3dbb87',
    title: 'TEST – realizácia v Batizovciach, nezverejňovať',
    locality: 'Batizovce',
  }, {
    ...testCase,
    id: '7c175571-2c67-4749-8f49-4cc87d4ecc98',
    title: 'TEST – druhá realizácia v Poprade, nezverejňovať',
  }, {
    ...testCase,
    id: '4108b735-d914-4a48-a590-7f2780157a15',
    title: 'TEST – realizácia v Prešove, nezverejňovať',
    locality: 'Prešov',
  }, {
    ...testCase,
    id: '4d989a6c-3218-43be-96af-f2ac4e958817',
    title: 'TEST – druhá realizácia v Prešove, nezverejňovať',
    locality: 'Prešov',
  }, {
    ...testCase,
    id: '577130ee-b7fa-4010-a29a-af781ba05bf9',
    title: 'TEST – realizácia v Snine, nezverejňovať',
    locality: 'Snina',
  }, {
    ...testCase,
    id: 'd2f1f478-4b4e-4a5c-8a0d-19942104277b',
    title: 'TEST – druhá realizácia v Snine, nezverejňovať',
    locality: 'Snina',
  }],
}));
currentHtml = `<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif;color:#192945}${style}</style></head><body>${clusteredHtml}</body></html>`;
await page.goto(`${origin}/`);
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(await page.locator('.markerLink').count(), 2, 'každé zoskupenie musí mať jeden bezpečný dotykový cieľ');
assert.match(await page.locator('.markerLink').first().getAttribute('aria-label'), /5 realizácie v blízkych lokalitách/);
assert.equal(await page.locator('.markerCluster').count(), 2, 'test musí pokrývať západnejšie aj východné zoskupenia');
assert.equal(await page.locator('.clusterCaseList a').count(), 7, 'výber z bodu musí sprístupniť každý prípad v zoskupení');
await page.locator('.markerCluster > summary').first().focus();
await page.keyboard.press('Enter');
assert.equal(await page.locator('.markerCluster').first().getAttribute('open'), '', 'zoskupenie sa musí dať otvoriť klávesnicou');
await page.locator('.markerCluster > summary').nth(1).click();
assert.equal(await page.locator('.markerCluster[open]').count(), 1,
  'otvorenie východného bodu musí zatvoriť predchádzajúci výber, aby sa odkazy neprekrývali');
for (const width of [320, 390, 1440]) {
  await page.setViewportSize({ width, height: 844 });
  for (const clusterIndex of [0, 1]) {
    const summary = page.locator('.markerCluster > summary').nth(clusterIndex);
    await summary.click();
    assert.equal(await page.locator('.markerCluster[open]').count(), 1,
      `presne jeden výber sa smie prekrývať s kartou pri šírke ${width}px`);
    const popup = await page.locator('.clusterCaseList').nth(clusterIndex).evaluate((list) => {
      const rect = list.getBoundingClientRect();
      return { left: rect.left, right: rect.right, documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    assert.ok(popup.left >= 0 && popup.right <= width && popup.documentWidth <= width,
      `open cluster choices must fit the ${width}px viewport: ${JSON.stringify(popup)}`);
    assert.ok(popup.right - popup.left <= 260,
      `cluster menu must honor its max width: ${JSON.stringify(popup)}`);
    const targets = await page.locator('.clusterCaseList').nth(clusterIndex).locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    await summary.focus();
    for (const target of targets) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => ({
        href: document.activeElement?.getAttribute('href'),
        outline: getComputedStyle(document.activeElement).outlineStyle,
      }));
      assert.equal(focused.href, target, `keyboard focus must reach ${target} at ${width}px`);
      assert.notEqual(focused.outline, 'none', `keyboard focus must remain visible at ${width}px`);
    }
  }
}
await page.setViewportSize({ width: 390, height: 844 });
await page.locator('.markerCluster > summary').nth(1).focus();
const easternLinks = await page.locator('.clusterCaseList').nth(1).locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
assert.equal(easternLinks.length, 2, 'východný zhluk musí sprístupniť obe realizácie');
for (const target of easternLinks) {
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('href')), target,
    'východné odkazy musia byť dosiahnuteľné v poradí cez klávesnicu');
}
await page.keyboard.press('Enter');
assert.equal(await page.evaluate(() => window.location.hash), easternLinks[1],
  'Enter must open the selected eastern case from the exclusive cluster menu');
await page.screenshot({ path: path.join(evidenceDir, 'approved-map-cluster-390-TEST.png'), fullPage: true });

const twoCaseHtml = renderToStaticMarkup(React.createElement(ApprovedCaseMap, {
  cases: [testCase, {
    ...testCase,
    id: '6b064460-1b56-4638-9e38-3bb76c3dbb87',
    title: 'TEST – druhý prípad, nezverejňovať',
    locality: 'Košice',
  }],
}));
currentHtml = `<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif;color:#192945}${style}</style></head><body>${twoCaseHtml}</body></html>`;
await page.goto(`${origin}/`);
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(await page.locator('.card').count(), 2, 'mobilný test musí obsahovať presne dva prípady');
const mobileColumns = await page.locator('.cards').evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
assert.equal(mobileColumns, 1, 'dva prípady musia byť na mobile v jednom stĺpci');
const twoCardWidths = await page.locator('.card').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().width));
assert.ok(twoCardWidths.every((width) => width > 300), `mobilné karty majú mať čitateľnú šírku: ${twoCardWidths.join(', ')}`);
await page.screenshot({ path: path.join(evidenceDir, 'approved-map-two-cases-390-TEST.png'), fullPage: true });
assert.deepEqual(blockedRequests, [], 'žiadny scenár vizuálneho testu nesmie skúšať volať cudzie servery');

await context.close();
await browser.close();
if (!keepEvidence) await rm(evidenceDir, { recursive: true, force: true });
console.log(JSON.stringify({ status: 'PASS', widths: [320, 390, 1440], twoCasesAt390px: mobileColumns === 1, markerNavigation: true, clusteredMarkers: true, keyboardFocus: true, syntheticCase: true, externalRequests: blockedRequests.length, formsSubmitted: 0, evidenceDir: keepEvidence ? evidenceDir : 'temporary screenshots removed' }));
