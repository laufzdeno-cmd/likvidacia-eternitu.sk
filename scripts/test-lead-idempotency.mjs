import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

const BLOCKED_TEST_ENV_KEY = /^(?:SMTP_|MAIL_|FROM_EMAIL$|LEAD_TO_EMAIL$|ADMIN_BASE_URL$|S3_|AWS_|BLOB_READ_WRITE_TOKEN$|META_|NEXT_PUBLIC_META_|FACEBOOK_|FB_|RESEND_|SENDGRID_|POSTMARK_)/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  if (!address || typeof address === 'string') throw new Error('Nepodarilo sa vybrať lokálny port pre idempotency test.');
  return address.port;
}

async function waitForServer(baseUrl, processHandle) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Lokálny Next server skončil s kódom ${processHandle.exitCode}.`);
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' });
      if (response.ok) return;
    } catch {
      // Server ešte štartuje.
    }
    await sleep(500);
  }
  throw new Error('Lokálny Next server neodpovedal do 60 sekúnd.');
}

function stopProcess(processHandle) {
  if (processHandle.exitCode !== null) return;
  if (process.platform === 'win32' && processHandle.pid) {
    try {
      execFileSync('taskkill', ['/pid', String(processHandle.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    } catch {
      // Prenosný fallback je nižšie.
    }
  }
  processHandle.kill('SIGTERM');
}

function createIsolatedTestEnvironment(tempDirectory, baseUrl) {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (BLOCKED_TEST_ENV_KEY.test(key)) delete environment[key];
  }
  const remainingSensitiveKeys = Object.keys(environment).filter((key) => BLOCKED_TEST_ENV_KEY.test(key));
  assert.deepEqual(remainingSensitiveKeys, [], `Idempotency test nesmie zdediť produkčné credentials: ${remainingSensitiveKeys.join(', ')}`);

  return {
    ...environment,
    DATABASE_URL: '',
    ASTANA_LOCAL_DB_PATH: path.join(tempDirectory, 'local-db.json'),
    ALLOWED_ORIGINS: baseUrl,
    NEXT_PUBLIC_SITE_URL: baseUrl,
    NODE_ENV: 'development',
  };
}

function formBody(submissionId) {
  const body = new URLSearchParams({
    fullName: 'Testovací zákazník',
    phone: '0905000000',
    email: 'lead-idempotency@example.test',
    city: 'Nitra',
    district: 'Nitra',
    objectType: 'Rodinný dom',
    materialType: 'Vlnitý eternit',
    areaEstimate: '120',
    preferredContact: 'Zavolajte mi',
    gdpr: 'on',
  });
  if (submissionId !== undefined) body.set('submissionId', submissionId);
  return body;
}

async function main() {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'astana-lead-idempotency-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const testEnvironment = createIsolatedTestEnvironment(tempDirectory, baseUrl);
  const devCommand = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const devArguments = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm.cmd run dev -- --hostname 127.0.0.1 --port ${port}`]
    : ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)];
  const server = spawn(devCommand, devArguments, {
    cwd: process.cwd(),
    env: testEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  async function submit(submissionId, { accept = 'application/json', userAgent = 'ASTANA idempotency test' } = {}) {
    const response = await fetch(`${baseUrl}/api/dopyt/`, {
      method: 'POST',
      headers: {
        accept,
        origin: baseUrl,
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'user-agent': userAgent,
      },
      body: formBody(submissionId),
      redirect: 'manual',
    });
    const body = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
    return { response, body };
  }

  async function snapshot() {
    return JSON.parse(await readFile(path.join(tempDirectory, 'local-db.json'), 'utf8'));
  }

  try {
    await waitForServer(baseUrl, server);

    const firstId = randomUUID();
    const first = await submit(firstId);
    assert.equal(first.response.status, 200);
    assert.equal(first.body?.ok, true);
    assert.equal((await snapshot()).leads.length, 1, 'Nový UUID musí vytvoriť presne jeden lead.');
    assert.equal((await snapshot()).businessJobs.length, 1, 'Nový UUID musí vytvoriť presne jednu zákazku.');

    const retry = await submit(firstId);
    assert.equal(retry.response.status, 200);
    assert.equal(retry.body?.ok, true);
    assert.equal((await snapshot()).leads.length, 1, 'Sériový retry s rovnakým UUID nesmie vytvoriť druhý lead.');
    assert.equal((await snapshot()).businessJobs.length, 1, 'Sériový retry nesmie vytvoriť druhú zákazku.');
    assert.equal((await snapshot()).metaCapiOutbox.length, 0, 'Izolovaný no-SMTP test nesmie vytvoriť Meta CAPI event.');

    const parallelId = randomUUID();
    const [parallelA, parallelB] = await Promise.all([submit(parallelId), submit(parallelId)]);
    assert.equal(parallelA.response.status, 200);
    assert.equal(parallelB.response.status, 200);
    assert.equal((await snapshot()).leads.length, 2, 'Dva paralelné requesty s rovnakým UUID musia vytvoriť iba jeden ďalší lead.');
    assert.equal((await snapshot()).businessJobs.length, 2, 'Dva paralelné requesty nesmú vytvoriť druhú zákazku pre rovnaký UUID.');

    const fallbackId = randomUUID();
    const ajax = await submit(fallbackId);
    const native = await submit(fallbackId, { accept: 'text/html', userAgent: 'Opera native fallback simulation OPR/115' });
    assert.equal(ajax.response.status, 200);
    assert.equal(native.response.status, 303);
    assert.equal((await snapshot()).leads.length, 3, 'AJAX a následný natívny submit s rovnakým UUID musia zostať jeden lead.');
    assert.equal((await snapshot()).businessJobs.length, 3, 'AJAX a natívny submit nesmú vytvoriť duplicitnú zákazku.');

    const operaId = randomUUID();
    const operaFirst = await submit(operaId, { userAgent: 'Opera OPR/115' });
    const operaRetry = await submit(operaId, { userAgent: 'Opera OPR/115' });
    assert.equal(operaFirst.response.status, 200);
    assert.equal(operaRetry.response.status, 200);
    assert.equal((await snapshot()).leads.length, 4, 'Opera označený request s rovnakým UUID musí zostať jeden lead.');
    assert.equal((await snapshot()).businessJobs.length, 4, 'Opera označený retry nesmie vytvoriť druhú zákazku.');

    const fresh = await submit(randomUUID());
    assert.equal(fresh.response.status, 200);
    assert.equal((await snapshot()).leads.length, 5, 'Nový UUID musí vytvoriť nový lead.');

    const beforeInvalid = await snapshot();
    const missing = await submit(undefined);
    const invalid = await submit('not-a-uuid');
    assert.equal(missing.response.status, 400, 'Chýbajúci submissionId musí skončiť validačnou chybou.');
    assert.equal(invalid.response.status, 400, 'Neplatný submissionId musí skončiť validačnou chybou.');
    const afterInvalid = await snapshot();
    assert.equal(afterInvalid.leads.length, beforeInvalid.leads.length, 'Neplatný kľúč nesmie vytvoriť lead.');
    assert.equal(afterInvalid.businessJobs.length, beforeInvalid.businessJobs.length, 'Neplatný kľúč nesmie vytvoriť zákazku.');

    console.log('PASS: B1.MINIMAL server idempotency — serial retry, parallel requests, AJAX/native simulation, Opera UA, missing and invalid UUID, bez SMTP.');
  } finally {
    stopProcess(server);
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
