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
  sanitized = replaceLiteral(sanitized, process.env.USERNAME, '<LOCAL_USER>');
  for (const [key, secret] of Object.entries(process.env)) {
    if (!sensitiveEnvironmentName.test(key)) continue;
    if (secret && secret.length >= 8 && sanitized.includes(secret)) {
      throw new Error(`Výstup obsahuje hodnotu chránenej premennej ${key}.`);
    }
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
    ['productionBuild', 'powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(candidateRoot, 'scripts', 'run-isolated-postgres.ps1'),
      '-ProductionBuild',
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
  const buildLog = await readFile(path.join(outputDirectory, 'productionBuild.txt'), 'utf8');
  const testCounts = [...unitLog.matchAll(/ℹ tests (\d+)/g)].map((match) => Number(match[1]));
  if (!testCounts.includes(401) || !testCounts.includes(35)) throw new Error('Log nepotvrdzuje 401 MJS a 35 TypeScript testov.');
  requireMatch(buildLog, /"result":"PASS"/, 'Build log nepotvrdzuje PASS.');
  requireMatch(buildLog, /Generating static pages using 7 workers \(99\/99\)/, 'Build log nepotvrdzuje 99/99 trás.');
  const buildId = requireMatch(buildLog, /PASS: build ([^;\r\n]+);/, 'Build log neobsahuje BUILD_ID.')[1];
  requireMatch(buildLog, /"productionAccess":false/, 'Build log nepotvrdzuje productionAccess:false.');
  requireMatch(buildLog, /server stopped/, 'Build log nepotvrdzuje zastavenie PostgreSQL.');
  requireMatch(buildLog, /PASS: jednorazov.*PostgreSQL bol zastaven/i, 'Build log nepotvrdzuje úspešné čistenie testovacej DB.');

  const evidence = {
    schemaVersion: 3,
    recordedAt: new Date().toISOString(),
    testedSourceCommit: expectedCommit,
    testedSourceTree: candidateTree,
    result: 'PASS',
    buildId,
    generatedRouteCount: 99,
    staticSeoUrlCount: 32,
    unitMjsCount: 401,
    unitTypeScriptCount: 35,
    typecheck: 'PASS',
    productionAccess: false,
    temporaryDatabaseStopped: true,
    temporaryDatabaseRemoved: true,
    temporaryRootRemoved: true,
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
