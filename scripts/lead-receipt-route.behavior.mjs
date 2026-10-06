import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

// DB URL is captured at module import. Isolate it before importing either route,
// so this synthetic test cannot accidentally connect to a real database.
const inheritedDatabaseUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;
const receiptRouteImport = await import('../app/api/lead/receipt/route.ts');
const confirmationRouteImport = await import('../app/dopyt-prijaty/route.ts');
const receiptModuleImport = await import('../src/server/lead-receipt.ts');
const receiptRoute = receiptRouteImport.default ?? receiptRouteImport;
const confirmationRoute = confirmationRouteImport.default ?? confirmationRouteImport;
const receiptModule = receiptModuleImport.default ?? receiptModuleImport;

const { GET } = receiptRoute;
const { GET: confirmationPage } = confirmationRoute;
const { createLeadReceiptToken } = receiptModule;

test('a signed accepted-lead receipt remains verifiable without the database limiter', async () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    authSecret: process.env.AUTH_SECRET,
  };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    process.env.AUTH_SECRET = 'local-receipt-route-behavior-test-secret';

    const token = createLeadReceiptToken(false, process.env.AUTH_SECRET);
    const request = new NextRequest(`https://example.invalid/api/lead/receipt/?token=${encodeURIComponent(token)}`);
    const response = await GET(request);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { accepted: true, emailSent: false });

    for (let attempt = 0; attempt < 19; attempt += 1) {
      assert.equal((await GET(request)).status, 200, 'ordinary receipt retries stay available');
    }
    assert.equal((await GET(request)).status, 429, 'a replayed valid token is bounded when DB is unavailable');

    const invalidRequest = new NextRequest('https://example.invalid/api/lead/receipt/?token=invalid', {
      headers: { 'x-vercel-forwarded-for': '203.0.113.17' },
    });
    const invalidResponse = await GET(invalidRequest);
    assert.equal(invalidResponse.status, 503, 'invalid tokens still fail closed when the DB limiter is unavailable');
    assert.deepEqual(await invalidResponse.json(), { accepted: false });

    const pageToken = createLeadReceiptToken(true, process.env.AUTH_SECRET);
    const page = await confirmationPage(new NextRequest(
      `https://example.invalid/dopyt-prijaty/?dopyt_receipt=${encodeURIComponent(pageToken)}`,
    ));
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
    assert.match(page.headers.get('x-robots-tag') || '', /noindex/);
    const html = await page.text();
    assert.match(html, /Dopyt sme prijali/);
    assert.match(html, /potvrdenie odoslali/);
    assert.doesNotMatch(html, /@|name="email"/);

    const invalidPage = await confirmationPage(new NextRequest('https://example.invalid/dopyt-prijaty/?dopyt_receipt=invalid', {
      headers: { 'x-vercel-forwarded-for': '203.0.113.18' },
    }));
    assert.equal(invalidPage.status, 503, 'invalid HTML receipts fail closed if the shared limiter is down');
    assert.doesNotMatch(await invalidPage.text(), /<h1>Dopyt sme prijali<\/h1>/);
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.databaseUrl;
    if (previous.authSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous.authSecret;
    if (inheritedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = inheritedDatabaseUrl;
  }
});

test('invalid HTML receipts share a bounded request quota', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;
    const request = new NextRequest('https://example.invalid/dopyt-prijaty/?dopyt_receipt=invalid', {
      headers: { 'x-vercel-forwarded-for': '203.0.113.19' },
    });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      assert.equal((await confirmationPage(request)).status, 404);
    }
    assert.equal((await confirmationPage(request)).status, 429);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
