import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('TOTP login consumes its matched database time step before an admin session is issued', async () => {
  const action = await read('../app/admin/2fa/actions.ts');
  const login = action.slice(action.indexOf('export async function verifyTwoFactorLoginAction'));
  assert.match(login, /const timeStep = verifyTotpTimeStep\(token, user\.twoFactorSecret\);/);
  assert.match(login, /const consumed = await consumeAdminUserTotpStep\(user\.email, user\.twoFactorSecret, timeStep\);\s*if \(!consumed\) redirect\('\/admin\/2fa\/verify\?error=1'\);/);
  const consumeIndex = login.indexOf('consumeAdminUserTotpStep(user.email, user.twoFactorSecret, timeStep)');
  assert.ok(consumeIndex >= 0);
  assert.ok(login.indexOf('await setAdminSession(user.email)', consumeIndex) > consumeIndex);
});

test('2FA setup is one-time and records the setup code step atomically with enabling', async () => {
  const action = await read('../app/admin/2fa/actions.ts');
  const db = await read('../src/server/db.ts');
  assert.match(action, /if \(!user\?\.active \|\| !user\.twoFactorSecret \|\| user\.twoFactorEnabled\) redirect\('\/admin\/login'\);/);
  assert.match(action, /const enabled = await enableAdminUserTwoFactor\(user\.email, hashBackupCodes\(backupCodes\), timeStep, user\.twoFactorSecret, user\.email\);\s*if \(!enabled\) redirect\('\/admin\/2fa\/setup\?error=1'\);/);
  assert.match(db, /two_factor_last_used_step bigint NOT NULL DEFAULT -1/);
  assert.match(db, /two_factor_last_used_step = \$3, two_factor_backup_code_hashes = \$1::jsonb[\s\S]*?two_factor_secret = \$4 AND two_factor_enabled = false AND two_factor_last_used_step < \$3/);
});

test('lokálny JSON fallback serializuje všetky zmeny, ktoré môžu prepísať stav TOTP', async () => {
  const db = await read('../src/server/db.ts');
  for (const name of [
    'upsertAdminUser',
    'setAdminUserActive',
    'setAdminUserTwoFactorSecret',
    'enableAdminUserTwoFactor',
    'consumeAdminUserTotpStep',
    'resetAdminUserTwoFactor',
  ]) {
    const start = db.indexOf(`export async function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const end = db.indexOf('\nexport async function ', start + 1);
    const body = db.slice(start, end < 0 ? db.length : end);
    assert.match(body, /withLocalLeadSubmissionLock/, `${name} local updates must share the serialized JSON write lock`);
  }
});
