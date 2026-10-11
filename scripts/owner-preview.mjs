/** Persistent, public-only owner preview. No production env or database.
 * node scripts/owner-preview.mjs start
 * node scripts/owner-preview.mjs status <runtime-directory>
 * node scripts/owner-preview.mjs stop <runtime-directory>
 * Reuses the existing harness's temporary-copy pattern and network guard.
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cp, lstat, mkdtemp, open, readFile, readdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(import.meta.url);
const project = path.resolve(path.dirname(script), '..');
const marker = 'owner-preview.json';
const prefix = 'astana-owner-preview-';
const command = process.argv[2];
const csp = [
  "default-src 'self'", "base-uri 'self'", "form-action 'none'",
  "frame-ancestors 'none'", "object-src 'none'", "frame-src 'none'",
  "img-src 'self' data: blob:", "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self'", "worker-src 'none'",
].join('; ');

function environment(root) {
  const result = Object.fromEntries(
    ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']
      .filter((key) => process.env[key]).map((key) => [key, process.env[key]]),
  );
  return Object.assign(result, {
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    TEMP: root, TMP: root,
    ASTANA_LOCAL_DB_PATH: path.join(root, '.data', 'empty-local-db.json'),
    ASTANA_TEST_NETWORK_GUARD: '1',
    NODE_OPTIONS: `--import=${pathToFileURL(path.join(root, 'network-guard.mjs')).href}`,
  });
}

async function readMarker(directory) {
  assert.ok(directory, 'An explicit runtime directory is required.');
  const root = await realpath(directory);
  assert.ok(path.basename(root).startsWith(prefix), 'Unowned directory.');
  assert.equal((await lstat(root)).isSymbolicLink(), false);
  const state = JSON.parse(await readFile(path.join(root, marker), 'utf8'));
  assert.equal(state.kind, 'astana-owner-preview-v1');
  assert.equal(state.root, root);
  assert.equal(state.project, project);
  assert.equal(state.script, script);
  assert.match(state.token, /^[a-f0-9]{64}$/);
  return state;
}

async function save(state) {
  await writeFile(path.join(state.root, marker), JSON.stringify(state, null, 2), 'utf8');
}

async function copySnapshot(root) {
  const filter = async (entry) => {
    if (/^\.env(?:\.|$)/i.test(path.basename(entry))) return false;
    assert.equal((await lstat(entry)).isSymbolicLink(), false, `Source symlink refused: ${entry}`);
    return true;
  };
  for (const name of ['app', 'src', 'public', 'package.json', 'next.config.mjs', 'tsconfig.json', 'proxy.ts']) {
    await cp(path.join(project, name), path.join(root, name), { recursive: true, filter });
  }
  await cp(path.join(project, 'scripts', 'test-loopback-network-guard.mjs'), path.join(root, 'network-guard.mjs'));
  await symlink(await realpath(path.join(project, 'node_modules')), path.join(root, 'node_modules'), 'junction');
  const hash = createHash('sha256');
  let files = 0;
  async function visit(relative) {
    const entry = path.join(root, relative);
    if ((await lstat(entry)).isDirectory()) {
      for (const name of (await readdir(entry)).sort()) await visit(path.join(relative, name));
    } else {
      hash.update(relative.replaceAll('\\', '/') + '\0').update(await readFile(entry));
      files++;
    }
  }
  for (const name of ['app', 'src', 'package.json', 'next.config.mjs', 'tsconfig.json', 'proxy.ts', 'network-guard.mjs']) await visit(name);
  return { sourceSha256: hash.digest('hex'), sourceFiles: files };
}

async function start() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), prefix)));
  console.log(`Preparing isolated snapshot: ${root}`);
  const snapshot = await copySnapshot(root);
  const state = {
    kind: 'astana-owner-preview-v1', root, project, script, ...snapshot,
    token: randomBytes(32).toString('hex'), createdAt: new Date().toISOString(),
    state: 'starting', database: 'empty disposable local JSON; no SQL connection',
  };
  await save(state);
  const stdout = await open(path.join(root, 'stdout.log'), 'a');
  const stderr = await open(path.join(root, 'stderr.log'), 'a');
  const child = spawn(process.execPath, [script, 'serve', root], {
    cwd: root, env: environment(root), detached: true, windowsHide: true,
    stdio: ['ignore', stdout.fd, stderr.fd],
  });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
  await stdout.close();
  await stderr.close();
  console.log(JSON.stringify({ root, pid: child.pid, ...snapshot, status: 'starting',
    statusCommand: `node scripts/owner-preview.mjs status "${root}"`,
    stopCommand: `node scripts/owner-preview.mjs stop "${root}"` }, null, 2));
}

function routeAllowed(method, pathname) {
  if (!['GET', 'HEAD'].includes(method)) return false;
  if (/^\/(?:api|admin|__nextjs[^/]*|dopyt-prijaty)(?:\/|$)/i.test(pathname)) return false;
  if (/^\/spolupraca\/fotky(?:\/|$)/i.test(pathname)) return false;
  if (pathname.startsWith('/_next/') && !pathname.startsWith('/_next/static/') && !['/_next/image', '/_next/image/'].includes(pathname)) return false;
  return true;
}

async function serve(directory) {
  const state = await readMarker(directory);
  assert.equal(process.cwd(), state.root);
  assert.equal(process.env.ASTANA_TEST_NETWORK_GUARD, '1');
  assert.equal(process.env.NEXT_TELEMETRY_DISABLED, '1');
  assert.equal(process.env.ASTANA_LOCAL_DB_PATH, path.join(state.root, '.data', 'empty-local-db.json'));
  assert.deepEqual(Object.keys(process.env).filter((key) => /^(?:DATABASE_|POSTGRES|PG(?:HOST|PORT|USER|PASSWORD|DATABASE)|SMTP|ASTANA_RELAY|BLOB_|PHOTO_INTAKE_BLOB|S3_|AWS_|VERCEL|AUTH_SECRET|ADMIN_|CRON_|NEXT_PUBLIC_)/i.test(key)), []);
  assert.equal((await readdir(state.root)).some((name) => /^\.env(?:\.|$)/i.test(name)), false);
  const counters = { reads: 0, blockedRequests: 0 };
  let ready = false;
  let app;
  let stopping = false;
  let origin;
  const server = createServer(async (req, res) => {
    const securityHeaders = {
      'Content-Security-Policy': csp, 'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
      'X-Astana-Owner-Preview': 'public-read-only',
    };
    // Preserve isolation even if the original Next config supplies wider CSP.
    const writeHead = res.writeHead;
    res.writeHead = function (...args) {
      const headerIndex = typeof args[1] === 'string' ? 2 : 1;
      if (args[headerIndex]) {
        const supplied = args[headerIndex];
        assert.equal(Array.isArray(supplied), false, 'Unexpected raw response headers.');
        for (const key of Object.keys(supplied)) {
          if (Object.keys(securityHeaders).some((name) => name.toLowerCase() === key.toLowerCase())) delete supplied[key];
        }
      }
      for (const [name, value] of Object.entries(securityHeaders)) this.setHeader(name, value);
      return writeHead.apply(this, args);
    };
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    try {
      if (req.headers.host !== new URL(origin).host) return reply(403, { error: 'Loopback host required.' });
      if (req.headers.origin && req.headers.origin !== origin) return reply(403, { error: 'Same origin required.' });
      let pathname = decodeURIComponent(new URL(req.url, origin).pathname);
      if (pathname.includes('\\') || pathname.includes('%') || pathname.includes('\0')) return reply(400, { error: 'Invalid path.' });
      pathname = path.posix.normalize(pathname);
      if (pathname === '/__owner-preview__/status' && req.method === 'GET') {
        return reply(200, { kind: state.kind, id: state.createdAt, ready, pid: process.pid, origin, ...counters,
          sourceSha256: state.sourceSha256, sqlConnected: false, productionCredentials: false, writesAllowed: false,
          browserPolicy: csp, serverNetwork: 'existing loopback-only guard; DNS and UDP blocked' });
      }
      if (pathname === '/__owner-preview__/stop' && req.method === 'POST' && req.headers['x-owner-preview-token'] === state.token) {
        reply(200, { stopping: true, pid: process.pid });
        setTimeout(() => void stop(), 100);
        return;
      }
      if (!routeAllowed(req.method, pathname) || pathname.startsWith('/__owner-preview__/')) {
        counters.blockedRequests++;
        return reply(403, { error: 'Lokálny náhľad: odosielanie, API a administrácia sú vypnuté.' });
      }
      if (pathname === '/robots.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('User-agent: *\nDisallow: /\n'); return;
      }
      if (!ready) return reply(503, { error: 'Náhľad sa pripravuje.' });
      counters.reads++;
      await app.getRequestHandler()(req, res);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) reply(500, { error: 'Chyba lokálneho náhľadu.' });
      else res.end();
    }
  });
  // Next 16 streams development React debug data over its same-origin HMR
  // connection. Blocking it can leave hydration pending despite HTTP 200.
  server.on('upgrade', (req, socket, head) => {
    if (!ready || req.method !== 'GET' || req.headers.host !== new URL(origin).host
      || req.headers.origin !== origin || new URL(req.url, origin).pathname !== '/_next/hmr') {
      socket.destroy(); return;
    }
    void app.getUpgradeHandler()(req, socket, head);
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  origin = `http://127.0.0.1:${port}`;
  Object.assign(state, { pid: process.pid, origin });
  await save(state);
  async function stop() {
    if (stopping) return;
    stopping = true;
    ready = false;
    const timeout = setTimeout(() => process.exit(0), 5000);
    timeout.unref();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (app) await app.close();
    state.state = 'stopped'; state.stoppedAt = new Date().toISOString();
    await save(state);
    process.exit(0);
  }
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());
  const { default: next } = await import('next');
  app = next({ dev: true, dir: state.root, hostname: '127.0.0.1', port, webpack: true });
  try {
    await app.prepare();
    ready = true;
    state.state = 'ready';
    await save(state);
    console.log(JSON.stringify({ ready, pid: process.pid, origin, sourceSha256: state.sourceSha256 }));
  } catch (error) {
    console.error(error);
    await stop();
  }
}

async function control(directory, stopRequested) {
  const state = await readMarker(directory);
  assert.match(state.origin || '', /^http:\/\/127\.0\.0\.1:\d+$/);
  const result = await fetch(`${state.origin}/__owner-preview__/status`, { signal: AbortSignal.timeout(5000) });
  assert.equal(result.status, 200);
  const info = await result.json();
  assert.equal(info.id, state.createdAt, 'Refusing to control another instance.');
  assert.equal(info.pid, state.pid, 'Refusing to control another process.');
  assert.equal(info.kind, state.kind);
  if (!stopRequested) return console.log(JSON.stringify({ ...info, root: state.root }, null, 2));
  const stopped = await fetch(`${state.origin}/__owner-preview__/stop`, {
    method: 'POST', headers: { 'x-owner-preview-token': state.token }, signal: AbortSignal.timeout(5000),
  });
  assert.equal(stopped.status, 200);
  console.log(`Stopping only owner preview PID ${state.pid}. Temporary snapshot retained at ${state.root}`);
}

async function verify(directory) {
  const homeOnly = process.argv.includes('--home-only');
  const state = await readMarker(directory);
  assert.match(state.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  const before = await (await fetch(`${state.origin}/__owner-preview__/status`)).json();
  assert.equal(before.id, state.createdAt);
  assert.equal(before.ready, true);
  for (const route of ['/api/analytics/', '/api/cron/', '/admin/', '/spolupraca/fotky/']) {
    const response = await fetch(state.origin + route);
    assert.equal(response.status, 403, `Private route not blocked: ${route}`);
  }
  // This is a runner-only probe, never a form or an application endpoint.
  const probe = await fetch(`${state.origin}/__owner-preview__/write-probe`, { method: 'POST' });
  assert.equal(probe.status, 403);
  const crossOrigin = await fetch(state.origin, { headers: { Origin: 'https://example.invalid' } });
  assert.equal(crossOrigin.status, 403);
  const { chromium, expect } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, args: ['--no-first-run', '--disable-background-networking', '--disable-extensions'],
  });
  const report = { pages: [], interactions: [], galleryImages: [], homepageVisuals: [], externalRequests: [], blockedBrowserWrites: [], pageErrors: [], failedAssets: [], blockedDevelopmentAssets: [], formsSubmitted: 0 };
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', async (route) => {
      const request = route.request();
      const target = new URL(request.url());
      if (target.origin !== state.origin) {
        report.externalRequests.push(target.origin);
        return route.abort('blockedbyclient');
      }
      if (!['GET', 'HEAD'].includes(request.method())) {
        report.blockedBrowserWrites.push(new URL(request.url()).pathname);
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400 && (/\.(?:js|css|webp|avif|jpg|png|woff2?)(?:\?|$)/.test(response.url()) || /^\/_next\/image\/?$/.test(new URL(response.url()).pathname))) {
        const entry = { url: response.url(), status: response.status() };
        if (response.status() === 403 && new URL(response.url()).pathname.startsWith('/__nextjs_font/')) {
          report.blockedDevelopmentAssets.push(entry);
        } else report.failedAssets.push(entry);
      }
    });
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      for (const route of (homeOnly ? ['/'] : ['/', '/cena/', '/realizacie/', '/kariera/', '/kontakt/', '/poradna/'])) {
        const response = await page.goto(state.origin + route, { waitUntil: 'networkidle', timeout: 60000 });
        assert.equal(response.status(), 200, `${route}: HTTP error`);
        assert.equal(response.headers()['content-security-policy'], csp);
        assert.match(response.headers()['x-robots-tag'], /noindex/);
        assert.equal(await page.locator('h1').count(), 1, `${route}: missing/duplicate H1`);
        const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        assert.ok(overflow <= 1, `${route}: ${overflow}px horizontal overflow at ${viewport.width}px`);
        report.pages.push({ route, width: viewport.width, status: response.status(), overflow, h1: await page.locator('h1').innerText() });
        console.log(`Verified ${viewport.width}px ${route}`);
        if (route === '/') await page.screenshot({ path: path.join(state.root, `homepage-${viewport.width}.png`) });
        if (['/', '/cena/', '/realizacie/'].includes(route)) {
          const name = route === '/' ? 'homepage' : route.replaceAll('/', '');
          // Trigger ordinary lazy images before capturing the full document.
          await page.evaluate(async () => {
            for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight) {
              scrollTo({ top, behavior: 'instant' });
              await new Promise((resolve) => setTimeout(resolve, 60));
            }
            scrollTo({ top: 0, behavior: 'instant' });
          });
          await page.waitForLoadState('networkidle');
          await page.waitForFunction(() => Array.from(document.images)
            .filter((img) => img.getBoundingClientRect().width > 0 && img.getBoundingClientRect().height > 0 && getComputedStyle(img).visibility !== 'hidden')
            .every((img) => img.complete && img.naturalWidth > 0), undefined, { timeout: 15000 });
          await page.screenshot({ path: path.join(state.root, `${name}-${viewport.width}-full.png`), fullPage: true });
          report.interactions.push(`${viewport.width}px ${route}: rendered images loaded with naturalWidth > 0`);
          if (route === '/') {
            const gallery = page.locator('[data-home-gallery-card]');
            assert.equal(await gallery.count(), 3);
            const photos = await gallery.locator('img').evaluateAll((images) => images.map((img) => ({
              src: img.currentSrc, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
            })));
            assert.equal(photos.length, 3);
            assert.ok(photos.every((photo) => photo.naturalWidth > 0));
            report.galleryImages.push({ width: viewport.width, photos });
            await gallery.first().locator('..').screenshot({ path: path.join(state.root, `gallery-${viewport.width}.png`) });
            assert.match(photos[1].src, /azbest-057/);
            const calculator = page.locator('#orientacna-cena');
            assert.equal(await calculator.locator('[data-price-city]').count(), 0);
            const visual = await page.evaluate(() => {
              const calculator = document.querySelector('#orientacna-cena');
              const materials = [...calculator.querySelectorAll('[data-price-material]')];
              return {
                width: innerWidth,
                calculatorHeight: calculator.getBoundingClientRect().height,
                trustColors: [...document.querySelectorAll('#preco h2, #preco strong')].map((el) => getComputedStyle(el).color),
                activeColor: getComputedStyle(calculator.querySelector('.is-active')).color,
                eyebrowColor: getComputedStyle(calculator.querySelector('.eyebrow')).color,
                buttonHeights: materials.map((el) => el.getBoundingClientRect().height),
                // offsetTop ignores the active button's intentional -1px transform.
                materialRows: new Set(materials.map((el) => el.offsetTop)).size,
              };
            });
            assert.ok(visual.trustColors.every((color) => color === 'rgb(255, 255, 255)'), 'trust titles stay light on navy, including mobile');
            assert.equal(visual.activeColor, 'rgb(255, 255, 255)');
            if (viewport.width <= 820) assert.equal(visual.eyebrowColor, 'rgb(143, 22, 60)');
            assert.equal(visual.materialRows, 2);
            assert.ok(visual.buttonHeights.every((height) => height >= 44));
            assert.ok(visual.calculatorHeight <= (viewport.width >= 1024 ? 550 : 800), `calculator too tall: ${visual.calculatorHeight}`);
            report.homepageVisuals.push(visual);
            await calculator.screenshot({ path: path.join(state.root, `calculator-${viewport.width}.png`) });
            await page.locator('#preco').screenshot({ path: path.join(state.root, `trust-${viewport.width}.png`) });
            await page.locator('[data-price-area]').press('End');
            await expect(page.locator('[data-price-area]')).toHaveValue('500');
            for (const material of ['vlnity', 'hladky', 'boleticky', 'neviem']) {
              await page.locator(`[data-price-material="${material}"]`).click();
              const fit = await page.locator('.price-result').evaluate((result) => {
                const text = document.createRange();
                text.selectNodeContents(result.querySelector('strong'));
                const rect = result.getBoundingClientRect();
                const style = getComputedStyle(result);
                const content = text.getBoundingClientRect();
                return content.right <= rect.right - parseFloat(style.paddingRight) + 1
                  && content.left >= rect.left + parseFloat(style.paddingLeft) - 1;
              });
              assert.ok(fit, `${viewport.width}px maximum ${material} price must fit inside its result panel`);
            }
            await page.locator('[data-price-area]').press('Home');
            for (let step = 0; step < 11; step += 1) await page.locator('[data-price-area]').press('ArrowRight');
            await page.locator('#city').fill('Zachovaná obec');
            await page.locator('[data-price-area]').press('ArrowRight');
            await page.locator('[data-price-material="hladky"]').click();
            await page.locator('[data-price-quote]').click();
            await expect(page.locator('#areaEstimate')).toHaveValue('130');
            await expect(page.locator('#materialType')).toHaveValue('Hladký / štvorcový eternit');
            await expect(page.locator('#city')).toHaveValue('Zachovaná obec');
            await expect(page.locator('#email')).toHaveValue('');
            assert.equal(await page.locator('input[name="gdpr"]').isChecked(), false);
            report.interactions.push(`${viewport.width}px homepage calculator: no city field; area/material transferred, existing city preserved; no submit`);
          }
        }
        if (route === '/' && viewport.width === 320) {
          const menu = page.locator('.menu-toggle');
          await menu.click();
          assert.equal(await menu.getAttribute('aria-expanded'), 'true');
          await menu.click();
          assert.equal(await menu.getAttribute('aria-expanded'), 'false');
          report.interactions.push('320px mobile menu opens and closes');
        }
        if (route === '/cena/') {
          assert.equal(await page.locator('[data-price-city]').count(), 0, 'price calculator must stay compact without a locality field');
          const area = page.locator('[data-price-area]');
          await area.focus();
          await area.press('ArrowRight');
          assert.equal(await area.inputValue(), '130');
          const material = page.locator('[data-price-material="hladky"]');
          await material.click();
          await expect(material).toHaveAttribute('aria-pressed', 'true');
          await expect(page.locator('[data-price-area-output]')).toHaveText('130 m2');
          assert.equal(Number((await page.locator('[data-price-min]').innerText()).replace(/\D/g, '')), 1170);
          assert.equal(Number((await page.locator('[data-price-max]').innerText()).replace(/\D/g, '')), 1950);
          report.interactions.push(`${viewport.width}px calculator: keyboard area change and material selection`);
          await page.locator('[data-price-quote]').click();
          await page.waitForURL(`${state.origin}/#dopyt`);
          await expect(page.locator('#areaEstimate')).toHaveValue('130');
          await expect(page.locator('#city')).toHaveValue('');
          await expect(page.locator('#materialType')).toHaveValue('Hladký / štvorcový eternit');
          await expect(page.locator('#email')).toHaveValue('');
          assert.equal(await page.locator('input[name="gdpr"]').isChecked(), false);
          report.interactions.push(`${viewport.width}px calculator prefill: no locality field; area and material transferred; email, city and GDPR untouched; no submit`);
        }
      }
    }
    assert.deepEqual(report.externalRequests, []);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.failedAssets, []);
    const data = JSON.parse(await readFile(path.join(state.root, '.data', 'empty-local-db.json'), 'utf8'));
    const nonEmptyCollections = Object.entries(data).filter(([, value]) => Array.isArray(value) && value.length > 0).map(([key]) => key);
    assert.deepEqual(nonEmptyCollections, [], 'Preview must retain empty business and analytics collections.');
    const after = await (await fetch(`${state.origin}/__owner-preview__/status`)).json();
    assert.equal(after.writesAllowed, false);
    report.status = 'PASS';
    report.scope = homeOnly ? 'homepage only: three widths and gallery assets' : 'six public routes: three widths, gallery assets and calculator prefill';
    report.checkedAt = new Date().toISOString();
    report.sourceSha256 = state.sourceSha256;
    report.nonEmptyCollections = nonEmptyCollections;
    await writeFile(path.join(state.root, 'verification.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

if (command === 'start') await start();
else if (command === 'serve') await serve(process.argv[3]);
else if (command === 'status' || command === 'stop') await control(process.argv[3], command === 'stop');
else if (command === 'verify') await verify(process.argv[3]);
else throw new Error('Usage: node scripts/owner-preview.mjs start | status <runtime-directory> | stop <runtime-directory> | verify <runtime-directory>');
