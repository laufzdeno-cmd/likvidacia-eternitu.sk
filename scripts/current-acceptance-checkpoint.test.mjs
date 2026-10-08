import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const candidateCommit = '0dbf77a155d4e53215db455518f91a186fb131e4';
const candidateShortSha = candidateCommit.slice(0, 8);

test('acceptance evidence binds the tested source candidate to immutable local logs', async () => {
  const [matrix, rawEvidence, rawBaselineVisual, generator] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL(`../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-${candidateShortSha}.json`, import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/VISUAL-EVIDENCE-SUMMARY-452c4f75.json', import.meta.url), 'utf8'),
    readFile(new URL('./capture-local-release-evidence.mjs', import.meta.url), 'utf8'),
  ]);
  const evidence = JSON.parse(rawEvidence);
  const baselineVisual = JSON.parse(rawBaselineVisual);
  const { safeChildEnvironment, sanitizeLog } = await import('./capture-local-release-evidence.mjs');
  const candidateTree = execFileSync('git', ['show', '-s', '--format=%T', candidateCommit], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();

  assert.equal(evidence.schemaVersion, 2);
  assert.equal(evidence.testedSourceCommit, candidateCommit);
  assert.equal(evidence.testedSourceTree, candidateTree);
  assert.equal(evidence.testedSourceTree, '0f4040464d079fc16cb609d5833f99123ee77f64');
  assert.equal(evidence.result, 'PASS');
  assert.equal(evidence.buildId, 'xhh9WDTgWXRDvD2Dg80S-');
  assert.equal(evidence.generatedRouteCount, 99);
  assert.equal(evidence.staticSeoUrlCount, 32);
  assert.equal(evidence.unitMjsCount, 397);
  assert.equal(evidence.unitTypeScriptCount, 34);
  assert.equal(evidence.typecheck, 'PASS');
  assert.equal(evidence.productionAccess, false);
  assert.equal(evidence.temporaryDatabaseStopped, true);
  assert.equal(evidence.temporaryDatabaseRemoved, true);
  assert.equal(evidence.temporaryRootRemoved, true);
  assert.ok(Number.isFinite(Date.parse(evidence.recordedAt)));

  assert.deepEqual(evidence.commands.map(({ name }) => name), ['unit', 'typecheck', 'productionBuild']);
  const logs = new Map();
  for (const command of evidence.commands) {
    assert.equal(command.exitCode, 0);
    assert.ok(command.logPath.startsWith(`docs/upgrade-2026-09-30/evidence/${candidateShortSha}/`));
    assert.match(command.logSha256, /^[a-f0-9]{64}$/);
    assert.ok(Date.parse(command.endedAt) >= Date.parse(command.startedAt));
    const log = await readFile(new URL(`../${command.logPath}`, import.meta.url), 'utf8');
    // Git stores these text logs with canonical LF bytes, while a fresh
    // Windows worktree may materialize CRLF. Hash the canonical text form so
    // an immutable tracked blob verifies identically in every clean checkout.
    const digest = createHash('sha256').update(log.replace(/\r\n/g, '\n')).digest('hex');
    assert.match(command.logSha256, /^[a-f0-9]{64}$/);
    assert.equal(digest, command.trackedLogSha256, `${command.name} tracked log digest must match the manifest`);
    assert.notEqual(spawnSync('git', ['check-ignore', '-q', '--', command.logPath]).status, 0,
      `${command.name} evidence log must be tracked by a normal git add`);
    assert.doesNotMatch(log, /C:(?:\\+|\/)Users|C:(?:\\+|\/)WEB|\bZdeno\b/i);
    logs.set(command.name, log);
  }

  const safeEnvironment = safeChildEnvironment();
  for (const key of ['AUTH_SECRET', 'DATABASE_URL', 'META_CAPI_ACCESS_TOKEN', 'SMTP_PASS', 'BLOB_READ_WRITE_TOKEN']) {
    assert.equal(safeEnvironment[key], undefined, `${key} must not reach evidence child processes`);
  }
  const previousSecret = process.env.CONVERSION_EVENT_SECRET;
  process.env.CONVERSION_EVENT_SECRET = 'evidence-test-secret-value';
  try {
    assert.throws(
      () => sanitizeLog('output evidence-test-secret-value', 'C:\\WEB\\candidate'),
      /CONVERSION_EVENT_SECRET/,
    );
  } finally {
    if (previousSecret === undefined) delete process.env.CONVERSION_EVENT_SECRET;
    else process.env.CONVERSION_EVENT_SECRET = previousSecret;
  }
  const pathSample = 'C:\\WEB\\candidate';
  const sanitizedPaths = sanitizeLog([
    pathSample,
    pathSample.replaceAll('\\', '/'),
    JSON.stringify(pathSample),
  ].join('\n'), pathSample);
  assert.doesNotMatch(sanitizedPaths, /C:(?:\\+|\/)WEB/i);
  assert.doesNotMatch(rawEvidence, /C:(?:\\+|\/)WEB|C:(?:\\+|\/)Users/i);

  assert.match(generator, /env: safeChildEnvironment\(\)/);
  assert.doesNotMatch(generator, /env: process\.env/);
  assert.match(generator, /sanitizeLog\(command\.log, candidateRoot\)/);
  assert.match(generator, /`\$\{command\.name\}\.txt`/);
  assert.match(generator, /candidateDeployment: 'NOT_VERIFIED'/);

  assert.match(logs.get('unit'), /ℹ tests 397[\s\S]*ℹ pass 397[\s\S]*ℹ tests 34[\s\S]*ℹ pass 34/);
  assert.match(logs.get('typecheck'), /> tsc --noEmit/);
  assert.doesNotMatch(logs.get('typecheck'), /error TS\d+/);
  assert.match(logs.get('productionBuild'), /"result":"PASS"/);
  assert.match(logs.get('productionBuild'), /Generating static pages using 7 workers \(99\/99\)/);
  assert.match(logs.get('productionBuild'), new RegExp(`PASS: build ${evidence.buildId};`));
  assert.match(logs.get('productionBuild'), /"productionAccess":false/);
  assert.match(logs.get('productionBuild'), /server stopped/);
  assert.match(logs.get('productionBuild'), /PASS: jednorazov.*PostgreSQL bol zastaven/i);

  assert.deepEqual(evidence.releaseStatus, {
    candidateDeployment: 'NOT_VERIFIED',
    customStaging: 'NOT_CONFIGURED',
    production: 'NOT_VERIFIED',
  });

  assert.match(matrix, /Otestovaný zdrojový kandidát je commit `0dbf77a1`/);
  assert.match(matrix, /runtime aplikačný checkpoint je `367e5e14`/);
  assert.match(matrix, /admin QA checkpoint je `c7c2059e`/i);
  assert.match(matrix, /\*\*397\/397 MJS \+ 34\/34 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*99\/99\*\* trás/);
  assert.match(matrix, new RegExp(evidence.buildId));
  assert.match(matrix, /manifest s hashmi úplných logov/i);
  assert.match(matrix, /čistom dôkazovom commite `088ac8f3`/);
  assert.match(matrix, /220\/220 stavov/);
  assert.match(matrix, /čistom commite `c882d5eb`/);
  assert.match(matrix, /produkci(?:a|u)[^\n]*\*\*NOT VERIFIED\*\*/iu);
  assert.doesNotMatch(matrix, /Aktuálny čistý release checkpoint/);
  assert.doesNotMatch(matrix, /release checkpoint je commit `5590c07e`/);

  assert.equal(baselineVisual.result, 'PASS');
  assert.equal(baselineVisual.matrix.stateCount, 220);
  assert.equal(baselineVisual.verification.formsSubmitted, 0);
  assert.equal(baselineVisual.verification.hydrationErrors, 0);
  assert.equal(baselineVisual.verification.blockedBrowserOrigins, 0);
  assert.equal(baselineVisual.production, 'NOT_VERIFIED');
});
