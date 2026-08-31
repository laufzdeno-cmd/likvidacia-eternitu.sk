import assert from 'node:assert/strict';
import { chromium } from 'playwright';

async function main() {
  const url = process.env.ASTANA_E2E_URL || 'http://localhost:3107/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.lead-form').waitFor();
    await page.locator('.lead-form').scrollIntoViewIfNeeded();

    assert.equal(await page.locator('body').innerText().then((text) => text.trim().length > 0), true);
    assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0);
    assert.equal(await page.getByText('Doprava nad 100 m2 zdarma', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Odpovieme do 24h', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Vlnitý azbest / eternit', { exact: true }).count() > 0, true);
    assert.equal(await page.getByText('Plochý azbest / eternitové kosoštvorce', { exact: true }).count() > 0, true);

    const areaInput = page.locator('#areaEstimate');
    const unknownToggle = page.locator('#areaEstimateStatus');
    assert.equal(await areaInput.getAttribute('required'), '');
    assert.equal(await areaInput.isDisabled(), false);
    await unknownToggle.check();
    assert.equal(await areaInput.getAttribute('required'), null);
    assert.equal(await areaInput.isDisabled(), true);
    assert.equal(await unknownToggle.isChecked(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: mobile render, V5 copy, no error overlay, and lead_area_unknown interaction');
  } finally {
    await browser.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
