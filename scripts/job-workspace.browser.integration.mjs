/**
 * Isolated browser QA for the operational job workspace and its private print view.
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
const tempRoot = await mkdtemp(path.join(tempParent, 'astana-job-workspace-browser-'));
const owner = randomUUID();
const adminEmail = 'workspace-qa@local.test';
const operatorEmail = 'workspace-operator@local.test';
const secret = Buffer.from(randomUUID() + randomUUID()).toString('hex');
const customerName = `Pracovná QA ${randomUUID()}`;
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

function sessionCookie(email = adminEmail) {
  const payload = Buffer.from(JSON.stringify({ kind: 'admin-session', email, iat: Date.now(), epoch: 0 })).toString('base64url');
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
  savedLocalDb.adminUsers.push({ id: randomUUID(), email: operatorEmail, name: 'Operátor QA', role: 'OPERATOR', active: true, passwordHash: '', twoFactorSecret: '', twoFactorEnabled: false, twoFactorBackupCodeHashes: [], sessionEpoch: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await writeFile(localDbPath, JSON.stringify(savedLocalDb));
  const detailUrl = `${origin}/admin/zakazky/${savedJobs[0].id}/`;
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.equal(page.url(), detailUrl, 'isolated job detail must remain on its protected local route');
  await page.getByRole('heading', { name: 'Faktúry a prijaté úhrady', exact: true }).waitFor();

  const workspace = page.locator('#pracovna-karta');
  await workspace.getByRole('heading', { name: /Pracovná karta/ }).waitFor();
  await workspace.locator('form[data-workspace-ready="true"]').waitFor();
  await workspace.getByLabel('Zodpovedná osoba za zákazku').selectOption(operatorEmail);
  await workspace.getByRole('link', { name: 'Materiály', exact: true }).click();
  await workspace.getByRole('button', { name: '+ Pridať materiál', exact: true }).click();
  await workspace.getByRole('button', { name: '+ Pridať materiál', exact: true }).click();
  const materials = workspace.locator('article').filter({ has: page.getByRole('button', { name: 'Odobrať', exact: true }) });
  await materials.nth(0).getByLabel('Typ materiálu').selectOption('VLNITY_ETERNIT');
  await materials.nth(0).getByLabel('Plán množstva (m²)', { exact: true }).fill('125');
  await materials.nth(0).getByLabel('Plán hmotnosti (kg)', { exact: true }).fill('1500');
  await materials.nth(1).getByLabel('Typ materiálu').selectOption('AZBESTOVE_RURY');
  await materials.nth(1).getByLabel('Jednotka').selectOption('M');
  await materials.nth(1).getByLabel('Plán množstva (m)', { exact: true }).fill('12');
  await workspace.getByRole('link', { name: 'Plánovanie', exact: true }).click();
  await workspace.getByLabel('Predbežný deň', { exact: true }).fill('2026-11-03');
  await workspace.getByLabel('Plánovaný počet ľudí', { exact: true }).fill('3');
  await workspace.getByLabel('Plánovaný počet áut', { exact: true }).fill('2');
  await workspace.getByLabel('Vozidlá – označenia alebo ŠPZ, oddelené čiarkou', { exact: true }).fill('QA-1, QA-2');
  await workspace.getByRole('button', { name: 'Uložiť pracovnú kartu', exact: true }).click();
  await workspace.getByText(/Pracovná karta je uložená/).waitFor({ timeout: 30000 });
  let state = JSON.parse(await readFile(localDbPath, 'utf8'));
  let saved = state.jobWorkspace.cards.find((card) => card.jobId === savedJobs[0].id);
  assert.equal(saved.revision, 1);
  assert.equal(saved.operations.materials.length, 2);
  assert.equal(saved.operations.materials[1].plannedKg, null, 'unknown weight remains null');
  assert.deepEqual(saved.operations.plan.vehicleIds, ['QA-1', 'QA-2']);
  assert.equal(saved.operations.plan.tentativeOn, '2026-11-03');
  assert.equal(saved.operations.plan.agreedOn, null);
  assert.equal(saved.operations.plan.actualOn, null);
  assert.equal(state.businessJobs.find((job) => job.id === savedJobs[0].id).demolitionDate, '2026-10-08', 'tentative plan must not rewrite the actual legacy day');
  assert.equal(state.jobWorkspace.notices.length, 0, 'saving alone must never prepare or send a customer notice');

  const PDFDocument = (await import('pdfkit')).default;
  const pdf = new PDFDocument(); const pdfChunks = [];
  const pdfDone = new Promise((resolve) => { pdf.on('data', (chunk) => pdfChunks.push(chunk)); pdf.on('end', resolve); });
  pdf.text('ASTANA QA authority document - synthetic local test only.'); pdf.end(); await pdfDone;
  const pdfBytes = Buffer.concat(pdfChunks);
  const filesPanel = workspace.locator('#karta-fotky');
  await workspace.getByRole('link', { name: 'Fotky', exact: true }).click();
  await filesPanel.getByLabel('Pridať PDF podklady / rozhodnutie úradu', { exact: true }).setInputFiles({ name: 'qa-authority.pdf', mimeType: 'application/pdf', buffer: pdfBytes });
  await filesPanel.getByText('Súkromne uložené súbory: 1. Na webe sa nezverejnili.', { exact: true }).waitFor({ timeout: 30000 });
  const sharp = (await import('sharp')).default;
  const photoBytes = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#218468' } }).jpeg().toBuffer();
  await filesPanel.getByLabel('Pridať súkromné fotky', { exact: true }).setInputFiles({ name: 'qa-photo.jpg', mimeType: 'image/jpeg', buffer: photoBytes });
  await filesPanel.locator('img').waitFor({ timeout: 30000 });
  state = JSON.parse(await readFile(localDbPath, 'utf8'));
  const privatePdf = state.jobWorkspace.documents.find((document) => document.jobId === savedJobs[0].id && document.kind === 'AUTHORITY');
  const privatePhoto = state.jobWorkspace.documents.find((document) => document.jobId === savedJobs[0].id && document.kind === 'PHOTO');
  assert.ok(privatePdf && privatePhoto);
  const pdfResponse = await context.request.get(`${origin}/api/admin/job-workspace/documents/${privatePdf.id}/`);
  assert.equal(pdfResponse.status(), 200);
  assert.deepEqual(await pdfResponse.body(), pdfBytes, 'private original PDF must remain byte-identical');
  const imageResponse = await context.request.get(`${origin}/api/admin/job-workspace/documents/${privatePhoto.id}/`);
  assert.equal(imageResponse.status(), 200);
  assert.match(imageResponse.headers()['content-type'], /image\/webp/);
  const anonymous = await browser.newContext();
  const deniedPrivateDocument = await anonymous.request.get(`${origin}/api/admin/job-workspace/documents/${privatePdf.id}/`);
  assert.ok([401, 403, 404].includes(deniedPrivateDocument.status()), 'private PDF must not be accessible anonymously');
  await anonymous.close();
  await workspace.getByRole('link', { name: 'Prehľad', exact: true }).click();

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${width}px layout overflows by ${overflow}px`);
    const topSearch = page.locator('.admin-topbar').getByRole('search');
    assert.equal(await topSearch.isVisible(), true, 'global search must be visible at every tested width');
    await workspace.screenshot({ path: path.join(outputDirectory, `job-workspace-${width}.png`) });
    await workspace.locator('header').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(outputDirectory, `job-workspace-${width}-viewport.png`) });
    await workspace.locator('#karta-prehlad').screenshot({ path: path.join(outputDirectory, `job-workspace-${width}-overview.png`) });
  }
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => { document.body.dataset.astanaCrewPrint = 'true'; });
  assert.equal(await page.getByRole('heading', { name: 'Faktúry a prijaté úhrady', exact: true }).isVisible(), false, 'crew print must hide finance even for superadmin');
  assert.equal(await page.getByRole('heading', { name: 'Pracovný prehľad pre posádku', exact: true }).isVisible(), true);
  await page.pdf({ path: path.join(outputDirectory, 'job-workspace-crew-print.pdf'), format: 'A4', printBackground: true });
  await page.evaluate(() => { delete document.body.dataset.astanaCrewPrint; });
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/admin/planovac/?zakazka=${savedJobs[0].id}&mesiac=2026-11`, { waitUntil: 'domcontentloaded' });
  assert.match(await page.locator('.planner-calendar').innerText(), /Predbežne/);
  await page.getByRole('heading', { name: /Príprava posádky/ }).waitFor();
  assert.equal(await page.getByLabel('Dátum', { exact: true }).inputValue(), '2026-11-03');

  state = JSON.parse(await readFile(localDbPath, 'utf8'));
  const operatorContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await operatorContext.route('**/*', async (route) => {
    const target = new URL(route.request().url());
    if (target.origin === origin) return route.continue();
    deniedOrigins.push(target.origin); return route.abort('blockedbyclient');
  });
  await operatorContext.addCookies([{ name: 'astana_admin_session', value: sessionCookie(operatorEmail), url: origin, httpOnly: true, sameSite: 'Lax' }]);
  const operatorPage = await operatorContext.newPage();
  operatorPage.on('pageerror', (error) => browserErrors.push(`operator pageerror: ${error.message}`));
  await operatorPage.goto(detailUrl, { waitUntil: 'domcontentloaded' });
  const operatorCard = operatorPage.locator('#pracovna-karta');
  await operatorCard.getByRole('heading', { name: /Pracovná karta/ }).waitFor();
  await operatorCard.locator('form[data-workspace-ready="true"]').waitFor();
  assert.equal(await operatorCard.getByText('Dohoda a skutočné vyúčtovanie', { exact: true }).count(), 0);
  assert.equal(await operatorPage.getByRole('heading', { name: 'Faktúry a prijaté úhrady', exact: true }).count(), 0);
  const submittedPatch = JSON.parse(await operatorCard.locator('input[name="workspace"]').inputValue());
  assert.equal('settlement' in submittedPatch, false, 'operator client payload must not contain settlement');
  await operatorCard.getByRole('link', { name: 'Plánovanie', exact: true }).click();
  await operatorCard.getByLabel('Prístup na miesto, obmedzenia a pokyny', { exact: true }).fill('Lokálna QA – voľný vjazd');
  await operatorCard.getByRole('button', { name: 'Uložiť pracovnú kartu', exact: true }).click();
  await operatorCard.getByText(/Pracovná karta je uložená/).waitFor({ timeout: 30000 });
  state = JSON.parse(await readFile(localDbPath, 'utf8'));
  saved = state.jobWorkspace.cards.find((card) => card.jobId === savedJobs[0].id);
  assert.equal(saved.revision, 2);
  assert.equal(saved.operations.plan.accessNote, 'Lokálna QA – voľný vjazd');
  assert.equal(saved.timeline.at(-1).actorEmail, operatorEmail);
  assert.equal(state.businessJobs.find((job) => job.id === savedJobs[0].id).pricePerM2, 12);

  // Import one original PDF, verify sending without SMTP, defer it and later accept it into exactly one job.
  const importedNumber = 'QA-IMPORT-2026-001';
  const offerPdf = new PDFDocument(); const offerChunks = [];
  const offerPdfDone = new Promise((resolve) => { offerPdf.on('data', (chunk) => offerChunks.push(chunk)); offerPdf.on('end', resolve); });
  offerPdf.text(`CP ${importedNumber}\nDatum vystavenia: 20.10.2026\nZakaznik: manual@example.invalid tel: +421 900 000 000\nDemontaz: 30 m2 x 100 EUR\nCelkom s DPH: 3690.00 EUR`);
  offerPdf.end(); await offerPdfDone;
  await page.goto(`${origin}/admin/ponuky/rucna/`, { waitUntil: 'networkidle' });
  const uploadedPdfResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().startsWith(`${origin}/api/admin/job-workspace/upload/`));
  await page.getByLabel('PDF do 3 MB', { exact: true }).setInputFiles({ name: 'qa-manual-offer.pdf', mimeType: 'application/pdf', buffer: Buffer.concat(offerChunks) });
  const uploadedPdf = await (await uploadedPdfResponse).json();
  assert.equal(uploadedPdf.extraction?.state, 'TEXT', `digital PDF runtime extraction failed: ${JSON.stringify(uploadedPdf.extraction)}`);
  assert.ok(uploadedPdf.extraction.suggestions.some((suggestion) => suggestion.field === 'originalNumber' && suggestion.value === importedNumber));
  await page.getByRole('button', { name: 'Preniesť návrhy do formulára', exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Preniesť návrhy do formulára', exact: true }).click();
  assert.equal(await page.getByLabel('Pôvodné číslo CP', { exact: true }).inputValue(), importedNumber);
  await page.getByLabel('Meno / firma', { exact: true }).fill('Ručná ponuka QA');
  await page.getByLabel('Adresa / miesto realizácie', { exact: true }).fill('Poprad, skúšobná zákazka');
  await page.getByLabel('Celkom bez DPH €', { exact: true }).fill('3000');
  await page.getByLabel('Celkom s DPH €', { exact: true }).fill('3690');
  await page.getByRole('button', { name: '+ Pridať položku', exact: true }).click();
  const itemForm = page.locator('fieldset').filter({ has: page.getByRole('button', { name: 'Odobrať položku', exact: true }) });
  await itemForm.getByLabel('Popis', { exact: true }).fill('Demontáž a odvoz eternitu');
  await itemForm.getByLabel('Jednotka', { exact: true }).fill('m²');
  await itemForm.getByLabel('Množstvo', { exact: true }).fill('30');
  await itemForm.getByLabel('Cena / jedn. bez DPH €', { exact: true }).fill('100');
  await itemForm.getByLabel('Položka bez DPH €', { exact: true }).fill('3000');
  await itemForm.getByLabel('DPH %', { exact: true }).fill('23');
  await page.getByRole('checkbox', { name: /Porovnal\/a som číslo/ }).check();
  await page.screenshot({ path: path.join(outputDirectory, 'job-manual-import-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(outputDirectory, 'job-manual-import-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Uložiť overenú PDF ponuku', exact: true }).click();
  await page.getByRole('link', { name: 'Otvoriť zaevidovanú ponuku →', exact: true }).click();
  await page.getByRole('heading', { name: `CP ${importedNumber}`, exact: true }).waitFor();
  await page.locator('input[name="sentOn"]').fill('2026-10-21');
  await page.locator('textarea[name="evidence"]').fill('QA lokálny dôkaz ručného odoslania zákazníkovi, bez nového mailu.');
  await page.locator('input[name="confirmSent"]').check();
  await page.getByRole('button', { name: 'Označiť ako odoslanú', exact: true }).click();
  await page.getByRole('heading', { name: 'Odloženie alebo odmietnutie', exact: true }).waitFor();
  await page.locator('textarea[name="reason"]').fill('Zákazník chce posunúť realizáciu na neskôr – lokálna QA.');
  await page.getByRole('button', { name: 'Uložiť výsledok', exact: true }).click();
  await page.getByText('Výsledok aj jeho dôvod sú uložené v histórii ponuky.', { exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('input[name="acceptedOn"]').fill('2026-10-23');
  await page.locator('select[name="responsibleEmail"]').selectOption(operatorEmail);
  await page.locator('input[name="confirmAccepted"]').check();
  const acceptedResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/admin/ponuky/rucna/'));
  await page.getByRole('button', { name: 'Potvrdiť a otvoriť zákazku', exact: true }).click();
  await acceptedResponse;
  await page.getByRole('link', { name: 'Otvoriť súvisiacu zákazku →', exact: true }).waitFor();
  state = JSON.parse(await readFile(localDbPath, 'utf8'));
  const importedOffer = state.jobWorkspace.manualOffers.find((offer) => offer.originalNumber === importedNumber);
  assert.equal(importedOffer.status, 'ACCEPTED', `acceptance failed: ${await page.locator('.admin-page').innerText()}`);
  assert.equal(importedOffer.items[0].quantity, 30);
  assert.ok(importedOffer.outcomeReason.includes('neskôr'));
  assert.equal(state.businessJobs.length, 2, 'manual acceptance must add exactly one job');
  const importedJob = state.businessJobs.find((job) => job.id === importedOffer.jobId);
  assert.equal(importedJob.demolitionDate, '', 'unknown actual day must not become today');
  assert.equal(importedJob.totalPrice, 3690, 'manual original total must be reflected in the canonical job');
  const importedWorkspace = state.jobWorkspace.cards.find((card) => card.jobId === importedOffer.jobId);
  assert.equal(importedWorkspace.operations.responsibleEmail, operatorEmail);
  assert.equal(importedWorkspace.settlement.agreedAmountWithVatCents, 369000);
  await page.getByRole('link', { name: 'Otvoriť súvisiacu zákazku →', exact: true }).click();
  await page.locator('#pracovna-karta').getByRole('heading', { name: /Pracovná karta/ }).waitFor();
  assert.match(await page.locator('.admin-page').innerText(), /3\s?690/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const topSearchForm = page.locator('.admin-topbar').getByRole('search');
  await topSearchForm.getByLabel('Nájsť zákazku alebo ponuku', { exact: true }).fill('QA-IMPORT-2026-001 Poprad');
  await topSearchForm.getByRole('button', { name: 'Hľadať', exact: true }).click();
  const foundOffer = page.locator('.crm-top-search-results').getByRole('link').filter({ hasText: importedNumber });
  await foundOffer.waitFor();
  await page.screenshot({ path: path.join(outputDirectory, 'job-search-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(outputDirectory, 'job-search-mobile.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await foundOffer.click();
  await page.getByRole('heading', { name: `CP ${importedNumber}`, exact: true }).waitFor();
  const originalPdfHref = await page.getByRole('link', { name: 'Zobraziť pôvodné PDF →', exact: true }).getAttribute('href');
  assert.equal((await context.request.get(`${origin}${originalPdfHref}`)).status(), 200);

  // A synthetic staged Gmail record exercises private review without connecting to Google.
  const syntheticMessageId = randomUUID();
  await writeFile(`${localDbPath}.job-mail.json`, JSON.stringify({ configuration: { enabled: false, labelIds: [], since: '', maxMessages: 10, verificationAcknowledged: false, revision: 0, updatedAt: null, updatedBy: null }, pageTokens: {}, messages: [{ id: syntheticMessageId, messageId: 'qa-local-only', threadId: 'qa-local-thread', account: adminEmail, occurredAt: '2026-10-23T09:00:00.000Z', subject: `QA komunikácia k ${importedNumber}`, text: 'Syntetická skúška: objednávateľ potvrdzuje dohodu. Tento záznam nevznikol čítaním reálneho Gmailu.', sender: 'manual@example.invalid', recipients: [adminEmail], direction: 'INBOUND', pdfAttachments: [], importedAt: new Date().toISOString(), matches: [{ jobId: importedOffer.jobId, reasons: ['Zhoda čísla pôvodnej PDF ponuky'], strength: 'EXACT_OFFER' }], review: 'PENDING', linkedJobId: null, reviewedAt: null, reviewedBy: null }] }));
  await page.goto(`${origin}/admin/nastavenia/gmail/`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('button', { name: 'Skontrolovať nové správy', exact: true }).isDisabled(), true);
  const mailReview = page.locator('details').filter({ hasText: `QA komunikácia k ${importedNumber}` });
  await mailReview.locator('summary').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(outputDirectory, 'job-gmail-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(outputDirectory, 'job-gmail-mobile.png'), fullPage: true });
  await mailReview.getByRole('checkbox').check();
  const reviewResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().startsWith(`${origin}/admin/nastavenia/gmail`));
  await mailReview.getByRole('button', { name: 'Priradiť ku karte', exact: true }).click();
  await reviewResponse;
  await page.getByRole('heading', { name: 'Kontrola správ · čaká 0', exact: true }).waitFor({ timeout: 30000 });
  const mailState = JSON.parse(await readFile(`${localDbPath}.job-mail.json`, 'utf8'));
  assert.equal(mailState.messages[0].review, 'LINKED');
  state = JSON.parse(await readFile(localDbPath, 'utf8'));
  assert.equal(state.jobWorkspace.communications.filter((message) => message.source === 'GMAIL' && message.jobId === importedOffer.jobId).length, 1);
  assert.equal(state.jobWorkspace.manualOffers.find((offer) => offer.id === importedOffer.id).status, 'ACCEPTED', 'mail review must not infer or change acceptance');
  assert.equal(deniedOrigins.length, 0, `browser attempted external requests: ${deniedOrigins.join(', ')}`);
  assert.deepEqual(browserErrors, [], `browser reported runtime errors: ${browserErrors.join(' | ')}`);
  console.log(JSON.stringify({ result: 'PASS', workspaceRevisions: saved.revision, responsiveWidths: [1440, 768, 390, 320], operatorFinancialIsolation: true, privateCrewPrint: true, tentativeCalendarEntry: true, pdfExtraction: uploadedPdf.extraction.state, manualOfferStatus: importedOffer.status, manualOfferCanonicalTotal: importedJob.totalPrice, stagedGmailReview: mailState.messages[0].review, browserErrors: browserErrors.length, externalOrigins: deniedOrigins.length, realGmailUsed: false }));
} catch (error) {
  console.error('Isolated workspace browser QA failed:', error.message);
  console.error('Local Next diagnostics:', logs.join('').slice(-4500));
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(child);
  const marker = await readFile(path.join(tempRoot, '.harness-owner'), 'utf8').catch(() => '');
  const resolvedRoot = path.resolve(tempRoot);
  assert.equal(path.dirname(resolvedRoot).toLowerCase(), tempParent.toLowerCase());
  assert.match(path.basename(resolvedRoot), /^astana-job-workspace-browser-[A-Za-z0-9]+$/);
  assert.equal(marker, owner);
  const dependencyLink = path.join(tempRoot, 'node_modules');
  if ((await lstat(dependencyLink).catch(() => null))?.isSymbolicLink()) await unlink(dependencyLink);
  await rm(tempRoot, { recursive: true });
  console.log(`Cleanup PASS: owned temp root removed: ${tempRoot}`);
}
