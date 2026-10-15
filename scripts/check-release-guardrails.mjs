import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE_GUARD_COMMAND = 'node scripts/check-release-guardrails.mjs';
const REVIEWED_DEPLOY_COMMAND = 'node scripts/deploy-reviewed-release.mjs';
const VERCEL_IAM_ACKNOWLEDGEMENT = '--acknowledge-vercel-iam-boundary';
const RELEASE_GUARD_CHANGE_ACKNOWLEDGEMENT = '--acknowledge-release-guard-change';
const APPROVED_RELEASE_SCRIPT_NAMES = new Set(['deploy', 'release:guard', 'test:release-guard', 'test:release-deploy']);
const APPROVED_NON_DEPLOYMENT_COMMANDS = new Set([
  'node --import tsx --test scripts/published-realization-locality-points.behavior.mjs',
]);
const APPROVED_CHANGED_SCRIPT_NAMES = new Set([
  'deploy',
  'release:guard',
  'test:release-guard',
  'test:release-deploy',
  'test:unit',
  'test:db-integration',
]);
const MANIFEST_RELATIVE_PATH = 'test-results/release-manifest.json';
const SINGLE_VALUE_ARGUMENTS = new Set([
  '--repo',
  '--expected-head',
  '--expected-branch',
  '--protected-baseline',
  '--rollback-sha',
  '--rollback-deployment',
  '--previous-production-deployment',
]);
const REPEATABLE_ARGUMENTS = new Set(['--allow', '--protected', '--allow-protected-change']);
const BOOLEAN_ARGUMENTS = new Set([VERCEL_IAM_ACKNOWLEDGEMENT, RELEASE_GUARD_CHANGE_ACKNOWLEDGEMENT]);
const DEFAULT_PROTECTED_FILES = [
  'app/api/dopyt/route.ts',
  'app/api/lead/route.ts',
  'app/api/marketing-consent/revoke/route.ts',
  'app/api/cron/meta-capi/route.ts',
  'app/facebook-cenova-ponuka/route.ts',
  'app/homepage-critical-client.tsx',
  'app/landing-client.tsx',
  'app/layout.tsx',
  'app/public-layout.tsx',
  'app/public-widgets.tsx',
  'app/page.tsx',
  'app/strechari/page.tsx',
  'src/lib/marketing-consent.ts',
  'src/server/db.ts',
  'src/server/mail.ts',
  'src/server/meta-conversions-api.ts',
  'src/server/storage.ts',
  'src/server/types.ts',
  'src/server/validation.ts',
  'scripts/check-release-guardrails.mjs',
  'scripts/deploy-reviewed-release.mjs',
  'scripts/published-realization-locality-points.behavior.mjs',
  'next.config.mjs',
  'vercel.json',
  'package-lock.json',
];

function git(repo, args, options = {}) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: options.encoding ?? 'utf8',
    stdio: ['ignore', 'pipe', options.quiet ? 'ignore' : 'pipe'],
    windowsHide: true,
  });
}

function gitText(repo, args, options = {}) {
  return git(repo, args, { ...options, encoding: 'utf8' }).trim();
}

function parseArguments(argv) {
  const single = new Map();
  const repeated = new Map([...REPEATABLE_ARGUMENTS].map((name) => [name, []]));
  const booleans = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equalsIndex = argument.indexOf('=');
    const name = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);

    if (BOOLEAN_ARGUMENTS.has(name)) {
      if (equalsIndex !== -1) throw new Error(`Parameter ${name} neprijíma hodnotu.`);
      if (booleans.has(name)) throw new Error(`Parameter ${name} bol zadaný viackrát.`);
      booleans.add(name);
      continue;
    }

    if (name === '--output') {
      throw new Error('Vlastná cesta manifestu nie je povolená. Používa sa iba test-results/release-manifest.json.');
    }
    if (!SINGLE_VALUE_ARGUMENTS.has(name) && !REPEATABLE_ARGUMENTS.has(name)) {
      throw new Error(`Neznámy parameter: ${argument}`);
    }

    const value = equalsIndex === -1 ? argv[index + 1] : argument.slice(equalsIndex + 1);
    if (equalsIndex === -1) index += 1;
    if (!value || value.startsWith('--')) {
      throw new Error(`Parameter ${name} nemá hodnotu.`);
    }

    if (SINGLE_VALUE_ARGUMENTS.has(name)) {
      if (single.has(name)) throw new Error(`Parameter ${name} bol zadaný viackrát.`);
      single.set(name, value);
      continue;
    }

    const values = repeated.get(name);
    if (values.includes(value)) throw new Error(`Parameter ${name} opakuje hodnotu ${value}.`);
    values.push(value);
  }

  for (const name of [
    '--expected-head',
    '--expected-branch',
    '--protected-baseline',
    '--rollback-sha',
    '--rollback-deployment',
    '--previous-production-deployment',
  ]) {
    if (!single.has(name)) throw new Error(`Chýba povinný parameter ${name}.`);
  }

  if (repeated.get('--allow').length === 0) {
    throw new Error('Chýba explicitný allowlist. Zadajte každý schválený súbor cez --allow.');
  }
  if (!booleans.has(VERCEL_IAM_ACKNOWLEDGEMENT)) {
    throw new Error(
      `Chýba ${VERCEL_IAM_ACKNOWLEDGEMENT}; repozitár nevie zablokovať Vercel dashboard, API, deploy hook ani cudzí CLI token. `
      + 'Pokračujte iba po overení IAM oprávnení a ochrany produkčného prostredia vo Verceli.',
    );
  }

  return {
    repo: single.get('--repo'),
    expectedHead: single.get('--expected-head'),
    expectedBranch: single.get('--expected-branch'),
    protectedBaseline: single.get('--protected-baseline'),
    rollbackSha: single.get('--rollback-sha'),
    rollbackDeployment: single.get('--rollback-deployment'),
    previousProductionDeployment: single.get('--previous-production-deployment'),
    allowedFiles: repeated.get('--allow'),
    protectedFiles: repeated.get('--protected'),
    allowedProtectedChanges: repeated.get('--allow-protected-change'),
    vercelIamBoundaryAcknowledged: true,
    releaseGuardChangeAcknowledged: booleans.has(RELEASE_GUARD_CHANGE_ACKNOWLEDGEMENT),
  };
}

function validateFullCommit(repo, value, label) {
  if (!/^[0-9a-f]{40}$/i.test(value ?? '')) {
    throw new Error(`${label} musí byť plný 40-znakový Git SHA.`);
  }

  let resolved;
  try {
    resolved = gitText(repo, ['rev-parse', '--verify', `${value}^{commit}`], { quiet: true });
  } catch {
    throw new Error(`${label} neodkazuje na existujúci lokálny commit.`);
  }
  if (resolved.toLowerCase() !== value.toLowerCase()) {
    throw new Error(`${label} sa nepodarilo jednoznačne overiť.`);
  }
  return resolved.toLowerCase();
}

function validateBranch(value) {
  if (!value || value.trim() !== value || /\s/.test(value)) {
    throw new Error('--expected-branch musí byť presný názov lokálnej vetvy bez medzier.');
  }
  try {
    execFileSync('git', ['check-ref-format', '--branch', value], {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
    });
  } catch {
    throw new Error('--expected-branch nie je platný názov Git vetvy.');
  }
  return value;
}

function validateRepositoryPath(value, label) {
  if (
    !value
    || value !== value.trim()
    || value.includes('\\')
    || value.includes('\0')
    || value.includes(':')
    || value.startsWith('/')
    || value === '.'
    || posix.normalize(value) !== value
    || value.split('/').includes('..')
  ) {
    throw new Error(`${label} musí byť normalizovaná relatívna Git cesta.`);
  }
  return value;
}

function validateRollbackDeployment(value) {
  if (!/^dpl_[A-Za-z0-9]+$/.test(value ?? '')) {
    throw new Error('--rollback-deployment musí mať formát dpl_<alphanumeric>.');
  }
  return value;
}

function requireAncestor(repo, ancestor, descendant, label) {
  const result = execFileSync(
    'git',
    ['-C', repo, 'merge-base', '--is-ancestor', ancestor, descendant],
    { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true },
  );
  if (result === undefined) throw new Error(`${label} sa nepodarilo overiť.`);
}

function fileAt(repo, ref, file) {
  return git(repo, ['show', `${ref}:${file}`], { encoding: 'buffer' });
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readJsonAt(repo, ref, file) {
  let source;
  try {
    source = fileAt(repo, ref, file).toString('utf8');
  } catch {
    throw new Error(`${file} chýba v commite ${ref}.`);
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${file} v commite ${ref} nie je platný JSON.`);
  }
}

function changedPaths(repo, baseline, head) {
  const output = git(repo, ['diff', '--name-status', '-z', '--find-renames', `${baseline}..${head}`], {
    encoding: 'buffer',
  }).toString('utf8');
  const entries = output.split('\0');
  const files = [];

  for (let index = 0; index < entries.length;) {
    const status = entries[index++];
    if (!status) break;
    const firstPath = entries[index++];
    if (!firstPath) throw new Error('Git vrátil neúplný zoznam zmenených súborov.');
    files.push(firstPath);
    if (status.startsWith('R') || status.startsWith('C')) {
      const secondPath = entries[index++];
      if (!secondPath) throw new Error('Git vrátil neúplný rename/copy záznam.');
      files.push(secondPath);
    }
  }

  return [...new Set(files)].sort();
}

function isPathInside(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent !== '' && !pathFromParent.startsWith('..') && !pathFromParent.includes(':');
}

async function rejectSymlinkedManifestDirectory(manifestDirectory) {
  try {
    const entry = await lstat(manifestDirectory);
    if (entry.isSymbolicLink()) throw new Error('test-results nesmie byť symbolický odkaz.');
    if (!entry.isDirectory()) throw new Error('test-results musí byť adresár.');
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
}

export async function runReleaseGuard({ argv = process.argv.slice(2), cwd = process.cwd() } = {}) {
  const parsed = parseArguments(argv);

  let repo;
  try {
    repo = gitText(resolve(parsed.repo || cwd), ['rev-parse', '--show-toplevel'], { quiet: true });
  } catch {
    throw new Error('Release guard musí bežať v Git repozitári.');
  }

  const expectedHead = validateFullCommit(repo, parsed.expectedHead, '--expected-head');
  const protectedBaseline = validateFullCommit(repo, parsed.protectedBaseline, '--protected-baseline');
  const rollbackSha = validateFullCommit(repo, parsed.rollbackSha, '--rollback-sha');
  const expectedBranch = validateBranch(parsed.expectedBranch);
  const rollbackDeployment = validateRollbackDeployment(parsed.rollbackDeployment);
  const previousProductionDeployment = validateRollbackDeployment(parsed.previousProductionDeployment);
  const allowedFiles = parsed.allowedFiles.map((file) => validateRepositoryPath(file, '--allow'));
  const protectedFiles = [...new Set([...DEFAULT_PROTECTED_FILES, ...parsed.protectedFiles])]
    .map((file) => validateRepositoryPath(file, '--protected'));
  const allowedProtectedChanges = parsed.allowedProtectedChanges
    .map((file) => validateRepositoryPath(file, '--allow-protected-change'));

  try {
    requireAncestor(repo, protectedBaseline, expectedHead, '--protected-baseline');
  } catch {
    throw new Error('--protected-baseline musí byť predkom očakávaného HEAD.');
  }
  try {
    requireAncestor(repo, rollbackSha, expectedHead, '--rollback-sha');
  } catch {
    throw new Error('--rollback-sha musí byť predkom očakávaného HEAD.');
  }

  const manifestDirectory = resolve(repo, 'test-results');
  const output = resolve(repo, MANIFEST_RELATIVE_PATH);
  if (!isPathInside(manifestDirectory, output)) {
    throw new Error('Cesta manifestu musí zostať v test-results/.');
  }
  await rejectSymlinkedManifestDirectory(manifestDirectory);
  await rm(output, { force: true });

  const failures = [];
  const checks = {};
  const actualHead = gitText(repo, ['rev-parse', 'HEAD']).toLowerCase();
  checks.expectedHead = { expected: expectedHead, actual: actualHead, passed: actualHead === expectedHead };
  if (!checks.expectedHead.passed) failures.push(`HEAD ${actualHead} nezodpovedá očakávanému SHA ${expectedHead}.`);

  let actualBranch = null;
  try {
    actualBranch = gitText(repo, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { quiet: true });
  } catch {
    failures.push('HEAD je odpojený od vetvy; release je odmietnutý.');
  }
  checks.expectedBranch = { expected: expectedBranch, actual: actualBranch, passed: actualBranch === expectedBranch };
  if (actualBranch && actualBranch !== expectedBranch) {
    failures.push(`Vetva ${actualBranch} nezodpovedá schválenej vetve ${expectedBranch}.`);
  }

  const status = gitText(repo, ['status', '--porcelain=v1', '--untracked-files=all']);
  checks.cleanWorkingTree = { passed: status === '', entries: status ? status.split('\n') : [] };
  if (!checks.cleanWorkingTree.passed) failures.push('Git pracovný strom nie je čistý.');

  const changedFiles = changedPaths(repo, protectedBaseline, actualHead);
  const allowedSet = new Set(allowedFiles);
  const changedSet = new Set(changedFiles);
  const unexpectedFiles = changedFiles.filter((file) => !allowedSet.has(file));
  const unusedAllowlistEntries = allowedFiles.filter((file) => !changedSet.has(file));
  checks.allowedReleaseScope = {
    allowedFiles,
    changedFiles,
    unexpectedFiles,
    unusedAllowlistEntries,
    passed: unexpectedFiles.length === 0 && unusedAllowlistEntries.length === 0,
  };
  if (unexpectedFiles.length > 0) failures.push(`Release obsahuje nepovolené súbory: ${unexpectedFiles.join(', ')}.`);
  if (unusedAllowlistEntries.length > 0) failures.push(`Allowlist obsahuje súbory bez zmeny: ${unusedAllowlistEntries.join(', ')}.`);

  const trackedTestResults = gitText(repo, ['ls-files', '--', 'test-results']).split('\n').filter(Boolean);
  checks.noTrackedTestResults = { files: trackedTestResults, passed: trackedTestResults.length === 0 };
  if (trackedTestResults.length > 0) failures.push('test-results nesmie obsahovať žiadne trackované súbory.');

  const allowedProtectedChangeSet = new Set(allowedProtectedChanges);
  const protectedFileSet = new Set(protectedFiles);
  const invalidProtectedChangeApprovals = allowedProtectedChanges.filter((file) => !protectedFileSet.has(file));
  const protectedChangeApprovalsOutsideScope = allowedProtectedChanges.filter((file) => !allowedSet.has(file));
  const protectedFileHashes = protectedFiles.map((file) => {
    try {
      const baselineHash = hash(fileAt(repo, protectedBaseline, file));
      const currentHash = hash(fileAt(repo, actualHead, file));
      const changed = baselineHash !== currentHash;
      const approvalRequested = allowedProtectedChangeSet.has(file);
      return {
        file, baselineHash, currentHash, changed, approvalRequested,
        passed: !changed || approvalRequested,
      };
    } catch (error) {
      return { file, passed: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  const unapprovedProtectedChanges = protectedFileHashes.filter((entry) => entry.changed && !entry.approvalRequested);
  const invalidProtectedFiles = protectedFileHashes.filter((entry) => entry.error);
  const unusedProtectedChangeApprovals = allowedProtectedChanges.filter(
    (file) => !protectedFileHashes.some((entry) => entry.file === file && entry.changed),
  );
  const selfProtectedChanges = allowedProtectedChanges.filter(
    (file) => file === 'scripts/check-release-guardrails.mjs' || file === 'scripts/deploy-reviewed-release.mjs',
  );
  const releaseGuardSelfChangePassed = selfProtectedChanges.length === 0 || parsed.releaseGuardChangeAcknowledged;
  const protectedRuntimePassed = unapprovedProtectedChanges.length === 0
    && invalidProtectedFiles.length === 0
    && invalidProtectedChangeApprovals.length === 0
    && protectedChangeApprovalsOutsideScope.length === 0
    && unusedProtectedChangeApprovals.length === 0
    && releaseGuardSelfChangePassed;
  checks.protectedRuntime = {
    baseline: protectedBaseline,
    explicitlyApprovedChanges: allowedProtectedChanges,
    invalidApprovals: invalidProtectedChangeApprovals,
    approvalsOutsideReleaseScope: protectedChangeApprovalsOutsideScope,
    unusedApprovals: unusedProtectedChangeApprovals,
    selfProtectedChanges,
    releaseGuardChangeAcknowledged: parsed.releaseGuardChangeAcknowledged,
    files: protectedFileHashes,
    passed: protectedRuntimePassed,
  };
  if (unapprovedProtectedChanges.length > 0 || invalidProtectedFiles.length > 0) {
    failures.push(`Chránené runtime súbory sa zmenili bez osobitného schválenia alebo chýbajú: ${[
      ...unapprovedProtectedChanges,
      ...invalidProtectedFiles,
    ].map((entry) => entry.file).join(', ')}.`);
  }
  if (invalidProtectedChangeApprovals.length > 0) {
    failures.push(`Schválenie citlivej zmeny odkazuje na nechránené súbory: ${invalidProtectedChangeApprovals.join(', ')}.`);
  }
  if (protectedChangeApprovalsOutsideScope.length > 0) {
    failures.push(`Schválené citlivé zmeny chýbajú v hlavnom allowliste: ${protectedChangeApprovalsOutsideScope.join(', ')}.`);
  }
  if (unusedProtectedChangeApprovals.length > 0) {
    failures.push(`Schválenie citlivej zmeny obsahuje nezmenené súbory: ${unusedProtectedChangeApprovals.join(', ')}.`);
  }
  if (!releaseGuardSelfChangePassed) {
    failures.push(`Zmena release ochrany vyžaduje ${RELEASE_GUARD_CHANGE_ACKNOWLEDGEMENT}.`);
  }

  try {
    const baselinePackage = readJsonAt(repo, protectedBaseline, 'package.json');
    const currentPackage = readJsonAt(repo, actualHead, 'package.json');
    const protectedPackageKeys = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides', 'engines', 'packageManager'];
    const changedKeys = protectedPackageKeys.filter(
      (key) => JSON.stringify(baselinePackage[key] ?? null) !== JSON.stringify(currentPackage[key] ?? null),
    );
    checks.packageRuntime = { keys: protectedPackageKeys, changedKeys, passed: changedKeys.length === 0 };
    if (changedKeys.length > 0) {
      failures.push(`Balíky alebo runtime konfigurácia v package.json sa zmenili: ${changedKeys.join(', ')}.`);
    }
    const baselineScripts = baselinePackage?.scripts ?? {};
    const currentScripts = currentPackage?.scripts ?? {};
    const changedScriptNames = [...new Set([...Object.keys(baselineScripts), ...Object.keys(currentScripts)])]
      .filter((name) => baselineScripts[name] !== currentScripts[name])
      .sort();
    const unexpectedScriptChanges = changedScriptNames.filter((name) => !APPROVED_CHANGED_SCRIPT_NAMES.has(name));
    checks.reviewedPackageScriptChanges = {
      allowedNames: [...APPROVED_CHANGED_SCRIPT_NAMES].sort(),
      changedNames: changedScriptNames,
      unexpectedNames: unexpectedScriptChanges,
      passed: unexpectedScriptChanges.length === 0,
    };
    if (unexpectedScriptChanges.length > 0) {
      failures.push(`package.json mení neschválené skripty: ${unexpectedScriptChanges.join(', ')}.`);
    }
    checks.releaseGuardCommand = {
      expected: RELEASE_GUARD_COMMAND,
      actual: currentPackage?.scripts?.['release:guard'] ?? null,
      passed: currentPackage?.scripts?.['release:guard'] === RELEASE_GUARD_COMMAND,
    };
    if (!checks.releaseGuardCommand.passed) {
      failures.push('package.json neobsahuje očakávaný fail-closed príkaz release:guard.');
    }
    checks.reviewedDeployCommand = {
      expected: REVIEWED_DEPLOY_COMMAND,
      actual: currentPackage?.scripts?.deploy ?? null,
      passed: currentPackage?.scripts?.deploy === REVIEWED_DEPLOY_COMMAND,
    };
    if (!checks.reviewedDeployCommand.passed) {
      failures.push('package.json neobsahuje očakávaný povinný príkaz deploy s release guardom.');
    }
    const alternateDeployScripts = Object.entries(currentPackage?.scripts ?? {})
      .filter(([name, command]) => !APPROVED_RELEASE_SCRIPT_NAMES.has(name) && typeof command === 'string' && (
        /(?:^|[:_-])(?:deploy|promote|rollback|publish|release)(?:$|[:_-])/i.test(name)
        || (!APPROVED_NON_DEPLOYMENT_COMMANDS.has(command) && /(?:deploy|promote|rollback|publish|release)/i.test(command))
        || /(?:^|\s)(?:npx\s+)?vercel(?:@\S+)?\s+(?:deploy|promote|rollback)\b/i.test(command)
        || /(?:^|\s)vercel(?:@\S+)?\s+--prod\b/i.test(command)
        || command.includes('scripts/deploy-reviewed-release.mjs')
      ))
      .map(([name]) => name);
    checks.singleReviewedDeployEntrypoint = {
      scripts: alternateDeployScripts,
      passed: alternateDeployScripts.length === 0,
    };
    if (!checks.singleReviewedDeployEntrypoint.passed) {
      failures.push(`package.json obsahuje ďalšie obchádzateľné deploy vstupy: ${alternateDeployScripts.join(', ')}.`);
    }
  } catch (error) {
    checks.packageRuntime = { passed: false, error: error instanceof Error ? error.message : String(error) };
    failures.push('Nepodarilo sa porovnať chránené časti package.json.');
  }

  try {
    const vercelConfig = readJsonAt(repo, actualHead, 'vercel.json');
    checks.vercelGitDeployment = {
      expected: false,
      actual: vercelConfig?.git?.deploymentEnabled ?? null,
      passed: vercelConfig?.git?.deploymentEnabled === false,
    };
    if (!checks.vercelGitDeployment.passed) {
      failures.push('vercel.json musí mať git.deploymentEnabled nastavené presne na false.');
    }
  } catch (error) {
    checks.vercelGitDeployment = { passed: false, error: error instanceof Error ? error.message : String(error) };
    failures.push('Nepodarilo sa overiť vercel.json.');
  }

  checks.rollback = {
    sourceSha: rollbackSha,
    deployment: rollbackDeployment,
    sourceIsAncestor: true,
    passed: true,
  };
  checks.previousProduction = {
    deployment: previousProductionDeployment,
    purpose: 'Nemenný bod produkcie overený bezprostredne pred povýšením kandidáta.',
    passed: true,
  };
  checks.vercelIamBoundary = {
    acknowledged: parsed.vercelIamBoundaryAcknowledged,
    repositoryEnforcement: 'git.deploymentEnabled=false + jediný npm deploy vstup',
    externalBoundary: 'Vercel dashboard/API/deploy hooks/tokens musia byť obmedzené cez IAM a ochranu produkčného prostredia',
    passed: parsed.vercelIamBoundaryAcknowledged,
  };

  const manifest = {
    generatedAt: new Date().toISOString(),
    currentHead: actualHead,
    currentBranch: actualBranch,
    protectedBaseline,
    expectedHead,
    rollback: {
      sourceSha: rollbackSha,
      deployment: rollbackDeployment,
    },
    previousProduction: { deployment: previousProductionDeployment },
    checks,
    result: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
  };

  const { generatedAt: _generatedAt, ...stableManifest } = manifest;
  const releaseStateDigest = hash(JSON.stringify(stableManifest));
  manifest.releaseStateDigest = releaseStateDigest;

  const manifestSnapshot = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestDigest = hash(manifestSnapshot);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, manifestSnapshot, 'utf8');

  if (failures.length > 0) throw new Error(`Release guard FAIL: ${failures.join(' ')}`);
  return { branch: actualBranch, manifest: output, manifestDigest, manifestSnapshot, releaseStateDigest, sha: actualHead };
}

const isDirectInvocation = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectInvocation) {
  runReleaseGuard()
    .then((result) => {
      console.log(`PASS: schválený release ${result.sha} na vetve ${result.branch}. Manifest: ${result.manifest}`);
    })
    .catch((error) => {
      console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
