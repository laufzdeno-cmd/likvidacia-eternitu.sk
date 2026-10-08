import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { getRuntimeFeatureHealth } from '../src/server/runtime-feature-health.ts';
import {
  deploymentDatabaseIdentity,
  deploymentResourceFingerprint,
  deploymentRequestBlocked,
  isVerifiedIsolatedStaging,
  stagingResourceBinding,
} from '../src/server/preview-safety.ts';

function binding(values) {
  return createHash('sha256').update(JSON.stringify(values), 'utf8').digest('hex');
}

function readyEnvironment() {
  const environment = {
    NODE_ENV: 'production',
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VERCEL_TARGET_ENV: 'production',
    VERCEL_PROJECT_ID: 'project-id',
    DATABASE_URL: 'postgresql://private.invalid/astana',
    BLOB_READ_WRITE_TOKEN: 'private-lead-token',
    LEAD_UPLOAD_RETENTION_DELETE_ENABLED: '1',
    CAREER_CV_RETENTION_DELETE_ENABLED: '1',
    CAREER_CV_PRIVATE_STORE_CONFIRMED: '1',
    NEXT_PUBLIC_META_PIXEL_ID: '123456789012345',
    META_CAPI_ACCESS_TOKEN: 'meta-token',
    META_GRAPH_API_VERSION: 'v99.0',
    CONVERSION_EVENT_SECRET: 'conversion-secret',
    CRON_SECRET: 'cron-secret',
    GOOGLE_MAPS_API_KEY: 'maps-key',
    PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN: 'private-photo-token',
    PHOTO_INTAKE_PRIVATE_STORE_VERIFIED: 'true',
    PHOTO_INTAKE_RETENTION_ENABLED: 'true',
    PHOTO_INTAKE_ENABLED: 'true',
    PHOTO_UPLOAD_SESSION_SECRET: 'x'.repeat(32),
  };
  environment.LEAD_BLOB_RETENTION_BINDING_SHA256 = binding([
    environment.VERCEL_PROJECT_ID,
    environment.DATABASE_URL,
    environment.BLOB_READ_WRITE_TOKEN,
  ]);
  environment.CAREER_CV_RETENTION_BINDING_SHA256 = environment.LEAD_BLOB_RETENTION_BINDING_SHA256;
  environment.PHOTO_INTAKE_RETENTION_BINDING_SHA256 = binding([
    environment.VERCEL_PROJECT_ID,
    environment.DATABASE_URL,
    environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN,
  ]);
  return environment;
}

function verifiedStagingEnvironment() {
  const productionResources = {
    database: 'postgresql://production.invalid/astana',
    databaseResourceId: 'neon-production/branch-production/astana',
    blobStoreId: 'production',
    photoBlobStoreId: 'photoproduction',
  };
  const environment = {
    ...readyEnvironment(),
    VERCEL_ENV: 'preview',
    VERCEL_TARGET_ENV: 'staging',
    DATABASE_URL: 'postgresql://staging.invalid/astana',
    DATABASE_RESOURCE_ID: 'neon-staging/branch-staging/astana',
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
  };
  environment.LEAD_BLOB_RETENTION_BINDING_SHA256 = binding([
    environment.VERCEL_PROJECT_ID,
    environment.DATABASE_URL,
    environment.BLOB_READ_WRITE_TOKEN,
  ]);
  environment.CAREER_CV_RETENTION_BINDING_SHA256 = environment.LEAD_BLOB_RETENTION_BINDING_SHA256;
  environment.PHOTO_INTAKE_RETENTION_BINDING_SHA256 = binding([
    environment.VERCEL_PROJECT_ID,
    environment.DATABASE_URL,
    environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN,
  ]);
  environment.STAGING_RESOURCE_BINDING_SHA256 = stagingResourceBinding(environment);
  return environment;
}

test('runtime feature health is fail-closed and returns no environment values', () => {
  const environment = readyEnvironment();
  for (const key of [
    'CONVERSION_EVENT_SECRET',
    'CRON_SECRET',
    'GOOGLE_MAPS_API_KEY',
    'LEAD_BLOB_RETENTION_BINDING_SHA256',
    'CAREER_CV_RETENTION_BINDING_SHA256',
    'PHOTO_UPLOAD_SESSION_SECRET',
  ]) delete environment[key];

  const health = getRuntimeFeatureHealth(environment);
  assert.equal(health.conversion.level, 'warning');
  assert.equal(health.routeDistance.level, 'warning');
  assert.equal(health.leadRetention.level, 'disabled');
  assert.equal(health.careerRetention.level, 'disabled');
  assert.equal(health.photoIntake.level, 'warning');
  const serialized = JSON.stringify(health);
  for (const secret of Object.values(environment)) {
    if (secret && secret.length >= 16) assert.doesNotMatch(serialized, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('runtime feature health reports only exact complete production bindings as ready', () => {
  const environment = readyEnvironment();
  const health = getRuntimeFeatureHealth(environment);
  for (const feature of Object.values(health)) assert.equal(feature.level, 'ok');

  const preview = getRuntimeFeatureHealth({ ...environment, VERCEL_ENV: 'preview' });
  assert.equal(preview.leadRetention.level, 'disabled');
  assert.equal(preview.careerRetention.level, 'disabled');

  const wrongPhotoBinding = getRuntimeFeatureHealth({
    ...environment,
    PHOTO_INTAKE_RETENTION_BINDING_SHA256: '0'.repeat(64),
  });
  assert.equal(wrongPhotoBinding.photoIntake.level, 'warning');

  const missingWorkerAuthorization = getRuntimeFeatureHealth({ ...environment, CRON_SECRET: '' });
  assert.equal(missingWorkerAuthorization.conversion.level, 'warning');
  assert.equal(missingWorkerAuthorization.leadRetention.level, 'warning');
  assert.equal(missingWorkerAuthorization.careerRetention.level, 'warning');
  assert.equal(missingWorkerAuthorization.photoIntake.level, 'warning');
  assert.equal(missingWorkerAuthorization.routeDistance.level, 'ok');

  const whitespaceWorkerAuthorization = getRuntimeFeatureHealth({ ...environment, CRON_SECRET: 'cron-secret ' });
  assert.equal(whitespaceWorkerAuthorization.leadRetention.level, 'warning');
  assert.equal(whitespaceWorkerAuthorization.careerRetention.level, 'warning');
  assert.equal(whitespaceWorkerAuthorization.photoIntake.level, 'warning');

  const whitespaceS3 = getRuntimeFeatureHealth({
    ...environment,
    BLOB_READ_WRITE_TOKEN: '',
    S3_BUCKET: 'private-bucket',
    S3_ACCESS_KEY_ID: 'private-access-key',
    S3_SECRET_ACCESS_KEY: 'private-secret-key',
    CRON_SECRET: 'cron-secret ',
  });
  assert.equal(whitespaceS3.leadRetention.level, 'warning');

  const staging = verifiedStagingEnvironment();
  assert.equal(isVerifiedIsolatedStaging(staging), true);
  assert.equal(deploymentRequestBlocked(staging, 'GET', '/api/cron/meta-capi/', 'staging.vercel.app'), true);
  const stagingHealth = getRuntimeFeatureHealth(staging);
  assert.notEqual(stagingHealth.conversion.level, 'ok');
  assert.notEqual(stagingHealth.leadRetention.level, 'ok');
  assert.notEqual(stagingHealth.careerRetention.level, 'ok');
  assert.notEqual(stagingHealth.photoIntake.level, 'ok');
});

test('super-admin health page renders only bounded readiness labels', async () => {
  const page = await import('node:fs/promises').then(({ readFile }) => readFile(
    new URL('../app/admin/(protected)/health/page.tsx', import.meta.url),
    'utf8',
  ));
  assert.match(page, /await requireSuperAdmin\(\)/);
  assert.match(page, /Pripravenosť produkčných funkcií/);
  assert.match(page, /health\.features\.conversion/);
  assert.match(page, /health\.features\.leadRetention/);
  assert.match(page, /health\.features\.careerRetention/);
  assert.match(page, /health\.features\.photoIntake/);
  assert.doesNotMatch(page, /process\.env|DATABASE_URL|SMTP_PASS|READ_WRITE_TOKEN|SESSION_SECRET/);
});
