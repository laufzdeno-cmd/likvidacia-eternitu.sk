import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { runReviewedDeployment } from './deploy-reviewed-release.mjs';

const candidateSha = 'a'.repeat(40);
const rollbackSha = 'b'.repeat(40);
const candidateId = 'dpl_Candidate123';
const rollbackId = 'dpl_Rollback123';
const env = { VERCEL_TOKEN: 'test-token', VERCEL_ORG_ID: 'team_test', VERCEL_PROJECT_ID: 'prj_test', SMTP_PASS: 'must-not-leak' };

function guarded(overrides = {}) {
  const stableManifest = {
    result: 'PASS', currentHead: candidateSha,
    rollback: { deployment: rollbackId, sourceSha: rollbackSha },
    previousProduction: { deployment: rollbackId },
  };
  const releaseStateDigest = createHash('sha256').update(JSON.stringify(stableManifest)).digest('hex');
  const manifestSnapshot = `${JSON.stringify({ ...stableManifest, releaseStateDigest }, null, 2)}\n`;
  return {
    manifestDigest: createHash('sha256').update(manifestSnapshot).digest('hex'),
    manifestSnapshot,
    releaseStateDigest,
    sha: candidateSha,
    ...overrides,
  };
}

function fixture({
  current = rollbackId,
  afterPromote = candidateId,
  afterPromoteChecks = [],
  deployments = {},
  projectShape = 'targets',
  projectHangsAfterPromote = false,
  promoteHangs = false,
  promoteThrows = false,
} = {}) {
  let currentId = current;
  let promoted = false;
  let projectChecksAfterPromote = 0;
  const calls = [];
  const values = {
    [candidateId]: { id: candidateId, projectId: env.VERCEL_PROJECT_ID, target: 'production', readyState: 'READY', gitSource: { sha: candidateSha } },
    [rollbackId]: { id: rollbackId, projectId: env.VERCEL_PROJECT_ID, target: 'production', readyState: 'READY', meta: { githubCommitSha: rollbackSha } },
    ...deployments,
  };
  return {
    calls,
    fetchImpl: async (input, options) => {
      const url = new URL(input);
      calls.push({ headers: options.headers, method: options.method, pathname: url.pathname });
      if (url.pathname.includes('/promote/')) {
        currentId = afterPromote;
        promoted = true;
        if (promoteThrows) throw new TypeError('simulated connection reset after request write');
        if (promoteHangs) {
          return new Promise((resolvePromise, rejectPromise) => {
            options.signal.addEventListener('abort', () => rejectPromise(options.signal.reason), { once: true });
          });
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }
      if (url.pathname === `/v9/projects/${env.VERCEL_PROJECT_ID}`) {
        if (promoted && projectHangsAfterPromote) {
          return new Promise((resolvePromise, rejectPromise) => {
            options.signal.addEventListener('abort', () => rejectPromise(options.signal.reason), { once: true });
          });
        }
        const observed = promoted && projectChecksAfterPromote < afterPromoteChecks.length
          ? afterPromoteChecks[projectChecksAfterPromote++]
          : currentId;
        const project = projectShape === 'legacy'
          ? { id: env.VERCEL_PROJECT_ID, alias: [{ domain: 'likvidacia-eternitu.sk', environment: 'production', deployment: { id: observed } }] }
          : {
            id: env.VERCEL_PROJECT_ID,
            alias: null,
            targets: { production: { id: observed, alias: ['likvidacia-eternitu-sk.example.vercel.app'] } },
          };
        return { ok: true, status: 200, json: async () => project };
      }
      const id = url.pathname.split('/').at(-1);
      return values[id]
        ? { ok: true, status: 200, json: async () => values[id] }
        : { ok: false, status: 404, json: async () => ({}) };
    },
  };
}

const baseArgs = ['--candidate-deployment', candidateId];

test('verify-only binds candidate, rollback and current production without POST', async () => {
  const f = fixture();
  const result = await runReviewedDeployment({ argv: baseArgs, env, fetchImpl: f.fetchImpl, guardRunner: async () => guarded() });
  assert.equal(result.action, 'verified');
  assert.equal(f.calls.some((call) => call.method === 'POST'), false);
  assert.ok(f.calls.every((call) => call.headers.Authorization === 'Bearer test-token'));
  assert.ok(f.calls.every((call) => Object.keys(call.headers).length === 1), 'requests expose only Authorization');
});

test('rollback without source metadata is always rejected', async () => {
  const noSource = { id: rollbackId, projectId: env.VERCEL_PROJECT_ID, target: 'production', readyState: 'READY' };
  const rejected = fixture({ deployments: { [rollbackId]: noSource } });
  await assert.rejects(
    () => runReviewedDeployment({ argv: baseArgs, env, fetchImpl: rejected.fetchImpl, guardRunner: async () => guarded() }),
    /Rollback deployment nie je jednoznačne naviazaný/,
  );
});

test('current production and source-bound rollback may be separate deployments', async () => {
  const currentId = 'dpl_LegacyCurrent123';
  const f = fixture({ current: currentId });
  const approval = guarded();
  const manifest = JSON.parse(approval.manifestSnapshot);
  manifest.previousProduction.deployment = currentId;
  const { generatedAt: _generatedAt, releaseStateDigest: _digest, ...stableManifest } = manifest;
  manifest.releaseStateDigest = createHash('sha256').update(JSON.stringify(stableManifest)).digest('hex');
  const manifestSnapshot = `${JSON.stringify(manifest, null, 2)}\n`;
  const result = await runReviewedDeployment({
    argv: baseArgs,
    env,
    fetchImpl: f.fetchImpl,
    guardRunner: async () => ({
      ...approval,
      manifestSnapshot,
      manifestDigest: createHash('sha256').update(manifestSnapshot).digest('hex'),
      releaseStateDigest: manifest.releaseStateDigest,
    }),
  });
  assert.equal(result.previousProduction, currentId);
  assert.equal(result.rollback, rollbackId);
});

test('legacy project alias response remains accepted', async () => {
  const f = fixture({ projectShape: 'legacy' });
  const result = await runReviewedDeployment({ argv: baseArgs, env, fetchImpl: f.fetchImpl, guardRunner: async () => guarded() });
  assert.equal(result.action, 'verified');
});

test('custom Staging verification requires READY staging target bound to the guarded SHA', async () => {
  const stagingId = 'dpl_Staging123';
  const f = fixture({ deployments: {
    [stagingId]: { id: stagingId, projectId: env.VERCEL_PROJECT_ID, target: 'staging', readyState: 'READY', gitSource: { sha: candidateSha } },
  } });
  const result = await runReviewedDeployment({
    argv: ['--staging', '--candidate-deployment', stagingId], env, fetchImpl: f.fetchImpl, guardRunner: async () => guarded(),
  });
  assert.equal(result.action, 'verified-staging');
  assert.equal(f.calls.some((call) => call.method === 'POST'), false);

  const wrongTarget = fixture({ deployments: {
    [stagingId]: { id: stagingId, projectId: env.VERCEL_PROJECT_ID, target: 'preview', readyState: 'READY', gitSource: { sha: candidateSha } },
  } });
  await assert.rejects(
    () => runReviewedDeployment({ argv: ['--staging', '--candidate-deployment', stagingId], env, fetchImpl: wrongTarget.fetchImpl, guardRunner: async () => guarded() }),
    /prostredia staging/,
  );
});

test('promote uses official API and verifies the candidate is Current afterwards', async () => {
  const f = fixture({ afterPromoteChecks: [rollbackId, rollbackId] });
  let guardCalls = 0;
  const result = await runReviewedDeployment({
    argv: [...baseArgs, '--promote', '--confirm-production', candidateSha], env, fetchImpl: f.fetchImpl,
    guardRunner: async () => { guardCalls += 1; return guarded(); },
    sleepImpl: async () => {},
  });
  assert.equal(result.action, 'promoted');
  assert.equal(guardCalls, 2);
  assert.equal(f.calls.filter((call) => call.method === 'POST' && call.pathname === `/v10/projects/${env.VERCEL_PROJECT_ID}/promote/${candidateId}`).length, 1);
});

test('tampered guard snapshot and Current races fail closed', async () => {
  const f = fixture();
  await assert.rejects(
    () => runReviewedDeployment({ argv: baseArgs, env, fetchImpl: f.fetchImpl, guardRunner: async () => guarded({ manifestDigest: '0'.repeat(64) }) }),
    /Integrita manifestového snapshotu/,
  );
  const beforeRace = fixture({ current: 'dpl_Other123' });
  await assert.rejects(
    () => runReviewedDeployment({ argv: baseArgs, env, fetchImpl: beforeRace.fetchImpl, guardRunner: async () => guarded() }),
    /Current deployment nie je/,
  );
  const afterRace = fixture({ afterPromote: 'dpl_Other123' });
  await assert.rejects(
    () => runReviewedDeployment({
      argv: [...baseArgs, '--promote', '--confirm-production', candidateSha], env, fetchImpl: afterRace.fetchImpl,
      guardRunner: async () => guarded(), sleepImpl: async () => {},
    }),
    /výsledok je neznámy.*Deploy neopakujte/,
  );
});

test('a fresh generatedAt does not change the stable approval digest, but a changed release state does', async () => {
  const f = fixture();
  let guardCalls = 0;
  const base = guarded();
  const result = await runReviewedDeployment({
    argv: [...baseArgs, '--promote', '--confirm-production', candidateSha], env, fetchImpl: f.fetchImpl,
    guardRunner: async () => {
      guardCalls += 1;
      const manifest = JSON.parse(base.manifestSnapshot);
      manifest.generatedAt = guardCalls === 1 ? '2026-10-07T10:00:00.000Z' : '2026-10-07T10:00:01.000Z';
      const manifestSnapshot = `${JSON.stringify(manifest, null, 2)}\n`;
      return { ...base, manifestSnapshot, manifestDigest: createHash('sha256').update(manifestSnapshot).digest('hex') };
    },
    sleepImpl: async () => {},
  });
  assert.equal(result.action, 'promoted');

  const changed = fixture();
  let calls = 0;
  await assert.rejects(
    () => runReviewedDeployment({
      argv: [...baseArgs, '--promote', '--confirm-production', candidateSha], env, fetchImpl: changed.fetchImpl,
      guardRunner: async () => {
        calls += 1;
        return calls === 1 ? guarded() : guarded({ releaseStateDigest: 'f'.repeat(64) });
      },
      sleepImpl: async () => {},
    }),
    /Stabilný odtlačok|schválený release stav/,
  );
});

test('a transport error after POST is resolved only by alias verification or remains explicitly unknown', async () => {
  const accepted = fixture({ promoteThrows: true });
  const recovered = await runReviewedDeployment({
    argv: [...baseArgs, '--promote', '--confirm-production', candidateSha], env, fetchImpl: accepted.fetchImpl,
    guardRunner: async () => guarded(), sleepImpl: async () => {},
  });
  assert.equal(recovered.action, 'promoted');
  assert.equal(recovered.transportRecoveredByAliasVerification, true);

  const unknown = fixture({ promoteThrows: true, afterPromote: rollbackId });
  await assert.rejects(
    () => runReviewedDeployment({
      argv: [...baseArgs, '--promote', '--confirm-production', candidateSha], env, fetchImpl: unknown.fetchImpl,
      guardRunner: async () => guarded(), sleepImpl: async () => {},
    }),
    /výsledok je neznámy.*Deploy neopakujte/,
  );
});

test('a hanging promote POST is aborted and resolved only through bounded alias verification', async () => {
  const accepted = fixture({ promoteHangs: true });
  const result = await runReviewedDeployment({
    argv: [...baseArgs, '--promote', '--confirm-production', candidateSha], env, fetchImpl: accepted.fetchImpl,
    guardRunner: async () => guarded(), sleepImpl: async () => {}, promoteTimeoutMs: 5,
  });
  assert.equal(result.action, 'promoted');
  assert.equal(result.transportRecoveredByAliasVerification, true);

  const unknown = fixture({ promoteHangs: true, afterPromote: rollbackId });
  await assert.rejects(
    () => runReviewedDeployment({
      argv: [...baseArgs, '--promote', '--confirm-production', candidateSha], env, fetchImpl: unknown.fetchImpl,
      guardRunner: async () => guarded(), sleepImpl: async () => {}, promoteTimeoutMs: 5,
    }),
    /výsledok je neznámy.*Deploy neopakujte/,
  );
});

test('every alias verification GET has a timeout and reaches explicit unknown state', async () => {
  const hangingAliases = fixture({ projectHangsAfterPromote: true });
  await assert.rejects(
    () => runReviewedDeployment({
      argv: [...baseArgs, '--promote', '--confirm-production', candidateSha], env, fetchImpl: hangingAliases.fetchImpl,
      guardRunner: async () => guarded(), sleepImpl: async () => {}, apiRequestTimeoutMs: 5,
    }),
    /výsledok je neznámy.*Deploy neopakujte/,
  );
});

test('deployment metadata mismatch and missing binding environment fail closed', async () => {
  const wrong = fixture({ deployments: { [candidateId]: { id: candidateId, projectId: env.VERCEL_PROJECT_ID, target: 'production', readyState: 'READY', gitSource: { sha: 'c'.repeat(40) } } } });
  await assert.rejects(() => runReviewedDeployment({ argv: baseArgs, env, fetchImpl: wrong.fetchImpl, guardRunner: async () => guarded() }), /naviazaný/);
  await assert.rejects(() => runReviewedDeployment({ argv: baseArgs, env: { ...env, VERCEL_TOKEN: '' }, fetchImpl: wrong.fetchImpl, guardRunner: async () => guarded() }), /VERCEL_TOKEN/);
});
