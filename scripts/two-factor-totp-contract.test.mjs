import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('2FA is mandatory only for superadmins and is not offered to operators', async () => {
  const { isTwoFactorRequired } = await import('../src/server/two-factor.ts');
  assert.equal(isTwoFactorRequired('SUPER_ADMIN'), true);
  assert.equal(isTwoFactorRequired('OPERATOR'), false);
  const login = await read('../app/admin/login/submit/route.ts');
  const setup = await read('../app/admin/2fa/setup/page.tsx');
  const verify = await read('../app/admin/2fa/verify/page.tsx');
  const profile = await read('../app/admin/(protected)/profil/page.tsx');
  assert.match(login, /if \(!user\.localDevelopmentFallback && isTwoFactorRequired\(user\.role\)\)/);
  assert.doesNotMatch(login, /\|\| user\.twoFactorEnabled/);
  assert.match(login, /await clearPendingTwoFactor\(\);\s*await setAdminSession/);
  assert.match(login, /await clearPendingBackupCodes\(\);\s*if \(!user\.localDevelopmentFallback/);
  assert.match(setup, /if \(!isTwoFactorRequired\(user\.role\)\) redirect\('\/admin\/dopyty'\)/);
  assert.match(verify, /if \(!isTwoFactorRequired\(user\.role\)\) redirect\('\/admin\/login'\)/);
  assert.match(profile, /Len pre superadmina/);
});

test('backup codes are account-bound and consumed only in a server action', async () => {
  const auth = await read('../src/server/auth.ts');
  const actions = await read('../app/admin/2fa/actions.ts');
  const page = await read('../app/admin/2fa/backup-codes/page.tsx');
  const reveal = await read('../app/admin/2fa/backup-codes/reveal.tsx');
  const logout = await read('../app/admin/logout/route.ts');
  assert.match(auth, /encodeSignedJson\(\{\s*codes, email: email\.trim\(\)\.toLowerCase\(\), sessionEpoch, iat: Date\.now\(\)/);
  assert.match(auth, /pending\.email !== email\.trim\(\)\.toLowerCase\(\)[\s\S]{0,100}pending\.sessionEpoch !== sessionEpoch/);
  assert.doesNotMatch(page, /consumePendingBackupCodes|\.delete\(/);
  assert.match(actions, /revealPendingBackupCodesAction[\s\S]*?verifyCsrf\(formData\)[\s\S]*?requireAdminUser\(\)[\s\S]*?consumePendingBackupCodes\(user\.email, user\.sessionEpoch\)/);
  assert.match(reveal, /useActionState\(revealPendingBackupCodesAction, initialState\)/);
  assert.match(logout, /await clearPendingBackupCodes\(\)/);
});

test('TOTP login consumes its matched database time step before an admin session is issued', async () => {
  const action = await read('../app/admin/2fa/actions.ts');
  const login = action.slice(action.indexOf('export async function verifyTwoFactorLoginAction'));
  assert.match(login, /const timeStep = verifyTotpTimeStep\(token, user\.twoFactorSecret\);/);
  assert.match(login, /authenticatedUser = await consumeAdminUserTotpStep\(user\.email, user\.twoFactorSecret, timeStep, user\.sessionEpoch\);\s*if \(!authenticatedUser\) redirect\('\/admin\/2fa\/verify\?error=1'\);/);
  const consumeIndex = login.indexOf('consumeAdminUserTotpStep(user.email, user.twoFactorSecret, timeStep, user.sessionEpoch)');
  assert.ok(consumeIndex >= 0);
  assert.ok(login.indexOf('await setAdminSession(authenticatedUser.email, authenticatedUser.sessionEpoch)', consumeIndex) > consumeIndex);
});

test('2FA setup is one-time and records the setup code step atomically with enabling', async () => {
  const action = await read('../app/admin/2fa/actions.ts');
  const db = await read('../src/server/db.ts');
  assert.match(action, /if \(!user\?\.active \|\| !user\.twoFactorSecret \|\| user\.twoFactorEnabled\) redirect\('\/admin\/login'\);/);
  assert.match(action, /const enabled = await enableAdminUserTwoFactor\(user\.email, hashBackupCodes\(backupCodes\), timeStep, user\.twoFactorSecret, user\.email, user\.sessionEpoch\);\s*if \(!enabled\) redirect\('\/admin\/2fa\/setup\?error=1'\);/);
  assert.match(db, /two_factor_last_used_step bigint NOT NULL DEFAULT -1/);
  assert.match(db, /two_factor_last_used_step = \$3, two_factor_backup_code_hashes = \$1::jsonb,[\s\S]*?session_epoch = session_epoch \+ 1[\s\S]*?two_factor_secret = \$4 AND two_factor_enabled = false AND two_factor_last_used_step < \$3/);
});

test('lokálny JSON fallback serializuje všetky zmeny, ktoré môžu prepísať stav TOTP', async () => {
  const db = await read('../src/server/db.ts');
  for (const name of [
    'upsertAdminUser',
    'saveManagedAdminUser',
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
  const activeStart = db.indexOf('export async function setAdminUserActive(');
  const activeEnd = db.indexOf('\nexport async function ', activeStart + 1);
  assert.match(db.slice(activeStart, activeEnd), /return saveManagedAdminUser\(/,
    'setAdminUserActive must delegate to the serialized managed-user mutation');
});

test('admin and pending 2FA cookies are bound to the current database session epoch', async () => {
  const auth = await read('../src/server/auth.ts');
  const login = await read('../app/admin/login/submit/route.ts');
  assert.match(auth, /type AdminSession = \{ kind: 'admin-session'; email: string; iat: number; epoch: number \}/);
  assert.match(auth, /if \(decoded\.kind !== 'admin-session' \|\| !decoded\.email \|\| !decoded\.iat \|\| !Number\.isSafeInteger\(decoded\.epoch\)/);
  assert.match(auth, /export async function currentAdminEmail\(\) \{\s*const user = await currentAdminUser\(\);\s*return user\?\.active \? user\.email : null;/);
  assert.match(auth, /type PendingTwoFactor = \{ kind: 'pending-two-factor'; email: string; iat: number; epoch: number \}/);
  assert.match(auth, /if \(pending\?\.kind !== 'pending-two-factor'/);
  assert.match(auth, /JSON\.stringify\(\{ kind: 'admin-session', email, iat: Date\.now\(\), epoch \}\)/);
  assert.match(auth, /cookieStore\.set\(pendingTwoFactorCookieName, encodeSignedJson\(\{\s*kind: 'pending-two-factor'/);
  assert.match(auth, /getAdminUserByEmail\(pending\.email\)[\s\S]{0,180}adminSessionEpochMatchesUser\(pending\.epoch, user\.sessionEpoch\)/);
  assert.match(login, /setPendingTwoFactor\(normalizedEmail, user\.sessionEpoch\)/);
  assert.match(login, /setAdminSession\(normalizedEmail, user\.sessionEpoch\)/);
  assert.doesNotMatch(auth, /hasConfiguredCredential/);
});

test('login and 2FA retain the verified account generation across async operations', async () => {
  const auth = await read('../src/server/auth.ts');
  const login = await read('../app/admin/login/submit/route.ts');
  const action = await read('../app/admin/2fa/actions.ts');
  const setup = await read('../app/admin/2fa/setup/page.tsx');
  const db = await read('../src/server/db.ts');
  assert.match(login, /const user = await authenticateAdminCredentials\(email, password\)/);
  assert.doesNotMatch(login, /getAdminUserByEmail|verifyAdminCredentials/);
  assert.match(login, /if \(!user\.localDevelopmentFallback && isTwoFactorRequired\(user\.role\)\)/);
  const authenticate = auth.slice(auth.indexOf('export async function authenticateAdminCredentials('), auth.indexOf('export async function verifyAdminCredentials('));
  assert.equal((authenticate.match(/getAdminUserByEmail\(/g) || []).length, 1);
  assert.match(authenticate, /sessionEpoch: dbUser\.sessionEpoch/);
  assert.match(authenticate, /sessionEpoch: dbUser\.sessionEpoch, localDevelopmentFallback: false/);
  assert.match(authenticate, /process\.env\.NODE_ENV !== 'production'[\s\S]{0,250}localDevelopmentFallback: true/);
  assert.match(authenticate, /verifyHash\(password, dbUser\.passwordHash\) \? user : null/);
  assert.match(auth, /adminSessionEpochMatchesUser\(session\.sessionEpoch, user\.sessionEpoch\) \? user : null/);
  assert.match(action, /const user = await currentPendingTwoFactorUser\(\)/);
  assert.doesNotMatch(action, /getAdminUserByEmail|currentPendingTwoFactorEmail/);
  assert.match(action, /if \(!user\.twoFactorEnabled \|\| !user\.twoFactorSecret\) \{\s*if \(isTwoFactorRequired\(user\.role\)\) redirect\('\/admin\/2fa\/setup'\);\s*await clearPendingTwoFactor\(\);\s*redirect\('\/admin\/login'\);/);
  assert.match(setup, /setAdminUserTwoFactorSecret\(user\.email, generateTotpSecret\(\), user\.email, user\.sessionEpoch\)/);
  for (const name of ['setAdminUserTwoFactorSecret', 'enableAdminUserTwoFactor', 'consumeAdminUserTotpStep', 'consumeAdminUserBackupCode']) {
    const start = db.indexOf(`export async function ${name}(`);
    const end = db.indexOf('\nexport async function ', start + 1);
    const body = db.slice(start, end);
    assert.match(body, /expectedSessionEpoch: number/);
    assert.match(body, /Number\.isSafeInteger\(expectedSessionEpoch\)/);
    assert.match(body, /normalizeAdminSessionEpoch\(user\.sessionEpoch\) !== expectedSessionEpoch/);
    assert.match(body, /AND active = true/);
    assert.match(body, /AND session_epoch = \$\d/);
  }
});
