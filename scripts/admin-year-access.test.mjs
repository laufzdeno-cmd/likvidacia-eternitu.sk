import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('ročný prehľad je skrytý operátorom a chránený pred priamym otvorením', async () => {
  const [navigation, page, auth] = await Promise.all([
    readFile(new URL('../app/admin/(protected)/admin-nav.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/rok/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/auth.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(navigation, /href: '\/admin\/rok',[^\n]+superOnly: true/);
  assert.match(page, /import \{ requireSuperAdmin \} from '@\/src\/server\/auth'/);
  assert.doesNotMatch(page, /requireAdminUser/);

  const guardIndex = page.indexOf('await requireSuperAdmin()');
  const firstSensitiveRead = page.indexOf('listBusinessJobs(');
  assert.ok(guardIndex > -1 && firstSensitiveRead > -1 && guardIndex < firstSensitiveRead,
    'oprávnenie superadmina sa musí overiť pred čítaním ročných a finančných údajov');

  assert.match(auth, /pathname\.startsWith\('\/admin\/rok'\)/);
});
