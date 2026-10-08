import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapStagingDatabase, stagingDatabasePoolConfig, stagingDatabaseSsl } from './bootstrap-staging-database.ts';
import {
  deploymentDatabaseIdentity,
  deploymentResourceFingerprint,
  stagingResourceBinding,
} from '../src/server/preview-safety.ts';

function stagingEnvironment() {
  const environment = {
    VERCEL_PROJECT_ID: 'prj_astana',
    DATABASE_URL: 'postgresql://staging.invalid/astana',
    DATABASE_RESOURCE_ID: 'neon-staging/branch-staging/astana',
    BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_staging_secret',
    BLOB_RESOURCE_ID: 'staging',
    PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_photostaging_secret',
    PHOTO_INTAKE_BLOB_RESOURCE_ID: 'photostaging',
    STAGING_WRITE_ENABLED: 'true',
    STAGING_MAIL_OVERRIDE_TO: 'qa@example.test',
    STAGING_DATABASE_MARKER: 'b'.repeat(64),
    PRODUCTION_DATABASE_IDENTITY_FINGERPRINT_SHA256: deploymentResourceFingerprint(deploymentDatabaseIdentity('postgresql://production.invalid/astana')),
    PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256: deploymentResourceFingerprint('neon-production/branch-production/astana'),
    PRODUCTION_BLOB_RESOURCE_ID_FINGERPRINT_SHA256: deploymentResourceFingerprint('production'),
    PRODUCTION_PHOTO_INTAKE_BLOB_RESOURCE_ID_FINGERPRINT_SHA256: deploymentResourceFingerprint('photoproduction'),
  };
  environment.STAGING_RESOURCE_BINDING_SHA256 = stagingResourceBinding({
    ...environment,
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_TARGET_ENV: 'staging',
  });
  return environment;
}

function fixture({ storedMarker = 'b'.repeat(64), failAt = '' } = {}) {
  const calls = [];
  let released = false;
  let ended = false;
  let poolConfig = null;
  const client = {
    async query(sql, values = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, values });
      if (failAt && normalized.startsWith(failAt)) throw new Error('simulated query failure');
      if (normalized.startsWith('SELECT marker')) return { rowCount: 1, rows: [{ marker: storedMarker }] };
      return { rowCount: 0, rows: [] };
    },
    release() { released = true; },
  };
  return {
    calls,
    get poolConfig() { return poolConfig; },
    get ended() { return ended; },
    get released() { return released; },
    poolFactory(value) {
      poolConfig = value;
      return { connect: async () => client, end: async () => { ended = true; } };
    },
  };
}

const args = ['--confirm-project', 'prj_astana', '--confirm-database-resource', 'neon-staging/branch-staging/astana'];

test('bootstrap creates only the staging guard atomically and never embeds the marker in SQL', async () => {
  const f = fixture();
  const result = await bootstrapStagingDatabase({ argv: args, environment: stagingEnvironment(), poolFactory: f.poolFactory });
  assert.deepEqual(result, { databaseResourceId: 'neon-staging/branch-staging/astana', status: 'ready' });
  assert.deepEqual(f.poolConfig, {
    host: 'staging.invalid', port: 5432, database: 'astana', user: undefined, password: undefined,
    ssl: { rejectUnauthorized: true }, max: 1, connectionTimeoutMillis: 5_000,
  });
  assert.deepEqual(f.calls.map((call) => call.sql.split(' ')[0]), ['BEGIN', 'SELECT', 'CREATE', 'INSERT', 'SELECT', 'COMMIT']);
  assert.deepEqual(f.calls.find((call) => call.sql.startsWith('INSERT')).values, ['b'.repeat(64)]);
  assert.equal(f.calls.some((call) => call.sql.includes('b'.repeat(64))), false);
  assert.equal(f.released, true);
  assert.equal(f.ended, true);
});

test('TLS policy uses the parsed hostname and verifies every remote certificate', () => {
  assert.deepEqual(stagingDatabaseSsl('postgresql://user:localhost@remote.invalid/db?note=127.0.0.1'), { rejectUnauthorized: true });
  assert.deepEqual(stagingDatabasePoolConfig('postgresql://user:p%40ss@remote.invalid/db?sslmode=require'), {
    host: 'remote.invalid', port: 5432, database: 'db', user: 'user', password: 'p@ss',
    ssl: { rejectUnauthorized: true }, max: 1, connectionTimeoutMillis: 5_000,
  });
  for (const unsafe of [
    'postgresql://user:secret@remote.invalid/db?ssl=0',
    'postgresql://user:secret@remote.invalid/db?sslmode=require&uselibpqcompat=true',
    'postgresql://user:secret@remote.invalid/db?sslrootcert=C%3A%5Cunsafe.pem',
  ]) {
    assert.throws(() => stagingDatabasePoolConfig(unsafe), /nepovolený cieľ alebo TLS/);
  }
  assert.equal(stagingDatabaseSsl('postgresql://user:secret@127.0.0.1:5432/db'), undefined);
  assert.equal(stagingDatabaseSsl('postgresql://user:secret@localhost:5432/db'), undefined);
});

test('bootstrap refuses incomplete identity and confirmation mismatches before opening a pool', async () => {
  const environment = stagingEnvironment();
  for (const argv of [
    [],
    ['--confirm-project', 'wrong', '--confirm-database-resource', environment.DATABASE_RESOURCE_ID],
    ['--confirm-project', environment.VERCEL_PROJECT_ID, '--confirm-database-resource', 'wrong'],
  ]) {
    let opened = false;
    await assert.rejects(
      () => bootstrapStagingDatabase({ argv, environment, poolFactory: () => { opened = true; throw new Error('must not open'); } }),
      /Chýba povinný parameter|nezhoduje/,
    );
    assert.equal(opened, false);
  }
  const shared = { ...environment, BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_production_secret', BLOB_RESOURCE_ID: 'production' };
  shared.STAGING_RESOURCE_BINDING_SHA256 = stagingResourceBinding({ ...shared, VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'staging' });
  let opened = false;
  await assert.rejects(
    () => bootstrapStagingDatabase({ argv: args, environment: shared, poolFactory: () => { opened = true; throw new Error('must not open'); } }),
    /nemajú úplnú bezpečnú väzbu/,
  );
  assert.equal(opened, false);
});

test('bootstrap never overwrites a different marker and rolls back failures', async () => {
  for (const options of [{ storedMarker: 'c'.repeat(64) }, { failAt: 'SELECT marker' }]) {
    const f = fixture(options);
    await assert.rejects(
      () => bootstrapStagingDatabase({ argv: args, environment: stagingEnvironment(), poolFactory: f.poolFactory }),
      /inú identitu|simulated query failure/,
    );
    assert.equal(f.calls.some((call) => call.sql === 'COMMIT'), false);
    assert.equal(f.calls.at(-1).sql, 'ROLLBACK');
    assert.equal(f.released, true);
    assert.equal(f.ended, true);
  }
});
