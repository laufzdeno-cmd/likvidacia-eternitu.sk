/**
 * Isolated local E2E browser test for existing private crew photo intake.
 * Run: node scripts/photo-intake-browser.integration.mjs
 * Requires installed project dependencies and local Edge. Optional:
 * ASTANA_HARNESS_BROWSER points to an installed Chromium/Edge executable.
 *
 * Covers invitation login, scoped history, private media reads, forged and
 * revoked sessions, cross-invite denial, and one actual browser multipart
 * upload through signed callback/confirm with SQL locality/category checks.
 * Uses a temporary source-only Next project, in-memory PGlite or an explicitly
 * managed loopback PostgreSQL for full-build mode,
 * a loopback Blob emulator, fresh explicit child env, and network guards.
 * Never reads env files or uses production data/accounts/mail. Removes only
 * its verified owned temp tree, after unlinking the dependency junction.
 *
 * Limitations: local dev HTTP and a simulated installed Blob SDK contract;
 * not real Vercel/private-store availability, production TLS/CSP/Secure
 * cookies, deletion/retention or every image format.
 */
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { extractStylesheetHrefs } from './built-route-assets.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const privateBlobHost = 'harness.private.blob.vercel-storage.com';

async function collectMobileCssCoverage(context, appOrigin, pagePath) {
  const page = await context.newPage();
  const viewports = [
    { width: 320, height: 720 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ];
  await page.setViewportSize(viewports[0]);
  const session = await context.newCDPSession(page);
  const stylesheets = new Map();
  session.on('CSS.styleSheetAdded', ({ header }) => stylesheets.set(header.styleSheetId, header));
  await session.send('DOM.enable');
  await session.send('CSS.enable');
  await session.send('CSS.startRuleUsageTracking');
  try {
    const response = await page.goto(appOrigin + pagePath, { waitUntil: 'networkidle', timeout: 60_000 });
    assert.equal(response?.status(), 200, `CSS coverage page must render locally: ${pagePath}`);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(async () => {
        const step = Math.max(320, Math.floor(window.innerHeight * 0.8));
        for (let top = 0; top < document.documentElement.scrollHeight; top += step) {
          window.scrollTo(0, top);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        window.scrollTo(0, 0);
        await new Promise((resolve) => setTimeout(resolve, 60));
      });
      if (viewport.width === 320) {
        const menu = page.locator('.site-header .menu-toggle:visible').first();
        if (await menu.count()) {
          await menu.click();
          await page.waitForTimeout(60);
          await menu.click();
        }
      }
      await page.keyboard.press('Tab');
    }
    const { ruleUsage } = await session.send('CSS.stopRuleUsageTracking');
    const usedRanges = new Map();
    for (const rule of ruleUsage) {
      if (!rule.used) continue;
      const ranges = usedRanges.get(rule.styleSheetId) || [];
      ranges.push([rule.startOffset, rule.endOffset]);
      usedRanges.set(rule.styleSheetId, ranges);
    }
    const reports = [];
    for (const [styleSheetId, header] of stylesheets) {
      let url;
      try { url = new URL(header.sourceURL); } catch { continue; }
      if (url.origin !== appOrigin || !url.pathname.endsWith('.css')) continue;
      const { text: cssText } = await session.send('CSS.getStyleSheetText', { styleSheetId });
      const ranges = (usedRanges.get(styleSheetId) || []).sort((left, right) => left[0] - right[0]);
      let usedChars = 0;
      let rangeEnd = -1;
      for (const [start, end] of ranges) {
        const boundedStart = Math.max(0, Math.min(cssText.length, start));
        const boundedEnd = Math.max(boundedStart, Math.min(cssText.length, end));
        if (boundedEnd <= rangeEnd) continue;
        usedChars += boundedEnd - Math.max(boundedStart, rangeEnd);
        rangeEnd = boundedEnd;
      }
      reports.push({
        path: url.pathname,
        stylesheetChars: cssText.length,
        usedChars,
        unusedChars: cssText.length - usedChars,
        coveragePercent: cssText.length ? Number((100 * usedChars / cssText.length).toFixed(1)) : 0,
      });
    }
    assert.ok(reports.length > 0, `CDP returned no same-origin CSS resources for ${pagePath}`);
    return { pagePath, viewports: viewports.map(({ width, height }) => `${width}x${height}`), scrolled: true, menuAndFocusSampled: true, stylesheets: reports };
  } finally {
    await session.detach().catch(() => {});
    await page.close();
  }
}

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
    if (Array.isArray(target)) {
      if (typeof target[0] === 'number') {
        assertLoopback(typeof target[1] === 'string' ? target[1] : 'localhost');
        if (!target.slice(2).every((value) => value == null || typeof value === 'function')) throw new Error('ASTANA harness denied unknown normalized native socket target');
      } else if (typeof target[0] === 'string' && typeof target[1] === 'number') {
        assertLoopback(target[0]);
        if (!target.slice(2).every((value) => value == null || typeof value === 'function')) throw new Error('ASTANA harness denied unknown normalized native socket target');
      } else if (target[0] && typeof target[0] === 'object' && !target[0].path) {
        assertLoopback(target[0].host || target[0].hostname || 'localhost');
        if (!target.slice(1).every((value) => value == null || typeof value === 'function')) throw new Error('ASTANA harness denied unknown normalized native socket target');
      } else throw new Error('ASTANA harness denied unknown normalized native socket target');
      return;
    }
    if (typeof target === 'number') assertLoopback(typeof args[1] === 'string' ? args[1] : 'localhost');
    else if (target && typeof target === 'object' && !target.path) assertLoopback(target.host || target.hostname);
    else throw new Error('ASTANA harness denied unknown native socket target');
  };
  const socketConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    assertSocketTarget(args);
    return socketConnect.apply(this, args);
  };
  // Node 25's net.connect can bypass a replaced Socket.prototype.connect in
  // its early argument-validation path. Guard the exported entry points too,
  // so the isolation check proves the boundary on the runtime actually used.
  const guardedSocketFactory = function (...args) {
    assertSocketTarget(args);
    return originalSocketFactory.apply(this, args);
  };
  const originalSocketFactory = net.connect;
  net.connect = guardedSocketFactory;
  net.createConnection = guardedSocketFactory;
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
  assert.ok(appOrigin && /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(appOrigin));
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
  assert.throws(() => net.connect([443, 'example.invalid']), /denied external native network host/);
  assert.throws(() => net.connect(['example.invalid', 443]), /denied external native network host/);
  assert.doesNotThrow(() => assertSocketTarget([[443, '127.0.0.1']]));
  assert.throws(() => http.request('http://example.invalid/'), /denied external native network host/);
  await assert.rejects(fetch('https://example.invalid/'), (error) =>
    error?.cause?.message?.includes('ASTANA harness denied external HTTP origin: https://example.invalid') === true);
  const { default: next } = await import('next');
  const productionHarness = process.env.ASTANA_HARNESS_PRODUCTION === '1';
  const app = next({ dev: !productionHarness, dir: process.cwd(), hostname: '127.0.0.1', port: Number(process.env.ASTANA_HARNESS_APP_PORT), ...(productionHarness ? {} : { webpack: true }) });
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
  assert.ok(payload.maximumSizeInBytes <= 20 * 1024 * 1024);
  return payload;
}

function createBlobEmulator({ appOrigin, blobOrigin, readWriteToken, localFetch }) {
  const uploads = new Map();
  const blobs = new Map();
  const privateGetByPath = new Map();
  const counts = { token: 0, create: 0, part: 0, complete: 0, serverPut: 0, head: 0, privateGet: 0, callback: 0, denied: 0, redirectProbe: 0 };
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
      if (request.method === 'GET' && url.pathname === '/redirect-probe') {
        counts.redirectProbe++;
        response.writeHead(302, { location: 'https://example.invalid/' }); response.end(); return;
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
      if (request.method === 'POST' && url.pathname === '/mpu') {
        assert.ok(isClient, 'multipart uploads require client token');
        assert.equal(pathname, tokenPayload.pathname);
        assert.match(pathname, /^crew-intake\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/);
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
          assert.ok(callback, 'signed callback missing');
          assert.equal(new URL(callback.callbackUrl).origin, appOrigin);
          assert.equal(new URL(callback.callbackUrl).pathname.replace(/\/$/, ''), '/api/photo-intake/upload');
          const callbackBody = JSON.stringify({ type: 'blob.upload-completed', payload: { blob, tokenPayload: callback.tokenPayload } });
          const signature = createHmac('sha256', readWriteToken).update(callbackBody).digest('hex');
          const result = await localFetch(callback.callbackUrl, {
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
      if (request.method === 'PUT' && url.pathname === '/') {
        assert.ok(isReadWrite, 'sanitized server-side uploads require the dedicated read-write token');
        const serverPath = url.searchParams.get('pathname') || '';
        assert.match(serverPath, /^photo-intake\/sanitized\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i);
        assert.equal(request.headers['x-vercel-blob-access'], 'private');
        assert.equal(request.headers['x-allow-overwrite'], '0');
        const bytes = await readBody(request);
        assert.ok(bytes.length > 0 && bytes.length <= 20 * 1024 * 1024);
        const blob = {
          pathname: serverPath,
          url: `https://${privateBlobHost}/${serverPath}`,
          downloadUrl: `https://${privateBlobHost}/${serverPath}?download=1`,
          size: bytes.length,
          contentType: request.headers['x-content-type'] || 'image/jpeg',
          contentDisposition: 'inline',
          cacheControl: 'private, no-store',
          uploadedAt: new Date().toISOString(),
          etag: createHash('sha256').update(bytes).digest('hex'),
        };
        blobs.set(serverPath, { blob, bytes });
        counts.serverPut++;
        json(response, 200, blob, cors); return;
      }
      if (request.method === 'GET' && url.pathname === '/' && url.searchParams.has('url')) {
        assert.ok(isReadWrite, 'head requires server token');
        const entry = blobs.get(url.searchParams.get('url'));
        if (!entry) { json(response, 404, { error: { code: 'not_found' } }, cors); return; }
        counts.head++;
        json(response, 200, entry.blob, cors); return;
      }
      if (request.method === 'GET' && (url.pathname.startsWith('/crew-intake/') || url.pathname.startsWith('/photo-intake/sanitized/'))) {
        assert.ok(isReadWrite, 'private get requires server token');
        const entry = blobs.get(url.pathname.slice(1));
        if (!entry) { json(response, 404, { error: { code: 'not_found' } }, cors); return; }
        counts.privateGet++;
        privateGetByPath.set(url.pathname.slice(1), (privateGetByPath.get(url.pathname.slice(1)) || 0) + 1);
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
  return { server, blobs, counts, privateGetByPath };
}

async function createTempProject(tempRoot, headersOnly = false, includeSeoAudit = false) {
  if (headersOnly) {
    for (const name of ['src', 'public']) {
      await cp(path.join(projectRoot, name), path.join(tempRoot, name), { recursive: true, filter: (entry) => !/^\.env(?:\.|$)/.test(path.basename(entry)) });
    }
    for (const file of ['layout.tsx', 'seo-json-ld.tsx']) {
      await cp(path.join(projectRoot, 'app', file), path.join(tempRoot, 'app', file));
    }
    for (const relative of ['spolupraca/fotky', 'api/photo-intake']) {
      await cp(path.join(projectRoot, 'app', relative), path.join(tempRoot, 'app', relative), { recursive: true });
    }
  } else for (const name of ['app', 'src', 'public']) {
    await cp(path.join(projectRoot, name), path.join(tempRoot, name), { recursive: true, filter: (entry) => !/^\.env(?:\.|$)/.test(path.basename(entry)) });
  }
  for (const name of ['package.json', 'next.config.mjs', 'tsconfig.json', 'proxy.ts']) {
    await cp(path.join(projectRoot, name), path.join(tempRoot, name));
  }
  if (includeSeoAudit) {
    await mkdir(path.join(tempRoot, 'scripts'), { recursive: true });
    for (const name of ['seo-rendered-metadata-check.mjs', 'seo-rendered-content-check.mjs', 'lighthouse-s08.mjs', 'lighthouse-network-proxy.mjs', 'lighthouse-report-summary.mjs', 'bounded-text-capture.mjs', 'bounded-child-output.mjs']) {
      await cp(path.join(projectRoot, 'scripts', name), path.join(tempRoot, 'scripts', name));
    }
  }
  const mediaRoutePath = path.join(tempRoot, 'app', 'api', 'photo-intake', 'media', '[id]', 'route.ts');
  const mediaRoute = await readFile(mediaRoutePath, 'utf8');
  assert.ok(mediaRoute.includes("} catch {\n    return new NextResponse('Súkromnú fotografiu sa nepodarilo načítať', { status: 503 });"));
  await writeFile(mediaRoutePath, mediaRoute.replace(
    "} catch {\n    return new NextResponse('Súkromnú fotografiu sa nepodarilo načítať', { status: 503 });",
    "} catch (error) {\n    console.error('ISOLATED PHOTO MEDIA READ FAILED', JSON.stringify({ message: error instanceof Error ? error.message : String(error), cause: error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined }));\n    return new NextResponse('Súkromnú fotografiu sa nepodarilo načítať', { status: 503 });",
  ), 'utf8');
  await symlink(path.join(projectRoot, 'node_modules'), path.join(tempRoot, 'node_modules'), 'junction');
  // Next's client upload is intentionally pointed at a loopback HTTP emulator.
  // This temporary-only config adds a loopback CSP exception for the test
  // document; source config in the repository remains byte-for-byte untouched.
  const configPath = path.join(tempRoot, 'next.config.mjs');
  let config = await readFile(configPath, 'utf8');
  assert.ok(config.includes("connect-src 'self'"));
  assert.ok(config.includes("'upgrade-insecure-requests'"));
  config = config.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:* http://localhost:*");
  config = config.replace(/^\s*'upgrade-insecure-requests',\r?\n/m, '');
  assert.ok(!config.includes("'upgrade-insecure-requests'"), 'local HTTP harness must not auto-upgrade to HTTPS');
  await writeFile(configPath, config, 'utf8');
}

async function readBuiltRouteClientSource(tempRoot, routeHtmlPath) {
  const html = await readFile(path.join(tempRoot, '.next', 'server', 'app', routeHtmlPath), 'utf8');
  const scriptPaths = [...html.matchAll(/<script[^>]+src="([^"?]+\.js)(?:\?[^"]*)?"/g)]
    .map((match) => decodeURIComponent(new URL(match[1], 'http://localhost').pathname))
    .filter((scriptPath, index, paths) => scriptPath.startsWith('/_next/static/chunks/') && paths.indexOf(scriptPath) === index);
  assert.ok(scriptPaths.length > 0, `${routeHtmlPath} must reference client chunks`);
  const sources = await Promise.all(scriptPaths.map((scriptPath) =>
    readFile(path.join(tempRoot, '.next', scriptPath.replace(/^\/_next\//, '')), 'utf8')));
  return { scriptCount: scriptPaths.length, source: sources.join('\n') };
}

async function readBuiltRouteCssSource(tempRoot, routeHtmlPath) {
  const html = await readFile(path.join(tempRoot, '.next', 'server', 'app', routeHtmlPath), 'utf8');
  const stylePaths = extractStylesheetHrefs(html)
    .map((href) => decodeURIComponent(new URL(href, 'http://localhost').pathname))
    .filter((stylePath, index, paths) => stylePath.startsWith('/_next/static/') && paths.indexOf(stylePath) === index);
  assert.ok(stylePaths.length > 0, `${routeHtmlPath} must reference CSS chunks`);
  const sources = await Promise.all(stylePaths.map((stylePath) =>
    readFile(path.join(tempRoot, '.next', stylePath.replace(/^\/_next\//, '')), 'utf8')));
  return { styleCount: stylePaths.length, source: sources.join('\n') };
}

async function readBuiltDynamicRouteCssSource(tempRoot, routeManifestPath) {
  const manifest = await readFile(path.join(tempRoot, '.next', 'server', 'app', routeManifestPath), 'utf8');
  const stylePaths = [...manifest.matchAll(/static\/css\/[^"']+\.css/g)]
    .map((match) => match[0])
    .filter((stylePath, index, paths) => paths.indexOf(stylePath) === index);
  assert.ok(stylePaths.length > 0, `${routeManifestPath} must reference CSS chunks`);
  const sources = await Promise.all(stylePaths.map((stylePath) =>
    readFile(path.join(tempRoot, '.next', stylePath), 'utf8')));
  return { styleCount: stylePaths.length, source: sources.join('\n') };
}

function createLocalFetch(allowedOrigins) {
  return async function localFetch(input, init = {}) {
    const requestUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(requestUrl);
    assert.ok(allowedOrigins.has(url.origin), `ASTANA harness denied parent HTTP origin: ${url.origin}`);
    const { expectedRedirectPath, ...requestInit } = init;
    const response = await fetch(url, { ...requestInit, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const target = new URL(response.headers.get('location') || '', url);
      if (expectedRedirectPath && target.origin === url.origin && target.pathname === expectedRedirectPath) return response;
      await response.body?.cancel();
      throw new Error(`ASTANA harness denied HTTP redirect to ${response.headers.get('location') || '(missing location)'}`);
    }
    return response;
  };
}

async function waitForApp(origin, child, localFetch, logs) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next exited early (${child.exitCode}): ${logs().slice(-3500)}`);
    try {
      const response = await localFetch(origin + '/spolupraca/fotky/', { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Next did not start within 90s: ${logs().slice(-3500)}`);
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
  assert.match(path.basename(resolved), /^astana-photo-intake-[A-Za-z0-9]+$/, 'teardown target must be this harness temp');
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

async function runHarness() {
  const productionHeadersOnly = process.env.ASTANA_HARNESS_PRODUCTION === '1';
  const productionFullBuildOnly = process.env.ASTANA_HARNESS_FULL_BUILD === '1';
  const productionCronOnly = process.env.ASTANA_HARNESS_CRON_ONLY === '1';
  const lighthouseS08 = process.env.ASTANA_HARNESS_LIGHTHOUSE === '1';
  assert.ok(!lighthouseS08 || productionFullBuildOnly, 'S08 may only run inside the isolated full production-build harness');
  assert.ok(Number(productionHeadersOnly) + Number(productionFullBuildOnly) + Number(productionCronOnly) <= 1,
    'production harness modes are mutually exclusive');
  let managedTestDatabaseUrl;
  if (productionFullBuildOnly || productionCronOnly) {
    const runToken = process.env.ASTANA_ISOLATED_PG_RUN_TOKEN || '';
    const rawDatabaseUrl = process.env.ASTANA_ISOLATED_PG_URL || '';
    assert.match(runToken, /^[a-f0-9]{32}$/, 'managed PostgreSQL requires a 32-character runner token');
    let parsed;
    try { parsed = new URL(rawDatabaseUrl); } catch { assert.fail('managed PostgreSQL requires the guarded one-time PostgreSQL runner'); }
    assert.ok(['postgres:', 'postgresql:'].includes(parsed.protocol), 'managed PostgreSQL requires the guarded one-time PostgreSQL runner');
    assert.equal(parsed.hostname, '127.0.0.1', 'managed PostgreSQL must be loopback-only');
    assert.ok(parsed.pathname === `/astana_isolated_${runToken}`, 'managed PostgreSQL requires the guarded one-time PostgreSQL runner');
    assert.ok(parsed.username === 'astana_test', 'managed PostgreSQL requires the guarded one-time PostgreSQL runner');
    assert.ok(parsed.password === '', 'managed PostgreSQL requires the guarded one-time PostgreSQL runner');
    assert.ok(parsed.search === '', 'managed PostgreSQL requires the guarded one-time PostgreSQL runner');
    assert.ok(parsed.hash === '', 'managed PostgreSQL requires the guarded one-time PostgreSQL runner');
    assert.ok(Number.isInteger(Number(parsed.port)) && Number(parsed.port) > 0 && Number(parsed.port) <= 65535,
      'managed PostgreSQL must use an explicit loopback port');
    managedTestDatabaseUrl = `postgres://astana_test@127.0.0.1:${Number(parsed.port)}${parsed.pathname}`;
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: managedTestDatabaseUrl, connectionTimeoutMillis: 2000, max: 1 });
    try {
      const result = await pool.query('SELECT run_token FROM astana_isolated_runner_guard');
      assert.deepEqual(result.rows, [{ run_token: runToken }], 'PostgreSQL must contain the matching one-time runner marker');
    } catch {
      assert.fail('managed PostgreSQL requires the guarded one-time PostgreSQL runner');
    } finally {
      await pool.end();
    }
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const { chromium } = await import('@playwright/test');
  const { default: sharp } = await import('sharp');
  const edge = process.env.ASTANA_HARNESS_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.ok(existsSync(edge), 'Edge missing; set ASTANA_HARNESS_BROWSER to an installed executable.');
  const lighthouseBrowser = process.env.ASTANA_HARNESS_LIGHTHOUSE_BROWSER || edge;
  if (process.env.ASTANA_HARNESS_LIGHTHOUSE === '1') {
    assert.ok(existsSync(lighthouseBrowser), 'Lighthouse Chromium missing; set ASTANA_HARNESS_LIGHTHOUSE_BROWSER to an installed Chromium executable.');
  }
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'astana-photo-intake-'));
  const owner = randomUUID();
  let pglite, socket, blobServer, child, browser;
  const contexts = [], logs = [], deniedOrigins = [];
  let summary;
  const cookieName = 'astana_photo_intake_session';
  const productionMode = productionHeadersOnly || productionFullBuildOnly || productionCronOnly;
  try {
    await writeFile(path.join(tempRoot, '.harness-owner'), owner, { flag: 'wx' });
    const [dbPort, blobPort, appPort] = await Promise.all([availablePort(), availablePort(), availablePort()]);
    assert.equal(new Set([dbPort, blobPort, appPort]).size, 3);
    // Next's dev server canonicalizes request.nextUrl.origin to localhost even
    // when its listener is bound to 127.0.0.1, so browser and API use localhost.
    const appOrigin = 'http://localhost:' + appPort;
    const blobOrigin = 'http://127.0.0.1:' + blobPort;
    const localFetch = createLocalFetch(new Set([appOrigin, blobOrigin]));
    const databaseUrl = managedTestDatabaseUrl || ('postgres://astana_test:astana_test@127.0.0.1:' + dbPort + '/astana_test');
    const token = 'vercel_blob_rw_harness_' + randomBytes(32).toString('hex');
    const secret = randomBytes(32).toString('hex');
    const projectId = 'prj_photo_intake_harness';
    const photoIntakeBinding = createHash('sha256').update(JSON.stringify([projectId, databaseUrl, token])).digest('hex');
    if (!managedTestDatabaseUrl) {
      pglite = await PGlite.create();
      socket = new PGLiteSocketServer({ db: pglite, port: dbPort, host: '127.0.0.1', maxConnections: 32 });
      await socket.start();
    }
    const fake = createBlobEmulator({ appOrigin, blobOrigin, readWriteToken: token, localFetch });
    blobServer = fake.server;
    await listen(blobServer, blobPort);
    await assert.rejects(localFetch('https://example.invalid/'), /denied parent HTTP origin/);
    await assert.rejects(localFetch(blobOrigin + '/redirect-probe', { redirect: 'follow' }), /ASTANA harness denied HTTP redirect to https:\/\/example\.invalid\//);
    assert.equal(fake.counts.redirectProbe, 1, 'loopback redirect probe reached only the local emulator');
    await createTempProject(tempRoot, productionHeadersOnly, productionFullBuildOnly);
    // OS runtime locations only; never inherit application credentials,
    // NODE_OPTIONS, proxies, SMTP/relay/cloud configuration.
    const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']
      .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
    Object.assign(env, {
      NODE_ENV: productionMode ? 'production' : 'development', NEXT_TELEMETRY_DISABLED: '1',
      DATABASE_URL: databaseUrl, BLOB_READ_WRITE_TOKEN: 'unrelated-harness-token',
      PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN: token, VERCEL_PROJECT_ID: projectId,
      PHOTO_INTAKE_RETENTION_BINDING_SHA256: photoIntakeBinding,
      VERCEL_BLOB_API_URL: blobOrigin, NEXT_PUBLIC_VERCEL_BLOB_API_URL: blobOrigin,
      VERCEL_BLOB_CALLBACK_URL: appOrigin, VERCEL_BLOB_RETRIES: '0',
      ALLOWED_ORIGINS: appOrigin, AUTH_SECRET: randomBytes(32).toString('hex'),
      PHOTO_INTAKE_ENABLED: 'true', PHOTO_INTAKE_PRIVATE_STORE_VERIFIED: 'true',
      PHOTO_INTAKE_RETENTION_ENABLED: 'true',
      PHOTO_UPLOAD_SESSION_SECRET: secret,
      ...(productionMode ? { VERCEL_ENV: 'production', ASTANA_HARNESS_PRODUCTION: '1' } : {}),
      ...(productionFullBuildOnly ? { ASTANA_HARNESS_LIGHTHOUSE: lighthouseS08 ? '1' : '0' } : {}),
      ASTANA_HARNESS_CHILD: '1', ASTANA_HARNESS_BLOB_ORIGIN: blobOrigin,
      ASTANA_HARNESS_APP_ORIGIN: appOrigin, ASTANA_HARNESS_APP_PORT: String(appPort),
      TEMP: tempRoot, TMP: tempRoot,
    });
    if (productionMode) {
      const build = spawnSync(process.execPath, [path.join(tempRoot, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build', '--webpack'], {
        cwd: tempRoot, env, windowsHide: true, encoding: 'utf8', timeout: 240_000, maxBuffer: 8 * 1024 * 1024,
      });
      assert.equal(build.status, 0, `isolated production build failed: ${(build.stdout || '') + (build.stderr || '')}`.slice(-7000));
      if (productionFullBuildOnly) {
        const seoAudits = [];
        for (const name of ['seo-rendered-metadata-check.mjs', 'seo-rendered-content-check.mjs']) {
          const audit = spawnSync(process.execPath, [path.join(tempRoot, 'scripts', name)], {
            cwd: tempRoot, env, windowsHide: true, encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024,
          });
          assert.equal(audit.status, 0, `${name} failed on the isolated candidate build: ${(audit.stdout || '') + (audit.stderr || '')}`.slice(-5000));
          seoAudits.push({ name, output: (audit.stdout || '').trim() });
        }
        const [priceClient, articleClient, rooferClient] = await Promise.all([
          readBuiltRouteClientSource(tempRoot, 'cena-likvidacie-azbestu.html'),
          readBuiltRouteClientSource(tempRoot, path.join('poradna', 'co-je-eternit-a-kedy-obsahuje-azbest.html')),
          readBuiltRouteClientSource(tempRoot, 'strechari.html'),
        ]);
        assert.match(priceClient.source, /price_calculator_change/, 'price route must load its calculator client');
        assert.doesNotMatch(priceClient.source, /roofer_registration_success/, 'price route must not load the full roofer client');
        assert.doesNotMatch(articleClient.source, /price_calculator_change|roofer_registration_success/,
          'article route must not load price or roofer-only clients');
        assert.match(rooferClient.source, /roofer_registration_success/, 'roofer route must keep its dedicated form client');
        const [homeCss, priceCss, contactCss, careerCss, rooferCss, realizationsCss, processCss, reviewsCss, photoIntakeCss] = await Promise.all([
          readBuiltRouteCssSource(tempRoot, 'index.html'),
          readBuiltRouteCssSource(tempRoot, 'cena-likvidacie-azbestu.html'),
          readBuiltRouteCssSource(tempRoot, 'kontakt.html'),
          readBuiltRouteCssSource(tempRoot, 'kariera.html'),
          readBuiltRouteCssSource(tempRoot, 'strechari.html'),
          readBuiltDynamicRouteCssSource(tempRoot, path.join('realizacie', 'page_client-reference-manifest.js')),
          readBuiltRouteCssSource(tempRoot, 'postup.html'),
          readBuiltDynamicRouteCssSource(tempRoot, path.join('recenzie', 'page_client-reference-manifest.js')),
          readBuiltDynamicRouteCssSource(tempRoot, path.join('spolupraca', 'fotky', 'page_client-reference-manifest.js')),
        ]);
        assert.match(careerCss.source, /--career-route-css:\s*1/, 'career route must load its dedicated stylesheet');
        assert.match(rooferCss.source, /--roofer-route-css:\s*1/, 'roofer route must load its dedicated stylesheet');
        assert.match(realizationsCss.source, /--realizations-route-css:\s*1/, 'realizations route must load its dedicated stylesheet');
        assert.match(homeCss.source, /--home-route-css:\s*1/, 'homepage must load its dedicated stylesheet');
        assert.match(processCss.source, /--postup-route-css:\s*1/, 'process route must load its dedicated stylesheet');
        assert.match(reviewsCss.source, /--reviews-route-css:\s*1/, 'reviews route must load its dedicated stylesheet');
        assert.match(photoIntakeCss.source, /--photo-intake-route-css:\s*1/, 'private photo-intake route must load its dedicated stylesheet');
        for (const [name, routeCss] of [['homepage', homeCss], ['price', priceCss], ['contact', contactCss]]) {
          assert.doesNotMatch(routeCss.source, /--career-route-css:\s*1/,
            `${name} route must not load career-only presentation CSS`);
          assert.doesNotMatch(routeCss.source, /--roofer-route-css:\s*1/,
            `${name} route must not load roofer-only presentation CSS`);
          assert.doesNotMatch(routeCss.source, /--realizations-route-css:\s*1/,
            `${name} route must not load realizations-only presentation CSS`);
          assert.doesNotMatch(routeCss.source, /--postup-route-css:\s*1/,
            `${name} route must not load process-only presentation CSS`);
          assert.doesNotMatch(routeCss.source, /--reviews-route-css:\s*1/,
            `${name} route must not load reviews-only presentation CSS`);
          assert.doesNotMatch(routeCss.source, /--photo-intake-route-css:\s*1/,
            `${name} route must not load private photo-intake presentation CSS`);
          if (name !== 'homepage') assert.doesNotMatch(routeCss.source, /--home-route-css:\s*1/,
            `${name} route must not load homepage-only presentation CSS`);
        }
        summary = {
          result: 'PASS',
          mode: 'isolated-full-production-build',
          output: process.env.ASTANA_LIGHTHOUSE_DIAGNOSTIC === '1'
            ? 'Next.js production compilation, TypeScript and static generation passed.'
            : (build.stdout || '').slice(-5000),
          seoAudits,
          clientBundleIsolation: {
            priceCalculatorWithoutRooferClient: true,
            articleWithoutPriceOrRooferClient: true,
            rooferClientRetained: true,
            scriptCounts: { price: priceClient.scriptCount, article: articleClient.scriptCount, roofers: rooferClient.scriptCount },
          },
          routeCssIsolation: {
            careerCssLoadedOnlyOnCareer: true,
            rooferCssLoadedOnlyOnRoofers: true,
            realizationsCssLoadedOnlyOnRealizations: true,
            processCssLoadedOnlyOnProcess: true,
            reviewsCssLoadedOnlyOnReviews: true,
            photoIntakeCssLoadedOnlyOnPrivatePortal: true,
            homeCssLoadedOnlyOnHomepage: true,
            styleCounts: {
              home: homeCss.styleCount, price: priceCss.styleCount,
              contact: contactCss.styleCount, career: careerCss.styleCount, roofers: rooferCss.styleCount,
              realizations: realizationsCss.styleCount,
              process: processCss.styleCount,
              reviews: reviewsCss.styleCount,
              photoIntake: photoIntakeCss.styleCount,
            },
          },
          productionAccess: false,
        };
      }
    }
    const redact = (value) => String(value).replaceAll(token, '[test-token]').replaceAll(secret, '[test-secret]')
      .replaceAll(databaseUrl, '[loopback-db]').replaceAll(env.AUTH_SECRET, '[test-secret]');
    child = spawn(process.execPath, [scriptPath], {
      cwd: tempRoot, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => {
      logs.push(redact(chunk.toString('utf8'))); if (logs.length > 100) logs.shift();
    });
    await waitForApp(appOrigin, child, localFetch, () => logs.join(''));
    if (productionFullBuildOnly) {
      const oldRooferPage = await localFetch(appOrigin + '/pre-strecharov/', { expectedRedirectPath: '/strechari/' });
      assert.equal(oldRooferPage.status, 308, 'old roofer URL must retain a permanent redirect');
      const rooferDestination = new URL(oldRooferPage.headers.get('location') || '', appOrigin);
      assert.equal(rooferDestination.origin, appOrigin, 'roofer redirect must stay on the same site');
      assert.equal(rooferDestination.pathname, '/strechari/');
      browser = await chromium.launch({ executablePath: edge, headless: true,
        args: ['--no-first-run', '--disable-background-networking', '--disable-component-update', '--disable-sync'] });
      const seoContext = await browser.newContext({ serviceWorkers: 'block' }); contexts.push(seoContext);
      await seoContext.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === appOrigin || url.origin === blobOrigin) return route.continue();
        deniedOrigins.push(url.origin); return route.abort('blockedbyclient');
      });
      const seoPage = await seoContext.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      seoPage.on('pageerror', (error) => pageErrors.push(error.message));
      seoPage.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

      const homeResponse = await seoPage.goto(appOrigin + '/', { waitUntil: 'networkidle', timeout: 60_000 });
      assert.equal(homeResponse?.status(), 200, 'homepage must render before accessibility and route-CSS checks');
      assert.match((await homeResponse.allHeaders())['content-security-policy'] || '', /style-src 'self'/,
        'homepage CSP must allow the same-origin deferred stylesheet');
      assert.equal(await seoPage.evaluate(() => getComputedStyle(document.documentElement)
        .getPropertyValue('--home-deferred-css').trim()), '1', 'deferred homepage CSS must be applied');

      let focusedContactPreference = false;
      for (let index = 0; index < 100; index += 1) {
        await seoPage.keyboard.press('Tab');
        if (await seoPage.evaluate(() => document.activeElement?.getAttribute('name') === 'preferredContact')) {
          focusedContactPreference = true;
          break;
        }
      }
      assert.equal(focusedContactPreference, true, 'keyboard tab order must reach a contact-preference radio');
      const focusRing = await seoPage.evaluate(() => {
        const input = document.activeElement;
        const label = input instanceof HTMLInputElement ? input.closest('label') : null;
        if (!label) return null;
        const style = getComputedStyle(label);
        return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
      });
      assert.ok(focusRing && focusRing.style !== 'none' && Number.parseFloat(focusRing.width) >= 3,
        `contact preference needs a visible keyboard focus ring (received ${JSON.stringify(focusRing)})`);

      await seoPage.locator('a[href="/postup/"]').first().click();
      await seoPage.waitForURL('**/postup/');
      assert.equal(await seoPage.evaluate(() => getComputedStyle(document.documentElement)
        .getPropertyValue('--postup-route-css').trim()), '1', 'SPA navigation must apply process route CSS');
      await seoPage.locator('a[href="/kontakt/"]').first().click();
      await seoPage.waitForURL('**/kontakt/');
      assert.equal(await seoPage.evaluate(() => getComputedStyle(document.documentElement)
        .getPropertyValue('--postup-route-css').trim()), '', 'process route CSS must not bleed after SPA navigation');
      assert.equal(await seoPage.evaluate(() => getComputedStyle(document.documentElement)
        .getPropertyValue('--home-route-css').trim()), '', 'homepage route CSS must not bleed after SPA navigation');

      const noJavaScriptCssRequests = [];
      const noJavaScriptContext = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
      contexts.push(noJavaScriptContext);
      noJavaScriptContext.on('request', (request) => {
        if (new URL(request.url()).pathname === '/assets/home-below-fold.css') noJavaScriptCssRequests.push(request.url());
      });
      await noJavaScriptContext.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === appOrigin || url.origin === blobOrigin) return route.continue();
        return route.abort('blockedbyclient');
      });
      const noJavaScriptPage = await noJavaScriptContext.newPage();
      const noJavaScriptResponse = await noJavaScriptPage.goto(appOrigin + '/', { waitUntil: 'load', timeout: 60_000 });
      assert.equal(noJavaScriptResponse?.status(), 200, 'homepage must render without JavaScript');
      assert.ok(noJavaScriptCssRequests.length >= 1, 'noscript fallback must request the deferred homepage stylesheet');
      assert.equal(await noJavaScriptPage.locator('form.lead-form[action="/api/dopyt/"][method="post"]').count(), 1,
        'the no-JavaScript homepage keeps the native lead form action');
      const noJavaScriptFormBox = await noJavaScriptPage.locator('form.lead-form').boundingBox();
      assert.ok(noJavaScriptFormBox && noJavaScriptFormBox.width > 250 && noJavaScriptFormBox.height > 300,
        'the deferred CSS fallback keeps the no-JavaScript lead form visible and laid out');

      const reviewsResponse = await seoPage.goto(appOrigin + '/recenzie/', { waitUntil: 'networkidle', timeout: 60_000 });
      assert.equal(reviewsResponse?.status(), 200, 'dynamic reviews URL must render without redirect');
      assert.doesNotMatch((await reviewsResponse.allHeaders())['x-robots-tag'] || '', /noindex/i,
        'dynamic reviews must not be hidden by an HTTP robots header');
      assert.equal(await seoPage.title(), 'Recenzie zákazníkov | ASTANA');
      assert.equal(await seoPage.locator('link[rel="canonical"]').getAttribute('href'), 'https://likvidacia-eternitu.sk/recenzie/');
      assert.equal(await seoPage.locator('meta[property="og:url"]').getAttribute('content'), 'https://likvidacia-eternitu.sk/recenzie/');
      assert.ok((await seoPage.locator('meta[name="description"]').getAttribute('content'))?.trim(), 'dynamic reviews description is required');
      assert.doesNotMatch((await seoPage.locator('meta[name="robots"]').getAttribute('content')) || '', /noindex/i);
      assert.deepEqual(await seoPage.locator('h1').allTextContents(), ['Recenzie zákazníkov ASTANA']);
      assert.match(await seoPage.locator('.testimonial-public-list').innerText(), /Zatiaľ tu nie sú zverejnené referencie/);
      assert.equal(await seoPage.locator('[data-nextjs-dialog]').count(), 0, 'no Next error overlay');
      assert.deepEqual(pageErrors, [], 'no uncaught browser error on dynamic reviews');
      assert.deepEqual(consoleErrors, [], 'no browser console error after client assets loaded');
      assert.deepEqual(deniedOrigins, [], 'dynamic reviews must not request an external origin');
      const realizationsResponse = await seoPage.goto(appOrigin + '/realizacie/', { waitUntil: 'networkidle', timeout: 60_000 });
      assert.equal(realizationsResponse?.status(), 200, 'dynamic realizations URL must render without redirect');
      assert.doesNotMatch((await realizationsResponse.allHeaders())['x-robots-tag'] || '', /noindex/i,
        'dynamic realizations must not be hidden by an HTTP robots header');
      assert.equal(await seoPage.title(), 'Realizácie likvidácie azbestu a eternitu | ASTANA');
      assert.equal(await seoPage.locator('link[rel="canonical"]').getAttribute('href'), 'https://likvidacia-eternitu.sk/realizacie/');
      assert.equal(await seoPage.locator('meta[property="og:url"]').getAttribute('content'), 'https://likvidacia-eternitu.sk/realizacie/');
      assert.ok((await seoPage.locator('meta[name="description"]').getAttribute('content'))?.trim(), 'dynamic realizations description is required');
      assert.doesNotMatch((await seoPage.locator('meta[name="robots"]').getAttribute('content')) || '', /noindex/i);
      assert.deepEqual(await seoPage.locator('h1').allTextContents(), ['Reálne realizácie ASTANA']);
      assert.equal(await seoPage.locator('#approved-realizations-title').count(), 0,
        'an empty database must not claim any approved realization');
      assert.equal(await seoPage.locator('#approved-case-map-title').count(), 0,
        'an empty database must not claim any approved case study');
      const visibleGalleryCards = seoPage.locator('[data-gallery-card]:visible');
      assert.ok(await visibleGalleryCards.count() > 0, 'reviewed gallery must contain a visible card without approved case rows');
      const fallbackCard = visibleGalleryCards.first();
      await fallbackCard.scrollIntoViewIfNeeded();
      await seoPage.waitForFunction(() => {
        const image = document.querySelector('[data-gallery-card]:not([hidden]) img');
        return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
      }, undefined, { timeout: 30_000 });
      assert.ok(await fallbackCard.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0),
        'the visible reviewed gallery photo must finish loading');
      assert.equal(await seoPage.locator('[data-nextjs-dialog]').count(), 0, 'no Next error overlay on dynamic realizations');
      assert.deepEqual(pageErrors, [], 'no uncaught browser error on dynamic realizations');
      assert.deepEqual(consoleErrors, [], 'no browser console error on dynamic realizations');
      assert.deepEqual(deniedOrigins, [], 'dynamic content routes must not request an external origin');
      const serviceSchemaChecks = [];
      for (const pathAndTitle of [
        ['/kde-posobime/', 'Likvidáciu azbestu riešime po celom Slovensku'],
        ['/postup/', 'Vy pošlete pár údajov. My vybavíme zvyšok.'],
      ]) {
        const [pagePath, expectedTitle] = pathAndTitle;
        const response = await seoPage.goto(appOrigin + pagePath, { waitUntil: 'networkidle', timeout: 60_000 });
        assert.equal(response?.status(), 200, `service route must render: ${pagePath}`);
        const visibleTitle = (await seoPage.locator('h1').innerText()).trim();
        assert.equal(visibleTitle, expectedTitle, `visible H1 changed on ${pagePath}`);
        const roots = (await seoPage.locator('script[type="application/ld+json"]').allTextContents())
          .flatMap((json) => { const parsed = JSON.parse(json); return Array.isArray(parsed) ? parsed : [parsed]; });
        const services = roots.flatMap((root) => root['@graph'] || [root])
          .filter((node) => node?.['@type'] === 'Service' && node.url === `https://likvidacia-eternitu.sk${pagePath}`);
        assert.deepEqual(services.map((service) => service.name), [visibleTitle],
          `Service schema name must match the visible H1 on ${pagePath}`);
        serviceSchemaChecks.push(pagePath);
      }
      assert.deepEqual(pageErrors, [], 'no uncaught browser errors on service pages');
      assert.deepEqual(consoleErrors, [], 'no browser console errors on service pages');
      assert.deepEqual(deniedOrigins, [], 'service pages must not request an external origin');
      summary = {
        ...summary,
        homepageDeferredCss: 'CSP, keyboard focus, no-JavaScript form and SPA route-CSS cleanup PASS',
        dynamicReviews: 'HTTP 200; canonical, OG URL, title, description, one H1, empty approved-list fallback and no browser errors PASS',
        dynamicRealizations: 'HTTP 200; canonical, OG URL, title, description, one H1, reviewed gallery fallback and no browser errors PASS',
        oldRooferRedirect: 'permanent same-origin 308 to /strechari/ PASS',
        serviceSchemaMatchesVisibleH1: serviceSchemaChecks,
      };
      if (lighthouseS08) {
        if (process.env.ASTANA_LIGHTHOUSE_DIAGNOSTIC !== '1') {
          const cssCoverage = [];
          for (const pagePath of [
            '/',
            '/cena-likvidacie-azbestu/',
            '/realizacie/',
            '/poradna/co-je-eternit-a-kedy-obsahuje-azbest/',
            '/kariera/',
          ]) {
            cssCoverage.push(await collectMobileCssCoverage(seoContext, appOrigin, pagePath));
          }
          summary.cssCoverage = cssCoverage;
        }
        const lighthouse = spawnSync(process.execPath, [path.join(tempRoot, 'scripts', 'lighthouse-s08.mjs')], {
          cwd: tempRoot,
          env: {
            ...env,
            ASTANA_LIGHTHOUSE_DIAGNOSTIC: process.env.ASTANA_LIGHTHOUSE_DIAGNOSTIC === '1' ? '1' : '0',
            ASTANA_LIGHTHOUSE_BASE_URL: appOrigin + '/',
            ASTANA_LIGHTHOUSE_REPORT_ROOT: path.join(tempRoot, 'lighthouse-s08'),
            ASTANA_HARNESS_TEMP_ROOT: tempRoot,
            CHROME_PATH: lighthouseBrowser,
          },
          windowsHide: true,
          encoding: 'utf8',
          timeout: 1_200_000,
          maxBuffer: 8 * 1024 * 1024,
        });
        assert.equal(lighthouse.status, 0,
          `Isolated mobile Lighthouse S08 failed: ${(lighthouse.stderr || lighthouse.stdout || lighthouse.error?.message || 'unknown error').slice(-5000)}`);
        const lighthouseSummary = JSON.parse(lighthouse.stdout.trim().split(/\r?\n/).at(-1));
        if (process.env.ASTANA_LIGHTHOUSE_DIAGNOSTIC === '1') {
          assert.equal(lighthouseSummary.result, 'DIAGNOSTIC_ONLY');
          assert.equal(lighthouseSummary.pages.length, 5);
          assert.ok(lighthouseSummary.pages.every((page) => page.runs.length === 1));
          summary.lighthouseDiagnostic = lighthouseSummary;
        } else {
          assert.equal(lighthouseSummary.result, 'PASS');
          assert.equal(lighthouseSummary.results.length, 5);
          assert.ok(lighthouseSummary.results.every((page) => page.runs.length === 3));
          summary.lighthouseS08 = lighthouseSummary;
        }
      }
      console.log(JSON.stringify(summary));
      return;
    }
    if (productionCronOnly) {
      const configured = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8')).crons;
      assert.ok(configured.length > 0, 'expected configured cron routes');
      const checked = [];
      for (const cron of configured) {
        assert.match(cron.path, /^\/api\/cron\/[a-z0-9-]+\/$/, 'cron path must be canonical');
        const response = await localFetch(appOrigin + cron.path, { redirect: 'manual' });
        assert.equal(response.status, 401, `unauthorized cron must reach its handler without redirect: ${cron.path}`);
        checked.push(cron.path);
      }
      summary = { result: 'PASS', mode: 'isolated-production-cron-routes', unauthorizedStatus: 401,
        checked, productionAccess: false };
      console.log(JSON.stringify(summary));
      return;
    }
    browser = await chromium.launch({ executablePath: edge, headless: true,
      args: ['--no-first-run', '--disable-background-networking', '--disable-component-update', '--disable-sync'] });
    const bootstrapContext = await browser.newContext({ serviceWorkers: 'block' }); contexts.push(bootstrapContext);
    await bootstrapContext.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === appOrigin || url.origin === blobOrigin) return route.continue();
      deniedOrigins.push(url.origin); return route.abort('blockedbyclient');
    });
    const bootstrapPage = await bootstrapContext.newPage();
    const portalResponse = await bootstrapPage.goto(appOrigin + '/spolupraca/fotky/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    assert.equal(portalResponse?.status(), 200, 'the private intake page must load for its invitation gate');
    const portalHeaders = await portalResponse.allHeaders();
    if (productionHeadersOnly) {
      assert.match(portalHeaders['cache-control'] || '', /private.*no-store/i,
        `production worker history must be private and non-cacheable (received: ${portalHeaders['cache-control'] || 'missing'})`);
    } else {
      assert.match(portalHeaders['cache-control'] || '', /no-cache|private.*no-store/i,
        `development worker history must require revalidation (received: ${portalHeaders['cache-control'] || 'missing'})`);
    }
    assert.match(portalHeaders['x-robots-tag'] || '', /noindex.*nofollow/i, 'the private invite route must stay outside search indexes');
    assert.equal(portalHeaders['referrer-policy'], 'no-referrer', 'invite route must not leak URL context to outbound requests');
    if (productionHeadersOnly) {
      summary = { result: 'PASS', mode: 'isolated-production-runtime', status: portalResponse.status(),
        cacheControl: portalHeaders['cache-control'], robots: portalHeaders['x-robots-tag'],
        referrerPolicy: portalHeaders['referrer-policy'], productionAccess: false };
      console.log(JSON.stringify(summary));
      return;
    }
    const bootstrap = await bootstrapPage.evaluate(async () => {
      const response = await fetch('/api/photo-intake/session/', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'invalid' }),
      });
      return { status: response.status, body: await response.text() };
    });
    assert.equal(bootstrap.status, 401, `initialize isolated schema through real session handler: ${bootstrap.body}`);
    assert.deepEqual(JSON.parse(bootstrap.body), { error: 'Kód nie je platný alebo už bol použitý.' },
      'session handler must return the expected user-safe explanation for an invalid code');
    const invites = [0, 1].map((index) => ({
      id: randomUUID(), code: randomBytes(32).toString('hex'), mediaId: randomUUID(),
      label: 'Izolovaná partia ' + (index + 1), name: 'sukromna-partia-' + (index + 1) + '.jpg',
      locality: index === 0 ? 'Poprad – skúšobná lokalita' : 'Kežmarok – skúšobná lokalita',
      categories: index === 0 ? ['family_house'] : ['garage'],
    }));
    const syntheticJobId = randomUUID();
    await pglite.query(
      `INSERT INTO business_jobs (id, demolition_date, customer_name, district, status)
       VALUES ($1, DATE '2026-09-15', 'Izolovaný testovací prípad – nejde o zákazníka', 'Poprad', 'DEMONT_DOKONCENA')`,
      [syntheticJobId]);
    for (const invite of invites) {
      await pglite.query(
        "INSERT INTO photo_upload_invites (id, token_hash, created_by, worker_label, expires_at, business_job_id) VALUES ($1, $2, 'isolated@example.invalid', $3, now() + interval '1 day', $4)",
        [invite.id, createHash('sha256').update(invite.code).digest('hex'), invite.label, invite === invites[0] ? syntheticJobId : null]);
      const bytes = await sharp({ create: { width: 80, height: 60, channels: 3, background: invite === invites[0] ? '#304080' : '#803040' } }).jpeg().toBuffer();
      invite.storageKey = 'crew-intake/' + invite.id + '/' + invite.mediaId + '.jpg';
      fake.blobs.set(invite.storageKey, { bytes, blob: {
        pathname: invite.storageKey, url: 'https://' + privateBlobHost + '/' + invite.storageKey,
        downloadUrl: 'https://' + privateBlobHost + '/' + invite.storageKey + '?download=1',
        size: bytes.length, contentType: 'image/jpeg', contentDisposition: 'inline',
        cacheControl: 'private, no-store', uploadedAt: new Date().toISOString(),
      } });
      await pglite.query(
        "INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, mime_type, size_bytes, content_hash, locality, categories, status, uploaded_at) VALUES ($1, $2, $3, $4, 'image/jpeg', $5, $6, $7, $8::jsonb, 'pending_review', now())",
        [invite.mediaId, invite.id, invite.storageKey, invite.name, bytes.length,
          createHash('sha256').update(bytes).digest('hex'), invite.locality, JSON.stringify(invite.categories)]);
    }
    async function newContext(options = {}) {
      const context = await browser.newContext({ serviceWorkers: 'block', ...options }); contexts.push(context);
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === appOrigin || url.origin === blobOrigin) return route.continue();
        deniedOrigins.push(url.origin); return route.abort('blockedbyclient');
      });
      return context;
    }
    async function mediaRead(page, id) {
      assert.match(id, /^[0-9a-f-]{36}$/);
      return page.evaluate(async (mediaId) => {
        const response = await fetch('/api/photo-intake/media/' + mediaId + '/', { cache: 'no-store' });
        return { status: response.status, type: response.headers.get('content-type'),
          cache: response.headers.get('cache-control'), bytes: (await response.arrayBuffer()).byteLength };
      }, id);
    }
    async function login(page, invite) {
      page.on('console', (message) => { if (message.type() === 'error') logs.push('LOGIN BROWSER CONSOLE: ' + message.text()); });
      page.on('pageerror', (error) => logs.push('LOGIN BROWSER PAGE ERROR: ' + error.message));
      page.on('requestfailed', (request) => logs.push('LOGIN REQUEST FAILED: ' + request.url() + ' ' + request.failure()?.errorText));
      await page.goto(appOrigin + '/spolupraca/fotky/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 30_000 });
      await page.locator('#invite-code').fill(invite.code);
      try { await page.waitForFunction(() => {
        const button = document.querySelector('.photo-intake-login button');
        return button instanceof HTMLButtonElement && !button.disabled;
      }, undefined, { timeout: 15_000 }); } catch (error) {
        const state = await page.evaluate(() => ({ href: location.href, valueLength: document.querySelector('#invite-code')?.value?.length,
          buttonDisabled: document.querySelector('.photo-intake-login button')?.disabled,
          scripts: Array.from(document.scripts, (script) => script.src).filter(Boolean) }));
        throw new Error(`login form did not hydrate: ${JSON.stringify(state)}; ${error instanceof Error ? error.message : error}`);
      }
      const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/photo-intake/session/' && res.request().method() === 'POST', { timeout: 60_000 });
      await page.getByRole('button', { name: 'Otvoriť nahrávanie' }).click();
      assert.equal((await response).status(), 200);
      await page.getByText(invite.label, { exact: true }).waitFor({ timeout: 60_000 });
      await page.getByRole('button', { name: 'Odhlásiť', exact: true }).waitFor();
      await page.waitForLoadState('networkidle', { timeout: 30_000 });
    }
    const anonymous = await newContext(), anonymousPage = await anonymous.newPage();
    anonymousPage.on('console', (message) => { if (message.type() === 'error') logs.push('BROWSER CONSOLE: ' + message.text()); });
    anonymousPage.on('pageerror', (error) => logs.push('BROWSER PAGE ERROR: ' + error.message));
    anonymousPage.on('requestfailed', (request) => logs.push('BROWSER REQUEST FAILED: ' + request.url() + ' ' + request.failure()?.errorText));
    await anonymousPage.goto(appOrigin + '/spolupraca/fotky/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await anonymousPage.locator('#invite-code').waitFor();
    assert.equal(await anonymousPage.locator('.photo-intake-history').count(), 0);
    const beforeAnonymous = fake.counts.privateGet;
    assert.equal((await mediaRead(anonymousPage, invites[0].mediaId)).status, 401);
    assert.equal(fake.counts.privateGet, beforeAnonymous, 'denied read must not fetch Blob bytes');
    assert.equal((await localFetch(blobOrigin + '/' + invites[0].storageKey)).status, 401);
    await anonymousPage.locator('#invite-code').fill('not-a-real-invitation-code-000000000000');
    await anonymousPage.getByRole('button', { name: 'Otvoriť nahrávanie' }).waitFor({ state: 'visible' });
    await anonymousPage.waitForFunction(() => {
      const input = document.querySelector('#invite-code'); const button = document.querySelector('.photo-intake-login button');
      return input instanceof HTMLInputElement && button instanceof HTMLButtonElement && !button.disabled;
    }, undefined, { timeout: 30_000 });
    const invalidResponse = anonymousPage.waitForResponse((res) => new URL(res.url()).pathname === '/api/photo-intake/session/' && res.request().method() === 'POST', { timeout: 60_000 });
    await anonymousPage.getByRole('button', { name: 'Otvoriť nahrávanie' }).click();
    const invalidInvitationResponse = await invalidResponse;
    assert.equal(invalidInvitationResponse.status(), 401, 'invalid invitation rejected');

    const first = await newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }), firstPage = await first.newPage();
    firstPage.on('console', (message) => { if (message.type() === 'error') logs.push('FIRST BROWSER CONSOLE: ' + message.text()); });
    firstPage.on('pageerror', (error) => logs.push('FIRST BROWSER PAGE ERROR: ' + error.message));
    await login(firstPage, invites[0]);
    const session = (await first.cookies(appOrigin)).find((cookie) => cookie.name === cookieName);
    assert.ok(session && session.httpOnly && session.sameSite === 'Strict', 'HTTP-only strict session');
    assert.equal(session.secure, false, 'local dev HTTP only');
    assert.ok((await pglite.query('SELECT consumed_at FROM photo_upload_invites WHERE id = $1', [invites[0].id])).rows[0].consumed_at);
    await firstPage.locator('.photo-intake-history').getByText(invites[0].name, { exact: true }).waitFor();
    assert.equal(await firstPage.getByText(invites[1].name, { exact: true }).count(), 0);
    await firstPage.waitForFunction(() => {
      const image = document.querySelector('.photo-intake-history img'); return image?.complete && image.naturalWidth > 0;
    });
    const read = await mediaRead(firstPage, invites[0].mediaId);
    assert.equal(read.status, 200); assert.equal(read.type, 'image/jpeg');
    assert.match(read.cache, /private.*no-store/); assert.ok(read.bytes > 0);

    const forged = await newContext(), forgedPage = await forged.newPage();
    const [payload, signature] = session.value.split('.');
    const forgedSignature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
    await forged.addCookies([{ name: cookieName, value: payload + '.' + forgedSignature, url: appOrigin, httpOnly: true, sameSite: 'Strict' }]);
    await forgedPage.goto(appOrigin + '/spolupraca/fotky/', { waitUntil: 'domcontentloaded' });
    await forgedPage.locator('#invite-code').waitFor();
    const beforeForged = fake.counts.privateGet;
    assert.equal((await mediaRead(forgedPage, invites[0].mediaId)).status, 401);
    assert.equal(fake.counts.privateGet, beforeForged);
    await anonymousPage.locator('#invite-code').fill(invites[0].code);
    const replayResponse = anonymousPage.waitForResponse((res) => new URL(res.url()).pathname === '/api/photo-intake/session/' && res.request().method() === 'POST', { timeout: 60_000 });
    await anonymousPage.getByRole('button', { name: 'Otvoriť nahrávanie' }).click();
    assert.equal((await replayResponse).status(), 401, 'consumed invitation replay must be rejected');
    await anonymousPage.getByRole('alert').filter({ hasText: 'Kód nie je platný alebo už bol použitý.' }).waitFor();
    assert.equal((await anonymous.cookies(appOrigin)).some((cookie) => cookie.name === cookieName), false);

    const second = await newContext(), secondPage = await second.newPage();
    await login(secondPage, invites[1]);
    await secondPage.locator('.photo-intake-history').getByText(invites[1].name, { exact: true }).waitFor();
    assert.equal(await secondPage.getByText(invites[0].name, { exact: true }).count(), 0);
    // Settle authorized history loads before measuring denial.
    await secondPage.waitForFunction(() => {
      const image = document.querySelector('.photo-intake-history img'); return image?.complete && image.naturalWidth > 0;
    });
    const beforeCross = fake.counts.privateGet;
    assert.equal((await mediaRead(secondPage, invites[0].mediaId)).status, 401);
    assert.equal(fake.counts.privateGet, beforeCross);
    assert.equal((await mediaRead(secondPage, invites[1].mediaId)).status, 200);
    const unsigned = await localFetch(appOrigin + '/api/photo-intake/upload/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'blob.upload-completed', payload: {
        blob: fake.blobs.get(invites[0].storageKey).blob,
        tokenPayload: JSON.stringify({ inviteId: invites[0].id, mediaId: invites[0].mediaId }),
      } }), signal: AbortSignal.timeout(60_000),
    });
    assert.equal(unsigned.status, 400, 'unsigned callback rejected');

    const image = await pngFixture(sharp, 'isolated-crew-upload'), locality = 'Poprad – okolie (izolovaný test)';
    await firstPage.locator('.photo-intake-file-picker input[type="file"]').setInputFiles(image);
    const draft = firstPage.locator('.photo-intake-draft'); await draft.waitFor();
    assert.equal(await draft.getByLabel('Lokalita – obec alebo širšia oblasť').inputValue(), '');
    assert.equal(await draft.locator('input[type="checkbox"]:checked').count(), 0);
    const mobileStates = [];
    for (const width of [390, 320]) {
      await firstPage.setViewportSize({ width, height: 844 });
      const mobileState = await firstPage.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        previewLoaded: document.querySelector('.photo-intake-preview') instanceof HTMLImageElement
          && document.querySelector('.photo-intake-preview').naturalWidth > 0,
      }));
      assert.equal(mobileState.viewportWidth, width, `crew upload browser uses a ${width}px viewport`);
      assert.ok(mobileState.documentWidth <= mobileState.viewportWidth, `photo intake must not overflow horizontally on mobile: ${JSON.stringify(mobileState)}`);
      assert.equal(mobileState.previewLoaded, true, 'uploaded photo preview must be visible on mobile');
      mobileStates.push(mobileState);
    }
    await firstPage.setViewportSize({ width: 390, height: 844 });
    const privacyFooterStyle = await firstPage.locator('.photo-intake-content > footer').evaluate((footer) => {
      const style = getComputedStyle(footer);
      return { color: style.color, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage };
    });
    assert.deepEqual(privacyFooterStyle, {
      color: 'rgb(52, 68, 92)',
      backgroundColor: 'rgb(255, 255, 255)',
      backgroundImage: 'none',
    }, 'mobile privacy notice must use a readable high-contrast light panel');
    for (const label of ['Rodinný dom', 'Hospodárska budova', 'Garáž', 'Nelegálna skládka', 'Interiér']) {
      assert.equal(await draft.getByLabel(label, { exact: true }).isVisible(), true, `${label} category checkbox is visible on mobile`);
    }
    await firstPage.screenshot({ path: path.join(tempRoot, 'photo-intake-390-TEST.png'), fullPage: true });
    const confirm = firstPage.waitForResponse((res) => new URL(res.url()).pathname === '/api/photo-intake/confirm/' && res.request().method() === 'POST', { timeout: 90_000 });
    await draft.getByRole('button', { name: 'Nahrať fotografiu', exact: true }).click();
    const confirmed = await confirm;
    assert.equal(confirmed.status(), 200, 'actual browser upload confirmation: ' + (await confirmed.text()).slice(0, 300));
    assert.equal((await confirmed.json()).ok, true);
    await draft.getByRole('status').filter({ hasText: 'Nahraté – čaká na kontrolu' }).waitFor();
    assert.equal(await draft.getByRole('alert').count(), 0);
    const uploadedRows = await pglite.query('SELECT * FROM realization_media_intake WHERE invite_id = $1 AND original_name = $2', [invites[0].id, image.name]);
    assert.equal(uploadedRows.rowCount, 1);
    const uploaded = uploadedRows.rows[0];
    assert.equal(uploaded.status, 'pending_review'); assert.equal(uploaded.locality, '');
    assert.deepEqual(uploaded.categories, [], 'unknown locality and categories must not block a private photo upload');
    assert.equal(uploaded.storage_driver, 'vercel_blob'); assert.equal(uploaded.mime_type, 'image/jpeg');
    const sanitizedBlob = fake.blobs.get(uploaded.storage_key);
    assert.ok(sanitizedBlob, 'database must point to the private sanitized copy');
    assert.equal(sanitizedBlob.blob.contentType, 'image/jpeg');
    assert.equal(sanitizedBlob.bytes[0], 0xff); assert.equal(sanitizedBlob.bytes[1], 0xd8);
    assert.equal(uploaded.size_bytes, sanitizedBlob.bytes.length);
    assert.equal(uploaded.content_hash, createHash('sha256').update(sanitizedBlob.bytes).digest('hex'));
    assert.ok(!sanitizedBlob.bytes.equals(image.buffer), 'published-ready copy must not equal original bytes');
    assert.ok(uploaded.upload_token_issued_at && uploaded.uploaded_at);
    const sourcePath = `crew-intake/${invites[0].id}/${uploaded.id}.png`;
    assert.ok(fake.blobs.get(sourcePath)?.bytes.equals(image.buffer), 'original should remain in its private source object until retention');
    await draft.getByLabel('Lokalita – obec alebo širšia oblasť').fill(locality);
    await draft.getByLabel('Rodinný dom', { exact: true }).check();
    const initialMetadataResponse = firstPage.waitForResponse((res) => new URL(res.url()).pathname.replace(/\/$/, '') === '/api/photo-intake/metadata' && res.request().method() === 'POST', { timeout: 15_000 });
    await draft.getByRole('button', { name: 'Uložiť lokalitu a kategórie' }).click();
    const initialMetadataSaved = await initialMetadataResponse;
    assert.equal(initialMetadataSaved.status(), 200, 'crew can add locality and category after private upload');
    const withMetadata = await pglite.query('SELECT locality, categories, metadata_version FROM realization_media_intake WHERE id = $1', [uploaded.id]);
    assert.deepEqual(withMetadata.rows[0], { locality, categories: ['family_house'], metadata_version: uploaded.metadata_version + 1 });
    uploaded.locality = locality; uploaded.categories = ['family_house']; uploaded.metadata_version += 1;
    assert.deepEqual({ create: fake.counts.create, part: fake.counts.part, complete: fake.counts.complete, callback: fake.counts.callback },
      { create: 1, part: 1, complete: 1, callback: 1 });
    await draft.getByLabel('Rodinný dom', { exact: true }).uncheck();
    await draft.getByLabel('Rodinný dom', { exact: true }).check();
    const reorderedNoOpRequests = [];
    const countReorderedNoOp = (request) => {
      if (new URL(request.url()).pathname.replace(/\/$/, '') === '/api/photo-intake/metadata' && request.method() === 'POST') {
        reorderedNoOpRequests.push(request);
      }
    };
    firstPage.on('request', countReorderedNoOp);
    await draft.getByRole('button', { name: 'Uložiť lokalitu a kategórie' }).click();
    await firstPage.waitForTimeout(100);
    firstPage.off('request', countReorderedNoOp);
    assert.equal(reorderedNoOpRequests.length, 0, 'reordered but unchanged categories must not create a metadata update');
    const reorderedNoOpRow = await pglite.query('SELECT metadata_version FROM realization_media_intake WHERE id = $1', [uploaded.id]);
    assert.equal(reorderedNoOpRow.rows[0].metadata_version, uploaded.metadata_version);
    const draftLocality = 'Svit – okolie (izolovaný test)';
    await draft.getByLabel('Lokalita – obec alebo širšia oblasť').fill(draftLocality);
    await draft.getByLabel('Garáž', { exact: true }).uncheck();
    const draftMetadataResponse = firstPage.waitForResponse((res) => new URL(res.url()).pathname.replace(/\/$/, '') === '/api/photo-intake/metadata' && res.request().method() === 'POST', { timeout: 15_000 });
    await draft.getByRole('button', { name: 'Uložiť lokalitu a kategórie' }).click();
    const draftSaved = await draftMetadataResponse;
    assert.equal(draftSaved.status(), 200, 'uploader must persist changed metadata without re-confirming the uploaded photo');
    assert.equal((await draftSaved.request().postDataJSON()).expectedMetadataVersion, uploaded.metadata_version);
    await draft.getByRole('status').filter({ hasText: 'Nahraté – čaká na kontrolu' }).waitFor();
    assert.equal(await draft.getByRole('alert').count(), 0);
    const savedDraftRow = await pglite.query('SELECT locality, categories, metadata_version FROM realization_media_intake WHERE id = $1', [uploaded.id]);
    assert.deepEqual(savedDraftRow.rows[0], {
      locality: draftLocality, categories: ['family_house'], metadata_version: uploaded.metadata_version + 1,
    }, 'uploader save must update the existing private row and its optimistic version');
    assert.deepEqual({ create: fake.counts.create, part: fake.counts.part, complete: fake.counts.complete, callback: fake.counts.callback },
      { create: 1, part: 1, complete: 1, callback: 1 }, 'metadata save must not upload the photo again');
    assert.equal(fake.counts.serverPut, 1, 'metadata save must not re-sanitize or re-confirm the private photo');
    const noOpRequests = [];
    const countNoOpMetadata = (request) => {
      if (new URL(request.url()).pathname.replace(/\/$/, '') === '/api/photo-intake/metadata' && request.method() === 'POST') {
        noOpRequests.push(request);
      }
    };
    firstPage.on('request', countNoOpMetadata);
    await draft.getByRole('button', { name: 'Uložiť lokalitu a kategórie' }).click();
    await firstPage.waitForTimeout(100);
    firstPage.off('request', countNoOpMetadata);
    assert.equal(noOpRequests.length, 0, 'unchanged metadata must not create another update request');
    const noOpRow = await pglite.query('SELECT metadata_version FROM realization_media_intake WHERE id = $1', [uploaded.id]);
    assert.equal(noOpRow.rows[0].metadata_version, uploaded.metadata_version + 1, 'no-op save must not advance metadata version');
    const concurrentLocality = 'Spišská Belá – okolie (izolovaný test)';
    const concurrentSave = await firstPage.evaluate(async ({ id, locality, expectedMetadataVersion }) => {
      const response = await fetch('/api/photo-intake/metadata/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, locality, categories: ['family_house'], expectedMetadataVersion }),
      });
      return { status: response.status, body: await response.json() };
    }, { id: uploaded.id, locality: concurrentLocality, expectedMetadataVersion: uploaded.metadata_version + 1 });
    assert.equal(concurrentSave.status, 200);
    await draft.getByLabel('Lokalita – obec alebo širšia oblasť').fill('Levoča – okolie (izolovaný test)');
    const staleMetadataResponse = firstPage.waitForResponse((res) => new URL(res.url()).pathname.replace(/\/$/, '') === '/api/photo-intake/metadata' && res.request().method() === 'POST', { timeout: 15_000 });
    await draft.getByRole('button', { name: 'Uložiť lokalitu a kategórie' }).click();
    assert.equal((await staleMetadataResponse).status(), 409, 'stale uploader version must not overwrite newer metadata');
    await draft.getByRole('alert').getByText(/Obnovte stránku/).waitFor();
    await draft.getByRole('status').filter({ hasText: 'Nahraté – čaká na kontrolu' }).waitFor();
    const conflictRow = await pglite.query('SELECT locality, categories, metadata_version FROM realization_media_intake WHERE id = $1', [uploaded.id]);
    assert.deepEqual(conflictRow.rows[0], {
      locality: concurrentLocality, categories: ['family_house'], metadata_version: uploaded.metadata_version + 2,
    });
    assert.equal(fake.counts.serverPut, 1, 'stale metadata retry must not re-confirm the private photo');
    await firstPage.reload({ waitUntil: 'domcontentloaded' });
    const historyCard = firstPage.locator('.photo-intake-history article').filter({ hasText: image.name });
    await historyCard.getByText(image.name, { exact: true }).waitFor();
    // `domcontentloaded` precedes Next client hydration; wait for the actual
    // client component effect instead of assuming a fixed startup duration.
    await firstPage.locator('.photo-intake-history article[data-client-ready="true"]')
      .filter({ hasText: image.name }).waitFor();
    const historyLocality = historyCard.getByLabel('Lokalita – obec alebo širšia oblasť');
    assert.equal(await historyLocality.inputValue(), concurrentLocality, 'najnovšia lokalita sa musí zobraziť v editovateľnom poli');
    assert.equal(await historyCard.getByLabel('Rodinný dom', { exact: true }).isChecked(), true);
    assert.equal(await historyCard.getByLabel('Garáž', { exact: true }).isChecked(), false);
    const updatedLocality = 'Kežmarok – okolie (izolovaný test)';
    await historyLocality.fill(updatedLocality);
    await historyCard.getByLabel('Garáž', { exact: true }).check();
    await historyCard.getByLabel('Rodinný dom', { exact: true }).uncheck();
    const metadataSaved = historyCard.getByRole('status');
    const metadataResponse = firstPage.waitForResponse((res) => new URL(res.url()).pathname.replace(/\/$/, '') === '/api/photo-intake/metadata' && res.request().method() === 'POST', { timeout: 15_000 });
    await historyCard.getByRole('button', { name: 'Uložiť miesto a kategóriu' }).click();
    const savedResponse = await metadataResponse;
    assert.equal(savedResponse.status(), 200, 'uloženie metadát musí uspieť: ' + (await savedResponse.text()).slice(0, 300));
    await metadataSaved.waitFor({ timeout: 5_000 });
    const feedback = (await metadataSaved.textContent())?.trim() || '';
    assert.equal(feedback, 'Popis fotografie je uložený. Fotografia zostáva súkromná.', 'formulár musí potvrdiť serverové uloženie metadát');
    const updatedPhoto = await pglite.query('SELECT locality, categories, metadata_version FROM realization_media_intake WHERE id = $1', [uploaded.id]);
    assert.deepEqual(updatedPhoto.rows[0], {
      locality: updatedLocality, categories: ['garage'], metadata_version: uploaded.metadata_version + 3,
    }, 'zmena miesta a kategórií sa musí uložiť do DB, nielen do stavu prehliadača');
    await firstPage.reload({ waitUntil: 'domcontentloaded' });
    const refreshedCard = firstPage.locator('.photo-intake-history article').filter({ hasText: image.name });
    await refreshedCard.getByLabel('Lokalita – obec alebo širšia oblasť').waitFor();
    assert.equal(await refreshedCard.getByLabel('Lokalita – obec alebo širšia oblasť').inputValue(), updatedLocality,
      'zmenená lokalita musí zostať po obnovení stránky');
    assert.equal(await refreshedCard.getByLabel('Rodinný dom', { exact: true }).isChecked(), false);
    assert.equal(await refreshedCard.getByLabel('Garáž', { exact: true }).isChecked(), true);
    assert.equal((await mediaRead(firstPage, uploaded.id)).status, 200);
    assert.equal((await mediaRead(secondPage, uploaded.id)).status, 401);

    // Exercise the real admin pages and Server Actions with a signed,
    // harness-only admin session. Every side effect remains in isolated PGlite.
    const adminEmail = 'admin@local.test';
    const authSecret = env.AUTH_SECRET;
    const adminPayload = Buffer.from(JSON.stringify({ email: adminEmail, iat: Date.now() })).toString('base64url');
    const adminCookie = adminPayload + '.' + createHmac('sha256', authSecret).update(adminPayload).digest('base64url');
    const adminContext = await newContext();
    await adminContext.addCookies([{ name: 'astana_admin_session', value: adminCookie, url: appOrigin, httpOnly: true, sameSite: 'Lax' }]);
    const adminPage = await adminContext.newPage();
    adminPage.on('pageerror', (error) => logs.push('ADMIN BROWSER PAGE ERROR: ' + error.message));
    const moderationResponse = await adminPage.goto(appOrigin + '/admin/realizacie/fotky/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    assert.equal(moderationResponse?.status(), 200, 'isolated admin photo moderation page must load');
    await adminPage.getByRole('heading', { name: 'Fotky z terénu' }).waitFor();
    const adminPhoto = adminPage.locator('.photo-admin-grid article').filter({ hasText: image.name });
    await adminPhoto.waitFor();
    const adminMetadata = adminPhoto.locator('form.photo-intake-metadata-form');
    await adminMetadata.getByLabel('Lokalita (iba obec alebo približná oblasť)').fill('Poprad');
    for (const category of ['Rodinný dom', 'Hospodárska budova', 'Garáž', 'Nelegálna skládka', 'Interiér']) {
      const checkbox = adminMetadata.getByLabel(category, { exact: true });
      if (category === 'Rodinný dom') await checkbox.check(); else await checkbox.uncheck();
    }
    await adminMetadata.getByRole('button', { name: 'Uložiť popis fotky' }).click();
    await adminPage.waitForLoadState('networkidle');
    let moderatedPhoto = await pglite.query('SELECT locality, categories, metadata_version, status FROM realization_media_intake WHERE id=$1', [uploaded.id]);
    assert.deepEqual(moderatedPhoto.rows[0], { locality: 'Poprad', categories: ['family_house'], metadata_version: uploaded.metadata_version + 4, status: 'pending_review' },
      'admin edits must persist to the photo row through the real Server Action');

    const approvePhoto = adminPage.locator('.photo-admin-grid article').filter({ hasText: image.name })
      .getByRole('button', { name: 'Schváliť interne' });
    assert.equal(await approvePhoto.isEnabled(), true, 'saved approximate locality and category must enable internal review');
    const approveActionResponse = adminPage.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/admin/realizacie/fotky/', { timeout: 15_000 });
    await approvePhoto.click();
    assert.equal((await approveActionResponse).status(), 200, 'admin review Server Action must complete successfully');
    moderatedPhoto = await pglite.query('SELECT status, locality, categories FROM realization_media_intake WHERE id=$1', [uploaded.id]);
    assert.deepEqual(moderatedPhoto.rows[0], { status: 'approved_private', locality: 'Poprad', categories: ['family_house'] },
      'admin photo review must mark the private photo as approved without publishing it');
    await adminPage.locator('.photo-admin-grid article').filter({ hasText: image.name })
      .getByRole('button', { name: 'Pripraviť alebo otvoriť koncept realizácie' }).click();
    await adminPage.waitForFunction(() => /\/admin\/realizacie\/pripady\/?$/.test(location.pathname), { timeout: 30_000 });
    await adminPage.getByRole('heading', { name: 'Koncepty prípadov' }).waitFor();
    const caseForm = adminPage.locator('form.admin-case-draft-form').last();
    const caseTitle = 'Testovací prípad Poprad – nesmie ísť do produkcie';
    await caseForm.locator('input[name="title"]').fill(caseTitle);
    await caseForm.locator('input[name="locality"]').fill('Poprad');
    await caseForm.locator('select[name="localityPrecision"]').selectOption('municipality');
    await caseForm.locator('input[name="materialType"]').fill('Vlnitý eternit – syntetický test');
    await caseForm.locator('textarea[name="workDescription"]').fill('Syntetický test redakčného toku; nejde o opis skutočnej zákazky.');
    await caseForm.locator('textarea[name="resultDescription"]').fill('Testovacie údaje určené výhradne pre izolovanú kontrolu.');
    await caseForm.getByRole('button', { name: 'Uložiť súkromný koncept' }).click();
    await adminPage.waitForLoadState('networkidle');
    let caseState = await pglite.query('SELECT lifecycle FROM realization_case_drafts WHERE business_job_id=$1', [syntheticJobId]);
    assert.deepEqual(caseState.rows[0], { lifecycle: 'draft' }, 'new case must be stored as a private draft before review');
    await adminPage.getByRole('button', { name: 'Odovzdať na redakčné posúdenie' }).click();
    await adminPage.getByRole('cell', { name: 'Čaká na schválenie', exact: true }).waitFor();
    caseState = await pglite.query('SELECT lifecycle, publication_rights_confirmed FROM realization_case_drafts WHERE business_job_id=$1', [syntheticJobId]);
    assert.deepEqual(caseState.rows[0], { lifecycle: 'reviewed', publication_rights_confirmed: false },
      'review submission must not publish or implicitly approve a case');
    const approvalForm = adminPage.locator('form.admin-case-draft-form');
    await approvalForm.locator('input[name="publicationEvidence"]').fill('Syntetický QA podklad – žiadne reálne práva ani klient');
    await approvalForm.getByLabel(/Práva na zverejnenie textu a fotografií sú doložené/).check();
    await approvalForm.getByLabel(/Lokalita je bezpečne zovšeobecnená/).check();
    await approvalForm.getByLabel(/Obsah je pravdivý/).check();
    await approvalForm.getByRole('button', { name: 'Schváliť na zverejnenie' }).click();
    await adminPage.getByRole('button', { name: 'Zverejniť schválený prípad' }).waitFor();
    caseState = await pglite.query('SELECT lifecycle, publication_rights_confirmed, publication_location_confirmed, publication_content_confirmed FROM realization_case_drafts WHERE business_job_id=$1', [syntheticJobId]);
    assert.deepEqual(caseState.rows[0], { lifecycle: 'approved', publication_rights_confirmed: true, publication_location_confirmed: true, publication_content_confirmed: true },
      'publishing approval must require and record all three independent confirmations');
    const beforePublic = await localFetch(appOrigin + '/realizacie/');
    assert.equal(beforePublic.status, 200);
    assert.ok(!(await beforePublic.text()).includes(caseTitle), 'approved-but-not-published cases must stay off the public page');
    await adminPage.getByRole('button', { name: 'Zverejniť schválený prípad' }).click();
    await adminPage.getByText('Aktuálny stav:', { exact: false }).waitFor();
    await adminPage.waitForFunction(async (jobId) => {
      const response = await fetch('/realizacie/');
      return response.ok && (await response.text()).includes('Testovací prípad Poprad – nesmie ísť do produkcie');
    }, syntheticJobId, { timeout: 30_000 });
    const publicCasesResponse = await localFetch(appOrigin + '/realizacie/');
    const publicCasesHtml = await publicCasesResponse.text();
    assert.ok(publicCasesHtml.includes(caseTitle), 'published case must appear in the rendered realizations page');
    assert.ok(publicCasesHtml.includes('Poprad'), 'published case must expose only its approved approximate municipality');
    assert.ok(!publicCasesHtml.includes('nejde o zákazníka'), 'public case must not expose synthetic CRM customer data');
    const caseRow = await pglite.query('SELECT id FROM realization_case_drafts WHERE business_job_id=$1', [syntheticJobId]);
    const mapEntryHref = `href="#realizacia-${caseRow.rows[0].id}"`;
    assert.ok(publicCasesHtml.includes(mapEntryHref), 'published case must have a concrete map link to its realization card');
    caseState = await pglite.query('SELECT lifecycle FROM realization_case_drafts WHERE id=$1', [caseRow.rows[0].id]);
    assert.deepEqual(caseState.rows[0], { lifecycle: 'published' }, 'publishing action must persist the published lifecycle');
    const publicMediaResponse = await localFetch(appOrigin + '/api/realization-case-media/' + uploaded.id + '/');
    assert.equal(publicMediaResponse.status, 200, 'sanitized approved photo must be accessible while its case is published');
    assert.match(publicMediaResponse.headers.get('cache-control') || '', /no-store/i,
      'publicly approved case photos must still avoid persistent CDN/browser storage');
    await adminPage.getByRole('button', { name: 'Stiahnuť z verejnej stránky' }).click();
    await adminPage.getByText('Stiahnutý z webu', { exact: false }).waitFor();
    const withdrawnHtmlResponse = await localFetch(appOrigin + '/realizacie/');
    assert.equal(withdrawnHtmlResponse.status, 200);
    const withdrawnHtml = await withdrawnHtmlResponse.text();
    assert.ok(!withdrawnHtml.includes(caseTitle), 'withdrawn case must disappear from the public page');
    assert.ok(!withdrawnHtml.includes(mapEntryHref), 'withdrawn case must no longer have a map link');
    const withdrawnMediaResponse = await localFetch(appOrigin + '/api/realization-case-media/' + uploaded.id + '/');
    assert.equal(withdrawnMediaResponse.status, 404, 'withdrawn case photo must no longer use the public media route');
    caseState = await pglite.query('SELECT lifecycle FROM realization_case_drafts WHERE id=$1', [caseRow.rows[0].id]);
    assert.deepEqual(caseState.rows[0], { lifecycle: 'withdrawn' });

    // Verify that an admin reference remains a draft until edited with exact,
    // content-bound consent, and that hiding it removes it from public output.
    await adminPage.goto(appOrigin + '/admin/referencie/', { waitUntil: 'domcontentloaded' });
    await adminPage.getByRole('heading', { name: 'Referencie', exact: true }).waitFor();
    const referenceName = 'QA syntetický zákazník – nikdy nepublikovať v produkcii';
    const referenceText = 'Syntetická skúška redakčného toku referencií; nejde o skutočnú zákaznícku skúsenosť.';
    const createReferenceForm = adminPage.locator('form.admin-quote-form').last();
    await createReferenceForm.locator('input[name="customerName"]').fill(referenceName);
    await createReferenceForm.locator('input[name="location"]').fill('Izolované testovacie prostredie');
    await createReferenceForm.locator('input[name="customerEmail"]').fill('private-qa@example.invalid');
    await createReferenceForm.locator('textarea[name="text"]').fill(referenceText);
    await createReferenceForm.locator('select[name="status"]').selectOption('draft');
    await createReferenceForm.getByRole('button', { name: 'Uložiť referenciu' }).click();
    await adminPage.waitForFunction(() => new URL(location.href).searchParams.get('ulozene') === '1', { timeout: 30_000 });
    let referenceRow = await pglite.query('SELECT id, status, consent_publication FROM testimonials WHERE customer_name=$1', [referenceName]);
    assert.equal(referenceRow.rowCount, 1);
    assert.equal(referenceRow.rows[0].status, 'draft', 'admin-created reference must remain a private draft');
    assert.equal(referenceRow.rows[0].consent_publication, false, 'admin-created draft must not imply publication consent');
    const referenceId = String(referenceRow.rows[0].id);
    await adminPage.goto(appOrigin + '/admin/referencie/?edit=' + encodeURIComponent(referenceId), { waitUntil: 'domcontentloaded' });
    await adminPage.waitForLoadState('networkidle');
    const draftReviewResponse = await localFetch(appOrigin + '/recenzie/');
    assert.equal(draftReviewResponse.status, 200);
    const draftReviewHtml = await draftReviewResponse.text();
    assert.ok(!draftReviewHtml.includes(referenceName) && !draftReviewHtml.includes(referenceText),
      'draft reference content must remain absent from public output before approval');
    const editReferenceCard = adminPage.locator('article.admin-card').filter({ hasText: referenceName });
    const editReferenceForm = editReferenceCard.locator('form.admin-quote-form');
    assert.equal(await editReferenceForm.locator('input[name="id"]').inputValue(), referenceId,
      'reference edit form must target the exact synthetic draft selected for this workflow');
    const approvedReferenceName = 'QA upravená referencia – syntetické údaje';
    const approvedReferenceText = 'Upravená syntetická referencia určená iba na overenie izolovaného schválenia a skrytia.';
    await editReferenceForm.locator('select[name="status"]').selectOption('approved');
    assert.equal(await editReferenceForm.locator('select[name="status"]').inputValue(), 'approved',
      'the edit form must retain the selected approval state');
    await editReferenceForm.getByLabel(/Po úprave mám znovu doložený súhlas/).check();
    await editReferenceForm.locator('textarea[name="consentWording"]').fill('Syntetický QA súhlas určený výhradne na izolovaný test; nejde o súhlas skutočného zákazníka.');
    await editReferenceForm.locator('select[name="consentSource"]').selectOption({ label: 'osobne' });
    await editReferenceForm.locator('input[name="consentDate"]').fill('2026-10-01');
    await editReferenceForm.locator('input[name="customerName"]').fill(approvedReferenceName);
    await editReferenceForm.locator('textarea[name="text"]').fill(approvedReferenceText);
    assert.equal(await editReferenceForm.locator('textarea[name="text"]').inputValue(), approvedReferenceText,
      'browser must edit the selected draft text');
    const approvedFormPayload = await editReferenceForm.evaluate((form) => Object.fromEntries(new FormData(form).entries()));
    assert.equal(approvedFormPayload.status, 'approved', 'the serialized edit form must include the selected approval state');
    assert.equal(approvedFormPayload.customerName, approvedReferenceName, 'the serialized edit form must include the edited name');
    assert.equal(approvedFormPayload.text, approvedReferenceText, 'the serialized edit form must include the edited text');
    let resolveSubmittedReference;
    const submittedReference = new Promise((resolve) => { resolveSubmittedReference = resolve; });
    await adminPage.exposeFunction('astanaCaptureTestimonialSubmit', (payload) => resolveSubmittedReference(payload));
    await adminPage.evaluate((expectedId) => {
      document.addEventListener('submit', (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || !form.matches('form.admin-quote-form')
          || form.querySelector('input[name="id"]')?.value !== expectedId) return;
        const data = new FormData(form);
        void window.astanaCaptureTestimonialSubmit({
          status: String(data.get('status') || ''),
          customerName: String(data.get('customerName') || ''),
          text: String(data.get('text') || ''),
        });
      }, { capture: true, once: true });
    }, referenceId);
    await editReferenceForm.getByRole('button', { name: 'Uložiť zmeny' }).click();
    assert.deepEqual(await Promise.race([submittedReference, new Promise((resolve) => setTimeout(() => resolve(undefined), 10_000))]), {
      status: 'approved', customerName: approvedReferenceName, text: approvedReferenceText,
    }, 'the browser submit event must carry the exact approval state and edited content');
    await adminPage.waitForFunction(() => new URL(location.href).searchParams.get('ulozene') === '1', { timeout: 30_000 });
    referenceRow = await pglite.query('SELECT status, customer_name, text, customer_email, consent_publication, consent_evidence FROM testimonials WHERE id=$1', [referenceId]);
    assert.equal(referenceRow.rows[0].status, 'approved');
    assert.equal(referenceRow.rows[0].customer_name, approvedReferenceName);
    assert.equal(referenceRow.rows[0].text, approvedReferenceText);
    assert.equal(referenceRow.rows[0].customer_email, 'private-qa@example.invalid');
    assert.equal(referenceRow.rows[0].consent_publication, true);
    const expectedApprovedContentHash = createHash('sha256')
      .update(JSON.stringify([approvedReferenceName.trim(), 5, approvedReferenceText.trim()]), 'utf8')
      .digest('hex');
    assert.ok(referenceRow.rows[0].consent_evidence.includes(`Odtlačok schváleného znenia: ${expectedApprovedContentHash}\n`),
      'saved consent evidence must bind to the exact edited public name, rating, and text');
    const publicReviewResponse = await localFetch(appOrigin + '/recenzie/');
    assert.equal(publicReviewResponse.status, 200);
    const publicReviewHtml = await publicReviewResponse.text();
    assert.ok(publicReviewHtml.includes(approvedReferenceName) && publicReviewHtml.includes(approvedReferenceText),
      'approved consent-bound reference must be rendered publicly');
    assert.ok(!publicReviewHtml.includes('private-qa@example.invalid')
      && !publicReviewHtml.includes('Syntetický QA súhlas určený výhradne na izolovaný test; nejde o súhlas skutočného zákazníka.'),
      'private contact and exact consent evidence must never enter public HTML');
    const referenceCard = adminPage.locator('article.admin-card').filter({ hasText: approvedReferenceName });
    await referenceCard.getByRole('button', { name: 'Skryť' }).click();
    await adminPage.waitForFunction(async () => {
      const response = await fetch('/recenzie/');
      return response.ok && !(await response.text()).includes('QA upravená referencia – syntetické údaje');
    }, { timeout: 30_000 });
    referenceRow = await pglite.query('SELECT status FROM testimonials WHERE id=$1', [referenceId]);
    assert.deepEqual(referenceRow.rows[0], { status: 'hidden' }, 'admin hiding must persist and remove the testimonial from public output');

    // Simulate admin revocation in isolated SQL; existing signed browser
    // cookie must immediately lose access through real app routes.
    await pglite.query('UPDATE photo_upload_invites SET revoked_at = now() WHERE id = $1', [invites[0].id]);
    assert.ok((await first.cookies(appOrigin)).find((cookie) => cookie.name === cookieName)?.value === session.value,
      'revocation must be tested with the existing session cookie');
    await firstPage.reload({ waitUntil: 'networkidle' }); await firstPage.locator('#invite-code').waitFor();
    assert.equal(await firstPage.locator('.photo-intake-history').count(), 0);
    const firstInvitePrivateKeys = [invites[0].storageKey, uploaded.storage_key];
    const beforeRevokedByPath = new Map(firstInvitePrivateKeys.map((key) => [key, fake.privateGetByPath.get(key) || 0]));
    assert.equal((await mediaRead(firstPage, invites[0].mediaId)).status, 401);
    assert.equal((await mediaRead(firstPage, uploaded.id)).status, 401);
    for (const key of firstInvitePrivateKeys) {
      assert.equal(fake.privateGetByPath.get(key) || 0, beforeRevokedByPath.get(key),
        'revoked invite photo must be denied before its specific private Blob object is fetched');
    }
    assert.equal((await mediaRead(secondPage, invites[1].mediaId)).status, 200);
    for (const table of ['leads', 'lead_email_outbox']) {
      assert.equal((await pglite.query('SELECT COUNT(*)::int AS count FROM ' + table)).rows[0].count, 0);
    }
    assert.equal((await pglite.query('SELECT COUNT(*)::int AS count FROM business_jobs')).rows[0].count, 1,
      'only the explicitly synthetic completed job fixture may exist');
    assert.equal((await pglite.query('SELECT COUNT(*)::int AS count FROM realization_media_intake')).rows[0].count, 3);
    assert.equal(deniedOrigins.length, 0, 'unexpected external app browser traffic');
    summary = { result: 'PASS', invitesSeeded: 2, photosSeeded: 2, actualBrowserUploads: 1,
      mobileStates, mobilePreviewLoaded: mobileStates.every((state) => state.previewLoaded),
      mobileVisualEvidence: 'captured in owned temporary root; removed after test',
      adminPhotoModeration: 'actual UI and Server Actions', caseLifecycle: 'draft → reviewed → approved → published → withdrawn',
      publicCaseMapEntryRemovedAfterWithdrawal: true, publicPhotoRevokedAfterWithdrawal: true,
      testimonialWorkflow: 'draft → edit with content-bound consent → public allow-list → hidden',
      localityAndCategoriesPersisted: true, anonymousDenied: true, forgedSessionDenied: true,
      crossInviteDenied: true, revokedSessionDenied: true, consumedInviteReplayDenied: true,
      unsignedCallbackDenied: true, sanitizedPrivateCopy: fake.counts.serverPut === 1,
      multipart: fake.counts, leads: 0, syntheticJobs: 1, emails: 0, productionAccess: false };
  } catch (error) {
    console.error('Photo intake browser test failed:', error.message);
    console.error('Local Next diagnostics:', logs.join('').slice(-4500));
    throw error;
  } finally {
    for (const context of contexts) await context.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    await stopChild(child);
    if (blobServer) { blobServer.closeAllConnections(); await new Promise((resolve) => blobServer.close(resolve)); }
    await socket?.stop(); await pglite?.close();
    const ownedRoot = assertOwnedTempRoot(tempRoot);
    assert.equal((await realpath(ownedRoot)).toLowerCase(), ownedRoot.toLowerCase(), 'temp root cannot be a symlink');
    assert.equal(await readFile(path.join(ownedRoot, '.harness-owner'), 'utf8'), owner);
    const moduleLink = path.join(ownedRoot, 'node_modules'), linkStat = await lstat(moduleLink).catch(() => null);
    if (linkStat) {
      assert.ok(linkStat.isSymbolicLink(), 'dependency path must be a junction');
      assert.equal((await realpath(moduleLink)).toLowerCase(), (await realpath(path.join(projectRoot, 'node_modules'))).toLowerCase());
      await unlink(moduleLink);
    }
    await rm(ownedRoot, { recursive: true, force: true, maxRetries: 12, retryDelay: 500 });
    assert.equal(existsSync(ownedRoot), false, 'owned temp root removed');
    console.log('Cleanup PASS: owned temp root removed: ' + ownedRoot);
  }
  console.log(JSON.stringify({ ...summary, ownedTempRootRemoved: true }));
}
