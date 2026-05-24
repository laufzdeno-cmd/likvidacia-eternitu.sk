import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;
const resultDir = path.join(process.cwd(), 'test-results');
mkdirSync(resultDir, { recursive: true });

type StepResult = { name: string; ok: boolean; detail: string };
const results: StepResult[] = [];
const details: Record<string, boolean> = {};

function mark(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
}

async function snap(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({ path: path.join(resultDir, `${test.info().project.name}-${name}.png`) });
}

function field(page: import('@playwright/test').Page, name: string) {
  return page.locator(`[name="${name}"]`).first();
}

async function cleanupTestJobs(page: import('@playwright/test').Page) {
  await page.goto('/admin/zakazky/');
  for (let index = 0; index < 5; index += 1) {
    const row = page.locator('tr').filter({ hasText: 'Playwright Test' }).first();
    if (!(await row.isVisible().catch(() => false))) return;
    await row.getByRole('button', { name: /Zmazať|Odstrániť/i }).click();
    await page.waitForTimeout(1_000);
    await page.goto('/admin/zakazky/');
  }
}

async function workerRewardRows(page: import('@playwright/test').Page) {
  return page.locator('table').filter({ hasText: 'PRACOVNÍK' }).locator('tbody tr').evaluateAll((rows) =>
    rows.map((row) => {
      const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent || '');
      const reward = (row.querySelector('input[name^="workerReward_"]') as HTMLInputElement | null)?.value || '';
      return { name: cells[0], reward };
    }),
  );
}

async function login(page: import('@playwright/test').Page) {
  if (!email || !password) throw new Error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD');
  await page.goto('/admin/login/');
  await field(page, 'email').fill(email);
  await field(page, 'password').fill(password);
  await page.getByRole('button', { name: /prihlásiť/i }).click();
  await page.waitForURL(/\/admin\/(dopyty|dashboard|zakazky|$)/, { timeout: 15_000 });
}

test.describe.serial('ASTANA admin QA', () => {
  test('full admin flow', async ({ page, browserName }) => {
    try {
      await login(page);
      await expect(page.locator('body')).not.toContainText('error');
      await snap(page, '01-login-pass');
      mark('TEST 1  LOGIN', true, `login OK (${browserName})`);
    } catch (error) {
      await snap(page, '01-login-fail');
      mark('TEST 1  LOGIN', false, String(error));
      throw error;
    }

    try {
      await page.goto('/admin/dashboard/');
      await expect(page.locator('body')).toContainText(/Tržby/i);
      await expect(page.locator('body')).toContainText(/Zákaziek|Zákazky/i);
      await expect(page.locator('body')).toContainText(/Zisk/i);
      await expect(page.locator('svg').first()).toBeVisible();
      await expect(page.locator('form').filter({ hasText: /Tento mesiac|Minulý mesiac|Tento rok/ })).toBeVisible();
      await snap(page, '02-dashboard-pass');
      mark('TEST 2  DASHBOARD', true, 'dashboard obsahuje karty, graf a prepínač období');
    } catch (error) {
      await snap(page, '02-dashboard-fail');
      mark('TEST 2  DASHBOARD', false, String(error));
      throw error;
    }

    try {
      await page.goto('/admin/zakazky/nova/');
      await field(page, 'demolitionDate').fill('2025-03-15');
      await field(page, 'customerName').fill('Playwright Test');
      await field(page, 'location').fill('Košice');
      await field(page, 'm2').fill('210');
      await field(page, 'pricePerM2').fill('12');
      await page.locator('input[name="paymentType"][value="CASH"]').check();
      await page.locator('input[name="workType"][value="DEMONTAZ"]').check();
      for (const worker of ['Robo', 'Maťo', 'Miloš']) {
        await page.getByLabel(worker, { exact: true }).scrollIntoViewIfNeeded();
        await page.getByLabel(worker, { exact: true }).check();
      }
      await page.waitForTimeout(500);
      const body210 = await page.locator('body').innerText();
      const rewards210 = await workerRewardRows(page);
      details['Výpočet 210m²'] = /2\s?520/.test(body210);
      details['Robo 140€'] = rewards210.some((row) => /Robo/.test(row.name) && /140([,.]00)?/.test(row.reward));
      details['Maťo 105€'] = rewards210.some((row) => /Maťo/.test(row.name) && /105([,.]00)?/.test(row.reward));
      details['Miloš 105€'] = rewards210.some((row) => /Miloš/.test(row.name) && /105([,.]00)?/.test(row.reward));

      await field(page, 'm2').fill('200');
      await page.waitForTimeout(500);
      const rewards200 = await workerRewardRows(page);
      details['Zaokrúhľovanie 200m²'] =
        rewards200.some((row) => /Robo/.test(row.name) && /133/.test(row.reward)) &&
        rewards200.some((row) => /Maťo/.test(row.name) && /100/.test(row.reward)) &&
        rewards200.some((row) => /Miloš/.test(row.name) && /100/.test(row.reward));

      await field(page, 'm2').fill('210');
      await field(page, 'fuel').fill('45');
      await field(page, 'gloves').fill('12');
      await page.waitForTimeout(500);
      const bodyProfit = await page.locator('body').innerText();
      details['Hrubý zisk 2113€'] = /2\s?113|2113/.test(bodyProfit);
      await snap(page, '03-new-job-calculation-pass');
      await page.getByRole('button', { name: /^Uložiť$/ }).click();
      await page.waitForURL(/\/admin\/zakazky\/?$/, { timeout: 15_000 });
      await expect(page.locator('body')).toContainText('Playwright Test');
      details['Uloženie zákazky'] = true;
      await snap(page, '03-new-job-save-pass');
      mark('TEST 3  NOVÁ ZÁKAZKA', Object.values(details).every(Boolean), 'výpočty a uloženie overené');
      expect(Object.values(details).every(Boolean)).toBeTruthy();
    } catch (error) {
      await snap(page, '03-new-job-fail');
      mark('TEST 3  NOVÁ ZÁKAZKA', false, String(error));
      throw error;
    }

    try {
      await page.goto('/admin/zakazky/');
      await expect(page.locator('table').first()).toBeVisible();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('link', { name: /Export CSV/i }).click();
      await downloadPromise;
      await snap(page, '04-jobs-csv-pass');
      mark('TEST 4  ZOZNAM + CSV', true, 'tabuľka aj CSV download OK');
    } catch (error) {
      await snap(page, '04-jobs-csv-fail');
      mark('TEST 4  ZOZNAM + CSV', false, String(error));
      throw error;
    }

    try {
      await page.goto('/admin/rok/');
      await expect(page.locator('table').first()).toBeVisible();
      await expect(page.locator('body')).toContainText(/Jan|Január/i);
      await expect(page.locator('body')).toContainText(/SPOLU|Spolu/);
      await expect(page.locator('svg').first()).toBeVisible();
      await expect(page.locator('body')).toContainText(/2\s?520|2520/);
      await snap(page, '05-year-pass');
      mark('TEST 5  ROČNÝ PREHĽAD', true, 'ročný report obsahuje tabuľku, graf a marcovú zákazku');
    } catch (error) {
      await snap(page, '05-year-fail');
      mark('TEST 5  ROČNÝ PREHĽAD', false, String(error));
      throw error;
    }

    try {
      await page.goto('/admin/nastavenia/');
      const settingsInputs = await page.locator('input').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
      expect(settingsInputs).toContain('Robo');
      expect(settingsInputs.some((value) => /2|2\.00|2,00/.test(value))).toBeTruthy();
      expect(settingsInputs).toContain('Maťo');
      expect(settingsInputs.some((value) => /1\.5|1,5|1\.50|1,50/.test(value))).toBeTruthy();
      await expect(page.locator('body')).toContainText(/Skládky|Ceny skládok/);
      await snap(page, '06-settings-pass');
      mark('TEST 6  NASTAVENIA', true, 'pracovníci a skládky OK');
    } catch (error) {
      await snap(page, '06-settings-fail');
      mark('TEST 6  NASTAVENIA', false, String(error));
      throw error;
    }

    try {
      await page.goto('/admin/import/');
      await expect(page.locator('input[type="file"]').first()).toBeVisible();
      await expect(page.getByRole('link', { name: /šablónu/i })).toBeVisible();
      await snap(page, '07-import-pass');
      mark('TEST 7  IMPORT', true, 'file input aj šablóna OK');
    } catch (error) {
      await snap(page, '07-import-fail');
      mark('TEST 7  IMPORT', false, String(error));
      throw error;
    }

    try {
      await page.goto('/recenzie/');
      await expect(page.locator('body')).toContainText(/Hodnotenia|Recenzie/);
      await snap(page, '08-public-reviews-pass');
      mark('TEST 8  VEREJNÉ RECENZIE', true, 'verejná stránka existuje');
    } catch (error) {
      await snap(page, '08-public-reviews-fail');
      mark('TEST 8  VEREJNÉ RECENZIE', false, String(error));
      throw error;
    }

    try {
      await page.goto('/admin/zakazky/');
      await expect(page.locator('tr').filter({ hasText: 'Playwright Test' }).first()).toBeVisible();
      await cleanupTestJobs(page);
      await expect(page.locator('body')).not.toContainText('Playwright Test');
      await snap(page, '09-cleanup-pass');
      mark('TEST 9  VYČISTENIE', true, 'testovacia zákazka zmazaná');
    } catch (error) {
      await snap(page, '09-cleanup-fail');
      mark('TEST 9  VYČISTENIE', false, String(error));
      throw error;
    }
  });

  test.afterAll(async ({ browser }) => {
    const version = browser.version();
    const now = new Date().toLocaleString('sk-SK');
    const passed = results.filter((item) => item.ok).length;
    const lines = [
      `ADMIN QA REPORT — ${now}`,
      `Browser version: ${version}`,
      ...results.map((item) => `${item.name.padEnd(28)} ${item.ok ? '✅' : '❌'} ${item.detail}`),
      `DETAIL Výpočet 210m²: ${details['Výpočet 210m²'] ? '✅' : '❌'}`,
      `DETAIL Robo 140€: ${details['Robo 140€'] ? '✅' : '❌'}`,
      `DETAIL Maťo 105€: ${details['Maťo 105€'] ? '✅' : '❌'}`,
      `DETAIL Miloš 105€: ${details['Miloš 105€'] ? '✅' : '❌'}`,
      `DETAIL Zaokrúhľovanie 200m²: ${details['Zaokrúhľovanie 200m²'] ? '✅' : '❌'}`,
      `DETAIL Uloženie zákazky: ${details['Uloženie zákazky'] ? '✅' : '❌'}`,
      `CELKOVO: ${passed}/9`,
    ];
    writeFileSync(path.join(resultDir, `admin-report-${test.info().project.name}.txt`), lines.join('\n'), 'utf8');
  });
});
