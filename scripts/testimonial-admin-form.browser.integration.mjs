/**
 * Isolated browser check for the admin testimonial approval form.
 * Uses a temporary Next source copy, loopback-only PGlite, synthetic data,
 * and a browser route guard. It does not read env files or use external mail.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { cp, lstat, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempParent = path.resolve(tmpdir());
const tempRoot = await mkdtemp(path.join(tempParent, 'astana-testimonial-form-'));
const owner = randomUUID();
const adminEmail = 'admin@local.test';
const testName = `Izolovaný test referencie ${randomUUID()}`;
const secret = Buffer.from(randomUUID() + randomUUID()).toString('hex');
const logs = [];
let database, socket, browser, child;

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
    let response;
    try {
      response = await fetch(origin + '/admin/referencie/', { redirect: 'manual', signal: AbortSignal.timeout(1500) });
    } catch { /* wait for the isolated server */ }
    if (response) {
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        assert.ok(location, 'startup redirect must include a Location header');
        assert.equal(new URL(location, origin).origin, origin, 'startup redirect must remain on the isolated local origin');
      }
      if ([200, 307, 308].includes(response.status)) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Next did not start within 90 seconds: ${logs.join('').slice(-3500)}`);
}

async function stopChild(processHandle) {
  if (!processHandle || processHandle.exitCode !== null || processHandle.signalCode !== null) return;
  const waitForExit = (milliseconds) => Promise.race([
    new Promise((resolve) => processHandle.once('exit', () => resolve(true))),
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), milliseconds);
      timer.unref();
    }),
  ]);
  processHandle.kill('SIGTERM');
  if (await waitForExit(5000) || processHandle.exitCode !== null || processHandle.signalCode !== null) return;
  processHandle.kill('SIGKILL');
  if (await waitForExit(5000) || processHandle.exitCode !== null || processHandle.signalCode !== null) return;
  throw new Error(`Owned local Next process ${processHandle.pid} did not exit; database and temp directory are being preserved.`);
}

function sessionCookie() {
  const payload = Buffer.from(JSON.stringify({ kind: 'admin-session', email: adminEmail, iat: Date.now(), epoch: 0 })).toString('base64url');
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

  const [{ PGlite }, { PGLiteSocketServer }, { chromium }] = await Promise.all([
    import('@electric-sql/pglite'), import('@electric-sql/pglite-socket'), import('@playwright/test'),
  ]);
  const port = await freePort();
  const dbPort = await freePort();
  assert.notEqual(port, dbPort);
  const origin = `http://127.0.0.1:${port}`;
  const databaseUrl = `postgres://astana_test:astana_test@127.0.0.1:${dbPort}/astana_test`;
  database = await PGlite.create();
  socket = new PGLiteSocketServer({ db: database, port: dbPort, host: '127.0.0.1', maxConnections: 12 });
  await socket.start();

  const childEnv = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']
    .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  Object.assign(childEnv, {
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    DATABASE_URL: databaseUrl, AUTH_SECRET: secret, ADMIN_EMAIL: adminEmail,
    ALLOWED_ORIGINS: origin, TEMP: tempRoot, TMP: tempRoot,
    ASTANA_TEST_NETWORK_GUARD: '1', ASTANA_TEST_APP_ROOT: tempRoot, ASTANA_TEST_APP_PORT: String(port),
    NODE_OPTIONS: `--import=${pathToFileURL(path.join(projectRoot, 'scripts', 'test-loopback-network-guard.mjs')).href}`,
  });
  child = spawn(process.execPath, [path.join(projectRoot, 'scripts', 'testimonial-admin-form-server.mjs')],
    { cwd: tempRoot, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  await waitForApp(origin);

  const browserPath = process.env.ASTANA_HARNESS_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.ok(existsSync(browserPath), 'Edge is required; ASTANA_HARNESS_BROWSER may specify a local Chromium executable.');
  browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-first-run', '--disable-background-networking'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const deniedOrigins = [];
  await context.route('**/*', async (route) => {
    const target = new URL(route.request().url());
    if (target.origin === origin) return route.continue();
    deniedOrigins.push(target.origin);
    return route.abort('blockedbyclient');
  });
  await context.addCookies([{ name: 'astana_admin_session', value: sessionCookie(), url: origin, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  const response = await page.goto(origin + '/admin/referencie/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.equal(response?.status(), 200, 'isolated admin page must render');
  await page.getByRole('heading', { name: 'Referencie', exact: true }).waitFor();

  const createForm = page.locator('form.admin-quote-form').last();
  await createForm.locator('input[name="customerName"]').fill(testName);
  await createForm.locator('textarea[name="text"]').fill('Syntetická referencia pre izolovanú kontrolu schvaľovacieho formulára.');
  await createForm.getByRole('button', { name: 'Uložiť referenciu' }).click();
  await page.waitForURL((url) => url.searchParams.get('ulozene') === '1', { timeout: 30_000 });
  const row = await database.query('SELECT id, status FROM testimonials WHERE customer_name=$1', [testName]);
  assert.equal(row.rowCount, 1);
  assert.equal(row.rows[0].status, 'draft', 'a new admin testimonial must remain a draft');

  const id = String(row.rows[0].id);
  await page.goto(`${origin}/admin/referencie/?edit=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: 'Referencie', exact: true }).waitFor();
  const card = page.locator('article.admin-card').filter({ hasText: testName });
  const editForm = card.locator('form.admin-quote-form');
  await editForm.getByRole('button', { name: 'Uložiť zmeny' }).waitFor();
  assert.equal(await editForm.locator('input[name="id"]').inputValue(), id,
    'the selected edit form must target the exact synthetic draft');
  const status = editForm.locator('select[name="status"]');
  await status.selectOption('approved');
  assert.equal(await status.inputValue(), 'approved', 'approval state is selected in the live form');
  await editForm.getByLabel(/Po úprave mám znovu doložený súhlas/).check();
  await editForm.locator('textarea[name="consentWording"]').fill('Súhlas určený výhradne pre izolovaný test; nejde o skutočného zákazníka.');
  await editForm.locator('select[name="consentSource"]').selectOption({ label: 'osobne' });
  await editForm.locator('input[name="consentDate"]').fill(new Date().toISOString().slice(0, 10));
  const approvedName = 'QA schválená syntetická referencia';
  const approvedText = 'Syntetický text použitý iba na overenie admin formulára.';
  await editForm.locator('input[name="customerName"]').fill(approvedName);
  await editForm.locator('textarea[name="text"]').fill(approvedText);

  const submitted = await editForm.evaluate((form) => Object.fromEntries(new FormData(form).entries()));
  assert.equal(submitted.status, 'approved', 'the form payload before submit must carry the selected state');
  assert.equal(submitted.customerName, approvedName, 'the form payload before submit must carry the edited name');
  assert.equal(submitted.text, approvedText, 'the form payload before submit must carry the edited testimonial text');
  await editForm.evaluate((form) => {
    form.addEventListener('submit', (event) => {
      const data = new FormData(event.currentTarget);
      window.__testimonialSubmittedValues = {
        status: String(data.get('status') || ''),
        customerName: String(data.get('customerName') || ''),
        text: String(data.get('text') || ''),
      };
    }, { capture: true, once: true });
  });
  await editForm.getByRole('button', { name: 'Uložiť zmeny' }).click();
  assert.deepEqual(await page.evaluate(() => window.__testimonialSubmittedValues), {
    status: 'approved', customerName: approvedName, text: approvedText,
  }, 'the browser submit event must carry the exact selected status and edited public content');
  await page.waitForURL((url) => url.searchParams.get('ulozene') === '1', { timeout: 30_000 });
  const saved = await database.query('SELECT status, customer_name, text, consent_publication FROM testimonials WHERE id=$1', [id]);
  assert.deepEqual(saved.rows[0], {
    status: 'approved', customer_name: approvedName, text: approvedText, consent_publication: true,
  }, 'the same DB row must persist the approved state, edited text and explicit consent');
  assert.equal(deniedOrigins.length, 0, `browser attempted external requests: ${deniedOrigins.join(', ')}`);
  assert.equal((await database.query('SELECT COUNT(*)::int AS count FROM leads')).rows[0].count, 0,
    'the isolated reference workflow must not create leads');
  const outboxCount = (await database.query('SELECT COUNT(*)::int AS count FROM lead_email_outbox')).rows[0].count;
  assert.equal(outboxCount, 0, 'the isolated reference workflow must not enqueue email');
  console.log(JSON.stringify({ result: 'PASS', submittedStatus: 'approved', persistedStatus: 'approved', syntheticOnly: true, leads: 0, emailOutbox: outboxCount, browserExternalOrigins: deniedOrigins.length, serverNodeApiGuard: 'TCP/HTTP/HTTPS/Undici + DNS/UDP blocked; not an OS-level subprocess sandbox' }));
} catch (error) {
  console.error('Isolated testimonial admin browser test failed:', error.message);
  console.error('Local Next diagnostics:', logs.join('').slice(-4500));
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(child);
  await socket?.stop();
  await database?.close();
  const marker = await readFile(path.join(tempRoot, '.harness-owner'), 'utf8').catch(() => '');
  const resolvedRoot = path.resolve(tempRoot);
  assert.equal(path.dirname(resolvedRoot).toLowerCase(), tempParent.toLowerCase(), 'cleanup target must be directly under the OS temp directory');
  assert.match(path.basename(resolvedRoot), /^astana-testimonial-form-[A-Za-z0-9]+$/, 'cleanup target must match this harness temp');
  assert.equal(marker, owner, 'cleanup target must carry this run’s exclusive ownership marker');
  const dependencyLink = path.join(tempRoot, 'node_modules');
  if ((await lstat(dependencyLink).catch(() => null))?.isSymbolicLink()) await unlink(dependencyLink);
  await rm(tempRoot, { recursive: true });
  console.log(`Cleanup PASS: owned temp root removed: ${tempRoot}`);
}
