import { createHash } from 'node:crypto';

/** A single reviewed dependency change; this is not a generic dependency bypass. */
export const JOB_WORKSPACE_RUNTIME_EXCEPTION_FLAG = '--allow-reviewed-job-workspace-pdfjs-0913';
export const JOB_WORKSPACE_RUNTIME_EXCEPTION = Object.freeze({
  id: 'job-workspace-pdfjs-0913-v1',
  protectedBaseline: '366d64930a0860edae7b005f4be2f504430cfe68',
  approvedSource: '0913c256ebd26a9522fc76731549f1c3f4cc7600',
  packageSha256: 'd8d238cd10296f0fb042fa24b6f0d302acac06c99ad2a72f1d151769990961cf',
  packageLockSha256: '0473042cc8834847dee1f9fd55e341451d1bc8a5685bc8b0bf9d71f265ea1d0b',
  dependency: Object.freeze({ name: 'pdfjs-dist', version: '6.4.299', change: 'add' }),
  allowedDescendantPaths: Object.freeze([
    'scripts/check-release-guardrails.mjs',
    'scripts/release-guardrails.test.mjs',
    'scripts/reviewed-job-workspace-release-exception.mjs',
    'scripts/reviewed-job-workspace-release-exception.test.mjs',
    'scripts/job-workspace-production-migration.mjs',
    'scripts/job-workspace-backup-drill.mjs',
    'docs/job-workspace-production-release-2026-10-27.md',
    'src/server/job-workspace-release-mode.ts',
    'src/server/job-workspace-feature.ts',
    'src/server/db.ts',
    'src/server/job-authority-delivery.ts',
    'src/server/job-mail-service.ts',
    'app/admin/(protected)/layout.tsx',
    'app/admin/(protected)/admin-topbar.tsx',
    'app/admin/(protected)/vyhladavanie/page.tsx',
    'app/admin/(protected)/vyhladavanie/search-workspace.tsx',
    'app/admin/(protected)/ponuky/page.tsx',
    'app/admin/(protected)/ponuky/rucna/page.tsx',
    'app/admin/(protected)/ponuky/rucna/[id]/page.tsx',
    'app/admin/(protected)/ponuky/rucna/actions.ts',
    'app/admin/(protected)/nastavenia/page.tsx',
    'app/admin/(protected)/nastavenia/job-settings-actions.ts',
    'app/admin/(protected)/nastavenia/gmail/page.tsx',
    'app/admin/(protected)/nastavenia/gmail/actions.ts',
    'app/admin/(protected)/zakazky/[id]/workspace-section.tsx',
    'app/admin/(protected)/zakazky/[id]/workspace-actions.ts',
    'app/admin/(protected)/zakazky/[id]/job-linked-actions.ts',
    'app/admin/(protected)/planovac/page.tsx',
    'app/api/admin/job-workspace/upload/route.ts',
    'app/api/admin/job-workspace/documents/[id]/route.ts',
    'scripts/job-workspace-feature.test.mjs',
    'scripts/job-workspace-fallback.local.integration.mjs',
    'docs/job-workspace-compatible-fallback-2026-10-27.md',
  ]),
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const protectedKeys = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides', 'engines', 'packageManager'];

/** Pure verifier; callers must obtain bytes/ancestry/paths from Git, never working files or CLI overrides. */
export function evaluateJobWorkspaceRuntimeException(input) {
  const approved = JOB_WORKSPACE_RUNTIME_EXCEPTION;
  const errors = [];
  const changedKeys = protectedKeys.filter((key) => JSON.stringify(input.baselinePackage[key] ?? null) !== JSON.stringify(input.currentPackage[key] ?? null));
  const result = {
    id: approved.id,
    flag: JOB_WORKSPACE_RUNTIME_EXCEPTION_FLAG,
    requested: input.optedIn === true,
    applied: false,
    approvedBaseline: approved.protectedBaseline,
    approvedSource: approved.approvedSource,
    approvedDependency: approved.dependency,
    approvedPackageSha256: approved.packageSha256,
    approvedPackageLockSha256: approved.packageLockSha256,
    allowedDescendantPaths: approved.allowedDescendantPaths,
    descendantChangedPaths: input.descendantChangedPaths ?? [],
    changedKeys,
    errors,
    passed: false,
  };
  if (!input.optedIn) {
    errors.push(`Schválená runtime výnimka sa nepoužila: chýba ${JOB_WORKSPACE_RUNTIME_EXCEPTION_FLAG}.`);
    return result;
  }
  if (changedKeys.length === 0) errors.push('Nepoužitý príznak runtime výnimky: chránené runtime kľúče sa nezmenili.');
  if (input.protectedBaseline !== approved.protectedBaseline) errors.push('Runtime výnimka vyžaduje pôvodnú pevnú schválenú baseline.');
  if (input.head !== approved.approvedSource && input.sourceIsAncestor !== true) errors.push('HEAD nie je schválený zdroj ani jeho overený potomok.');
  if (input.head === approved.approvedSource && (input.descendantChangedPaths ?? []).length > 0) errors.push('Presný schválený zdroj nemôže mať následné bezpečnostné zmeny.');
  if (input.head !== approved.approvedSource && (input.descendantChangedPaths ?? []).length === 0) errors.push('Potomok schváleného zdroja nemá žiadnu povolenú bezpečnostnú zmenu.');
  const unexpected = (input.descendantChangedPaths ?? []).filter((file) => !approved.allowedDescendantPaths.includes(file));
  if (unexpected.length > 0) errors.push(`Potomok mení súbory mimo schválenej bezpečnostnej etapy: ${unexpected.join(', ')}.`);
  const hashes = {
    sourcePackage: sha256(input.sourcePackageBytes),
    package: sha256(input.currentPackageBytes),
    sourcePackageLock: sha256(input.sourcePackageLockBytes),
    packageLock: sha256(input.currentPackageLockBytes),
  };
  result.gitBlobSha256 = hashes;
  if (hashes.sourcePackage !== approved.packageSha256 || hashes.package !== approved.packageSha256) errors.push('Git blob package.json nezodpovedá presne schválenej verzii.');
  if (hashes.sourcePackageLock !== approved.packageLockSha256 || hashes.packageLock !== approved.packageLockSha256) errors.push('Git blob package-lock.json nezodpovedá presne schválenej verzii.');
  if (changedKeys.length !== 1 || changedKeys[0] !== 'dependencies') errors.push('Výnimka povoľuje iba jednu presnú zmenu dependencies.');
  const baselineDependencies = input.baselinePackage.dependencies ?? {};
  const currentDependencies = input.currentPackage.dependencies ?? {};
  const changedDependencies = [...new Set([...Object.keys(baselineDependencies), ...Object.keys(currentDependencies)])]
    .filter((name) => baselineDependencies[name] !== currentDependencies[name]);
  if (changedDependencies.length !== 1 || changedDependencies[0] !== approved.dependency.name
    || Object.hasOwn(baselineDependencies, approved.dependency.name)
    || currentDependencies[approved.dependency.name] !== approved.dependency.version) {
    errors.push('Výnimka povoľuje iba pridanie pdfjs-dist presne vo verzii 6.4.299.');
  }
  try {
    const lock = JSON.parse(Buffer.from(input.currentPackageLockBytes).toString('utf8'));
    if (lock.packages?.['']?.dependencies?.['pdfjs-dist'] !== approved.dependency.version
      || lock.packages?.['node_modules/pdfjs-dist']?.version !== approved.dependency.version) {
      errors.push('Lockfile neobsahuje presnú schválenú priamu a uzamknutú verziu pdfjs-dist.');
    }
  } catch {
    errors.push('Schválený lockfile sa nepodarilo prečítať.');
  }
  result.passed = errors.length === 0;
  result.applied = result.passed;
  return result;
}
