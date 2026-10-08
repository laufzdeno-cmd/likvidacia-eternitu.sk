/**
 * Isolated browser QA for the business finance panel.
 * Uses a temporary source copy without env files, an isolated local JSON DB,
 * synthetic records and a browser network guard. It never contacts production.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempParent = path.resolve(tmpdir());
const tempRoot = await mkdtemp(path.join(tempParent, 'astana-business-finance-browser-'));
const owner = randomUUID();
const adminEmail = 'finance-qa@local.test';
const secret = Buffer.from(randomUUID() + randomUUID()).toString('hex');
const customerName = `Finančná QA ${randomUUID()}`;
const outputDirectory = path.join(projectRoot, 'test-results');
const logs = [];
let browser, child;

async function freePort() {
  const { createServer } = await import('node:net');
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForApp(origin) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next exited early (${child.exitCode}): ${logs.join('').slice(-3500)}`);
    try {
      const response = await fetch(`${origin}/admin/zakazky/nova/`, { redirect: 'manual', signal: AbortSignal.timeout(1500) });
      if ([200, 307, 308].includes(response.status)) return;
    } catch { /* wait for the isolated server */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Next did not start within 90 seconds: ${logs.join('').slice(-3500)}`);
}

async function stopChild(processHandle) {
  if (!processHandle || processHandle.exitCode !== null || processHandle.signalCode !== null) return;
  const waitForExit = (milliseconds) => Promise.race([
    new Promise((resolve) => processHandle.once('exit', () => resolve(true))),
    new Promise((resolve) => { const timer = setTimeout(() => resolve(false), milliseconds); timer.unref(); }),
  ]);
  processHandle.kill('SIGTERM');
  if (await waitForExit(5000) || processHandle.exitCode !== null || processHandle.signalCode !== null) return;
  processHandle.kill('SIGKILL');
  if (!(await waitForExit(5000))) throw new Error(`Owned local Next process ${processHandle.pid} did not exit.`);
}

function sessionCookie() {
  const payload = Buffer.from(JSON.stringify({ email: adminEmail, iat: Date.now() })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

try {
  await writeFile(path.join(tempRoot, '.harness-owner'), owner, { flag: 'wx' });
  for (const name of ['app', 'src', 'public']) {
    await cp(path.join(projectRoot, name), path.join(tempRoot, name), {
      recursive: true,
      filter: (entry) => !/^\.env(?:\.|$)/.test(path.basename(entry)),
    });
  }
  for (const name of ['package.json', 'next.config.mjs', 'tsconfig.json', 'proxy.ts']) {
    await cp(path.join(projectRoot, name), path.join(tempRoot, name));
  }
  await symlink(await realpath(path.join(projectRoot, 'node_modules')), path.join(tempRoot, 'node_modules'), 'junction');
  await mkdir(outputDirectory, { recursive: true });

  const { chromium } = await import('@playwright/test');
  const appPort = await freePort();
  const origin = `http://127.0.0.1:${appPort}`;
  const localDbPath = path.join(tempRoot, 'finance-browser-local-db.json');

  const childEnv = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']
    .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  Object.assign(childEnv, {
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: localDbPath,
    AUTH_SECRET: secret, ADMIN_EMAIL: adminEmail, ALLOWED_ORIGINS: origin,
    TEMP: tempRoot, TMP: tempRoot, ASTANA_TEST_NETWORK_GUARD: '1',
    ASTANA_TEST_APP_ROOT: tempRoot, ASTANA_TEST_APP_PORT: String(appPort),
    NODE_OPTIONS: `--import=${pathToFileURL(path.join(projectRoot, 'scripts', 'test-loopback-network-guard.mjs')).href}`,
  });
  child = spawn(process.execPath, [path.join(projectRoot, 'scripts', 'testimonial-admin-form-server.mjs')],
    { cwd: tempRoot, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  await waitForApp(origin);

  const browserPath = process.env.ASTANA_HARNESS_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.ok(existsSync(browserPath), 'Edge is required; ASTANA_HARNESS_BROWSER may specify a local Chromium executable.');
  browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-first-run', '--disable-background-networking'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const deniedOrigins = [];
  await context.route('**/*', async (route) => {
    const target = new URL(route.request().url());
    if (target.origin === origin) return route.continue();
    deniedOrigins.push(target.origin);
    return route.abort('blockedbyclient');
  });
  await context.addCookies([{ name: 'astana_admin_session', value: sessionCookie(), url: origin, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });

  await page.goto(`${origin}/admin/zakazky/nova/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('input[name="demolitionDate"]').fill('2026-10-08');
  await page.locator('input[name="customerName"]').fill(customerName);
  await page.locator('input[name="location"]').fill('Poprad');
  await page.locator('input[name="m2"]').fill('120');
  await page.locator('input[name="pricePerM2"]').fill('12');
  await page.getByRole('button', { name: 'Uložiť', exact: true }).click();
  await page.waitForURL(/\/admin\/zakazky\/?$/, { timeout: 30_000 });
  const savedLocalDb = JSON.parse(await readFile(localDbPath, 'utf8'));
  const savedJobs = savedLocalDb.businessJobs.filter((job) => job.customerName === customerName);
  assert.equal(savedJobs.length, 1, 'synthetic job must be saved exactly once');
  const detailUrl = `${origin}/admin/zakazky/${savedJobs[0].id}/`;
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.equal(page.url(), detailUrl, 'isolated job detail must remain on its protected local route');
  await page.getByRole('heading', { name: 'Faktúry a prijaté úhrady', exact: true }).waitFor();

  const panel = page.locator('.admin-finance-card');
  await assert.doesNotReject(() => panel.getByText('Finančné údaje: neevidované', { exact: true }).waitFor());
  assert.match(await panel.innerText(), /skutočne vystavený doklad a skutočne prijatú úhradu/i);
  assert.equal(await panel.getByRole('heading', { name: 'Zaevidovať vystavenú faktúru', exact: true }).count(), 1);
  assert.equal(await panel.getByRole('heading', { name: 'Zaevidovať prijatú úhradu', exact: true }).count(), 1);

  const invoiceForm = panel.locator('form.admin-finance-form').first();
  await invoiceForm.locator('input[name="invoiceNumber"]').fill('QA-LOSS-001');
  await invoiceForm.locator('input[name="amountWithoutVat"]').fill('1,234');
  await invoiceForm.getByRole('button', { name: 'Zaevidovať vystavenú faktúru', exact: true }).click();
  await panel.getByText('Suma bez DPH musí byť suma s najviac dvoma desatinnými miestami.', { exact: true }).waitFor({ timeout: 30_000 });
  assert.equal(await invoiceForm.locator('input[name="invoiceNumber"]').inputValue(), 'QA-LOSS-001', 'invalid invoice must retain its number');
  assert.equal(await invoiceForm.locator('input[name="amountWithoutVat"]').inputValue(), '1,234', 'invalid invoice must retain the entered amount');
  await invoiceForm.locator('input[name="amountWithoutVat"]').fill('1000,00');
  await invoiceForm.getByRole('button', { name: 'Zaevidovať vystavenú faktúru', exact: true }).click();
  await panel.getByText('Vystavená faktúra bola zaevidovaná.', { exact: true }).waitFor({ timeout: 30_000 });
  await page.getByRole('heading', { name: 'História faktúr', exact: true }).waitFor();
  const desktopInvoiceHistory = panel.locator('.admin-finance-history-table').first();
  assert.equal(await desktopInvoiceHistory.isVisible(), true, 'desktop must present the full invoice evidence table');
  assert.equal(await panel.locator('.admin-finance-history-cards').first().isVisible(), false, 'desktop must not duplicate mobile cards visually');
  assert.match(await desktopInvoiceHistory.innerText(), /Neuhradená/);
  assert.match(await desktopInvoiceHistory.innerText(), /Prijaté/i);
  assert.match(await desktopInvoiceHistory.innerText(), /Zostáva/i);
  let invoicedLocalDb = JSON.parse(await readFile(localDbPath, 'utf8'));
  assert.equal(invoicedLocalDb.businessJobInvoices.filter((invoice) => invoice.invoiceNumber === 'QA-LOSS-001').length, 1);

  await invoiceForm.locator('input[name="invoiceNumber"]').fill('QA-LOSS-001');
  await invoiceForm.locator('input[name="amountWithoutVat"]').fill('50,00');
  await invoiceForm.getByRole('button', { name: 'Zaevidovať vystavenú faktúru', exact: true }).click();
  await panel.getByText('Faktúra s týmto číslom je už evidovaná.', { exact: true }).waitFor({ timeout: 30_000 });
  assert.equal(await invoiceForm.locator('input[name="invoiceNumber"]').inputValue(), 'QA-LOSS-001', 'duplicate invoice must retain its number');
  assert.equal(await invoiceForm.locator('input[name="amountWithoutVat"]').inputValue(), '50,00', 'duplicate invoice must retain its amount');
  await invoiceForm.locator('input[name="invoiceNumber"]').fill('QA-2026-002');
  await invoiceForm.getByRole('button', { name: 'Zaevidovať vystavenú faktúru', exact: true }).click();
  await panel.getByText('Vystavená faktúra bola zaevidovaná.', { exact: true }).waitFor({ timeout: 30_000 });

  const paymentForm = panel.locator('form.admin-finance-form').nth(1);
  await paymentForm.locator('select[name="invoiceId"]').selectOption({ index: 1 });
  await paymentForm.locator('input[name="amount"]').fill('1,234');
  await paymentForm.locator('input[name="reference"]').fill('QA-PAY-RETAIN');
  await paymentForm.getByRole('button', { name: 'Zaevidovať prijatú úhradu', exact: true }).click();
  await panel.getByText('Prijatá suma musí byť suma s najviac dvoma desatinnými miestami.', { exact: true }).waitFor({ timeout: 30_000 });
  assert.notEqual(await paymentForm.locator('select[name="invoiceId"]').inputValue(), '', 'invalid payment must retain the selected invoice');
  assert.equal(await paymentForm.locator('input[name="amount"]').inputValue(), '1,234', 'invalid payment must retain its amount');
  assert.equal(await paymentForm.locator('input[name="reference"]').inputValue(), 'QA-PAY-RETAIN', 'invalid payment must retain its reference');
  await paymentForm.locator('input[name="amount"]').fill('123,45');
  await paymentForm.getByRole('button', { name: 'Zaevidovať prijatú úhradu', exact: true }).click();
  await panel.getByText('Prijatá úhrada bola zaevidovaná.', { exact: true }).waitFor({ timeout: 30_000 });
  invoicedLocalDb = JSON.parse(await readFile(localDbPath, 'utf8'));
  assert.equal(invoicedLocalDb.businessJobInvoices.filter((invoice) => invoice.invoiceNumber.startsWith('QA-')).length, 2, 'retry must create exactly two unique invoices');
  assert.equal(invoicedLocalDb.businessJobPaymentEvents.filter((event) => event.reference === 'QA-PAY-RETAIN').length, 1, 'payment retry must create one receipt');

  const overflowDesktop = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflowDesktop <= 1, `desktop admin overflows horizontally by ${overflowDesktop}px`);
  await page.screenshot({ path: path.join(outputDirectory, 'business-finance-desktop.png'), fullPage: true, caret: 'initial' });
  await panel.screenshot({ path: path.join(outputDirectory, 'business-finance-desktop-panel.png'), caret: 'initial' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Faktúry a prijaté úhrady', exact: true }).waitFor();
  const mobilePanel = page.locator('.admin-finance-card');
  assert.equal(await mobilePanel.locator('.admin-finance-history-table').first().isVisible(), false, 'mobile must hide the wide invoice table');
  const mobileInvoiceCards = mobilePanel.locator('.admin-finance-history-cards').first();
  assert.equal(await mobileInvoiceCards.isVisible(), true, 'mobile must show readable invoice cards');
  assert.match(await mobileInvoiceCards.innerText(), /QA-LOSS-001/);
  assert.match(await mobileInvoiceCards.innerText(), /QA-2026-002/);
  assert.match(await mobileInvoiceCards.innerText(), /Čiastočne uhradená|Neuhradená/);
  assert.match(await mobileInvoiceCards.innerText(), /Prijaté/i);
  assert.match(await mobileInvoiceCards.innerText(), /Zostáva/i);
  const overflowMobile = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflowMobile <= 1, `mobile admin overflows horizontally by ${overflowMobile}px`);
  await page.screenshot({ path: path.join(outputDirectory, 'business-finance-mobile.png'), fullPage: true, caret: 'initial' });
  await mobilePanel.screenshot({ path: path.join(outputDirectory, 'business-finance-mobile-panel.png'), caret: 'initial' });
  assert.equal(deniedOrigins.length, 0, `browser attempted external requests: ${deniedOrigins.join(', ')}`);
  assert.deepEqual(browserErrors, [], `browser reported runtime errors: ${browserErrors.join(' | ')}`);
  console.log(JSON.stringify({ result: 'PASS', invoiceRows: 2, paymentRows: 1, retainedValidationValues: true, desktopOverflow: overflowDesktop, mobileOverflow: overflowMobile, browserExternalOrigins: deniedOrigins.length, browserErrors: browserErrors.length }));
} catch (error) {
  console.error('Isolated finance browser QA failed:', error.message);
  console.error('Local Next diagnostics:', logs.join('').slice(-4500));
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(child);
  const marker = await readFile(path.join(tempRoot, '.harness-owner'), 'utf8').catch(() => '');
  const resolvedRoot = path.resolve(tempRoot);
  assert.equal(path.dirname(resolvedRoot).toLowerCase(), tempParent.toLowerCase());
  assert.match(path.basename(resolvedRoot), /^astana-business-finance-browser-[A-Za-z0-9]+$/);
  assert.equal(marker, owner);
  const dependencyLink = path.join(tempRoot, 'node_modules');
  if ((await lstat(dependencyLink).catch(() => null))?.isSymbolicLink()) await unlink(dependencyLink);
  await rm(tempRoot, { recursive: true });
  console.log(`Cleanup PASS: owned temp root removed: ${tempRoot}`);
}
