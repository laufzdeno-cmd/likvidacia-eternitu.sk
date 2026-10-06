import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { deploymentDatabaseAccessBlocked, deploymentRequestBlocked } from '../src/server/preview-safety';

const proxySource = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
const dbSource = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');
const nextConfigSource = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

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

test('Preview refuses every mutating API/admin method and cron GET while production remains unchanged', () => {
  for (const path of ['/api/lead/', '/api/lead-upload/', '/api/photo-intake/upload/', '/admin/dopyty/']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(deploymentRequestBlocked('preview', 'production', method, path), true, `${method} ${path}`);
      assert.equal(deploymentRequestBlocked(undefined, 'production', method, path), true, `${method} ${path} unknown`);
      assert.equal(deploymentRequestBlocked('production', 'production', method, path), false, `${method} ${path} production`);
    }
  }
  assert.equal(deploymentRequestBlocked('preview', 'production', 'GET', '/api/cron/lead-email-delivery/'), true);
  assert.equal(deploymentRequestBlocked(undefined, 'production', 'HEAD', '/api/cron/backup/'), true);
  assert.equal(deploymentRequestBlocked('preview', 'production', 'GET', '/api/lead/receipt/'), false);
  assert.equal(deploymentRequestBlocked('preview', 'production', 'GET', '/admin/login/'), false);
  assert.equal(deploymentRequestBlocked(undefined, 'development', 'POST', '/api/lead/'), false);
});

test('Preview database access fails closed before pool creation or schema initialization', () => {
  assert.equal(deploymentDatabaseAccessBlocked('preview', 'production'), true);
  assert.equal(deploymentDatabaseAccessBlocked(undefined, 'production'), true);
  assert.equal(deploymentDatabaseAccessBlocked('development', 'production'), true);
  assert.equal(deploymentDatabaseAccessBlocked('production', 'production'), false);
  assert.equal(deploymentDatabaseAccessBlocked(undefined, 'development'), false);
  assert.match(dbSource, /function getPool\(\) \{\s*\/\/[^\n]*\n\s*if \(deploymentDatabaseAccessBlocked\(\)\) \{[\s\S]*?throw new Error\([^\n]+\);\s*\}\s*if \(!databaseUrl\)/);
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
        VERCEL_ENV: vercelEnv,
        DATABASE_URL: 'postgresql://127.0.0.1:1/preview-guard',
      },
      encoding: 'utf8',
      timeout: 15_000,
    });
    assert.equal(child.status, 0, `${vercelEnv || 'missing'}: ${child.stderr}`);
  }
});

test('Next proxy covers all API and admin endpoints without affecting public assets', () => {
  assert.match(proxySource, /matcher:\s*\['\/api\/:path\*', '\/admin\/:path\*', '\/spolupraca\/fotky\/:path\*'\]/);
  assert.match(proxySource, /deploymentRequestBlocked\(process\.env\.VERCEL_ENV, process\.env\.NODE_ENV, request\.method, request\.nextUrl\.pathname\)/);
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
  assert.deepEqual(
    actionFiles.filter((path) => !path.startsWith('app/admin/')),
    [],
    'a server action defined outside /admin/ requires an additional Preview POST guard',
  );
});
