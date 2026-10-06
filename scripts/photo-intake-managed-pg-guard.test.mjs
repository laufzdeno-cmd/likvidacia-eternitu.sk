import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const token = 'a'.repeat(32);
const baseEnv = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']
  .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));

function rejectedHarness(databaseUrl, runToken = token) {
  const child = spawnSync(process.execPath, ['scripts/photo-intake-browser.integration.mjs'], {
    cwd: projectRoot,
    env: {
      ...baseEnv,
      ASTANA_HARNESS_BROWSER: process.execPath,
      ASTANA_HARNESS_FULL_BUILD: '1',
      ASTANA_ISOLATED_PG_URL: databaseUrl,
      ASTANA_ISOLATED_PG_RUN_TOKEN: runToken,
    },
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.notEqual(child.status, 0, `${databaseUrl} must be rejected before invoking a browser`);
  assert.match(child.stderr, /guarded one-time PostgreSQL runner/);
  assert.doesNotMatch(child.stderr, /Creating an optimized production build/);
}

test('photo intake full-build harness rejects a local database outside the owned run', () => {
  rejectedHarness(`postgres://astana_test@127.0.0.1:5432/astana_isolated_${token}`, 'b'.repeat(32));
});

test('photo intake full-build harness rejects connection-string host overrides', () => {
  rejectedHarness(`postgres://astana_test@127.0.0.1:5432/astana_isolated_${token}?host=other.invalid`);
});
