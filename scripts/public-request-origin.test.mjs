import assert from 'node:assert/strict';
import test from 'node:test';
import { isTrustedLocalDevelopmentOrigin, isTrustedVercelDeploymentOrigin } from '../src/server/public-request-origin.ts';

const keys = ['VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_BRANCH_URL'];

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

test('local development accepts only an exact localhost or loopback request origin', () => {
  assert.equal(isTrustedLocalDevelopmentOrigin('http://localhost:3100', 'http://localhost:3100', 'development'), true);
  assert.equal(isTrustedLocalDevelopmentOrigin('http://127.0.0.1:3100', 'http://127.0.0.1:3100', 'test'), true);
  assert.equal(isTrustedLocalDevelopmentOrigin('http://localhost:3100', 'http://localhost:3200', 'development'), false);
  assert.equal(isTrustedLocalDevelopmentOrigin('https://localhost:3100', 'https://localhost:3100', 'development'), false);
  assert.equal(isTrustedLocalDevelopmentOrigin('http://example.test', 'http://example.test', 'development'), false);
  assert.equal(isTrustedLocalDevelopmentOrigin('http://localhost:3100', 'http://localhost:3100', 'production'), false);
});
