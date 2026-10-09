import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('admin používateľské formuláre vyžadujú CSRF, reautentifikáciu a bezpečné heslo', async () => {
  const [actions, page, database, settings] = await Promise.all([
    readFile(new URL('../app/admin/(protected)/users/actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/users/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/nastavenia/page.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(actions, /await verifyCsrf\(formData\)/);
  assert.match(actions, /verifyAdminCredentials\(actor\.email, parsed\.data\.currentPassword\)/);
  assert.match(actions, /parsed\.data\.password\.length < 12/);
  assert.match(actions, /!actorRecord\.passwordHash[\s\S]*hashPassword\(parsed\.data\.currentPassword\)/,
    'pôvodné fallback heslo sa pri premenovaní musí uložiť priamo k účtu');
  assert.match(actions, /clearAdminSession\(\)/);
  assert.match(page, /name="_csrf" value=\{csrfToken\}/);
  assert.match(page, /name="currentPassword"/);
  assert.match(page, /minLength=\{12\}/);
  assert.match(database, /pg_advisory_xact_lock\(hashtextextended\('astana:admin-user-management'/);
  assert.match(database, /activeSuperAdminsExcludingTarget === 0/);
  assert.match(database, /passwordChanged: Boolean\(normalizedInput\.passwordHash\), sessionsRevoked: securityChanged/);
  assert.match(settings, /Prihlasovací email: <strong>\{admin\.email\}<\/strong>/);
});
