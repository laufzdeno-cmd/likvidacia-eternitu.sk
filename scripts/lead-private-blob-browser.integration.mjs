/**
 * ASTANA E1 F04: isolated, repeatable browser -> private Blob -> SQL lead check.
 * Run: node scripts/lead-private-blob-browser.integration.mjs
 *
 * Scope: the existing Slovak lead form, two real >6 MiB PNGs, client multipart
 * upload, private header verification, one accepted lead/job and retained mail
 * outbox after an ambiguous first response and a same-form retry.
 * Safety: copies only source/config into a private temporary Next project; uses
 * an in-memory PGlite socket and a loopback Blob protocol emulator; launches
 * with a fresh, explicit env (no production credentials, SMTP or relay); denies
 * external browser and Node HTTP requests. Only its own temp tree is removed.
 * The emulator tests this SDK's wire contract, not Vercel service availability.
 */

import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const privateBlobHost = 'harness.private.blob.vercel-storage.com';

// This same file is preloaded into the child Next process. Its dispatcher is
// installed before Next or @vercel/blob loads; only the known private-Blob GET
// origin may be remapped. Standard HTTP and TCP egress is restricted to loopback.
if (process.env.ASTANA_HARNESS_CHILD === '1') {
  const require = createRequire(import.meta.url);
  const net = require('node:net');
  const http = require('node:http');
  const https = require('node:https');
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
  const assertLoopback = (host) => {
    if (!loopbackHosts.has(String(host || 'localhost').toLowerCase())) {
      throw new Error(`ASTANA harness denied external native network host: ${host}`);
    }
  };
  const assertSocketTarget = (args) => {
    const target = args[0];
    if (typeof target === 'number') assertLoopback(typeof args[1] === 'string' ? args[1] : 'localhost');
    else if (target && typeof target === 'object' && !target.path) assertLoopback(target.host || target.hostname);
    else if (typeof target !== 'string') throw new Error('ASTANA harness denied unknown native socket target');
  };
  const socketConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    assertSocketTarget(args);
    return socketConnect.apply(this, args);
  };
  // Node 25's net.connect can bypass a replaced Socket.prototype.connect in
  // its early argument-validation path. Guard the exported entry points too,
  // so the isolation check proves the boundary on the runtime actually used.
  const socketFactory = net.connect;
  const guardedSocketFactory = function (...args) {
    const target = args[0];
    if (typeof target === 'number') assertLoopback(typeof args[1] === 'string' ? args[1] : 'localhost');
    else if (typeof target === 'string') assertLoopback(typeof args[1] === 'number' ? target : 'localhost');
    else if (target && typeof target === 'object' && !target.path) assertLoopback(target.host || target.hostname || 'localhost');
    else if (typeof target !== 'string' && !(target && typeof target === 'object')) throw new Error('ASTANA harness denied unknown native socket target');
    return socketFactory.apply(this, args);
  };
  net.connect = guardedSocketFactory;
  net.createConnection = guardedSocketFactory;
  const nativeConnect = net.connect;
  net.connect = net.createConnection = function (...args) {
    assertSocketTarget(args);
    return nativeConnect.apply(this, args);
  };
  const guardNativeRequest = (module) => {
    const original = module.request;
    module.request = function (...args) {
      const target = args[0];
      if (typeof target === 'string' || target instanceof URL) assertLoopback(new URL(target).hostname);
      else if (target && typeof target === 'object') assertLoopback(target.hostname || target.host);
      else throw new Error('ASTANA harness denied unknown native HTTP target');
      return original.apply(this, args);
    };
  };
  guardNativeRequest(http);
  guardNativeRequest(https);
  syncBuiltinESMExports();
  const { Agent, Dispatcher, setGlobalDispatcher } = await import('undici');
  const destination = process.env.ASTANA_HARNESS_BLOB_ORIGIN;
  const appOrigin = process.env.ASTANA_HARNESS_APP_ORIGIN;
  assert.ok(destination && /^http:\/\/127\.0\.0\.1:\d+$/.test(destination));
  assert.ok(appOrigin && /^http:\/\/127\.0\.0\.1:\d+$/.test(appOrigin));
  const localAgent = new Agent();
  class LoopbackOnlyDispatcher extends Dispatcher {
    dispatch(options, handler) {
      const origin = String(options.origin);
      if (origin === `https://${privateBlobHost}`) {
        return localAgent.dispatch({ ...options, origin: destination }, handler);
      }
      if (origin === destination || origin === appOrigin) {
        return localAgent.dispatch(options, handler);
      }
      handler.onError(new Error(`ASTANA harness denied external HTTP origin: ${origin}`));
      return true;
    }
    close() { return localAgent.close(); }
    destroy(error) { return localAgent.destroy(error); }
  }
  setGlobalDispatcher(new LoopbackOnlyDispatcher());
  assert.throws(() => net.connect({ host: 'example.invalid', port: 443 }), /denied external native network host/);
  assert.throws(() => http.request('http://example.invalid/'), /denied external native network host/);
  await assert.rejects(fetch('https://example.invalid/'), (error) =>
    error?.cause?.message?.includes('ASTANA harness denied external HTTP origin: https://example.invalid') === true);
  const { default: next } = await import('next');
  const app = next({ dev: true, dir: process.cwd(), hostname: '127.0.0.1', port: Number(process.env.ASTANA_HARNESS_APP_PORT), webpack: true });
  await app.prepare();
  const server = createHttpServer((request, response) => app.getRequestHandler()(request, response));
  await listen(server, Number(process.env.ASTANA_HARNESS_APP_PORT));
  console.log('ASTANA isolated Next ready');
  process.once('SIGTERM', async () => {
    await new Promise((resolve) => server.close(resolve));
    await app.close();
    process.exit(0);
  });
} else {
  await runHarness();
}

async function availablePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => probe.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function listen(server, port) {
  await new Promise((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve));
}

async function readBody(request, limit = 11 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('Blob emulator rejected oversized body');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function json(response, status, value, cors = {}) {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...cors });
  response.end(body);
}

function decodeClientToken(token, readWriteToken) {
  assert.ok(token.startsWith('vercel_blob_client_harness_'), 'Blob client token must belong to this harness');
  const encoded = token.split('_')[4];
  const signed = Buffer.from(encoded, 'base64').toString('utf8');
  const separator = signed.indexOf('.');
  assert.ok(separator > 0, 'Blob client token signature missing');
  const signature = signed.slice(0, separator);
  const payloadBase64 = signed.slice(separator + 1);
  const expected = createHmac('sha256', readWriteToken).update(payloadBase64).digest('hex');
  assert.ok(signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)), 'Blob client token signature invalid');
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
  assert.equal(payload.access, undefined); // Access is provided per SDK request.
  assert.ok(payload.validUntil > Date.now(), 'Blob client token expired');
  assert.equal(payload.addRandomSuffix, false);
  assert.equal(payload.allowOverwrite, false);
  assert.ok(payload.maximumSizeInBytes <= 10 * 1024 * 1024);
  return payload;
}

function createBlobEmulator({ appOrigin, blobOrigin, readWriteToken }) {
  const uploads = new Map();
  const blobs = new Map();
  let failNextCareerCvPut = false;
  let failNextLeadHead = false;
  let failNextLeadPrivateGet = false;
  let hideNextLeadPrivateGet = false;
  const counts = { token: 0, create: 0, part: 0, complete: 0, head: 0, privateGet: 0, callback: 0, list: 0, delete: 0, denied: 0 };
  const cors = {
    'access-control-allow-origin': appOrigin,
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'authorization,x-api-version,x-api-blob-request-id,x-api-blob-request-attempt,x-vercel-blob-access,x-content-type,x-mpu-action,x-mpu-key,x-mpu-upload-id,x-mpu-part-number,content-type',
    'access-control-max-age': '60',
  };
  const server = createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url, blobOrigin);
      if (request.method === 'OPTIONS') {
        response.writeHead(204, cors); response.end(); return;
      }
      const auth = request.headers.authorization || '';
      const isReadWrite = auth === `Bearer ${readWriteToken}`;
      const isClient = auth.startsWith('Bearer vercel_blob_client_harness_');
      if (!isReadWrite && !isClient) {
        counts.denied++;
        json(response, 401, { error: { code: 'not_allowed' } }, cors); return;
      }
      const tokenPayload = isClient ? decodeClientToken(auth.slice(7), readWriteToken) : null;
      const pathname = url.searchParams.get('pathname') || '';
      if (request.method === 'PUT' && url.pathname === '/' && pathname.startsWith('career-cv/')) {
        assert.ok(isClient || isReadWrite, 'career CV must use a client token or server storage token');
        if (isClient) assert.equal(pathname, tokenPayload.pathname);
        assert.match(pathname, /^career-cv\/[0-9a-f]{32}\/[0-9a-f-]{36}\.pdf$/);
        assert.equal(request.headers['x-vercel-blob-access'], 'private');
        if (isClient) assert.ok(tokenPayload.allowedContentTypes.includes('application/pdf'));
        const bytes = await readBody(request, 6 * 1024 * 1024);
        assert.ok(bytes.length > 0 && bytes.length <= (tokenPayload?.maximumSizeInBytes || 5 * 1024 * 1024));
        if (isClient) assert.ok(bytes.length > 3_500_000);
        if (isClient && failNextCareerCvPut) {
          failNextCareerCvPut = false;
          json(response, 503, { error: { code: 'test_transient_failure' } }, cors); return;
        }
        assert.equal(blobs.has(pathname), false, 'a CV upload cannot overwrite an earlier private object');
        const blob = {
          pathname, url: `https://${privateBlobHost}/${pathname}`,
          downloadUrl: `https://${privateBlobHost}/${pathname}?download=1`,
          size: bytes.length, contentType: 'application/pdf', contentDisposition: 'attachment',
          cacheControl: 'private, no-store', uploadedAt: new Date().toISOString(),
          etag: createHash('sha256').update(bytes).digest('hex'),
        };
        blobs.set(pathname, { blob, bytes });
        counts.complete++;
        if (isClient) {
          counts.token++;
          const callback = tokenPayload.onUploadCompleted;
          assert.ok(callback && callback.callbackUrl === `${appOrigin}/api/kariera/cv-upload/`, 'career callback must stay on local app');
          const callbackBody = JSON.stringify({ type: 'blob.upload-completed', payload: { blob, tokenPayload: callback.tokenPayload } });
          const signature = createHmac('sha256', readWriteToken).update(callbackBody).digest('hex');
          const result = await fetch(callback.callbackUrl, {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-vercel-signature': signature }, body: callbackBody,
          });
          assert.equal(result.status, 200, `local career callback failed: ${(await result.text()).slice(0, 300)}`);
          counts.callback++;
        }
        json(response, 200, blob, cors); return;
      }
      if (request.method === 'POST' && url.pathname === '/mpu') {
        assert.ok(isClient, 'multipart uploads require client token');
        assert.equal(pathname, tokenPayload.pathname);
        assert.match(pathname, /^lead-drafts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/);
        assert.equal(request.headers['x-vercel-blob-access'], 'private');
        assert.equal(request.headers['x-content-type'], 'image/png');
        assert.ok(tokenPayload.allowedContentTypes.includes('image/png'));
        const action = request.headers['x-mpu-action'];
        if (action === 'create') {
          const uploadId = randomUUID();
          uploads.set(uploadId, { pathname, tokenPayload, parts: new Map() });
          counts.token++; counts.create++;
          json(response, 200, { key: pathname, uploadId }, cors); return;
        }
        const uploadId = request.headers['x-mpu-upload-id'];
        const upload = uploads.get(uploadId);
        assert.ok(upload && upload.pathname === pathname, 'unknown multipart upload');
        assert.equal(decodeURIComponent(request.headers['x-mpu-key']), pathname);
        if (action === 'upload') {
          const partNumber = Number(request.headers['x-mpu-part-number']);
          assert.ok(Number.isInteger(partNumber) && partNumber > 0);
          const bytes = await readBody(request);
          assert.ok(bytes.length > 0 && bytes.length <= 8 * 1024 * 1024);
          const etag = createHash('sha256').update(bytes).digest('hex');
          upload.parts.set(partNumber, { etag, bytes });
          counts.part++;
          json(response, 200, { etag }, cors); return;
        }
        if (action === 'complete') {
          const parts = JSON.parse((await readBody(request, 100_000)).toString('utf8'));
          assert.ok(Array.isArray(parts) && parts.length > 0);
          const bytes = Buffer.concat(parts.map((part) => {
            const saved = upload.parts.get(part.partNumber);
            assert.ok(saved && saved.etag === part.etag, 'multipart part mismatch');
            return saved.bytes;
          }));
          assert.ok(bytes.length > 6 * 1024 * 1024 && bytes.length <= upload.tokenPayload.maximumSizeInBytes);
          const blob = {
            pathname,
            url: `https://${privateBlobHost}/${pathname}`,
            downloadUrl: `https://${privateBlobHost}/${pathname}?download=1`,
            size: bytes.length,
            contentType: 'image/png',
            contentDisposition: 'inline',
            cacheControl: 'private, no-store',
            uploadedAt: new Date().toISOString(),
            etag: createHash('sha256').update(bytes).digest('hex'),
          };
          blobs.set(pathname, { blob, bytes });
          uploads.delete(uploadId);
          counts.complete++;
          const callback = upload.tokenPayload.onUploadCompleted;
          assert.ok(callback && callback.callbackUrl === `${appOrigin}/api/lead-upload/`, 'callback must stay on local app');
          const callbackBody = JSON.stringify({ type: 'blob.upload-completed', payload: { blob, tokenPayload: callback.tokenPayload } });
          const signature = createHmac('sha256', readWriteToken).update(callbackBody).digest('hex');
          const result = await fetch(callback.callbackUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-vercel-signature': signature },
            body: callbackBody,
          });
          assert.equal(result.status, 200, `local upload callback failed: ${(await result.text()).slice(0, 300)}`);
          counts.callback++;
          json(response, 200, blob, cors); return;
        }
        throw new Error(`unsupported multipart action ${action}`);
      }
      if (request.method === 'GET' && url.pathname === '/' && url.searchParams.has('url')) {
        assert.ok(isReadWrite, 'head requires server token');
        if (failNextLeadHead) {
          failNextLeadHead = false;
          json(response, 503, { error: { code: 'test_storage_unavailable', message: 'PRIVATE_DIAGNOSTIC_DO_NOT_EXPOSE' } }, cors); return;
        }
        const entry = blobs.get(url.searchParams.get('url'));
        if (!entry) { json(response, 404, { error: { code: 'not_found' } }, cors); return; }
        counts.head++;
        json(response, 200, entry.blob, cors); return;
      }
      if (request.method === 'GET' && url.pathname === '/' && url.searchParams.has('prefix')) {
        assert.ok(isReadWrite, 'private inventory requires server token');
        assert.equal(url.searchParams.get('prefix'), 'lead-drafts/');
        assert.equal(url.searchParams.get('mode'), 'expanded');
        const limit = Number(url.searchParams.get('limit'));
        assert.equal(limit, 100);
        const offset = Number(url.searchParams.get('cursor') || 0);
        const matching = [...blobs.values()].map((entry) => entry.blob)
          .filter((blob) => blob.pathname.startsWith('lead-drafts/'))
          .sort((a, b) => a.pathname.localeCompare(b.pathname));
        const page = matching.slice(offset, offset + limit);
        counts.list++;
        json(response, 200, { blobs: page, hasMore: offset + limit < matching.length,
          ...(offset + limit < matching.length ? { cursor: String(offset + limit) } : {}) }, cors); return;
      }
      if (request.method === 'POST' && url.pathname === '/delete') {
        assert.ok(isReadWrite, 'private deletion requires server token');
        const payload = JSON.parse((await readBody(request, 100_000)).toString('utf8'));
        assert.ok(Array.isArray(payload.urls) && payload.urls.length > 0 && payload.urls.length <= 50);
        for (const item of payload.urls) {
          const pathname = String(item).startsWith(`https://${privateBlobHost}/`)
            ? new URL(item).pathname.slice(1) : String(item);
          assert.ok(pathname.startsWith('lead-drafts/'));
          if (!blobs.has(pathname)) {
            json(response, 404, { error: { code: 'not_found' } }, cors); return;
          }
          const expectedEtag = request.headers['x-if-match'];
          if (expectedEtag && blobs.get(pathname)?.blob.etag !== expectedEtag) {
            json(response, 412, { error: { code: 'precondition_failed' } }, cors); return;
          }
          blobs.delete(pathname);
          counts.delete++;
        }
        json(response, 200, {}, cors); return;
      }
      if (request.method === 'GET' && (url.pathname.startsWith('/lead-drafts/') || url.pathname.startsWith('/career-cv/'))) {
        assert.ok(isReadWrite, 'private get requires server token');
        if (url.pathname.startsWith('/lead-drafts/') && hideNextLeadPrivateGet) {
          hideNextLeadPrivateGet = false;
          json(response, 404, { error: { code: 'not_found' } }, cors); return;
        }
        if (url.pathname.startsWith('/lead-drafts/') && failNextLeadPrivateGet) {
          failNextLeadPrivateGet = false;
          json(response, 503, { error: { code: 'test_storage_unavailable', message: 'PRIVATE_DIAGNOSTIC_DO_NOT_EXPOSE' } }, cors); return;
        }
        const entry = blobs.get(url.pathname.slice(1));
        if (!entry) { json(response, 404, { error: { code: 'not_found' } }, cors); return; }
        counts.privateGet++;
        response.writeHead(200, {
          'content-type': entry.blob.contentType,
          'content-length': entry.bytes.length,
          'cache-control': 'private, no-store',
          ...cors,
        });
        response.end(entry.bytes); return;
      }
      throw new Error(`unsupported Blob API request ${request.method} ${url.pathname}`);
    } catch (error) {
      console.error('Blob emulator:', error.message);
      json(response, 500, { error: { code: 'unknown_error', message: error.message } }, cors);
    }
  });
  return { server, blobs, counts, failOneCareerCvPut: () => { failNextCareerCvPut = true; }, failOneLeadHead: () => { failNextLeadHead = true; }, failOneLeadPrivateGet: () => { failNextLeadPrivateGet = true; }, hideOneLeadPrivateGet: () => { hideNextLeadPrivateGet = true; } };
}

async function createTempProject(tempRoot, historicalClient) {
  for (const name of ['app', 'src', 'public']) {
    await cp(path.join(projectRoot, name), path.join(tempRoot, name), { recursive: true });
  }
  for (const name of ['package.json', 'next.config.mjs', 'tsconfig.json']) {
    await cp(path.join(projectRoot, name), path.join(tempRoot, name));
  }
  if (historicalClient) {
    const previousClient = execFileSync('git', ['show', '3f48aee589dba53041d78a26df4561e4f1bd22c4:app/homepage-critical-client.tsx'], {
      cwd: projectRoot, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
    });
    await writeFile(path.join(tempRoot, 'app', 'homepage-critical-client.tsx'), previousClient, 'utf8');
  }
  const relativeTempRoot = path.relative(projectRoot, tempRoot);
  const tempRootIsProjectDescendant = relativeTempRoot !== ''
    && relativeTempRoot !== '..'
    && !relativeTempRoot.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativeTempRoot);
  if (!tempRootIsProjectDescendant) {
    await symlink(path.join(projectRoot, 'node_modules'), path.join(tempRoot, 'node_modules'), 'junction');
  }
  // Next's client upload is intentionally pointed at a loopback HTTP emulator.
  // This temporary-only config disables the production CSP for that one test
  // document; source config in the repository remains byte-for-byte untouched.
  const configPath = path.join(tempRoot, 'next.config.mjs');
  const config = await readFile(configPath, 'utf8');
  assert.ok(config.includes("connect-src 'self'"));
  await writeFile(configPath, config.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:*"), 'utf8');
}

async function waitForApp(origin, child, logs) {
  const deadline = Date.now() + 90_000;
  let lastHttpStatus = 'no HTTP response';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next exited early (${child.exitCode}): ${logs().slice(-3500)}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
      lastHttpStatus = `${response.status} ${response.statusText} at ${response.url}`;
    } catch (error) {
      const code = error?.cause?.code || error?.code || error?.name || 'fetch error';
      lastHttpStatus = `${code}: ${error?.message || String(error)}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Next did not start within 90s (${lastHttpStatus}): ${logs().slice(-3500)}`);
}

async function checkPriceCalculatorMatrix(page, selector, minimumArea, usePointer) {
  const calculator = page.locator(selector);
  const slider = calculator.locator('[data-price-area]');
  const rates = {
    vlnity: [8, 14],
    hladky: [9, 15],
    boleticky: [11, 18],
    neviem: [8, 16],
  };
  if (!usePointer) assert.equal(await slider.inputValue(), '120', `${selector} must start at the displayed default area`);
  assert.equal(await calculator.locator('.price-result').getAttribute('aria-live'), 'polite');
  assert.equal(await calculator.locator('.price-materials').getAttribute('role'), 'group');
  for (const area of [120, minimumArea, 500]) {
    await slider.evaluate((input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, area);
    for (const [material, [minimumRate, maximumRate]] of Object.entries(rates)) {
      const button = calculator.locator(`[data-price-material="${material}"]`);
      if (usePointer) await button.click();
      else await button.evaluate((element) => element.click());
      assert.equal(await calculator.locator('[data-price-area-output]').innerText(), `${area} m2`);
      const minimum = Number((await calculator.locator('[data-price-min]').innerText()).replace(/\D/g, ''));
      const maximum = Number((await calculator.locator('[data-price-max]').innerText()).replace(/\D/g, ''));
      assert.equal(minimum, Math.round(area * minimumRate / 10) * 10, `${selector}: ${area} m2 / ${material} minimum`);
      assert.equal(maximum, Math.round(area * maximumRate / 10) * 10, `${selector}: ${area} m2 / ${material} maximum`);
      assert.equal(await calculator.locator('[data-price-material].is-active').count(), 1);
      assert.equal(await calculator.locator('[data-price-material][aria-pressed="true"]').count(), 1);
      assert.equal(await button.evaluate((element) => element.classList.contains('is-active')), true,
        `${selector}: ${material} must own the visual active state`);
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
    }
  }
}

async function runPriceQuoteChecks(page, appOrigin, tempRoot) {
  await page.goto(appOrigin, { waitUntil: 'networkidle' });
  assert.ok((await page.locator('body').innerText()).includes('Likvidácia azbestu'));
  assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0);
  await checkPriceCalculatorMatrix(page, '[data-price-calculator]', 10, false);
  await page.locator('[data-price-calculator]').scrollIntoViewIfNeeded();
  await checkPriceCalculatorMatrix(page, '[data-price-calculator]', 10, true);
  await page.locator('#city').fill('Zachovaná obec');
  await page.locator('#price-area').evaluate((input) => {
    input.value = '240';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('[data-price-material="hladky"]').click();
  await page.locator('[data-price-quote]').click();
  assert.equal(await page.locator('#areaEstimate').inputValue(), '240');
  assert.equal(await page.locator('#city').inputValue(), 'Zachovaná obec');
  assert.equal(await page.locator('#materialType').inputValue(), 'Hladký / štvorcový eternit');
  assert.equal(await page.locator('#email').inputValue(), '');
  assert.equal(await page.locator('input[name="gdpr"]').isChecked(), false);

  await page.goto(`${appOrigin}/cena-likvidacie-azbestu/`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0);
  assert.equal(await page.locator('[data-price-city]').count(), 0, 'price calculator must not ask for locality');
  await checkPriceCalculatorMatrix(page, '.price-calculator', 30, false);
  await page.locator('.price-calculator').scrollIntoViewIfNeeded();
  await checkPriceCalculatorMatrix(page, '.price-calculator', 30, true);
  await page.locator('#priceArea').evaluate((input) => {
    input.value = '300';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('[data-price-material="neviem"]').click();
  await page.locator('[data-price-quote]').click();
  await page.waitForURL(`${appOrigin}/#dopyt`);
  await page.waitForFunction(() => document.querySelector('#areaEstimate')?.value === '300', null, { timeout: 5000 });
  assert.equal(await page.locator('#areaEstimate').inputValue(), '300');
  assert.equal(await page.locator('#city').inputValue(), '');
  assert.equal(await page.locator('#materialType').inputValue(), 'Neviem posúdiť');
  assert.equal(await page.locator('#email').inputValue(), '');
  assert.equal(await page.locator('input[name="gdpr"]').isChecked(), false);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('astana:price-quote-draft:v1')), null);

  const essentialCookies = page.getByRole('button', { name: 'Len nevyhnutné' });
  if (await essentialCookies.isVisible()) await essentialCookies.click();

  const screenshotDir = path.join(tempRoot, 'price-quote-evidence');
  await mkdir(screenshotDir, { recursive: true });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto(`${appOrigin}/cena-likvidacie-azbestu/`, { waitUntil: 'networkidle' });
    const sizes = await page.locator('.price-calculator').evaluate((root) => {
      const cta = root.querySelector('[data-price-quote]').getBoundingClientRect();
      return { cityFields: root.querySelectorAll('[data-price-city]').length, ctaLeft: cta.left, ctaRight: cta.right, viewport: innerWidth };
    });
    assert.equal(sizes.cityFields, 0, `price calculator must not show a locality field at ${width}px`);
    assert.ok(sizes.ctaLeft >= 0 && sizes.ctaRight <= sizes.viewport + 1, `quote CTA clipped at ${width}px: ${JSON.stringify(sizes)}`);
    assert.equal(await page.locator('[data-price-quote]').evaluate((element) => getComputedStyle(element).color), 'rgb(255, 255, 255)', 'price quote CTA requires contrasting white text');
    assert.equal(await page.locator('.whatsapp-btn').evaluate((element) => getComputedStyle(element).display), 'none', 'mobile price CTA must not be obscured by floating WhatsApp');
    await page.locator('.price-calculator').screenshot({ path: path.join(screenshotDir, `price-quote-${width}.png`) });
    await page.locator('[data-price-quote]').click();
    await page.waitForURL(`${appOrigin}/#dopyt`);
    await page.waitForFunction(() => document.querySelector('#areaEstimate')?.value === '120');
    await page.locator('[data-price-calculator]').scrollIntoViewIfNeeded();
    const homepageSizes = await page.locator('[data-price-calculator]').evaluate((root) => {
      const cta = root.querySelector('[data-price-quote]').getBoundingClientRect();
      return { cityFields: root.querySelectorAll('[data-price-city]').length, ctaLeft: cta.left, ctaRight: cta.right, viewport: innerWidth };
    });
    assert.equal(homepageSizes.cityFields, 0, `homepage calculator must stay compact at ${width}px`);
    assert.ok(homepageSizes.ctaLeft >= 0 && homepageSizes.ctaRight <= homepageSizes.viewport + 1, `homepage quote CTA clipped at ${width}px`);
    assert.equal(await page.locator('[data-price-quote]').evaluate((element) => getComputedStyle(element).color), 'rgb(255, 255, 255)', 'homepage quote CTA requires contrasting white text');
    await page.waitForFunction(() => !document.querySelector('.mobile-sticky-cta')?.classList.contains('is-visible'));
    await page.locator('[data-price-calculator]').screenshot({ path: path.join(screenshotDir, `home-price-quote-${width}.png`) });
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${appOrigin}/cena-likvidacie-azbestu/`, { waitUntil: 'networkidle' });
  assert.notEqual(await page.locator('.whatsapp-btn').evaluate((element) => getComputedStyle(element).display), 'none', 'desktop price page keeps WhatsApp');
  return { calculatorSamePage: true, calculatorCrossPage: true, priceMatrix: 'both routes, all materials, default/min/max, before/after scroll', priceQuoteMobileWidths: [320, 390], formsSubmitted: 0 };
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const waitForExit = (milliseconds) => Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), milliseconds)),
  ]);
  child.kill('SIGTERM');
  if (await waitForExit(5000) || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGKILL');
  if (await waitForExit(5000) || child.exitCode !== null || child.signalCode !== null) return;
  throw new Error(`Owned local Next process ${child.pid} did not exit; its temp directory must not be removed while it is running.`);
}

function assertOwnedTempRoot(tempRoot) {
  const resolved = path.resolve(tempRoot);
  const parent = path.resolve(tmpdir());
  assert.equal(path.dirname(resolved).toLowerCase(), parent.toLowerCase(), 'teardown target must be directly under os.tmpdir()');
  assert.match(path.basename(resolved), /^astana-e1-f04-[A-Za-z0-9]+$/, 'teardown target must be this harness temp');
  return resolved;
}

async function pngFixture(sharp, label) {
  const width = 1600;
  const height = 1450;
  const raw = randomBytes(width * height * 3);
  const bytes = await sharp(raw, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 1 }).toBuffer();
  assert.ok(bytes.length > 6 * 1024 * 1024 && bytes.length < 10 * 1024 * 1024, `${label} must be 6–10 MiB`);
  const decoded = await sharp(bytes).metadata();
  assert.equal(decoded.format, 'png');
  assert.equal(decoded.width, width);
  assert.equal(decoded.height, height);
  return { name: `${label}.png`, mimeType: 'image/png', buffer: bytes };
}

async function runTenPhotoUploadChecks(page, pglite, fake, appOrigin, tempRoot, sharp, firstImage, secondImage) {
  const photos = [firstImage, secondImage];
  for (const suffix of 'cdefghij') photos.push(await pngFixture(sharp, `astana-e1-f04-${suffix}`));
  assert.equal(photos.length, 10);
  const expectedBytes = new Map(photos.map((photo) => [photo.name, photo.buffer]));
  const fixtureDir = path.join(tempRoot, 'ten-private-photos');
  await mkdir(fixtureDir);
  const fixturePaths = [];
  for (const photo of photos) {
    const fixturePath = path.join(fixtureDir, photo.name);
    await writeFile(fixturePath, photo.buffer);
    fixturePaths.push(fixturePath);
  }
  const before = { ...fake.counts };
  let leadPosts = 0;
  await page.route('**/api/dopyt/', async (route) => {
    leadPosts++;
    await route.continue();
  });

  const response = await page.goto(`${appOrigin}/#dopyt`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  assert.equal(response?.status(), 200, 'the ten-photo form must render');
  await page.locator('a[href="#dopyt"]').first().click();
  await page.waitForFunction(() => window.__astanaPhotoHandlerReady === true, null, { timeout: 30_000 });
  assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0, 'no development error overlay before submission');
  await page.locator('#areaEstimate').fill('120');
  await page.locator('#city').fill('Poprad');
  await page.locator('#materialType').selectOption('Vlnitý eternit');
  await page.locator('#objectType').selectOption('Rodinný dom');
  await page.locator('#phone').fill('+421900000001');
  await page.locator('#fullName').fill('Izolovaný test desiatich fotiek');
  await page.locator('#email').fill('ten-private-photos@example.invalid');
  await page.locator('input[name="gdpr"]').check();
  await page.locator('#photos').setInputFiles(fixturePaths);
  await page.waitForFunction(() => document.querySelectorAll('.file-chip').length === 10
    && document.querySelector('#photos')?.files?.length === 10
    && !document.querySelector('#photos')?.disabled, null, { timeout: 60_000 });
  const submissionId = randomUUID();
  await page.evaluate((id) => { document.querySelector('#submissionId').value = id; }, submissionId);
  await page.locator('.lead-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.lead-form')?.classList.contains('is-submitted')
    || document.querySelector('.form-status')?.classList.contains('is-error'), null, { timeout: 180_000 });
  if (await page.locator('.form-status.is-error').count()) {
    const buckets = await pglite.query('SELECT hit_count FROM api_rate_limit_buckets ORDER BY hit_count DESC');
    console.error('Ten-photo isolated failure counts:', { rateLimitHits: buckets.rows.map((row) => row.hit_count),
      tokenRequests: fake.counts.token - before.token, uploadsCompleted: fake.counts.complete - before.complete,
      callbacks: fake.counts.callback - before.callback, leadPosts });
  }
  assert.equal(await page.locator('.form-status.is-error').count(), 0,
    `ten-photo form rejected submission: ${await page.locator('.form-status').innerText()}`);
  assert.equal(await page.locator('.lead-form.is-submitted').count(), 1, 'browser must show accepted lead');
  assert.equal(await page.locator('.form-status').getAttribute('tabindex'), '-1',
    'the ten-photo success confirmation must be programmatically focusable');
  assert.equal(await page.locator('.form-status').evaluate((element) => document.activeElement === element), true,
    'the ten-photo success confirmation must receive focus');
  assert.equal(leadPosts, 1, 'one click must produce exactly one lead POST');
  const leads = await pglite.query('SELECT id FROM leads WHERE submission_id = $1', [submissionId]);
  assert.equal(leads.rowCount, 1, 'ten photos must belong to one accepted lead');
  assert.equal((await pglite.query('SELECT id FROM business_jobs WHERE lead_id = $1', [leads.rows[0].id])).rowCount, 1);
  const files = await pglite.query(
    'SELECT original_name, storage_key, storage_driver, mime_type, size_bytes FROM lead_files WHERE lead_id = $1 ORDER BY original_name',
    [leads.rows[0].id],
  );
  assert.equal(files.rowCount, 10, 'all ten physically uploaded files must be attached');
  assert.deepEqual(files.rows.map((row) => row.original_name), [...expectedBytes.keys()].sort());
  for (const row of files.rows) {
    assert.equal(row.storage_driver, 'vercel_blob');
    assert.equal(row.mime_type, 'image/png');
    assert.ok(row.size_bytes > 6 * 1024 * 1024 && row.size_bytes < 10 * 1024 * 1024);
    assert.ok(fake.blobs.get(row.storage_key)?.bytes.equals(expectedBytes.get(row.original_name)),
      `private Blob bytes differ for ${row.original_name}`);
    const anonymous = await fetch(`${fake.blobOrigin}/${row.storage_key}`);
    assert.equal(anonymous.status, 401, 'an anonymous user cannot open an uploaded photo');
  }
  const drafts = await pglite.query('SELECT status, lead_id FROM lead_upload_drafts WHERE submission_id = $1', [submissionId]);
  assert.equal(drafts.rowCount, 10);
  assert.ok(drafts.rows.every((row) => row.status === 'attached' && row.lead_id === leads.rows[0].id));
  const outbox = await pglite.query('SELECT recipient_role, status, attempts FROM lead_email_outbox WHERE lead_id = $1 ORDER BY recipient_role', [leads.rows[0].id]);
  assert.deepEqual(outbox.rows.map((row) => row.recipient_role), ['customer', 'internal']);
  assert.ok(outbox.rows.every((row) => row.status === 'pending' && row.attempts === 0), 'no external email may be sent');
  for (const key of ['create', 'part', 'complete', 'callback']) {
    assert.equal(fake.counts[key] - before[key], 10, `ten photos require ten real multipart ${key} events`);
  }
  return { lead: 1, privateAttachments: files.rowCount, multipartCompletes: fake.counts.complete - before.complete,
    pendingOutbox: outbox.rowCount, emailsSent: 0, browserPosts: leadPosts };
}

async function runNoPhotoUiChecks(page, pglite, fake, appOrigin) {
  const before = { ...fake.counts };
  let leadPosts = 0;
  await page.route('**/api/dopyt/', async (route) => {
    leadPosts++;
    await route.continue();
  });
  const response = await page.goto(`${appOrigin}/#dopyt`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  assert.equal(response?.status(), 200, 'the no-photo lead form must render');
  await page.locator('#dopyt').scrollIntoViewIfNeeded();
  await page.locator('#areaEstimate').focus();
  await page.waitForFunction(() => window.__astanaPhotoHandlerReady === true, null, { timeout: 30_000 });
  await page.locator('#email').focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.lead-form')?.getAttribute('data-active-step') === '3');
  assert.equal(await page.locator('#email').isVisible(), true,
    'desktop-to-mobile transition must keep the focused contact field visible');
  assert.equal(await page.locator('#email').evaluate((element) => document.activeElement === element), true,
    'desktop-to-mobile transition must not lose focus from the active field');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('#areaEstimate').fill('120');
  await page.locator('#city').fill('Poprad');
  await page.locator('#materialType').selectOption('Vlnitý eternit');
  await page.locator('#objectType').selectOption('Rodinný dom');
  await page.locator('#phone').fill('+421900000007');
  await page.locator('#fullName').fill('TEST-UPGRADE bez fotografie – nekontaktovať');
  await page.locator('#email').fill('no-photo-ui@example.invalid');
  await page.locator('input[name="gdpr"]').check();
  assert.equal(await page.locator('#photos').evaluate((input) => input.files?.length), 0);
  await page.locator('.lead-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.lead-form')?.classList.contains('is-submitted')
    || document.querySelector('.form-status')?.classList.contains('is-error'), null, { timeout: 90_000 });
  assert.equal(await page.locator('.form-status.is-error').count(), 0,
    `no-photo form rejected submission: ${await page.locator('.form-status').innerText()}`);
  assert.equal(await page.locator('.lead-form.is-submitted').count(), 1, 'the UI must show an accepted no-photo lead');
  assert.equal(await page.locator('.form-status').getAttribute('tabindex'), '-1',
    'the no-photo success confirmation must be programmatically focusable');
  assert.equal(await page.locator('.form-status').evaluate((element) => document.activeElement === element), true,
    'the no-photo success confirmation must receive focus');
  const confirmationText = await page.locator('.form-status').innerText();
  assert.match(confirmationText, /Dopyt sme prijali/, 'the UI must acknowledge the stored request');
  assert.match(confirmationText, /Potvrdenie emailom ešte overujeme/, 'pending email must be described honestly');
  assert.doesNotMatch(confirmationText, /Potvrdenie sme poslali/, 'pending email must not be claimed as delivered');
  assert.equal(leadPosts, 1, 'one click must make exactly one lead POST');
  const submissionId = await page.locator('#submissionId').inputValue();
  assert.match(submissionId, /^[0-9a-f-]{36}$/i, 'the UI must generate a stable submission ID');
  const leads = await pglite.query('SELECT id FROM leads WHERE submission_id = $1', [submissionId]);
  assert.equal(leads.rowCount, 1, 'the UI click must persist exactly one lead');
  const leadId = leads.rows[0].id;
  assert.equal((await pglite.query('SELECT id FROM business_jobs WHERE lead_id = $1', [leadId])).rowCount, 1,
    'the accepted lead must have one linked job');
  assert.equal((await pglite.query('SELECT id FROM lead_files WHERE lead_id = $1', [leadId])).rowCount, 0,
    'a no-photo lead must not invent attachments');
  assert.equal((await pglite.query('SELECT submission_id FROM lead_upload_drafts WHERE submission_id = $1', [submissionId])).rowCount, 0,
    'a no-photo lead must not create upload reservations');
  const outbox = await pglite.query('SELECT recipient_role, status, attempts FROM lead_email_outbox WHERE lead_id = $1 ORDER BY recipient_role', [leadId]);
  assert.deepEqual(outbox.rows.map((row) => row.recipient_role), ['customer', 'internal']);
  assert.ok(outbox.rows.every((row) => row.status === 'pending' && row.attempts === 0),
    'the isolated UI test must not send real email or claim delivery');
  for (const key of ['create', 'part', 'complete', 'callback']) {
    assert.equal(fake.counts[key] - before[key], 0, `no-photo UI must not use Blob ${key}`);
  }
  return { lead: 1, businessJobs: 1, privateAttachments: 0, browserPosts: leadPosts,
    pendingOutbox: 2, emailsSent: 0, blobUploads: 0 };
}

async function runGalleryMobileChecks(page, appOrigin, tempRoot) {
  const browserErrors = [];
  const heroImageRequests = [];
  const galleryImageRequests = [];
  const reviewedGalleryNames = new Set([
    'azbest-134.', 'azbest-130.', 'azbest-006.', 'azbest-132.', 'azbest-011.', 'azbest-017.',
    'azbest-014.', 'azbest-021.', 'azbest-022.', 'azbest-026.', 'azbest-118.', 'azbest-124.',
  ]);
  page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`); });
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') browserErrors.push(`request: ${request.url()}`);
  });
  page.on('request', (request) => {
    const decodedUrl = decodeURIComponent(request.url());
    if (decodedUrl.includes('azbest-087.')) heroImageRequests.push(decodedUrl);
    if ([...reviewedGalleryNames].some((name) => decodedUrl.includes(name))) galleryImageRequests.push(decodedUrl);
  });
  const screenshots = process.env.ASTANA_HARNESS_GALLERY_SCREENSHOTS === '1'
    ? path.join(tempRoot, 'gallery-evidence') : null;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto(`${appOrigin}/realizacie/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  assert.equal(response?.status(), 200, 'realizations page must render in the isolated local app');
  await page.locator('[data-gallery-card]').first().waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector('[data-gallery-filter].is-active'), null, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('.realizations-hero-strip img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  }, null, { timeout: 30_000 });
  assert.equal(heroImageRequests.filter((url) => url.includes('azbest-087.webp')).length, 1,
    'the LCP hero must load one WebP resource');
  assert.equal(heroImageRequests.filter((url) => url.includes('azbest-087.jpg')).length, 0,
    'the WebP-capable browser must not download the hero JPG fallback');
  assert.equal(galleryImageRequests.length, 0,
    'reviewed gallery photos must not compete with the hero before the user approaches the gallery');
  assert.match(await page.locator('h1').innerText(), /realizácie/i);
  assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0, 'no framework error overlay');
  await page.getByRole('button', { name: 'Len nevyhnutné' }).click();
  const mobileWidth = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  assert.ok(mobileWidth.page <= mobileWidth.viewport, `390px gallery overflows horizontally: ${JSON.stringify(mobileWidth)}`);
  assert.equal(await page.locator('.mobile-sticky-cta').evaluate((element) => element.inert), true,
    'hidden sticky CTA must be inert before it is displayed');
  await page.evaluate(async () => {
    for (let y = 360; y <= 420; y += 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
  await page.waitForFunction(() => document.querySelector('.mobile-sticky-cta')?.classList.contains('is-visible') === false);
  await page.evaluate(async () => {
    for (let y = 420; y >= 360; y -= 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
  await page.waitForFunction(() => {
    const sticky = document.querySelector('.mobile-sticky-cta');
    const whatsapp = document.querySelector('.whatsapp-btn');
    return sticky instanceof HTMLElement && !sticky.inert && whatsapp instanceof HTMLElement && whatsapp.inert;
  }, null, { timeout: 10_000 });
  const stickyFocusState = await page.evaluate(() => {
    const stickyLink = document.querySelector('.mobile-sticky-cta a');
    const whatsapp = document.querySelector('.whatsapp-btn');
    if (!stickyLink || !whatsapp) return null;
    stickyLink.focus();
    const stickyFocusableWhenVisible = document.activeElement === stickyLink;
    whatsapp.focus();
    return { stickyFocusableWhenVisible, hiddenWhatsappFocusable: document.activeElement === whatsapp };
  });
  assert.deepEqual(stickyFocusState, { stickyFocusableWhenVisible: true, hiddenWhatsappFocusable: false },
    'only the visible mobile contact control may receive focus');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => {
    const sticky = document.querySelector('.mobile-sticky-cta');
    const whatsapp = document.querySelector('.whatsapp-btn');
    return sticky instanceof HTMLElement && sticky.inert && whatsapp instanceof HTMLElement && !whatsapp.inert;
  }, null, { timeout: 10_000 });

  const initialGalleryCard = page.locator('[data-gallery-card]:not([hidden])').first();
  await initialGalleryCard.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-gallery-card]:not([hidden]) img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 1;
  }, null, { timeout: 20_000 });
  assert.ok(galleryImageRequests.length > 0, 'approaching the gallery must activate nearby reviewed photos');
  assert.equal(galleryImageRequests.some((url) => url.endsWith('.jpg') || url.includes('.jpg&')), false,
    'a WebP-capable browser must not download reviewed gallery JPG fallbacks');
  const visibleGalleryWebp = new Set(await page.locator('[data-gallery-card]:not([hidden])')
    .evaluateAll((cards) => cards.map((card) => card.dataset.galleryWebp)));
  assert.equal(galleryImageRequests.every((url) => [...visibleGalleryWebp].some((src) => src && url.includes(src))), true,
    'cards that remain hidden must not download their gallery photos');

  const category = await page.locator('[data-gallery-filter]').nth(1).getAttribute('data-gallery-filter');
  await page.locator('[data-gallery-filter]').nth(1).click();
  const pressedFilters = await page.locator('[data-gallery-filter][aria-pressed="true"]').count();
  assert.equal(pressedFilters, 1, 'only the selected gallery filter is announced to assistive technology');
  const visibleCategories = await page.locator('[data-gallery-card]:not([hidden])').evaluateAll((cards) => cards.map((card) => card.dataset.galleryCategory));
  assert.ok(visibleCategories.length > 0 && visibleCategories.every((value) => value === category), 'gallery filter must show only its category');
  if (screenshots) await page.screenshot({ path: path.join(screenshots, 'gallery-390.png') });
  const card = page.locator('[data-gallery-card]:not([hidden])').first();
  await card.click();
  await page.waitForFunction(() => document.querySelector('[data-gallery-lightbox]')?.hidden === false, null, { timeout: 10_000 });
  await page.waitForFunction(() => document.querySelector('[data-lightbox-image]')?.naturalWidth > 0, null, { timeout: 20_000 });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-lightbox-close') !== null), true, 'opening must focus the close control');
  const firstImage = await page.locator('[data-lightbox-image]').getAttribute('src');
  await page.locator('[data-lightbox-next]').click();
  assert.notEqual(await page.locator('[data-lightbox-image]').getAttribute('src'), firstImage, 'next button changes the photo');
  await page.locator('[data-lightbox-prev]').click();
  assert.equal(await page.locator('[data-lightbox-image]').getAttribute('src'), firstImage, 'previous button returns to the photo');
  if (screenshots) await page.screenshot({ path: path.join(screenshots, 'lightbox-390.png') });
  await page.locator('[data-lightbox-next]').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-lightbox-close') !== null), true, 'Tab must remain within the dialog');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-lightbox-next') !== null), true, 'Shift+Tab must remain within the dialog');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-gallery-lightbox]').evaluate((dialog) => dialog.hidden), true);
  assert.equal(await card.evaluate((element) => document.activeElement === element), true, 'Escape must restore focus to the originating photo');

  await page.setViewportSize({ width: 320, height: 740 });
  const narrowWidth = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  assert.ok(narrowWidth.page <= narrowWidth.viewport, `320px gallery overflows horizontally: ${JSON.stringify(narrowWidth)}`);
  await card.click();
  const closeRect = await page.locator('[data-lightbox-close]').boundingBox();
  assert.ok(closeRect && closeRect.x >= 0 && closeRect.y >= 0 && closeRect.x + closeRect.width <= 320,
    `close control must stay visible at 320px: ${JSON.stringify(closeRect)}`);
  const imageWidth = await page.locator('[data-lightbox-image]').evaluate((image) => image.getBoundingClientRect().width);
  assert.ok(imageWidth > 0 && imageWidth <= 320, 'full-size image must fit a narrow viewport');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden', 'background scrolling must be locked while the gallery is open');
  if (screenshots) await page.screenshot({ path: path.join(screenshots, 'lightbox-320.png') });
  await page.locator('[data-lightbox-close]').click();
  assert.equal(await page.locator('[data-gallery-lightbox]').evaluate((dialog) => dialog.hidden), true);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden', 'background scrolling must be restored after closing');
  const portraitCard = page.locator('[data-gallery-card][data-gallery-index="1"]');
  await portraitCard.click();
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-lightbox-image]');
    return image?.naturalWidth > 0 && image.naturalHeight > image.naturalWidth;
  }, null, { timeout: 20_000 });
  const portraitRect = await page.locator('[data-lightbox-image]').boundingBox();
  assert.ok(portraitRect && portraitRect.x >= 0 && portraitRect.y >= 0
    && portraitRect.x + portraitRect.width <= 320 && portraitRect.y + portraitRect.height <= 740,
  `portrait photo must fit the 320px viewport: ${JSON.stringify(portraitRect)}`);
  if (screenshots) await page.screenshot({ path: path.join(screenshots, 'lightbox-portrait-320.png') });
  await page.keyboard.press('Escape');
  assert.equal(await portraitCard.evaluate((element) => document.activeElement === element), true, 'portrait close must restore focus');
  await page.setViewportSize({ width: 568, height: 320 });
  await card.click();
  const landscapeClose = await page.locator('[data-lightbox-close]').boundingBox();
  assert.ok(landscapeClose && landscapeClose.x >= 0 && landscapeClose.y >= 0
    && landscapeClose.x + landscapeClose.width <= 568 && landscapeClose.y + landscapeClose.height <= 320,
  `close control must stay visible in landscape: ${JSON.stringify(landscapeClose)}`);
  if (screenshots) await page.screenshot({ path: path.join(screenshots, 'lightbox-landscape.png') });
  await page.keyboard.press('Escape');

  const browser = page.context().browser();
  assert.ok(browser, 'gallery no-JavaScript fallback requires the active local browser');
  const noJsContext = await browser.newContext({
    javaScriptEnabled: false,
    serviceWorkers: 'block',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    viewport: { width: 390, height: 844 },
  });
  const noJsDenied = [];
  await noJsContext.route('**/*', async (route) => {
    const requested = new URL(route.request().url());
    if (requested.origin !== appOrigin) {
      noJsDenied.push(requested.origin);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  const noJsPage = await noJsContext.newPage();
  try {
    const noJsResponse = await noJsPage.goto(`${appOrigin}/realizacie/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    assert.equal(noJsResponse?.status(), 200, 'no-JavaScript realizations fallback must render');
    const fallbackImage = noJsPage.locator('[data-gallery-card]').first()
      .locator('picture:not([data-deferred-responsive-image]) img');
    await fallbackImage.waitFor({ timeout: 20_000 });
    await fallbackImage.evaluate((image) => {
      if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 1) {
        throw new Error('no-JavaScript gallery image did not load');
      }
    });
    assert.ok((await fallbackImage.getAttribute('alt'))?.trim(), 'no-JavaScript gallery image keeps its alternative text');
    assert.deepEqual(noJsDenied, [], 'no-JavaScript gallery fallback must stay on the isolated app origin');
  } finally {
    await noJsContext.close();
  }
  assert.deepEqual(browserErrors, [], 'gallery must not log browser errors or failed requests');
  return { gallery: 'PASS', widths: [390, 320, 568], category, visiblePhotos: visibleCategories.length,
    controlledGalleryLoading: { beforeHero: 0, activatedNearViewport: galleryImageRequests.length, hiddenRequests: 0 },
    noJavaScriptFallback: 'PASS',
    screenshots: screenshots ? 'captured in owned temporary root; removed after test' : null };
}

async function runCareerRetryChecks(page, pglite, appOrigin, tempRoot) {
  const response = await page.goto(`${appOrigin}/kariera/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  assert.equal(response?.status(), 200, 'career form must render in the isolated local app');
  const form = page.locator('.career-application-form');
  await page.waitForFunction(() => Boolean(document.querySelector('.career-application-form input[name="submissionId"]')?.value), null, { timeout: 30_000 });
  await form.locator('input[name="fullName"]').fill('TEST-UPGRADE-F12-Nekontaktovať');
  await form.locator('input[name="phone"]').fill('+421900000002');
  await form.locator('input[name="email"]').fill('career-f12@example.invalid');
  await form.locator('input[name="city"]').fill('Poprad');
  await form.locator('input[name="workRegions"]').fill('Celé Slovensko');
  await form.locator('select[name="hasAsbestosExperience"]').selectOption('yes');
  await form.locator('textarea[name="asbestosExperience"]').fill('TEST – NEKONTAKTOVAŤ. Izolovaný test formulára.');
  await form.locator('input[name="hasTradeLicense"]').check();
  await form.locator('input[name="workAtHeights"]').check();
  await form.locator('input[name="gdpr"]').check();
  const oversizedPdf = Buffer.alloc(5 * 1024 * 1024 + 1, 0x20);
  oversizedPdf.write('%PDF-1.4\n', 0, 'ascii');
  await form.locator('input[name="cv"]').setInputFiles({ name: 'test-f12-prilis-velke-cv.pdf', mimeType: 'application/pdf', buffer: oversizedPdf });
  let oversizedPosts = 0;
  const countOversizedPosts = (request) => {
    if (request.url() === `${appOrigin}/api/kariera/` && request.method() === 'POST') oversizedPosts += 1;
  };
  page.on('request', countOversizedPosts);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction(() => {
      const message = document.querySelector('.career-form-message');
      return message?.classList.contains('is-error') && document.activeElement === message;
    });
    assert.match(await form.locator('.career-form-message').innerText(), /maximálne 5 MB/);
    assert.equal(await form.locator('input[name="cv"]').evaluate((input) => input.files.length), 1,
      `oversized career attempt ${attempt} must retain the selected CV`);
    assert.equal(await form.locator('input[name="fullName"]').inputValue(), 'TEST-UPGRADE-F12-Nekontaktovať',
      `oversized career attempt ${attempt} must retain applicant data`);
  }
  page.off('request', countOversizedPosts);
  assert.equal(oversizedPosts, 0, 'repeated oversized CV rejection must stay local and make no POST');
  assert.equal((await pglite.query('SELECT id FROM career_applications')).rowCount, 0);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF\n');
  await form.locator('input[name="cv"]').setInputFiles({ name: 'test-f12-cv.pdf', mimeType: 'application/pdf', buffer: pdf });
  const submissionId = await form.locator('input[name="submissionId"]').inputValue();
  const emptyCv = await page.evaluate(async () => {
    const payload = new FormData(document.querySelector('.career-application-form'));
    payload.set('cv', new File([], 'empty.pdf', { type: 'application/pdf' }));
    const response = await fetch('/api/kariera/', { method: 'POST', headers: { accept: 'application/json' }, body: payload });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(emptyCv.status, 400, 'a named empty CV must be rejected before persistence');
  assert.match(emptyCv.body.message, /prázdny/i);
  assert.equal((await pglite.query('SELECT id FROM career_applications')).rowCount, 0);
  await page.evaluate(() => { window.__careerRetryPayload = new FormData(document.querySelector('.career-application-form')); });
  let firstResponse;
  let firstRouteError;
  let resolveFirstRoute;
  const firstRouteDone = new Promise((resolve) => { resolveFirstRoute = resolve; });
  let posts = 0;
  await page.route('**/api/kariera/', async (route) => {
    posts += 1;
    if (posts === 1) {
      try {
        const saved = await route.fetch();
        firstResponse = { status: saved.status(), body: await saved.json() };
        await route.abort('failed');
      } catch (error) {
        firstRouteError = error;
        await route.abort('failed').catch(() => undefined);
      } finally {
        resolveFirstRoute();
      }
    } else await route.continue();
  });
  await form.locator('button[type="submit"]').click();
  let firstRouteTimeout;
  try {
    await Promise.race([firstRouteDone, new Promise((_, reject) => {
      firstRouteTimeout = setTimeout(() => reject(new Error('first career route did not finish')), 45_000);
    })]);
  } finally {
    clearTimeout(firstRouteTimeout);
  }
  if (firstRouteError) throw firstRouteError;
  await page.waitForFunction(() => document.querySelector('.career-form-message')?.classList.contains('is-error'), null, { timeout: 45_000 });
  const careerMessage = form.locator('.career-form-message');
  assert.equal(await careerMessage.getAttribute('tabindex'), '-1', 'career failure must remain programmatically focusable');
  assert.equal(await careerMessage.evaluate((element) => document.activeElement === element), true,
    'career failure must receive focus after pending state ends');
  assert.equal(firstResponse?.status, 200, `first career POST must persist: ${JSON.stringify(firstResponse)}`);
  assert.equal(firstResponse.body?.accepted, true);
  assert.equal(await form.locator('input[name="submissionId"]').inputValue(), submissionId, 'unknown result must keep the same submission identity');
  assert.equal(await form.locator('input[name="cv"]').evaluate((input) => input.files.length), 1, 'unknown result must retain the CV');
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.career-form-message')?.classList.contains('is-success'), null, { timeout: 45_000 });
  assert.equal(await careerMessage.getAttribute('tabindex'), '-1', 'career success must remain programmatically focusable');
  assert.equal(await careerMessage.evaluate((element) => document.activeElement === element), true,
    'career success must receive focus after pending state ends');
  assert.notEqual(await form.locator('input[name="submissionId"]').inputValue(), submissionId, 'confirmed success must create a new ID for the next application');
  const rows = await pglite.query('SELECT id, cv_storage_driver, cv_storage_key, cv_sha256 FROM career_applications WHERE submission_id=$1', [submissionId]);
  assert.equal(rows.rowCount, 1, 'ambiguous first response and retry must create exactly one application');
  assert.equal(rows.rows[0].cv_storage_driver, 'local');
  assert.equal(rows.rows[0].cv_sha256, createHash('sha256').update(pdf).digest('hex'));
  const storedCv = await readFile(path.join(tempRoot, 'storage', 'career-cv', rows.rows[0].cv_storage_key));
  assert.ok(storedCv.equals(pdf), 'the private CV must match the browser-selected bytes');
  const notices = await pglite.query('SELECT recipient_role, status, retryable FROM application_notification_outbox WHERE entity_type=$1 AND entity_id=$2 ORDER BY recipient_role', ['career_application', rows.rows[0].id]);
  assert.deepEqual(notices.rows.map((item) => item.recipient_role), ['applicant', 'internal']);
  assert.ok(notices.rows.every((item) => item.status === 'failed' && item.retryable === true), 'known missing relay must remain safely retryable, not look sent or unknown');
  const retries = await page.evaluate(async () => {
    const attempts = [];
    for (let index = 0; index < 2; index++) {
      const response = await fetch('/api/kariera/', { method: 'POST', headers: { accept: 'application/json' }, body: window.__careerRetryPayload });
      attempts.push({ status: response.status, body: await response.json() });
    }
    return attempts;
  });
  assert.deepEqual(retries.map((attempt) => attempt.status), [200, 200], `unchanged same-ID retries must bypass the fresh-application quota: ${JSON.stringify(retries)}`);
  assert.equal((await pglite.query('SELECT id FROM career_applications WHERE submission_id=$1', [submissionId])).rowCount, 1);
  await pglite.query(
    `UPDATE career_applications SET cv_original_name='', cv_storage_driver='', cv_storage_key='', cv_mime_type='', cv_size_bytes=0, cv_sha256=''
     WHERE id=$1`, [rows.rows[0].id],
  );
  const withoutMissingCv = await page.evaluate(async () => {
    const payload = new FormData();
    for (const [name, value] of window.__careerRetryPayload.entries()) if (name !== 'cv') payload.append(name, value);
    const response = await fetch('/api/kariera/', { method: 'POST', headers: { accept: 'application/json' }, body: payload });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(withoutMissingCv.status, 409, 'an accepted application with missing expected CV cannot become a false success');
  assert.equal(withoutMissingCv.body.accepted, true);
  assert.match(withoutMissingCv.body.message, /životopis.*chýba/i);
  const repairedCv = await page.evaluate(async () => {
    const response = await fetch('/api/kariera/', { method: 'POST', headers: { accept: 'application/json' }, body: window.__careerRetryPayload });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(repairedCv.status, 200, 'same-ID retry must reattach the original CV');
  const repaired = await pglite.query('SELECT cv_sha256 FROM career_applications WHERE id=$1', [rows.rows[0].id]);
  assert.equal(repaired.rows[0].cv_sha256, createHash('sha256').update(pdf).digest('hex'));
  assert.equal((await pglite.query('SELECT id FROM career_applications WHERE submission_id=$1', [submissionId])).rowCount, 1);
  const changedPayloadApplications = await runCareerChangedPayloadIdentityCheck(page.context(), pglite, appOrigin);
  return { career: 'PASS', posts, sameIdRetries: 2, applications: 1, privateCv: true, missingCvRecovery: true,
    changedPayloadApplications, mailSent: 0 };
}

async function runCareerChangedPayloadIdentityCheck(context, pglite, appOrigin) {
  const changedPage = await context.newPage();
  try {
    const response = await changedPage.goto(`${appOrigin}/kariera/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    assert.equal(response?.status(), 200, 'changed-payload career scenario must use the isolated local app');
    const form = changedPage.locator('.career-application-form');
    await changedPage.waitForFunction(() => Boolean(document.querySelector('.career-application-form input[name="submissionId"]')?.value));
    await form.locator('input[name="fullName"]').fill('TEST-UPGRADE-F12 zmena údajov');
    await form.locator('input[name="phone"]').fill('+421900000008');
    await form.locator('input[name="email"]').fill('career-payload-change@example.invalid');
    await form.locator('input[name="city"]').fill('Poprad');
    await form.locator('input[name="workRegions"]').fill('Celé Slovensko');
    await form.locator('select[name="hasAsbestosExperience"]').selectOption('no');
    await form.locator('input[name="hasTradeLicense"]').check();
    await form.locator('input[name="workAtHeights"]').check();
    await form.locator('input[name="gdpr"]').check();
    const originalSubmissionId = await form.locator('input[name="submissionId"]').inputValue();
    const firstSave = await changedPage.evaluate(async () => {
      const response = await fetch('/api/kariera/', {
        method: 'POST', headers: { accept: 'application/json' },
        body: new FormData(document.querySelector('.career-application-form')),
      });
      return { status: response.status, body: await response.json() };
    });
    assert.equal(firstSave.status, 200, `initial isolated application must be persisted: ${JSON.stringify(firstSave)}`);
    assert.equal(firstSave.body?.accepted, true);
    await changedPage.route('**/api/kariera/', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({
        ok: false, accepted: true, message: 'Izolovaný test: doplnkový krok treba zopakovať.',
      }) });
    });
    await form.locator('button[type="submit"]').click();
    await changedPage.waitForFunction(() => document.querySelector('.career-form-message')?.classList.contains('is-warning'), null, { timeout: 45_000 });
    assert.equal(await form.locator('input[name="submissionId"]').inputValue(), originalSubmissionId,
      'an accepted follow-up error must preserve its ID until the user changes the payload');
    await changedPage.unroute('**/api/kariera/');
    await form.locator('input[name="city"]').fill('Kežmarok');
    await form.locator('button[type="submit"]').click();
    await changedPage.waitForFunction(() => document.querySelector('.career-form-message')?.classList.contains('is-success'), null, { timeout: 45_000 });
    const rows = await pglite.query(`SELECT submission_id, city FROM career_applications
      WHERE email='career-payload-change@example.invalid' ORDER BY created_at`);
    assert.equal(rows.rowCount, 2, 'changed fields after an ambiguous response start a new application instead of overwriting');
    assert.equal(rows.rows.filter((row) => row.city === 'Poprad').length, 1);
    assert.equal(rows.rows.filter((row) => row.city === 'Kežmarok').length, 1);
    assert.equal(new Set(rows.rows.map((row) => row.submission_id)).size, 2);
    assert.ok(rows.rows.some((row) => row.submission_id === originalSubmissionId));
    return 2;
  } finally {
    await changedPage.close();
  }
}

async function runCareerDirectCvChecks(page, pglite, fake, appOrigin) {
  const response = await page.goto(`${appOrigin}/kariera/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  assert.equal(response?.status(), 200);
  const form = page.locator('.career-application-form');
  await page.waitForFunction(() => Boolean(document.querySelector('.career-application-form input[name="submissionId"]')?.value));
  await form.locator('input[name="fullName"]').fill('TEST-UPGRADE-F12 Priame CV');
  await form.locator('input[name="phone"]').fill('+421900000004');
  await form.locator('input[name="email"]').fill('career-direct@example.invalid');
  await form.locator('input[name="city"]').fill('Poprad');
  await form.locator('input[name="workRegions"]').fill('Celé Slovensko');
  await form.locator('select[name="hasAsbestosExperience"]').selectOption('no');
  await form.locator('input[name="hasTradeLicense"]').check();
  await form.locator('input[name="workAtHeights"]').check();
  await form.locator('input[name="gdpr"]').check();
  const pdf = Buffer.alloc(4_800_000, 0x20);
  pdf.write('%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n', 0, 'ascii');
  pdf.write('%%EOF\n', pdf.length - 6, 'ascii');
  await form.locator('input[name="cv"]').setInputFiles({ name: 'test-f12-velke-cv.pdf', mimeType: 'application/pdf', buffer: pdf });
  const submissionId = await form.locator('input[name="submissionId"]').inputValue();
  const oversizedMetadata = await page.evaluate(async () => {
    const payload = new FormData(document.querySelector('.career-application-form'));
    payload.delete('cv');
    payload.set('cvIntent', 'on');
    payload.set('cvExpectedSize', String(5 * 1024 * 1024 + 1));
    payload.set('cvExpectedSha256', 'a'.repeat(64));
    const response = await fetch('/api/kariera/', { method: 'POST', body: payload, headers: { accept: 'application/json' } });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(oversizedMetadata.status, 400, 'oversized CV intent must fail before application persistence');
  assert.equal((await pglite.query('SELECT id FROM career_applications')).rowCount, 0);
  const posts = [];
  page.on('response', (received) => {
    if (received.url() === `${appOrigin}/api/kariera/` && received.request().method() === 'POST') posts.push(received.status());
  });
  fake.failOneCareerCvPut();
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.career-form-message')?.classList.contains('is-warning'), null, { timeout: 90_000 });
  const firstReservation = await pglite.query('SELECT pathname, status FROM career_cv_uploads WHERE submission_id=$1', [submissionId]);
  assert.equal(firstReservation.rowCount, 1, 'failed upload must retain exactly one reservation');
  assert.equal(firstReservation.rows[0].status, 'reserved');
  assert.equal((await pglite.query('SELECT id FROM career_applications WHERE submission_id=$1', [submissionId])).rowCount, 1);
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.career-form-message')?.classList.contains('is-success'), null, { timeout: 90_000 });
  assert.deepEqual(posts, [202, 202, 409, 200], `failed Blob PUT must retry the same reserved path: ${JSON.stringify(posts)}`);
  assert.notEqual(await form.locator('input[name="submissionId"]').inputValue(), submissionId);
  const application = await pglite.query('SELECT id, cv_expected, cv_storage_driver, cv_storage_key, cv_sha256 FROM career_applications WHERE submission_id=$1', [submissionId]);
  assert.equal(application.rowCount, 1);
  assert.equal(application.rows[0].cv_expected, true);
  assert.equal(application.rows[0].cv_storage_driver, 'vercel_blob');
  assert.equal(application.rows[0].cv_sha256, createHash('sha256').update(pdf).digest('hex'));
  const path = application.rows[0].cv_storage_key;
  assert.equal(path, firstReservation.rows[0].pathname, 'retry must reuse the first private Blob reservation');
  assert.equal((await pglite.query('SELECT pathname FROM career_cv_uploads WHERE submission_id=$1', [submissionId])).rowCount, 1,
    'transient upload failures must not exhaust the reservation allowance');
  assert.match(path, /^career-cv\/[0-9a-f]{32}\/[0-9a-f-]{36}\.pdf$/);
  assert.ok(fake.blobs.get(path)?.bytes.equals(pdf), 'direct private Blob bytes must match the selected CV');
  assert.equal(fake.counts.callback, 1, 'signed Blob callback must complete');
  assert.ok(fake.counts.privateGet >= 1, 'server must validate the private Blob before attach');
  const notices = await pglite.query('SELECT recipient_role, status, retryable FROM application_notification_outbox WHERE entity_type=$1 AND entity_id=$2', ['career_application', application.rows[0].id]);
  assert.equal(notices.rowCount, 2);
  assert.ok(notices.rows.every((notice) => notice.status === 'failed' && notice.retryable === true));
  const changedCvIdentity = await page.evaluate(async ({ originalSubmissionId }) => {
    const payload = new FormData();
    for (const [name, value] of Object.entries({
      submissionId: originalSubmissionId, fullName: 'TEST-UPGRADE-F12 Priame CV', phone: '+421900000004',
      email: 'career-direct@example.invalid', city: 'Poprad', cooperationType: 'szco', workRegions: 'Celé Slovensko',
      hasTradeLicense: 'on', workAtHeights: 'on', hasAsbestosExperience: 'no', gdpr: 'on',
      cvIntent: 'on', cvExpectedSize: '4800000', cvExpectedSha256: 'b'.repeat(64),
    })) payload.set(name, value);
    const response = await fetch('/api/kariera/', { method: 'POST', body: payload, headers: { accept: 'application/json' } });
    return { status: response.status, body: await response.json() };
  }, { originalSubmissionId: submissionId });
  assert.equal(changedCvIdentity.status, 409, 'same application cannot silently accept a different CV');
  const anonymousBlob = await fetch(`http://127.0.0.1:${new URL(fake.blobOrigin).port}/${path}`);
  assert.equal(anonymousBlob.status, 401, 'private CV cannot be downloaded anonymously');
  await form.locator('input[name="fullName"]').fill('TEST-UPGRADE-F12 Stará rezervácia');
  await form.locator('input[name="phone"]').fill('+421900000006');
  await form.locator('input[name="email"]').fill('career-aged@example.invalid');
  await form.locator('input[name="city"]').fill('Poprad');
  await form.locator('input[name="workRegions"]').fill('Celé Slovensko');
  await form.locator('select[name="hasAsbestosExperience"]').selectOption('no');
  await form.locator('input[name="hasTradeLicense"]').check();
  await form.locator('input[name="workAtHeights"]').check();
  await form.locator('input[name="gdpr"]').check();
  await form.locator('input[name="cv"]').setInputFiles({ name: 'test-f12-stare-cv.pdf', mimeType: 'application/pdf', buffer: pdf });
  const agedSubmissionId = await form.locator('input[name="submissionId"]').inputValue();
  fake.failOneCareerCvPut();
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.career-form-message')?.classList.contains('is-warning'), null, { timeout: 90_000 });
  const agedReservation = await pglite.query('SELECT pathname FROM career_cv_uploads WHERE submission_id=$1', [agedSubmissionId]);
  assert.equal(agedReservation.rowCount, 1);
  await pglite.query(`UPDATE career_cv_uploads SET created_at=now() - interval '24 hours' WHERE pathname=$1`, [agedReservation.rows[0].pathname]);
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.career-form-message')?.classList.contains('is-success'), null, { timeout: 90_000 });
  const agedApplication = await pglite.query('SELECT cv_storage_key FROM career_applications WHERE submission_id=$1', [agedSubmissionId]);
  assert.equal(agedApplication.rowCount, 1);
  assert.notEqual(agedApplication.rows[0].cv_storage_key, agedReservation.rows[0].pathname,
    'an expired missing Blob must move to a new tracked reservation under the same application');
  assert.equal((await pglite.query('SELECT pathname FROM career_cv_uploads WHERE submission_id=$1', [agedSubmissionId])).rowCount, 2,
    'the expired reservation remains tracked for private retention while the new one is attached');
  const legacy = await page.evaluate(async () => {
    const payload = new FormData();
    const submissionId = crypto.randomUUID().replaceAll('-', '');
    for (const [name, value] of Object.entries({
      submissionId, fullName: 'TEST-UPGRADE-F12 Starý klient', phone: '+421900000005',
      email: 'career-legacy@example.invalid', city: 'Poprad', cooperationType: 'szco', workRegions: 'Celé Slovensko',
      hasTradeLicense: 'on', workAtHeights: 'on', hasAsbestosExperience: 'no', gdpr: 'on',
    })) payload.set(name, value);
    payload.set('cv', new File(['%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF\n'], 'legacy.pdf', { type: 'application/pdf' }));
    const response = await fetch('/api/kariera/', { method: 'POST', body: payload, headers: { accept: 'application/json' } });
    return { submissionId, status: response.status, body: await response.json() };
  });
  assert.equal(legacy.status, 200, `old small-CV client must remain compatible: ${JSON.stringify(legacy.body)}`);
  const legacyRows = await pglite.query('SELECT id, cv_storage_driver, cv_storage_key FROM career_applications WHERE submission_id=$1', [legacy.submissionId]);
  assert.equal(legacyRows.rowCount, 1);
  assert.equal(legacyRows.rows[0].cv_storage_driver, 'vercel_blob');
  const legacyManifest = await pglite.query('SELECT status FROM career_cv_uploads WHERE pathname=$1', [legacyRows.rows[0].cv_storage_key]);
  assert.deepEqual(legacyManifest.rows.map((row) => row.status), ['attached'], 'server-mediated CV must be reserved before storing and attached atomically');
  assert.equal((await pglite.query('SELECT id FROM career_applications')).rowCount, 3);
  return { careerDirect: 'PASS', cvBytes: pdf.length, applications: 3, privateCv: true, notifications: 6, mailSent: 0 };
}

async function runRooferSubmissionChecks(page, pglite, appOrigin) {
  const response = await page.goto(`${appOrigin}/strechari/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  assert.equal(response?.status(), 200, 'roofer page must render in the isolated local app');
  await page.waitForLoadState('networkidle');
  const form = page.locator('.roofer-registration-form');
  const fill = async () => {
    await form.locator('select[name="businessType"]').selectOption('szco');
    await form.locator('input[name="companyName"]').fill('TEST-UPGRADE-F12 Strechy');
    await form.locator('input[name="contactPerson"]').fill('TEST-UPGRADE-F12 Nekontaktovať');
    await form.locator('input[name="phone"]').fill('+421900000003');
    await form.locator('input[name="email"]').fill('roofer-f12@example.invalid');
    await form.locator('input[name="serviceRegions[]"][value="Prešovský kraj"]').check();
    await form.locator('input[name="specializations[]"][value="Plechová krytina"]').check();
    await form.locator('input[name="canBuildRoofTruss"][value="no"]').check();
    await form.locator('input[name="privacyConsent"]').check();
    await form.locator('textarea[name="note"]').fill('TEST – NEKONTAKTOVAŤ. Izolovaný test.');
  };
  await fill();
  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (String(input).includes('/api/roofer-registration/') && init?.body instanceof FormData && !window.__firstRooferId) {
        window.__rooferRetryPayload = new FormData();
        for (const [name, value] of init.body.entries()) window.__rooferRetryPayload.append(name, value);
        window.__firstRooferId = String(init.body.get('submissionId') || '');
      }
      return originalFetch(input, init);
    };
  });
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.roofer-registration-status')?.classList.contains('is-success'), null, { timeout: 45_000 });
  const firstId = await page.evaluate(() => window.__firstRooferId);
  assert.match(firstId, /^[0-9a-f-]{36}$/i, 'first roofer submit generates a stable submission ID');
  const secondId = await form.locator('input[name="submissionId"]').inputValue();
  assert.notEqual(secondId, firstId, 'the next independent roofer registration must receive a new submission ID');
  const duplicate = await page.evaluate(async () => {
    const response = await fetch('/api/roofer-registration/', { method: 'POST', headers: { accept: 'application/json' }, body: window.__rooferRetryPayload });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(duplicate.status, 200, 'unchanged roofer retry must return the original accepted registration');
  assert.equal(duplicate.body.accepted, true);
  assert.equal((await pglite.query('SELECT id FROM roofer_registrations WHERE submission_id=$1', [firstId])).rowCount, 1);
  await fill();
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.roofer-registration-status')?.classList.contains('is-success'), null, { timeout: 45_000 });
  const rows = await pglite.query('SELECT id, submission_id FROM roofer_registrations WHERE email=$1 ORDER BY created_at', ['roofer-f12@example.invalid']);
  assert.equal(rows.rowCount, 2, 'two confirmed browser submissions must create two distinct registrations');
  assert.deepEqual(new Set(rows.rows.map((row) => row.submission_id)), new Set([firstId, secondId]));
  const notices = await pglite.query(
    `SELECT recipient_role, status, retryable FROM application_notification_outbox
     WHERE entity_type='roofer_registration' AND entity_id=ANY($1::uuid[])`,
    [rows.rows.map((row) => row.id)],
  );
  assert.equal(notices.rowCount, 4, 'each roofer registration must have applicant and internal notice rows');
  assert.ok(notices.rows.every((item) => item.status === 'failed' && item.retryable === true),
    'known missing SMTP must be recoverable for both recipients without falsely claiming delivery');
  return { roofers: 'PASS', registrations: 2, notices: 4, deliveredEmails: 0 };
}

async function runHistoricalPreReservationCheck(context, pglite, fake, appOrigin, photo) {
  const legacyPage = await context.newPage();
  let firstConflict = null;
  let orphanPath = '';
  try {
    await legacyPage.addInitScript(() => {
      const original = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (type === 'change' && this instanceof HTMLInputElement && this.id === 'photos') {
          window.__astanaPhotoHandlerReady = true;
        }
        return original.call(this, type, listener, options);
      };
    });
    await legacyPage.route('**/api/dopyt/', async (route) => {
      const uploaded = await pglite.query(
        "SELECT storage_key FROM lead_upload_drafts WHERE status='uploaded' AND lead_id IS NULL",
      );
      assert.equal(uploaded.rowCount, 1, 'the old tab must have uploaded exactly one private photo before its lead POST');
      orphanPath = uploaded.rows[0].storage_key;
      assert.ok(fake.blobs.has(orphanPath), 'the old-tab photo exists before the simulated pre-release reservation gap');
      await pglite.query('DELETE FROM lead_upload_drafts WHERE storage_key=$1', [orphanPath]);
      const response = await route.fetch();
      firstConflict = { status: response.status(), body: await response.json() };
      await route.fulfill({ status: firstConflict.status, contentType: 'application/json', body: JSON.stringify(firstConflict.body) });
    });
    const response = await legacyPage.goto(appOrigin, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    assert.equal(response?.status(), 200);
    await legacyPage.waitForFunction(() => window.__astanaPhotoHandlerReady === true, null, { timeout: 30_000 });
    await legacyPage.locator('#areaEstimate').fill('120');
    await legacyPage.locator('#city').fill('Poprad');
    await legacyPage.locator('#materialType').selectOption('Vlnitý eternit');
    await legacyPage.locator('#objectType').selectOption('Rodinný dom');
    await legacyPage.locator('#phone').fill('+421900000001');
    await legacyPage.locator('#fullName').fill('TEST-UPGRADE starý klient — nekontaktovať');
    await legacyPage.locator('#email').fill('legacy-first-conflict@example.invalid');
    await legacyPage.locator('input[name="gdpr"]').check();
    await legacyPage.locator('#photos').setInputFiles([photo]);
    await legacyPage.waitForFunction(() => document.querySelectorAll('.file-chip').length === 1, null, { timeout: 20_000 });
    await legacyPage.locator('.lead-form button[type="submit"]').click();
    await legacyPage.waitForFunction(() => document.querySelector('.form-status')?.classList.contains('is-error'), null, { timeout: 90_000 });
    assert.equal(firstConflict?.status, 409, 'the real old-client handler must receive the first pre-reservation conflict');
    assert.match(firstConflict.body.message, /fotk.*nahráme ešte raz/i);
    assert.match(await legacyPage.locator('.form-status').innerText(), /fotk.*nahráme ešte raz/i);
    assert.equal(await legacyPage.locator('.file-chip').count(), 1, 'the old client must retain the selected photo after its first 409');
    assert.equal(await legacyPage.locator('#city').inputValue(), 'Poprad', 'the old client must retain contact form fields');
    assert.equal(await legacyPage.locator('#photos').evaluate((input) => input.files.length), 1);
    assert.equal(await legacyPage.locator('.lead-form.is-submitted').count(), 0, 'a conflict must not show a success state');
    assert.equal((await pglite.query('SELECT id FROM leads')).rowCount, 0, 'the first 409 must not create a lead');
    const tracked = await pglite.query('SELECT status, lead_id FROM lead_upload_drafts WHERE storage_key=$1', [orphanPath]);
    assert.deepEqual(tracked.rows.map((row) => ({ status: row.status, leadId: row.lead_id })), [{ status: 'superseded', leadId: null }]);
    assert.ok(fake.blobs.has(orphanPath), 'a first 409 must not delete the private photo during the request');
    return true;
  } finally {
    await legacyPage.close();
    if (orphanPath) {
      await pglite.query('DELETE FROM lead_upload_drafts WHERE storage_key=$1', [orphanPath]);
      fake.blobs.delete(orphanPath);
    }
  }
}

async function runTestimonialReceiptChecks(page, pglite, appOrigin) {
  const successText = 'Ďakujeme. Referenciu sme prijali na kontrolu a zobrazí sa až po schválení.';
  await page.goto(`${appOrigin}/recenzie/?odoslane=1`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.getByText(successText, { exact: true }).count(), 0, 'a forged query parameter cannot display a saved-review confirmation');
  assert.equal(await page.locator('h1').count(), 1, 'dynamic reviews page has one H1');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://likvidacia-eternitu.sk/recenzie/');
  assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), 'https://likvidacia-eternitu.sk/recenzie/');
  assert.ok((await page.title()).includes('Recenzie zákazníkov'));
  assert.ok((await page.locator('meta[name="description"]').getAttribute('content'))?.trim());
  await page.waitForLoadState('networkidle');

  const publicForm = page.locator('.testimonial-public-form');
  const publicMessage = publicForm.locator('.testimonial-public-message');
  await publicForm.locator('input[name="customerName"]').fill('Izolovaná chyba');
  await publicForm.locator('input[name="customerEmail"]').fill('review-focus@example.invalid');
  await publicForm.locator('textarea[name="text"]').fill('Izolovaná skúška opakovanej chyby formulára, nikdy nezverejniť.');
  await publicForm.locator('input[name="consentPublication"]').check();
  let clientErrorPosts = 0;
  await page.route('**/api/testimonial', async (route) => {
    clientErrorPosts += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, message: 'Izolovaná chyba odoslania.' }),
    });
  });
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const responsePromise = page.waitForResponse((received) =>
      received.url() === `${appOrigin}/api/testimonial` && received.request().method() === 'POST');
    await publicForm.locator('button[type="submit"]').click();
    assert.equal((await responsePromise).status(), 503);
    await page.waitForFunction(() => {
      const message = document.querySelector('.testimonial-public-message');
      return message?.classList.contains('is-error') && document.activeElement === message;
    });
    assert.equal(await publicMessage.getAttribute('tabindex'), '-1', `testimonial error attempt ${attempt} must be focusable`);
    assert.equal(await publicMessage.innerText(), 'Izolovaná chyba odoslania.');
    assert.equal(await publicForm.locator('input[name="customerName"]').inputValue(), 'Izolovaná chyba',
      'testimonial failure must retain the form fields');
  }
  assert.equal(clientErrorPosts, 2, 'the same testimonial error must refocus after every settled attempt');
  await page.unroute('**/api/testimonial');

  const submissionId = randomUUID();
  const form = new FormData();
  form.set('submissionId', submissionId);
  form.set('customerName', 'Izolovaná skúška');
  form.set('customerEmail', 'review-test@example.invalid');
  form.set('rating', '5');
  form.set('text', 'Izolovaná testovacia referencia, nikdy nezverejniť.');
  form.set('consentPublication', 'on');
  const response = await fetch(`${appOrigin}/api/testimonial/`, {
    method: 'POST',
    body: form,
    headers: { Accept: 'text/html', Origin: appOrigin },
    redirect: 'manual',
  });
  assert.equal(response.status, 303, `native review submission failed: ${(await response.clone().text()).slice(0, 200)}`);
  const destination = new URL(response.headers.get('location') || '', appOrigin);
  assert.equal(destination.pathname, '/recenzie/');
  const receipt = destination.searchParams.get('referencia_receipt') || '';
  assert.ok(receipt.length > 40, 'native success must carry a signed receipt');
  assert.doesNotMatch(destination.href, /Izolovaná|review-test|example\.invalid|customerEmail|customerName|odoslane=1/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  await page.goto(destination.href, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.getByText(successText, { exact: true }).count(), 1, 'a saved native submission receives its confirmation');
  const confirmation = page.locator('#referencia-potvrdenie');
  await confirmation.waitFor({ state: 'visible' });
  assert.equal(await confirmation.getAttribute('tabindex'), '-1', 'native confirmation must remain programmatically focusable');
  assert.equal(await confirmation.evaluate((element) => document.activeElement === element), true,
    'native confirmation must receive focus immediately after the redirect');
  const confirmationBox = await confirmation.boundingBox();
  assert.ok(confirmationBox && confirmationBox.y >= 0 && confirmationBox.y < (page.viewportSize()?.height || 1),
    'native confirmation must be visible in the first viewport');

  const stored = await pglite.query('SELECT status, customer_name, customer_email FROM testimonials WHERE submission_id = $1', [submissionId]);
  assert.deepEqual(stored.rows, [{ status: 'draft', customer_name: 'Izolovaná skúška', customer_email: 'review-test@example.invalid' }]);
  const [payload, signature] = receipt.split('.');
  const changed = `${payload}.${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
  await page.goto(`${appOrigin}/recenzie/?referencia_receipt=${encodeURIComponent(changed)}`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.getByText(successText, { exact: true }).count(), 0, 'a tampered receipt cannot confirm a review');
  return { testimonialStored: stored.rowCount, nativeRedirect: response.status, forgedSuccess: false, clientErrorFocusAttempts: clientErrorPosts };
}

async function runPublicSeoCrawl(page, appOrigin) {
  const sitemapResponse = await fetch(`${appOrigin}/sitemap.xml`);
  assert.equal(sitemapResponse.status, 200, 'local sitemap must be available');
  const sitemap = await sitemapResponse.text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(urls.length, 34, 'the expected public URL inventory must be complete');
  assert.equal(new Set(urls).size, urls.length, 'sitemap URLs must be unique');
  assert.ok(urls.every((url) => url.startsWith('https://likvidacia-eternitu.sk/')));
  assert.ok(!sitemap.includes('/spolupraca/fotky/') && !sitemap.includes('/dopyt-prijaty/') && !sitemap.includes('/pre-strecharov/'));
  const runtimeContentPaths = new Set(['/realizacie/', '/recenzie/']);
  for (const path of runtimeContentPaths) assert.ok(urls.includes(`https://likvidacia-eternitu.sk${path}`), `${path} must remain in the sitemap`);
  const checkedRuntimePaths = new Set();
  const runtimeOgImages = new Set();

  for (const canonicalUrl of urls) {
    const path = new URL(canonicalUrl).pathname;
    const response = await page.goto(`${appOrigin}${path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    assert.equal(response?.status(), 200, `${path} must render successfully`);
    assert.equal(await page.locator('h1').count(), 1, `${path} must render one H1`);
    assert.ok((await page.title()).trim(), `${path} must have a title`);
    assert.ok((await page.locator('meta[name="description"]').getAttribute('content'))?.trim(), `${path} must have a description`);
    assert.equal(await page.locator('link[rel="canonical"]').count(), 1, `${path} must have one canonical`);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonicalUrl, `${path} canonical mismatch`);
    assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonicalUrl, `${path} Open Graph URL mismatch`);
    const ogImages = await page.locator('meta[property="og:image"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('content') || ''));
    assert.ok(ogImages.length > 0 && ogImages.every((url) => url.startsWith('https://likvidacia-eternitu.sk/')), `${path} must have a same-site Open Graph image`);
    const robots = (await page.locator('meta[name="robots"]').getAttribute('content')) || '';
    assert.doesNotMatch(robots, /\bnoindex\b/i, `${path} is in sitemap but noindex`);
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    assert.ok(jsonLd.length > 0, `${path} must contain JSON-LD`);
    const structuredData = jsonLd.map((json) => {
      try { return JSON.parse(json); } catch { assert.fail(`${path} has invalid JSON-LD`); }
    });
    assert.ok(structuredData.some((value) => Array.isArray(value?.['@graph']) && value['@graph'].some((node) => node?.['@id'] === 'https://likvidacia-eternitu.sk/#organization')), `${path} must link to the organization entity`);
    if (runtimeContentPaths.has(path)) {
      checkedRuntimePaths.add(path);
      for (const image of ogImages) runtimeOgImages.add(new URL(image).pathname);
    }
  }
  assert.equal(checkedRuntimePaths.size, runtimeContentPaths.size, 'every runtime-content sitemap page was checked');
  for (const imagePath of runtimeOgImages) {
    const image = await fetch(`${appOrigin}${imagePath}`);
    assert.equal(image.status, 200, `${imagePath} Open Graph image must exist`);
    assert.match(image.headers.get('content-type') || '', /^image\//i, `${imagePath} must be served as an image`);
  }

  const privatePage = await page.goto(`${appOrigin}/spolupraca/fotky/`, { waitUntil: 'domcontentloaded' });
  assert.equal(privatePage?.status(), 200);
  assert.match((await page.locator('meta[name="robots"]').getAttribute('content')) || '', /\bnoindex\b/i);
  assert.equal(await page.locator('.photo-intake-assignment').count(), 0, 'invite details must not show without authorization');

  const missing = await page.goto(`${appOrigin}/__seo_missing_probe__/`, { waitUntil: 'domcontentloaded' });
  assert.equal(missing?.status(), 404);
  const missingRobots = await page.locator('meta[name="robots"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('content') || ''));
  assert.ok(missingRobots.length > 0 && missingRobots.every((value) => /\bnoindex\b/i.test(value)), 'all 404 robots directives must forbid indexing');
  assert.equal(await page.locator('link[rel="canonical"]').count(), 0, '404 must not inherit the homepage canonical');

  const receipt = await fetch(`${appOrigin}/dopyt-prijaty/`, { redirect: 'manual' });
  assert.equal(receipt.status, 404, 'a lead receipt without a signed token must not confirm a submission');
  assert.match(receipt.headers.get('x-robots-tag') || '', /\bnoindex\b/i);
  return { sitemapUrls: urls.length, runtimeContentUrls: checkedRuntimePaths.size, privateNoindex: true, missingNoindex: true, unsignedReceiptRejected: true };
}

async function runResponsiveVisualChecks(page, appOrigin, tempRoot, sharp) {
  await page.addInitScript(() => {
    document.addEventListener('submit', () => {
      sessionStorage.setItem(
        'astana:visual-submit-events',
        String(Number(sessionStorage.getItem('astana:visual-submit-events') || '0') + 1),
      );
    }, true);
  });
  const stabilizeVisualPage = async () => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.addStyleTag({ content: [
      '*, *::before, *::after {',
      '  animation-delay: 0s !important;',
      '  animation-duration: 0s !important;',
      '  animation-iteration-count: 1 !important;',
      '  scroll-behavior: auto !important;',
      '  transition-delay: 0s !important;',
      '  transition-duration: 0s !important;',
      '  caret-color: transparent !important;',
      '}',
    ].join('\n') });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
  };
  const resetVisualScroll = async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await page.waitForFunction(() => scrollX === 0 && scrollY === 0 && !document.querySelector('.site-header')?.classList.contains('is-compact'));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const hydrationErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrated but some attributes|hydration failed/i.test(message.text())) {
      hydrationErrors.push({ route: new URL(page.url()).pathname, message: message.text() });
    }
  });
  const visualEvidenceLabel = (process.env.ASTANA_HARNESS_VISUAL_EVIDENCE_LABEL || '').trim();
  assert.ok(!visualEvidenceLabel || /^[a-z0-9-]{1,40}$/.test(visualEvidenceLabel),
    'visual evidence label must contain only lowercase letters, numbers and hyphens');
  const screenshotDir = visualEvidenceLabel
    ? path.join(projectRoot, 'tmp', 'visual-evidence-exports', visualEvidenceLabel)
    : path.join(tempRoot, 'visual-evidence');
  let evidenceManifest = null;
  if (visualEvidenceLabel) {
    const evidenceRoot = path.join(projectRoot, 'tmp', 'visual-evidence-exports');
    await mkdir(evidenceRoot, { recursive: true });
    const alreadyExists = await lstat(screenshotDir).then(() => true).catch((error) => {
      if (error?.code === 'ENOENT') return false;
      throw error;
    });
    assert.equal(alreadyExists, false, `visual evidence label already exists and must not be overwritten: ${visualEvidenceLabel}`);
    await mkdir(screenshotDir);
  } else {
    await mkdir(screenshotDir, { recursive: true });
  }
  let screenshotCount = 0;
  let logoPixelChecks = 0;
  await page.setViewportSize({ width: 320, height: 568 });
  const home = await page.goto(appOrigin, { waitUntil: 'networkidle', timeout: 45_000 });
  assert.equal(home?.status(), 200);
  await stabilizeVisualPage();
  await page.locator('.cookie-banner').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('.cookie-banner').evaluate(async (banner) => {
    await Promise.all(banner.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  await page.evaluate(async () => { await document.fonts.ready; });
  await resetVisualScroll();
  const initial = await page.evaluate(() => {
    const cta = document.querySelector('.hero-actions .button-primary')?.getBoundingClientRect();
    const phoneLink = document.querySelector('.hero-actions a[href^="tel:"]');
    const phone = phoneLink?.getBoundingClientRect();
    const cookie = document.querySelector('.cookie-banner')?.getBoundingClientRect();
    return {
      cta: cta && { left: cta.left, right: cta.right, top: cta.top, bottom: cta.bottom },
      ctaHeight: cta?.height ?? null,
      phone: phone && { left: phone.left, right: phone.right, top: phone.top, bottom: phone.bottom },
      phoneHeight: phone?.height ?? null,
      phoneHitTarget: Boolean(phoneLink && phone && document.elementFromPoint(phone.left + phone.width / 2, phone.top + phone.height / 2)?.closest('a') === phoneLink),
      cookie: cookie && { top: cookie.top }, height: innerHeight,
    };
  });
  assert.ok(initial.cta && initial.cookie && initial.cta.bottom <= initial.height && initial.cta.bottom <= initial.cookie.top,
    `primary action must remain visible above the cookie banner at 320x568: ${JSON.stringify(initial)}`);
  assert.ok(initial.ctaHeight >= 44, `primary action must keep a 44px minimum touch target: ${JSON.stringify(initial)}`);
  assert.ok(initial.phone && initial.phone.left >= 0 && initial.phone.right <= 320
    && initial.phone.top >= 0 && initial.phone.right > initial.phone.left && initial.phone.bottom > initial.phone.top
    && initial.phone.bottom <= initial.cookie.top && initial.phoneHitTarget,
    `phone action must remain visible above the cookie banner at 320x568: ${JSON.stringify(initial)}`);
  assert.ok(initial.phoneHeight >= 44, `phone action must keep a 44px minimum touch target: ${JSON.stringify(initial)}`);
  await page.screenshot({ path: path.join(screenshotDir, 'home-320-cookie.png'), type: 'png', caret: 'initial' });
  screenshotCount += 1;
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await page.evaluate(() => window.scrollTo({ top: 420, behavior: 'instant' }));
    await page.waitForFunction(() => {
      const sticky = document.querySelector('.mobile-sticky-cta');
      const cookie = document.querySelector('.cookie-banner');
      return sticky instanceof HTMLElement && sticky.inert && cookie instanceof HTMLElement;
    });
    const hiddenStickyFocus = await page.evaluate(() => {
      const link = document.querySelector('.mobile-sticky-cta a');
      if (!(link instanceof HTMLElement)) return null;
      link.focus();
      return document.activeElement === link;
    });
    assert.equal(hiddenStickyFocus, false, `${width}px sticky CTA under the cookie banner must not receive focus`);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await resetVisualScroll();
  await page.getByRole('button', { name: 'Len nevyhnutné' }).click();

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      const hero = document.querySelector('main > .hero');
      if (!(hero instanceof HTMLElement)) return;
      const heroBottom = hero.offsetTop + hero.offsetHeight;
      window.scrollTo({ top: Math.min(420, Math.max(300, heroBottom - 40)), behavior: 'instant' });
    });
    await page.waitForFunction(() => {
      const hero = document.querySelector('main > .hero');
      const sticky = document.querySelector('.mobile-sticky-cta');
      if (!(hero instanceof HTMLElement) || !(sticky instanceof HTMLElement)) return false;
      const rect = hero.getBoundingClientRect();
      return window.scrollY > 280
        && rect.top < window.innerHeight
        && rect.bottom > 0
        && sticky.inert
        && !sticky.classList.contains('is-visible');
    });
    const heroStickyState = await page.evaluate(() => {
      const hero = document.querySelector('main > .hero');
      const sticky = document.querySelector('.mobile-sticky-cta');
      const link = sticky?.querySelector('a');
      if (!(hero instanceof HTMLElement) || !(sticky instanceof HTMLElement) || !(link instanceof HTMLElement)) return null;
      const rect = hero.getBoundingClientRect();
      link.focus();
      return {
        scrollY: window.scrollY,
        heroVisible: rect.top < window.innerHeight && rect.bottom > 0,
        stickyVisible: sticky.classList.contains('is-visible'),
        stickyInert: sticky.inert,
        stickyFocused: document.activeElement === link,
      };
    });
    assert.deepEqual(heroStickyState, {
      scrollY: heroStickyState?.scrollY,
      heroVisible: true,
      stickyVisible: false,
      stickyInert: true,
      stickyFocused: false,
    }, `${viewport.width}x${viewport.height} sticky CTA must stay hidden and inert while the hero remains visible`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#price-area').focus();
  await page.waitForFunction(() => document.documentElement.dataset.homepageCriticalClient === 'loaded');
  await page.evaluate(async () => {
    const target = document.querySelector('#cena');
    if (!(target instanceof HTMLElement)) throw new Error('homepage slow-scroll target missing');
    const start = target.offsetTop + Math.min(180, Math.max(40, target.offsetHeight / 3));
    window.scrollTo(0, start);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    for (let y = start; y <= start + 60; y += 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
  await page.waitForFunction(() => {
    const intersects = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      return rect.top < innerHeight && rect.bottom > 0;
    };
    return !intersects('main > .hero') && !intersects('#dopyt') && !intersects('[data-price-calculator]');
  });
  await page.waitForFunction(() => document.querySelector('.mobile-sticky-cta')?.classList.contains('is-visible') === false);
  await page.evaluate(async () => {
    const start = window.scrollY;
    for (let y = start; y >= start - 60; y -= 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
  await page.waitForFunction(() => {
    const sticky = document.querySelector('.mobile-sticky-cta');
    return sticky instanceof HTMLElement && sticky.classList.contains('is-visible') && !sticky.inert;
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await resetVisualScroll();

  const browser = page.context().browser();
  assert.ok(browser, 'responsive logo checks require a browser instance');
  for (const viewport of [{ width: 820, height: 900 }, { width: 821, height: 900 }]) {
    const logoContext = await browser.newContext({ viewport });
    const logoPage = await logoContext.newPage();
    const logoRequests = [];
    logoPage.on('request', (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.origin === appOrigin && /\/assets\/astana-logo(?:-dark)?\.png$/.test(requestUrl.pathname)) {
        logoRequests.push(`${requestUrl.pathname}${requestUrl.search}`);
      }
    });
    try {
      const logoResponse = await logoPage.goto(appOrigin, { waitUntil: 'networkidle', timeout: 45_000 });
      assert.equal(logoResponse?.status(), 200);
      await logoPage.locator('.site-header .header-brand-logo').waitFor({ state: 'visible' });
      const currentLogoUrl = new URL(await logoPage.locator('.site-header .header-brand-logo').evaluate((logo) => logo.currentSrc));
      const expectedHeaderLogo = '/assets/astana-logo-dark.png';
      assert.equal(`${currentLogoUrl.pathname}${currentLogoUrl.search}`, expectedHeaderLogo,
        `header must keep one contrast-safe source at ${viewport.width}px`);
      assert.equal(logoRequests.filter((url) => url === expectedHeaderLogo).length, 1,
        `header logo must be requested exactly once at ${viewport.width}px: ${JSON.stringify(logoRequests)}`);
      assert.equal(logoRequests.some((url) => url.startsWith('/assets/astana-logo.png')), false,
        `header must not download a second contrast variant: ${JSON.stringify(logoRequests)}`);
    } finally {
      await logoContext.close();
    }
  }

  const reducedMotionRoutes = ['/', '/strechari/'];
  const reducedMotionContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  await reducedMotionContext.route('**/*', async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== appOrigin || request.method() !== 'GET') {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  try {
    const reducedMotionPage = await reducedMotionContext.newPage();
    for (const route of reducedMotionRoutes) {
      const response = await reducedMotionPage.goto(`${appOrigin}${route === '/' ? '' : route}`, {
        waitUntil: 'networkidle', timeout: 45_000,
      });
      assert.equal(response?.status(), 200, `${route} reduced-motion route should render`);
      if (route === '/') {
        const deferredTrigger = reducedMotionPage.locator('#realizacie-astana, #recenzie, #faq').first();
        assert.equal(await deferredTrigger.count(), 1, 'homepage reduced-motion test needs a deferred-client trigger');
        await deferredTrigger.scrollIntoViewIfNeeded();
        await reducedMotionPage.waitForFunction(() => document.documentElement.dataset.homepageBelowFoldClient === 'loaded');
      }
      const motionState = await reducedMotionPage.evaluate(() => ({
        preference: matchMedia('(prefers-reduced-motion: reduce)').matches,
        enhancedClass: document.documentElement.classList.contains('has-enhanced-motion'),
        revealClasses: document.querySelectorAll('.reveal-on-scroll').length,
        hiddenRelevantContent: [...document.querySelectorAll('.section, .transport-banner, .final-cta, .site-footer, .roofer-hero, .roofer-final')]
          .filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || rect.width === 0 || rect.height === 0;
          }).length,
        runningAnimations: document.getAnimations()
          .filter((animation) => animation.playState === 'running')
          .map((animation) => ({
            name: animation.animationName || animation.transitionProperty || animation.constructor.name,
            target: animation.effect?.target instanceof Element
              ? `${animation.effect.target.tagName.toLowerCase()}${animation.effect.target.id ? `#${animation.effect.target.id}` : ''}${[...animation.effect.target.classList].map((className) => `.${className}`).join('')}`
              : 'unknown',
          })),
      }));
      assert.deepEqual(motionState, {
        preference: true,
        enhancedClass: false,
        revealClasses: 0,
        hiddenRelevantContent: 0,
        runningAnimations: [],
      }, `${route} must not initialize decorative motion when reduced motion is requested`);
    }
  } finally {
    await reducedMotionContext.close();
  }

  const zoomRoutes = ['/', '/cena-likvidacie-azbestu/', '/realizacie/', '/kariera/', '/strechari/'];
  const zoomContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await zoomContext.route('**/*', async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== appOrigin || request.method() !== 'GET') {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  try {
    const zoomPage = await zoomContext.newPage();
    const cdp = await zoomContext.newCDPSession(zoomPage);
    for (const route of zoomRoutes) {
      const response = await zoomPage.goto(`${appOrigin}${route === '/' ? '' : route}`, {
        waitUntil: 'networkidle', timeout: 45_000,
      });
      assert.equal(response?.status(), 200, `${route} 200% zoom route should render`);
      await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
      await zoomPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const zoomState = await zoomPage.evaluate(() => {
        const heading = document.querySelector('h1')?.getBoundingClientRect();
        const primaryAction = document.querySelector('.hero .button-primary, .career-application-form button[type="submit"], main a.button-primary')?.getBoundingClientRect();
        return {
          scale: visualViewport?.scale || 1,
          visualWidth: visualViewport?.width || innerWidth,
          visualHeight: visualViewport?.height || innerHeight,
          heading: heading ? { left: heading.left, right: heading.right, top: heading.top, bottom: heading.bottom } : null,
          primaryAction: primaryAction ? {
            left: primaryAction.left, right: primaryAction.right, top: primaryAction.top, bottom: primaryAction.bottom,
          } : null,
        };
      });
      assert.ok(zoomState.scale >= 1.99, `${route} must be evaluated at 200% browser zoom: ${JSON.stringify(zoomState)}`);
      assert.ok(zoomState.heading && zoomState.heading.right > zoomState.heading.left && zoomState.heading.bottom > zoomState.heading.top,
        `${route} H1 must remain rendered at 200% zoom: ${JSON.stringify(zoomState)}`);
      assert.ok(zoomState.primaryAction && zoomState.primaryAction.right > zoomState.primaryAction.left
        && zoomState.primaryAction.bottom > zoomState.primaryAction.top,
      `${route} primary action must remain rendered at 200% zoom: ${JSON.stringify(zoomState)}`);
    }
  } finally {
    await zoomContext.close();
  }

  const viewports = [
    { width: 320, height: 568 }, { width: 360, height: 800 }, { width: 390, height: 844 },
    { width: 568, height: 320 }, { width: 760, height: 900 }, { width: 761, height: 900 },
    { width: 768, height: 1024 }, { width: 820, height: 900 }, { width: 821, height: 900 },
    { width: 1024, height: 768 }, { width: 1440, height: 900 },
  ];
  const routes = [
    ['home', '/'], ['price', '/cena-likvidacie-azbestu/'], ['realizations', '/realizacie/'],
    ['career', '/kariera/'], ['roofers', '/strechari/'], ['process', '/postup/'], ['contact', '/kontakt/'],
    ['service-asbestos', '/likvidacia-azbestu/'], ['service-eternit', '/likvidacia-eternitu/'],
    ['region', '/likvidacia-azbestu-poprad/'], ['region-trencin', '/likvidacia-azbestu-trencin/'],
    ['coverage', '/kde-posobime/'], ['faq', '/faq/'],
    ['about', '/o-firme/'], ['advice', '/poradna/'],
    ['article', '/poradna/kolko-stoji-likvidacia-azbestu/'], ['reviews', '/recenzie/'],
    ['partner-roofers', '/spolupracujuci-strechari/'], ['privacy', '/ochrana-osobnych-udajov/'],
    ['terms', '/podmienky-pouzivania/'], ['cookies', '/cookies/'],
  ];
  const measured = [];
  const computedStyleSnapshots = [];
  for (const [name, route] of routes) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(`${appOrigin}${route === '/' ? '' : route}`, { waitUntil: 'networkidle', timeout: 45_000 });
    assert.equal(response?.status(), 200, `${route} should render`);
    await stabilizeVisualPage();
    assert.equal(await page.locator('h1').count(), 1, `${route} should show one H1`);
    assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0, `${route} should not show an error overlay`);
    if (name === 'realizations') {
      await page.waitForFunction(() => [...document.querySelectorAll('.realizations-hero-strip img')]
        .every((image) => image.complete && image.naturalWidth > 0), null, { timeout: 20_000 });
    }
    if (name === 'process') {
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--postup-route-css').trim()), '1',
        '/postup/ must load its route-owned presentation');
    }
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.locator('.site-header .header-brand-logo').waitFor({ state: 'visible' });
      await page.locator('.site-header .header-brand-logo').evaluate(async (logo) => {
        if (!(logo instanceof HTMLImageElement)) throw new Error('header logo is not an image');
        await logo.decode();
      });
      const metrics = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        logo: (() => {
          const logo = document.querySelector('.site-header .header-brand-logo');
          if (!(logo instanceof HTMLImageElement)) return null;
          const rect = logo.getBoundingClientRect();
          const style = getComputedStyle(logo);
          const brandRect = logo.closest('.brand')?.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
            opacity: style.opacity,
            visibility: style.visibility,
            display: style.display,
            brandLeft: brandRect?.left,
            brandRight: brandRect?.right,
            complete: logo.complete,
            naturalWidth: logo.naturalWidth,
            currentSrc: logo.currentSrc,
            alt: logo.alt,
          };
        })(),
        headerMainDisplay: getComputedStyle(document.querySelector('.site-header .header-main')).display,
        h1: (() => {
          const heading = document.querySelector('h1');
          if (!heading) return null;
          const style = getComputedStyle(heading);
          const rect = heading.getBoundingClientRect();
          return { display: style.display, visibility: style.visibility, opacity: style.opacity, width: rect.width, height: rect.height };
        })(),
      }));
      assert.ok(metrics.h1 && metrics.h1.display !== 'none' && metrics.h1.visibility !== 'hidden'
        && Number(metrics.h1.opacity) > 0 && metrics.h1.width > 0 && metrics.h1.height > 0,
      `${route} H1 hidden at ${viewport.width}px: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.logo && metrics.logo.complete && metrics.logo.naturalWidth > 0
        && metrics.logo.left >= -1 && metrics.logo.right <= metrics.viewport + 1
        && metrics.logo.width > 0 && metrics.logo.height > 0
        && metrics.logo.display !== 'none' && metrics.logo.visibility !== 'hidden' && Number(metrics.logo.opacity) === 1
        && metrics.logo.brandLeft >= -1 && metrics.logo.brandRight <= metrics.viewport + 1
        && metrics.logo.left >= metrics.logo.brandLeft - 1 && metrics.logo.right <= metrics.logo.brandRight + 1,
      `${route} header logo missing or clipped at ${viewport.width}px: ${JSON.stringify(metrics)}`);
      assert.equal(metrics.logo.alt, 'ASTANA', `${route} header logo must retain its accessible alternative text`);
      const currentLogoUrl = new URL(metrics.logo.currentSrc);
      assert.equal(currentLogoUrl.origin, appOrigin, `${route} header logo must stay on the isolated app origin`);
      assert.equal(currentLogoUrl.pathname, '/assets/astana-logo-dark.png',
        `${route} header logo source changed at ${viewport.width}px`);
      assert.equal(currentLogoUrl.search, '', `${route} header logo source must stay cache-stable at ${viewport.width}px`);
      if (viewport.width === 320 || viewport.width === 1440) {
        const png = await page.locator('.site-header .header-brand-logo').screenshot({ type: 'png', animations: 'disabled' });
        const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let redPixels = 0;
        let contrastPixels = 0;
        for (let offset = 0; offset < data.length; offset += info.channels) {
          const red = data[offset];
          const green = data[offset + 1];
          const blue = data[offset + 2];
          if (red > 140 && red > green * 1.35 && red > blue * 1.35) redPixels += 1;
          if (red > 190 && green > 190 && blue > 190) contrastPixels += 1;
        }
        assert.ok(redPixels > 40 && contrastPixels > 80,
          `${route} header logo must contain visible red and contrast pixels at ${viewport.width}px: ${JSON.stringify({ redPixels, contrastPixels, info })}`);
        logoPixelChecks += 1;
      }
      if (viewport.width <= 760) {
        assert.equal(metrics.headerMainDisplay, 'flex', `${route} mobile header must keep a stable flex paint layer at ${viewport.width}px`);
      }
      assert.ok(Math.max(metrics.document, metrics.body) <= metrics.viewport + 1,
        `${route} overflows horizontally at ${viewport.width}px: ${JSON.stringify(metrics)}`);
      if ((['career', 'realizations', 'process'].includes(name) || name.startsWith('region-')) && viewport.width <= 760) {
        assert.equal(await page.locator('.whatsapp-btn').evaluate((button) => getComputedStyle(button).display), 'none',
          `${route} floating WhatsApp must not cover the mobile primary action at ${viewport.width}px`);
      }
      if (name === 'process' && viewport.width > 760) {
        assert.notEqual(await page.locator('.whatsapp-btn').evaluate((button) => getComputedStyle(button).display), 'none',
          `${route} floating WhatsApp must remain available on desktop at ${viewport.width}px`);
      }
      if (name === 'career' && [320, 390, 760, 761, 1024, 1440].includes(viewport.width)) {
        const firstInput = page.locator('.career-form-grid input').first();
        await firstInput.focus();
        computedStyleSnapshots.push(await page.evaluate(({ width, height }) => {
          const selectors = [
            '.career-page', '.career-hero', '.career-intro h1', '.career-expectations',
            '.career-application-section', '.career-application-form', '.career-form-grid',
            '.career-checks', '.career-submit', '.career-faq', '.career-form-grid input:focus',
          ];
          const properties = [
            'display', 'position', 'color', 'background-color', 'background-image',
            'border-top-width', 'border-top-color', 'border-radius', 'padding-top',
            'grid-template-columns', 'gap', 'font-size', 'line-height', 'max-width',
            'width', 'height', 'visibility', 'opacity',
          ];
          return {
            viewport: { width, height },
            elements: selectors.map((selector) => {
              const element = document.querySelector(selector);
              if (!element) return { selector, missing: true };
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return {
                selector,
                style: Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)])),
                rect: Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, Number(rect[key].toFixed(3))])),
              };
            }),
          };
        }, viewport));
        await firstInput.blur();
      }
      if (name === 'price' && viewport.width === 320 && viewport.height === 568) {
        const primary = page.locator('.price-hero-actions .button-primary');
        const action = await primary.boundingBox();
        assert.equal(await primary.getAttribute('href'), '/#dopyt');
        assert.equal(await page.locator('.price-hero-actions a[href="#orientacna-cena"]').count(), 1);
        assert.ok(action && action.x >= 0 && action.x + action.width <= viewport.width && action.y + action.height <= viewport.height,
          `price quote action must be visible without scrolling at 320x568: ${JSON.stringify(action)}`);
      }
      if (name === 'home') {
        if ([320, 390, 760, 761, 1024, 1440].includes(viewport.width)) {
          computedStyleSnapshots.push(await page.evaluate(({ width, height }) => {
            const selectors = [
              '.hero', '.hero-copy', '.hero-photo', '.hero-photo img', '.quote-card',
              '.price-calculator-section', '#preco', '#cena', '#azbest', '.faq-grid',
            ];
            const properties = [
              'display', 'position', 'color', 'background-color', 'background-image',
              'border-top-width', 'border-top-color', 'border-radius', 'padding-top',
              'grid-template-columns', 'gap', 'font-size', 'line-height', 'max-width',
              'width', 'height', 'visibility', 'opacity',
            ];
            return {
              route: 'home',
              viewport: { width, height },
              elements: selectors.map((selector) => {
                const element = document.querySelector(selector);
                if (!element) return { selector, missing: true };
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return {
                  selector,
                  style: Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)])),
                  rect: Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, Number(rect[key].toFixed(3))])),
                };
              }),
            };
          }, viewport));
        }
        const homepageGridColumns = await page.evaluate(() => Object.fromEntries([
          ['faq', '.faq-grid'],
        ].map(([key, selector]) => {
          const element = document.querySelector(selector);
          const value = element ? getComputedStyle(element).gridTemplateColumns : '';
          return [key, value === 'none' || !value ? 0 : value.trim().split(/\s+/).length];
        })));
        const expectedHomepageColumns = {
          faq: viewport.width <= 860 ? 1 : viewport.width <= 1320 ? 2 : 3,
        };
        assert.deepEqual(
          homepageGridColumns,
          expectedHomepageColumns,
          `homepage responsive grids changed at ${viewport.width}px`,
        );
        if (viewport.width === 320) {
          await resetVisualScroll();
          await page.locator('.hero-counters').screenshot({ path: path.join(screenshotDir, 'home-counters-320.png'), type: 'png', caret: 'initial' });
          screenshotCount += 1;
        }
        const action = await page.locator('.hero-actions .button-primary').boundingBox();
        assert.ok(action && action.x >= -1 && action.x + action.width <= viewport.width + 1,
          `homepage quote action clipped at ${viewport.width}px: ${JSON.stringify(action)}`);
        const counter = await page.locator('.hero-counters').evaluate((root) => {
          const labels = [...root.querySelectorAll('.hero-counter-item strong')];
          const rects = labels.map((label) => {
            const range = document.createRange();
            range.selectNodeContents(label);
            return [...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
          });
          return {
            text: labels[1]?.textContent?.trim(),
            overflow: labels[1] && getComputedStyle(labels[1].parentElement).overflowX,
            lines: rects[1],
            neighbors: [...rects[0], ...rects[2]],
          };
        });
        assert.equal(counter.text, 'Celé Slovensko');
        if (viewport.width <= 480) assert.equal(counter.overflow, 'visible', 'narrow nationwide label must not be clipped by its grid item');
        assert.ok(counter.lines.length > 0 && counter.lines.every((line) => line.left >= -1 && line.right <= viewport.width + 1),
          `homepage nationwide label leaves the viewport at ${viewport.width}px: ${JSON.stringify(counter)}`);
        assert.ok(counter.lines.every((line) => counter.neighbors.every((neighbor) =>
          line.right <= neighbor.left || neighbor.right <= line.left || line.bottom <= neighbor.top || neighbor.bottom <= line.top)),
        `homepage nationwide label overlaps another fact at ${viewport.width}px: ${JSON.stringify(counter)}`);
        if (viewport.width === 1024 || viewport.width === 1440) {
          const evidencePanel = await page.locator('.hero-real-caption').evaluate((caption) => {
            const trust = caption.querySelector('.hero-trust-card');
            if (!(trust instanceof HTMLElement)) return { nested: false };
            const parent = caption.getBoundingClientRect();
            const child = trust.getBoundingClientRect();
            return {
              nested: trust.parentElement === caption,
              contained: child.left >= parent.left - 1 && child.right <= parent.right + 1
                && child.top >= parent.top - 1 && child.bottom <= parent.bottom + 1,
            };
          });
          assert.deepEqual(evidencePanel, { nested: true, contained: true },
            `hero evidence panel must remain inside its caption at ${viewport.width}px`);
        }
        if (viewport.width === 390) {
          for (const [sectionName, selector] of [
            ['trust', '#preco'],
            ['services', '#cena'],
            ['risk', '#azbest'],
            ['faq', '.faq-section'],
          ]) {
            await page.locator(selector).screenshot({
              path: path.join(screenshotDir, `home-${sectionName}-390.png`),
              type: 'png',
              caret: 'initial',
            });
            screenshotCount += 1;
          }
        }
      }
      measured.push(`${name}:${viewport.width}x${viewport.height}`);
      if (['home', 'price', 'career', 'realizations', 'roofers', 'process', 'region-trencin'].includes(name) && [320, 390, 1440].includes(viewport.width)) {
        const screenshotResponse = await page.goto(`${appOrigin}${route === '/' ? '' : route}`, {
          waitUntil: 'networkidle',
          timeout: 45_000,
        });
        assert.equal(screenshotResponse?.status(), 200, `${route} should reload at ${viewport.width}px for visual evidence`);
        await stabilizeVisualPage();
        await resetVisualScroll();
        await page.locator('.site-header .header-brand-logo').waitFor({ state: 'visible' });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: path.join(screenshotDir, `${name}-${viewport.width}.png`), type: 'png', caret: 'initial' });
        screenshotCount += 1;
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const publicRouteCssMarker = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--admin-route-css').trim());
  assert.equal(publicRouteCssMarker, '', 'admin route CSS must not leak into public pages');
  const adminLoginResponse = await page.goto(`${appOrigin}/admin/login/`, { waitUntil: 'networkidle', timeout: 45_000 });
  assert.equal(adminLoginResponse?.status(), 200, 'admin login should render for visual QA');
  await page.evaluate(async () => { await document.fonts.ready; });
  const adminLoginMetrics = await page.evaluate(() => {
    const card = document.querySelector('.admin-login-card')?.getBoundingClientRect();
    return {
      marker: getComputedStyle(document.documentElement).getPropertyValue('--admin-route-css').trim(),
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      card: card ? { left: card.left, right: card.right, top: card.top, bottom: card.bottom, width: card.width, height: card.height } : null,
    };
  });
  assert.equal(adminLoginMetrics.marker, '1', `admin route CSS marker missing: ${JSON.stringify(adminLoginMetrics)}`);
  assert.ok(adminLoginMetrics.card && adminLoginMetrics.card.left >= 0 && adminLoginMetrics.card.right <= adminLoginMetrics.viewport,
    `admin login card must fit the mobile viewport: ${JSON.stringify(adminLoginMetrics)}`);
  assert.ok(Math.max(adminLoginMetrics.documentWidth, adminLoginMetrics.bodyWidth) <= adminLoginMetrics.viewport + 1,
    `admin login must not overflow horizontally: ${JSON.stringify(adminLoginMetrics)}`);
  await page.screenshot({ path: path.join(screenshotDir, 'admin-login-390.png'), type: 'png', caret: 'initial' });
  screenshotCount += 1;
  assert.deepEqual(hydrationErrors, [], `rendered pages must not have hydration errors: ${JSON.stringify(hydrationErrors)}`);
  const formsSubmitted = await page.evaluate(() => Number(sessionStorage.getItem('astana:visual-submit-events') || '0'));
  assert.equal(formsSubmitted, 0, 'visual audit must not submit any form');
  if (visualEvidenceLabel) {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
    const trackedDiff = execFileSync('git', ['diff', '--binary', 'HEAD'], {
      cwd: projectRoot, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024,
    });
    const untrackedPaths = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: projectRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    }).split(/\r?\n/).filter(Boolean).sort();
    const untrackedDigest = createHash('sha256');
    for (const relativePath of untrackedPaths) {
      const absolutePath = path.resolve(projectRoot, relativePath);
      assert.ok(absolutePath.startsWith(`${projectRoot}${path.sep}`), `untracked evidence input leaves project root: ${relativePath}`);
      const entry = await lstat(absolutePath);
      untrackedDigest.update(relativePath).update('\0').update(entry.isFile() ? await readFile(absolutePath) : `<${entry.isDirectory() ? 'directory' : 'non-file'}>`).update('\0');
    }
    const files = (await readdir(screenshotDir)).filter((name) => name.endsWith('.png')).sort();
    const manifest = {
      schemaVersion: 1,
      label: visualEvidenceLabel,
      generatedAt: new Date().toISOString(),
      source: {
        head,
        trackedDiffSha256: createHash('sha256').update(trackedDiff).digest('hex'),
        untrackedFilesSha256: untrackedDigest.digest('hex'),
        untrackedFileCount: untrackedPaths.length,
      },
      runtime: {
        mode: 'isolated-next-development-server',
        node: process.version,
        browser: page.context().browser()?.version() || 'unknown',
      },
      routes: routes.map(([name, route]) => ({ name, route })),
      viewports,
      screenshots: files,
      computedStyleSnapshots,
    };
    evidenceManifest = {
      path: path.join(screenshotDir, 'manifest.json'),
      value: manifest,
    };
  }
  return {
    routes: routes.length,
    viewportStates: measured.length,
    environmentChecks: {
      reducedMotionRoutes: reducedMotionRoutes.length,
      zoom200Routes: zoomRoutes.length,
      landscapeRoutes: routes.length,
    },
    screenshots: screenshotCount,
    logoPixelChecks,
    evidence: visualEvidenceLabel ? `tmp/visual-evidence-exports/${visualEvidenceLabel}` : 'owned temporary root; removed after test',
    formsSubmitted,
    hydrationErrors: hydrationErrors.length,
    evidenceManifest,
  };
}

async function runConsentTimeoutChecks(page, context, appOrigin) {
  const staleSubject = '019a4321-5e89-4aa9-9b09-775123456789';
  await context.addCookies([
    { name: 'astana_analytics_consent', value: 'denied', url: appOrigin, sameSite: 'Lax' },
    { name: 'astana_marketing_consent', value: 'denied', url: appOrigin, sameSite: 'Lax' },
    { name: 'astana_marketing_consent_subject', value: staleSubject, url: appOrigin, sameSite: 'Lax' },
  ]);
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.__astanaConsentRevokeHarness = { mode: 'hang', calls: 0, aborts: 0 };
    window.fetch = (input, init = {}) => {
      const requestUrl = new URL(typeof input === 'string' ? input : input.url, window.location.href);
      if (requestUrl.pathname !== '/api/marketing-consent/revoke/') return originalFetch(input, init);
      const harness = window.__astanaConsentRevokeHarness;
      harness.calls += 1;
      if (harness.mode === 'success') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, revoked: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return new Promise((_resolve, reject) => {
        const abort = () => {
          harness.aborts += 1;
          reject(new DOMException('Isolated hanging request aborted.', 'AbortError'));
        };
        if (init.signal?.aborted) abort();
        else init.signal?.addEventListener('abort', abort, { once: true });
      });
    };
  });

  await page.setViewportSize({ width: 320, height: 568 });
  const response = await page.goto(`${appOrigin}/cookies/`, { waitUntil: 'networkidle', timeout: 45_000 });
  assert.equal(response?.status(), 200, 'isolated consent timeout page must render');
  await page.getByRole('button', { name: 'Upraviť nastavenia cookies' }).click();
  const banner = page.locator('.cookie-banner');
  await banner.waitFor({ state: 'visible' });
  const consentCookies = await page.evaluate(() => document.cookie);
  assert.match(consentCookies, /astana_marketing_consent=denied/, `isolated denied consent cookie missing: ${consentCookies}`);
  assert.match(consentCookies, new RegExp(`astana_marketing_consent_subject=${staleSubject}`),
    `isolated stale consent subject missing: ${consentCookies}`);
  const accept = page.getByRole('button', { name: 'Prijať všetky' });
  await accept.click();
  await page.waitForFunction(() => window.__astanaConsentRevokeHarness?.calls === 1, null, { timeout: 5_000 });
  await page.waitForFunction(() => window.__astanaConsentRevokeHarness?.aborts === 1, null, { timeout: 12_000 });
  await page.locator('.cookie-consent-error').waitFor({ state: 'visible', timeout: 2_000 });

  const timeoutState = await page.evaluate((expectedSubject) => {
    const bannerRect = document.querySelector('.cookie-banner')?.getBoundingClientRect();
    const error = document.querySelector('.cookie-consent-error');
    const acceptButton = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Prijať všetky');
    return {
      analytics: document.cookie.includes('astana_analytics_consent=denied'),
      marketing: document.cookie.includes('astana_marketing_consent=denied'),
      subjectPreserved: document.cookie.includes(`astana_marketing_consent_subject=${expectedSubject}`),
      pending: localStorage.getItem('astana_marketing_revocation_pending'),
      errorText: error?.textContent?.trim() || '',
      buttonEnabled: acceptButton instanceof HTMLButtonElement && !acceptButton.disabled,
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
      bannerVisible: Boolean(bannerRect && bannerRect.width > 0 && bannerRect.height > 0),
      fetchHarness: window.__astanaConsentRevokeHarness,
    };
  }, staleSubject);
  assert.deepEqual(timeoutState, {
    analytics: false,
    marketing: true,
    subjectPreserved: true,
    pending: staleSubject,
    errorText: 'Marketingové meranie sa zatiaľ nepodarilo bezpečne znovu povoliť. Skúste to ešte raz.',
    buttonEnabled: true,
    noHorizontalOverflow: true,
    bannerVisible: true,
    fetchHarness: { mode: 'hang', calls: 1, aborts: 1 },
  }, 'timeout must stay fail-closed, visible and retryable on the smallest supported viewport');

  await page.evaluate(() => { window.__astanaConsentRevokeHarness.mode = 'success'; });
  await accept.focus();
  await page.keyboard.press('Enter');
  await banner.waitFor({ state: 'hidden' });
  const retryState = await page.evaluate((oldSubject) => {
    const subject = document.cookie.match(/(?:^|;\s*)astana_marketing_consent_subject=([^;]+)/)?.[1] || '';
    return {
      analyticsGranted: document.cookie.includes('astana_analytics_consent=granted'),
      marketingGranted: document.cookie.includes('astana_marketing_consent=granted'),
      subjectRotated: Boolean(subject && subject !== oldSubject),
      pending: localStorage.getItem('astana_marketing_revocation_pending'),
      fetchHarness: window.__astanaConsentRevokeHarness,
    };
  }, staleSubject);
  assert.deepEqual(retryState, {
    analyticsGranted: true,
    marketingGranted: true,
    subjectRotated: true,
    pending: null,
    fetchHarness: { mode: 'success', calls: 2, aborts: 1 },
  }, 'keyboard retry must complete a fresh revocation and save the explicit grant');
  return { viewport: '320x568', timeoutFailClosed: true, keyboardRetry: true, realPosts: 0 };
}

async function runPublicNavigationChecks(page, appOrigin) {
  const postRequests = [];
  const onRequest = (request) => {
    if (request.method() !== 'POST') return;
    let payload = {};
    try { payload = request.postDataJSON() || {}; } catch { /* Non-JSON writes stay visible with an empty payload. */ }
    postRequests.push({ url: request.url(), eventType: payload.eventType || '', path: payload.path || '' });
  };
  page.on('request', onRequest);
  await page.addInitScript(() => {
    document.addEventListener('submit', () => {
      sessionStorage.setItem('astana:nav-submit-events', String(Number(sessionStorage.getItem('astana:nav-submit-events') || '0') + 1));
    }, true);
  });
  const assertAnchorVisible = async (id) => {
    await page.waitForFunction((targetId) => {
      const target = document.getElementById(targetId);
      const header = document.querySelector('.site-header');
      if (!target || !header) return false;
      const rect = target.getBoundingClientRect();
      const headerBottom = header.getBoundingClientRect().bottom;
      return rect.top >= headerBottom - 4 && rect.top < innerHeight - 24 && rect.bottom > headerBottom;
    }, id, { timeout: 6_000 });
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(appOrigin, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.hero-real-note').getAttribute('href'), '/realizacie/', 'hero real-roof link targets the realizations page');
  await page.locator('.hero-real-note').click();
  await page.waitForURL(`${appOrigin}/realizacie/`);
  assert.equal(await page.locator('h1').count(), 1, 'real roof examples open realizations');

  await page.setViewportSize({ width: 320, height: 568 });
  const menu = page.locator('.menu-toggle');
  await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'true', 'mobile menu opens accessibly');
  assert.equal(await page.locator('#site-nav').evaluate((nav) => nav.classList.contains('is-open')), true);
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Escape closes the mobile menu');
  assert.equal(await page.locator('#site-nav').evaluate((nav) => nav.classList.contains('is-open')), false);
  assert.equal(await menu.evaluate((element) => document.activeElement === element), true, 'Escape restores focus to the menu toggle');
  await menu.click();
  await page.locator('#site-nav a[href="/recenzie/"]').click();
  await page.waitForURL(`${appOrigin}/recenzie/`);
  assert.match(await page.locator('h1').innerText(), /recenzie/i, 'buyer navigation exposes trust-building reviews');
  await page.goto(`${appOrigin}/kariera/`, { waitUntil: 'networkidle' });
  await page.waitForURL(`${appOrigin}/kariera/`);
  await page.locator('.career-hero a[href="#prihlasit-sa"]').click();
  await page.waitForURL(`${appOrigin}/kariera/#prihlasit-sa`);
  assert.equal(await page.locator('#prihlasit-sa').count(), 1, 'career action targets the application');
  await assertAnchorVisible('prihlasit-sa');

  await page.goto(`${appOrigin}/cena-likvidacie-azbestu/`, { waitUntil: 'networkidle' });
  await page.locator('.price-hero-actions a[href="#orientacna-cena"]').click();
  await page.waitForURL(`${appOrigin}/cena-likvidacie-azbestu/#orientacna-cena`);
  assert.equal(await page.locator('#orientacna-cena').count(), 1, 'price action targets the calculator');
  await assertAnchorVisible('orientacna-cena');
  await page.locator('.price-hero-actions a[href="/#dopyt"]').click();
  await page.waitForURL(`${appOrigin}/#dopyt`);
  assert.equal(await page.locator('#dopyt').count(), 1, 'quote action targets the lead form');
  assert.equal(await page.locator('.lead-form').count(), 1, 'quote form remains available');
  await assertAnchorVisible('dopyt');

  await page.goto(`${appOrigin}/cena-likvidacie-azbestu/?utm_source=google&utm_medium=cpc&utm_campaign=No-Consent-QA&gclid=must-not-forward`, { waitUntil: 'networkidle' });
  await page.locator('.price-hero-actions a[href="/#dopyt"]').click();
  await page.waitForURL(`${appOrigin}/#dopyt`);
  assert.equal(new URL(page.url()).search, '', 'campaign parameters are not forwarded without analytics consent');
  assert.deepEqual(postRequests, [], `navigation must not send requests: ${JSON.stringify(postRequests)}`);

  await page.context().addCookies([
    { name: 'astana_analytics_consent', value: 'granted', url: appOrigin },
    { name: 'astana_marketing_consent', value: 'granted', url: appOrigin },
  ]);
  const campaignPostStart = postRequests.length;
  const waitForAnalyticsRequest = (eventType, path) => page.waitForRequest((request) => {
    if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/analytics/') return false;
    try {
      const payload = request.postDataJSON();
      return payload?.eventType === eventType && payload?.path === path;
    } catch { return false; }
  }, { timeout: 10_000 });
  const pricePageView = waitForAnalyticsRequest('page_view', '/cena-likvidacie-azbestu/');
  await page.goto(`${appOrigin}/cena-likvidacie-azbestu/?utm_source=google&utm_medium=cpc&utm_campaign=Browser-QA&gclid=isolated-click-id`, { waitUntil: 'networkidle' });
  await pricePageView;
  const ctaClick = waitForAnalyticsRequest('cta_click', '/cena-likvidacie-azbestu/');
  const homepageView = waitForAnalyticsRequest('page_view', '/#dopyt');
  const quoteSectionView = waitForAnalyticsRequest('quote_section_view', '/#dopyt');
  await page.locator('.price-hero-actions a[href="/#dopyt"]').click();
  await page.waitForURL((url) => url.origin === new URL(appOrigin).origin
    && url.pathname === '/'
    && url.hash === '#dopyt'
    && url.searchParams.get('utm_campaign') === 'Browser-QA'
    && url.searchParams.get('gclid') === 'isolated-click-id');
  const attributedFormUrl = new URL(page.url());
  assert.equal(attributedFormUrl.searchParams.get('utm_source'), 'google', 'consented source survives the real page-to-form click');
  assert.equal(attributedFormUrl.searchParams.get('utm_medium'), 'cpc', 'consented medium survives the real page-to-form click');
  assert.equal(attributedFormUrl.searchParams.get('astana_landing'), '/cena-likvidacie-azbestu/', 'the original campaign landing page is preserved');
  await Promise.all([ctaClick, homepageView, quoteSectionView]);
  await page.waitForFunction(() => Number(sessionStorage.getItem('astana:nav-submit-events') || '0') === 0);
  const campaignPosts = postRequests.slice(campaignPostStart);
  const unexpectedCampaignPosts = campaignPosts.filter(({ url }) => !new URL(url).pathname.startsWith('/api/analytics/'));
  assert.deepEqual(unexpectedCampaignPosts, [], `campaign navigation must not submit the lead form: ${JSON.stringify(unexpectedCampaignPosts)}`);
  assert.deepEqual(campaignPosts.map(({ eventType, path }) => ({ eventType, path })), [
    { eventType: 'page_view', path: '/cena-likvidacie-azbestu/' },
    { eventType: 'cta_click', path: '/cena-likvidacie-azbestu/' },
    { eventType: 'page_view', path: '/#dopyt' },
    { eventType: 'quote_section_view', path: '/#dopyt' },
  ], 'campaign navigation records each expected funnel event exactly once and in order');
  assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('astana:nav-submit-events') || '0')), 0,
    'navigation must not submit a form');

  const homepageAnalyticsStart = postRequests.length;
  const directHomepageView = waitForAnalyticsRequest('page_view', '/');
  await page.goto(appOrigin, { waitUntil: 'networkidle' });
  await directHomepageView;
  const directHomepageCta = page.waitForRequest((request) => {
    if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/analytics/') return false;
    try { return request.postDataJSON()?.eventType === 'cta_click'; } catch { return false; }
  }, { timeout: 10_000 });
  await page.locator('.hero-actions a[href="#dopyt"]').click();
  await page.waitForURL(`${appOrigin}/#dopyt`);
  await directHomepageCta;
  await page.waitForTimeout(150);
  const directHomepageCtaEvents = postRequests.slice(homepageAnalyticsStart)
    .filter(({ eventType, path }) => eventType === 'cta_click' && (path === '/' || path === '/#dopyt'));
  assert.equal(directHomepageCtaEvents.length, 1,
    'the first homepage quote click must survive the lightweight-to-full-client handoff exactly once');
  page.off('request', onRequest);
  return { interactions: 8, campaignAttribution: true, consentDeniedCampaignParametersForwarded: false, analyticsPosts: campaignPosts.length + 2, formsSubmitted: 0 };
}

async function runRooferLocalValidationCheck(page, appOrigin) {
  await page.setViewportSize({ width: 320, height: 568 });
  const response = await page.goto(`${appOrigin}/strechari/`, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, 'roofer validation page must render');
  const form = page.locator('.roofer-registration-form');
  await form.locator('select[name="businessType"]').selectOption('szco');
  await form.locator('input[name="companyName"]').fill('Lokálna kontrola formulára');
  await form.locator('input[name="contactPerson"]').fill('Test bez odoslania');
  await form.locator('input[name="phone"]').fill('+421900000000');
  await form.locator('input[name="email"]').fill('local-validation@example.invalid');
  await form.locator('input[name="canBuildRoofTruss"][value="no"]').check();
  await form.locator('input[name="privacyConsent"]').check();

  await form.locator('button[type="submit"]').click();
  const regionError = page.locator('#roofer-regions-error');
  const firstRegion = form.locator('input[name="serviceRegions[]"]').first();
  await regionError.waitFor({ state: 'visible' });
  assert.equal(await firstRegion.evaluate((element) => document.activeElement === element), true,
    'missing region focuses the first repair control');
  assert.equal(await regionError.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  }), true, 'region error stays visible beside the focused choice at 320 px');

  await firstRegion.check();
  await form.locator('button[type="submit"]').click();
  const specializationError = page.locator('#roofer-specializations-error');
  const firstSpecialization = form.locator('input[name="specializations[]"]').first();
  await specializationError.waitFor({ state: 'visible' });
  assert.equal(await firstSpecialization.evaluate((element) => document.activeElement === element), true,
    'missing specialization focuses the first repair control');
  assert.equal(await specializationError.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  }), true, 'specialization error stays visible beside the focused choice at 320 px');

  return { viewport: '320x568', regionErrorVisible: true, specializationErrorVisible: true, formsSent: 0 };
}

async function runConsentedLeadConversionCheck(page, pglite, appOrigin, authSecret) {
  await page.goto(appOrigin, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Prijať všetky' }).click();
  assert.equal(await page.evaluate(() => document.cookie.includes('astana_marketing_consent=granted')), true,
    'marketing consent must be stored before the lead is accepted');
  await page.locator('#areaEstimate').fill('120');
  await page.locator('#city').fill('Poprad');
  await page.locator('#materialType').selectOption('Vlnitý eternit');
  await page.locator('#objectType').selectOption('Rodinný dom');
  await page.locator('#phone').fill('+421900000002');
  await page.locator('#fullName').fill('Izolovaný súhlasový test');
  await page.locator('#email').fill('consent-test@example.invalid');
  await page.locator('input[name="gdpr"]').check();
  const submissionId = randomUUID();
  const send = async () => page.evaluate(async (id) => {
    const payload = new FormData(document.querySelector('.lead-form'));
    payload.set('submissionId', id);
    const response = await fetch('/api/lead/', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
    return { status: response.status, body: await response.json() };
  }, submissionId);
  const first = await send();
  const retry = await send();
  assert.equal(first.status, 200, `consented lead must be accepted: ${JSON.stringify(first.body)}`);
  assert.equal(retry.status, 200, 'same consented request must be idempotent');
  assert.equal(first.body.ok, true);
  const expectedEventId = `lead:${createHmac('sha256', authSecret).update(`accepted-lead:${submissionId}`).digest('hex')}`;
  assert.deepEqual(first.body.metaLead, { eventId: expectedEventId, material: 'vlnity' },
    'confirmed consented lead receives only a pseudonymous conversion identity and bounded material category');
  assert.deepEqual(retry.body.metaLead, first.body.metaLead,
    'idempotent retry must retain the same conversion identity');
  assert.equal(JSON.stringify(first.body.metaLead).includes(submissionId), false, 'conversion must not reveal submission ID');
  assert.equal(JSON.stringify(first.body.metaLead).includes('consent-test@example.invalid'), false, 'conversion must not reveal contact data');
  const leads = await pglite.query('SELECT id, raw_data FROM leads WHERE submission_id = $1', [submissionId]);
  assert.equal(leads.rowCount, 1, 'consented retry must not duplicate the lead');
  assert.equal(leads.rows[0].raw_data?.marketingConsentAtSubmit, true, 'consent must be bound to stored acceptance');
  const outbox = await pglite.query('SELECT recipient_role, status FROM lead_email_outbox WHERE lead_id = $1 ORDER BY recipient_role', [leads.rows[0].id]);
  assert.deepEqual(outbox.rows.map((row) => row.recipient_role), ['customer', 'internal']);
  assert.ok(outbox.rows.every((row) => row.status === 'pending'), 'isolated test must not send real email');
  return { leads: 1, browserPosts: 2, pendingOutbox: 2, emailsSent: 0, pseudonymousConversion: true };
}

async function runHarness() {
  const historicalClient = process.env.ASTANA_HARNESS_USE_PREVIOUS_CLIENT === '1';
  const tenPhotoOnly = process.env.ASTANA_HARNESS_TEN_PHOTO_ONLY === '1';
  const noPhotoUiOnly = process.env.ASTANA_HARNESS_NO_PHOTO_UI_ONLY === '1';
  const inventoryOnly = process.env.ASTANA_HARNESS_INVENTORY_ONLY === '1';
  const galleryOnly = process.env.ASTANA_HARNESS_GALLERY_ONLY === '1';
  const careerOnly = process.env.ASTANA_HARNESS_CAREER_ONLY === '1';
  const careerDirectOnly = process.env.ASTANA_HARNESS_CAREER_DIRECT_ONLY === '1';
  const priceQuoteOnly = process.env.ASTANA_HARNESS_PRICE_QUOTE_ONLY === '1';
  const testimonialOnly = process.env.ASTANA_HARNESS_TESTIMONIAL_ONLY === '1';
  const seoOnly = process.env.ASTANA_HARNESS_SEO_ONLY === '1';
  const visualOnly = process.env.ASTANA_HARNESS_VISUAL_ONLY === '1';
  const navigationOnly = process.env.ASTANA_HARNESS_NAVIGATION_ONLY === '1';
  const conversionOnly = process.env.ASTANA_HARNESS_CONVERSION_ONLY === '1';
  const consentTimeoutOnly = process.env.ASTANA_HARNESS_CONSENT_TIMEOUT_ONLY === '1';
  const activeOnlyModes = [
    'ASTANA_HARNESS_INVENTORY_ONLY', 'ASTANA_HARNESS_GALLERY_ONLY', 'ASTANA_HARNESS_CAREER_ONLY',
    'ASTANA_HARNESS_CAREER_DIRECT_ONLY', 'ASTANA_HARNESS_PRICE_QUOTE_ONLY', 'ASTANA_HARNESS_TESTIMONIAL_ONLY',
    'ASTANA_HARNESS_SEO_ONLY', 'ASTANA_HARNESS_VISUAL_ONLY', 'ASTANA_HARNESS_NAVIGATION_ONLY', 'ASTANA_HARNESS_CONVERSION_ONLY',
    'ASTANA_HARNESS_CONSENT_TIMEOUT_ONLY',
    'ASTANA_HARNESS_TEN_PHOTO_ONLY',
    'ASTANA_HARNESS_NO_PHOTO_UI_ONLY',
  ].filter((key) => process.env[key] === '1');
  assert.ok(activeOnlyModes.length <= 1, `isolated browser harness modes are mutually exclusive: ${activeOnlyModes.join(', ')}`);
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const { default: pg } = await import('pg');
  const { chromium } = await import('@playwright/test');
  const { default: sharp } = await import('sharp');

  const edgeExecutable = process.env.ASTANA_HARNESS_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.ok(existsSync(edgeExecutable), `Local Edge browser missing: ${edgeExecutable}`);
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'astana-e1-f04-'));
  let pglite;
  let socket;
  let blobServer;
  let nextChild;
  let browser;
  let context;
  let passed = false;
  let resultSummary;
  const childLog = [];
  try {
    const externalUrl = process.env.ASTANA_ISOLATED_PG_URL;
    let isolatedPgUrl = '';
    if (externalUrl) {
      assert.equal(tenPhotoOnly, true, 'external test database is only permitted for the ten-photo scenario');
      const parsed = new URL(externalUrl);
      const runToken = process.env.ASTANA_ISOLATED_PG_RUN_TOKEN;
      const port = Number(parsed.port);
      assert.ok(['postgres:', 'postgresql:'].includes(parsed.protocol)
        && parsed.hostname === '127.0.0.1'
        && /^[a-f0-9]{32}$/.test(runToken || '')
        && parsed.pathname === `/astana_isolated_${runToken}`
        && parsed.username === 'astana_test'
        && !parsed.password && !parsed.search && !parsed.hash
        && Number.isInteger(port) && port > 0 && port <= 65535,
      'external test DB must be the guarded one-time loopback PostgreSQL instance');
      isolatedPgUrl = `postgres://astana_test@127.0.0.1:${port}/astana_isolated_${runToken}`;
      const guardPool = new pg.Pool({ connectionString: isolatedPgUrl, max: 1, connectionTimeoutMillis: 3000 });
      try {
        const marker = await guardPool.query('SELECT run_token FROM astana_isolated_runner_guard WHERE run_token = $1', [runToken]);
        assert.equal(marker.rowCount, 1, 'one-time PostgreSQL guard marker is missing');
      } finally {
        await guardPool.end();
      }
    }
    const [dbProbePort, blobPort, appPort] = await Promise.all([availablePort(), availablePort(), availablePort()]);
    const dbPort = isolatedPgUrl ? Number(new URL(isolatedPgUrl).port) : dbProbePort;
    assert.equal(new Set([dbPort, blobPort, appPort]).size, 3, 'loopback ports must be distinct');
    const appOrigin = `http://127.0.0.1:${appPort}`;
    const blobOrigin = `http://127.0.0.1:${blobPort}`;
    const databaseUrl = isolatedPgUrl || `postgres://astana_test:astana_test@127.0.0.1:${dbPort}/astana_test`;
    const readWriteToken = `vercel_blob_rw_harness_${randomBytes(32).toString('hex')}`;
    const authSecret = randomBytes(32).toString('hex');
    const cronSecret = randomBytes(32).toString('hex');
    const projectId = 'astana-local-harness';
    const retentionBinding = createHash('sha256').update(JSON.stringify([projectId, databaseUrl, readWriteToken]), 'utf8').digest('hex');

    if (isolatedPgUrl) {
      const inspectPool = new pg.Pool({ connectionString: isolatedPgUrl, max: 4, connectionTimeoutMillis: 3000 });
      pglite = { query: inspectPool.query.bind(inspectPool), close: () => inspectPool.end() };
    } else {
      pglite = await PGlite.create();
      // Dev compilation may keep separate pg pools for the lead and admin route bundles.
      socket = new PGLiteSocketServer({ db: pglite, port: dbPort, host: '127.0.0.1', maxConnections: 32 });
      await socket.start();
    }
    const fake = createBlobEmulator({ appOrigin, blobOrigin, readWriteToken });
    blobServer = fake.server;
    await listen(blobServer, blobPort);

    await createTempProject(tempRoot, historicalClient);
    const inherited = process.env;
    const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']
      .filter((key) => inherited[key]).map((key) => [key, inherited[key]]));
    Object.assign(env, {
      NODE_ENV: 'development',
      NEXT_TELEMETRY_DISABLED: '1',
      DATABASE_URL: databaseUrl,
      // PGlite's socket adapter cannot safely multiplex unnamed PostgreSQL portals.
      // Keep this emulator serialized; real PostgreSQL concurrency is covered by
      // the dedicated database integration suites.
      DATABASE_POOL_MAX: isolatedPgUrl ? '' : '1',
      BLOB_READ_WRITE_TOKEN: careerOnly ? '' : readWriteToken,
      VERCEL_BLOB_API_URL: blobOrigin,
      NEXT_PUBLIC_VERCEL_BLOB_API_URL: blobOrigin,
      VERCEL_BLOB_CALLBACK_URL: appOrigin,
      VERCEL_BLOB_RETRIES: '0',
      ALLOWED_ORIGINS: appOrigin,
      AUTH_SECRET: authSecret,
      CRON_SECRET: cronSecret,
      VERCEL_PROJECT_ID: projectId,
      LEAD_BLOB_RETENTION_BINDING_SHA256: retentionBinding,
      LEAD_UPLOAD_RETENTION_DELETE_ENABLED: inventoryOnly ? '' : '1',
      LEAD_EMAIL_DELIVERY_MODE: 'smtp',
      ASTANA_HARNESS_CHILD: '1',
      ASTANA_HARNESS_BLOB_ORIGIN: blobOrigin,
      ASTANA_HARNESS_APP_ORIGIN: appOrigin,
      ASTANA_HARNESS_APP_PORT: String(appPort),
      TEMP: tempRoot,
      TMP: tempRoot,
    });
    // SMTP_*, ASTANA_RELAY_*, VERCEL_*, S3_* and production env files are
    // absent by construction. Only this child receives the fake credentials.
    nextChild = spawn(process.execPath, [scriptPath], {
      cwd: tempRoot, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [nextChild.stdout, nextChild.stderr]) stream.on('data', (chunk) => {
      childLog.push(chunk.toString('utf8'));
      if (childLog.length > 100) childLog.shift();
    });
    await waitForApp(appOrigin, nextChild, () => childLog.join(''));

    const firstImage = await pngFixture(sharp, 'astana-e1-f04-a');
    const secondImage = await pngFixture(sharp, 'astana-e1-f04-b');
    assert.notEqual(createHash('sha256').update(firstImage.buffer).digest('hex'), createHash('sha256').update(secondImage.buffer).digest('hex'));
    browser = await chromium.launch({ executablePath: edgeExecutable, headless: true, args: ['--no-first-run', '--disable-background-networking', '--disable-extensions'] });
    context = await browser.newContext({
      serviceWorkers: 'block',
      colorScheme: 'light',
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
    });
    const browserDenied = [];
    const browserNonGetBlocked = [];
    await context.route('**/*', async (route) => {
      const request = route.request();
      const requested = new URL(request.url());
      if (requested.origin !== appOrigin && requested.origin !== blobOrigin) {
        browserDenied.push(requested.origin);
        await route.abort('blockedbyclient'); return;
      }
      if (visualOnly && request.method() !== 'GET') {
        const body = request.postData();
        let eventType = '';
        try { eventType = body ? JSON.parse(body).eventType || '' : ''; } catch { /* Invalid JSON remains an unexpected request. */ }
        browserNonGetBlocked.push({ method: request.method(), url: requested.pathname, eventType });
        await route.abort('blockedbyclient'); return;
      }
      await route.continue();
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const original = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (type === 'change' && this instanceof HTMLInputElement && this.id === 'photos') {
          window.__astanaPhotoHandlerReady = true;
        }
        return original.call(this, type, listener, options);
      };
    });
    page.on('pageerror', (error) => console.error('Local browser page error:', error.message));
    page.on('console', (message) => { if (message.type() === 'error') console.error('Local browser console:', message.text().slice(0, 400)); });
    page.on('response', (response) => {
      if (response.url().startsWith(appOrigin) && response.status() >= 400) {
        console.error('Local browser HTTP error:', response.status(), response.url());
      }
    });
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText;
      if (request.url().startsWith(appOrigin) && reason !== 'net::ERR_ABORTED') console.error('Local browser request failed:', request.url(), reason);
    });
    if (tenPhotoOnly) {
      const tenPhotos = await runTenPhotoUploadChecks(page, pglite, { ...fake, blobOrigin }, appOrigin, tempRoot, sharp, firstImage, secondImage);
      assert.equal(browserDenied.length, 0, `ten-photo browser flow tried an external origin: ${browserDenied.join(', ')}`);
      resultSummary = { result: 'PASS', historicalClient, ...tenPhotos, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else if (noPhotoUiOnly) {
      const noPhoto = await runNoPhotoUiChecks(page, pglite, fake, appOrigin);
      assert.equal(browserDenied.length, 0, `no-photo UI tried an external origin: ${browserDenied.join(', ')}`);
      resultSummary = { result: 'PASS', ...noPhoto, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else if (visualOnly) {
      const visualRun = await runResponsiveVisualChecks(page, appOrigin, tempRoot, sharp);
      const { evidenceManifest, ...visual } = visualRun;
      const rooferValidation = await runRooferLocalValidationCheck(page, appOrigin);
      const navigation = await runPublicNavigationChecks(page, appOrigin);
      assert.equal(browserDenied.length, 0, `visual audit tried an external origin: ${browserDenied.join(', ')}`);
      assert.deepEqual(browserNonGetBlocked, [
        { method: 'POST', url: '/api/analytics/', eventType: 'page_view' },
        { method: 'POST', url: '/api/analytics/', eventType: 'cta_click' },
        { method: 'POST', url: '/api/analytics/', eventType: 'page_view' },
        { method: 'POST', url: '/api/analytics/', eventType: 'quote_section_view' },
        { method: 'POST', url: '/api/analytics/', eventType: 'page_view' },
        { method: 'POST', url: '/api/analytics/', eventType: 'cta_click' },
        { method: 'POST', url: '/api/analytics/', eventType: 'quote_section_view' },
      ], `visual audit must block exactly the seven expected local funnel events: ${JSON.stringify(browserNonGetBlocked)}`);
      if (evidenceManifest) {
        const finalizedManifest = {
          ...evidenceManifest.value,
          verification: {
            formsSubmitted: visual.formsSubmitted,
            hydrationErrors: visual.hydrationErrors,
            blockedBrowserOrigins: browserDenied.length,
            blockedNonGetRequests: browserNonGetBlocked.length,
            navigationInteractions: navigation.interactions,
          },
        };
        await writeFile(evidenceManifest.path, `${JSON.stringify(finalizedManifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      }
      resultSummary = {
        result: 'PASS', ...visual, rooferValidation, navigation,
        blockedNonGetRequests: browserNonGetBlocked.length,
        blockedBrowserOrigins: browserDenied.length,
      };
      passed = true;
    } else if (consentTimeoutOnly) {
      const consentTimeout = await runConsentTimeoutChecks(page, context, appOrigin);
      assert.equal(browserDenied.length, 0, `consent timeout flow tried an external origin: ${browserDenied.join(', ')}`);
      assert.deepEqual(browserNonGetBlocked, [], 'consent timeout flow must not make a real non-GET request');
      resultSummary = { result: 'PASS', ...consentTimeout, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else if (navigationOnly) {
      const rooferValidation = await runRooferLocalValidationCheck(page, appOrigin);
      const navigation = await runPublicNavigationChecks(page, appOrigin);
      assert.equal(browserDenied.length, 0, `navigation audit tried an external origin: ${browserDenied.join(', ')}`);
      resultSummary = { result: 'PASS', rooferValidation, navigation, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else if (conversionOnly) {
      const conversion = await runConsentedLeadConversionCheck(page, pglite, appOrigin, authSecret);
      assert.equal(browserDenied.length, 0, `conversion audit tried an external origin: ${browserDenied.join(', ')}`);
      resultSummary = { result: 'PASS', ...conversion, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else if (seoOnly) {
      const seo = await runPublicSeoCrawl(page, appOrigin);
      resultSummary = { result: 'PASS', ...seo, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else if (priceQuoteOnly) {
      const priceQuote = await runPriceQuoteChecks(page, appOrigin, tempRoot);
      assert.equal(browserDenied.length, 0, `price quote tried an external origin: ${browserDenied.join(', ')}`);
      resultSummary = { result: 'PASS', ...priceQuote, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else if (careerDirectOnly) {
      const career = await runCareerDirectCvChecks(page, pglite, { ...fake, blobOrigin }, appOrigin);
      assert.equal(browserDenied.length, 0, `career upload tried an external origin: ${browserDenied.join(', ')}`);
      resultSummary = { result: 'PASS', ...career, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else if (careerOnly) {
      const career = await runCareerRetryChecks(page, pglite, appOrigin, tempRoot);
      const roofers = await runRooferSubmissionChecks(page, pglite, appOrigin);
      assert.equal(browserDenied.length, 0, `career form tried an external origin: ${browserDenied.join(', ')}`);
      resultSummary = { result: 'PASS', ...career, ...roofers, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else if (galleryOnly) {
      const gallery = await runGalleryMobileChecks(page, appOrigin, tempRoot);
      assert.equal(browserDenied.length, 0, `gallery tried an external origin: ${browserDenied.join(', ')}`);
      resultSummary = { result: 'PASS', ...gallery, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else if (testimonialOnly) {
      const testimonial = await runTestimonialReceiptChecks(page, pglite, appOrigin);
      assert.equal(browserDenied.length, 0, `review flow tried an external origin: ${browserDenied.join(', ')}`);
      resultSummary = { result: 'PASS', ...testimonial, blockedBrowserOrigins: browserDenied.length };
      passed = true;
    } else {
    const historicalFirstConflict = historicalClient
      ? await runHistoricalPreReservationCheck(context, pglite, fake, appOrigin, firstImage) : false;
    let firstResponse;
    let retryResponse;
    let leadPostCount = 0;
    await page.route('**/api/dopyt/', async (route) => {
      assert.equal(new URL(route.request().url()).origin, appOrigin);
      leadPostCount++;
      if (leadPostCount === 1) {
        const response = await route.fetch();
        firstResponse = { status: response.status(), body: await response.json() };
        await route.abort('failed'); // Commit happened, browser must retry same form.
      } else {
        const response = await route.fetch();
        retryResponse = { status: response.status(), body: await response.json() };
        if (historicalClient) {
          await route.fulfill({ response });
        } else {
          // A mixed-version response may omit this field; absence is not proof of an email send.
          const { emailSent: _emailSent, ...browserReply } = retryResponse.body;
          await route.fulfill({ response, contentType: 'application/json', body: JSON.stringify(browserReply) });
        }
      }
    });
    await page.goto(`${appOrigin}/#dopyt`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('#dopyt').scrollIntoViewIfNeeded();
    await page.locator('#areaEstimate').focus();
    await page.waitForFunction(() => window.__astanaPhotoHandlerReady === true, null, { timeout: 30_000 });
    await page.locator('#areaEstimate').fill('120');
    await page.locator('#city').fill('Poprad');
    await page.locator('#materialType').selectOption('Vlnitý eternit');
    await page.locator('#objectType').selectOption('Rodinný dom');
    await page.locator('#phone').fill('+421900000001');
    await page.locator('#fullName').fill('Izolovaný integračný test');
    await page.locator('#email').fill('astana-e1-f04@example.invalid');
    await page.locator('input[name="gdpr"]').check();
    const emptyPhotoResponse = await page.evaluate(async () => {
      const form = document.querySelector('.lead-form');
      const payload = new FormData(form);
      payload.append('photos', new File([], 'empty.png', { type: 'image/png' }));
      const response = await fetch('/api/lead/', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
      return { status: response.status, body: await response.json() };
    });
    assert.equal(emptyPhotoResponse.status, 400, 'a named empty photo must not be silently dropped');
    assert.match(emptyPhotoResponse.body.message, /Nahraný súbor je prázdny/);
    assert.equal((await pglite.query('SELECT id FROM leads')).rowCount, 0, 'empty-photo rejection must happen before persistence');
    const corruptPhotoResponse = await page.evaluate(async () => {
      const payload = new FormData(document.querySelector('.lead-form'));
      payload.append('photos', new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], 'broken.png', { type: 'image/png' }));
      const response = await fetch('/api/lead/', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
      return { status: response.status, body: await response.json() };
    });
    assert.equal(corruptPhotoResponse.status, 400, 'damaged PNG must not create a lead');
    assert.match(corruptPhotoResponse.body.message, /poškodená|nepodarilo prečítať/);
    assert.equal((await pglite.query('SELECT id FROM leads')).rowCount, 0, 'corrupt-photo rejection must happen before persistence');
    const malformedManifestResponses = await page.evaluate(async () => {
      const variants = [
        (payload) => payload.set('uploadedPhotos', new File(['[]'], 'photos.json', { type: 'application/json' })),
        (payload) => payload.set('uploadedPhotos', '  '),
        (payload) => { payload.append('uploadedPhotos', '[]'); payload.append('uploadedPhotos', '[]'); },
      ];
      const results = [];
      for (const change of variants) {
        const payload = new FormData(document.querySelector('.lead-form'));
        change(payload);
        const response = await fetch('/api/lead/', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
        results.push({ status: response.status, body: await response.json() });
      }
      return results;
    });
    for (const response of malformedManifestResponses) {
      assert.equal(response.status, 400, 'a present but malformed photo manifest must not be silently ignored');
      assert.match(response.body.message, /Fotky sa nepodarilo overiť/);
    }
    assert.equal((await pglite.query('SELECT id FROM leads')).rowCount, 0, 'malformed direct-photo manifests must be rejected before persistence');
    for (const invalidId of ['00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff']) {
      const invalidIdResponse = await page.evaluate(async (submissionId) => {
        const payload = new FormData(document.querySelector('.lead-form'));
        payload.set('submissionId', submissionId);
        const response = await fetch('/api/lead/', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
        return { status: response.status, body: await response.json() };
      }, invalidId);
      assert.equal(invalidIdResponse.status, 400, 'a shared nil/max UUID cannot identify a form attempt');
      assert.equal(invalidIdResponse.body.metaLead, undefined);
      const invalidPhotoIdResponse = await page.evaluate(async ({ submissionId, pathname }) => {
        const payload = new FormData(document.querySelector('.lead-form'));
        payload.delete('submissionId');
        payload.set('uploadedPhotos', JSON.stringify([{ submissionId, pathname, originalName: 'photo.png' }]));
        const response = await fetch('/api/lead/', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
        return { status: response.status, body: await response.json() };
      }, { submissionId: invalidId, pathname: `lead-drafts/${invalidId}/${randomUUID()}.png` });
      assert.equal(invalidPhotoIdResponse.status, 400, 'a direct-photo ID must follow the same form identity policy');
      assert.equal(invalidPhotoIdResponse.body.metaLead, undefined);
      const invalidUploadToken = await page.evaluate(async ({ submissionId, pathname }) => {
        const response = await fetch('/api/lead-upload/', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'blob.generate-client-token',
            payload: { pathname, clientPayload: JSON.stringify({ submissionId }), multipart: true },
          }),
        });
        return { status: response.status, body: await response.json() };
      }, { submissionId: invalidId, pathname: `lead-drafts/${invalidId}/${randomUUID()}.png` });
      assert.equal(invalidUploadToken.status, 400, 'nil/max UUID must be rejected before a private upload reservation');
      assert.equal((await pglite.query('SELECT id FROM leads')).rowCount, 0);
      assert.equal((await pglite.query('SELECT storage_key FROM lead_upload_drafts')).rowCount, 0);
    }
    const legacyTenId = randomUUID();
    const legacyFirstPaths = Array.from({ length: 10 }, () => `lead-drafts/${legacyTenId}/${randomUUID()}.png`);
    const requestLegacyTokens = (paths) => page.evaluate(async ({ submissionId, pathnames }) => {
      const statuses = [];
      for (const pathname of pathnames) {
        const response = await fetch('/api/lead-upload/', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'blob.generate-client-token', payload: {
            pathname, clientPayload: JSON.stringify({ submissionId }), multipart: true,
          } }),
        });
        statuses.push(response.status);
      }
      return statuses;
    }, { submissionId: legacyTenId, pathnames: paths });
    assert.deepEqual(await requestLegacyTokens(legacyFirstPaths), Array(10).fill(200), 'old client may reserve exactly ten photo tokens');
    await pglite.query(
      `UPDATE lead_upload_drafts SET status = 'uploaded' WHERE storage_key = ANY($1::text[])`,
      [legacyFirstPaths.slice(0, 9)],
    );
    const legacyRetryPaths = Array.from({ length: 10 }, () => `lead-drafts/${legacyTenId}/${randomUUID()}.png`);
    assert.deepEqual(await requestLegacyTokens(legacyRetryPaths), Array(10).fill(200),
      'an old tab can retry all ten photos after one upload was interrupted after reservation');
    const legacyTenDrafts = await pglite.query('SELECT storage_key, status FROM lead_upload_drafts WHERE submission_id = $1', [legacyTenId]);
    assert.deepEqual(new Set(legacyTenDrafts.rows.filter((row) => row.status === 'superseded').map((row) => row.storage_key)), new Set(legacyFirstPaths));
    assert.deepEqual(new Set(legacyTenDrafts.rows.filter((row) => row.status === 'uploading').map((row) => row.storage_key)), new Set(legacyRetryPaths));
    assert.equal((await pglite.query('SELECT id FROM leads')).rowCount, 0, 'token recovery alone must never claim a lead was accepted');
    const oldSubmissionId = randomUUID();
    const oldPhotoPath = `lead-drafts/${oldSubmissionId}/${randomUUID()}.png`;
    const oldBlob = {
      pathname: oldPhotoPath,
      url: `https://${privateBlobHost}/${oldPhotoPath}`,
      downloadUrl: `https://${privateBlobHost}/${oldPhotoPath}?download=1`,
      size: firstImage.buffer.length,
      contentType: 'image/png',
      contentDisposition: 'inline',
      cacheControl: 'private, no-store',
      uploadedAt: new Date().toISOString(),
      etag: createHash('sha256').update(firstImage.buffer).digest('hex'),
    };
    fake.blobs.set(oldPhotoPath, { blob: oldBlob, bytes: firstImage.buffer });
    for (const outage of ['head', 'private-get']) {
      if (outage === 'head') fake.failOneLeadHead(); else fake.failOneLeadPrivateGet();
      const unavailable = await page.evaluate(async ({ submissionId, pathname, originalName }) => {
        const payload = new FormData(document.querySelector('.lead-form'));
        payload.delete('photos');
        payload.set('submissionId', submissionId);
        payload.set('uploadedPhotos', JSON.stringify([{ submissionId, pathname, originalName }]));
        const response = await fetch('/api/lead/', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
        return { status: response.status, body: await response.json() };
      }, { submissionId: oldSubmissionId, pathname: oldPhotoPath, originalName: firstImage.name });
      assert.equal(unavailable.status, 503, `${outage} storage outage is temporary, not a bad customer photo`);
      assert.match(unavailable.body.message, /Úložisko fotiek teraz neodpovedá/);
      assert.doesNotMatch(JSON.stringify(unavailable.body), /PRIVATE_DIAGNOSTIC_DO_NOT_EXPOSE|lead-drafts\//);
      assert.equal((await pglite.query('SELECT id FROM leads')).rowCount, 0, 'storage outage must not accept a lead without its photo');
      assert.equal(await page.locator('#city').inputValue(), 'Poprad');
      assert.ok(fake.blobs.has(oldPhotoPath), 'the private photo remains available for a safe retry after storage outage');
    }
    fake.hideOneLeadPrivateGet();
    const disappearedAfterHead = await page.evaluate(async ({ submissionId, pathname, originalName }) => {
      const payload = new FormData(document.querySelector('.lead-form'));
      payload.delete('photos');
      payload.set('submissionId', submissionId);
      payload.set('uploadedPhotos', JSON.stringify([{ submissionId, pathname, originalName }]));
      const response = await fetch('/api/lead/', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
      return { status: response.status, body: await response.json() };
    }, { submissionId: oldSubmissionId, pathname: oldPhotoPath, originalName: firstImage.name });
    assert.equal(disappearedAfterHead.status, 409, 'a photo missing after metadata lookup needs a recoverable retry, not a provider-outage response');
    assert.equal(disappearedAfterHead.body.retryPhotoPathname, oldPhotoPath);
    assert.match(disappearedAfterHead.body.message, /chýbajúcu fotku nahráme ešte raz/);
    assert.equal((await pglite.query('SELECT id FROM leads')).rowCount, 0);
    const abandonedPaths = [
      `lead-drafts/${randomUUID()}/${randomUUID()}.png`,
      `lead-drafts/${randomUUID()}/${randomUUID()}.png`,
    ];
    for (const [index, pathname] of abandonedPaths.entries()) {
      const bytes = index === 0 ? firstImage.buffer : secondImage.buffer;
      fake.blobs.set(pathname, {
        blob: {
          ...oldBlob, pathname,
          url: `https://${privateBlobHost}/${pathname}`,
          downloadUrl: `https://${privateBlobHost}/${pathname}?download=1`,
          uploadedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          etag: createHash('sha256').update(bytes).digest('hex'),
        },
        bytes,
      });
    }
    const oldClientResponse = await page.evaluate(async ({ submissionId, pathname, originalName }) => {
      const payload = new FormData(document.querySelector('.lead-form'));
      payload.delete('photos');
      payload.set('submissionId', submissionId);
      payload.set('uploadedPhotos', JSON.stringify([{ submissionId, pathname, originalName }]));
      const response = await fetch('/api/lead/', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
      return { status: response.status, body: await response.json() };
    }, { submissionId: oldSubmissionId, pathname: oldPhotoPath, originalName: firstImage.name });
    assert.equal(oldClientResponse.status, 409, 'old upload without a current reservation must be rejected, not silently dropped');
    assert.equal(oldClientResponse.body.retryPhotoPathname, oldPhotoPath);
    assert.match(oldClientResponse.body.message, /fotk.*nahráme ešte raz/i);
    assert.equal((await pglite.query('SELECT id FROM leads')).rowCount, 0, 'old upload conflict must not create a lead');
    const legacyDraft = await pglite.query('SELECT status, lead_id FROM lead_upload_drafts WHERE storage_key = $1', [oldPhotoPath]);
    assert.equal(legacyDraft.rowCount, 1, 'verified pre-reservation private upload must enter delayed retention');
    assert.equal(legacyDraft.rows[0].status, 'superseded');
    assert.equal(legacyDraft.rows[0].lead_id, null);
    assert.ok(fake.blobs.has(oldPhotoPath), 'legacy Blob must not be deleted from a client-supplied pathname during the request');
    await page.evaluate((id) => { document.querySelector('#submissionId').value = id; }, oldSubmissionId);
    await page.locator('#photos').setInputFiles([firstImage, secondImage]);
    try {
      await page.waitForFunction(() => document.querySelectorAll('.file-chip').length === 2 && !document.querySelector('#photos')?.disabled, null, { timeout: 20_000 });
    } catch (error) {
      console.error('Local form after file selection:', await page.evaluate(() => ({ chips: document.querySelectorAll('.file-chip').length, disabled: document.querySelector('#photos')?.disabled, status: document.querySelector('.form-status')?.textContent })));
      throw error;
    }
    await page.evaluate(() => { window.__astanaPreSubmit = new FormData(document.querySelector('.lead-form')); });
    await page.locator('.lead-form button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('.form-status')?.classList.contains('is-error'), null, { timeout: 90_000 });
    if (!historicalClient) {
      const leadResult = page.locator('.form-status');
      assert.equal(await leadResult.getAttribute('tabindex'), '-1', 'lead failure must remain programmatically focusable');
      assert.equal(await leadResult.evaluate((element) => document.activeElement === element), true,
        'lead failure must receive focus while the retryable form data stays intact');
    }
    const submissionId = await page.locator('#submissionId').inputValue();
    assert.match(submissionId, /^[0-9a-f-]{36}$/i, 'the browser must generate the ID on first submit');
    assert.equal(submissionId, oldSubmissionId, 'reupload retry must keep the old form identity');
    assert.equal(firstResponse?.status, 200, `first lead POST failed: ${JSON.stringify(firstResponse)}`);
    assert.equal(firstResponse.body?.ok, true);
    assert.equal(firstResponse.body?.emailSent, false);
    assert.equal(firstResponse.body?.metaLead, undefined,
      'an accepted lead without marketing consent must not expose an advertising conversion');
    assert.equal(await page.locator('#submissionId').inputValue(), submissionId, 'ambiguous response must retain submission ID');
    assert.equal(await page.locator('.file-chip').count(), 2, 'ambiguous response must retain photos');
    await page.locator('.lead-form button[type="submit"]').click();
    if (historicalClient) {
      await page.waitForFunction(() => document.querySelector('.lead-form')?.classList.contains('is-submitted'), null, { timeout: 90_000 });
      assert.equal(await page.locator('#submissionId').inputValue(), submissionId, 'old client retry must retain the accepted submission ID');
      assert.equal(await page.locator('.file-chip').count(), 0, 'accepted old-client retry may clear the form only after duplicate acceptance');
    } else {
      await page.waitForFunction(() => document.querySelector('.lead-form')?.classList.contains('is-submitted'), null, { timeout: 90_000 });
      const successText = await page.locator('.form-status').innerText();
      assert.match(successText, /Potvrdenie emailom ešte overujeme/, 'an omitted emailSent field must not claim customer mail was sent');
      assert.doesNotMatch(successText, /Potvrdenie sme poslali/, 'accepted lead does not prove that an email was sent');
      assert.equal(await page.locator('.form-status').evaluate((element) => document.activeElement === element), true,
        'lead success must receive focus after the retry is confirmed');
    }
    assert.equal(leadPostCount, 2, 'one browser submit and one retry expected');
    if (historicalClient) {
      assert.equal(retryResponse?.status, 200, 'old-client retry with the same photo bytes must be accepted as an idempotent duplicate');
      assert.equal(retryResponse.body?.ok, true);
      assert.equal(retryResponse.body?.metaLead, undefined, 'a retry without marketing consent must not expose a conversion');
    } else {
      assert.equal(retryResponse?.status, 200);
      assert.deepEqual(retryResponse.body?.metaLead, firstResponse.body?.metaLead,
        'idempotent retry must retain the accepted lead conversion identity');
    }

    if (!historicalClient) {
      const changedPhotoRetry = await page.evaluate(async ({ originalName, pathname, submissionId }) => {
        const payload = new FormData();
        for (const [key, value] of window.__astanaPreSubmit.entries()) payload.append(key, value);
        payload.delete('photos');
        payload.set('uploadedPhotos', JSON.stringify([{ submissionId, pathname, originalName }]));
        const response = await fetch('/api/lead/', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
        return { status: response.status, body: await response.json() };
      }, { originalName: firstImage.name, pathname: oldPhotoPath, submissionId });
      assert.equal(changedPhotoRetry.status, 409, 'a same-ID retry with changed photo paths must not overwrite the accepted lead');
      assert.equal(changedPhotoRetry.body.metaLead, undefined, 'a changed submission is not another conversion');
      assert.match(changedPhotoRetry.body.message, /bezpečnej rezervácie/i,
        'a client-supplied stale, superseded pathname must not enter the content-verified retry path');
      assert.doesNotMatch(changedPhotoRetry.body.message, /lead-drafts\//,
        'the stale-path response must not disclose private storage paths');
    }

    const leadRows = await pglite.query('SELECT id, submission_id FROM leads');
    assert.equal(leadRows.rowCount, 1, 'exactly one lead');
    assert.equal(leadRows.rows[0].submission_id, submissionId);
    const leadId = leadRows.rows[0].id;
    const files = await pglite.query('SELECT id, original_name, storage_driver, storage_key, mime_type, size_bytes FROM lead_files WHERE lead_id = $1 ORDER BY original_name', [leadId]);
    assert.equal(files.rowCount, 2, 'exactly two attached photos');
    assert.deepEqual(files.rows.map((row) => row.original_name), [firstImage.name, secondImage.name]);
    const htmlRetryFields = await page.evaluate(() => [...window.__astanaPreSubmit.entries()]
      .filter(([, value]) => typeof value === 'string'));
    const htmlRetry = new FormData();
    for (const [key, value] of htmlRetryFields) htmlRetry.append(key, value);
    htmlRetry.set('submissionId', submissionId);
    htmlRetry.set('uploadedPhotos', JSON.stringify(files.rows.map((row) => ({
      submissionId, pathname: row.storage_key, originalName: row.original_name,
    }))));
    const htmlResponse = await fetch(`${appOrigin}/api/lead/`, {
      method: 'POST', headers: { Accept: 'text/html' }, body: htmlRetry, redirect: 'manual',
    });
    assert.equal(htmlResponse.status, 303, 'a native HTML retry uses the signed confirmation redirect');
    assert.match(htmlResponse.headers.get('location') || '', /\/dopyt-prijaty\/\?dopyt_receipt=/);
    assert.doesNotMatch(htmlResponse.headers.get('location') || '', /metaLead|meta_lead|lead%3A/i,
      'HTML redirect must not leak conversion identity in its URL');
    const invalidHtmlResponse = await fetch(`${appOrigin}/api/lead/`, {
      method: 'POST', headers: { Accept: 'text/html' }, body: new FormData(), redirect: 'manual',
    });
    assert.equal(invalidHtmlResponse.status, 400, 'invalid native HTML submission is not a conversion');
    assert.doesNotMatch(await invalidHtmlResponse.text(), /metaLead|meta_lead/);
    assert.ok(files.rows.every((row) => row.storage_driver === 'vercel_blob' && row.mime_type === 'image/png' && row.size_bytes > 6 * 1024 * 1024));
    const expectedBytes = new Map([[firstImage.name, firstImage.buffer], [secondImage.name, secondImage.buffer]]);
    for (const row of files.rows) {
      const stored = fake.blobs.get(row.storage_key);
      assert.ok(stored, 'private Blob bytes must exist');
      assert.ok(stored.bytes.equals(expectedBytes.get(row.original_name)), 'private Blob bytes must match browser file');
      const unauthenticated = await fetch(`${blobOrigin}/${row.storage_key}`);
      assert.equal(unauthenticated.status, 401, 'private Blob must reject anonymous read');
    }
    const sessionPayload = Buffer.from(JSON.stringify({ kind: 'admin-session', email: 'admin@local.test', iat: Date.now(), epoch: 0 })).toString('base64url');
    const sessionSignature = createHmac('sha256', authSecret).update(sessionPayload).digest('base64url');
    const adminCookie = `astana_admin_session=${sessionPayload}.${sessionSignature}`;
    const tamperedCookie = `${adminCookie.slice(0, -1)}${adminCookie.endsWith('a') ? 'b' : 'a'}`;
    for (const row of files.rows) {
      const adminFileUrl = `${appOrigin}/admin/files/${row.id}/`;
      const privateReadsBefore = fake.counts.privateGet;
      const denied = await fetch(adminFileUrl, { redirect: 'manual' });
      assert.ok([302, 303, 307, 308].includes(denied.status), 'anonymous admin file request must redirect to login');
      assert.match(new URL(denied.headers.get('location'), appOrigin).pathname, /^\/admin\/login\/?$/);
      const invalidSession = await fetch(adminFileUrl, { headers: { Cookie: tamperedCookie }, redirect: 'manual' });
      assert.ok([302, 303, 307, 308].includes(invalidSession.status), 'tampered admin cookie must not open the file');
      assert.equal(fake.counts.privateGet, privateReadsBefore, 'denied admin requests must not read private photo bytes');
      const allowed = await fetch(adminFileUrl, { headers: { Cookie: adminCookie }, redirect: 'manual' });
      assert.equal(allowed.status, 200, 'test admin must be able to open the attached photo');
      assert.equal(allowed.headers.get('content-type'), 'image/png');
      assert.equal(allowed.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(allowed.headers.get('cache-control'), 'private, no-store');
      const openedBytes = Buffer.from(await allowed.arrayBuffer());
      assert.ok(openedBytes.equals(expectedBytes.get(row.original_name)), 'authorized admin download must match the browser photo bytes');
    }
    const dashboard = await fetch(`${appOrigin}/admin/dashboard/`, { headers: { Cookie: adminCookie }, redirect: 'manual' });
    assert.equal(dashboard.status, 200, 'test admin dashboard must render');
    const dashboardHtml = await dashboard.text();
    assert.ok(dashboardHtml.includes('Stav emailov'), 'admin dashboard must show mail queue status');
    assert.ok(/Čaká:(?:\s|<!-- -->)*2/.test(dashboardHtml), 'admin dashboard must show both pending recipients');
    const drafts = await pglite.query('SELECT storage_key, status, lead_id FROM lead_upload_drafts WHERE submission_id = $1', [submissionId]);
    assert.equal(drafts.rowCount, historicalClient ? 5 : 3);
    assert.equal(drafts.rows.filter((row) => row.status === 'attached' && row.lead_id === leadId).length, 2);
    const historicalRetryPaths = drafts.rows.filter((row) => row.status === 'uploaded' && row.lead_id === null).map((row) => row.storage_key);
    if (historicalClient) {
      const historicalRetriedPaths = drafts.rows.filter((row) => row.status === 'superseded' && row.lead_id === null
        && row.storage_key !== oldPhotoPath).map((row) => row.storage_key);
      assert.equal(historicalRetryPaths.length, 0, 'accepted old-client retries must retire their redundant uploads');
      assert.equal(historicalRetriedPaths.length, 2, 'old-client retry uploads are safely queued for timed cleanup');
      assert.ok(historicalRetriedPaths.every((pathname) => fake.blobs.has(pathname)), 'redundant private retry uploads remain until retention safely deletes them');
    }
    assert.deepEqual(drafts.rows.filter((row) => row.storage_key === oldPhotoPath).map((row) => ({ status: row.status, leadId: row.lead_id })), [{ status: 'superseded', leadId: null }]);
    const jobs = await pglite.query('SELECT id FROM business_jobs WHERE lead_id = $1', [leadId]);
    assert.equal(jobs.rowCount, 1, 'exactly one business job');
    const outbox = await pglite.query('SELECT recipient_role, status, attempts FROM lead_email_outbox WHERE lead_id = $1 ORDER BY recipient_role', [leadId]);
    assert.deepEqual(outbox.rows.map((row) => row.recipient_role), ['customer', 'internal']);
    assert.ok(outbox.rows.every((row) => row.status === 'pending' && row.attempts === 0), 'both outbox notices must remain pending without email delivery');
    const retentionUrl = `${appOrigin}/api/cron/lead-upload-retention/`;
    const unauthenticatedRetention = await fetch(retentionUrl);
    assert.equal(unauthenticatedRetention.status, 401, 'private inventory must require cron authorization');
    const firstRetention = await fetch(retentionUrl, { headers: { Authorization: `Bearer ${cronSecret}` } });
    assert.equal(firstRetention.status, 200, `local inventory failed: ${(await firstRetention.clone().text()).slice(0, 300)}`);
    const firstRetentionBody = await firstRetention.json();
    assert.equal(firstRetentionBody.deleted, 0, 'inventory must not delete newly discovered objects');
    assert.equal(firstRetentionBody.mode, inventoryOnly ? 'inventory_only' : 'retention');
    assert.equal(firstRetentionBody.inventory.staged, 2, 'both abandoned pre-reservation photos must enter delayed retention');
    const stagedOrphans = await pglite.query('SELECT storage_key, status, blob_etag FROM lead_upload_drafts WHERE storage_key = ANY($1::text[])', [abandonedPaths]);
    assert.equal(stagedOrphans.rowCount, 2);
    assert.ok(stagedOrphans.rows.every((row) => row.status === 'superseded' && row.blob_etag === fake.blobs.get(row.storage_key)?.blob.etag));
    assert.ok(abandonedPaths.every((pathname) => fake.blobs.has(pathname)), 'inventory is not a delete operation');
    await pglite.query("UPDATE lead_upload_drafts SET updated_at = now() - interval '25 hours' WHERE storage_key = ANY($1::text[])", [[...abandonedPaths, ...historicalRetryPaths]]);
    if (inventoryOnly) {
      const scanOnlyRetention = await fetch(retentionUrl, { headers: { Authorization: `Bearer ${cronSecret}` } });
      assert.equal(scanOnlyRetention.status, 200, 'inventory-only mode must remain healthy after candidates age');
      const scanOnlyBody = await scanOnlyRetention.json();
      assert.equal(scanOnlyBody.mode, 'inventory_only');
      assert.equal(scanOnlyBody.checked, 0);
      assert.equal(scanOnlyBody.deleted, 0);
      assert.equal(fake.counts.delete, 0);
      assert.ok(abandonedPaths.every((pathname) => fake.blobs.has(pathname)), 'inventory-only mode never deletes aged private objects');
      assert.ok(historicalRetryPaths.every((pathname) => fake.blobs.has(pathname)), 'inventory-only mode must also preserve old-client retry objects');
      assert.ok(files.rows.every((row) => fake.blobs.has(row.storage_key)));
    } else {
    fake.blobs.get(abandonedPaths[1]).blob.etag = 'replacement-content-etag';
    const secondRetention = await fetch(retentionUrl, { headers: { Authorization: `Bearer ${cronSecret}` } });
    assert.equal(secondRetention.status, 503, 'changed Blob identity must be reported for manual recovery');
    const secondRetentionBody = await secondRetention.json();
    assert.equal(secondRetentionBody.deleted, 1 + historicalRetryPaths.length, 'unchanged orphan and old-client retry objects are deleted after grace period');
    assert.equal(secondRetentionBody.failed, 1, 'changed orphan is kept when ETag no longer matches');
    assert.equal(fake.blobs.has(abandonedPaths[0]), false);
    assert.equal(fake.blobs.has(abandonedPaths[1]), true);
    assert.ok(historicalRetryPaths.every((pathname) => !fake.blobs.has(pathname)), 'the actual old-client retry objects are deleted');
    assert.ok(files.rows.every((row) => fake.blobs.has(row.storage_key)), 'accepted lead photos survive orphan cleanup');

    const interruptedPath = `lead-drafts/${randomUUID()}/${randomUUID()}.png`;
    const interruptedEtag = createHash('sha256').update('interrupted-private-photo').digest('hex');
    fake.blobs.set(interruptedPath, { blob: {
      ...oldBlob, pathname: interruptedPath,
      url: `https://${privateBlobHost}/${interruptedPath}`,
      downloadUrl: `https://${privateBlobHost}/${interruptedPath}?download=1`,
      uploadedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      etag: interruptedEtag,
    }, bytes: firstImage.buffer });
    await pglite.query(
      `INSERT INTO lead_upload_drafts (storage_key, submission_id, storage_driver, blob_etag, status, updated_at)
       VALUES ($1,$2,'vercel_blob',$3,'superseded',now() - interval '25 hours')`,
      [interruptedPath, interruptedPath.split('/')[1], interruptedEtag],
    );
    await pglite.exec(`
      CREATE FUNCTION fail_retention_audit_once() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.action = 'lead_upload_retention_deleted' THEN RAISE EXCEPTION 'simulated audit failure'; END IF;
        RETURN NEW;
      END; $$;
      CREATE TRIGGER fail_retention_audit_once BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION fail_retention_audit_once();
    `);
    const interruptedRetention = await fetch(retentionUrl, { headers: { Authorization: `Bearer ${cronSecret}` } });
    assert.equal(interruptedRetention.status, 503, 'an audit fault after Blob deletion must remain visible');
    assert.equal(fake.blobs.has(interruptedPath), false, 'the provider deletion completed before the injected audit fault');
    assert.equal((await pglite.query('SELECT status FROM lead_upload_drafts WHERE storage_key = $1', [interruptedPath])).rows[0].status, 'deleting',
      'a failed audit must roll back the tombstone');
    await pglite.exec('DROP TRIGGER fail_retention_audit_once ON audit_logs; DROP FUNCTION fail_retention_audit_once();');
    await pglite.query("UPDATE lead_upload_drafts SET deletion_claimed_until = now() - interval '1 second' WHERE storage_key = $1", [interruptedPath]);
    const resumedRetention = await fetch(retentionUrl, { headers: { Authorization: `Bearer ${cronSecret}` } });
    assert.equal(resumedRetention.status, 200, `provider-confirmed missing Blob could not close audit retry: ${(await resumedRetention.clone().text()).slice(0, 300)}`);
    assert.equal((await resumedRetention.json()).deleted, 1);
    assert.equal((await pglite.query('SELECT status FROM lead_upload_drafts WHERE storage_key = $1', [interruptedPath])).rows[0].status, 'deleted');
    const interruptedAudit = await pglite.query("SELECT changes FROM audit_logs WHERE action = 'lead_upload_retention_deleted' AND changes->>'storageKeyHash' = $1", [createHash('sha256').update(interruptedPath).digest('hex')]);
    assert.equal(interruptedAudit.rowCount, 1, 'retry completes with exactly one audit event');
    assert.ok(!JSON.stringify(interruptedAudit.rows[0].changes).includes(interruptedPath));
    }
    const expectedUploads = historicalClient ? 5 : 2;
    assert.deepEqual({ create: fake.counts.create, part: fake.counts.part, complete: fake.counts.complete, callback: fake.counts.callback }, { create: expectedUploads, part: expectedUploads, complete: expectedUploads, callback: expectedUploads });
    assert.ok(fake.counts.head >= 2 && fake.counts.privateGet >= 2);
    assert.equal(browserDenied.length, 0, `browser tried an external origin: ${browserDenied.join(', ')}`);
    resultSummary = { result: 'PASS', historicalClient, historicalFirstConflict, inventoryOnly, lead: leadRows.rowCount, privateAttachments: files.rowCount, authorizedAdminDownloads: files.rowCount, anonymousAdminDownloads: 0, job: jobs.rowCount, pendingOutbox: outbox.rowCount, emailsSent: outbox.rows.filter((row) => row.status === 'sent').length, browserPosts: leadPostCount, multipart: fake.counts, blockedBrowserOrigins: browserDenied.length };
    passed = true;
    }
  } catch (error) {
    console.error('ASTANA E1 F04 test failure:', error);
    console.error('Local Next output:', childLog.join('').slice(-5000));
    throw error;
  } finally {
    console.error('ASTANA E1 F04 cleanup: browser');
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    console.error('ASTANA E1 F04 cleanup: Next child');
    await stopChild(nextChild);
    console.error('ASTANA E1 F04 cleanup: local Blob server');
    if (blobServer) {
      blobServer.closeAllConnections();
      await new Promise((resolve) => blobServer.close(resolve));
    }
    console.error('ASTANA E1 F04 cleanup: local SQL socket');
    await socket?.stop().catch(() => undefined);
    await pglite?.close().catch(() => undefined);
    console.error('ASTANA E1 F04 cleanup: owned temp');
    const ownedRoot = assertOwnedTempRoot(tempRoot);
    const moduleLink = path.join(ownedRoot, 'node_modules');
    const linkStat = await lstat(moduleLink).catch(() => null);
    if (linkStat?.isSymbolicLink()) await unlink(moduleLink);
    await rm(ownedRoot, { recursive: true, force: true, maxRetries: 12, retryDelay: 500 });
    assert.equal(existsSync(ownedRoot), false, 'owned temporary project must be removed');
    if (!passed) console.error(`ASTANA E1 F04 harness failed; only owned temp was removed: ${tempRoot}`);
  }
  console.log(JSON.stringify({ ...resultSummary, tempRootRemovedOnExit: true }));
}
