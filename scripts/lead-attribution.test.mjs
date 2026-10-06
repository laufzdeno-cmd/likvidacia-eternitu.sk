import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const route = read('../app/api/lead/route.ts');
const tracker = read('../src/lib/analytics-attribution-client.ts');
const touch = read('../src/lib/attribution-touch.ts');
const db = read('../src/server/db.ts');
const analyticsPage = read('../app/admin/(protected)/analytics/page.tsx');
const homepage = read('../app/homepage-critical-client.tsx');
const landing = read('../app/landing-client.tsx');
const adminLead = read('../app/admin/(protected)/dopyty/[id]/page.tsx');
const privacy = read('../app/ochrana-osobnych-udajov/page.tsx');
const cookies = read('../app/cookies/page.tsx');

test('lead endpoint treats browser attribution as untrusted and checks server-readable consent', () => {
  assert.match(route, /parseLeadAttribution\(formData\.get\('leadAttribution'\)/);
  assert.match(route, /request\.cookies\.get\(analyticsConsentCookieName\)\?\.value === 'granted'/);
  assert.match(route, /request\.cookies\.get\(marketingConsentCookieName\)\?\.value === 'granted'/);
  assert.match(route, /\.\.\.\(leadAttribution \? \{ attribution: leadAttribution \} : \{\}\)/);
  for (const client of [homepage, landing]) assert.match(client, /payload\.set\('leadAttribution', JSON\.stringify\(getLeadAttribution\(\)\)\)/);
  assert.match(tracker, /selectCampaignTouch\(existing, isExpiredCampaign \? \{\} : currentTouch\)/);
  assert.match(tracker, /if \(!hasMarketingConsent\(\)\) \{[\s\S]*delete attribution\.gclid[\s\S]*delete attribution\.wbraid/);
  assert.match(touch, /campaignKeys\.some[\s\S]*return \{ \.\.\.current \}/);
  for (const parameter of ['utm_content', 'utm_term', 'utm_id', 'gbraid', 'wbraid']) assert.ok(tracker.includes(parameter), `tracker captures ${parameter}`);
  assert.match(adminLead, /Prvá zaznamenaná stránka/);
  assert.match(adminLead, /Reklama \/ kreatíva/);
  assert.match(adminLead, /Hľadaný výraz/);
  assert.match(adminLead, /ID kampane/);
});

test('admin shows campaign source but never reveals raw advertising click IDs', () => {
  assert.match(adminLead, /Zdroj dopytu/);
  assert.match(adminLead, /identifikátor skrytý/);
  assert.match(adminLead, /attribution\.gclid \|\| attribution\.gbraid \|\| attribution\.wbraid/);
  assert.doesNotMatch(adminLead, /<dd>\{attribution\.(?:gclid|fbclid|gbraid|wbraid)\}/);
  assert.match(privacy, /k dopytu priradia iba pri súhlase/);
  assert.match(cookies, /zmena cookies ich spätne z dopytu nevymaže/);
});

test('admin analytics separates session estimates from unique CRM lead offer outcomes', () => {
  assert.match(db, /export async function getLeadAttributionReport\(days = 30, sinceOverride\?\: string, maxRows: number \| null = 50\)/);
  assert.match(db, /EXISTS \(SELECT 1 FROM quotes q WHERE q\.lead_id = lead_base\.id AND q\.status = 'accepted'\)/);
  assert.match(db, /SELECT 1 FROM price_offers o[\s\S]{0,450}AND \$\{businessPriceOfferCondition\}/);
  assert.match(db, /attribution,gclid[\s\S]{0,180}attribution,gbraid[\s\S]{0,180}attribution,wbraid/);
  assert.match(analyticsPage, /getAnalyticsReport\(days, period\)[\s\S]{0,180}getLeadAttributionReport\(days, period\.since\)/);
  assert.match(analyticsPage, /Dopyty podľa kampane/);
  assert.match(analyticsPage, /Nie je to počet všetkých CRM dopytov/);
  assert.match(analyticsPage, /Kohorta obsahuje nearchivované CRM dopyty prijaté vo zvolenom období okrem výslovne označených testovacích záznamov/);
  assert.match(analyticsPage, /Dopyty s vydanou ponukou/);
  assert.match(analyticsPage, /Dopyty s prijatou ponukou/);
  assert.match(analyticsPage, /nie o počet dokumentov, tržby ani náklady na reklamu/);
  assert.match(analyticsPage, /Vydané dokumenty – starší modul ponúk/);
  assert.match(analyticsPage, /Prijaté dokumenty – starší modul ponúk/);
  assert.match(analyticsPage, /Tabuľka ukazuje najviac 50 kombinácií/);
  assert.match(analyticsPage, /CSV export obsahuje všetky kombinácie/);
});
