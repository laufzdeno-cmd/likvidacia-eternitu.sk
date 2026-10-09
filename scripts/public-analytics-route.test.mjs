import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { NextRequest } from 'next/server';
import { AnalyticsBodyTooLargeError, readAnalyticsRequestBody } from '../src/server/analytics-request-body.ts';
import { publicAnalyticsPayloadSchema } from '../src/server/public-analytics-policy.ts';
import { carryConsentedCampaignParameters } from '../src/lib/attribution-touch.ts';

// The real route is imported only after isolating all storage from inherited env.
const temporaryDirectory = await mkdtemp(path.join(process.cwd(), '.tmp-astana-analytics-route-'));
const databasePath = path.join(temporaryDirectory, 'local-db.json');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.ASTANA_LOCAL_DB_PATH = databasePath;
process.env.ADMIN_EMAIL = '';
process.env.ALLOWED_ORIGINS = 'https://example.invalid';
process.env.AUTH_SECRET = 'isolated-analytics-route-test';
const routeImport = await import('../app/api/analytics/route.ts');
const { POST } = routeImport.default ?? routeImport;
after(async () => {
  assert.equal(path.dirname(temporaryDirectory), process.cwd());
  assert.ok(path.basename(temporaryDirectory).startsWith('.tmp-astana-analytics-route-'));
  await rm(temporaryDirectory, { recursive: true, force: true });
});

const limit = 16 * 1024;
const encoder = new TextEncoder();
const base = { sessionId: randomUUID(), eventType: 'page_view', path: '/', device: 'mobile', metadata: {} };
function request(body, { ip = '192.0.2.1', consent = 'granted', marketing = 'denied', origin = 'https://example.invalid', headers = {} } = {}) {
  return new NextRequest('https://example.invalid/api/analytics/', {
    method: 'POST', body,
    headers: {
      ...(origin ? { origin } : {}),
      'x-vercel-forwarded-for': ip,
      cookie: `astana_analytics_consent=${consent}; astana_marketing_consent=${marketing}`,
      ...headers,
    },
  });
}
async function events() {
  try { return JSON.parse(await readFile(databasePath, 'utf8')).analyticsEvents || []; }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function unreadBody(req) {
  Object.defineProperty(req, 'body', { get() { throw new Error('body must not be read'); } });
  return req;
}

test('bounded reader counts UTF-8 bytes, not characters, across arbitrary chunks', async () => {
  for (const text of ['x'.repeat(limit), 'á'.repeat(limit / 2)]) {
    const bytes = encoder.encode(text);
    let offset = 0;
    const body = new ReadableStream({ pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      const nextOffset = Math.min(bytes.length, offset + 7);
      controller.enqueue(bytes.slice(offset, nextOffset));
      offset = nextOffset;
    } }, { highWaterMark: 0 });
    assert.equal(await readAnalyticsRequestBody({ body }, limit), text);
  }
  for (const text of ['x'.repeat(limit + 1), `${'á'.repeat(limit / 2)}x`]) {
    let reads = 0;
    let cancelled = false;
    const body = new ReadableStream({
      pull(controller) {
        reads += 1;
        controller.enqueue(reads === 1 ? encoder.encode(text) : new Uint8Array(limit));
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    await assert.rejects(readAnalyticsRequestBody({ body }, limit), AnalyticsBodyTooLargeError);
    assert.equal(reads, 1, 'oversized chunk must not trigger another read');
    assert.equal(cancelled, true);
    assert.equal(body.locked, false);
  }
});

test('actual browser beacon and fetch campaign payloads pass the server schema', async () => {
  const engineImport = await import('../src/lib/analytics-event-engine.ts');
  const { trackAnalyticsEvent } = engineImport.default ?? engineImport;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalFetch = globalThis.fetch;
  try {
    for (const useBeacon of [true, false]) {
      const storage = new Map();
      const sent = [];
      globalThis.window = {
        location: { pathname: '/cena/', hash: '#dopyt', search: '' }, innerWidth: 390,
        sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        crypto: { randomUUID }, addEventListener() {},
      };
      globalThis.document = { cookie: 'astana_analytics_consent=granted; astana_marketing_consent=granted', referrer: '' };
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
        sendBeacon: useBeacon ? (_url, blob) => { sent.push(blob.text()); return true; } : undefined,
      } });
      globalThis.fetch = async (_url, options) => { sent.push(Promise.resolve(options.body)); return new Response(); };
      for (const search of ['', '?utm_source=google', '?utm_source=google&utm_content=roof&utm_term=azbest&utm_id=123', '?gclid=click-only', `?gclid=${'g'.repeat(512)}`, `?utm_source=${'s'.repeat(160)}&utm_campaign=${'c'.repeat(160)}&utm_term=${'t'.repeat(160)}`]) {
        storage.clear();
        window.location.search = search;
        trackAnalyticsEvent('page_view');
        const payload = JSON.parse(await sent.at(-1));
        assert.equal(publicAnalyticsPayloadSchema.safeParse(payload).success, true, `${useBeacon ? 'beacon' : 'fetch'} ${search}`);
        if (search) assert.equal(payload.landingPath, '/cena/');
        if (search.includes('utm_content')) assert.equal(payload.utmContent, 'roof');
        if (search.includes('gclid')) assert.equal(payload.metadata.adClickIds.gclid, new URLSearchParams(search).get('gclid'));
        const sourceUrl = new URL(`https://example.invalid/cena/${search}`);
        const targetUrl = new URL('https://example.invalid/#dopyt');
        carryConsentedCampaignParameters(sourceUrl, targetUrl, { analytics: true, marketing: true });
        trackAnalyticsEvent('cta_click', { label: 'Získať ponuku', href: targetUrl.href });
        const ctaPayload = JSON.parse(await sent.at(-1));
        const ctaParsed = publicAnalyticsPayloadSchema.safeParse(ctaPayload);
        assert.equal(ctaParsed.success, true, `forwarded CTA ${search}`);
        assert.equal(ctaParsed.data.metadata.href, 'https://example.invalid/#dopyt');
        assert.equal((await POST(request(JSON.stringify(ctaPayload)))).status, 200);
        window.location.search = '';
        window.location.pathname = '/realizacie/';
        trackAnalyticsEvent('gallery_filter', { gallery: 'realizacie', category: 'Vlnitý eternit' });
        const carried = JSON.parse(await sent.at(-1));
        assert.equal(publicAnalyticsPayloadSchema.safeParse(carried).success, true);
        if (search) assert.equal(carried.landingPath, '/cena/');
        window.location.pathname = '/cena/';
      }
    }
  } finally {
    delete globalThis.window;
    delete globalThis.document;
    globalThis.fetch = originalFetch;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});

test('route accepts campaign shapes, but persists click IDs only with marketing consent', async () => {
  for (const marketing of ['denied', 'granted']) {
    const payload = { ...base, sessionId: randomUUID(), utmSource: 'google', utmContent: 'roof', utmTerm: 'azbest', utmId: '123', landingPath: '/cena/', metadata: { href: '/?gclid=synthetic-click#dopyt', adClickIds: { gclid: 'synthetic-click' } } };
    assert.equal((await POST(request(JSON.stringify(payload), { marketing }))).status, 200);
    const stored = (await events()).find(event => event.sessionId === payload.sessionId);
    assert.ok(stored);
    assert.equal(stored.utmSource, 'google');
    assert.equal(stored.metadata.adClickIds?.gclid, marketing === 'granted' ? 'synthetic-click' : undefined);
    assert.equal(stored.metadata.href, '/#dopyt');
  }
});

test('origin, consent, limiter failures and quota rejection happen before reading the body', async () => {
  const before = (await events()).length;
  assert.equal((await POST(unreadBody(request('x', { origin: 'https://evil.invalid' })))).status, 403);
  assert.deepEqual(await (await POST(unreadBody(request('x', { consent: 'denied' })))).json(), { ok: true, skipped: true });
  process.env.NODE_ENV = 'production';
  try {
    assert.equal((await POST(unreadBody(request('x', { origin: null })))).status, 403);
    assert.equal((await POST(unreadBody(request('x', { ip: 'invalid' })))).status, 503);
  } finally { process.env.NODE_ENV = 'test'; }
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const body = attempt % 3 === 0 ? 'not-json' : attempt % 3 === 1 ? JSON.stringify({ ...base, sessionId: randomUUID(), eventType: 'form_submit_success' }) : 'x'.repeat(limit + 1);
    const expected = attempt % 3 === 2 ? 413 : 400;
    assert.equal((await POST(request(body, { ip: '192.0.2.81' }))).status, expected);
  }
  assert.equal((await POST(unreadBody(request(JSON.stringify({ ...base, sessionId: randomUUID() }), { ip: '192.0.2.81' })))).status, 429);
  assert.equal((await events()).length, before, 'denied, malformed, oversized and rate-limited input never persists');
});

test('actual route enforces byte boundaries without trusting Content-Length', async () => {
  const json = JSON.stringify(base);
  const atLimit = json + ' '.repeat(limit - encoder.encode(json).length);
  assert.equal((await POST(request(atLimit))).status, 200);
  for (const headers of [{}, { 'content-length': '1' }, { 'content-length': String(limit) }]) {
    assert.equal((await POST(request(`${atLimit} `, { headers }))).status, 413);
  }
  let cancelled = false;
  let reads = 0;
  const streamed = new ReadableStream({
    pull(controller) { reads += 1; controller.enqueue(new Uint8Array(reads === 1 ? limit : 1)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const streamedRequest = request('placeholder');
  Object.defineProperty(streamedRequest, 'body', { value: streamed });
  assert.equal((await POST(streamedRequest)).status, 413);
  assert.equal(reads, 2);
  assert.equal(cancelled, true);
});
