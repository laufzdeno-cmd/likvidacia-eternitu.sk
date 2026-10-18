/**
 * Read-only browser acceptance for the public roofer coordination flow.
 * It never submits a form and blocks non-loopback browser requests.
 *
 * Run against a local production preview:
 *   ASTANA_VISUAL_ORIGIN=http://127.0.0.1:3105 node scripts/roofer-ecosystem-v4.visual.mjs
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, 'tmp', `roofer-ecosystem-v4-${Date.now()}`);
const origin = process.env.ASTANA_VISUAL_ORIGIN || 'http://127.0.0.1:3105';
const allowedOrigin = new URL(origin).origin;
const viewports = [
  { width: 320, height: 740 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 1440, height: 1000 },
];
const routes = [
  { name: 'home', path: '/' },
  { name: 'strechari', path: '/strechari/' },
];

const browserPath = [
  process.env.ASTANA_HARNESS_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((candidate) => candidate && existsSync(candidate));
assert.ok(browserPath, 'Vizuálny audit potrebuje lokálny Microsoft Edge alebo ASTANA_HARNESS_BROWSER.');

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: ['--no-first-run', '--disable-background-networking', '--disable-extensions'],
});
const results = [];
const failures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const externalRequests = [];
    const nonReadRequests = [];

    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('request', (request) => {
      if (!['GET', 'HEAD'].includes(request.method())) nonReadRequests.push(`${request.method()} ${request.url()}`);
    });
    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.protocol === 'data:' || requestUrl.protocol === 'blob:' || requestUrl.origin === allowedOrigin) {
        await route.continue();
        return;
      }
      externalRequests.push(requestUrl.href);
      await route.abort('blockedbyclient');
    });

    for (const route of routes) {
      const response = await page.goto(new URL(route.path, origin).href, { waitUntil: 'networkidle', timeout: 45_000 });
      assert.equal(response?.status(), 200, `${route.path} musí vrátiť 200 pri ${viewport.width}px`);
      assert.equal(await page.locator('h1').count(), 1, `${route.path} musí mať práve jeden H1`);
      assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0, `${route.path} nesmie mať Next.js error overlay`);

      const metrics = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const h1Rect = h1?.getBoundingClientRect();
        const primary = document.querySelector('main .button-primary');
        const primaryRect = primary?.getBoundingClientRect();
        return {
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          h1: h1Rect ? { width: h1Rect.width, height: h1Rect.height } : null,
          primary: primaryRect ? { left: primaryRect.left, right: primaryRect.right, width: primaryRect.width } : null,
        };
      });
      assert.ok(metrics.h1 && metrics.h1.width > 0 && metrics.h1.height > 0, `${route.path} musí mať viditeľný H1`);
      assert.ok(Math.max(metrics.documentWidth, metrics.bodyWidth) <= metrics.viewportWidth + 1,
        `${route.path} preteká horizontálne pri ${viewport.width}px: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.primary && metrics.primary.width > 0 && metrics.primary.left >= -1 && metrics.primary.right <= metrics.viewportWidth + 1,
        `${route.path} má orezané primárne CTA pri ${viewport.width}px: ${JSON.stringify(metrics)}`);

      if (route.name === 'home') {
        const rooferHelp = page.locator('section:has(#roofer-help-title)');
        await rooferHelp.scrollIntoViewIfNeeded();
        await rooferHelp.waitFor({ state: 'visible' });
        assert.match(await rooferHelp.innerText(), /Potrebujete po eternite aj novú strechu\?/);
        await page.locator('#dopyt').scrollIntoViewIfNeeded();
        await page.locator('select[name="roofer"]').selectOption({ label: 'Nemám strechára' });
        const recommendation = page.locator('#roofer-recommendation-field');
        await recommendation.waitFor({ state: 'visible' });
        assert.match(await recommendation.innerText(), /Chcem, aby mi ASTANA pomohla nájsť strechára v mojom regióne/);
      } else {
        await page.locator('.roofer-b2b-partner-kit').scrollIntoViewIfNeeded();
        const partnerSection = await page.locator('.roofer-b2b-partner-kit').innerText();
        assert.match(partnerSection, /Podklady pre schválených partnerov/i);
        assert.match(partnerSection, /Samotná registrácia neoprávňuje firmu používať označenie partnera ani logo ASTANA/);
        assert.equal(await page.locator('a[href^="/downloads/strechari/"]').count(), 0);
        assert.equal((await page.locator('body').innerText()).includes('Spolupracujeme s ASTANA'), false);
      }

      const screenshotPath = path.join(outputRoot, `${route.name}-${viewport.width}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled', caret: 'hide' });
      results.push({ route: route.path, viewport, screenshotPath, metrics });
    }

    if (pageErrors.length || consoleErrors.length || externalRequests.length || nonReadRequests.length) {
      failures.push({ viewport, pageErrors, consoleErrors, externalRequests, nonReadRequests });
    }
    await context.close();
  }

  assert.deepEqual(failures, [], `Prehliadačový audit našiel chyby alebo neželanú sieťovú aktivitu: ${JSON.stringify(failures)}`);
  const reportPath = path.join(outputRoot, 'report.json');
  await writeFile(reportPath, `${JSON.stringify({ result: 'PASS', origin, results }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ result: 'PASS', outputRoot, reportPath, screenshots: results.length, viewports: viewports.length }));
} finally {
  await browser.close();
}
