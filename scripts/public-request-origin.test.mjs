import assert from 'node:assert/strict';
import test from 'node:test';
import { isTrustedLocalDevelopmentOrigin, isTrustedVercelDeploymentOrigin } from '../src/server/public-request-origin.ts';
import { deploymentResourceFingerprint, stagingResourceBinding } from '../src/server/preview-safety.ts';

const keys = ['VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV', 'VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_ID', 'DATABASE_URL', 'DATABASE_RESOURCE_ID', 'BLOB_READ_WRITE_TOKEN', 'PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN', 'STAGING_WRITE_ENABLED', 'STAGING_MAIL_OVERRIDE_TO', 'STAGING_DATABASE_MARKER', 'STAGING_RESOURCE_BINDING_SHA256', 'PRODUCTION_DATABASE_FINGERPRINT_SHA256', 'PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256', 'PRODUCTION_BLOB_FINGERPRINT_SHA256', 'PRODUCTION_PHOTO_INTAKE_BLOB_FINGERPRINT_SHA256'];

function withVercelEnvironment(values, callback) {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, values);
    callback();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('staged production accepts only the exact Vercel deployment origin', () => {
  withVercelEnvironment({
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VERCEL_URL: 'likvidacia-eternitu-sk-abc123.vercel.app',
    VERCEL_BRANCH_URL: 'likvidacia-eternitu-sk-git-codex.vercel.app',
  }, () => {
    assert.equal(isTrustedVercelDeploymentOrigin('https://likvidacia-eternitu-sk-abc123.vercel.app'), true);
    assert.equal(isTrustedVercelDeploymentOrigin('https://likvidacia-eternitu-sk-git-codex.vercel.app'), false);
    assert.equal(isTrustedVercelDeploymentOrigin('http://likvidacia-eternitu-sk-abc123.vercel.app'), false);
    assert.equal(isTrustedVercelDeploymentOrigin('https://likvidacia-eternitu-sk-abc123.vercel.app.evil.invalid'), false);
  });
});

test('preview may use the exact deployment or branch URL, but local env spoofing stays rejected', () => {
  withVercelEnvironment({
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'likvidacia-eternitu-sk-preview-abc.vercel.app',
    VERCEL_BRANCH_URL: 'likvidacia-eternitu-sk-git-feature.vercel.app',
  }, () => {
    assert.equal(isTrustedVercelDeploymentOrigin('https://likvidacia-eternitu-sk-preview-abc.vercel.app'), true);
    assert.equal(isTrustedVercelDeploymentOrigin('https://likvidacia-eternitu-sk-git-feature.vercel.app'), true);
  });

  withVercelEnvironment({
    VERCEL_ENV: 'production',
    VERCEL_URL: 'likvidacia-eternitu-sk-abc123.vercel.app',
  }, () => {
    assert.equal(isTrustedVercelDeploymentOrigin('https://likvidacia-eternitu-sk-abc123.vercel.app'), false);
  });
});

test('custom Staging trusts only its exact deployment origin after resource verification', () => {
  const environment = {
    VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'staging',
    VERCEL_URL: 'likvidacia-eternitu-sk-staging-abc.vercel.app',
    VERCEL_BRANCH_URL: 'likvidacia-eternitu-sk-git-feature.vercel.app',
    VERCEL_PROJECT_ID: 'prj_astana', DATABASE_URL: 'postgresql://staging.invalid/astana',
    DATABASE_RESOURCE_ID: 'provider-project-staging/branch-staging/astana',
    BLOB_READ_WRITE_TOKEN: 'staging-blob', PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN: 'staging-photo-blob', STAGING_WRITE_ENABLED: 'true',
    STAGING_MAIL_OVERRIDE_TO: 'qa@example.test',
    STAGING_DATABASE_MARKER: 'b'.repeat(64),
    PRODUCTION_DATABASE_FINGERPRINT_SHA256: deploymentResourceFingerprint('postgresql://production.invalid/astana'),
    PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256: deploymentResourceFingerprint('provider-project-production/branch-production/astana'),
    PRODUCTION_BLOB_FINGERPRINT_SHA256: deploymentResourceFingerprint('production-blob'),
    PRODUCTION_PHOTO_INTAKE_BLOB_FINGERPRINT_SHA256: deploymentResourceFingerprint('production-photo-blob'),
  };
  environment.STAGING_RESOURCE_BINDING_SHA256 = stagingResourceBinding(environment);
  withVercelEnvironment(environment, () => {
    assert.equal(isTrustedVercelDeploymentOrigin('https://likvidacia-eternitu-sk-staging-abc.vercel.app'), true);
    assert.equal(isTrustedVercelDeploymentOrigin('https://likvidacia-eternitu-sk-git-feature.vercel.app'), false);
  });
  withVercelEnvironment({ ...environment, STAGING_RESOURCE_BINDING_SHA256: '0'.repeat(64) }, () => {
    assert.equal(isTrustedVercelDeploymentOrigin('https://likvidacia-eternitu-sk-staging-abc.vercel.app'), false);
  });
});

test('local development accepts only an exact localhost or loopback request origin', () => {
  assert.equal(isTrustedLocalDevelopmentOrigin('http://localhost:3100', 'http://localhost:3100', 'development'), true);
  assert.equal(isTrustedLocalDevelopmentOrigin('http://127.0.0.1:3100', 'http://127.0.0.1:3100', 'test'), true);
  assert.equal(isTrustedLocalDevelopmentOrigin('http://localhost:3100', 'http://localhost:3200', 'development'), false);
  assert.equal(isTrustedLocalDevelopmentOrigin('https://localhost:3100', 'https://localhost:3100', 'development'), false);
  assert.equal(isTrustedLocalDevelopmentOrigin('http://example.test', 'http://example.test', 'development'), false);
  assert.equal(isTrustedLocalDevelopmentOrigin('http://localhost:3100', 'http://localhost:3100', 'production'), false);
});
