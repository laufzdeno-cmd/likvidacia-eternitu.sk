import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const candidateCommit = '981cd9e2eb200a579f1c3eb705ee3bb6b95f83d1';
const candidateShortSha = candidateCommit.slice(0, 8);

test('acceptance evidence binds the tested source candidate to immutable local logs', async () => {
  const [matrix, rawEvidence, rawBaselineVisual, generator, runbook, releaseCheckpoint] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
    readFile(new URL(`../docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-${candidateShortSha}.json`, import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/VISUAL-EVIDENCE-SUMMARY-452c4f75.json', import.meta.url), 'utf8'),
    readFile(new URL('./capture-local-release-evidence.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/STAGING-EXECUTION-RUNBOOK-2026-10-08.md', import.meta.url), 'utf8'),
    readFile(new URL(`../docs/upgrade-2026-09-30/LOCAL-RELEASE-CHECKPOINT-${candidateShortSha}.md`, import.meta.url), 'utf8'),
  ]);
  const evidence = JSON.parse(rawEvidence);
  const baselineVisual = JSON.parse(rawBaselineVisual);
  const {
    cleanupEvidenceMetrics,
    databaseEvidenceMetrics,
    lighthouseEvidenceMetrics,
    releaseEvidenceMetrics,
    safeChildEnvironment,
    sanitizeLog,
  } = await import('./capture-local-release-evidence.mjs');
  const candidateTree = execFileSync('git', ['show', '-s', '--format=%T', candidateCommit], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();

  assert.equal(evidence.schemaVersion, 4);
  assert.equal(evidence.testedSourceCommit, candidateCommit);
  assert.equal(evidence.testedSourceTree, candidateTree);
  assert.equal(evidence.testedSourceTree, '3198f4d10255700c61a409ace6a7e3295a53ca8b');
  assert.equal(evidence.result, 'PASS');
  assert.equal(evidence.buildId, 'qyjRW_FqUHWMLXDEmLfal');
  assert.equal(evidence.generatedRouteCount, 100);
  assert.equal(evidence.staticSeoUrlCount, 33);
  assert.equal(evidence.unitMjsCount, 428);
  assert.equal(evidence.unitTypeScriptCount, 35);
  assert.equal(evidence.typecheck, 'PASS');
  assert.equal(evidence.productionAccess, false);
  assert.equal(evidence.temporaryDatabaseStopped, true);
  assert.equal(evidence.temporaryDatabaseRemoved, true);
  assert.equal(evidence.temporaryRootRemoved, true);
  assert.ok(Number.isFinite(Date.parse(evidence.recordedAt)));

  assert.deepEqual(evidence.commands.map(({ name }) => name), [
    'unit', 'typecheck', 'databaseIntegration', 'productionBuild', 'lighthouseBuild',
  ]);
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
    assert.doesNotMatch(log, /C:(?:\\+|\/)Program Files/i);
    assert.doesNotMatch(log, /\uFFFD/);
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
  const postgresBin = process.env.ProgramFiles
    ? `${process.env.ProgramFiles}\\PostgreSQL\\17\\bin\\postgres.exe`
    : '';
  if (postgresBin) {
    assert.match(sanitizeLog(postgresBin, pathSample), /<POSTGRES_BIN>\\postgres\.exe/);
  }
  const replacementCharacter = String.fromCodePoint(0xfffd);
  const damagedCleanupLine = `PASS: jednorazov${replacementCharacter}${replacementCharacter} PostgreSQL bol zastaven${replacementCharacter}${replacementCharacter} a jeho projektov${replacementCharacter}c tmp d${replacementCharacter}${replacementCharacter}ta odstr${replacementCharacter}${replacementCharacter}nen${replacementCharacter}c.`;
  assert.match(
    sanitizeLog(damagedCleanupLine, pathSample),
    /PASS: jednorazový PostgreSQL bol zastavený a jeho projektové tmp dáta odstránené\./,
  );
  assert.throws(
    () => sanitizeLog(`iný poškodený znak ${replacementCharacter}`, pathSample),
    /poškodené UTF-8/,
  );
  assert.doesNotMatch(rawEvidence, /C:(?:\\+|\/)WEB|C:(?:\\+|\/)Users/i);

  assert.match(generator, /env: safeChildEnvironment\(\)/);
  assert.doesNotMatch(generator, /env: process\.env/);
  assert.match(generator, /sanitizeLog\(command\.log, candidateRoot\)/);
  assert.match(generator, /`\$\{command\.name\}\.txt`/);
  assert.match(generator, /candidateDeployment: 'NOT_VERIFIED'/);

  assert.match(logs.get('unit'), /ℹ tests 428[\s\S]*ℹ pass 428[\s\S]*ℹ tests 35[\s\S]*ℹ pass 35/);
  assert.match(logs.get('typecheck'), /> tsc --noEmit/);
  assert.doesNotMatch(logs.get('typecheck'), /error TS\d+/);
  assert.match(logs.get('productionBuild'), /"result":"PASS"/);
  assert.match(logs.get('productionBuild'), /Generating static pages using \d+ workers \(100\/100\)/);
  assert.match(logs.get('productionBuild'), new RegExp(`PASS: build ${evidence.buildId};`));
  assert.match(logs.get('productionBuild'), /"productionAccess":false/);
  assert.match(logs.get('productionBuild'), /server stopped/);
  assert.match(logs.get('productionBuild'), /PASS: jednorazov.*PostgreSQL bol zastaven/i);
  assert.deepEqual(releaseEvidenceMetrics(logs.get('unit'), logs.get('productionBuild')), {
    buildId: 'qyjRW_FqUHWMLXDEmLfal',
    unitMjsCount: 428,
    unitTypeScriptCount: 35,
    generatedRouteCount: 100,
    staticSeoUrlCount: 33,
  });
  assert.deepEqual(databaseEvidenceMetrics(logs.get('databaseIntegration')), evidence.databaseIntegration);
  assert.deepEqual(lighthouseEvidenceMetrics(logs.get('lighthouseBuild')), evidence.lighthouse);
  assert.deepEqual(cleanupEvidenceMetrics(logs.get('productionBuild'), 'Build'), {
    temporaryDatabaseStopped: true,
    temporaryDatabaseRemoved: true,
    temporaryRootRemoved: true,
  });
  assert.deepEqual(cleanupEvidenceMetrics(logs.get('lighthouseBuild'), 'Lighthouse'), {
    temporaryDatabaseStopped: true,
    temporaryDatabaseRemoved: true,
    temporaryRootRemoved: true,
  });
  assert.deepEqual(evidence.databaseIntegration, {
    tests: 12,
    stagingBootstrap: 'PASS',
    metaConsentRace: 'PASS',
    metaCapiOutbox: 'PASS',
  });
  assert.equal(evidence.lighthouse.buildId, '0rHswONNpBd8aIky79rY1');
  assert.equal(evidence.lighthouse.lighthouseVersion, '13.5.0');
  assert.equal(evidence.lighthouse.originKind, 'isolated-loopback');
  assert.equal(evidence.lighthouse.pageCount, 5);
  assert.equal(evidence.lighthouse.runCount, 15);
  assert.equal(evidence.lighthouse.runsPerPage, 3);
  assert.deepEqual(evidence.lighthouse.pages.map(({ key }) => key), [
    'homepage', 'price', 'realizations', 'article', 'career',
  ]);
  assert.ok(evidence.lighthouse.pages.every((page) => page.pass === true && page.runCount === 3));
  assert.match(logs.get('lighthouseBuild'), /"productionAccess":false/);
  assert.match(logs.get('lighthouseBuild'), /server stopped/);
  assert.match(logs.get('lighthouseBuild'), /PASS: jednorazov.*PostgreSQL bol zastaven/i);
  assert.match(logs.get('lighthouseBuild'), /^Cleanup PASS: owned temp root removed:/m);
  assert.throws(
    () => cleanupEvidenceMetrics(
      logs.get('lighthouseBuild').replace(/^Cleanup PASS: owned temp root removed:.*$/m, ''),
      'Lighthouse',
    ),
    /nepotvrdzuje odstránenie vlastného dočasného rootu/,
  );
  const mutateLighthouseBuildResult = (mutator) => {
    let mutated = 0;
    const output = logs.get('lighthouseBuild').split(/\r?\n/).map((line) => {
      const candidate = line.trim();
      if (!candidate.startsWith('{') || !candidate.endsWith('}')) return line;
      try {
        const parsed = JSON.parse(candidate);
        if (parsed?.result !== 'PASS' || parsed?.mode !== 'isolated-full-production-build') return line;
        mutator(parsed);
        mutated += 1;
        return JSON.stringify(parsed);
      } catch {
        return line;
      }
    }).join('\n');
    assert.equal(mutated, 1);
    return output;
  };
  assert.throws(
    () => lighthouseEvidenceMetrics(mutateLighthouseBuildResult((result) => {
      result.seoAudits.find(({ name }) => name === 'seo-rendered-content-check.mjs').output =
        result.seoAudits.find(({ name }) => name === 'seo-rendered-content-check.mjs').output.replace(
          evidence.lighthouse.buildId,
          'DIFFERENT_BUILD',
        );
    })),
    /nepotvrdzujú zhodný BUILD_ID/,
  );
  assert.throws(
    () => lighthouseEvidenceMetrics(mutateLighthouseBuildResult((result) => {
      result.lighthouseS08.results[0].path = '/nespravna-cesta/';
    })),
    /presnú päťstránkovú maticu/,
  );
  assert.throws(
    () => lighthouseEvidenceMetrics(mutateLighthouseBuildResult((result) => {
      result.lighthouseS08.results[0].medianPerformance += 1;
    })),
    /nezhodný vypočítaný medián medianPerformance/,
  );
  const currentBuildResult = {
    result: 'PASS',
    mode: 'isolated-full-production-build',
    output: 'Generating static pages using 9 workers (0/100)\nGenerating static pages using 9 workers (100/100)',
    seoAudits: [
      { name: 'seo-rendered-metadata-check.mjs', output: 'PASS: build CURRENT_BUILD; na 33 verejných statických stránkach' },
      { name: 'seo-rendered-content-check.mjs', output: 'PASS: build CURRENT_BUILD; na 33 statických indexovateľných stránkach' },
    ],
    productionAccess: false,
  };
  const completeUnitLog = [
    'ℹ tests 428',
    'ℹ pass 428',
    'ℹ fail 0',
    'ℹ cancelled 0',
    'ℹ skipped 0',
    'ℹ todo 0',
    'ℹ tests 35',
    'ℹ pass 35',
    'ℹ fail 0',
    'ℹ cancelled 0',
    'ℹ skipped 0',
    'ℹ todo 0',
  ].join('\n');
  assert.deepEqual(releaseEvidenceMetrics(
    completeUnitLog,
    `historický šum: PASS: build OLD_BUILD; Generating static pages using 7 workers (99/99)\n${JSON.stringify(currentBuildResult)}`,
  ), {
    buildId: 'CURRENT_BUILD',
    unitMjsCount: 428,
    unitTypeScriptCount: 35,
    generatedRouteCount: 100,
    staticSeoUrlCount: 33,
  });
  assert.throws(
    () => releaseEvidenceMetrics(
      completeUnitLog,
      JSON.stringify({
        ...currentBuildResult,
        seoAudits: [
          currentBuildResult.seoAudits[0],
          { name: 'seo-rendered-content-check.mjs', output: 'PASS: build CURRENT_BUILD; na 32 statických indexovateľných stránkach' },
        ],
      }),
    ),
    /zhodný počet statických SEO URL/,
  );
  assert.throws(
    () => releaseEvidenceMetrics(
      completeUnitLog,
      JSON.stringify({ ...currentBuildResult, seoAudits: [...currentBuildResult.seoAudits, currentBuildResult.seoAudits[0]] }),
    ),
    /práve jeden SEO audit seo-rendered-metadata-check\.mjs/,
  );
  assert.throws(
    () => releaseEvidenceMetrics(
      completeUnitLog,
      JSON.stringify({
        ...currentBuildResult,
        seoAudits: [
          currentBuildResult.seoAudits[0],
          { name: 'seo-rendered-content-check.mjs', output: 'PASS: build DIFFERENT_BUILD; na 33 statických indexovateľných stránkach' },
        ],
      }),
    ),
    /zhodný BUILD_ID/,
  );
  assert.throws(
    () => releaseEvidenceMetrics(
      completeUnitLog.replace('ℹ pass 428', 'ℹ pass 427').replace('ℹ skipped 0', 'ℹ skipped 1'),
      JSON.stringify(currentBuildResult),
    ),
    /všetky testy prešli/,
  );
  assert.throws(
    () => releaseEvidenceMetrics(
      completeUnitLog.replace('ℹ fail 0', 'ℹ fail 1'),
      JSON.stringify(currentBuildResult),
    ),
    /neúspešné, zrušené, preskočené alebo nedokončené testy/,
  );
  assert.doesNotMatch(generator, /testCounts\.includes\(401\)|generatedRouteCount: 99|staticSeoUrlCount: 32|unitMjsCount: 401/);

  assert.deepEqual(evidence.releaseStatus, {
    candidateDeployment: 'NOT_VERIFIED',
    customStaging: 'NOT_CONFIGURED',
    production: 'NOT_VERIFIED',
  });

  assert.match(matrix, /Otestovaný zdrojový kandidát je commit `981cd9e2`/);
  assert.match(matrix, /runtime aplikačný checkpoint je `eb56a40b`/);
  assert.match(matrix, /stagingový bezpečnostný checkpoint je `f8bb7849`/i);
  assert.match(matrix, /\*\*428\/428 MJS \+ 35\/35 TypeScript PASS\*\*/);
  assert.match(matrix, /\*\*100\/100\*\* trás/);
  assert.match(matrix, new RegExp(evidence.buildId));
  assert.match(matrix, /manifest s hashmi všetkých piatich úplných logov/i);
  assert.match(matrix, /čistom dôkazovom commite `088ac8f3`/);
  assert.match(matrix, /220\/220 stavov/);
  assert.match(matrix, /zdrojovom kandidáte `981cd9e2`/);
  assert.match(matrix, /produkci(?:a|u)[^\n]*\*\*NOT VERIFIED\*\*/iu);
  assert.doesNotMatch(matrix, /Aktuálny čistý release checkpoint/);
  assert.doesNotMatch(matrix, /release checkpoint je commit `5590c07e`/);

  assert.match(runbook, new RegExp(candidateCommit));
  assert.match(runbook, new RegExp(evidence.testedSourceTree));
  assert.match(runbook, new RegExp(`LOCAL-BUILD-EVIDENCE-${candidateShortSha}\\.json`));
  assert.match(runbook, new RegExp(`codex/astana-staging-${candidateShortSha}`));
  const allowlistBlock = runbook.match(/Explicitný allowlist medzi baseline a kandidátom je presne:\s*```text\s*([\s\S]*?)\s*```/);
  assert.ok(allowlistBlock, 'runbook must contain the exact release allowlist');
  const documentedAllowlist = allowlistBlock[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const actualAllowlist = execFileSync('git', [
    'diff', '--name-only', `8b8775d05ca638d6a602829e7527b573be3321c9..${candidateCommit}`,
  ], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(documentedAllowlist, actualAllowlist);
  assert.match(runbook, /dva platné JPG\/PNG\/WebP súbory, každý \*\*väčší ako 6 MB\*\*/);
  assert.match(runbook, /SHA-256[\s\S]*anonymné otvorenie musí byť odmietnuté/);
  assert.match(runbook, /Zápis výsledku a auditu musí byť atomický/);
  assert.match(runbook, /Potvrdené doručenie sa nikdy neposiela znova/);
  assert.match(runbook, /ďalší nejednoznačný výsledok musí zachovať `unknown`/);
  assert.match(runbook, /bez dôkazu zostáva `unknown` nevyriešené/);
  assert.match(runbook, /obnovu chýbajúceho CV alebo e-mailu bez duplicity/);
  assert.match(runbook, /obaja príjemcovia potvrdene nedoručení/);
  assert.match(runbook, /retry iba konkrétnemu potvrdene nedoručenému adresátovi/);
  assert.match(runbook, /bez automatickej ponuky alebo kontaktovania uchádzača/);
  for (const cronPath of [
    '/api/cron/backup/',
    '/api/cron/notifications/',
    '/api/cron/application-notifications/',
    '/api/cron/lead-email-delivery/',
    '/api/cron/meta-capi/',
    '/api/cron/photo-intake-retention/',
    '/api/cron/lead-upload-retention/',
    '/api/cron/lead-file-deletions/',
    '/api/cron/career-cv-retention/',
  ]) assert.match(runbook, new RegExp(cronPath.replaceAll('/', '\\/')));
  assert.equal((runbook.match(/\*\/5 \* \* \* \*/g) ?? []).length, 4);
  assert.match(runbook, /pri štyroch päťminútových worker endpointoch/);
  assert.match(runbook, /Po prípadnom rollbacku[\s\S]*prvý prirodzený päťminútový beh/);

  assert.match(releaseCheckpoint, new RegExp(candidateCommit));
  assert.match(releaseCheckpoint, new RegExp(evidence.testedSourceTree));
  assert.match(releaseCheckpoint, /428\/428 PASS/);
  assert.match(releaseCheckpoint, /12\/12/);
  assert.match(releaseCheckpoint, /15\/15 PASS/);
  assert.match(releaseCheckpoint, /stagingového ani produkčného nasadenia/);

  assert.equal(baselineVisual.result, 'PASS');
  assert.equal(baselineVisual.matrix.stateCount, 220);
  assert.equal(baselineVisual.verification.formsSubmitted, 0);
  assert.equal(baselineVisual.verification.hydrationErrors, 0);
  assert.equal(baselineVisual.verification.blockedBrowserOrigins, 0);
  assert.equal(baselineVisual.production, 'NOT_VERIFIED');
});
