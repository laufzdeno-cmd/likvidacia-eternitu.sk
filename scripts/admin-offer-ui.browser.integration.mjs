/**
 * Focused UI regressions: empty offer date, action feedback, roofer intent,
 * and offer-status contrast. Reuses the existing disposable Next server and
 * loopback guard. Only synthetic JSON fixtures; no SMTP, Blob, or real DB.
 */
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempParent = path.resolve(tmpdir());
const tempRoot = await mkdtemp(path.join(tempParent, 'astana-offer-ui-'));
const outputRoot = path.join(root, 'tmp', `admin-offer-ui-${Date.now()}`);
const owner = randomUUID();
const secret = randomUUID() + randomUUID();
const adminEmail = 'offer-ui-qa@local.test';
const localDbPath = path.join(tempRoot, 'offer-ui-fixtures.json');
const sourcePaths = [
  'app/admin/(protected)/layout.tsx',
  'app/admin/(protected)/ponuky/offer-form.tsx',
  'app/admin/(protected)/ponuky/pending-offer-button.tsx',
  'app/admin/(protected)/dopyty/[id]/page.tsx',
  'app/admin/admin-route.css',
];
const logs = [], pageErrors = [], consoleErrors = [], deniedOrigins = [], posts = [], checks = [];
const heldGates = new Set();
let child, browser, page, requestGate, sourceHashes;

const fixtureCases = [
  { name: 'already-has-roofer', roofer: 'Strechára už mám', expected: false },
  { name: 'empty', roofer: '', expected: false },
  { name: 'legacy-positive', roofer: 'Potrebujem strechára', expected: true },
  { name: 'current-positive', roofer: 'Chcem odporučiť strechára podľa regiónu', expected: true },
  { name: 'explicit-flag', roofer: '', wantsRooferRecommendation: true, expected: true },
  { name: 'selected-roofer', roofer: '', selectedRooferId: randomUUID(), expected: true },
].map((entry) => ({ ...entry, id: randomUUID() }));

function sessionCookie() {
  const payload = Buffer.from(JSON.stringify({ kind: 'admin-session', email: adminEmail, iat: Date.now(), epoch: 0 })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForApp(origin) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Local Next exited: ${child.exitCode}`);
    try {
      const response = await fetch(`${origin}/admin/ponuky/nova/`, {
        redirect: 'manual', headers: { Cookie: `astana_admin_session=${sessionCookie()}` },
        signal: AbortSignal.timeout(2000),
      });
      if (response.status === 200) return;
    } catch { /* only the owned loopback server may still be starting */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Local Next did not become ready within 90 seconds.');
}

async function stopChild() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const waitForExit = () => new Promise((resolve) => {
    const timer = setTimeout(() => { child.off('exit', onExit); resolve(false); }, 5000);
    const onExit = () => { clearTimeout(timer); resolve(true); };
    child.once('exit', onExit);
  });
  child.kill('SIGTERM');
  if (await waitForExit()) return;
  child.kill('SIGKILL');
  assert.ok(await waitForExit(), 'the owned Next process must stop before cleanup');
}

function holdNextOfferAction() {
  assert.equal(requestGate, undefined, 'only one synthetic action may be held');
  const gate = { arrived: false };
  gate.wait = new Promise((resolve) => { gate.release = resolve; });
  heldGates.add(gate);
  requestGate = gate;
  return gate;
}

async function assertIdle(expectEditor = true) {
  await expect(page.locator('.admin-pending-toast')).toHaveCount(0);
  await expect(page.locator('.admin-submit-busy')).toHaveCount(0);
  await expect(page.locator('form.is-submitting')).toHaveCount(0);
  await expect(page.locator('.price-offer-actions button:disabled')).toHaveCount(0);
  if (expectEditor) await expect(page.locator('.price-offer-layout')).toHaveCount(1);
}

async function assertHeld(gate) {
  await expect.poll(() => gate.arrived, { timeout: 30_000 }).toBe(true);
  await expect(page.getByRole('status').filter({ hasText: 'Ukladám cenovú ponuku…' })).toBeVisible();
  await expect(page.locator('.price-offer-actions button:disabled')).toHaveCount(2);
  await expect(page.locator('.price-offer-actions button[name="next"]')).toHaveAttribute('value', 'send');
  // The response is controlled by this gate. No completion timer may clear UI.
  await page.waitForTimeout(1200);
  await expect(page.locator('.admin-pending-toast')).toBeVisible();
  await expect(page.locator('.admin-submit-busy')).toHaveCount(1);
}

function record(name, evidence = {}) {
  checks.push({ name, result: 'PASS', ...evidence });
  console.log(JSON.stringify(checks.at(-1)));
}

try {
  await writeFile(path.join(tempRoot, '.harness-owner'), owner, { flag: 'wx' });
  await mkdir(outputRoot, { recursive: true });
  for (const name of ['app', 'src', 'public']) {
    await cp(path.join(root, name), path.join(tempRoot, name), {
      recursive: true, filter: (entry) => !/^\.env(?:\.|$)/.test(path.basename(entry)),
    });
  }
  for (const name of ['package.json', 'next.config.mjs', 'tsconfig.json', 'proxy.ts']) {
    await cp(path.join(root, name), path.join(tempRoot, name));
  }
  await symlink(await realpath(path.join(root, 'node_modules')), path.join(tempRoot, 'node_modules'), 'junction');
  sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async (name) =>
    [name, createHash('sha256').update(await readFile(path.join(tempRoot, name))).digest('hex')])));
  // Disposable-only action fixture: exercises the real child component without
  // importing or invoking any email, PDF, authentication mutation, or DB action.
  const probeRoot = path.join(tempRoot, 'app/admin/(protected)/qa-pending');
  await mkdir(probeRoot);
  await writeFile(path.join(probeRoot, 'page.tsx'), `
import Probe from './probe';
async function settle(_previous: {message: string}, data: FormData) {
  'use server';
  return {message: data.get('outcome') === 'error' ? 'Syntetická chyba' : 'Hotovo'};
}
export default function Page() { return <Probe action={settle} />; }
`);
  await writeFile(path.join(probeRoot, 'probe.tsx'), `
'use client';
import { useActionState } from 'react';
import PendingOfferButton from '../ponuky/pending-offer-button';
export default function Probe({action}: {action: (state: {message: string}, data: FormData) => Promise<{message: string}>}) {
  const [state, formAction] = useActionState(action, {message: ''});
  return <main className="admin-page"><h1>Izolovaný test tlačidla</h1>
    <form action={formAction} className="admin-pending-form">
      <input name="requiredValue" aria-label="Povinná hodnota" required />
      <select name="outcome" aria-label="Výsledok"><option value="error">Chyba</option><option value="success">Úspech</option></select>
      <PendingOfferButton idleText="Spustiť lokálny test" pendingText="Prebieha iba lokálny test…" />
      <p role="status" data-probe-result>{state.message}</p>
    </form></main>;
}
`);
  const appPort = await freePort();
  const origin = `http://127.0.0.1:${appPort}`;
  const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']
    .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  Object.assign(env, {
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: localDbPath,
    AUTH_SECRET: secret, ADMIN_EMAIL: adminEmail, ALLOWED_ORIGINS: origin,
    TEMP: tempRoot, TMP: tempRoot, ASTANA_TEST_NETWORK_GUARD: '1',
    ASTANA_TEST_APP_ROOT: tempRoot, ASTANA_TEST_APP_PORT: String(appPort),
    NODE_OPTIONS: `--import=${pathToFileURL(path.join(root, 'scripts/test-loopback-network-guard.mjs')).href}`,
  });
  child = spawn(process.execPath, [path.join(root, 'scripts/testimonial-admin-form-server.mjs')],
    { cwd: tempRoot, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  await waitForApp(origin);

  const fixtureDb = JSON.parse(await readFile(localDbPath, 'utf8'));
  const timestamp = new Date().toISOString();
  fixtureDb.leads.push(...fixtureCases.map(({ expected, name, ...entry }) => ({
    ...entry, submissionId: randomUUID(), fullName: `UI QA ${name}`, phone: '+421900123456',
    email: `${name}@example.invalid`, city: 'Poprad', district: 'Poprad', objectType: 'Rodinný dom',
    materialType: 'Vlnitý eternit', areaEstimate: 100, preferredContact: 'Email', term: 'Dohodou',
    note: 'Výhradne syntetický lokálny test.', gdpr: true, isTestData: true,
    status: 'novy', internalNote: 'Nekontaktovať.', createdAt: timestamp, updatedAt: timestamp,
  })));
  await writeFile(localDbPath, JSON.stringify(fixtureDb));

  browser = await chromium.launch({
    executablePath: process.env.ASTANA_HARNESS_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, args: ['--no-first-run', '--disable-background-networking'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', timezoneId: 'Pacific/Honolulu' });
  await context.route('**/*', async (route) => {
    const request = route.request(), target = new URL(request.url());
    if (target.origin !== origin) { deniedOrigins.push(target.origin); return route.abort('blockedbyclient'); }
    if (['GET', 'HEAD'].includes(request.method())) return route.continue();
    if (request.method() !== 'POST' || !/^\/admin\/(ponuky\/(nova|[a-f0-9-]{36})|qa-pending)\/$/.test(target.pathname)) {
      return route.abort('blockedbyclient');
    }
    posts.push(target.pathname);
    const gate = requestGate;
    if (gate) {
      requestGate = undefined;
      gate.arrived = true;
      const result = await gate.wait;
      heldGates.delete(gate);
      return result === 'abort' ? route.abort('failed') : route.continue();
    }
    return route.continue();
  });
  await context.addCookies([{ name: 'astana_admin_session', value: sessionCookie(), url: origin, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const field = (name) => page.locator(`input[name="${name}"]`);
  const primaryLead = fixtureCases[0];
  await page.goto(`${origin}/admin/dopyty/${primaryLead.id}/cenova-ponuka/`, { waitUntil: 'networkidle', timeout: 60_000 });
  assert.ok(page.url().includes('/admin/ponuky/nova/'));
  const validDate = await field('validUntil').inputValue();
  const note = page.locator('textarea[name="offerNote"]');
  await note.fill('Zachovať túto rozpracovanú poznámku.');
  await field('validUntil').fill('');
  await page.getByText('Doplňte platný dátum platnosti ponuky.', { exact: true }).waitFor();
  const postsBeforeInvalid = posts.length;
  await page.getByRole('button', { name: 'Uložiť ako koncept', exact: true }).click();
  assert.equal(posts.length, postsBeforeInvalid);
  assert.equal(await field('validUntil').evaluate((element) => element.required && element.validity.valueMissing), true);
  await expect(note).toHaveValue('Zachovať túto rozpracovanú poznámku.');
  await assertIdle();
  await page.screenshot({ path: path.join(outputRoot, 'empty-date-preserved.png'), fullPage: true });
  await field('validUntil').fill(validDate);
  const dateLabel = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(validDate));
  await page.getByText(`Zobrazí sa ako: ${dateLabel}`, { exact: true }).waitFor();
  record('empty-date-preserves-validation-and-data', { posts: 0, calendarTimezone: 'Pacific/Honolulu' });

  assert.equal(await field('includeTransport').isChecked(), false);
  assert.equal(await field('transportPricePerKm').inputValue(), '0.7');
  await field('pricePerM2WithoutVat').fill('10');
  await field('documentationFeeWithoutVat').fill('161');
  await field('includeTransport').check();
  await field('transportRoundTripKm').fill('200');
  await field('transportPricePerKm').fill('0.85');
  await field('documentationPromotion').check();
  await expect(field('documentationFeeWithoutVat')).toHaveAttribute('readonly', '');
  await field('includeTransport').uncheck();
  await field('includeTransport').check();
  await expect(field('transportRoundTripKm')).toHaveValue('200');
  await expect(field('transportPricePerKm')).toHaveValue('0.85');
  record('optional-transport-and-documentation-promotion', { defaultRate: 0.7, editedRate: 0.85, roundTripKm: 200 });

  const beforeRouteCalculation = page.url();
  await page.getByRole('button', { name: 'Vypočítať km tam aj späť', exact: true }).click();
  await expect(page.getByText('Automatický výpočet kilometrov nie je nastavený. Kilometre môžete zadať ručne.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vypočítať km tam aj späť', exact: true })).toBeEnabled();
  assert.equal(page.url(), beforeRouteCalculation);
  await assertIdle();
  record('quick-nonnavigation-action-settles', { externalMapRequests: 0 });

  // Add a fixture-only confirmation to exercise the existing layout cancel path.
  const form = page.locator('form.admin-pending-form');
  await form.evaluate((element) => element.setAttribute('data-confirm-submit', 'Syntetické potvrdenie pre test zrušenia.'));
  page.once('dialog', (dialog) => dialog.dismiss());
  const postsBeforeCancel = posts.length;
  await page.getByRole('button', { name: 'Uložiť ako koncept', exact: true }).click();
  await assertIdle();
  assert.equal(posts.length, postsBeforeCancel);
  await expect(note).toHaveValue('Zachovať túto rozpracovanú poznámku.');
  await form.evaluate((element) => element.removeAttribute('data-confirm-submit'));
  record('cancel-has-no-request-and-no-pending-ui');

  const createGate = holdNextOfferAction();
  await page.getByRole('button', { name: 'Uložiť ako koncept', exact: true }).click();
  await assertHeld(createGate);
  await page.screenshot({ path: path.join(outputRoot, 'offer-action-pending.png'), fullPage: true });
  createGate.release('continue');
  await page.waitForURL(/\/admin\/ponuky\/[a-f0-9-]{36}\/$/, { timeout: 60_000 });
  await assertIdle();
  const saved = JSON.parse(await readFile(localDbPath, 'utf8'));
  assert.equal(saved.priceOffers.length, 1);
  const offer = saved.priceOffers[0];
  assert.equal(offer.status, 'PRIPRAVENA');
  assert.equal(saved.leads.find((lead) => lead.id === primaryLead.id).status, 'naceneny');
  assert.equal(offer.totalWithoutVat, 1170);
  assert.equal(offer.totalWithVat, 1439.1);
  record('save-settles-after-navigation', { offerStatus: offer.status, leadStatus: 'naceneny', totalWithoutVat: 1170, totalWithVat: 1439.1 });

  const contrast = await page.locator('.price-offer-heading .admin-status-badge').evaluate((element) => {
    const style = getComputedStyle(element);
    const luminance = (color) => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255)
        .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const foreground = luminance(style.color), background = luminance(style.backgroundColor);
    return { color: style.color, background: style.backgroundColor, ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) };
  });
  assert.ok(contrast.ratio >= 4.5, JSON.stringify(contrast));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.screenshot({ path: path.join(outputRoot, `offer-saved-${width}.png`), fullPage: true });
  }
  record('status-contrast-and-focused-viewports', { ...contrast, viewports: [1440, 390, 320] });
  await page.setViewportSize({ width: 1440, height: 1000 });

  const editGate = holdNextOfferAction();
  await page.getByRole('button', { name: 'Uložiť zmeny', exact: true }).click();
  await assertHeld(editGate);
  editGate.release('continue');
  await assertIdle();
  record('same-route-action-settles');

  await page.getByRole('button', { name: 'Uložiť a skontrolovať odoslanie', exact: true }).click();
  await page.waitForURL(/\?send=1$/, { timeout: 60_000 });
  await page.getByRole('heading', { name: 'Odoslanie zákazníkovi', exact: true }).waitFor();
  await assertIdle();
  record('submitter-value-preserved', { next: 'send', mailActions: 0 });

  for (const entry of fixtureCases) {
    await page.goto(`${origin}/admin/dopyty/${entry.id}/`, { waitUntil: 'networkidle', timeout: 60_000 });
    await expect(page.getByText(`Zákazník chce strechára? ${entry.expected ? 'Áno' : 'Nie'}`, { exact: true })).toBeVisible();
    if (entry === primaryLead) {
      await page.getByText('Pripravená · neodoslaná', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(outputRoot, 'lead-roofer-no-offer-not-sent.png'), fullPage: true });
    }
  }
  record('shared-roofer-intent', { cases: fixtureCases.map(({ name, expected }) => ({ name, expected })) });

  await page.goto(`${origin}/admin/qa-pending/`, { waitUntil: 'networkidle', timeout: 60_000 });
  const probeButton = page.getByRole('button', { name: 'Spustiť lokálny test', exact: true });
  const probeForm = page.locator('form.admin-pending-form');
  const assertProbeIdle = async () => {
    await expect(probeButton).toBeEnabled();
    await expect(probeButton).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.admin-inline-pending, .is-submitting, .admin-submit-busy')).toHaveCount(0);
  };
  const beforeProbeInvalid = posts.length;
  await probeButton.click();
  await assertProbeIdle();
  assert.equal(posts.length, beforeProbeInvalid);
  await page.getByRole('textbox', { name: 'Povinná hodnota' }).fill('fixture');
  await probeForm.evaluate((element) => element.setAttribute('data-confirm-submit', 'Zrušiť lokálny test?'));
  page.once('dialog', (dialog) => dialog.dismiss());
  await probeButton.click();
  await assertProbeIdle();
  assert.equal(posts.length, beforeProbeInvalid);
  await probeForm.evaluate((element) => element.removeAttribute('data-confirm-submit'));
  record('pending-child-invalid-and-cancel-remain-idle', { mailActions: 0 });

  const childGate = holdNextOfferAction();
  await probeButton.click();
  await expect.poll(() => childGate.arrived, { timeout: 30_000 }).toBe(true);
  await expect(page.locator('.admin-submit-wrap button')).toBeDisabled();
  await expect(page.locator('.admin-inline-pending')).toHaveText('Prebieha iba lokálny test…');
  await page.screenshot({ path: path.join(outputRoot, 'pending-child-isolated-action.png'), fullPage: true });
  childGate.release('continue');
  await expect(page.locator('[data-probe-result]')).toHaveText('Syntetická chyba');
  await assertProbeIdle();
  await page.getByRole('textbox', { name: 'Povinná hodnota' }).fill('fixture');
  await page.getByRole('combobox', { name: 'Výsledok' }).selectOption('success');
  await probeButton.click();
  await expect(page.locator('[data-probe-result]')).toHaveText('Hotovo');
  await assertProbeIdle();
  await page.screenshot({ path: path.join(outputRoot, 'pending-child-settled.png'), fullPage: true });
  record('pending-child-same-route-error-and-quick-success-settle', { mailActions: 0 });

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  await page.goto(`${origin}/admin/ponuky/${offer.id}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  const failureGate = holdNextOfferAction();
  await page.getByRole('button', { name: 'Uložiť zmeny', exact: true }).click();
  await assertHeld(failureGate);
  failureGate.release('abort');
  await expect.poll(() => pageErrors.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await assertIdle(false);
  assert.ok(pageErrors.every((message) => /fetch|network/i.test(message)), JSON.stringify(pageErrors));
  record('failed-action-cleans-pending-ui', { expectedNetworkErrors: pageErrors.length });

  const finalDb = JSON.parse(await readFile(localDbPath, 'utf8'));
  assert.equal(finalDb.priceOffers.length, 1);
  assert.equal(finalDb.priceOffers[0].status, 'PRIPRAVENA');
  assert.equal(finalDb.leadEmailOutbox.length, 0);
  assert.deepEqual(deniedOrigins, []);
  await writeFile(path.join(outputRoot, 'report.json'), JSON.stringify({
    result: 'PASS', productionAccess: false, mailActions: 0, sourceHashes, checks,
    browser: await browser.version(), node: process.version, externalOrigins: deniedOrigins.length,
    localActionAttempts: posts.length, persistedOffers: 1, outboxRows: 0,
    expectedFailurePageErrors: pageErrors,
  }, null, 2));
  console.log(JSON.stringify({ result: 'PASS', checks: checks.length, outputRoot, externalOrigins: 0, mailActions: 0 }));
} catch (error) {
  await page?.screenshot({ path: path.join(outputRoot, 'failure.png'), fullPage: true }).catch(() => undefined);
  await writeFile(path.join(outputRoot, 'failure.json'), JSON.stringify({ error: String(error), sourceHashes, checks, pageErrors, consoleErrors, deniedOrigins, posts }, null, 2));
  console.error('Focused admin UI regression failed:', error);
  console.error(logs.join('').slice(-3500));
  throw error;
} finally {
  for (const gate of heldGates) gate.release('abort');
  await browser?.close().catch(() => undefined);
  await stopChild();
  assert.equal(path.dirname(path.resolve(tempRoot)).toLowerCase(), tempParent.toLowerCase());
  assert.match(path.basename(tempRoot), /^astana-offer-ui-[A-Za-z0-9]+$/);
  assert.equal(await readFile(path.join(tempRoot, '.harness-owner'), 'utf8'), owner);
  const link = path.join(tempRoot, 'node_modules');
  if ((await lstat(link).catch(() => null))?.isSymbolicLink()) await unlink(link);
  await rm(tempRoot, { recursive: true });
  console.log(`Cleanup PASS: owned temp root removed: ${tempRoot}`);
}
