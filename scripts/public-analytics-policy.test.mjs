import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  analyticsOriginAllowed,
  publicAnalyticsPayloadSchema,
} from '../src/server/public-analytics-policy.ts';

const validPayload = {
  sessionId: '6d8b6044-5f9d-4fd2-ae4e-8a36c2df8166',
  eventType: 'page_view',
  path: '/realizacie/#galeria',
  referrer: 'https://www.google.com',
  device: 'mobile',
  viewportWidth: 390,
  utmSource: 'google',
  utmMedium: 'cpc',
  utmCampaign: 'azbest',
  metadata: {},
};

test('production analytics requires an explicitly allowed browser origin', () => {
  const allowed = 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk';
  assert.equal(analyticsOriginAllowed(null, 'production', allowed), false);
  assert.equal(analyticsOriginAllowed('https://evil.example', 'production', allowed), false);
  assert.equal(analyticsOriginAllowed('https://likvidacia-eternitu.sk', 'production', allowed), true);
  assert.equal(analyticsOriginAllowed(null, 'test', allowed), true);
});

test('all payload shapes emitted by current public clients remain accepted', () => {
  for (const variant of [
    validPayload,
    { ...validPayload, landingPath: '/cena/' },
    { ...validPayload, landingPath: '/cena/', utmContent: 'strecha', utmTerm: 'azbest', utmId: 'campaign-123' },
    { ...validPayload, eventType: 'cta_click', metadata: { label: 'Získať ponuku', href: '/#dopyt' } },
    { ...validPayload, eventType: 'gallery_filter', metadata: { gallery: 'realizacie', category: 'Vlnitý eternit' } },
    { ...validPayload, eventType: 'price_calculator_change', metadata: { material: 'VLNITY', area: '120' } },
    { ...validPayload, eventType: 'roofer_registration_success', metadata: { form: 'roofer_registration' } },
    { ...validPayload, metadata: { adClickIds: { gclid: 'test-click-id', wbraid: 'test-wbraid' } } },
  ]) assert.equal(publicAnalyticsPayloadSchema.safeParse(variant).success, true);
});

test('public analytics rejects forged conversions and unbounded or malformed input', () => {
  for (const invalid of [
    { ...validPayload, eventType: 'form_submit_success' },
    { ...validPayload, sessionId: 'not-a-uuid' },
    { ...validPayload, path: 'https://evil.example/' },
    { ...validPayload, device: 'television' },
    { ...validPayload, viewportWidth: 100_000 },
    { ...validPayload, metadata: { unexpected: 'stored forever' } },
    { ...validPayload, metadata: { adClickIds: { gclid: 'x', nested: { arbitrary: true } } } },
    { ...validPayload, extraTopLevelField: true },
  ]) assert.equal(publicAnalyticsPayloadSchema.safeParse(invalid).success, false);
});

test('accepted analytics lengths match storage and attribution limits without silent truncation', () => {
  for (const field of ['utmContent', 'utmTerm', 'utmId']) {
    assert.equal(publicAnalyticsPayloadSchema.safeParse({ ...validPayload, [field]: 'u'.repeat(160) }).success, true);
    assert.equal(publicAnalyticsPayloadSchema.safeParse({ ...validPayload, [field]: 'u'.repeat(161) }).success, false);
  }
  assert.equal(publicAnalyticsPayloadSchema.safeParse({ ...validPayload, landingPath: `/${'p'.repeat(299)}` }).success, true);
  for (const landingPath of [`/${'p'.repeat(300)}`, '//evil.example', '/?private=data', '/#private', '/\\evil.example']) {
    assert.equal(publicAnalyticsPayloadSchema.safeParse({ ...validPayload, landingPath }).success, false);
  }
  assert.equal(publicAnalyticsPayloadSchema.safeParse({ ...validPayload, path: `/${'p'.repeat(499)}` }).success, true);
  assert.equal(publicAnalyticsPayloadSchema.safeParse({ ...validPayload, path: `/${'p'.repeat(500)}` }).success, false);
  assert.equal(publicAnalyticsPayloadSchema.safeParse({ ...validPayload, utmCampaign: 'c'.repeat(160) }).success, true);
  assert.equal(publicAnalyticsPayloadSchema.safeParse({ ...validPayload, utmCampaign: 'c'.repeat(161) }).success, false);
  assert.equal(publicAnalyticsPayloadSchema.safeParse({
    ...validPayload,
    metadata: { adClickIds: { gclid: 'g'.repeat(512) } },
  }).success, true);
  assert.equal(publicAnalyticsPayloadSchema.safeParse({
    ...validPayload,
    metadata: { adClickIds: { gclid: 'g'.repeat(513) } },
  }).success, false);
});

test('campaign-decorated CTA links retain a bounded target without duplicating private query data', () => {
  for (const href of [`/?gclid=${'g'.repeat(512)}#dopyt`, `/?utm_campaign=${'c'.repeat(160)}&utm_content=${'u'.repeat(160)}&utm_term=${'t'.repeat(160)}#dopyt`]) {
    assert.equal(publicAnalyticsPayloadSchema.parse({ ...validPayload, metadata: { href } }).metadata.href, '/#dopyt');
  }
  for (const href of ['tel:0905217946', '#dopyt', '/#dopyt', '/cena/']) {
    assert.equal(publicAnalyticsPayloadSchema.parse({ ...validPayload, metadata: { href } }).metadata.href, href);
  }
  for (const href of [`/${'p'.repeat(500)}`, `/?${'q'.repeat(16 * 1024)}`]) {
    assert.equal(publicAnalyticsPayloadSchema.safeParse({ ...validPayload, metadata: { href } }).success, false);
  }
});

test('analytics route uses bounded bodies and the shared trusted-IP limiter', async () => {
  const route = await readFile(new URL('../app/api/analytics/route.ts', import.meta.url), 'utf8');
  assert.match(route, /maximumBodyBytes = 16 \* 1024/);
  assert.match(route, /readAnalyticsRequestBody\(request, maximumBodyBytes\)/);
  assert.doesNotMatch(route, /request\.(?:text|json|arrayBuffer)\(/);
  assert.ok(route.indexOf("'analytics-event-address'") < route.indexOf('await readAnalyticsRequestBody('));
  assert.match(route, /consumeSharedRateLimit\(\s*'analytics-event-address',\s*trustedRateLimitClientIp\(request\.headers\),\s*80,\s*60_000/);
  assert.doesNotMatch(route, /new Map|x-forwarded-for/);
});
