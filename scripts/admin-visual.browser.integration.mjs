/**
 * Isolated read-only visual audit for core admin screens.
 * Uses a temporary source copy, loopback-only PGlite and a signed synthetic
 * admin session. It never loads env files, submits a form or contacts production.
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
const tempRoot = await mkdtemp(path.join(tempParent, 'astana-admin-visual-'));
const owner = randomUUID();
const adminEmail = 'admin@local.test';
const secret = Buffer.from(randomUUID() + randomUUID()).toString('hex');
const outputRoot = path.join(projectRoot, 'tmp', `admin-visual-${Date.now()}`);
const syntheticIds = Object.freeze({
  lead: '11111111-1111-4111-8111-111111111111',
  job: '22222222-2222-4222-8222-222222222222',
  offer: '33333333-3333-4333-8333-333333333333',
  career: '44444444-4444-4444-8444-444444444444',
  submission: '55555555-5555-4555-8555-555555555555',
});
const logs = [];
const pageErrors = [];
const consoleErrors = [];
const deniedOrigins = [];
const nonGetRequests = [];
let database, socket, browser, child;

const allRoutes = [
  ['/admin/dashboard/', 'dashboard'],
  ['/admin/dopyty/', 'dopyty'],
  [`/admin/dopyty/${syntheticIds.lead}/`, 'dopyt-detail'],
  ['/admin/ponuky/', 'ponuky'],
  ['/admin/ponuky/nova/', 'ponuka-nova'],
  [`/admin/ponuky/${syntheticIds.offer}/`, 'ponuka-detail'],
  ['/admin/zakazky/', 'zakazky'],
  ['/admin/zakazky/nova/', 'zakazka-nova'],
  [`/admin/zakazky/${syntheticIds.job}/`, 'zakazka-detail'],
  ['/admin/kariera/', 'kariera'],
  [`/admin/kariera/${syntheticIds.career}/`, 'kariera-detail'],
  ['/admin/realizacie/fotky/', 'fotky'],
  ['/admin/reviews/request/', 'review-request'],
  ['/admin/reviews/request/?result=invalid&attempt=visual-invalid', 'review-request-invalid'],
  ['/admin/reviews/request/?result=saved&attempt=visual-saved', 'review-request-saved'],
  ['/admin/nastavenia/', 'nastavenia'],
  ['/admin/analytics/', 'analytics'],
];
const routes = process.argv.includes('--review-only')
  ? allRoutes.filter(([, slug]) => slug.startsWith('review-request'))
  : allRoutes;

const viewports = [
  { width: 1440, height: 1000, name: 'desktop', screenshot: true },
  { width: 1201, height: 900, name: 'boundary-1201', screenshot: false },
  { width: 1200, height: 900, name: 'boundary-1200', screenshot: true },
  { width: 961, height: 900, name: 'boundary-961', screenshot: false },
  { width: 960, height: 900, name: 'boundary-960', screenshot: true },
  { width: 901, height: 900, name: 'boundary-901', screenshot: false },
  { width: 900, height: 900, name: 'boundary-900', screenshot: true },
  { width: 721, height: 900, name: 'boundary-721', screenshot: false },
  { width: 720, height: 900, name: 'boundary-720', screenshot: true },
  { width: 481, height: 844, name: 'boundary-481', screenshot: false },
  { width: 480, height: 844, name: 'boundary-480', screenshot: true },
  { width: 390, height: 844, name: 'mobile-390', screenshot: true },
  { width: 320, height: 844, name: 'mobile-320', screenshot: true },
];

async function seedSyntheticAdminData(database) {
  const longName = 'Ing. Alexandra Mária Veľmi-Dlhé-Priezvisko – lokálna vizuálna skúška administrácie';
  await database.query(
    `UPDATE admin_users SET name = $2, role = 'SUPER_ADMIN', active = true WHERE email = $1`,
    [adminEmail, longName],
  );
  await database.query(
    `INSERT INTO leads (
       id, submission_id, status, full_name, phone, email, city, district,
       object_type, material_type, area_estimate, preferovany_kontakt, roofer,
       term, note, internal_note, next_action, followup_date, raw_data, is_test_data
     ) VALUES (
       $1, $2, 'novy', $3, '+421 900 123 456',
       'synteticky.velmi-dlhy-email-pre-vizualny-audit@example.invalid',
       'Najdlhšia testovacia obec pod Vysokými Tatrami', 'Poprad',
       'Hospodárska budova s veľmi dlhým opisom', 'Vlnitý azbestocementový eternit',
       777.75, 'Napíšte mi email', 'Strechára už mám', 'Do troch mesiacov',
       $4, $5, $6, DATE '2026-10-20', $7::jsonb, true
     )`,
    [
      syntheticIds.lead,
      syntheticIds.submission,
      longName,
      'Syntetická poznámka s dlhším textom preveruje zalomenie obsahu bez použitia reálnych osobných údajov.',
      'Iba lokálny vizuálny audit. Nekontaktovať a neposielať.',
      'Skontrolovať syntetický vizuálny audit a dlhé texty v detaile dopytu.',
      JSON.stringify({ sourceUrl: '/synteticky-vizualny-audit', note: 'Výhradne lokálne testovacie údaje.' }),
    ],
  );
  await database.query(
    `INSERT INTO business_jobs (
       id, lead_id, demolition_date, customer_name, customer_phone, customer_email,
       location, district, material_type, object_type, term, lead_source,
       preferovany_kontakt, m2, price_per_m2, total_price, status, note, is_test_data
     ) VALUES (
       $1, $2, DATE '2026-11-18', $3, '+421 900 123 456',
       'synteticky.velmi-dlhy-email-pre-vizualny-audit@example.invalid',
       'Syntetická ulica 1234/567, Najdlhšia testovacia obec pod Vysokými Tatrami',
       'Poprad', 'Vlnitý eternit (AZC)', 'Hospodárska budova', 'Do troch mesiacov',
       'Lokálny vizuálny audit', 'Emailom', 777.75, 10.50, 8166.38,
       'DOPYT', $4, true
     )`,
    [syntheticIds.job, syntheticIds.lead, longName, 'Syntetická zákazka určená iba na overenie rozloženia detailnej obrazovky.'],
  );
  await database.query(
    `INSERT INTO price_offers (
       id, number, job_id, lead_id, valid_until, object_type, object_address,
       municipality, district, contact_person, phone, email, realization_term,
       material_type, area_m2, price_per_m2_without_vat, documentation_fee_without_vat,
       include_documentation, documentation_promotion, include_transport,
       transport_from, transport_to, transport_round_trip_km, transport_price_per_km,
       material_price_without_vat, total_without_vat, total_with_vat,
       offer_note, internal_note, status, source_inquiry, source_job_ids, is_test_data
     ) VALUES (
       $1, 'VIZUAL-20260001', $2, $3, DATE '2026-12-31', 'Hospodárska budova',
       'Syntetická ulica 1234/567', 'Najdlhšia testovacia obec pod Vysokými Tatrami',
       'Poprad', $4, '+421 900 123 456',
       'synteticky.velmi-dlhy-email-pre-vizualny-audit@example.invalid', 'Do troch mesiacov',
       'VLNITY_ETERNIT', 777.75, 10.50, 161, true, false, true,
       'Poprad – sídlo ASTANA, s.r.o.', 'Najdlhšia testovacia obec pod Vysokými Tatrami',
       248.60, 0.70, 8166.38, 8501.40, 10456.72, $5, $6,
       'PRIPRAVENA', $7, ARRAY[$2]::uuid[], true
     )`,
    [
      syntheticIds.offer,
      syntheticIds.job,
      syntheticIds.lead,
      longName,
      'Syntetická cenová ponuka na kontrolu čitateľnosti, prepočtov a zalamovania dlhších textov.',
      'Výhradne lokálny audit – ponuku nikdy neodosielať.',
      `dopyt:${syntheticIds.lead}`,
    ],
  );
  await database.query(
    `INSERT INTO career_applications (
       id, submission_id, status, owner_email, next_action, followup_date,
       full_name, phone, email, city, cooperation_type, work_regions,
       has_trade_license, work_at_heights, has_asbestos_experience,
       asbestos_experience, experience, note, privacy_consent
     ) VALUES (
       $1, $2, 'reviewed', $3, $4, DATE '2026-10-22', $5, '+421 900 123 456',
       'synteticky.velmi-dlhy-email-pre-vizualny-audit@example.invalid',
       'Najdlhšia testovacia obec pod Vysokými Tatrami', 'szco',
       'Celé Slovensko, skoré ranné výjazdy z Popradu a práca vo výškach',
       true, true, true, $6, $7, $8, true
     )`,
    [
      syntheticIds.career,
      'synthetic-admin-visual-application',
      adminEmail,
      'Lokálne preveriť zalomenie veľmi dlhých údajov na detailnej stránke uchádzača.',
      longName,
      'Syntetická skúsenosť: demontáž AZC krytiny, bezpečné balenie a príprava na odvoz.',
      'Dlhší syntetický opis praxe vo výškach, práce na strechách a koordinácie so strechármi po celom Slovensku.',
      'Výhradne lokálny vizuálny audit. Kandidáta nekontaktovať.',
    ],
  );
}

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
    if (child.exitCode !== null) throw new Error(`Next skončil predčasne (${child.exitCode}): ${logs.join('').slice(-3500)}`);
    try {
      const response = await fetch(origin + '/admin/dashboard/', {
        redirect: 'manual',
        headers: { Cookie: `astana_admin_session=${sessionCookie()}` },
        signal: AbortSignal.timeout(1500),
      });
      if (response.status === 200) return;
    } catch { /* server ešte štartuje */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Next sa nespustil do 90 sekúnd: ${logs.join('').slice(-3500)}`);
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
  if (await waitForExit(5000) || processHandle.exitCode !== null || processHandle.signalCode !== null) return;
  throw new Error(`Vlastný lokálny Next proces ${processHandle.pid} sa nepodarilo ukončiť.`);
}

function sessionCookie() {
  const payload = Buffer.from(JSON.stringify({ email: adminEmail, iat: Date.now() })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

try {
  await writeFile(path.join(tempRoot, '.harness-owner'), owner, { flag: 'wx' });
  await mkdir(outputRoot, { recursive: true });
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
  const appPort = await freePort();
  const dbPort = await freePort();
  assert.notEqual(appPort, dbPort);
  const origin = `http://127.0.0.1:${appPort}`;
  const databaseUrl = `postgres://astana_test:astana_test@127.0.0.1:${dbPort}/astana_test`;
  database = await PGlite.create();
  socket = new PGLiteSocketServer({ db: database, port: dbPort, host: '127.0.0.1', maxConnections: 32 });
  await socket.start();

  const childEnv = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']
    .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  Object.assign(childEnv, {
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: databaseUrl,
    DATABASE_POOL_MAX: '1',
    AUTH_SECRET: secret, ADMIN_EMAIL: adminEmail, ALLOWED_ORIGINS: origin,
    TEMP: tempRoot, TMP: tempRoot, ASTANA_TEST_NETWORK_GUARD: '1',
    ASTANA_TEST_APP_ROOT: tempRoot, ASTANA_TEST_APP_PORT: String(appPort),
    NODE_OPTIONS: `--import=${pathToFileURL(path.join(projectRoot, 'scripts', 'test-loopback-network-guard.mjs')).href}`,
  });
  child = spawn(process.execPath, [path.join(projectRoot, 'scripts', 'testimonial-admin-form-server.mjs')],
    { cwd: tempRoot, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  await waitForApp(origin);
  await seedSyntheticAdminData(database);

  const browserPath = process.env.ASTANA_HARNESS_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.ok(existsSync(browserPath), 'Edge chýba; ASTANA_HARNESS_BROWSER môže určiť lokálny Chromium prehliadač.');
  browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-first-run', '--disable-background-networking'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) {
      nonGetRequests.push(`${request.method()} ${request.url()}`);
      return route.abort('blockedbyclient');
    }
    const target = new URL(request.url());
    if (target.origin === origin) return route.continue();
    deniedOrigins.push(target.origin);
    return route.abort('blockedbyclient');
  });
  await context.addCookies([{ name: 'astana_admin_session', value: sessionCookie(), url: origin, httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  const report = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [routePath, slug] of routes) {
      const response = await page.goto(origin + routePath, { waitUntil: 'networkidle', timeout: 60_000 });
      assert.equal(response?.status(), 200, `${routePath} musí v izolovanom admine odpovedať 200.`);
      assert.equal(await page.locator('h1').count(), 1, `${routePath} musí mať práve jeden H1.`);
      if (slug === 'review-request-invalid' || slug === 'review-request-saved') {
        const expectedRole = slug === 'review-request-invalid' ? 'alert' : 'status';
        const resultMessage = page.locator(`[role="${expectedRole}"]`).first();
        await resultMessage.waitFor({ state: 'visible' });
        assert.equal(await resultMessage.evaluate((element) => document.activeElement === element), true,
          `${routePath} musí po internom presmerovaní zaostriť výsledok.`);
      }
      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const rectOf = (element) => {
          const rect = element?.getBoundingClientRect();
          return rect ? {
            left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
            width: rect.width, height: rect.height,
          } : null;
        };
        const isRendered = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden'
            && Number(style.opacity || '1') !== 0 && rect.width > 0 && rect.height > 0;
        };
        const sidebarElement = document.querySelector('.admin-sidebar');
        const mainElement = document.querySelector('.admin-main');
        const sidebar = rectOf(sidebarElement);
        const main = rectOf(mainElement);
        const h1Element = document.querySelector('h1');
        const h1 = rectOf(h1Element);
        const mobileNavigation = document.querySelector('.admin-navigation-mobile');
        const desktopNavigation = document.querySelector('.admin-navigation-desktop');
        // Native inputs (especially date/select controls) can report an internal
        // scrollWidth larger than their visible box even when the control itself
        // is fully contained. Document/control geometry catches that class of
        // defect; this list is deliberately limited to rendered text containers.
        const clippedControls = [...document.querySelectorAll('h1,h2,h3,button,a,label,legend,summary')]
          .filter((element) => {
            const node = element;
            if (!isRendered(node) || node.closest('.admin-table-wrap')) return false;
            return node.scrollWidth > node.clientWidth + 4;
          })
          .map((element) => ({
            element: `${element.tagName.toLowerCase()}.${element.className || ''}`.slice(0, 120),
            text: (element.textContent || '').trim().slice(0, 120),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }));
        const escapedControls = mainElement ? [...mainElement.querySelectorAll('button,a,label,input,select,textarea,summary')]
          .filter((element) => isRendered(element) && !element.closest('.admin-table-wrap'))
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ rect }) => rect.left < main.left - 2 || rect.right > main.right + 2)
          .map(({ element, rect }) => ({
            element: `${element.tagName.toLowerCase()}.${element.className || ''}`.slice(0, 120),
            text: (element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 120),
            left: rect.left, right: rect.right,
          })) : [];
        const tableWrappers = [...document.querySelectorAll('.admin-table-wrap')]
          .filter(isRendered)
          .map((element) => ({ ...rectOf(element), overflowX: getComputedStyle(element).overflowX }));
        const offerMain = rectOf(document.querySelector('.price-offer-main'));
        const offerSummary = rectOf(document.querySelector('.price-offer-summary'));
        const definitionLists = [...document.querySelectorAll('.admin-dl')]
          .filter(isRendered)
          .map((element) => getComputedStyle(element).gridTemplateColumns);
        return {
          viewportWidth: innerWidth,
          documentWidth: root.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          sidebar,
          main,
          h1: h1 ? { ...h1, rendered: isRendered(h1Element), inInitialViewport: h1.bottom > 0 && h1.top < innerHeight } : null,
          mobileNavigation: mobileNavigation ? {
            display: getComputedStyle(mobileNavigation).display,
            open: mobileNavigation.hasAttribute('open'),
          } : null,
          desktopNavigationDisplay: desktopNavigation ? getComputedStyle(desktopNavigation).display : null,
          clippedControls,
          escapedControls,
          tableWrappers,
          offerMain,
          offerSummary,
          definitionLists,
        };
      });
      if (viewport.screenshot) {
        await page.screenshot({ path: path.join(outputRoot, `${viewport.name}-${slug}.png`), fullPage: true });
      }
      assert.ok(metrics.documentWidth <= metrics.viewportWidth + 1 && metrics.bodyWidth <= metrics.viewportWidth + 1,
        `${routePath} preteká pri ${viewport.width}px: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.sidebar && metrics.sidebar.left >= -1 && metrics.sidebar.right <= metrics.viewportWidth + 1,
        `${routePath} má bočné menu mimo obrazovky: ${JSON.stringify(metrics.sidebar)}`);
      assert.ok(metrics.main && metrics.main.left >= -1 && metrics.main.right <= metrics.viewportWidth + 1,
        `${routePath} má hlavný obsah mimo obrazovky: ${JSON.stringify(metrics.main)}`);
      assert.ok(metrics.h1?.rendered && metrics.h1.inInitialViewport,
        `${routePath} nemá viditeľný H1 v úvodnom výreze: ${JSON.stringify(metrics.h1)}`);
      assert.deepEqual(metrics.escapedControls, [],
        `${routePath} má ovládací prvok mimo hlavného obsahu: ${JSON.stringify(metrics.escapedControls)}`);
      assert.ok(metrics.tableWrappers.every((wrapper) => wrapper.left >= metrics.main.left - 2
        && wrapper.right <= metrics.main.right + 2 && ['auto', 'scroll'].includes(wrapper.overflowX)),
      `${routePath} nemá bezpečne uzavretú posuvnú tabuľku: ${JSON.stringify(metrics.tableWrappers)}`);
      if (viewport.width <= 900) {
        assert.ok(metrics.sidebar.bottom <= metrics.main.top + 2,
          `${routePath} má mobilné menu prekryté s hlavným obsahom.`);
        assert.deepEqual(metrics.mobileNavigation, { display: 'block', open: false }, `${routePath} musí mať zbalené mobilné menu.`);
        assert.equal(metrics.desktopNavigationDisplay, 'none', `${routePath} nesmie na mobile zobrazovať desktopové menu.`);
        if (slug === 'dashboard') {
          const disclosure = page.locator('.admin-navigation-mobile');
          await disclosure.locator('summary').click();
          assert.equal(await disclosure.getAttribute('open'), '', 'Mobilné menu sa musí dať otvoriť.');
          await assert.doesNotReject(() => disclosure.locator('a[href="/admin/ponuky"]').waitFor({ state: 'visible' }));
          if (viewport.screenshot) {
            await page.screenshot({ path: path.join(outputRoot, `${viewport.name}-${slug}-menu-open.png`), fullPage: true });
          }
          await disclosure.locator('summary').click();
          assert.equal(await disclosure.getAttribute('open'), null, 'Mobilné menu sa musí dať znovu zavrieť.');
        }
      } else {
        assert.ok(metrics.sidebar.right <= metrics.main.left + 2,
          `${routePath} má desktopové menu prekryté s hlavným obsahom.`);
        assert.equal(metrics.mobileNavigation?.display, 'none', `${routePath} nesmie na desktope zobrazovať mobilné menu.`);
        assert.equal(metrics.desktopNavigationDisplay, 'contents', `${routePath} musí na desktope zachovať plnú navigáciu.`);
      }
      if (metrics.offerMain && metrics.offerSummary) {
        if (viewport.width <= 1200) {
          assert.ok(metrics.offerSummary.top >= metrics.offerMain.bottom - 2,
            `${routePath} prekrýva formulár a súhrn ponuky pri ${viewport.width}px.`);
        } else {
          assert.ok(metrics.offerSummary.left >= metrics.offerMain.right - 2,
            `${routePath} prekrýva stĺpce ponuky pri ${viewport.width}px.`);
        }
      }
      if (viewport.width <= 480) {
        assert.ok(metrics.definitionLists.every((columns) => columns.trim().split(/\s+/).length === 1),
          `${routePath} musí mať mobilné definície v jednom čitateľnom stĺpci: ${JSON.stringify(metrics.definitionLists)}`);
      }
      assert.deepEqual(metrics.clippedControls, [], `${routePath} orezáva ovládací alebo nadpisový text.`);
      report.push({ route: routePath, viewport: `${viewport.width}x${viewport.height}`, documentWidth: metrics.documentWidth });
    }
  }

  assert.deepEqual(pageErrors, [], `Admin stránky vyvolali browser chyby: ${pageErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `Admin stránky zapísali console chyby: ${consoleErrors.join(' | ')}`);
  assert.deepEqual(deniedOrigins, [], `Admin sa pokúsil kontaktovať externé originy: ${deniedOrigins.join(', ')}`);
  assert.deepEqual(nonGetRequests, [], `Read-only admin audit nesmie odoslať formulár: ${nonGetRequests.join(', ')}`);
  assert.equal(report.length, routes.length * viewports.length);
  await writeFile(path.join(outputRoot, 'report.json'), JSON.stringify({
    result: 'PASS', syntheticOnly: true, productionAccess: false,
    nodeVersion: process.version, browserPath, syntheticIds, routes: routes.map(([routePath]) => routePath),
    viewports: viewports.map(({ width, height, name }) => ({ width, height, name })), states: report,
  }, null, 2));
  console.log(JSON.stringify({ result: 'PASS', outputRoot, routes: routes.length, viewports: viewports.length,
    states: report.length, formsSubmitted: nonGetRequests.length, externalOrigins: deniedOrigins.length }));
} catch (error) {
  console.error('Izolovaný admin vizuálny audit zlyhal:', error.message);
  console.error('Lokálna Next diagnostika:', logs.join('').slice(-4500));
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(child);
  await socket?.stop();
  await database?.close();
  const marker = await readFile(path.join(tempRoot, '.harness-owner'), 'utf8').catch(() => '');
  const resolvedRoot = path.resolve(tempRoot);
  assert.equal(path.dirname(resolvedRoot).toLowerCase(), tempParent.toLowerCase(), 'Mazanie je povolené iba priamo v OS temp.');
  assert.match(path.basename(resolvedRoot), /^astana-admin-visual-[A-Za-z0-9]+$/, 'Dočasný koreň musí patriť tomuto admin auditu.');
  assert.equal(marker, owner, 'Dočasný koreň musí mať vlastnícku značku tohto behu.');
  const dependencyLink = path.join(tempRoot, 'node_modules');
  if ((await lstat(dependencyLink).catch(() => null))?.isSymbolicLink()) await unlink(dependencyLink);
  await rm(tempRoot, { recursive: true });
  console.log(`Cleanup PASS: owned temp root removed: ${tempRoot}`);
}
