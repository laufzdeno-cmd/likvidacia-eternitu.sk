/** Isolated production build: no env files, real accounts, production resources or outbound network. */
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import PDFDocument from 'pdfkit';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryParent = path.resolve(tmpdir());
const temporary = await mkdtemp(path.join(temporaryParent, 'astana-job-build-'));
const ownership = randomUUID();
let postgres, socket, pool, child;
async function fingerprintSources(directory) {
  const files = ['package.json', 'package-lock.json', 'next.config.mjs', 'tsconfig.json', 'proxy.ts'];
  async function collect(relative) { for (const item of await readdir(path.join(directory, relative), { withFileTypes: true })) { const next = path.join(relative, item.name); if (item.isDirectory()) await collect(next); else files.push(next); } }
  for (const folder of ['app', 'src', 'data']) await collect(folder);
  const entries = [];
  for (const name of files.sort()) entries.push({ path: name.replaceAll('\\', '/'), sha256: createHash('sha256').update(await readFile(path.join(directory, name))).digest('hex') });
  return { sha256: createHash('sha256').update(JSON.stringify(entries)).digest('hex'), entries };
}
async function stopOwnedChild() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))]);
  if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await new Promise(resolve => child.once('exit', resolve)); }
}
try {
  await writeFile(path.join(temporary, '.harness-owner'), ownership, { flag: 'wx' });
  const source = await fingerprintSources(root);
  for (const name of ['app', 'src', 'public', 'data']) await cp(path.join(root, name), path.join(temporary, name), { recursive: true });
  for (const name of ['package.json', 'next.config.mjs', 'tsconfig.json', 'next-env.d.ts', 'proxy.ts']) await cp(path.join(root, name), path.join(temporary, name));
  await symlink(await realpath(path.join(root, 'node_modules')), path.join(temporary, 'node_modules'), 'junction');
  const configPath = path.join(temporary, 'next.config.mjs');
  await writeFile(configPath, (await readFile(configPath, 'utf8')).replace('export default nextConfig;', 'nextConfig.experimental = { ...(nextConfig.experimental || {}), cpus: 1 };\nexport default nextConfig;'));
  // This GET probe exists only in the disposable copy, never in the product/release.
  const probeRoute = path.join(temporary, 'app/api/job-pdf-build-probe-testonly');
  await mkdir(probeRoute, { recursive: true });
  await writeFile(path.join(probeRoute, 'route.ts'), "import {readFile} from 'node:fs/promises'; import path from 'node:path'; import {extractJobPdf} from '@/src/server/job-pdf-extraction'; export const runtime='nodejs'; export async function GET(){ return Response.json(await extractJobPdf(await readFile(path.join(process.cwd(),'synthetic-offer.pdf')))); }");
  const pdf = new PDFDocument({ compress: true }); const chunks = []; pdf.on('data', chunk => chunks.push(chunk));
  const pdfEnd = new Promise(resolve => pdf.once('end', resolve)); pdf.text('Cenova ponuka CP-2026-042\nCelkom s DPH: 3690,00 EUR'); pdf.end(); await pdfEnd;
  await writeFile(path.join(temporary, 'synthetic-offer.pdf'), Buffer.concat(chunks));
  const probe = createServer(); await new Promise((resolve, reject) => probe.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  postgres = await PGlite.create(); socket = new PGLiteSocketServer({ db: postgres, port, host: '127.0.0.1', maxConnections: 20 }); await socket.start();
  const databaseUrl = `postgres://isolated:isolated@127.0.0.1:${port}/isolated`;
  process.env.NODE_ENV = 'test'; process.env.VERCEL = ''; process.env.DATABASE_URL = databaseUrl;
  const database = await import('../src/server/db.ts'); await database.ensureServerDatabaseSchema(); pool = database.getServerDatabasePool();
  await (await import('../src/server/job-workspace-migration.ts')).migrateJobWorkspaceSchema(pool);
  await (await import('../src/server/job-mail-migration.ts')).migrateJobMailSchema(pool);
  const runToken = randomBytes(16).toString('hex');
  await pool.query('CREATE TABLE astana_isolated_runner_guard(run_token text PRIMARY KEY)');
  await pool.query('INSERT INTO astana_isolated_runner_guard(run_token) VALUES($1)', [runToken]);
  await pool.end(); pool = undefined;
  const environment = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(environment, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: databaseUrl, ASTANA_HARNESS_CHILD: '1', ASTANA_HARNESS_FULL_BUILD: '1', ASTANA_ISOLATED_PG_RUN_TOKEN: runToken, ASTANA_ISOLATED_PG_URL: databaseUrl, AUTH_SECRET: randomBytes(32).toString('hex'), NEXT_PUBLIC_SITE_URL: 'https://likvidacia-eternitu.sk', TEMP: temporary, TMP: temporary, ASTANA_TEST_NETWORK_GUARD: '1', NODE_OPTIONS: `--import=${pathToFileURL(path.join(root, 'scripts/test-loopback-network-guard.mjs')).href}` });
  child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], { cwd: temporary, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { const value = chunk.toString(); output += value; process.stdout.write(value); });
  const exit = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  await mkdir(path.join(root, 'test-results'), { recursive: true });
  await writeFile(path.join(root, 'test-results/job-workspace-build.log'), output);
  assert.equal(exit, 0, 'Isolated production build failed.');
  assert.doesNotMatch(output, /ESM packages .* need to be imported|job-pdf-extraction\.ts\nModule not found/, 'A parser bundling warning is a functional failure, not an accepted warning.');
  const trace = JSON.parse(await readFile(path.join(temporary, '.next/server/app/api/admin/job-workspace/upload/route.js.nft.json'), 'utf8'));
  assert.ok(trace.files.some(name => name.replaceAll('\\', '/').endsWith('pdfjs-dist/legacy/build/pdf.mjs')), 'Built private upload function must trace the PDF worker library.');
  assert.ok(trace.files.some(name => name.replaceAll('\\', '/').endsWith('pdfjs-dist/legacy/build/pdf.worker.mjs')), 'Built private upload function must trace the PDF worker entry.');
  const httpProbe = createServer(); await new Promise(resolve => httpProbe.listen(0, '127.0.0.1', resolve)); const httpPort = httpProbe.address().port; await new Promise(resolve => httpProbe.close(resolve));
  child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(httpPort)], { cwd: temporary, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk.toString(); });
  let extraction; const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Built server exited before PDF verification.');
    try { const response = await fetch(`http://127.0.0.1:${httpPort}/api/job-pdf-build-probe-testonly/`, { signal: AbortSignal.timeout(20000) }); if (response.ok) { extraction = await response.json(); break; } } catch { /* local startup */ }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  assert.equal(extraction?.state, 'TEXT', `Bundled PDF parser must read a digital original: ${JSON.stringify(extraction)}`);
  assert.ok(extraction.suggestions.some(item => item.field === 'originalNumber' && item.value === 'CP-2026-042'));
  await stopOwnedChild();
  await writeFile(path.join(root, 'test-results/job-workspace-build.log'), output);
  assert.equal((await fingerprintSources(root)).sha256, source.sha256, 'Product sources changed during the build; repeat against a stable copy.');
  await writeFile(path.join(root, 'test-results/job-workspace-build-source.json'), JSON.stringify(source, null, 2));
  await writeFile(path.join(root, 'test-results/job-workspace-build.json'), JSON.stringify({ status: 'PASS', isolated: true, sourceSha256: source.sha256, productionTouched: false, pdfWorkerTraced: true, bundledPdfParser: 'TEXT', builtAt: new Date().toISOString() }, null, 2));
} finally {
  await stopOwnedChild();
  if (pool) await pool.end(); if (socket) await socket.stop(); if (postgres) await postgres.close();
  const resolved = path.resolve(temporary);
  assert.ok(resolved.startsWith(temporaryParent + path.sep));
  assert.equal(await readFile(path.join(resolved, '.harness-owner'), 'utf8'), ownership);
  await unlink(path.join(resolved, 'node_modules')).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await rm(resolved, { recursive: true, force: true });
}
