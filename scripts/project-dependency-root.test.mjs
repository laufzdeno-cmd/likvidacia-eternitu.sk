import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { cleanupEvidenceMetrics } from './capture-local-release-evidence.mjs';
import { resolveProjectDependencyRoot } from './project-dependency-root.mjs';

test('clean nested release candidate resolves the installed project dependencies', async () => {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  const nestedCandidateScript = path.join(projectRoot, 'tmp', 'release-candidate-test', 'scripts', 'runner.mjs');
  const installedDependencyRoot = resolveProjectDependencyRoot(import.meta.url);
  const resolved = resolveProjectDependencyRoot(pathToFileURL(nestedCandidateScript));

  assert.equal(path.resolve(resolved).toLowerCase(), path.resolve(installedDependencyRoot).toLowerCase());
});

test('release evidence accepts the project-owned harness cleanup and requires UTF-8 PowerShell output', async () => {
  const cleanupLog = [
    'server stopped',
    'PASS: jednorazový PostgreSQL bol zastavený a jeho projektové tmp dáta odstránené.',
    'Cleanup PASS: owned temp root removed: <PROJECT_ROOT>\\tmp\\astana-photo-intake-regression',
  ].join('\n');
  assert.deepEqual(cleanupEvidenceMetrics(cleanupLog, 'Regression'), {
    temporaryDatabaseStopped: true,
    temporaryDatabaseRemoved: true,
    temporaryRootRemoved: true,
  });

  const runner = await readFile(new URL('./run-isolated-postgres.ps1', import.meta.url), 'utf8');
  const evidenceRunner = await readFile(new URL('./capture-local-release-evidence.mjs', import.meta.url), 'utf8');
  assert.match(runner, /\[Console\]::OutputEncoding = \$utf8NoBom/);
  assert.match(runner, /\$OutputEncoding = \$utf8NoBom/);
  assert.match(evidenceRunner, /\['productionBuild', 'pwsh\.exe'/);
  assert.match(evidenceRunner, /\['lighthouseBuild', 'pwsh\.exe'/);
});
