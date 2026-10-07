import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

process.env.NEXT_PUBLIC_META_PIXEL_ID = '123456789012345';
process.env.META_CAPI_ACCESS_TOKEN = 'unit-test-secret';
process.env.META_GRAPH_API_VERSION = 'v99.0';
process.env.CONVERSION_EVENT_SECRET = 'unit-test-conversion-event-secret';

const { sendMetaLeadEvent } = await import('../src/server/meta-conversions-api.ts');

const input = {
  id: '5d91a5da-23ba-4b36-a183-b1de59575891',
  leadId: 'b68ce2cf-a275-48ce-ab33-fe61b375b880',
  eventId: `lead:${'a'.repeat(64)}`,
  eventTime: '2026-10-07T08:00:00.000Z',
  eventSourceUrl: 'https://likvidacia-eternitu.sk/cena-likvidacie-azbestu/',
  material: 'vlnity',
  attempt: 1,
  claimId: '7ba04810-2e96-46aa-b508-eab9d34137f0',
  email: 'Customer@Example.com ',
  phone: '0905 123 456',
  clientUserAgent: 'Mock browser',
};

test('Meta request contains hashes and stable event ID, never raw contact data', async () => {
  let captured;
  const result = await sendMetaLeadEvent(input, { fetchImpl: async (url, init) => {
    captured = { url: String(url), init };
    return new Response('{"events_received":1}', { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  assert.deepEqual(result, { status: 'sent', httpStatus: 200, retryable: false });
  assert.match(captured.url, /graph\.facebook\.com\/v99\.0\/123456789012345\/events$/);
  const bodyText = String(captured.init.body);
  const body = JSON.parse(bodyText);
  assert.equal(body.data[0].event_id, input.eventId);
  assert.deepEqual(body.data[0].user_data.em, [createHash('sha256').update('customer@example.com').digest('hex')]);
  assert.deepEqual(body.data[0].user_data.ph, [createHash('sha256').update('421905123456').digest('hex')]);
  assert.doesNotMatch(bodyText, /Customer@Example\.com|0905 123 456/);
});

test('retryable provider rejection and ambiguous transport are distinguished', async () => {
  const unavailable = await sendMetaLeadEvent(input, { fetchImpl: async () => new Response('{"error":{"code":2,"error_subcode":99,"message":"must not be stored"}}', { status: 503 }) });
  assert.deepEqual(unavailable, { status: 'failed', httpStatus: 503, retryable: true, errorCode: 'meta_unavailable_2_99' });
  const rejected = await sendMetaLeadEvent(input, { fetchImpl: async () => new Response('{"error":{"code":190,"error_subcode":463,"message":"secret details"}}', { status: 400 }) });
  assert.deepEqual(rejected, { status: 'failed', httpStatus: 400, retryable: false, errorCode: 'meta_rejected_190_463' });
  const unknown = await sendMetaLeadEvent(input, { fetchImpl: async () => { throw new Error('mock network loss'); } });
  assert.deepEqual(unknown, { status: 'unknown', retryable: true, errorCode: 'transport_unknown' });
});

test('HTTP 2xx is sent only after Meta positively acknowledges at least one event', async () => {
  for (const body of ['{}', '{"events_received":0}', '{"events_received":"1"}', 'not-json']) {
    const result = await sendMetaLeadEvent(input, { fetchImpl: async () => new Response(body, { status: 200 }) });
    assert.deepEqual(result, { status: 'unknown', httpStatus: 200, retryable: true, errorCode: 'provider_unavailable' });
  }
  const accepted = await sendMetaLeadEvent(input, { fetchImpl: async () => new Response('{"events_received":2}', { status: 202 }) });
  assert.deepEqual(accepted, { status: 'sent', httpStatus: 202, retryable: false });
});

test('cron route rejects missing or wrong secret and fails closed when transport is not configured', async () => {
  process.env.CRON_SECRET = 'isolated-cron-secret';
  const { GET } = await import('../app/api/cron/meta-capi/route.ts');
  const missing = await GET(new Request('http://localhost/api/cron/meta-capi'));
  assert.equal(missing.status, 401);
  const wrong = await GET(new Request('http://localhost/api/cron/meta-capi', { headers: { authorization: 'Bearer wrong' } }));
  assert.equal(wrong.status, 401);
  const saved = {
    pixel: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    token: process.env.META_CAPI_ACCESS_TOKEN,
    version: process.env.META_GRAPH_API_VERSION,
    conversionSecret: process.env.CONVERSION_EVENT_SECRET,
  };
  delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  delete process.env.META_CAPI_ACCESS_TOKEN;
  delete process.env.META_GRAPH_API_VERSION;
  const unconfigured = await GET(new Request('http://localhost/api/cron/meta-capi', { headers: { authorization: 'Bearer isolated-cron-secret' } }));
  assert.equal(unconfigured.status, 503);
  assert.deepEqual(await unconfigured.json(), { ok: false, code: 'META_CAPI_NOT_CONFIGURED' });
  process.env.NEXT_PUBLIC_META_PIXEL_ID = saved.pixel;
  process.env.META_CAPI_ACCESS_TOKEN = saved.token;
  process.env.META_GRAPH_API_VERSION = saved.version;
  delete process.env.CONVERSION_EVENT_SECRET;
  const missingConversionSecret = await GET(new Request('http://localhost/api/cron/meta-capi', { headers: { authorization: 'Bearer isolated-cron-secret' } }));
  assert.equal(missingConversionSecret.status, 503);
  assert.deepEqual(await missingConversionSecret.json(), { ok: false, code: 'META_CAPI_NOT_CONFIGURED' });
  process.env.CONVERSION_EVENT_SECRET = saved.conversionSecret;
});

test('consent revocation route rejects cross-origin requests and clears an invalid subject safely', async () => {
  const { NextRequest } = await import('next/server');
  const { POST } = await import('../app/api/marketing-consent/revoke/route.ts');
  const crossOrigin = await POST(new NextRequest('https://likvidacia-eternitu.sk/api/marketing-consent/revoke/', {
    method: 'POST',
    headers: { origin: 'https://example.invalid', cookie: 'astana_marketing_consent_subject=not-valid' },
  }));
  assert.equal(crossOrigin.status, 403);
  const safeInvalid = await POST(new NextRequest('https://likvidacia-eternitu.sk/api/marketing-consent/revoke/', {
    method: 'POST',
    headers: { origin: 'https://likvidacia-eternitu.sk', cookie: 'astana_marketing_consent_subject=not-valid' },
  }));
  assert.equal(safeInvalid.status, 200);
  assert.deepEqual(await safeInvalid.json(), { ok: true, revoked: 0 });
  assert.match(safeInvalid.headers.get('set-cookie') || '', /astana_marketing_consent_subject=;.*Max-Age=0/i);
});
