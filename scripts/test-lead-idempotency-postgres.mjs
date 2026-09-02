import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import path from 'node:path';

const projectRoot = process.cwd();
const require = createRequire(path.join(projectRoot, 'package.json'));
const { Pool } = require('pg');
const databaseUrl = process.env.P1B_TEST_DATABASE_URL;

if (!databaseUrl) throw new Error('P1B_TEST_DATABASE_URL je povinná lokálna PostgreSQL URL.');
const database = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(database.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) {
  throw new Error('Idempotency test povoľuje iba lokálny PostgreSQL host, aby nemohol zasiahnuť produkčnú DB.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  if (!address || typeof address === 'string') throw new Error('Nepodarilo sa vybrať lokálny port.');
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

function createTestEnvironment(baseUrl) {
  const environment = { ...process.env };
  const blocked = /^(?:SMTP_|MAIL_|FROM_EMAIL$|LEAD_TO_EMAIL$|ADMIN_BASE_URL$|S3_|AWS_|BLOB_READ_WRITE_TOKEN$|META_|NEXT_PUBLIC_META_|FACEBOOK_|FB_|RESEND_|SENDGRID_|POSTMARK_)/i;
  for (const key of Object.keys(environment)) {
    if (blocked.test(key)) delete environment[key];
  }
  delete environment.ASTANA_LOCAL_DB_PATH;
  return {
    ...environment,
    DATABASE_URL: databaseUrl,
    ALLOWED_ORIGINS: baseUrl,
    NEXT_PUBLIC_SITE_URL: baseUrl,
    NODE_ENV: 'development',
    SMTP_HOST: '',
    SMTP_PORT: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    LEAD_TO_EMAIL: '',
    FROM_EMAIL: '',
    MAIL_FROM: '',
    BLOB_READ_WRITE_TOKEN: '',
    META_ACCESS_TOKEN: '',
    FACEBOOK_ACCESS_TOKEN: '',
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
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const pool = new Pool({ connectionString: databaseUrl });
  const devCommand = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const devArguments = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm.cmd run dev -- --hostname 127.0.0.1 --port ${port}`]
    : ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)];
  const server = spawn(devCommand, devArguments, {
    cwd: projectRoot,
    env: createTestEnvironment(baseUrl),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const serverErrors = [];
  server.stderr.on('data', (chunk) => serverErrors.push(String(chunk)));

  async function submit(submissionId, { accept = 'application/json', userAgent = 'ASTANA PostgreSQL idempotency test' } = {}) {
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
    const [leads, jobs, linkedJobs, meta] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM leads'),
      pool.query('SELECT COUNT(*)::int AS count FROM business_jobs'),
      pool.query('SELECT COUNT(*)::int AS count FROM business_jobs WHERE lead_id IS NOT NULL'),
      pool.query('SELECT COUNT(*)::int AS count FROM meta_capi_delivery_outbox'),
    ]);
    return {
      leads: leads.rows[0].count,
      businessJobs: jobs.rows[0].count,
      linkedBusinessJobs: linkedJobs.rows[0].count,
      metaCapiOutbox: meta.rows[0].count,
    };
  }

  try {
    await waitForServer(baseUrl, server);
    assert.deepEqual(await snapshot(), { leads: 0, businessJobs: 0, linkedBusinessJobs: 0, metaCapiOutbox: 0 }, 'Test DB musí byť prázdna.');

    const firstId = randomUUID();
    const first = await submit(firstId);
    assert.equal(first.response.status, 200);
    assert.equal(first.body?.ok, true);
    assert.deepEqual(await snapshot(), { leads: 1, businessJobs: 1, linkedBusinessJobs: 1, metaCapiOutbox: 0 });

    const retry = await submit(firstId);
    assert.equal(retry.response.status, 200);
    assert.equal(retry.body?.ok, true);
    assert.deepEqual(await snapshot(), { leads: 1, businessJobs: 1, linkedBusinessJobs: 1, metaCapiOutbox: 0 });

    const parallelId = randomUUID();
    const [parallelA, parallelB] = await Promise.all([submit(parallelId), submit(parallelId)]);
    assert.equal(parallelA.response.status, 200);
    assert.equal(parallelB.response.status, 200);
    assert.deepEqual(await snapshot(), { leads: 2, businessJobs: 2, linkedBusinessJobs: 2, metaCapiOutbox: 0 }, 'PostgreSQL unique constraint musí zadržať paralelný duplicate.');

    const fallbackId = randomUUID();
    const ajax = await submit(fallbackId);
    const native = await submit(fallbackId, { accept: 'text/html', userAgent: 'Opera native fallback simulation OPR/115' });
    assert.equal(ajax.response.status, 200);
    assert.equal(native.response.status, 303);
    assert.deepEqual(await snapshot(), { leads: 3, businessJobs: 3, linkedBusinessJobs: 3, metaCapiOutbox: 0 });

    const operaId = randomUUID();
    const operaFirst = await submit(operaId, { userAgent: 'Opera OPR/115' });
    const operaRetry = await submit(operaId, { userAgent: 'Opera OPR/115' });
    assert.equal(operaFirst.response.status, 200);
    assert.equal(operaRetry.response.status, 200);
    assert.deepEqual(await snapshot(), { leads: 4, businessJobs: 4, linkedBusinessJobs: 4, metaCapiOutbox: 0 });

    const fresh = await submit(randomUUID());
    assert.equal(fresh.response.status, 200);
    assert.deepEqual(await snapshot(), { leads: 5, businessJobs: 5, linkedBusinessJobs: 5, metaCapiOutbox: 0 });

    const beforeInvalid = await snapshot();
    const missing = await submit(undefined);
    const invalid = await submit('not-a-uuid');
    assert.equal(missing.response.status, 400);
    assert.equal(invalid.response.status, 400);
    assert.deepEqual(await snapshot(), beforeInvalid);

    console.log('PASS: PostgreSQL production-path idempotency — serial retry, parallel duplicate requests, AJAX/native simulation, Opera UA, missing and invalid UUID, no Meta event, no SMTP credentials.');
  } catch (error) {
    if (serverErrors.length) console.error(serverErrors.join(''));
    throw error;
  } finally {
    stopProcess(server);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
