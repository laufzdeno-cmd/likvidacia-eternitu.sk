import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluateJobWorkspaceRuntimeException, JOB_WORKSPACE_RUNTIME_EXCEPTION, JOB_WORKSPACE_RUNTIME_EXCEPTION_FLAG } from './reviewed-job-workspace-release-exception.mjs';

const approved = JOB_WORKSPACE_RUNTIME_EXCEPTION;
const gitBlob = (ref, file) => execFileSync('git', ['show', `${ref}:${file}`], { windowsHide: true });
function inputs(overrides = {}) {
  const sourcePackageBytes = gitBlob(approved.approvedSource, 'package.json');
  const sourcePackageLockBytes = gitBlob(approved.approvedSource, 'package-lock.json');
  return {
    optedIn: true,
    protectedBaseline: approved.protectedBaseline,
    head: approved.approvedSource,
    sourceIsAncestor: true,
    descendantChangedPaths: [],
    baselinePackage: JSON.parse(gitBlob(approved.protectedBaseline, 'package.json')),
    currentPackage: JSON.parse(sourcePackageBytes),
    sourcePackageBytes,
    currentPackageBytes: sourcePackageBytes,
    sourcePackageLockBytes,
    currentPackageLockBytes: sourcePackageLockBytes,
    ...overrides,
  };
}
function fails(input, pattern) {
  const result = evaluateJobWorkspaceRuntimeException(input);
  assert.equal(result.passed, false);
  assert.equal(result.applied, false);
  assert.match(result.errors.join('\n'), pattern);
}

test('one immutable reviewed pdfjs exception binds the original baseline, approved source and both Git blobs', () => {
  const result = evaluateJobWorkspaceRuntimeException(inputs());
  assert.equal(result.passed, true);
  assert.equal(result.applied, true);
  assert.equal(result.flag, JOB_WORKSPACE_RUNTIME_EXCEPTION_FLAG);
  assert.deepEqual(result.changedKeys, ['dependencies']);
  assert.equal(result.gitBlobSha256.package, approved.packageSha256);
  assert.equal(result.gitBlobSha256.packageLock, approved.packageLockSha256);
  assert.equal(Object.isFrozen(approved), true);
  assert.equal(Object.isFrozen(approved.allowedDescendantPaths), true);
  assert.equal(Object.isFrozen(approved.dependency), true);
});

test('missing opt-in and an unused opt-in fail closed', () => {
  fails(inputs({ optedIn: false }), /chýba --allow-reviewed-job-workspace-pdfjs-0913/);
  const unchanged = inputs();
  unchanged.baselinePackage = structuredClone(unchanged.currentPackage);
  fails(unchanged, /Nepoužitý príznak/);
});

test('package and lock mutations are rejected even if their parsed meaning is unchanged', () => {
  for (const field of ['sourcePackageBytes', 'currentPackageBytes']) {
    const input = inputs();
    input[field] = Buffer.concat([input[field], Buffer.from('\n')]);
    fails(input, /Git blob package\.json/);
  }
  for (const field of ['sourcePackageLockBytes', 'currentPackageLockBytes']) {
    const input = inputs();
    input[field] = Buffer.concat([input[field], Buffer.from(' ')]);
    fails(input, /Git blob package-lock\.json/);
  }
});

test('another dependency, version or runtime configuration cannot reuse the reviewed exception', () => {
  for (const mutate of [
    (pkg) => { pkg.dependencies['pdfjs-dist'] = '6.4.300'; },
    (pkg) => { pkg.dependencies['unreviewed-runtime'] = '1.0.0'; },
    (pkg) => { pkg.engines = { node: '99' }; },
    (pkg) => { pkg.devDependencies.typescript = '99.0.0'; },
  ]) {
    const input = inputs();
    mutate(input.currentPackage);
    input.currentPackageBytes = Buffer.from(JSON.stringify(input.currentPackage));
    fails(input, /Git blob package\.json|iba jednu presnú zmenu|iba pridanie pdfjs-dist/);
  }
});

test('the immutable baseline cannot move and unrelated history or unreviewed paths are rejected', () => {
  fails(inputs({ protectedBaseline: approved.approvedSource }), /pevnú schválenú baseline/);
  fails(inputs({ head: 'a'.repeat(40), sourceIsAncestor: false, descendantChangedPaths: ['scripts/check-release-guardrails.mjs'] }), /overený potomok/);
  fails(inputs({ head: 'a'.repeat(40), descendantChangedPaths: ['app/page.tsx'] }), /mimo schválenej bezpečnostnej etapy/);
  fails(inputs({ head: 'a'.repeat(40), descendantChangedPaths: ['package.json'] }), /mimo schválenej bezpečnostnej etapy/);
  fails(inputs({ head: 'a'.repeat(40), descendantChangedPaths: ['package-lock.json'] }), /mimo schválenej bezpečnostnej etapy/);
  fails(inputs({ head: 'a'.repeat(40), descendantChangedPaths: [] }), /nemá žiadnu povolenú bezpečnostnú zmenu/);
});

test('compatible fallback and active descendants retain original dependency hashes and expose bounded changes in the manifest record', () => {
  const paths = ['src/server/job-workspace-release-mode.ts', 'scripts/check-release-guardrails.mjs', 'scripts/job-workspace-production-migration.mjs', 'scripts/job-workspace-backup-drill.mjs'];
  const result = evaluateJobWorkspaceRuntimeException(inputs({ head: 'b'.repeat(40), descendantChangedPaths: paths }));
  assert.equal(result.passed, true);
  assert.equal(result.approvedBaseline, approved.protectedBaseline);
  assert.equal(result.approvedSource, approved.approvedSource);
  assert.deepEqual(result.descendantChangedPaths, paths);
  assert.equal(result.approvedDependency.name, 'pdfjs-dist');
  assert.equal(result.approvedDependency.version, '6.4.299');
});

test('the real approved Git tree produces an explicit PASS manifest only with the opt-in', () => {
  const sourceRepo = fileURLToPath(new URL('..', import.meta.url));
  const fixture = mkdtempSync(join(tmpdir(), 'astana-reviewed-pdfjs-guard-'));
  const git = (args) => execFileSync('git', ['-C', fixture, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore','pipe','pipe'] }).trim();
  try {
    execFileSync('git', ['clone', '--shared', '--no-checkout', sourceRepo, fixture], { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    git(['checkout', '-b', 'codex/reviewed-pdfjs-fixture', approved.approvedSource]);
    const changed = git(['diff','--name-only',`${approved.protectedBaseline}..${approved.approvedSource}`]).split('\n').filter(Boolean);
    const protectedChanged = new Set(['src/server/db.ts','src/server/mail.ts','src/server/types.ts','next.config.mjs','package-lock.json']);
    const args = ['--expected-head',approved.approvedSource,'--expected-branch','codex/reviewed-pdfjs-fixture','--protected-baseline',approved.protectedBaseline,'--rollback-sha',approved.protectedBaseline,'--rollback-deployment','dpl_IsolatedRollback0913','--previous-production-deployment','dpl_IsolatedPrevious0913','--acknowledge-vercel-iam-boundary'];
    for (const file of changed) { args.push('--allow',file); if(protectedChanged.has(file))args.push('--allow-protected-change',file); }
    const guard=fileURLToPath(new URL('./check-release-guardrails.mjs',import.meta.url));
    const missing=spawnSync(process.execPath,[guard,...args],{cwd:fixture,encoding:'utf8',windowsHide:true});
    assert.notEqual(missing.status,0);
    assert.match(missing.stderr,/Balíky alebo runtime konfigurácia/);
    const withFlag=spawnSync(process.execPath,[guard,...args,JOB_WORKSPACE_RUNTIME_EXCEPTION_FLAG],{cwd:fixture,encoding:'utf8',windowsHide:true});
    assert.equal(withFlag.status,0,withFlag.stderr);
    const manifest=JSON.parse(readFileSync(join(fixture,'test-results','release-manifest.json'),'utf8'));
    assert.equal(manifest.result,'PASS');
    assert.equal(manifest.protectedBaseline,approved.protectedBaseline);
    assert.equal(manifest.checks.packageRuntime.reviewedException,approved.id);
    assert.equal(manifest.checks.reviewedRuntimeException.applied,true);
    assert.equal(manifest.checks.reviewedRuntimeException.gitBlobSha256.packageLock,approved.packageLockSha256);
    assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
  } finally {
    if(!resolve(fixture).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary fixture cleanup refused.');
    rmSync(fixture,{recursive:true,force:true});
  }
});
