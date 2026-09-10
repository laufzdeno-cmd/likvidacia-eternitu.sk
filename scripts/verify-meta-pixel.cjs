const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

const base = process.env.META_TEST_URL || 'http://127.0.0.1:3050';
const pixelId = '1374474630885790';
const leadId = 'd6a31c99-2b07-465f-a7b3-8d4f0795d7dc';

async function metaCalls(page, eventName) {
  return page.evaluate((name) => {
    const queue = window.fbq?.queue || [];
    return queue
      .map((entry) => Array.from(entry))
      .filter((entry) => entry[0] === 'track' && entry[1] === name);
  }, eventName);
}

async function createContext(browser, choice, leadResponse = 'success') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (choice) {
    await context.addInitScript((stored) => {
      window.localStorage.setItem('astana_cookie_consent_v2', stored);
    }, choice);
  }

  let leadPosts = 0;
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === 'connect.facebook.net') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    }
    if (url.hostname.includes('facebook.com')) return route.abort();
    if (request.method() === 'POST' && url.pathname === '/api/lead/') {
      leadPosts += 1;
      if (leadResponse === 'error') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'Test server error' }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, leadId, orderId: 'META-TEST-1', conversionEligible: true }),
      });
    }
    if (request.method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    if (!request.url().startsWith(base)) return route.abort();
    return route.continue();
  });
  return { context, leadPosts: () => leadPosts };
}

async function fillValidForm(page) {
  await page.waitForFunction(() => document.querySelector('#lead-error-email'));
  for (const [id, value] of Object.entries({
    areaEstimate: '120',
    city: 'Poprad',
    fullName: 'Meta Browser Test',
    phone: '0900000000',
    email: 'meta@example.test',
  })) {
    await page.locator(`#${id}`).fill(value);
  }
  await page.locator('#materialType').selectOption({ index: 1 });
  await page.locator('#objectType').selectOption({ index: 1 });
  await page.locator('[name=gdpr]').check();
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = [];
  try {
    {
      const { context } = await createContext(browser, null);
      const page = await context.newPage();
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      assert.equal(await page.locator('#astana-meta-pixel').count(), 0);
      assert.equal((await metaCalls(page, 'PageView')).length, 0);
      await page.getByRole('button', { name: 'Prijať všetky' }).click();
      await page.waitForFunction(() => (window.fbq?.queue || []).some((entry) => entry[0] === 'track' && entry[1] === 'PageView'));
      const queue = await page.evaluate(() => window.fbq.queue.map((entry) => Array.from(entry)));
      assert.ok(queue.some((entry) => entry[0] === 'init' && entry[1] === pixelId));
      assert.equal((await metaCalls(page, 'PageView')).length, 1);
      report.push({ scenario: 'consent_then_pageview', pageViews: 1, result: 'PASS' });
      await context.close();
    }

    {
      const { context, leadPosts } = await createContext(browser, 'accepted');
      const page = await context.newPage();
      await page.goto(`${base}/postup/`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => (window.fbq?.queue || []).some((entry) => entry[0] === 'track' && entry[1] === 'PageView'));
      assert.equal((await metaCalls(page, 'PageView')).length, 1);
      assert.equal(leadPosts(), 0);
      report.push({ scenario: 'public_route_pageview', pageViews: 1, result: 'PASS' });
      await context.close();
    }

    {
      const { context, leadPosts } = await createContext(browser, 'accepted');
      const page = await context.newPage();
      await page.goto(`${base}/#dopyt`, { waitUntil: 'domcontentloaded' });
      await fillValidForm(page);
      await page.locator('.form-submit').click();
      await page.locator('.lead-form.is-submitted').waitFor();
      await page.locator('.lead-form').dispatchEvent('submit', { bubbles: true, cancelable: true });
      await page.waitForTimeout(100);
      const leads = await metaCalls(page, 'Lead');
      assert.equal(leadPosts(), 1);
      assert.equal(leads.length, 1);
      assert.equal(leads[0][3].eventID, leadId);
      report.push({ scenario: 'successful_lead', posts: 1, leadEvents: 1, sharedEventId: true, result: 'PASS' });
      await context.close();
    }

    {
      const { context, leadPosts } = await createContext(browser, 'accepted');
      const page = await context.newPage();
      await page.goto(`${base}/#dopyt`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#lead-error-email'));
      await page.locator('.form-submit').click();
      await page.locator('.form-status.is-error').waitFor();
      assert.equal(leadPosts(), 0);
      assert.equal((await metaCalls(page, 'Lead')).length, 0);
      report.push({ scenario: 'invalid_form', posts: 0, leadEvents: 0, result: 'PASS' });
      await context.close();
    }

    {
      const { context, leadPosts } = await createContext(browser, 'accepted', 'error');
      const page = await context.newPage();
      await page.goto(`${base}/#dopyt`, { waitUntil: 'domcontentloaded' });
      await fillValidForm(page);
      await page.locator('.form-submit').click();
      await page.locator('.form-status.is-error').waitFor();
      assert.equal(leadPosts(), 1);
      assert.equal((await metaCalls(page, 'Lead')).length, 0);
      report.push({ scenario: 'server_error', posts: 1, leadEvents: 0, result: 'PASS' });
      await context.close();
    }

    {
      const { context, leadPosts } = await createContext(browser, 'rejected');
      const page = await context.newPage();
      await page.goto(`${base}/#dopyt`, { waitUntil: 'domcontentloaded' });
      await fillValidForm(page);
      await page.locator('.form-submit').click();
      await page.waitForTimeout(1200);
      const submitState = await page.evaluate(() => ({
        submitted: document.querySelector('.lead-form')?.classList.contains('is-submitted'),
        status: document.querySelector('.form-status')?.textContent?.trim(),
      }));
      assert.equal(submitState.submitted, true, JSON.stringify({ submitState, leadPosts: leadPosts() }));
      assert.equal(leadPosts(), 1);
      assert.equal(await page.locator('#astana-meta-pixel').count(), 0);
      assert.equal((await metaCalls(page, 'PageView')).length, 0);
      assert.equal((await metaCalls(page, 'Lead')).length, 0);
      report.push({ scenario: 'consent_denied', pageViews: 0, leadEvents: 0, result: 'PASS' });
      await context.close();
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
