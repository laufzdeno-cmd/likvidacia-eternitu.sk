import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('editor verejných textov používa CSRF, povolené kľúče a limity', async () => {
  const [page, action, defaults, homepage, nav, auth] = await Promise.all([
    read('app/admin/(protected)/obsah/page.tsx'),
    read('app/admin/(protected)/obsah/actions.ts'),
    read('src/server/site-content.ts'),
    read('app/page.tsx'),
    read('app/admin/(protected)/admin-nav.tsx'),
    read('src/server/auth.ts'),
  ]);
  assert.match(page, /name="_csrf" value=\{csrfTokenForEmail\(adminEmail\)\}/);
  assert.match(page, /const \{ email: adminEmail \} = await requireSuperAdmin\(\)/);
  assert.doesNotMatch(page, /\brequireAdmin\(\)/);
  assert.match(action, /await verifyCsrf\(formData\)/);
  assert.match(action, /await verifyCsrf\(formData\);[\s\S]*?await requireSuperAdmin\(\)/);
  assert.doesNotMatch(action, /\brequireAdmin\(\)/);
  assert.match(action, /const editableKeys = new Set/);
  assert.match(action, /homepageEditableKeys/);
  assert.match(action, /!editableKeys\.has\(contentKey\)/);
  assert.match(action, /value\.length > maxLengthForKey\(contentKey\)/);
  assert.doesNotMatch(action, /values\[key\.replace\('content:', ''\)\] = String/);
  assert.match(page, /homepageEditableKeys\.map\(\(key\) =>/);
  assert.doesNotMatch(page, /Object\.entries\(content\)/);
  assert.match(defaults, /export const homepageEditableKeys = \[/);
  assert.match(homepage, /\{content\.realizationsEyebrow\}/);
  assert.match(homepage, /\{content\.realizationsTitle\}/);
  assert.match(homepage, /\{content\.realizationsText\}/);
  assert.match(nav, /href: '\/admin\/obsah', label: 'Obsah a GEO', icon: 'doc', superOnly: true/);
  assert.match(auth, /pathname\.startsWith\('\/admin\/obsah'\)/);
  assert.match(auth, /if \(role === 'SUPER_ADMIN'\) return true/);
});

test('zmena admin hesla mení účet, zvyšuje epochu a neukladá heslo schránky', async () => {
  const [actions, database, settings] = await Promise.all([
    read('app/admin/(protected)/nastavenia/actions.ts'),
    read('src/server/db.ts'),
    read('app/admin/(protected)/nastavenia/page.tsx'),
  ]);
  assert.match(actions, /changeAdminUserPassword\(admin\.email, hashPassword\(newPassword\), admin\.sessionEpoch, actor\)/);
  assert.match(actions, /await clearAdminSession\(\)/);
  assert.match(database, /password_hash = \$1, session_epoch = session_epoch \+ 1/);
  assert.match(database, /action: 'admin_user_password_changed'/);
  assert.match(settings, /Heslo schránky sa z bezpečnostných dôvodov neukladá ani nezobrazuje/);
  assert.doesNotMatch(settings, /name="SMTP_PASS"|name="smtpPassword"|name="mailPassword"/i);
});

test('realizácie majú bezpečné fázy fotografií a presná adresa ostáva iba v adminovi', async () => {
  const [database, types, adminPage, publicMap, actions] = await Promise.all([
    read('src/server/db.ts'),
    read('src/server/types.ts'),
    read('app/admin/(protected)/realizacie/pripady/page.tsx'),
    read('app/realizacie/approved-case-map.tsx'),
    read('app/admin/(protected)/realizacie/pripady/actions.ts'),
  ]);
  assert.match(database, /photo_phase text NOT NULL DEFAULT 'during'/);
  assert.match(database, /CHECK \(photo_phase IN \('before', 'during', 'after'\)\)/);
  assert.match(database, /public_caption text NOT NULL DEFAULT ''/);
  assert.match(database, /sort_order integer NOT NULL DEFAULT 0/);
  assert.match(database, /j\.location AS case_job_location/);
  assert.match(types, /exactLocation: string/);
  assert.match(adminPage, /Interná presná lokalita CRM/);
  assert.doesNotMatch(publicMap, /exactLocation|case_job_location|businessJob/);
  assert.match(actions, /updateRealizationCaseDraftMediaMetadata/);
  assert.match(publicMap, /Pred prácou/);
  assert.match(publicMap, /Po práci/);
});

test('tri weby ASTANA majú rovnaké viditeľné a strojovo čitateľné roly', async () => {
  const [site, about, llms, company] = await Promise.all([
    read('src/content/site.ts'),
    read('app/o-firme/page.tsx'),
    read('public/llms.txt'),
    read('public/data/company.json'),
  ]);
  const parsed = JSON.parse(company);
  assert.equal(parsed.official_websites.length, 3);
  for (const website of parsed.official_websites) {
    assert.match(site, new RegExp(website.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(llms.includes(website.url));
  }
  assert.match(about, /Oficiálne weby ASTANA sa dopĺňajú/);
  assert.match(about, /nejde o tri rozdielne firmy ani miestne pobočky/i);
});
