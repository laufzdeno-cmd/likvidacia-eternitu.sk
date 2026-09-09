const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// All writes and third-party traffic are intercepted. Never use a live lead endpoint.
const base = process.env.FORM_TEST_URL || 'http://127.0.0.1:3041';
const screenshots = process.env.FORM_SCREENSHOTS;
const report = [];
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const scenario of ['delayed', 'opera', 'double', 'server-error', 'timeout', 'invalid', 'ineligible', 'denied']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 },
        ...(scenario === 'opera' ? { userAgent: 'Mozilla/5.0 Chrome/132.0.0.0 Safari/537.36 OPR/117.0.0.0' } : {}) });
      await context.addInitScript(choice => localStorage.setItem('astana_cookie_consent_v2', choice), scenario === 'denied' ? 'rejected' : 'accepted');
      let posts = 0;
      let submittedBody = '';
      await context.route('**/*', async route => {
        const request = route.request();
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/lead/') {
          posts++;
          submittedBody = request.postData() || '';
          if (scenario === 'timeout') return;
          await new Promise(resolve => setTimeout(resolve, scenario === 'delayed' ? 5500 : 500));
          await route.fulfill({ status: scenario === 'server-error' ? 500 : 200, contentType: 'application/json',
            body: JSON.stringify(scenario === 'server-error' ? { ok: false, message: 'Test server error' } :
              { ok: true, leadId: 'local-mocked-lead', orderId: 'LOCAL-TEST', conversionEligible: scenario !== 'ineligible' }) }).catch(() => {});
          return;
        }
        if (request.method() !== 'GET' || !request.url().startsWith(base)) return route.fulfill({ status: 200, body: '{}' });
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto(base + '/#dopyt');
      await page.waitForFunction(() => document.querySelector('#lead-error-email'));
      if (scenario !== 'invalid') {
        for (const [id, value] of Object.entries({ areaEstimate: '120', city: 'Poprad', fullName: 'Local QA', phone: '0900000000', email: 'qa@example.invalid' })) {
          await page.locator('#' + id).fill(value);
        }
        await page.locator('#materialType').selectOption({ index: 1 });
        await page.locator('#objectType').selectOption({ index: 1 });
        await page.locator('[name=gdpr]').check();
        assert.equal(await page.locator('#areaEstimate').getAttribute('data-field-state'), 'valid');
      }
      const started = Date.now();
      await page.locator('.form-submit').click();
      if (scenario === 'double') await page.locator('.lead-form').dispatchEvent('submit', { bubbles: true, cancelable: true });
      if (scenario === 'delayed') {
        await page.waitForTimeout(4500);
        assert.equal(posts, 1);
        assert.equal(await page.locator('.lead-form.is-submitted').count(), 0);
      }
      if (['invalid', 'server-error', 'timeout'].includes(scenario)) {
        await page.locator('.form-status.is-error').waitFor({ timeout: 35000 });
        await page.waitForTimeout(350);
        assert.equal(posts, scenario === 'invalid' ? 0 : 1);
        if (scenario !== 'invalid') {
          assert.equal(await page.locator('#areaEstimate').inputValue(), '120');
          assert.equal(await page.locator('#email').inputValue(), 'qa@example.invalid');
          assert.ok(await page.evaluate(() => sessionStorage.getItem('astana_lead_submission_id_v1')));
        } else {
          assert.equal(await page.locator('#areaEstimate').getAttribute('aria-invalid'), 'true');
          assert.equal(await page.locator('#email').evaluate(e => getComputedStyle(e).borderColor), 'rgb(201, 42, 42)');
          assert.ok(await page.locator('#lead-error-gdpr').evaluate(e => e.getBoundingClientRect().width > 200));
        }
      } else {
        await page.locator('.lead-form.is-submitted').waitFor({ timeout: 15000 });
        assert.equal(posts, 1);
        assert.ok(submittedBody.includes('submissionId'));
        assert.ok(submittedBody.includes('120'));
        await page.locator('.lead-form').dispatchEvent('submit', { bubbles: true, cancelable: true });
        await page.waitForTimeout(100);
        assert.equal(posts, 1);
      }
      const ads = await page.evaluate(() => (window.dataLayer || []).filter(a => a[0] === 'event' && a[1] === 'conversion').length);
      assert.equal(ads, ['invalid', 'server-error', 'timeout', 'ineligible', 'denied'].includes(scenario) ? 0 : 1);
      report.push({ scenario, posts, ads, elapsedMs: Date.now() - started, result: 'PASS' });
      if (screenshots && scenario === 'invalid') await page.screenshot({ path: path.join(screenshots, 'mobile-errors.png') });
      await context.close();
    }
    const context = await browser.newContext();
    await context.addInitScript(() => localStorage.setItem('astana_cookie_consent_v2', 'rejected'));
    await context.route('**/*', route => route.request().method() !== 'GET' || !route.request().url().startsWith(base)
      ? route.fulfill({ status: 200, body: '{}' }) : route.continue());
    const page = await context.newPage();
    for (const width of [320, 360, 390, 412, 430, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.goto(base + '/#dopyt');
      await page.waitForTimeout(1500);
      const dimensions = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
        input: document.querySelector('#areaEstimate').getBoundingClientRect().height,
        form: document.querySelector('.lead-form').getBoundingClientRect().height }));
      assert.equal(dimensions.overflow, false);
      assert.ok(dimensions.input >= 50);
      report.push({ width, ...dimensions, result: 'PASS' });
      if (screenshots && [390, 1440].includes(width)) await page.screenshot({ path: path.join(screenshots, `form-${width}.png`) });
    }
    await context.close();
  } finally { await browser.close(); console.log(JSON.stringify(report, null, 2)); }
}
if (screenshots) fs.mkdirSync(screenshots, { recursive: true });
main().catch(error => { console.error(error); process.exitCode = 1; });
