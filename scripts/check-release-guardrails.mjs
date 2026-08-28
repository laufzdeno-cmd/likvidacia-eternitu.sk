import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const DEFAULT_PROTECTED_FILES = [
  'app/api/dopyt/route.ts',
  'app/api/lead/route.ts',
  'app/api/marketing-consent/revoke/route.ts',
  'app/api/cron/meta-capi/route.ts',
  'app/facebook-cenova-ponuka/route.ts',
  'app/homepage-critical-client.tsx',
  'app/landing-client.tsx',
  'app/meta-pixel.tsx',
  'app/cookie-consent-controls.tsx',
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
  'next.config.mjs',
  'vercel.json',
  'package-lock.json',
];

function readArgument(name) {
  const inlineArgument = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inlineArgument) return inlineArgument.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function readArguments(name) {
  return process.argv.flatMap((value, index) => {
    if (value.startsWith(`${name}=`)) return [value.slice(name.length + 1)];
    return value === name ? [process.argv[index + 1]] : [];
  }).filter(Boolean);
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileAt(repo, ref, file) {
  return execFileSync('git', ['-C', repo, 'show', `${ref}:${file}`], { encoding: 'buffer' });
}

function rollbackMetadataFromDocument(repo) {
  let markdown;
  try {
    markdown = execFileSync('git', ['-C', repo, 'show', 'HEAD:docs/RELEASE_BASELINE.md'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  const rollbackSha = markdown.match(/## Verified rollback[\s\S]*?Source SHA:\s*`?([0-9a-f]{7,40})`?/i)?.[1];
  const rollbackDeployment = markdown.match(/## Verified rollback[\s\S]*?Deployment:\s*`?([^`\s]+)`?/i)?.[1];
  return { rollbackSha, rollbackDeployment };
}

function isPathInside(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent !== '' && !pathFromParent.startsWith('..') && !pathFromParent.includes(':');
}

function validateRollbackDeployment(value) {
  if (!value) return null;
  if (!/^dpl_[A-Za-z0-9]+$/.test(value)) {
    throw new Error('Rollback deployment musí mať formát dpl_<alphanumeric>.');
  }
  return value;
}

function validateGitCommit(repo, value, label) {
  if (!value || !/^[0-9a-f]{7,40}$/i.test(value)) {
    throw new Error(`${label} musí byť Git SHA so 7 až 40 hexadecimálnymi znakmi.`);
  }
  try {
    return git(repo, ['rev-parse', '--verify', `${value}^{commit}`]);
  } catch {
    throw new Error(`${label} neodkazuje na existujúci Git commit.`);
  }
}

async function main() {
  const requestedRepo = resolve(readArgument('--repo') || process.cwd());
  const repo = git(requestedRepo, ['rev-parse', '--show-toplevel']);
  const manifestDirectory = resolve(repo, 'test-results');
  const output = resolve(manifestDirectory, 'release-manifest.json');
  if (!isPathInside(manifestDirectory, output)) {
    throw new Error('Cesta manifestu musí zostať v test-results/.');
  }
  await rm(output, { force: true });

  if (process.argv.some((value) => value === '--output' || value.startsWith('--output='))) {
    throw new Error('Vlastná cesta manifestu nie je povolená. Používa sa iba test-results/release-manifest.json.');
  }

  const baselineDocument = rollbackMetadataFromDocument(repo);
  const protectedBaseline = validateGitCommit(repo, readArgument('--protected-baseline'), '--protected-baseline');
  const expectedHead = validateGitCommit(repo, readArgument('--expected-head'), '--expected-head');
  const rollbackShaInput = readArgument('--rollback-sha') || baselineDocument?.rollbackSha;
  const rollbackSha = rollbackShaInput ? validateGitCommit(repo, rollbackShaInput, '--rollback-sha') : null;
  const allowedFiles = new Set(readArguments('--allow'));
  const protectedFiles = readArguments('--protected');
  const activeProtectedFiles = protectedFiles.length > 0 ? protectedFiles : DEFAULT_PROTECTED_FILES;
  const rollbackDeployment = validateRollbackDeployment(readArgument('--rollback-deployment') || baselineDocument?.rollbackDeployment);
  const failures = [];
  const checks = {};

  const head = git(repo, ['rev-parse', 'HEAD']);
  checks.expectedHead = { expected: expectedHead, actual: head, passed: head === expectedHead };
  if (!checks.expectedHead.passed) failures.push(`HEAD ${head} nezodpovedá očakávanému SHA ${expectedHead}.`);

  const status = git(repo, ['status', '--porcelain=v1']);
  checks.cleanWorkingTree = { passed: status === '', entries: status ? status.split('\n') : [] };
  if (!checks.cleanWorkingTree.passed) failures.push('Git working tree nie je čistý.');

  const changedFiles = git(repo, ['diff', '--name-only', `${protectedBaseline}..${head}`]).split('\n').filter(Boolean);
  const unexpectedFiles = changedFiles.filter((file) => !allowedFiles.has(file));
  const trackedTestResults = git(repo, ['ls-files', '--', 'test-results']).split('\n').filter(Boolean);
  checks.allowedReleaseScope = { allowedFiles: [...allowedFiles], changedFiles, unexpectedFiles, passed: unexpectedFiles.length === 0 };
  if (unexpectedFiles.length > 0) failures.push(`Release obsahuje nepovolené súbory: ${unexpectedFiles.join(', ')}.`);
  checks.noTrackedTestResults = { files: trackedTestResults, passed: trackedTestResults.length === 0 };
  if (trackedTestResults.length > 0) failures.push('test-results nesmie obsahovať žiadne trackované súbory.');

  const protectedFileHashes = activeProtectedFiles.map((file) => {
    try {
      const baselineHash = hash(fileAt(repo, protectedBaseline, file));
      const currentHash = hash(fileAt(repo, head, file));
      return { file, baselineHash, currentHash, passed: baselineHash === currentHash };
    } catch (error) {
      return { file, passed: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  const changedProtectedFiles = protectedFileHashes.filter((entry) => !entry.passed);
  checks.protectedRuntime = { baseline: protectedBaseline, files: protectedFileHashes, passed: changedProtectedFiles.length === 0 };
  if (changedProtectedFiles.length > 0) failures.push(`Chránené runtime súbory sa zmenili: ${changedProtectedFiles.map((entry) => entry.file).join(', ')}.`);

  try {
    const baselinePackage = JSON.parse(fileAt(repo, protectedBaseline, 'package.json').toString('utf8'));
    const currentPackage = JSON.parse(fileAt(repo, head, 'package.json').toString('utf8'));
    const protectedPackageKeys = ['dependencies', 'devDependencies', 'overrides', 'engines'];
    const packageDiff = protectedPackageKeys.filter((key) => JSON.stringify(baselinePackage[key] || {}) !== JSON.stringify(currentPackage[key] || {}));
    checks.packageRuntime = { keys: protectedPackageKeys, changedKeys: packageDiff, passed: packageDiff.length === 0 };
    if (packageDiff.length > 0) failures.push(`Balíky alebo runtime konfigurácia v package.json sa zmenili: ${packageDiff.join(', ')}.`);
  } catch (error) {
    checks.packageRuntime = { passed: false, error: error instanceof Error ? error.message : String(error) };
    failures.push('Nepodarilo sa porovnať chránené časti package.json.');
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    currentHead: head,
    protectedBaseline,
    expectedHead,
    rollback: {
      sourceSha: rollbackSha,
      deployment: rollbackDeployment,
    },
    checks,
    result: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
  };

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  if (failures.length > 0) throw new Error(`Release guard FAIL: ${failures.join(' ')}`);
  console.log(`PASS: release guard. Manifest: ${output}`);
}

void main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
