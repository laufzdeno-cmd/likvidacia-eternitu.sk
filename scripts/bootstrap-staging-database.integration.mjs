import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';
import { bootstrapStagingDatabase } from './bootstrap-staging-database.ts';
import {
  deploymentDatabaseIdentity,
  deploymentResourceFingerprint,
  stagingResourceBinding,
} from '../src/server/preview-safety.ts';

async function findAvailablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForSocketHandlersToClose(server, timeoutMillis = 2_000) {
  const startedAt = Date.now();
  while ((server.handlers?.size ?? 0) > 0) {
    if (Date.now() - startedAt >= timeoutMillis) {
      throw new Error('PGlite socket handlers did not close before teardown');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function environmentFor(databaseUrl, marker) {
  const environment = {
    VERCEL_PROJECT_ID: 'prj_astana_integration',
    DATABASE_URL: databaseUrl,
    DATABASE_RESOURCE_ID: 'isolated-pglite/staging/astana',
    BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_stagingintegration_secret',
    BLOB_RESOURCE_ID: 'stagingintegration',
    PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_photostagingintegration_secret',
    PHOTO_INTAKE_BLOB_RESOURCE_ID: 'photostagingintegration',
    STAGING_WRITE_ENABLED: 'true',
    STAGING_MAIL_OVERRIDE_TO: 'qa@example.test',
    STAGING_DATABASE_MARKER: marker,
    PRODUCTION_DATABASE_IDENTITY_FINGERPRINT_SHA256: deploymentResourceFingerprint(deploymentDatabaseIdentity('postgresql://production.invalid/astana')),
    PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256: deploymentResourceFingerprint('production-neon/branch/astana'),
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

const args = [
  '--confirm-project', 'prj_astana_integration',
  '--confirm-database-resource', 'isolated-pglite/staging/astana',
];
const markerA = 'a'.repeat(64);
const markerB = 'b'.repeat(64);
const database = await PGlite.create();
const port = await findAvailablePort();
const socket = new PGLiteSocketServer({ db: database, port, host: '127.0.0.1', maxConnections: 16 });
await socket.start();
const databaseUrl = `postgresql://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
const inspectPool = new pg.Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 3_000 });

async function bootstrap(marker, options = {}) {
  return bootstrapStagingDatabase({
    argv: args,
    environment: environmentFor(databaseUrl, marker),
    ...options,
  });
}

try {
  await bootstrap(markerA);
  await bootstrap(markerA);
  await Promise.all([bootstrap(markerA), bootstrap(markerA)]);
  let stored = await inspectPool.query("SELECT marker FROM astana_environment_guard WHERE environment = 'staging'");
  assert.deepEqual(stored.rows, [{ marker: markerA }], 'same-marker retries and concurrency must stay idempotent');

  await assert.rejects(() => bootstrap(markerB), /už obsahuje inú identitu/);
  stored = await inspectPool.query("SELECT marker FROM astana_environment_guard WHERE environment = 'staging'");
  assert.deepEqual(stored.rows, [{ marker: markerA }], 'different marker must never overwrite the accepted identity');

  await inspectPool.query('DROP TABLE astana_environment_guard');
  const rollbackPoolFactory = (config) => {
    const pool = new pg.Pool({ ...config, connectionTimeoutMillis: 3_000 });
    return {
      async connect() {
        const client = await pool.connect();
        return {
          async query(sql, values) {
            const result = await client.query(sql, values);
            if (/^\s*INSERT INTO astana_environment_guard/i.test(sql)) throw new Error('simulated failure after insert');
            return result;
          },
          release: () => client.release(),
        };
      },
      end: () => pool.end(),
    };
  };
  await assert.rejects(() => bootstrap(markerA, { poolFactory: rollbackPoolFactory }), /simulated failure after insert/);
  const afterRollback = await inspectPool.query("SELECT to_regclass('astana_environment_guard') AS relation");
  assert.equal(afterRollback.rows[0].relation, null, 'DDL and marker insert must roll back together');

  const concurrent = await Promise.allSettled([bootstrap(markerA), bootstrap(markerB)]);
  assert.equal(concurrent.filter((entry) => entry.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter((entry) => entry.status === 'rejected').length, 1);
  stored = await inspectPool.query("SELECT marker FROM astana_environment_guard WHERE environment = 'staging'");
  assert.equal(stored.rowCount, 1);
  assert.ok(stored.rows[0].marker === markerA || stored.rows[0].marker === markerB);

  console.log('PASS: staging bootstrap is transactional, idempotent and concurrency-safe on disposable PostgreSQL.');
} finally {
  await inspectPool.end();
  // pglite-socket schedules its close handler with setImmediate. Waiting for
  // the handlers to detach avoids closing PGlite while a late detach still
  // checks transaction state.
  await waitForSocketHandlersToClose(socket);
  await socket.stop();
  await database.close();
}
