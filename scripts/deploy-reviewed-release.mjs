import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runReleaseGuard } from './check-release-guardrails.mjs';

const deploymentPattern = /^dpl_[A-Za-z0-9]+$/;
const fullShaPattern = /^[0-9a-f]{40}$/i;

function parseArguments(argv) {
  let candidateDeployment = '';
  let confirmProduction = '';
  let promote = false;
  let staging = false;
  const guardArguments = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--promote') {
      if (promote) throw new Error('--promote bol zadaný viackrát.');
      promote = true;
      continue;
    }
    if (argument === '--staging') {
      if (staging) throw new Error('--staging bol zadaný viackrát.');
      staging = true;
      continue;
    }
    if (argument === '--candidate-deployment' || argument === '--confirm-production') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Parameter ${argument} nemá hodnotu.`);
      index += 1;
      if (argument === '--candidate-deployment') {
        if (candidateDeployment) throw new Error('--candidate-deployment bol zadaný viackrát.');
        candidateDeployment = value;
      } else {
        if (confirmProduction) throw new Error('--confirm-production bol zadaný viackrát.');
        confirmProduction = value;
      }
      continue;
    }
    guardArguments.push(argument);
  }
  if (!deploymentPattern.test(candidateDeployment)) throw new Error('--candidate-deployment musí mať formát dpl_<alphanumeric>.');
  if (staging && promote) throw new Error('--staging sa nesmie kombinovať s --promote.');
  if (promote && !fullShaPattern.test(confirmProduction)) throw new Error('Produkčné povýšenie vyžaduje --confirm-production s plným schváleným Git SHA.');
  if (!promote && confirmProduction) throw new Error('--confirm-production je povolené iba spolu s --promote.');
  return { candidateDeployment, confirmProduction: confirmProduction.toLowerCase(), guardArguments, promote, staging };
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function verifiedManifest(guarded) {
  if (
    typeof guarded?.manifestSnapshot !== 'string'
    || !/^[0-9a-f]{64}$/.test(guarded?.manifestDigest ?? '')
    || !/^[0-9a-f]{64}$/.test(guarded?.releaseStateDigest ?? '')
  ) {
    throw new Error('Release guard neposkytol overený manifestový snapshot.');
  }
  if (sha256(guarded.manifestSnapshot) !== guarded.manifestDigest) throw new Error('Integrita manifestového snapshotu release guardu nesedí.');
  const manifest = JSON.parse(guarded.manifestSnapshot);
  if (manifest.result !== 'PASS' || manifest.currentHead !== guarded.sha) throw new Error('Manifestový snapshot nezodpovedá úspešnému release guardu.');
  const { generatedAt: _generatedAt, releaseStateDigest, ...stableManifest } = manifest;
  if (releaseStateDigest !== guarded.releaseStateDigest || sha256(JSON.stringify(stableManifest)) !== releaseStateDigest) {
    throw new Error('Stabilný odtlačok release stavu nezodpovedá manifestu.');
  }
  return manifest;
}

function deploymentCommitSha(deployment) {
  const candidates = [deployment?.gitSource?.sha, deployment?.meta?.githubCommitSha, deployment?.meta?.gitCommitSha, deployment?.meta?.bitbucketCommitSha]
    .filter((value) => typeof value === 'string' && fullShaPattern.test(value));
  return [...new Set(candidates.map((value) => value.toLowerCase()))];
}

async function vercelJson({ pathname, env, fetchImpl, signal }) {
  const url = new URL(`https://api.vercel.com${pathname}`);
  url.searchParams.set('teamId', env.VERCEL_ORG_ID);
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` }, method: 'GET', signal });
  if (!response.ok) throw new Error(`Vercel kontrola ${pathname} zlyhala so stavom ${response.status}.`);
  return response.json();
}

async function promoteDeployment({ deploymentId, env, fetchImpl, signal }) {
  const url = new URL(`https://api.vercel.com/v10/projects/${env.VERCEL_PROJECT_ID}/promote/${deploymentId}`);
  url.searchParams.set('teamId', env.VERCEL_ORG_ID);
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
    method: 'POST',
    signal,
  });
  if (!response.ok) throw new Error(`Vercel promote ${deploymentId} zlyhal so stavom ${response.status}.`);
}

async function inspectDeployment({ deploymentId, env, expectedTarget = 'production', fetchImpl, signal }) {
  const deployment = await vercelJson({ pathname: `/v13/deployments/${deploymentId}`, env, fetchImpl, signal });
  if (deployment?.id !== deploymentId) throw new Error(`Vercel vrátil iné deployment ID pre ${deploymentId}.`);
  if ((deployment?.projectId || deployment?.project?.id) !== env.VERCEL_PROJECT_ID) throw new Error(`${deploymentId} nepatrí schválenému Vercel projektu.`);
  if (deployment?.target !== expectedTarget) throw new Error(`${deploymentId} nie je deployment prostredia ${expectedTarget}.`);
  if (deployment?.readyState !== 'READY') throw new Error(`${deploymentId} nie je v stave READY.`);
  return deployment;
}

async function currentProductionAliases({ env, fetchImpl, signal }) {
  const project = await vercelJson({ pathname: `/v9/projects/${env.VERCEL_PROJECT_ID}`, env, fetchImpl, signal });
  if (project?.id !== env.VERCEL_PROJECT_ID) throw new Error('Vercel vrátil iný projekt pri kontrole produkčných aliasov.');
  const legacyBindings = (Array.isArray(project.alias) ? project.alias : [])
    .filter((entry) => String(entry?.environment ?? entry?.target ?? '').toLowerCase() === 'production' && !entry?.redirect)
    .map((entry) => ({ alias: entry.domain || entry.name, deployment: entry.deployment?.id || entry.deploymentId }))
    .filter((entry) => typeof entry.alias === 'string' && deploymentPattern.test(entry.deployment || ''));
  const productionTarget = project?.targets?.production;
  const productionTargetId = productionTarget?.id;
  const targetBindings = deploymentPattern.test(productionTargetId || '')
    ? [...new Set([
      ...(Array.isArray(productionTarget?.alias) ? productionTarget.alias : []),
      ...(Array.isArray(productionTarget?.automaticAliases) ? productionTarget.automaticAliases : []),
    ].filter((alias) => typeof alias === 'string' && alias.trim()).map((alias) => alias.trim().toLowerCase()))]
      .map((alias) => ({ alias, deployment: productionTargetId }))
    : [];
  const byAlias = new Map();
  for (const binding of [...legacyBindings, ...targetBindings]) {
    const alias = binding.alias.trim().toLowerCase();
    const existing = byAlias.get(alias);
    if (existing && existing !== binding.deployment) throw new Error(`Vercel vrátil konfliktnú väzbu produkčného aliasu ${alias}.`);
    byAlias.set(alias, binding.deployment);
  }
  const bindings = [...byAlias.entries()]
    .map(([alias, deployment]) => ({ alias, deployment }))
    .sort((a, b) => a.alias.localeCompare(b.alias));
  if (bindings.length === 0) throw new Error('Vercel projekt nemá overiteľný produkčný alias; release je fail-closed.');
  return bindings;
}

function requireCurrent(bindings, deploymentId, expectedAliases = null) {
  if (bindings.some((entry) => entry.deployment !== deploymentId)) throw new Error(`Produkčný Current deployment nie je ${deploymentId}; zistený súbeh alebo zmena mimo guardu.`);
  const aliases = bindings.map((entry) => entry.alias);
  if (expectedAliases && JSON.stringify(aliases) !== JSON.stringify(expectedAliases)) throw new Error('Množina produkčných aliasov sa počas promote zmenila; release je fail-closed.');
  return aliases;
}

function requireEnvironment(env) {
  for (const name of ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']) if (!env[name]?.trim()) throw new Error(`Chýba ${name}; kontrola deploymentu je fail-closed.`);
}

function requireDeploymentCommit(deployment, expectedSha, label) {
  const commits = deploymentCommitSha(deployment);
  if (commits.length !== 1 || commits[0] !== expectedSha) throw new Error(`${label} deployment nie je jednoznačne naviazaný na Git SHA ${expectedSha}.`);
}

async function waitForCurrent({
  deploymentId, env, expectedAliases, fetchImpl, sleepImpl, signalFactory, attempts = 10, delayMs = 3_000,
}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      requireCurrent(await currentProductionAliases({ env, fetchImpl, signal: signalFactory() }), deploymentId, expectedAliases);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleepImpl(delayMs);
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Vercel promote bol prijatý, ale produkčný Current sa v časovom limite nepotvrdil; výsledok je neznámy. `
    + `Deploy neopakujte bez čítacieho overenia aliasov. Posledná kontrola: ${detail}`,
  );
}

export async function runReviewedDeployment({
  argv = process.argv.slice(2), cwd = process.cwd(), env = process.env, fetchImpl = globalThis.fetch,
  guardRunner = runReleaseGuard, sleepImpl = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
  apiRequestTimeoutMs = 2_000, promoteTimeoutMs = 10_000,
  abortSignalFactory = (milliseconds) => AbortSignal.timeout(milliseconds),
} = {}) {
  const parsed = parseArguments(argv);
  requireEnvironment(env);
  if (typeof fetchImpl !== 'function') throw new Error('Fetch API nie je dostupné na kontrolu Vercel deploymentu.');

  const guarded = await guardRunner({ argv: parsed.guardArguments, cwd });
  const manifest = verifiedManifest(guarded);
  if (parsed.promote && parsed.confirmProduction !== guarded.sha) throw new Error('--confirm-production sa nezhoduje s HEAD schváleným release guardom.');
  const rollbackId = manifest?.rollback?.deployment;
  const rollbackSha = manifest?.rollback?.sourceSha;
  if (parsed.staging) {
    const stagingDeployment = await inspectDeployment({
      deploymentId: parsed.candidateDeployment,
      env,
      expectedTarget: 'staging',
      fetchImpl,
      signal: abortSignalFactory(apiRequestTimeoutMs),
    });
    requireDeploymentCommit(stagingDeployment, guarded.sha, 'Staging');
    return { action: 'verified-staging', candidate: parsed.candidateDeployment, sha: guarded.sha };
  }
  if (!deploymentPattern.test(rollbackId || '') || !fullShaPattern.test(rollbackSha || '')) throw new Error('Release manifest neobsahuje platnú rollback väzbu.');
  if (rollbackId === parsed.candidateDeployment) throw new Error('Candidate a rollback deployment musia byť rozdielne.');

  const [candidate, rollback, currentBefore] = await Promise.all([
    inspectDeployment({ deploymentId: parsed.candidateDeployment, env, fetchImpl, signal: abortSignalFactory(apiRequestTimeoutMs) }),
    inspectDeployment({ deploymentId: rollbackId, env, fetchImpl, signal: abortSignalFactory(apiRequestTimeoutMs) }),
    currentProductionAliases({ env, fetchImpl, signal: abortSignalFactory(apiRequestTimeoutMs) }),
  ]);
  requireDeploymentCommit(candidate, guarded.sha, 'Candidate');
  requireDeploymentCommit(rollback, rollbackSha.toLowerCase(), 'Rollback');
  const productionAliases = requireCurrent(currentBefore, rollbackId);
  if (!parsed.promote) return { action: 'verified', candidate: parsed.candidateDeployment, rollback: rollbackId, sha: guarded.sha };

  const rechecked = await guardRunner({ argv: parsed.guardArguments, cwd });
  verifiedManifest(rechecked);
  if (rechecked.sha !== guarded.sha || rechecked.releaseStateDigest !== guarded.releaseStateDigest) {
    throw new Error('Release guard alebo schválený release stav sa zmenil pred produkčným povýšením.');
  }
  requireCurrent(
    await currentProductionAliases({ env, fetchImpl, signal: abortSignalFactory(apiRequestTimeoutMs) }),
    rollbackId,
    productionAliases,
  );
  let promoteTransportError = null;
  try {
    await promoteDeployment({
      deploymentId: parsed.candidateDeployment,
      env,
      fetchImpl,
      signal: abortSignalFactory(promoteTimeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && /zlyhal so stavom \d+/.test(error.message)) throw error;
    promoteTransportError = error;
  }
  await waitForCurrent({
    deploymentId: parsed.candidateDeployment,
    env,
    expectedAliases: productionAliases,
    fetchImpl,
    sleepImpl,
    signalFactory: () => abortSignalFactory(apiRequestTimeoutMs),
  });
  return {
    action: 'promoted',
    candidate: parsed.candidateDeployment,
    rollback: rollbackId,
    sha: guarded.sha,
    transportRecoveredByAliasVerification: Boolean(promoteTransportError),
  };
}

const isDirectInvocation = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectInvocation) {
  runReviewedDeployment()
    .then((result) => console.log(`PASS: ${result.action} ${result.candidate} pre ${result.sha}; rollback ${result.rollback}.`))
    .catch((error) => { console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
}
