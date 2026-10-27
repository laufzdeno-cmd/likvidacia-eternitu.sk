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
import { JOB_WORKSPACE_RELEASE_ENABLED } from '../src/server/job-workspace-release-mode.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempParent = path.resolve(tmpdir());
const tempRoot = await mkdtemp(path.join(tempParent, 'astana-workspace-fallback-'));
const owner = randomUUID();
const adminEmail = 'fallback-qa@local.test';
const operatorEmail = 'fallback-operator@local.test';
const secret = Buffer.from(randomUUID() + randomUUID()).toString('hex');
const customerName = 'Kompatibilná zákazka QA';
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

  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: localDbPath, ADMIN_EMAIL: adminEmail, ASTANA_JOB_WORKSPACE_ENABLED: 'false' });
  const db = await import(pathToFileURL(path.join(tempRoot, 'src/server/db.ts')).href);
  const workspace = await import(pathToFileURL(path.join(tempRoot, 'src/server/job-workspace-db.ts')).href);
  const actor = { email: adminEmail, role: 'SUPER_ADMIN' };
  const legacyInput = { demolitionDate: '', customerName, customerPhone: '0900000000', customerEmail: 'qa@example.invalid', location: 'Poprad', district: '', materialType: '', objectType: '', term: '', leadSource: 'manual_pdf', preferredContact: '', m2: 0, pricePerM2: 0, paymentType: 'FAKTURA', workType: 'ODVOZ', wasteKg: 0, landfill: 'INA', status: 'PONUKA_POTVRDENA', note: '', workers: [], costs: { fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0 } };
  const job = await db.saveBusinessJob(legacyInput, adminEmail);
  let card = await workspace.getJobWorkspace(job.id, actor);
  card = await workspace.saveJobWorkspace(job.id, { expectedRevision: card.revision, operations: { ...card.operations, note: 'WORKSPACE_PRIVATE_ONLY_SENTINEL', plan: { ...card.operations.plan, actualOn: '2026-10-20' } }, settlement: { ...card.settlement, agreedAmountWithVatCents: 123000 } }, actor);
  card = await workspace.saveJobWorkspace(job.id, { expectedRevision: card.revision, operations: { ...card.operations, plan: { ...card.operations.plan, actualOn: null } } }, actor);
  await db.saveBusinessJob({ ...legacyInput, demolitionDate: '2026-10-01' }, adminEmail, job.id);
  assert.equal((await db.getBusinessJob(job.id)).totalPrice, 1230, 'legacy save must preserve imported price when area and rate are zero');
  assert.equal((await db.getBusinessJob(job.id)).demolitionDate, '', 'managed unknown actual day must remain unknown');
  card = await workspace.getJobWorkspace(job.id, actor);
  card = await workspace.saveJobWorkspace(job.id, { expectedRevision: card.revision, operations: { ...card.operations, plan: { ...card.operations.plan, actualOn: '2026-10-20' } } }, actor);
  await db.saveBusinessJob({ ...legacyInput, demolitionDate: '2026-10-01' }, adminEmail, job.id);
  assert.equal((await db.getBusinessJob(job.id)).demolitionDate, '2026-10-20', 'legacy save must preserve managed actual day');
  card = await workspace.getJobWorkspace(job.id, actor);
  await workspace.saveJobWorkspace(job.id, { expectedRevision: card.revision, operations: { ...card.operations, plan: { ...card.operations.plan, actualOn: null } } }, actor);
  const local = JSON.parse(await readFile(localDbPath, 'utf8'));
  local.adminUsers.push({ id: randomUUID(), email: operatorEmail, name: 'Operátor QA', role: 'OPERATOR', active: true, passwordHash: '', twoFactorSecret: '', twoFactorEnabled: false, twoFactorBackupCodeHashes: [], sessionEpoch: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await writeFile(localDbPath, JSON.stringify(local));
  await db.updateBusinessJobOperational(job.id, { ...legacyInput, demolitionDate: '2026-10-01' }, operatorEmail);
  const operational = await db.getOperationalBusinessJobWithActivity(job.id);
  assert.equal(operational.demolitionDate, '');
  for (const key of ['totalPrice', 'pricePerM2', 'costs', 'settlement', 'rewardsTotal', 'grossProfit']) assert.equal(key in operational, false);
  await db.recordBusinessInvoice(job.id, { operationId: randomUUID(), invoiceNumber: 'FALLBACK-QA-1230', issuedOn: '2026-10-01', amountWithoutVatCents: 100000, vatRateBasisPoints: 2300, amountWithVatCents: 123000 }, adminEmail);
  assert.equal((await db.searchAdminData(customerName, false)).jobs.length, 1, 'legacy search still finds a job');
  assert.equal((await db.searchAdminData('WORKSPACE_PRIVATE_ONLY_SENTINEL', false)).jobs.length, 0, 'disabled search does not read new sidecar content');
  assert.deepEqual((await db.searchAdminData('FALLBACK-QA-1230', false)).finance, [], 'operator cannot discover finance');
  assert.equal((await db.searchAdminData('FALLBACK-QA-1230', true)).finance.length, 1);
  await assert.rejects(db.destroyBusinessJob(job.id, adminEmail), /faktúr|úhrad/i);

  const childEnv = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']
    .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  Object.assign(childEnv, {
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: localDbPath,
    AUTH_SECRET: secret, ADMIN_EMAIL: adminEmail, ALLOWED_ORIGINS: origin,
    TEMP: tempRoot, TMP: tempRoot, ASTANA_TEST_NETWORK_GUARD: '1',
    ASTANA_JOB_WORKSPACE_ENABLED: JOB_WORKSPACE_RELEASE_ENABLED ? 'false' : 'true',
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

  await page.goto(`${origin}/admin/zakazky/${job.id}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: customerName, exact: true }).waitFor();
  assert.equal(await page.locator('#pracovna-karta').count(), 0, 'workspace must not render');
  assert.equal(await page.locator('.admin-topbar').getByRole('search').count(), 0, 'enhanced top search must not render');
  await page.getByRole('heading', { name: 'Faktúry a prijaté úhrady', exact: true }).waitFor();
  assert.equal(await page.locator('input[name="demolitionDate"]').inputValue(), '');
  await page.goto(`${origin}/admin/ponuky/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Cenové ponuky', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Zaevidovať PDF', exact: true }).count(), 0);
  await page.getByRole('link', { name: 'Nová cenová ponuka', exact: true }).waitFor();
  await page.goto(`${origin}/admin/planovac/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Plánovač', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Naplánovať akciu', exact: true }).waitFor();
  await page.goto(`${origin}/admin/vyhladavanie/`, { waitUntil: 'networkidle' });
  const search = page.locator('.crm-search-page').getByRole('search');
  await search.getByLabel('Hľadané slová', { exact: true }).fill(customerName);
  await search.getByRole('button', { name: 'Hľadať', exact: true }).click();
  await page.locator('.intelligence-results').getByRole('link').filter({ hasText: customerName }).waitFor();
  assert.equal(await search.locator('[name="responsibleEmail"]').count(), 0);
  for (const route of ['/admin/ponuky/rucna/', '/admin/nastavenia/gmail/']) {
    const response = await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 404, `${route} must be unavailable`);
  }
  const upload = await context.request.post(`${origin}/api/admin/job-workspace/upload/`, { data: 'blocked before parsing' });
  assert.equal(upload.status(), 503);
  const privateRead = await context.request.get(`${origin}/api/admin/job-workspace/documents/${randomUUID()}/`);
  assert.equal(privateRead.status(), 503);
  const operatorContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await operatorContext.route('**/*', async (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
  await operatorContext.addCookies([{ name: 'astana_admin_session', value: sessionCookie(operatorEmail), url: origin, httpOnly: true, sameSite: 'Lax' }]);
  const operatorPage = await operatorContext.newPage();
  await operatorPage.goto(`${origin}/admin/zakazky/${job.id}/`, { waitUntil: 'domcontentloaded' });
  await operatorPage.getByRole('heading', { name: customerName, exact: true }).waitFor();
  assert.equal(await operatorPage.locator('#pracovna-karta').count(), 0);
  assert.equal(await operatorPage.getByRole('heading', { name: 'Faktúry a prijaté úhrady', exact: true }).count(), 0);
  assert.equal(await operatorPage.locator('[name="pricePerM2"]').count(), 0);
  assert.equal(deniedOrigins.length, 0);
  const expectedNotFoundConsole = 'console: Failed to load resource: the server responded with a status of 404 (Not Found)';
  assert.equal(browserErrors.filter((error) => error === expectedNotFoundConsole).length, 2, 'only the two intentionally unavailable pages may report 404');
  assert.deepEqual(browserErrors.filter((error) => error !== expectedNotFoundConsole), []);
  assert.equal((await db.getBusinessJob(job.id)).totalPrice, 1230);
  console.log(JSON.stringify({ result: 'PASS', compiledDefault: JOB_WORKSPACE_RELEASE_ENABLED, environmentChallenge: JOB_WORKSPACE_RELEASE_ENABLED ? 'false' : 'true', legacyAdmin: 'working', canonicalPrice: 1230, managedUnknownDate: true, managedActualDate: true, operatorFinanceAbsent: true, legacySearchWorking: true, newRoutesBlocked: true, externalOrigins: 0 }));
} catch (error) {
  console.error('Isolated compatible fallback QA failed:', error.message);
  console.error('Local Next diagnostics:', logs.join('').slice(-4500));
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(child);
  const marker = await readFile(path.join(tempRoot, '.harness-owner'), 'utf8').catch(() => '');
  const resolvedRoot = path.resolve(tempRoot);
  assert.equal(path.dirname(resolvedRoot).toLowerCase(), tempParent.toLowerCase());
  assert.match(path.basename(resolvedRoot), /^astana-workspace-fallback-[A-Za-z0-9]+$/);
  assert.equal(marker, owner);
  const dependencyLink = path.join(tempRoot, 'node_modules');
  if ((await lstat(dependencyLink).catch(() => null))?.isSymbolicLink()) await unlink(dependencyLink);
  await rm(tempRoot, { recursive: true });
  console.log(`Cleanup PASS: owned temp root removed: ${tempRoot}`);
}
