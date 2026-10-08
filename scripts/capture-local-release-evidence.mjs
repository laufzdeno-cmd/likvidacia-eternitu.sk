import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(projectRoot, 'docs', 'upgrade-2026-09-30', 'evidence');
const safeEnvironmentKeys = [
  'APPDATA',
  'ComSpec',
  'HOMEDRIVE',
  'HOMEPATH',
  'LOCALAPPDATA',
  'NUMBER_OF_PROCESSORS',
  'OS',
  'PATH',
  'PATHEXT',
  'PROCESSOR_ARCHITECTURE',
  'ProgramData',
  'ProgramFiles',
  'ProgramFiles(x86)',
  'ProgramW6432',
  'PSModulePath',
  'SystemDrive',
  'SystemRoot',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'WINDIR',
];
const forbiddenLocalEnvironmentFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
  '.env.test',
  '.env.test.local',
];
const sensitiveEnvironmentName = /(secret|token|password|passphrase|database|postgres|blob|api[_-]?key|auth|smtp|private|credential)/i;

function argument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : '';
  if (!value || value.startsWith('--')) throw new Error(`Chýba ${name}.`);
  return value;
}

function git(candidateRoot, ...args) {
  return execFileSync('git', ['-C', candidateRoot, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function safeChildEnvironment() {
  const environment = {};
  for (const key of safeEnvironmentKeys) {
    if (typeof process.env[key] === 'string') environment[key] = process.env[key];
  }
  environment.CI = '1';
  return environment;
}

function replaceLiteral(value, needle, replacement) {
  if (!needle) return value;
  return value.replace(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replacement);
}

function replacePathVariants(value, localPath, replacement) {
  if (!localPath) return value;
  const slashPath = localPath.replaceAll('\\', '/');
  const backslashPath = localPath.replaceAll('/', '\\');
  const variants = new Set([
    localPath,
    slashPath,
    backslashPath,
    JSON.stringify(localPath).slice(1, -1),
    JSON.stringify(slashPath).slice(1, -1),
    JSON.stringify(backslashPath).slice(1, -1),
  ]);
  let sanitized = value;
  for (const variant of [...variants].sort((left, right) => right.length - left.length)) {
    sanitized = replaceLiteral(sanitized, variant, replacement);
  }
  return sanitized;
}

export function sanitizeLog(value, candidateRoot) {
  let sanitized = replacePathVariants(value, candidateRoot, '<CANDIDATE_ROOT>');
  sanitized = replacePathVariants(sanitized, projectRoot, '<PROJECT_ROOT>');
  sanitized = replacePathVariants(sanitized, process.env.USERPROFILE, '<USER_PROFILE>');
  sanitized = replacePathVariants(
    sanitized,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'PostgreSQL', '17', 'bin') : '',
    '<POSTGRES_BIN>',
  );
  sanitized = replaceLiteral(sanitized, process.env.USERNAME, '<LOCAL_USER>');
  sanitized = sanitized.replace(
    /^PASS: jednorazov.*PostgreSQL bol zastaven.*$/gmu,
    'PASS: jednorazový PostgreSQL bol zastavený a jeho projektové tmp dáta odstránené.',
  );
  for (const [key, secret] of Object.entries(process.env)) {
    if (!sensitiveEnvironmentName.test(key)) continue;
    if (secret && secret.length >= 8 && sanitized.includes(secret)) {
      throw new Error(`Výstup obsahuje hodnotu chránenej premennej ${key}.`);
    }
  }
  if (sanitized.includes('\uFFFD')) {
    throw new Error('Výstup obsahuje poškodené UTF-8 znaky.');
  }
  return sanitized;
}

async function assertNoLocalEnvironmentFiles(candidateRoot) {
  for (const file of forbiddenLocalEnvironmentFiles) {
    try {
      await access(path.join(candidateRoot, file));
      throw new Error(`Candidate checkout obsahuje zakázaný lokálny konfiguračný súbor ${file}.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

async function run(candidateRoot, name, command, args) {
  const startedAt = new Date().toISOString();
  const needsWindowsCommandShell = process.platform === 'win32' && command.toLowerCase().endsWith('.cmd');
  const spawnCommand = needsWindowsCommandShell ? (process.env.ComSpec || 'cmd.exe') : command;
  const spawnArgs = needsWindowsCommandShell ? ['/d', '/s', '/c', command, ...args] : args;
  const child = spawn(spawnCommand, spawnArgs, {
    cwd: candidateRoot,
    env: safeChildEnvironment(),
    shell: false,
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; process.stdout.write(chunk); });
  child.stderr.on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk); });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  const endedAt = new Date().toISOString();
  const log = [
    `command: ${JSON.stringify([command, ...args])}`,
    `startedAt: ${startedAt}`,
    `endedAt: ${endedAt}`,
    `exitCode: ${exitCode}`,
    '',
    '[stdout]',
    stdout,
    '[stderr]',
    stderr,
  ].join('\n');
  return { args, command, endedAt, exitCode, log, name, startedAt };
}

function requireMatch(value, pattern, message) {
  const match = value.match(pattern);
  if (!match) throw new Error(message);
  return match;
}

export function releaseEvidenceMetrics(unitLog, buildLog) {
  const summaryFields = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];
  const unitSummaries = Object.fromEntries(summaryFields.map((field) => [
    field,
    [...unitLog.matchAll(new RegExp(`^ℹ ${field} (\\d+)$`, 'gm'))].map((match) => Number(match[1])),
  ]));
  if (summaryFields.some((field) => unitSummaries[field].length !== 2)) {
    throw new Error('Unit log nepotvrdzuje obe úplné testovacie sady.');
  }
  const testCounts = unitSummaries.tests;
  for (const index of [0, 1]) {
    const tests = testCounts[index];
    if (!Number.isInteger(tests) || tests < 1 || unitSummaries.pass[index] !== tests) {
      throw new Error('Unit log nepotvrdzuje, že všetky testy prešli.');
    }
    if (['fail', 'cancelled', 'skipped', 'todo'].some((field) => unitSummaries[field][index] !== 0)) {
      throw new Error('Unit log obsahuje neúspešné, zrušené, preskočené alebo nedokončené testy.');
    }
  }

  const buildResults = [];
  for (const line of buildLog.split(/\r?\n/)) {
    const candidate = line.trim();
    if (!candidate.startsWith('{') || !candidate.endsWith('}')) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed?.result === 'PASS' && parsed?.mode === 'isolated-full-production-build') buildResults.push(parsed);
    } catch {
      // Other command output may contain braces without being the build result.
    }
  }
  if (buildResults.length !== 1) {
    throw new Error('Build log musí obsahovať práve jeden výsledok izolovaného produkčného buildu.');
  }
  const buildResult = buildResults[0];
  if (typeof buildResult.output !== 'string' || buildResult.productionAccess !== false) {
    throw new Error('Výsledok buildu nemá bezpečný očakávaný kontrakt.');
  }
  const generatedRouteCount = Number(requireMatch(
    buildResult.output,
    /Generating static pages using \d+ workers \((\d+)\/\1\)/,
    'Build log nepotvrdzuje dokončený počet trás.',
  )[1]);
  const expectedSeoAudits = ['seo-rendered-metadata-check.mjs', 'seo-rendered-content-check.mjs'];
  const seoResults = expectedSeoAudits.map((name) => {
    const matches = Array.isArray(buildResult.seoAudits)
      ? buildResult.seoAudits.filter((audit) => audit?.name === name && typeof audit?.output === 'string')
      : [];
    if (matches.length !== 1) throw new Error(`Build log musí obsahovať práve jeden SEO audit ${name}.`);
    const output = matches[0].output;
    return {
      buildId: requireMatch(output, /PASS: build ([^;\r\n]+);/, `SEO audit ${name} nepotvrdzuje BUILD_ID.`)[1],
      staticSeoUrlCount: Number(requireMatch(
        output,
        /\bna (\d+) (?:verejných )?statických(?: indexovateľných)? stránkach/,
        `SEO audit ${name} nepotvrdzuje počet statických URL.`,
      )[1]),
    };
  });
  if (new Set(seoResults.map(({ staticSeoUrlCount }) => staticSeoUrlCount)).size !== 1) {
    throw new Error('Build log nepotvrdzuje zhodný počet statických SEO URL v oboch auditoch.');
  }
  if (new Set(seoResults.map(({ buildId }) => buildId)).size !== 1) {
    throw new Error('Build log nepotvrdzuje zhodný BUILD_ID v oboch SEO auditoch.');
  }

  return {
    buildId: seoResults[0].buildId,
    unitMjsCount: testCounts[0],
    unitTypeScriptCount: testCounts[1],
    generatedRouteCount,
    staticSeoUrlCount: seoResults[0].staticSeoUrlCount,
  };
}

export function databaseEvidenceMetrics(databaseLog) {
  const fields = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];
  const summary = Object.fromEntries(fields.map((field) => {
    const matches = [...databaseLog.matchAll(new RegExp(`^ℹ ${field} (\\d+)$`, 'gm'))];
    if (matches.length !== 1) throw new Error(`DB integration log musí obsahovať práve jeden súhrn ${field}.`);
    return [field, Number(matches[0][1])];
  }));
  if (summary.tests !== 12 || summary.pass !== 12) {
    throw new Error('DB integration log nepotvrdzuje presne 12/12 testov.');
  }
  if (['fail', 'cancelled', 'skipped', 'todo'].some((field) => summary[field] !== 0)) {
    throw new Error('DB integration log obsahuje neúspešný alebo neúplný test.');
  }
  requireMatch(databaseLog, /PASS: staging bootstrap is transactional, idempotent and concurrency-safe on disposable PostgreSQL\./,
    'DB integration log nepotvrdzuje staging bootstrap.');
  requireMatch(databaseLog, /PASS: local Meta consent tombstone and create\/revoke race; no network or production access\./,
    'DB integration log nepotvrdzuje Meta consent race.');
  requireMatch(databaseLog, /PASS: isolated Meta CAPI outbox; no real fetch, form, email or production action\./,
    'DB integration log nepotvrdzuje izolovaný Meta CAPI outbox.');
  return {
    tests: summary.tests,
    stagingBootstrap: 'PASS',
    metaConsentRace: 'PASS',
    metaCapiOutbox: 'PASS',
  };
}

export function cleanupEvidenceMetrics(log, label = 'Dôkazový') {
  const requireExactlyOne = (pattern, message) => {
    const matches = [...log.matchAll(pattern)];
    if (matches.length !== 1) throw new Error(message);
  };
  requireExactlyOne(/^server stopped$/gm, `${label} log nepotvrdzuje práve jedno zastavenie PostgreSQL.`);
  requireExactlyOne(
    /^PASS: jednorazový PostgreSQL bol zastavený a jeho projektové tmp dáta odstránené\.$/gm,
    `${label} log nepotvrdzuje odstránenie jednorazovej databázy.`,
  );
  requireExactlyOne(
    /^Cleanup PASS: owned temp root removed: <USER_PROFILE>[\\/]AppData[\\/]Local[\\/]Temp[\\/]astana-photo-intake-[A-Za-z0-9_-]+$/gm,
    `${label} log nepotvrdzuje odstránenie vlastného dočasného rootu.`,
  );
  return {
    temporaryDatabaseStopped: true,
    temporaryDatabaseRemoved: true,
    temporaryRootRemoved: true,
  };
}

export function lighthouseEvidenceMetrics(lighthouseLog) {
  const buildResults = [];
  for (const line of lighthouseLog.split(/\r?\n/)) {
    const candidate = line.trim();
    if (!candidate.startsWith('{') || !candidate.endsWith('}')) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed?.result === 'PASS' && parsed?.mode === 'isolated-full-production-build') buildResults.push(parsed);
    } catch {
      // Other command output may contain braces without being the build result.
    }
  }
  if (buildResults.length !== 1) {
    throw new Error('Lighthouse log musí obsahovať práve jeden výsledok izolovaného produkčného buildu.');
  }
  const buildResult = buildResults[0];
  if (buildResult.productionAccess !== false) throw new Error('Lighthouse build nemá vypnutý produkčný prístup.');
  const expectedSeoAudits = ['seo-rendered-metadata-check.mjs', 'seo-rendered-content-check.mjs'];
  const buildIds = expectedSeoAudits.map((name) => {
    const matches = Array.isArray(buildResult.seoAudits)
      ? buildResult.seoAudits.filter((audit) => audit?.name === name && typeof audit?.output === 'string')
      : [];
    if (matches.length !== 1) throw new Error(`Lighthouse build musí obsahovať práve jeden SEO audit ${name}.`);
    return requireMatch(
      matches[0].output,
      /PASS: build ([^;\r\n]+);/,
      `Lighthouse SEO audit ${name} nepotvrdzuje BUILD_ID.`,
    )[1];
  });
  if (new Set(buildIds).size !== 1) throw new Error('Lighthouse SEO audity nepotvrdzujú zhodný BUILD_ID.');
  const buildId = buildIds[0];
  const lighthouse = buildResult.lighthouseS08;
  if (lighthouse?.result !== 'PASS' || lighthouse?.originKind !== 'isolated-loopback') {
    throw new Error('Lighthouse výsledok nie je PASS na izolovanom loopback origin.');
  }
  if (lighthouse.lighthouseVersion !== '13.5.0' || lighthouse.runsPerPage !== 3) {
    throw new Error('Lighthouse výsledok nepoužíva očakávanú verziu a tri behy na stránku.');
  }
  const expectedPages = [
    ['homepage', '/'],
    ['price', '/cena-likvidacie-azbestu/'],
    ['realizations', '/realizacie/'],
    ['article', '/poradna/co-je-eternit-a-kedy-obsahuje-azbest/'],
    ['career', '/kariera/'],
  ];
  if (!Array.isArray(lighthouse.results)
    || lighthouse.results.length !== expectedPages.length
    || lighthouse.results.some((page, index) => page?.key !== expectedPages[index][0]
      || page?.path !== expectedPages[index][1])) {
    throw new Error('Lighthouse výsledok nemá presnú päťstránkovú maticu.');
  }
  const thresholds = lighthouse.thresholds || {};
  if (thresholds.medianPerformance !== 90 || thresholds.medianAccessibility !== 90
    || thresholds.medianSeo !== 90 || thresholds.medianLcpMs !== 2500 || thresholds.medianCls !== 0.1) {
    throw new Error('Lighthouse výsledok nemá uzamknuté akceptačné prahy.');
  }
  const pages = lighthouse.results.map((page) => {
    if (!Array.isArray(page.runs) || page.runs.length !== 3 || page.pass !== true) {
      throw new Error(`Lighthouse stránka ${page?.key || 'unknown'} nemá tri úspešné behy.`);
    }
    for (const [index, run] of page.runs.entries()) {
      if (run.run !== index + 1) throw new Error(`Lighthouse stránka ${page.key} nemá očakávané poradie behov.`);
      if (![run.performance, run.accessibility, run.seo, run.lcpMs, run.cls].every(Number.isFinite)) {
        throw new Error(`Lighthouse stránka ${page.key} obsahuje neúplný beh.`);
      }
    }
    const median = (field) => page.runs.map((run) => run[field]).sort((left, right) => left - right)[1];
    const computed = {
      medianPerformance: median('performance'),
      medianAccessibility: median('accessibility'),
      medianSeo: median('seo'),
      medianLcpMs: median('lcpMs'),
      medianCls: median('cls'),
    };
    for (const [field, value] of Object.entries(computed)) {
      if (page[field] !== value) throw new Error(`Lighthouse stránka ${page.key} má nezhodný vypočítaný medián ${field}.`);
    }
    if (computed.medianPerformance < thresholds.medianPerformance
      || computed.medianAccessibility < thresholds.medianAccessibility
      || computed.medianSeo < thresholds.medianSeo
      || computed.medianLcpMs > thresholds.medianLcpMs
      || computed.medianCls > thresholds.medianCls) {
      throw new Error(`Lighthouse stránka ${page.key} nesplnila prahy.`);
    }
    return {
      key: page.key,
      path: page.path,
      runCount: page.runs.length,
      ...computed,
      pass: page.pass,
    };
  });
  return {
    buildId,
    lighthouseVersion: lighthouse.lighthouseVersion,
    originKind: lighthouse.originKind,
    runsPerPage: lighthouse.runsPerPage,
    pageCount: pages.length,
    runCount: pages.reduce((sum, page) => sum + page.runCount, 0),
    thresholds,
    pages,
  };
}

async function main() {
  const candidateRoot = path.resolve(argument('--candidate-root'));
  const expectedCommit = argument('--candidate-sha').toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(expectedCommit)) throw new Error('Candidate SHA musí byť plný 40-znakový SHA.');

  const allowedCandidateParent = `${path.join(projectRoot, 'tmp')}${path.sep}`.toLowerCase();
  if (!candidateRoot.toLowerCase().startsWith(allowedCandidateParent)) {
    throw new Error('Candidate checkout musí byť v projektovom tmp adresári.');
  }
  const actualCommit = git(candidateRoot, 'rev-parse', 'HEAD').toLowerCase();
  if (actualCommit !== expectedCommit) throw new Error('Candidate checkout nemá očakávaný commit.');
  if (git(candidateRoot, 'status', '--porcelain')) throw new Error('Candidate checkout nie je čistý.');
  await assertNoLocalEnvironmentFiles(candidateRoot);
  const candidateTree = git(candidateRoot, 'show', '-s', '--format=%T', 'HEAD');
  const shortSha = expectedCommit.slice(0, 8);
  const outputDirectory = path.join(evidenceRoot, shortSha);
  const evidencePath = path.join(projectRoot, 'docs', 'upgrade-2026-09-30', `LOCAL-BUILD-EVIDENCE-${shortSha}.json`);

  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });

  const commandSpecs = [
    ['unit', 'npm.cmd', ['run', 'test:unit']],
    ['typecheck', 'npm.cmd', ['run', 'typecheck']],
    ['databaseIntegration', 'npm.cmd', ['run', 'test:db-integration']],
    ['productionBuild', 'powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(candidateRoot, 'scripts', 'run-isolated-postgres.ps1'),
      '-ProductionBuild',
    ]],
    ['lighthouseBuild', 'powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(candidateRoot, 'scripts', 'run-isolated-postgres.ps1'),
      '-ProductionBuild',
      '-Lighthouse',
    ]],
  ];
  const commands = [];
  for (const [name, commandName, args] of commandSpecs) {
    const command = await run(candidateRoot, name, commandName, args);
    const logPath = path.join(outputDirectory, `${command.name}.txt`);
    const sanitizedLog = sanitizeLog(command.log, candidateRoot).replace(/\r\n/g, '\n');
    await writeFile(logPath, sanitizedLog, 'utf8');
    command.logPath = path.relative(projectRoot, logPath).replaceAll('\\', '/');
    command.logSha256 = sha256(sanitizedLog);
    command.trackedLogSha256 = command.logSha256;
    command.args = command.args.map((value) => sanitizeLog(value, candidateRoot));
    delete command.log;
    commands.push(command);
    if (command.exitCode !== 0) throw new Error(`${command.name} skončil kódom ${command.exitCode}.`);
  }

  const unitLog = await readFile(path.join(outputDirectory, 'unit.txt'), 'utf8');
  const databaseLog = await readFile(path.join(outputDirectory, 'databaseIntegration.txt'), 'utf8');
  const buildLog = await readFile(path.join(outputDirectory, 'productionBuild.txt'), 'utf8');
  const lighthouseLog = await readFile(path.join(outputDirectory, 'lighthouseBuild.txt'), 'utf8');
  const metrics = releaseEvidenceMetrics(unitLog, buildLog);
  const databaseIntegration = databaseEvidenceMetrics(databaseLog);
  const lighthouse = lighthouseEvidenceMetrics(lighthouseLog);
  const buildCleanup = cleanupEvidenceMetrics(buildLog, 'Build');
  const lighthouseCleanup = cleanupEvidenceMetrics(lighthouseLog, 'Lighthouse');
  if (JSON.stringify(buildCleanup) !== JSON.stringify(lighthouseCleanup)) {
    throw new Error('Build a Lighthouse nepotvrdzujú rovnaký cleanup kontrakt.');
  }

  const evidence = {
    schemaVersion: 4,
    recordedAt: new Date().toISOString(),
    testedSourceCommit: expectedCommit,
    testedSourceTree: candidateTree,
    result: 'PASS',
    ...metrics,
    databaseIntegration,
    lighthouse,
    typecheck: 'PASS',
    productionAccess: false,
    ...buildCleanup,
    commands: commands.map(({ name, command, args, startedAt, endedAt, exitCode, logPath, logSha256, trackedLogSha256 }) => ({
      name,
      command,
      args,
      startedAt,
      endedAt,
      exitCode,
      logPath,
      logSha256,
      trackedLogSha256,
    })),
    releaseStatus: {
      candidateDeployment: 'NOT_VERIFIED',
      customStaging: 'NOT_CONFIGURED',
      production: 'NOT_VERIFIED',
    },
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`\nPASS: dôkaz pre ${expectedCommit} je v ${path.relative(projectRoot, evidencePath)}.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
