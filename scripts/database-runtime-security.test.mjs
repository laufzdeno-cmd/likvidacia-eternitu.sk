import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { Client } from 'pg';
import {
  assertDatabaseConfiguredForRuntime,
  databasePoolConfig,
  isLoopbackDatabaseUrl,
  normalizeDatabaseUrl,
} from '../src/server/database-config.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbModuleUrl = pathToFileURL(path.join(projectRoot, 'src', 'server', 'db.ts')).href;

function isolatedEnvironment(overrides = {}) {
  const environment = { ...process.env, ...overrides };
  for (const key of [
    'DATABASE_URL',
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_TARGET_ENV',
    'ASTANA_HARNESS_CHILD',
    'ASTANA_HARNESS_FULL_BUILD',
    'ASTANA_ISOLATED_PG_RUN_TOKEN',
    'ASTANA_ISOLATED_PG_URL',
  ]) {
    if (!(key in overrides)) delete environment[key];
  }
  return environment;
}

function runDatabaseChild(code, environment) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', code],
    { cwd: projectRoot, env: environment, encoding: 'utf8', timeout: 30_000 },
  );
}

test('remote database URLs always resolve to full certificate and hostname verification', () => {
  for (const mode of ['', 'require', 'prefer', 'disable', 'verify-ca', 'verify-full', 'no-verify']) {
    const suffix = mode ? `?sslmode=${mode}&uselibpqcompat=true` : '';
    const normalized = normalizeDatabaseUrl(`postgresql://user:secret@ep-safe.neon.tech/astana${suffix}`);
    const parsed = new URL(normalized);
    assert.equal(parsed.searchParams.get('sslmode'), 'verify-full');
    assert.equal(parsed.searchParams.has('uselibpqcompat'), false);

    const parameters = new Client(databasePoolConfig(normalized)).connectionParameters;
    assert.notEqual(parameters.ssl && parameters.ssl.rejectUnauthorized, false);
  }
});

test('TLS override parameters are removed and target overrides fail without leaking credentials', () => {
  const normalized = normalizeDatabaseUrl(
    'postgresql://user:top-secret@database.example/astana?SSL=0&sslcert=x&sslkey=y&sslrootcert=z&SSLMODE=disable',
  );
  const parsed = new URL(normalized);
  for (const key of ['ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) {
    assert.equal([...parsed.searchParams.keys()].some((candidate) => candidate.toLowerCase() === key), false);
  }
  assert.equal(parsed.searchParams.get('sslmode'), 'verify-full');

  assert.throws(
    () => normalizeDatabaseUrl('postgresql://user:top-secret@database.example/astana?host=attacker.invalid'),
    (error) => {
      assert.doesNotMatch(String(error), /top-secret|attacker\.invalid/);
      return true;
    },
  );
});

test('only exact loopback database hosts keep local TLS behavior', () => {
  for (const url of [
    'postgresql://user:secret@localhost/astana',
    'postgresql://user:secret@127.0.0.1/astana',
    'postgresql://user:secret@[::1]/astana',
  ]) {
    assert.equal(isLoopbackDatabaseUrl(url), true);
    assert.equal(normalizeDatabaseUrl(url), url);
  }
  for (const override of ['host=remote.invalid', 'hostaddr=203.0.113.10', 'port=6543', 'socket=%2Ftmp%2Fpg']) {
    assert.throws(
      () => normalizeDatabaseUrl(`postgresql://user:secret@localhost/astana?${override}&sslmode=disable`),
      /unsupported connection target override/,
    );
  }
  for (const url of [
    'postgresql://localhost:secret@database.example/astana',
    'postgresql://user:secret@localhost.attacker.invalid/astana',
    'postgresql://user:secret@database.example/astana?note=127.0.0.1',
  ]) {
    assert.equal(isLoopbackDatabaseUrl(url), false);
    assert.equal(new URL(normalizeDatabaseUrl(url)).searchParams.get('sslmode'), 'verify-full');
  }
});

test('production requires DATABASE_URL while development keeps the isolated local store', () => {
  assert.throws(
    () => assertDatabaseConfiguredForRuntime(undefined, { NODE_ENV: 'production' }),
    /DATABASE_URL is required in production/,
  );
  assert.doesNotThrow(() => assertDatabaseConfiguredForRuntime(undefined, { NODE_ENV: 'development' }));
  assert.doesNotThrow(() => assertDatabaseConfiguredForRuntime(undefined, { NODE_ENV: 'test' }));
});

test('production DB access without DATABASE_URL fails before creating local JSON', async () => {
  const directory = await mkdtemp(path.join(projectRoot, '.tmp-db-guard-'));
  const localDbPath = path.join(directory, 'local-db.json');
  try {
    const child = runDatabaseChild(
      `const { listRoofers } = await import(${JSON.stringify(dbModuleUrl)});\n`
      + `try { await listRoofers(); process.exitCode = 2; } catch (error) {\n`
      + `  if (!String(error).includes('DATABASE_URL is required in production')) throw error;\n`
      + `  console.log('FAIL_CLOSED');\n`
      + `}`,
      isolatedEnvironment({ NODE_ENV: 'production', ASTANA_LOCAL_DB_PATH: localDbPath }),
    );
    assert.equal(child.status, 0, child.stderr || child.stdout);
    assert.match(child.stdout, /FAIL_CLOSED/);
    assert.equal(existsSync(localDbPath), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('development without DATABASE_URL still uses only the configured isolated JSON store', async () => {
  const directory = await mkdtemp(path.join(projectRoot, '.tmp-db-local-'));
  const localDbPath = path.join(directory, 'local-db.json');
  try {
    const child = runDatabaseChild(
      `const { listRoofers } = await import(${JSON.stringify(dbModuleUrl)});\n`
      + `const rows = await listRoofers();\n`
      + `if (rows.length !== 0) throw new Error('Expected empty isolated database');\n`
      + `console.log('LOCAL_OK');`,
      isolatedEnvironment({ NODE_ENV: 'development', ASTANA_LOCAL_DB_PATH: localDbPath }),
    );
    assert.equal(child.status, 0, child.stderr || child.stdout);
    assert.match(child.stdout, /LOCAL_OK/);
    assert.equal(existsSync(localDbPath), true);
    assert.doesNotReject(async () => JSON.parse(await readFile(localDbPath, 'utf8')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('database-less production build keeps the deliberate site-content fallback without local writes', async () => {
  const directory = await mkdtemp(path.join(projectRoot, '.tmp-db-build-'));
  const localDbPath = path.join(directory, 'local-db.json');
  try {
    const child = runDatabaseChild(
      `const { listSiteContent } = await import(${JSON.stringify(dbModuleUrl)});\n`
      + `const rows = await listSiteContent();\n`
      + `if (rows.length !== 0) throw new Error('Expected build defaults');\n`
      + `console.log('BUILD_DEFAULTS_OK');`,
      isolatedEnvironment({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build', ASTANA_LOCAL_DB_PATH: localDbPath }),
    );
    assert.equal(child.status, 0, child.stderr || child.stdout);
    assert.match(child.stdout, /BUILD_DEFAULTS_OK/);
    assert.equal(existsSync(localDbPath), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
