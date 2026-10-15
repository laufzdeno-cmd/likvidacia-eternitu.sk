import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('global search queries complete database tables, caps projections and gates finance by role', async () => {
  const [service, database] = await Promise.all([
    read('src/server/admin-intelligence.ts'),
    read('src/server/db.ts'),
  ]);
  assert.match(service, /searchAdminData\(q, role === 'SUPER_ADMIN'\)/);
  const start = database.indexOf('export async function searchAdminData');
  const end = database.indexOf('export type PriceOfferStatusSummary', start);
  assert.ok(start >= 0 && end > start, 'DB-backed admin search export must exist');
  const source = database.slice(start, end);
  for (const table of ['FROM leads l', 'FROM business_jobs j', 'FROM price_offers o', 'FROM review_requests r', 'FROM business_job_invoices invoice']) {
    assert.match(source, new RegExp(table));
  }
  assert.ok((source.match(/LIMIT 20/g) || []).length >= 5, 'each result class must have a bounded projection');
  assert.doesNotMatch(source, /SELECT \*/);
  assert.doesNotMatch(source, /listLeads\(|listBusinessJobs\(|listPriceOffers\(|listReviewRequests\(|listBusinessFinanceEvidence\(/);
  assert.match(source, /r\.customer_email/);
  assert.match(source, /includeFinance\s*\?/);
  assert.match(source, /!lead\.deletedAt && !lead\.isTestData/);
});

test('private search uses an authenticated CSRF-protected POST action and never puts PII in the URL', async () => {
  const [page, workspace, action] = await Promise.all([
    read('app/admin/(protected)/vyhladavanie/page.tsx'),
    read('app/admin/(protected)/vyhladavanie/search-workspace.tsx'),
    read('app/admin/(protected)/vyhladavanie/actions.ts'),
  ]);
  assert.match(page, /requireAdminUser\(\)/);
  assert.doesNotMatch(page, /searchParams/);
  assert.match(workspace, /action=\{formAction\}/);
  assert.doesNotMatch(workspace, /method="get"|\/admin\/vyhladavanie\?/);
  assert.match(action, /verifyCsrf\(formData\)/);
  assert.match(action, /requireAdminUser\(\)/);
  assert.match(action, /\.min\(2\)\.max\(100\)/);
});

test('draft provider is flag-gated, redacts direct identifiers and requires an explicit admin action', async () => {
  const [provider, composer, page, action] = await Promise.all([
    read('src/server/admin-draft-provider.ts'),
    read('app/admin/(protected)/ai-asistent/draft-composer.tsx'),
    read('app/admin/(protected)/ai-asistent/page.tsx'),
    read('app/admin/(protected)/ai-asistent/actions.ts'),
  ]);
  assert.match(provider, /ASTANA_AI_DRAFTS_ENABLED/);
  assert.match(provider, /providerReady = flagEnabled && Boolean\(gatewayCredential\(\)\)/);
  assert.match(provider, /if \(!status\.providerReady \|\| !credential\) throw/);
  assert.match(provider, /redactAdminDraftInput/);
  assert.match(provider, /\[EMAIL ODSTRÁNENÝ\]/);
  assert.doesNotMatch(composer, /fetch\(/);
  assert.match(composer, /makeDeterministicAdminDraft/);
  assert.match(composer, /type="submit"[\s\S]+disabled=\{!providerReady/);
  assert.match(composer, /Vylepšiť pomocou AI/);
  assert.match(composer, /Tento nástroj nič neodosiela ani neukladá/);
  assert.match(action, /verifyCsrf\(formData\)/);
  assert.match(action, /requireAdminUser\(\)/);
  assert.match(action, /consumeSharedRateLimit\('admin-ai-draft', actor\.email, 12,/);
  assert.doesNotMatch(action, /sendEmail|sendMail|createPriceOffer|publish/);
  assert.match(page, /provider\.providerReady/);
});

test('automation matrix states trigger, preparation, approval and current status', async () => {
  const [source, assistant] = await Promise.all([
    read('app/admin/(protected)/automatizacie/page.tsx'),
    read('app/admin/(protected)/asistent/page.tsx'),
  ]);
  for (const label of ['Spúšťač', 'Čo systém pripraví', 'Kto schvaľuje', 'Posledný stav']) assert.match(source, new RegExp(label));
  assert.match(source, /Obchodné kroky zostávajú pod kontrolou človeka/);
  assert.match(source, /Transakčné potvrdenia z verejných formulárov/);
  assert.match(source, /najviac jednu pripomienku/i);
  assert.match(source, /výslovne povolil/i);
  assert.match(source, /Naposledy vykonané zdrojové udalosti/);
  assert.match(source, /data\.automationEvents\.offerAccepted/);
  assert.match(source, /data\.automationEvents\.jobCompleted/);
  assert.match(source, /user\.role === 'SUPER_ADMIN'[\s\S]+data\.automationEvents\.paymentReceived/);
  assert.match(source, /timeZone: 'Europe\/Bratislava'/);
  assert.match(source, /História neobsahuje osobné údaje zákazníkov/);
  assert.match(source, /Nejde o dôkaz, že systém automaticky odoslal správu/);
  assert.match(assistant, /Fronta sama nič neodosiela/);
  assert.match(assistant, /vopred povolená jediná pripomienka referencie/);
});

test('reference candidates reuse the authoritative eligibility query and current workspace', async () => {
  const [source, page] = await Promise.all([
    read('src/server/admin-intelligence.ts'),
    read('app/admin/(protected)/kontrola-dat/page.tsx'),
  ]);
  assert.match(source, /listEligibleReviewJobs\(\)/);
  assert.doesNotMatch(source, /completedJobStatuses\.has\(job\.status\) && job\.leadId/);
  assert.match(page, /href="\/admin\/referencie"/);
  assert.doesNotMatch(page, /reviews\/request\?leadId/);
});

test('monthly reference metrics use exact created and submitted events in Bratislava time', async () => {
  const [service, database] = await Promise.all([
    read('src/server/admin-intelligence.ts'),
    read('src/server/db.ts'),
  ]);
  assert.match(service, /getReviewRequestEventMetrics\(month\.from, month\.to\)/);
  assert.match(service, /reviewRequests: reviewMetrics\.created/);
  assert.match(service, /reviewsReceived: reviewMetrics\.submitted/);
  const start = database.indexOf('export async function getReviewRequestEventMetrics');
  const end = database.indexOf('export async function listBlockedReviewJobs', start);
  assert.ok(start >= 0 && end > start, 'review event metric export must exist');
  const source = database.slice(start, end);
  assert.match(source, /bratislavaTimestampRange\(from, to\)/);
  assert.match(source, /r\.created_at/);
  assert.match(source, /r\.submitted_at/);
  assert.match(source, /request\.submittedAt/);
});

test('navigation exposes one canonical references workspace and preserves legacy redirect', async () => {
  const [nav, legacy] = await Promise.all([
    read('app/admin/(protected)/admin-nav.tsx'),
    read('app/admin/(protected)/reviews/request/page.tsx'),
  ]);
  assert.equal((nav.match(/href: '\/admin\/referencie'/g) || []).length, 1);
  assert.doesNotMatch(nav, /href: '\/admin\/reviews\/request'/);
  assert.match(nav, /label: 'Referencie a hodnotenia'/);
  assert.match(legacy, /redirect\(suffix \? `\/admin\/referencie\?\$\{suffix\}` : '\/admin\/referencie'\)/);
});

test('admin navigation uses operational groups and keeps finance superadmin-only', async () => {
  const source = await read('app/admin/(protected)/admin-nav.tsx');
  for (const group of ['OBCHOD', 'REALIZÁCIA', 'FINANCIE', 'MARKETING', 'SPRÁVA']) assert.match(source, new RegExp(group));
  assert.match(source, /\/admin\/rok[^\n]+superOnly: true/);
});

test('Dnes is the admin home and new operational areas have specific topbar labels', async () => {
  const [indexPage, topbar] = await Promise.all([
    read('app/admin/page.tsx'),
    read('app/admin/(protected)/admin-topbar.tsx'),
  ]);
  assert.match(indexPage, /redirect\('\/admin\/asistent'\)/);
  for (const route of [
    '/admin/asistent',
    '/admin/vyhladavanie',
    '/admin/ai-asistent',
    '/admin/kontrola-dat',
    '/admin/automatizacie',
    '/admin/zakazky/pohladavky',
    '/admin/audit',
  ]) {
    assert.match(topbar, new RegExp(route.replaceAll('/', '\\/')));
  }
});

test('automation approvals are superadmin-only, authoritative and privacy-minimal', async () => {
  const [page, intelligence, auth, nav] = await Promise.all([
    read('app/admin/(protected)/automatizacie/page.tsx'),
    read('src/server/admin-intelligence.ts'),
    read('src/server/auth.ts'),
    read('app/admin/(protected)/admin-nav.tsx'),
  ]);
  assert.match(page, /requireSuperAdmin\(\)/);
  assert.match(page, /getAdminApprovalQueue\(user\.role\)/);
  assert.match(page, /Čaká na schválenie/);
  assert.match(page, /Frontu nepovažujte za úplnú/);
  assert.match(nav, /\/admin\/automatizacie[^\n]+superOnly: true/);
  assert.match(auth, /pathname\.startsWith\('\/admin\/automatizacie'\)/);

  const start = intelligence.indexOf('export async function getAdminApprovalQueue');
  const end = intelligence.indexOf('export type AdminSearchResult', start);
  assert.ok(start >= 0 && end > start, 'superadmin approval queue export must exist');
  const source = intelligence.slice(start, end);
  for (const authoritativeSource of ['listPriceOffers()', 'listReviewRequests()', 'listRealizationCaseDrafts()', 'listPhotoIntakeRecords(', 'listRealizations()']) {
    assert.match(source, new RegExp(authoritativeSource.replace(/[()]/g, '\\$&')));
  }
  assert.match(source, /role !== 'SUPER_ADMIN'/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /unavailableSources/);
  assert.doesNotMatch(source, /customerName|customerEmail|customerPhone|\.email\b|\.phone\b/);
});

test('Dnes includes a role-aware operational approval inbox without exposing publication controls to operators', async () => {
  const [page, intelligence] = await Promise.all([
    read('app/admin/(protected)/asistent/page.tsx'),
    read('src/server/admin-intelligence.ts'),
  ]);
  assert.match(page, /getAdminOperationalApprovalQueue\(\)/);
  assert.match(page, /adminUser\.role === 'SUPER_ADMIN' \? getAdminApprovalQueue/);
  assert.match(page, /Čaká na kontrolu/);
  assert.match(page, /Publikovanie a citlivé rozhodnutia ostávajú superadminovi/);
  const start = intelligence.indexOf('export async function getAdminOperationalApprovalQueue');
  const end = intelligence.indexOf('export type AdminSearchResult', start);
  assert.ok(start >= 0 && end > start, 'operator approval queue must exist');
  const source = intelligence.slice(start, end);
  assert.match(source, /listPriceOffers\(\)/);
  assert.match(source, /listReviewRequests\(\)/);
  assert.doesNotMatch(source, /listPhotoIntakeRecords|listRealizationCaseDrafts|listRealizations/);
  assert.doesNotMatch(source, /category: 'case_publication'/);
});

test('firemný autopilot je idempotentný, chránený a nikdy sám neposiela prvý obchodný email', async () => {
  const [engine, action, route, page] = await Promise.all([
    read('src/server/admin-autopilot.ts'),
    read('app/admin/(protected)/automatizacie/actions.ts'),
    read('app/api/cron/admin-autopilot/route.ts'),
    read('app/admin/(protected)/automatizacie/page.tsx'),
  ]);
  assert.match(engine, /getBusinessJobIdsWithPriceOffers/);
  assert.match(engine, /await ensureAdminAutopilotSchema\(\)/);
  assert.match(engine, /deterministicUuid\('assistant-offer'/);
  assert.match(engine, /status: 'pending_approval'/);
  assert.doesNotMatch(engine, /sendPriceOffer|sendReviewRequest|sendEmail|sendMail|publishRequested|nextLifecycle:\s*'published'/);
  assert.match(action, /verifyCsrf\(formData\)/);
  assert.match(action, /requireSuperAdmin\(\)/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /error: 'assistant_failed'/);
  assert.match(route, /const \{ blockedOfferJobIds, \.\.\.counts \} = result/);
  assert.doesNotMatch(route, /error\.message|NextResponse\.json\(\{ ok: true, \.\.\.result/);
  assert.match(page, /succeeded\|degraded\|failed/);
  assert.match(page, /status === 'failed' \? 'error'/);
});

test('final admin cascade reserves red for danger and uses blue or teal for ordinary interactions', async () => {
  const css = await read('app/admin/admin-route.css');
  const marker = css.indexOf('Final admin interaction palette');
  assert.ok(marker >= 0, 'final interaction palette must exist');
  const finalPalette = css.slice(marker);
  assert.match(finalPalette, /--admin-action: #1769aa/);
  assert.match(finalPalette, /--admin-teal: #0f766e/);
  assert.match(finalPalette, /\.admin-page \.intelligence-hero h1\s*\{[\s\S]*?color: #fff !important/);
  assert.match(finalPalette, /\.admin-filter-bar button\.is-active/);
  assert.match(finalPalette, /\.admin-sidebar nav a\[aria-current='page'\]/);
  assert.match(finalPalette, /\.admin-page \.status-zrusena/);
  assert.match(finalPalette, /#b42318/);
  assert.doesNotMatch(finalPalette, /var\(--astana-red\)/);
});

test('visual harness avoids Playwright caret mutation without suppressing real browser failures', async () => {
  const harness = await read('scripts/admin-visual.browser.integration.mjs');
  assert.match(harness, /active instanceof HTMLElement[\s\S]+active\.blur\(\)/);
  assert.match(harness, /page\.screenshot\(\{ path: screenshotPath, fullPage: true, caret: 'initial' \}\)/);
  assert.match(harness, /assert\.deepEqual\(pageErrors, \[\]/);
  assert.match(harness, /assert\.deepEqual\(consoleErrors, \[\]/);
  assert.match(harness, /assert\.deepEqual\(deniedOrigins, \[\]/);
  assert.match(harness, /assert\.deepEqual\(nonGetRequests, \[\]/);
  assert.doesNotMatch(harness, /consoleErrors\.filter|ERR_BLOCKED_BY_CLIENT/);
});
