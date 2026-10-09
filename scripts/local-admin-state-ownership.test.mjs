import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { Socket } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

// Exercise local persistence only: no HTTP, credentials, sessions or external database.
test('local admin state has explicit persistence owners', { timeout: 20_000 }, async (t) => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const directory = await fs.mkdtemp(path.join(root, '.tmp-local-admin-ownership-'));
  const databasePath = path.join(directory, 'local-db.json');
  const environment = {
    NODE_ENV: 'test', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: databasePath,
    ADMIN_EMAIL: 'default-admin@example.invalid', VERCEL: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '',
  };
  const previous = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]));
  Object.assign(process.env, environment);
  t.mock.method(Socket.prototype, 'connect', () => { throw new Error('Network is forbidden in this local test.'); });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Network is forbidden in this local test.'); });
  const readSnapshot = async () => JSON.parse(await fs.readFile(databasePath, 'utf8'));

  try {
    const db = await import('../src/server/db.ts');
    await t.test('concurrent defaults readers initialize once and subsequent reads do not write', async (st) => {
      await Promise.all([
        db.listAdminUsers(), db.getAdminUserByEmail(environment.ADMIN_EMAIL), db.listWorkers(),
        db.upsertWorker({ name: 'Local worker', ratePerM2: 3 }),
      ]);
      const initialized = await readSnapshot();
      assert.equal(initialized.adminUsers.length, 1);
      assert.equal(initialized.adminUsers[0].email, environment.ADMIN_EMAIL);
      assert.equal(initialized.workers.length, 4);
      const originalWrite = fs.writeFile;
      const writes = st.mock.method(fs, 'writeFile', (...args) => originalWrite(...args));
      syncBuiltinESMExports();
      try {
        await Promise.all([db.listAdminUsers(), db.getAdminUserByEmail(environment.ADMIN_EMAIL), db.listWorkers()]);
        assert.equal(writes.mock.callCount(), 0, 'existing defaults must not rewrite the database');
      } finally {
        writes.mock.restore();
        syncBuiltinESMExports();
      }
    });

    const actor = 'local-test@example.invalid';
    const email = 'operator@example.invalid';
    const user = await db.upsertAdminUser({
      email, name: 'Local operator', role: 'OPERATOR', active: true,
      passwordHash: 'fixture-password-v1', twoFactorSecret: 'fixture-secret',
      twoFactorEnabled: true, twoFactorBackupCodeHashes: ['fixture-code-one', 'fixture-code-two'],
    }, actor);
    await db.setAdminSetting('admin_password_hash', 'fixture-override-v1', actor);

    // Pause an ordinary business write after its snapshot has been read. Let the
    // explicit owner finish, then verify the delayed write retains its complete state.
    async function delayedBusinessWrite(st, ownerWrite) {
      const captured = deferred();
      const resume = deferred();
      const originalRead = fs.readFile;
      let pendingCapture = true;
      const reader = st.mock.method(fs, 'readFile', async (file, ...args) => {
        const capture = pendingCapture && String(file) === databasePath;
        if (capture) pendingCapture = false;
        const contents = await originalRead(file, ...args);
        if (capture) {
          captured.resolve();
          await resume.promise;
        }
        return contents;
      });
      syncBuiltinESMExports();
      const ordinaryWrite = db.upsertLandfillPrice({ year: 2026, landfill: 'fixture-landfill', pricePerTon: 100 });
      ordinaryWrite.catch((error) => captured.reject(error));
      try {
        await captured.promise;
        await ownerWrite();
        const expected = await readSnapshot();
        resume.resolve();
        await ordinaryWrite;
        const persisted = await readSnapshot();
        assert.deepEqual(persisted.adminUsers, expected.adminUsers, 'retain the complete current user collection');
        assert.deepEqual(persisted.adminSettings, expected.adminSettings, 'retain current settings');
        assert.equal(persisted.landfillPrices[0].pricePerTon, 100, 'ordinary business update still persists');
      } finally {
        resume.resolve();
        await ordinaryWrite.catch(() => undefined);
        reader.mock.restore();
        syncBuiltinESMExports();
      }
    }

    await t.test('ordinary stale snapshots retain a completed reset and newly created users', async (st) => {
      await delayedBusinessWrite(st, async () => {
        const reset = await db.resetAdminUserTwoFactor(user.id, actor);
        assert.equal(reset.sessionEpoch, 1);
        assert.equal(reset.twoFactorSecret, '');
        assert.deepEqual(reset.twoFactorBackupCodeHashes, []);
        await db.upsertAdminUser({ email: 'second@example.invalid', role: 'OPERATOR', active: true }, actor);
      });
      assert.equal((await db.getAdminUserByEmail(email)).sessionEpoch, 1);
      assert.equal((await db.listAdminUsers()).length, 3);
    });

    await t.test('same-epoch user changes and password settings survive unrelated snapshots', async (st) => {
      await delayedBusinessWrite(st, async () => {
        const saved = await db.upsertAdminUser({
          id: user.id, email, name: 'Updated operator', role: 'OPERATOR', active: true,
          passwordHash: 'fixture-password-v2', twoFactorBackupCodeHashes: [],
        }, actor);
        assert.equal(saved.sessionEpoch, 1);
        await db.setAdminUserActive(user.id, false, environment.ADMIN_EMAIL);
        await Promise.all([
          db.setAdminSetting('admin_password_hash', 'fixture-override-v2', actor),
          db.setAdminSetting('local_test_setting', 'saved', actor),
        ]);
      });
      const saved = await db.getAdminUserByEmail(email);
      assert.equal(saved.active, false);
      assert.equal(saved.passwordHash, 'fixture-password-v2');
      assert.equal(await db.getAdminSetting('admin_password_hash'), 'fixture-override-v2');
      assert.equal(await db.getAdminSetting('local_test_setting'), 'saved');
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    assert.equal(path.dirname(directory), root);
    await fs.rm(directory, { recursive: true, force: true });
  }
});
