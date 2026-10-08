import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  deploymentDatabaseAccessBlocked,
  deploymentDatabaseIdentity,
  deploymentRequestBlocked,
  deploymentResourceFingerprint,
  isVerifiedLocalBuildHarness,
  isVerifiedIsolatedStaging,
  runtimeSchemaInitializationAllowed,
  stagingDatabaseMarkerMatches,
  stagingResourceBinding,
  type DeploymentSafetyEnvironment,
  vercelBlobStoreId,
} from '../src/server/preview-safety';
import { resolveOutboundEmailRecipient } from '../src/server/mail';
import { isAstanaLocalRelayConfigured, leadDeliveryMode } from '../src/server/astana-local-relay';

const proxySource = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
const dbSource = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../src/server/auth.ts', import.meta.url), 'utf8');
const nextConfigSource = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
const photoHarnessSource = readFileSync(new URL('../scripts/photo-intake-browser.integration.mjs', import.meta.url), 'utf8');
const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

const productionResources = {
  database: 'postgresql://production.invalid/astana',
  databaseResourceId: 'neon-project-production/branch-production/astana',
  blobStoreId: 'production',
  photoBlobStoreId: 'photoproduction',
};

function isolatedStagingEnvironment(): DeploymentSafetyEnvironment {
  const environment: DeploymentSafetyEnvironment = {
    NODE_ENV: 'production',
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_TARGET_ENV: 'staging',
    VERCEL_PROJECT_ID: 'prj_astana',
    DATABASE_URL: 'postgresql://staging.invalid/astana',
    DATABASE_RESOURCE_ID: 'neon-project-staging/branch-staging/astana',
    BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_staging_secret',
    BLOB_RESOURCE_ID: 'staging',
    PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_photostaging_secret',
    PHOTO_INTAKE_BLOB_RESOURCE_ID: 'photostaging',
    STAGING_WRITE_ENABLED: 'true',
    STAGING_MAIL_OVERRIDE_TO: 'qa@example.test',
    STAGING_DATABASE_MARKER: 'b'.repeat(64),
    PRODUCTION_DATABASE_IDENTITY_FINGERPRINT_SHA256: deploymentResourceFingerprint(deploymentDatabaseIdentity(productionResources.database)),
    PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256: deploymentResourceFingerprint(productionResources.databaseResourceId),
    PRODUCTION_BLOB_RESOURCE_ID_FINGERPRINT_SHA256: deploymentResourceFingerprint(productionResources.blobStoreId),
    PRODUCTION_PHOTO_INTAKE_BLOB_RESOURCE_ID_FINGERPRINT_SHA256: deploymentResourceFingerprint(productionResources.photoBlobStoreId),
    NEXT_PUBLIC_SITE_URL: 'https://likvidacia-eternitu.sk',
  };
  environment.STAGING_RESOURCE_BINDING_SHA256 = stagingResourceBinding(environment);
  return environment;
}

const previewEnvironment: DeploymentSafetyEnvironment = {
  NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview',
};
const liveProductionEnvironment: DeploymentSafetyEnvironment = {
  NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: 'https://likvidacia-eternitu.sk',
};

function isolatedBuildHarnessEnvironment(): DeploymentSafetyEnvironment {
  const databaseUrl = 'postgresql://astana_test@127.0.0.1:54329/astana_isolated';
  return {
    NODE_ENV: 'production',
    ASTANA_HARNESS_CHILD: '1',
    ASTANA_HARNESS_FULL_BUILD: '1',
    ASTANA_ISOLATED_PG_RUN_TOKEN: 'a'.repeat(32),
    ASTANA_ISOLATED_PG_URL: databaseUrl,
    DATABASE_URL: databaseUrl,
  };
}

test('every configured cron URL is canonical for trailingSlash and resolves to a route', () => {
  assert.match(nextConfigSource, /trailingSlash:\s*true/);
  assert.ok(vercelConfig.crons.length > 0);
  const paths = vercelConfig.crons.map((cron: { path: string }) => cron.path);
  assert.equal(new Set(paths).size, paths.length, 'duplicate cron paths need explicit schedule handling');
  for (const path of paths) {
    assert.match(path, /^\/api\/cron\/[a-z0-9-]+\/$/, `non-canonical cron path: ${path}`);
    assert.ok(existsSync(new URL(`../app${path}route.ts`, import.meta.url)), `missing cron route: ${path}`);
  }
});

test('Preview and staged Production refuse writes; only canonical live Production and verified Staging allow them', () => {
  const staging = isolatedStagingEnvironment();
  for (const path of ['/api/lead/', '/api/lead-upload/', '/api/photo-intake/upload/', '/admin/dopyty/']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(deploymentRequestBlocked(previewEnvironment, method, path, 'preview.vercel.app'), true, `${method} ${path}`);
      assert.equal(deploymentRequestBlocked({ NODE_ENV: 'production' }, method, path, 'unknown.vercel.app'), true, `${method} ${path} unknown`);
      assert.equal(deploymentRequestBlocked(liveProductionEnvironment, method, path, 'release.vercel.app'), true, `${method} ${path} staged production`);
      assert.equal(deploymentRequestBlocked(liveProductionEnvironment, method, path, 'likvidacia-eternitu.sk'), false, `${method} ${path} live production`);
      assert.equal(deploymentRequestBlocked(staging, method, path, 'staging.vercel.app'), false, `${method} ${path} staging`);
    }
  }
  assert.equal(deploymentRequestBlocked(staging, 'GET', '/api/cron/lead-email-delivery/', 'staging.vercel.app'), true);
  assert.equal(deploymentRequestBlocked(liveProductionEnvironment, 'GET', '/api/realization-case-media/id/', 'release.vercel.app'), true);
  assert.equal(deploymentRequestBlocked(liveProductionEnvironment, 'GET', '/api/lead/receipt/', 'release.vercel.app'), true);
  assert.equal(deploymentRequestBlocked(liveProductionEnvironment, 'GET', '/dopyt-prijaty/', 'release.vercel.app'), true);
  assert.equal(deploymentRequestBlocked(liveProductionEnvironment, 'GET', '/admin/dopyty/', 'release.vercel.app'), true);
  assert.equal(deploymentRequestBlocked(liveProductionEnvironment, 'GET', '/spolupraca/fotky/', 'release.vercel.app'), true);
  assert.equal(deploymentRequestBlocked({ ...liveProductionEnvironment, NEXT_PUBLIC_SITE_URL: 'https://release.vercel.app' }, 'POST', '/api/lead/', 'release.vercel.app'), true);
  assert.equal(deploymentRequestBlocked(liveProductionEnvironment, 'GET', '/realizacie/', 'release.vercel.app'), false);
  assert.equal(deploymentRequestBlocked(previewEnvironment, 'GET', '/api/cron/backup/', 'preview.vercel.app'), true);
  assert.equal(deploymentRequestBlocked(previewEnvironment, 'GET', '/api/lead/receipt/', 'preview.vercel.app'), false);
  assert.equal(deploymentRequestBlocked(previewEnvironment, 'GET', '/admin/login/', 'preview.vercel.app'), false);
  assert.equal(deploymentRequestBlocked({ NODE_ENV: 'development' }, 'POST', '/api/lead/', 'localhost'), false);
});

test('database and runtime schema access follow the isolated environment state machine', () => {
  const staging = isolatedStagingEnvironment();
  const localBuildHarness = isolatedBuildHarnessEnvironment();
  assert.equal(deploymentDatabaseAccessBlocked(previewEnvironment), true);
  assert.equal(deploymentDatabaseAccessBlocked({ NODE_ENV: 'production' }), true);
  assert.equal(deploymentDatabaseAccessBlocked(liveProductionEnvironment), false);
  assert.equal(deploymentDatabaseAccessBlocked(staging), false);
  assert.equal(deploymentDatabaseAccessBlocked(localBuildHarness), false);
  assert.equal(deploymentDatabaseAccessBlocked({ NODE_ENV: 'development' }), false);
  assert.equal(runtimeSchemaInitializationAllowed(liveProductionEnvironment), false);
  assert.equal(runtimeSchemaInitializationAllowed(staging), true);
  assert.equal(runtimeSchemaInitializationAllowed(localBuildHarness), true);
  assert.equal(runtimeSchemaInitializationAllowed({ NODE_ENV: 'development' }), true);
  assert.match(dbSource, /if \(deploymentDatabaseAccessBlocked\(\)\)/);
  assert.match(dbSource, /if \(!runtimeSchemaInitializationAllowed\(\)\) \{\s*schemaReady = true;\s*return;/);
  assert.match(dbSource, /SELECT marker FROM astana_environment_guard WHERE environment = 'staging' LIMIT 1/);
  assert.match(dbSource, /stagingDatabaseMarkerMatches\(marker\.rows\[0\]\?\.marker\)/);
});

test('full-build database access is limited to the owned loopback harness', () => {
  const valid = isolatedBuildHarnessEnvironment();
  assert.equal(isVerifiedLocalBuildHarness(valid), true);
  for (const key of ['ASTANA_HARNESS_CHILD', 'ASTANA_HARNESS_FULL_BUILD', 'ASTANA_ISOLATED_PG_RUN_TOKEN', 'ASTANA_ISOLATED_PG_URL', 'DATABASE_URL'] as const) {
    assert.equal(isVerifiedLocalBuildHarness({ ...valid, [key]: undefined }), false, key);
  }
  assert.equal(isVerifiedLocalBuildHarness({ ...valid, VERCEL: '1' }), false);
  assert.equal(isVerifiedLocalBuildHarness({ ...valid, ASTANA_ISOLATED_PG_RUN_TOKEN: 'short' }), false);
  assert.equal(isVerifiedLocalBuildHarness({ ...valid, DATABASE_URL: 'postgresql://production.invalid/astana', ASTANA_ISOLATED_PG_URL: 'postgresql://production.invalid/astana' }), false);
  assert.equal(isVerifiedLocalBuildHarness({ ...valid, ASTANA_ISOLATED_PG_URL: `${valid.ASTANA_ISOLATED_PG_URL}-changed` }), false);
  for (const override of [
    '?host=production.invalid',
    '?hostaddr=203.0.113.10',
    '?port=5432',
    '?service=production',
    '?servicefile=C%3A%5Cproduction%5Cpg_service.conf',
    '?socket=%2Fvar%2Frun%2Fpostgresql',
  ]) {
    const databaseUrl = `${valid.DATABASE_URL}${override}`;
    assert.equal(isVerifiedLocalBuildHarness({ ...valid, DATABASE_URL: databaseUrl, ASTANA_ISOLATED_PG_URL: databaseUrl }), false, override);
  }
  assert.equal(isVerifiedLocalBuildHarness({ ...valid, DATABASE_URL: 'socket:/var/run/postgresql?db=astana', ASTANA_ISOLATED_PG_URL: 'socket:/var/run/postgresql?db=astana' }), false);
  assert.match(dbSource, /SELECT run_token FROM astana_isolated_runner_guard WHERE run_token = \$1 LIMIT 1/);
  assert.match(dbSource, /timingSafeEqual\(Buffer\.from\(actualToken\), Buffer\.from\(expectedToken\)\)/);
  assert.match(photoHarnessSource, /ASTANA_HARNESS_FULL_BUILD: '1'/);
  assert.match(photoHarnessSource, /ASTANA_ISOLATED_PG_RUN_TOKEN: process\.env\.ASTANA_ISOLATED_PG_RUN_TOKEN/);
  assert.match(photoHarnessSource, /ASTANA_ISOLATED_PG_URL: databaseUrl/);
});

test('Staging binding fails closed for every missing, altered, or production-shared resource', () => {
  const valid = isolatedStagingEnvironment();
  assert.equal(isVerifiedIsolatedStaging(valid), true);
  for (const key of ['VERCEL', 'VERCEL_TARGET_ENV', 'VERCEL_PROJECT_ID', 'DATABASE_URL', 'DATABASE_RESOURCE_ID', 'BLOB_READ_WRITE_TOKEN', 'BLOB_RESOURCE_ID', 'PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN', 'PHOTO_INTAKE_BLOB_RESOURCE_ID', 'STAGING_WRITE_ENABLED', 'STAGING_MAIL_OVERRIDE_TO', 'STAGING_DATABASE_MARKER', 'STAGING_RESOURCE_BINDING_SHA256', 'PRODUCTION_DATABASE_IDENTITY_FINGERPRINT_SHA256', 'PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256', 'PRODUCTION_BLOB_RESOURCE_ID_FINGERPRINT_SHA256', 'PRODUCTION_PHOTO_INTAKE_BLOB_RESOURCE_ID_FINGERPRINT_SHA256'] as const) {
    assert.equal(isVerifiedIsolatedStaging({ ...valid, [key]: undefined }), false, key);
  }
  assert.equal(isVerifiedIsolatedStaging({ ...valid, STAGING_MAIL_OVERRIDE_TO: 'a@example.test,b@example.test' }), false);
  assert.equal(isVerifiedIsolatedStaging({ ...valid, STAGING_DATABASE_MARKER: 'short' }), false);
  assert.equal(isVerifiedIsolatedStaging({ ...valid, DATABASE_URL: `${valid.DATABASE_URL}-changed` }), false);
  assert.equal(isVerifiedIsolatedStaging({ ...valid, BLOB_READ_WRITE_TOKEN: 'not-a-vercel-blob-token' }), false);
  assert.equal(isVerifiedIsolatedStaging({ ...valid, BLOB_RESOURCE_ID: 'differentstore' }), false);
  const sharedStores = {
    ...valid,
    PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN: valid.BLOB_READ_WRITE_TOKEN,
    PHOTO_INTAKE_BLOB_RESOURCE_ID: valid.BLOB_RESOURCE_ID,
  };
  sharedStores.STAGING_RESOURCE_BINDING_SHA256 = stagingResourceBinding(sharedStores);
  assert.equal(isVerifiedIsolatedStaging(sharedStores), false);
  for (const sharedResource of [
    { DATABASE_URL: productionResources.database },
    { DATABASE_RESOURCE_ID: productionResources.databaseResourceId },
    { BLOB_READ_WRITE_TOKEN: `vercel_blob_rw_${productionResources.blobStoreId}_secret`, BLOB_RESOURCE_ID: productionResources.blobStoreId },
    { BLOB_READ_WRITE_TOKEN: `vercel_blob_rw_${productionResources.photoBlobStoreId}_secret`, BLOB_RESOURCE_ID: productionResources.photoBlobStoreId },
    { PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN: `vercel_blob_rw_${productionResources.blobStoreId}_secret`, PHOTO_INTAKE_BLOB_RESOURCE_ID: productionResources.blobStoreId },
    { PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN: `vercel_blob_rw_${productionResources.photoBlobStoreId}_secret`, PHOTO_INTAKE_BLOB_RESOURCE_ID: productionResources.photoBlobStoreId },
  ]) {
    const shared = { ...valid, ...sharedResource };
    shared.STAGING_RESOURCE_BINDING_SHA256 = stagingResourceBinding(shared);
    assert.equal(isVerifiedIsolatedStaging(shared), false);
  }
  for (const databaseUrl of [
    `${productionResources.database}?application_name=staging`,
    'postgresql://production-pooler.invalid/astana?sslmode=require',
  ]) {
    const sameDatabase = {
      ...valid,
      DATABASE_URL: databaseUrl,
      DATABASE_RESOURCE_ID: productionResources.databaseResourceId,
    };
    sameDatabase.STAGING_RESOURCE_BINDING_SHA256 = stagingResourceBinding(sameDatabase);
    assert.equal(isVerifiedIsolatedStaging(sameDatabase), false, databaseUrl);
  }
  assert.equal(stagingDatabaseMarkerMatches(valid.STAGING_DATABASE_MARKER, valid), true);
  assert.equal(stagingDatabaseMarkerMatches('c'.repeat(64), valid), false);
});

test('Staging identities are derived without exposing secret credentials', () => {
  assert.equal(deploymentDatabaseIdentity('postgresql://user:secret@ep-safe-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'), 'ep-safe.eu-central-1.aws.neon.tech:5432/neondb');
  assert.equal(deploymentDatabaseIdentity('postgresql://user:secret@ep-safe.eu-central-1.aws.neon.tech./prod%75ction'), 'ep-safe.eu-central-1.aws.neon.tech:5432/production');
  assert.equal(deploymentDatabaseIdentity('postgresql://user:secret@safe.invalid/db?host=production.invalid'), '');
  assert.equal(deploymentDatabaseIdentity('postgresql://user:secret@safe.invalid/one%2Ftwo'), '');
  assert.equal(vercelBlobStoreId('vercel_blob_rw_store123_rotatable-secret'), 'store123');
  assert.equal(vercelBlobStoreId('invalid-token'), '');
});

test('verified Staging rewrites every SMTP envelope recipient and disables the local relay', () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, isolatedStagingEnvironment(), {
      ASTANA_RELAY_URL: 'https://www.astana.sk/api/relay',
      ASTANA_RELAY_SECRET: 'x'.repeat(32),
      LEAD_EMAIL_DELIVERY_MODE: 'smtp_then_local_relay',
    });
    assert.equal(resolveOutboundEmailRecipient('customer@example.com'), 'qa@example.test');
    assert.equal(resolveOutboundEmailRecipient('astana@astana.sk'), 'qa@example.test');
    assert.equal(leadDeliveryMode(), 'smtp');
    assert.equal(isAstanaLocalRelayConfigured(), false);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test('a production-mode process without a verified Vercel identity cannot open the database', () => {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  for (const vercelEnv of ['', 'preview']) {
    const child = spawnSync(process.execPath, ['-r', 'tsx/cjs', '-e', `
      const { listLeads } = require('./src/server/db.ts');
      listLeads().then(
        () => { process.exitCode = 2; },
        (error) => {
          if (error.message !== 'Database access is disabled without verified production deployment identity.') {
            process.exitCode = 3;
          }
        },
      );
    `], {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VERCEL: '1',
        VERCEL_ENV: vercelEnv,
        VERCEL_TARGET_ENV: vercelEnv || '',
        DATABASE_URL: 'postgresql://127.0.0.1:1/preview-guard',
      },
      encoding: 'utf8',
      timeout: 15_000,
    });
    assert.equal(child.status, 0, `${vercelEnv || 'missing'}: ${child.stderr}`);
  }
});

test('Next proxy covers all API and admin endpoints without affecting public assets', () => {
  assert.match(proxySource, /matcher:\s*\['\/api\/:path\*', '\/admin\/:path\*', '\/spolupraca\/fotky\/:path\*', '\/dopyt-prijaty\/:path\*'\]/);
  assert.match(proxySource, /deploymentRequestBlocked\(process\.env, request\.method, request\.nextUrl\.pathname, request\.nextUrl\.hostname\)/);
});

test('plaintext admin password is never accepted as a production credential', () => {
  assert.match(authSource, /process\.env\.NODE_ENV !== 'production' && process\.env\.ADMIN_PASSWORD/);
  assert.doesNotMatch(authSource, /if \(process\.env\.ADMIN_PASSWORD\) \{\s*return password === process\.env\.ADMIN_PASSWORD;/);
});

test('current server-action definitions stay under the guarded admin route tree', () => {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  const actionFiles: string[] = [];
  const scan = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (/\.tsx?$/.test(entry.name) && /['"]use server['"]/.test(readFileSync(path, 'utf8'))) {
        actionFiles.push(relative(projectRoot, path).replaceAll('\\', '/'));
      }
    }
  };
  scan(join(projectRoot, 'app'));
  scan(join(projectRoot, 'src'));
  assert.ok(actionFiles.length > 0, 'expected to find admin server actions');
  assert.deepEqual(actionFiles.filter((path) => !path.startsWith('app/admin/')), [], 'a server action defined outside /admin/ requires an additional Preview POST guard');
});
