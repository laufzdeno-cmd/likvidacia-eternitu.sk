import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

test('správa admin účtov zachová heslo a 2FA, odvolá relácie a chráni posledného superadmina', async () => {
  const directory = await mkdtemp(path.join(process.cwd(), '.tmp-admin-users-'));
  const databasePath = path.join(directory, 'local-db.json');
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    ASTANA_LOCAL_DB_PATH: process.env.ASTANA_LOCAL_DB_PATH,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  };
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = '';
  process.env.ASTANA_LOCAL_DB_PATH = databasePath;
  process.env.ADMIN_EMAIL = 'astana@astana.sk';

  try {
    const db = await import(`../src/server/db.ts?admin-users=${randomUUID()}`);
    const seeded = (await db.listAdminUsers())[0];
    const prepared = await db.upsertAdminUser({
      id: seeded.id,
      email: seeded.email,
      name: 'Hlavný admin',
      role: 'SUPER_ADMIN',
      active: true,
      passwordHash: 'fixture-main-password-hash',
      twoFactorSecret: 'fixture-two-factor-secret',
      twoFactorEnabled: true,
      twoFactorBackupCodeHashes: ['fixture-backup-hash'],
    }, seeded.email);

    const renamed = await db.saveManagedAdminUser({
      id: prepared.id,
      email: 'lauf@astana.sk',
      name: 'Hlavný admin',
      role: 'SUPER_ADMIN',
      active: true,
      expectedSessionEpoch: prepared.sessionEpoch,
    }, { email: prepared.email, sessionEpoch: prepared.sessionEpoch });
    assert.equal(renamed.email, 'lauf@astana.sk');
    assert.equal(renamed.passwordHash, 'fixture-main-password-hash');
    assert.equal(renamed.twoFactorSecret, 'fixture-two-factor-secret');
    assert.equal(renamed.twoFactorEnabled, true);
    assert.equal(renamed.sessionEpoch, prepared.sessionEpoch + 1);

    process.env.ADMIN_EMAIL = 'astana@astana.sk';
    assert.deepEqual((await db.listAdminUsers()).map((user) => user.email), ['lauf@astana.sk'],
      'zmena bootstrap emailu nesmie znovu vytvoriť starý superadmin účet');

    await assert.rejects(
      db.saveManagedAdminUser({
        id: renamed.id,
        email: renamed.email,
        name: renamed.name,
        role: 'OPERATOR',
        active: true,
        expectedSessionEpoch: renamed.sessionEpoch,
      }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch }),
      (error) => error instanceof db.AdminUserManagementError && error.code === 'SELF_ACCESS_CHANGE',
    );
    await assert.rejects(
      db.saveManagedAdminUser({
        id: renamed.id,
        email: renamed.email,
        name: renamed.name,
        role: 'OPERATOR',
        active: true,
        expectedSessionEpoch: renamed.sessionEpoch,
      }, { email: 'security-review@example.invalid', sessionEpoch: 0 }),
      (error) => error instanceof db.AdminUserManagementError && error.code === 'ACTOR_REVOKED',
    );
    await assert.rejects(
      db.saveManagedAdminUser({
        email: 'empty-password@example.invalid',
        name: 'Bez hesla',
        role: 'OPERATOR',
        active: true,
      }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch }),
      (error) => error instanceof db.AdminUserManagementError && error.code === 'MISSING_PASSWORD',
    );

    const operator = await db.saveManagedAdminUser({
      email: 'astana@astana.sk',
      name: 'ASTANA tím',
      role: 'OPERATOR',
      active: true,
      passwordHash: 'fixture-operator-password-hash',
    }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch });
    assert.equal(operator.role, 'OPERATOR');
    assert.equal(operator.active, true);

    await assert.rejects(
      db.saveManagedAdminUser({
        email: operator.email,
        name: 'Duplikát',
        role: 'OPERATOR',
        active: true,
        passwordHash: 'different-fixture-hash',
      }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch }),
      (error) => error instanceof db.AdminUserManagementError && error.code === 'DUPLICATE_EMAIL',
    );

    await assert.rejects(
      db.saveManagedAdminUser({
        id: operator.id,
        email: operator.email,
        name: 'Chýbajúca verzia',
        role: operator.role,
        active: operator.active,
      }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch }),
      (error) => error instanceof db.AdminUserManagementError && error.code === 'CONFLICT',
    );

    const firstUpdate = db.saveManagedAdminUser({
      id: operator.id,
      email: operator.email,
      name: 'ASTANA tím A',
      role: operator.role,
      active: operator.active,
      expectedSessionEpoch: operator.sessionEpoch,
      passwordHash: 'fixture-operator-password-hash-v2',
    }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch });
    const secondUpdate = db.saveManagedAdminUser({
      id: operator.id,
      email: operator.email,
      name: 'ASTANA tím B',
      role: operator.role,
      active: operator.active,
      expectedSessionEpoch: operator.sessionEpoch,
      passwordHash: 'fixture-operator-password-hash-v3',
    }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch });
    const settled = await Promise.allSettled([firstUpdate, secondUpdate]);
    assert.equal(settled.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(settled.filter((result) => result.status === 'rejected'
      && result.reason instanceof db.AdminUserManagementError
      && result.reason.code === 'CONFLICT').length, 1);

    const persisted = JSON.parse(await readFile(databasePath, 'utf8'));
    assert.match(
      persisted.adminUsers.find((user) => user.id === operator.id)?.passwordHash || '',
      /^fixture-operator-password-hash-v[23]$/,
      'výsledný hash patrí iba do súkromného záznamu účtu',
    );
    const auditText = JSON.stringify(persisted.auditLogs);
    assert.equal(auditText.includes('fixture-main-password-hash'), false);
    assert.equal(auditText.includes('fixture-operator-password-hash'), false);
    assert.equal(auditText.includes('fixture-two-factor-secret'), false);
    assert.equal(persisted.auditLogs.some((entry) => entry.action === 'admin_user_updated'
      && entry.changes?.passwordChanged === true
      && entry.changes?.sessionsRevoked === true), true);

    await db.upsertAdminUser({
      id: renamed.id,
      email: renamed.email,
      name: renamed.name,
      role: renamed.role,
      active: false,
    }, 'integration-test');
    await assert.rejects(
      db.saveManagedAdminUser({
        email: 'blocked-after-revocation@example.invalid',
        name: 'Blokovaný zápis',
        role: 'OPERATOR',
        active: true,
        passwordHash: 'fixture-blocked-password-hash',
      }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch }),
      (error) => error instanceof db.AdminUserManagementError && error.code === 'ACTOR_REVOKED',
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
