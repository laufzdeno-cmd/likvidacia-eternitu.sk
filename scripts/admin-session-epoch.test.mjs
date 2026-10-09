import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { adminSessionEpochMatchesUser } from '../src/server/admin-session-policy.ts';

test('admin session epoch rejects legacy, stale and malformed sessions', () => {
  assert.equal(adminSessionEpochMatchesUser(undefined, 0), false);
  assert.equal(adminSessionEpochMatchesUser(0, 1), false);
  assert.equal(adminSessionEpochMatchesUser(0, 'corrupt'), false);
  assert.equal(adminSessionEpochMatchesUser(-1, 0), false);
  assert.equal(adminSessionEpochMatchesUser(1.5, 1), false);
  assert.equal(adminSessionEpochMatchesUser(2, 2), true);
});

test('local admin storage increments the session epoch on 2FA enable and reset', async () => {
  const temporaryDirectory = await mkdtemp(path.join(process.cwd(), '.tmp-astana-admin-session-'));
  const databasePath = path.join(temporaryDirectory, 'local-db.json');
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = '';
  process.env.ASTANA_LOCAL_DB_PATH = databasePath;
  process.env.ADMIN_EMAIL = '';

  try {
    const db = await import(`../src/server/db.ts?admin-session-test=${randomUUID()}`);
    const email = `session-${randomUUID()}@local.test`;
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const created = await db.upsertAdminUser({
      email,
      name: 'Session test',
      role: 'SUPER_ADMIN',
      active: true,
      twoFactorSecret: secret,
    }, 'integration-test');
    assert.equal(created.sessionEpoch, 0);
    const enabled = await db.enableAdminUserTwoFactor(email, ['backup-hash'], 123, secret, 'integration-test', 0);
    assert.equal(enabled?.sessionEpoch, 1);
    assert.equal(await db.enableAdminUserTwoFactor(email, ['replacement-hash'], 123, secret, 'integration-test', 0), null);
    assert.equal((await db.getAdminUserByEmail(email))?.sessionEpoch, 1);
    const reset = await db.resetAdminUserTwoFactor(created.id, 'integration-test');
    assert.equal(reset?.sessionEpoch, 2);
    assert.equal(await db.setAdminUserTwoFactorSecret(email, secret, 'integration-test', 1), null);
    assert.ok(await db.setAdminUserTwoFactorSecret(email, secret, 'integration-test', 2));
    assert.equal(await db.setAdminUserTwoFactorSecret(email, 'replacement', 'integration-test', 2), null);
    assert.equal(await db.enableAdminUserTwoFactor(email, ['new-backup'], 124, secret, 'integration-test', 1), null);
    assert.equal((await db.enableAdminUserTwoFactor(email, ['new-backup'], 124, secret, 'integration-test', 2))?.sessionEpoch, 3);
    assert.equal(await db.consumeAdminUserTotpStep(email, secret, 125, 2), null);
    assert.ok(await db.consumeAdminUserTotpStep(email, secret, 125, 3));
    assert.equal(await db.consumeAdminUserBackupCode(email, 'new-backup', 'integration-test', 2), null);
    assert.ok(await db.consumeAdminUserBackupCode(email, 'new-backup', 'integration-test', 3));
    assert.equal(await db.consumeAdminUserBackupCode(email, 'new-backup', 'integration-test', 3), null);
    const backupAdmin = await db.upsertAdminUser({
      email: `backup-${randomUUID()}@local.test`,
      name: 'Backup superadmin',
      role: 'SUPER_ADMIN',
      active: true,
      passwordHash: 'fixture-backup-password-hash',
    }, 'integration-test');
    await db.setAdminUserActive(created.id, false, backupAdmin.email);
    assert.equal(await db.consumeAdminUserTotpStep(email, secret, 126, 3), null);
    const persisted = JSON.parse(await readFile(databasePath, 'utf8'));
    assert.equal(persisted.adminUsers.find((user) => user.id === created.id)?.sessionEpoch, 4);
    assert.equal(persisted.auditLogs.some((entry) => JSON.stringify(entry).includes(secret)), false,
      'audit nesmie obsahovať 2FA secret ani obnovovacie kódy');
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
