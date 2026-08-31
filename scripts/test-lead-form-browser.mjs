import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const DELAY_MS = 5_500;
const OBSERVATION_MS = 4_500;
const LOCAL_API_WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BLOCKED_TEST_ENV_KEY = /^(?:SMTP_|MAIL_|FROM_EMAIL$|LEAD_TO_EMAIL$|ADMIN_BASE_URL$|S3_|AWS_|BLOB_READ_WRITE_TOKEN$|META_|NEXT_PUBLIC_META_|FACEBOOK_|FB_|RESEND_|SENDGRID_|POSTMARK_)/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  if (!address || typeof address === 'string') throw new Error('Nepodarilo sa vybrať lokálny port pre browser test.');
  return address.port;
}

async function waitForServer(baseUrl, processHandle) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Lokálny Next server skončil s kódom ${processHandle.exitCode}.`);
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' });
      if (response.ok) return;
    } catch {
      // Server ešte štartuje.
    }
    await sleep(500);
  }
  throw new Error('Lokálny Next server neodpovedal do 60 sekúnd.');
}

function stopProcess(processHandle) {
  if (processHandle.exitCode !== null) return;
  if (process.platform === 'win32' && processHandle.pid) {
    try {
      execFileSync('taskkill', ['/pid', String(processHandle.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    } catch {
      // Nižšie zostáva prenosný fallback.
    }
  }
  processHandle.kill('SIGTERM');
}

function createIsolatedTestEnvironment(tempDirectory, baseUrl) {
  const environment = { ...process.env };

  for (const key of Object.keys(environment)) {
    if (BLOCKED_TEST_ENV_KEY.test(key)) delete environment[key];
  }

  const remainingSensitiveKeys = Object.keys(environment).filter((key) => BLOCKED_TEST_ENV_KEY.test(key));
  assert.deepEqual(remainingSensitiveKeys, [], `Browser test nesmie zdediť produkčné credentials: ${remainingSensitiveKeys.join(', ')}`);

  return {
    ...environment,
    DATABASE_URL: '',
    ASTANA_LOCAL_DB_PATH: path.join(tempDirectory, 'local-db.json'),
    ALLOWED_ORIGINS: baseUrl,
    NEXT_PUBLIC_SITE_URL: baseUrl,
    NODE_ENV: 'development',
  };
}

async function main() {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'astana-lead-browser-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const devCommand = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const devArguments = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm.cmd run dev -- --hostname 127.0.0.1 --port ${port}`]
    : ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)];
  const testEnvironment = createIsolatedTestEnvironment(tempDirectory, baseUrl);
  const server = spawn(devCommand, devArguments, {
    cwd: process.cwd(),
    env: testEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let browser;
  try {
    await waitForServer(baseUrl, server);
    browser = await chromium.launch({
      channel: process.env.P1A_BROWSER_CHANNEL || 'chrome',
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      // Klient už nemá Opera špeciálnu odosielaciu cestu. Tento UA test overuje,
      // že pri Opera označení zostáva rovnaký bezpečný AJAX tok.
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 OPR/115.0',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const analyticsPath = '/api/analytics/';
      const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
      const nativeFetch = window.fetch.bind(window);
      const originalSendBeacon = navigator.sendBeacon?.bind(navigator);

      window.__p1aMockedAnalyticsWrites = [];

      Object.defineProperty(navigator, 'sendBeacon', {
        configurable: true,
        value(url, data) {
          const target = new URL(String(url), window.location.href);
          if (target.origin === window.location.origin && target.pathname === analyticsPath) {
            window.__p1aMockedAnalyticsWrites.push(`POST ${target.pathname}`);
            return true;
          }
          return originalSendBeacon ? originalSendBeacon(url, data) : false;
        },
      });

      window.fetch = async (input, init) => {
        const target = new URL(typeof input === 'string' ? input : input.url, window.location.href);
        const method = (init?.method || (typeof input === 'string' ? 'GET' : input.method) || 'GET').toUpperCase();
        if (target.origin === window.location.origin && target.pathname === analyticsPath && writeMethods.has(method)) {
          window.__p1aMockedAnalyticsWrites.push(`${method} ${target.pathname}`);
          return new Response(null, { status: 204 });
        }
        return nativeFetch(input, init);
      };
    });
    const externalRequests = [];
    const unexpectedApiWrites = [];
    const leadPostBodies = [];
    let mockedAnalyticsWrites = [];
    let postCount = 0;
    const requestId = randomUUID();

    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = request.url();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        await route.continue();
        return;
      }
      const parsedUrl = new URL(url);
      const origin = parsedUrl.origin;

      if (origin !== baseUrl) {
        externalRequests.push(url);
        await route.abort();
        return;
      }

      if ((parsedUrl.pathname === '/api/dopyt/' || parsedUrl.pathname === '/api/dopyt') && request.method() === 'POST') {
        postCount += 1;
        leadPostBodies.push(request.postData() || '');
        await sleep(DELAY_MS);
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            ok: true,
            leadId: `mock-${requestId}`,
            message: 'Dopyt sme prijali. Ozveme sa vám s ďalším postupom.',
          }),
        });
        return;
      }

      if (parsedUrl.pathname.startsWith('/api/') && LOCAL_API_WRITE_METHODS.has(request.method())) {
        unexpectedApiWrites.push(`${request.method()} ${parsedUrl.pathname}`);
        await route.abort('blockedbyclient');
        return;
      }

      await route.continue();
    });

    for (const [material, expectedValue] of [
      ['vlnity', 'Vlnitý eternit'],
      ['plocha', 'Hladký / štvorcový eternit'],
    ]) {
      await page.goto(`${baseUrl}/?material=${material}&utm_source=facebook&utm_medium=paid_social&utm_campaign=astana_meta_2026_08#dopyt`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('#materialType').inputValue(), expectedValue, `material=${material} musí predvyplniť zodpovedajúci typ azbestu.`);
      assert.match(page.url(), new RegExp(`material=${material}`), `material=${material} musí zostať v URL.`);
      assert.match(page.url(), /utm_source=facebook/, 'UTM parametre musia zostať v URL.');
    }

    await page.goto(`${baseUrl}/?material=vlnity#dopyt`, { waitUntil: 'networkidle' });
    await page.locator('.lead-form').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#areaEstimateStatus').count(), 0, 'Verejný formulár nesmie obsahovať zrušenú voľbu neznámej výmery.');
    assert.equal(await page.locator('#areaEstimate').getAttribute('required'), '', 'Približná výmera musí zostať povinná.');
    assert.equal(await page.getByText('Stačí približná výmera v m². Nemusí byť presná.', { exact: true }).count(), 1, 'Pri výmere musí zostať ľudská pomocná informácia.');
    await page.locator('#areaEstimate').fill('120');
    await page.locator('#city').fill('Testovacia obec');
    await page.locator('#district').fill('Poprad');
    await page.locator('#materialType').selectOption({ label: 'Vlnitý azbest / eternit' });
    await page.locator('#objectType').selectOption({ label: 'Rodinný dom' });
    await page.locator('#phone').fill('0905000000');
    await page.locator('#fullName').fill('QA Browser – nekontaktovať');
    await page.locator('#email').fill('qa-browser@example.test');
    await page.locator('input[name="gdpr"]').check();

    await page.locator('.lead-form button[type="submit"]').click();
    await sleep(OBSERVATION_MS);

    assert.equal(postCount, 1, 'Jeden klik počas oneskorenej odpovede nesmie vytvoriť druhý POST /api/dopyt/.');
    assert.equal(await page.locator('.lead-form').evaluate((form) => form.classList.contains('is-submitting')), true, 'Formulár musí počas čakania zostať zamknutý.');

    await page.locator('.lead-form.is-submitted').waitFor({ state: 'attached', timeout: DELAY_MS + 5_000 });
    assert.equal(postCount, 1, 'Po úspešnej oneskorenej odpovedi musí celkovo existovať presne jeden POST /api/dopyt/.');
    assert.match(
      leadPostBodies[0] || '',
      /name="submissionId"\r?\n\r?\n[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
      'Opera UA odoslanie musí niesť platný stabilný submissionId.',
    );
    assert.match(await page.locator('.form-status').innerText(), /Dopyt sme prijali/i, 'Používateľ musí vidieť úspešné potvrdenie.');
    mockedAnalyticsWrites = await page.evaluate(() => window.__p1aMockedAnalyticsWrites || []);
    assert.deepEqual(externalRequests, [], `Browser test nesmie volať externé ani produkčné URL: ${externalRequests.join(', ')}`);
    assert.deepEqual(unexpectedApiWrites, [], `Browser test nesmie pustiť iný lokálny write request na /api/*: ${unexpectedApiWrites.join(', ')}`);
    assert.ok(mockedAnalyticsWrites.every((entry) => entry === 'POST /api/analytics/'), `Povolený je iba explicitne mockovaný analytický zápis: ${mockedAnalyticsWrites.join(', ')}`);

    console.log(`PASS: 1 klik -> 1 mockovaný POST /api/dopyt/ po ${DELAY_MS / 1000} s bez DB, SMTP alebo produkčného requestu.`);
    await context.close();
  } finally {
    await browser?.close();
    stopProcess(server);
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
