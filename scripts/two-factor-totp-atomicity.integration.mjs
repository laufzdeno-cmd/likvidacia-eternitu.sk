import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { generateSync } from 'otplib';

let pglite;
let server;
let enableAdminUserTwoFactor;
let consumeAdminUserTotpStep;
let getAdminUserByEmail;
let upsertAdminUser;
let verifyTotpTimeStep;

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startIsolatedDatabase() {
  const port = await availablePort();
  pglite = await PGlite.create();
  server = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.ADMIN_EMAIL = '';

  ({ enableAdminUserTwoFactor, consumeAdminUserTotpStep, getAdminUserByEmail, upsertAdminUser } = await import('../src/server/db.ts'));
  ({ verifyTotpTimeStep } = await import('../src/server/two-factor.ts'));
}

async function testTotpReplayAndConcurrency() {
  const email = `totp-${randomUUID()}@local.test`;
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  const timeStep = Math.floor(Date.now() / 30_000);
  const epoch = timeStep * 30;
  const token = generateSync({ secret, epoch });

  await upsertAdminUser({ email, name: 'TOTP test', role: 'SUPER_ADMIN', active: true, twoFactorSecret: secret }, 'integration-test');
  const enabled = await enableAdminUserTwoFactor(email, ['backup-hash'], timeStep - 1, secret, 'integration-test');
  assert.ok(enabled, 'initial setup must succeed');
  assert.equal(verifyTotpTimeStep(token, secret, epoch), timeStep, 'legitimate code resolves to its exact time step');

  const results = await Promise.all([
    consumeAdminUserTotpStep(email, secret, timeStep),
    consumeAdminUserTotpStep(email, secret, timeStep),
  ]);
  assert.equal(results.filter(Boolean).length, 1, 'only one parallel request may consume the same code');
  assert.equal(await consumeAdminUserTotpStep(email, secret, timeStep), null, 'the same time step cannot be replayed');
  const nextEpoch = (timeStep + 1) * 30;
  const nextToken = generateSync({ secret, epoch: nextEpoch });
  assert.equal(verifyTotpTimeStep(nextToken, secret, nextEpoch), timeStep + 1);
  assert.ok(await consumeAdminUserTotpStep(email, secret, timeStep + 1), 'a later valid time step remains usable');
}

async function testSetupCodeReplay() {
  const email = `totp-setup-${randomUUID()}@local.test`;
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  const timeStep = Math.floor(Date.now() / 30_000);

  await upsertAdminUser({ email, name: 'TOTP setup test', role: 'SUPER_ADMIN', active: true, twoFactorSecret: secret }, 'integration-test');
  assert.ok(await enableAdminUserTwoFactor(email, ['first-backup-hash'], timeStep, secret, 'integration-test'));
  assert.equal(await enableAdminUserTwoFactor(email, ['replacement-backup-hash'], timeStep, secret, 'integration-test'), null);
  const user = await getAdminUserByEmail(email);
  assert.deepEqual(user?.twoFactorBackupCodeHashes, ['first-backup-hash']);
  assert.equal(user?.twoFactorLastUsedStep, timeStep);
}

async function testSecretRotation() {
  const email = `totp-rotation-${randomUUID()}@local.test`;
  const oldSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  const nextSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const timeStep = Math.floor(Date.now() / 30_000);

  await upsertAdminUser({ email, name: 'TOTP rotation test', role: 'SUPER_ADMIN', active: true, twoFactorSecret: oldSecret }, 'integration-test');
  assert.ok(await enableAdminUserTwoFactor(email, ['old-backup-hash'], timeStep - 1, oldSecret, 'integration-test'));
  await upsertAdminUser({ email, name: 'TOTP rotation test', role: 'SUPER_ADMIN', active: true, twoFactorSecret: nextSecret }, 'integration-test');
  assert.equal(await getAdminUserByEmail(email).then((user) => user?.twoFactorLastUsedStep), -1);
  assert.equal(await enableAdminUserTwoFactor(email, ['wrong-secret-backup-hash'], timeStep, oldSecret, 'integration-test'), null);
  assert.ok(await enableAdminUserTwoFactor(email, ['new-backup-hash'], timeStep, nextSecret, 'integration-test'));
  assert.equal(await consumeAdminUserTotpStep(email, nextSecret, timeStep), null);
}

let exitCode = 0;
try {
  await startIsolatedDatabase();
  await testTotpReplayAndConcurrency();
  await testSetupCodeReplay();
  await testSecretRotation();
  console.log('PASS: izolovaný PGlite TOTP replay/atomickosť, setup replay a rotácia secretu. Bez produkčnej DB, Blobu alebo e-mailu.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try {
    await server?.stop();
    await pglite?.close();
  } catch (error) {
    console.error('Cleanup failed:', error);
    exitCode = 1;
  }
}
process.exit(exitCode);
