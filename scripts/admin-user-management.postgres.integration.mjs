import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const runToken = process.env.ASTANA_ISOLATED_PG_RUN_TOKEN;
const suppliedUrl = process.env.ASTANA_ISOLATED_PG_URL;
assert.match(runToken || '', /^[a-f0-9]{32}$/, 'A disposable PostgreSQL runner token is required.');
assert.ok(suppliedUrl, 'A disposable PostgreSQL runner URL is required.');
const parsed = new URL(suppliedUrl);
const port = Number(parsed.port);
assert.ok(
  ['postgres:', 'postgresql:'].includes(parsed.protocol)
  && parsed.hostname === '127.0.0.1'
  && parsed.username === 'astana_test'
  && !parsed.password && !parsed.search && !parsed.hash
  && parsed.pathname === `/astana_isolated_${runToken}`
  && Number.isInteger(port) && port > 0 && port <= 65535,
  'Only the runner-owned loopback PostgreSQL database may be tested.',
);

const connectionString = `postgres://astana_test@127.0.0.1:${port}/astana_isolated_${runToken}`;
const inspectPool = new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 3000 });

try {
  const guard = await inspectPool.query('SELECT run_token FROM astana_isolated_runner_guard WHERE run_token = $1', [runToken]);
  assert.equal(guard.rowCount, 1, 'The database must belong to this runner invocation.');

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = connectionString;
  process.env.ADMIN_EMAIL = 'astana@astana.sk';
  const database = await import('../src/server/db.ts');
  const seeded = (await database.listAdminUsers())[0];
  const prepared = await database.upsertAdminUser({
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

  const renamed = await database.saveManagedAdminUser({
    id: prepared.id,
    email: 'lauf@astana.sk',
    name: prepared.name,
    role: prepared.role,
    active: true,
    expectedSessionEpoch: prepared.sessionEpoch,
  }, { email: prepared.email, sessionEpoch: prepared.sessionEpoch });
  assert.equal(renamed.passwordHash, 'fixture-main-password-hash');
  assert.equal(renamed.twoFactorSecret, 'fixture-two-factor-secret');
  assert.equal(renamed.sessionEpoch, prepared.sessionEpoch + 1);

  await assert.rejects(
    database.saveManagedAdminUser({
      id: renamed.id,
      email: renamed.email,
      name: renamed.name,
      role: 'OPERATOR',
      active: true,
      expectedSessionEpoch: renamed.sessionEpoch,
    }, { email: 'security-review@example.invalid', sessionEpoch: 0 }),
    (error) => error instanceof database.AdminUserManagementError && error.code === 'ACTOR_REVOKED',
  );

  const operator = await database.saveManagedAdminUser({
    email: 'astana@astana.sk',
    name: 'ASTANA tím',
    role: 'OPERATOR',
    active: true,
    passwordHash: 'fixture-operator-password-hash',
  }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch });

  await assert.rejects(
    database.saveManagedAdminUser({
      id: operator.id,
      email: operator.email,
      name: 'Chýbajúca verzia',
      role: operator.role,
      active: operator.active,
    }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch }),
    (error) => error instanceof database.AdminUserManagementError && error.code === 'CONFLICT',
  );
  const concurrent = await Promise.allSettled([
    database.saveManagedAdminUser({
      id: operator.id,
      email: operator.email,
      name: 'ASTANA tím A',
      role: operator.role,
      active: operator.active,
      passwordHash: 'fixture-operator-password-hash-v2',
      expectedSessionEpoch: operator.sessionEpoch,
    }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch }),
    database.saveManagedAdminUser({
      id: operator.id,
      email: operator.email,
      name: 'ASTANA tím B',
      role: operator.role,
      active: operator.active,
      passwordHash: 'fixture-operator-password-hash-v3',
      expectedSessionEpoch: operator.sessionEpoch,
    }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch }),
  ]);
  assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter((result) => result.status === 'rejected'
    && result.reason instanceof database.AdminUserManagementError
    && result.reason.code === 'CONFLICT').length, 1);

  const rows = await inspectPool.query('SELECT email, role, active, password_hash, two_factor_secret FROM admin_users ORDER BY email');
  assert.deepEqual(rows.rows.map((row) => [row.email, row.role, row.active]), [
    ['astana@astana.sk', 'OPERATOR', true],
    ['lauf@astana.sk', 'SUPER_ADMIN', true],
  ]);
  const audits = await inspectPool.query("SELECT changes FROM audit_logs WHERE entity_type = 'admin_user'");
  const auditText = JSON.stringify(audits.rows);
  for (const secret of ['fixture-main-password-hash', 'fixture-operator-password-hash', 'fixture-two-factor-secret', 'fixture-backup-hash']) {
    assert.equal(auditText.includes(secret), false, `Audit leaked secret material: ${secret}`);
  }

  await database.upsertAdminUser({
    id: renamed.id,
    email: renamed.email,
    name: renamed.name,
    role: renamed.role,
    active: false,
  }, 'integration-test');
  await assert.rejects(
    database.saveManagedAdminUser({
      email: 'blocked-after-revocation@example.invalid',
      name: 'Blokovaný zápis',
      role: 'OPERATOR',
      active: true,
      passwordHash: 'fixture-blocked-password-hash',
    }, { email: renamed.email, sessionEpoch: renamed.sessionEpoch }),
    (error) => error instanceof database.AdminUserManagementError && error.code === 'ACTOR_REVOKED',
  );

  const revisionId = randomUUID();
  await inspectPool.query('INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes) VALUES ($1,$2,$3,$4,$5,$6)', [
    revisionId, 'admin_user_test', renamed.id, 'admin_user_postgres_test_completed', renamed.email, { users: 2 },
  ]);
  console.log('PASS: PostgreSQL admin identity rename, role isolation, concurrency and secret-free audit.');
} finally {
  await inspectPool.end();
}
