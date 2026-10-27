import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const guardPath = resolve('scripts/check-release-guardrails.mjs');
const mandatoryProtectedFiles = [
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
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.quiet ? 'ignore' : 'pipe'],
    windowsHide: true,
  }).trim();
}

function write(repo, path, content) {
  const destination = join(repo, ...path.split('/'));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content, 'utf8');
}

function commitAll(repo, message) {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

function createRepository() {
  const repo = mkdtempSync(join(tmpdir(), 'astana-release-guard-v2-'));
  git(repo, ['init', '-b', 'codex/approved-release']);
  git(repo, ['config', 'user.email', 'release-test@example.invalid']);
  git(repo, ['config', 'user.name', 'Release Guard Test']);
  git(repo, ['config', 'commit.gpgSign', 'false']);
  write(repo, '.gitignore', 'test-results/\n');
  write(repo, 'package.json', `${JSON.stringify({
    private: true,
    engines: { node: '>=22' },
    dependencies: { next: '16.2.6' },
    devDependencies: { typescript: '5.9.3' },
    scripts: {
      deploy: 'node scripts/deploy-reviewed-release.mjs',
      'release:guard': 'node scripts/check-release-guardrails.mjs',
      'test:map-locality': 'node --import tsx --test scripts/published-realization-locality-points.behavior.mjs',
    },
  }, null, 2)}\n`);
  write(repo, 'package-lock.json', '{"lockfileVersion":3}\n');
  write(repo, 'vercel.json', `${JSON.stringify({ framework: 'nextjs', git: { deploymentEnabled: false } }, null, 2)}\n`);
  write(repo, 'runtime/protected.ts', 'export const protectedValue = true;\n');
  for (const file of mandatoryProtectedFiles) {
    if (!existsSync(join(repo, ...file.split('/')))) write(repo, file, `protected fixture: ${file}\n`);
  }
  write(repo, 'docs/release-note.md', 'rollback source\n');
  const rollbackSha = commitAll(repo, 'verified rollback');

  write(repo, 'docs/release-note.md', 'protected baseline\n');
  const protectedBaseline = commitAll(repo, 'protected baseline');

  write(repo, 'docs/release-note.md', 'approved candidate\n');
  const expectedHead = commitAll(repo, 'approved candidate');
  return { expectedHead, protectedBaseline, repo, rollbackSha };
}

function approvedArguments(fixture, overrides = {}) {
  return [
    '--expected-head', overrides.expectedHead ?? fixture.expectedHead,
    '--expected-branch', overrides.expectedBranch ?? 'codex/approved-release',
    '--protected-baseline', overrides.protectedBaseline ?? fixture.protectedBaseline,
    '--rollback-sha', overrides.rollbackSha ?? fixture.rollbackSha,
    '--rollback-deployment', overrides.rollbackDeployment ?? 'dpl_ReleaseGuard123',
    '--previous-production-deployment', overrides.previousProductionDeployment ?? 'dpl_PreviousProduction123',
    '--acknowledge-vercel-iam-boundary',
    '--allow', overrides.allow ?? 'docs/release-note.md',
    '--protected', overrides.protected ?? 'runtime/protected.ts',
  ];
}

function runGuard(repo, args = []) {
  return spawnSync(process.execPath, [guardPath, ...args], {
    cwd: repo,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function readManifest(repo) {
  return JSON.parse(readFileSync(join(repo, 'test-results', 'release-manifest.json'), 'utf8'));
}

function withRepository(callback) {
  const fixture = createRepository();
  try {
    callback(fixture);
  } finally {
    rmSync(fixture.repo, { recursive: true, force: true });
  }
}

function assertFails(result, pattern) {
  assert.notEqual(result.status, 0, `guard unexpectedly passed:\n${result.stdout}`);
  assert.match(result.stderr, /^FAIL:/);
  if (pattern) assert.match(result.stderr, pattern);
}

test('passes only for exact reviewed inputs and writes a PASS manifest under ignored test-results', () => {
  withRepository((fixture) => {
    const result = runGuard(fixture.repo, approvedArguments(fixture));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^PASS: schválený release [0-9a-f]{40} na vetve codex\/approved-release\./);
    const manifest = readManifest(fixture.repo);
    assert.equal(manifest.result, 'PASS');
    assert.equal(manifest.currentHead, fixture.expectedHead);
    assert.equal(manifest.protectedBaseline, fixture.protectedBaseline);
    assert.equal(manifest.rollback.sourceSha, fixture.rollbackSha);
    assert.equal(manifest.rollback.deployment, 'dpl_ReleaseGuard123');
    assert.equal(manifest.previousProduction.deployment, 'dpl_PreviousProduction123');
    assert.equal(manifest.checks.vercelIamBoundary.passed, true);
    assert.deepEqual(manifest.checks.allowedReleaseScope.changedFiles, ['docs/release-note.md']);
    assert.equal(git(fixture.repo, ['status', '--porcelain=v1', '--untracked-files=all']), '');
  });
});

test('fails closed for missing, malformed, duplicated and unknown approval arguments', () => {
  withRepository((fixture) => {
    const valid = approvedArguments(fixture);
    const baselineIndex = valid.indexOf('--protected-baseline');
    const cases = [
      [],
      valid.filter((argument) => argument !== '--acknowledge-vercel-iam-boundary'),
      valid.filter((_, index) => index !== baselineIndex && index !== baselineIndex + 1),
      valid.with(1, 'abc'),
      [...valid, '--expected-head', fixture.expectedHead],
      [...valid, '--allow', 'docs/release-note.md'],
      [...valid, '--allow-anything', 'yes'],
      [...valid, '--output', 'outside.json'],
    ];
    for (const args of cases) assertFails(runGuard(fixture.repo, args));
  });
});

test('rejects a reviewed runtime exception flag when no dependency exception is needed', () => {
  withRepository((fixture) => {
    const result=runGuard(fixture.repo,[...approvedArguments(fixture),'--allow-reviewed-job-workspace-pdfjs-0913']);
    assertFails(result,/Nepoužitý príznak runtime výnimky/);
    const manifest=readManifest(fixture.repo);
    assert.equal(manifest.checks.packageRuntime.passed,false);
    assert.equal(manifest.checks.reviewedRuntimeException.applied,false);
    assert.equal(manifest.checks.reviewedRuntimeException.requested,true);
  });
});

test('rejects dirty tracked files and untracked files', () => {
  withRepository((fixture) => {
    write(fixture.repo, 'docs/release-note.md', 'dirty\n');
    assertFails(runGuard(fixture.repo, approvedArguments(fixture)), /pracovný strom nie je čistý/);
  });
  withRepository((fixture) => {
    write(fixture.repo, 'untracked.txt', 'untracked\n');
    assertFails(runGuard(fixture.repo, approvedArguments(fixture)), /pracovný strom nie je čistý/);
  });
});

test('rejects a different HEAD, branch and detached HEAD', () => {
  withRepository((fixture) => {
    write(fixture.repo, 'docs/second.md', 'different commit\n');
    commitAll(fixture.repo, 'different head');
    assertFails(runGuard(fixture.repo, approvedArguments(fixture)), /nezodpovedá očakávanému SHA/);
  });
  withRepository((fixture) => {
    assertFails(
      runGuard(fixture.repo, approvedArguments(fixture, { expectedBranch: 'codex/other-release' })),
      /nezodpovedá schválenej vetve/,
    );
  });
  withRepository((fixture) => {
    git(fixture.repo, ['checkout', '--detach']);
    assertFails(runGuard(fixture.repo, approvedArguments(fixture)), /odpojený od vetvy/);
  });
});

test('requires a full protected baseline and rejects a baseline outside HEAD ancestry', () => {
  withRepository((fixture) => {
    const valid = approvedArguments(fixture);
    const marker = valid.indexOf('--protected-baseline');
    const missing = valid.filter((_, index) => index !== marker && index !== marker + 1);
    assertFails(runGuard(fixture.repo, missing), /Chýba povinný parameter --protected-baseline/);
    assertFails(
      runGuard(fixture.repo, approvedArguments(fixture, { protectedBaseline: fixture.protectedBaseline.slice(0, 12) })),
      /plný 40-znakový Git SHA/,
    );

    git(fixture.repo, ['checkout', '-b', 'unrelated', fixture.rollbackSha]);
    write(fixture.repo, 'docs/unrelated.md', 'unrelated\n');
    const unrelatedSha = commitAll(fixture.repo, 'unrelated baseline');
    git(fixture.repo, ['checkout', 'codex/approved-release']);
    assertFails(
      runGuard(fixture.repo, approvedArguments(fixture, { protectedBaseline: unrelatedSha })),
      /musí byť predkom očakávaného HEAD/,
    );
  });
});

test('enforces an exact normalized allowlist, including both paths of a rename', () => {
  withRepository((fixture) => {
    assertFails(
      runGuard(fixture.repo, approvedArguments(fixture, { allow: 'docs/other.md' })),
      /nepovolené súbory|Allowlist obsahuje súbory bez zmeny/,
    );
    assertFails(
      runGuard(fixture.repo, [...approvedArguments(fixture), '--allow', 'docs/unused.md']),
      /Allowlist obsahuje súbory bez zmeny/,
    );
    assertFails(
      runGuard(fixture.repo, approvedArguments(fixture, { allow: '../docs/release-note.md' })),
      /normalizovaná relatívna Git cesta/,
    );
  });

  withRepository((fixture) => {
    git(fixture.repo, ['mv', 'docs/release-note.md', 'docs/renamed-note.md']);
    const renamedHead = commitAll(fixture.repo, 'rename candidate');
    const oneSided = approvedArguments(fixture, { expectedHead: renamedHead, allow: 'docs/renamed-note.md' });
    assertFails(runGuard(fixture.repo, oneSided), /nepovolené súbory/);
    const complete = [...oneSided, '--allow', 'docs/release-note.md'];
    const result = runGuard(fixture.repo, complete);
    assert.equal(result.status, 0, result.stderr);
  });
});

test('rejects changed or missing protected runtime files', () => {
  withRepository((fixture) => {
    write(fixture.repo, 'runtime/protected.ts', 'export const protectedValue = false;\n');
    const changedHead = commitAll(fixture.repo, 'change protected runtime');
    const args = [...approvedArguments(fixture, { expectedHead: changedHead }), '--allow', 'runtime/protected.ts'];
    assertFails(runGuard(fixture.repo, args), /Chránené runtime súbory sa zmenili bez osobitného schválenia alebo chýbajú/);
    const manifest = readManifest(fixture.repo);
    assert.equal(manifest.result, 'FAIL');
    assert.equal(manifest.checks.protectedRuntime.passed, false);
  });
  withRepository((fixture) => {
    assertFails(
      runGuard(fixture.repo, approvedArguments(fixture, { protected: 'runtime/missing.ts' })),
      /Chránené runtime súbory sa zmenili bez osobitného schválenia alebo chýbajú/,
    );
  });
  withRepository((fixture) => {
    write(fixture.repo, 'scripts/published-realization-locality-points.behavior.mjs', 'throw new Error("deploy bypass");\n');
    const changedHead = commitAll(fixture.repo, 'alter approved non-deployment script');
    assertFails(
      runGuard(fixture.repo, [
        ...approvedArguments(fixture, { expectedHead: changedHead }),
        '--allow', 'scripts/published-realization-locality-points.behavior.mjs',
      ]),
      /Chránené runtime súbory sa zmenili bez osobitného schválenia alebo chýbajú/,
    );
  });
});

test('allows only exact separately approved protected changes', () => {
  withRepository((fixture) => {
    write(fixture.repo, 'runtime/protected.ts', 'export const protectedValue = false;\n');
    const changedHead = commitAll(fixture.repo, 'review protected runtime change');
    const args = [
      ...approvedArguments(fixture, { expectedHead: changedHead }),
      '--allow', 'runtime/protected.ts',
      '--allow-protected-change', 'runtime/protected.ts',
    ];
    const result = runGuard(fixture.repo, args);
    assert.equal(result.status, 0, result.stderr);
    const manifest = readManifest(fixture.repo);
    assert.deepEqual(manifest.checks.protectedRuntime.explicitlyApprovedChanges, ['runtime/protected.ts']);
    assert.equal(manifest.checks.protectedRuntime.passed, true);
  });
  withRepository((fixture) => {
    assertFails(
      runGuard(fixture.repo, [
        ...approvedArguments(fixture),
        '--allow-protected-change', 'runtime/protected.ts',
      ]),
      /nezmenené súbory|hlavnom allowliste/,
    );
  });
  withRepository((fixture) => {
    assertFails(
      runGuard(fixture.repo, [
        ...approvedArguments(fixture),
        '--allow-protected-change', 'docs/release-note.md',
      ]),
      /nechránené súbory/,
    );
  });
});

test('requires an extra acknowledgement when the release guard itself changes', () => {
  withRepository((fixture) => {
    write(fixture.repo, 'scripts/check-release-guardrails.mjs', 'reviewed release guard revision\n');
    const changedHead = commitAll(fixture.repo, 'review release guard change');
    const args = [
      ...approvedArguments(fixture, { expectedHead: changedHead }),
      '--allow', 'scripts/check-release-guardrails.mjs',
      '--allow-protected-change', 'scripts/check-release-guardrails.mjs',
    ];
    assertFails(runGuard(fixture.repo, args), /--acknowledge-release-guard-change/);
    const result = runGuard(fixture.repo, [...args, '--acknowledge-release-guard-change']);
    assert.equal(result.status, 0, result.stderr);
  });
});

test('allows only reviewed package script changes and rejects dependency and runtime configuration changes', () => {
  withRepository((fixture) => {
    const packageJson = JSON.parse(readFileSync(join(fixture.repo, 'package.json'), 'utf8'));
    packageJson.scripts['test:unit'] = 'node --test scripts/*.test.mjs';
    write(fixture.repo, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
    const scriptsHead = commitAll(fixture.repo, 'reviewed scripts only');
    const result = runGuard(fixture.repo, [
      ...approvedArguments(fixture, { expectedHead: scriptsHead }),
      '--allow', 'package.json',
    ]);
    assert.equal(result.status, 0, result.stderr);
  });

  for (const key of ['dependencies', 'devDependencies', 'engines', 'packageManager']) {
    withRepository((fixture) => {
      const packageJson = JSON.parse(readFileSync(join(fixture.repo, 'package.json'), 'utf8'));
      if (key === 'packageManager') packageJson[key] = 'npm@99.0.0';
      else packageJson[key] = { ...(packageJson[key] ?? {}), changed: '1.0.0' };
      write(fixture.repo, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
      const changedHead = commitAll(fixture.repo, `change ${key}`);
      assertFails(
        runGuard(fixture.repo, [
          ...approvedArguments(fixture, { expectedHead: changedHead }),
          '--allow', 'package.json',
        ]),
        /Balíky alebo runtime konfigurácia/,
      );
    });
  }
});

test('rejects an altered release command and enabled Vercel Git deployments', () => {
  withRepository((fixture) => {
    const packageJson = JSON.parse(readFileSync(join(fixture.repo, 'package.json'), 'utf8'));
    packageJson.scripts['release:guard'] = 'node scripts/unreviewed-release.mjs';
    write(fixture.repo, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
    const changedHead = commitAll(fixture.repo, 'alter release command');
    assertFails(
      runGuard(fixture.repo, [
        ...approvedArguments(fixture, { expectedHead: changedHead }),
        '--allow', 'package.json',
      ]),
      /očakávaný fail-closed príkaz release:guard/,
    );
  });
  withRepository((fixture) => {
    const packageJson = JSON.parse(readFileSync(join(fixture.repo, 'package.json'), 'utf8'));
    packageJson.scripts.deploy = 'vercel --prod';
    write(fixture.repo, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
    const changedHead = commitAll(fixture.repo, 'bypass guarded deploy');
    assertFails(
      runGuard(fixture.repo, [
        ...approvedArguments(fixture, { expectedHead: changedHead }),
        '--allow', 'package.json',
      ]),
      /povinný príkaz deploy s release guardom/,
    );
  });
  withRepository((fixture) => {
    const packageJson = JSON.parse(readFileSync(join(fixture.repo, 'package.json'), 'utf8'));
    packageJson.scripts['deploy:direct'] = 'vercel promote dpl_Bypass123';
    write(fixture.repo, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
    const changedHead = commitAll(fixture.repo, 'add alternate deploy entrypoint');
    assertFails(
      runGuard(fixture.repo, [...approvedArguments(fixture, { expectedHead: changedHead }), '--allow', 'package.json']),
      /ďalšie obchádzateľné deploy vstupy/,
    );
  });
  for (const operation of ['deploy', 'promote', 'rollback', 'publish', 'release']) {
    withRepository((fixture) => {
      const packageJson = JSON.parse(readFileSync(join(fixture.repo, 'package.json'), 'utf8'));
      packageJson.scripts.ship = `node scripts/${operation}_prod.mjs`;
      write(fixture.repo, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
      const changedHead = commitAll(fixture.repo, `add ${operation} underscore bypass`);
      assertFails(
        runGuard(fixture.repo, [...approvedArguments(fixture, { expectedHead: changedHead }), '--allow', 'package.json']),
        /ďalšie obchádzateľné deploy vstupy/,
      );
    });
  }
  withRepository((fixture) => {
    const packageJson = JSON.parse(readFileSync(join(fixture.repo, 'package.json'), 'utf8'));
    packageJson.scripts.ship = 'node scripts/cloud.mjs';
    write(fixture.repo, 'package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
    write(fixture.repo, 'scripts/cloud.mjs', 'throw new Error("must never run");\n');
    const changedHead = commitAll(fixture.repo, 'add indirect deploy wrapper');
    assertFails(
      runGuard(fixture.repo, [
        ...approvedArguments(fixture, { expectedHead: changedHead }),
        '--allow', 'package.json',
        '--allow', 'scripts/cloud.mjs',
      ]),
      /mení neschválené skripty/,
    );
  });
  withRepository((fixture) => {
    const vercel = JSON.parse(readFileSync(join(fixture.repo, 'vercel.json'), 'utf8'));
    vercel.git.deploymentEnabled = true;
    write(fixture.repo, 'vercel.json', `${JSON.stringify(vercel, null, 2)}\n`);
    const changedHead = commitAll(fixture.repo, 'enable automatic deployment');
    const args = [...approvedArguments(fixture, { expectedHead: changedHead }), '--allow', 'vercel.json'];
    assertFails(runGuard(fixture.repo, args), /deploymentEnabled nastavené presne na false/);
  });
});

test('requires a valid rollback commit ancestor and deployment identifier', () => {
  withRepository((fixture) => {
    assertFails(
      runGuard(fixture.repo, approvedArguments(fixture, { rollbackSha: fixture.rollbackSha.slice(0, 12) })),
      /plný 40-znakový Git SHA/,
    );
    assertFails(
      runGuard(fixture.repo, approvedArguments(fixture, { rollbackDeployment: 'https://example.invalid/deploy' })),
      /formát dpl_<alphanumeric>/,
    );

    git(fixture.repo, ['checkout', '-b', 'unrelated-rollback', fixture.rollbackSha]);
    write(fixture.repo, 'docs/unrelated-rollback.md', 'unrelated\n');
    const unrelatedRollback = commitAll(fixture.repo, 'unrelated rollback');
    git(fixture.repo, ['checkout', 'codex/approved-release']);
    assertFails(
      runGuard(fixture.repo, approvedArguments(fixture, { rollbackSha: unrelatedRollback })),
      /musí byť predkom očakávaného HEAD/,
    );
  });
});

test('refuses tracked test-results and never accepts a custom manifest path', () => {
  withRepository((fixture) => {
    write(fixture.repo, 'test-results/tracked.txt', 'must not be tracked\n');
    git(fixture.repo, ['add', '-f', 'test-results/tracked.txt']);
    git(fixture.repo, ['commit', '-m', 'track forbidden test result']);
    const changedHead = git(fixture.repo, ['rev-parse', 'HEAD']);
    const args = [...approvedArguments(fixture, { expectedHead: changedHead }), '--allow', 'test-results/tracked.txt'];
    assertFails(runGuard(fixture.repo, args), /test-results nesmie obsahovať žiadne trackované súbory/);
  });
  withRepository((fixture) => {
    const outside = join(fixture.repo, 'outside.json');
    assertFails(runGuard(fixture.repo, [...approvedArguments(fixture), '--output', outside]), /Vlastná cesta manifestu/);
    assert.equal(existsSync(outside), false);
  });
});

test('refuses a symlinked test-results directory so the manifest cannot escape its fixed location', (t) => {
  withRepository((fixture) => {
    const outside = mkdtempSync(join(tmpdir(), 'astana-release-manifest-outside-'));
    try {
      try {
        symlinkSync(outside, join(fixture.repo, 'test-results'), 'junction');
      } catch (error) {
        if (error?.code === 'EPERM' || error?.code === 'EACCES') {
          t.skip('Platforma nepovolila vytvoriť testovací junction bez zvýšených oprávnení.');
          return;
        }
        throw error;
      }
      assertFails(runGuard(fixture.repo, approvedArguments(fixture)), /test-results nesmie byť symbolický odkaz/);
      assert.equal(existsSync(join(outside, 'release-manifest.json')), false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
