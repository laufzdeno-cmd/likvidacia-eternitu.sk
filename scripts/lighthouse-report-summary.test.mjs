import assert from 'node:assert/strict';
import test from 'node:test';
import {
  safeLighthousePath,
  summarizeLighthouseAudit,
  summarizeLighthouseLcpBreakdown,
  summarizeLighthouseNode,
} from './lighthouse-report-summary.mjs';

test('S08 Lighthouse report summaries retain diagnostics without private text or external paths', () => {
  const audit = summarizeLighthouseAudit({
    score: 0.5,
    displayValue: 'private@example.com?session=secret',
    details: { items: [{
      label: 'private@example.com',
      url: 'http://localhost:3000/assets/image.webp?token=private#fragment',
      selector: '#private-contact',
      snippet: '<p>private@example.com</p>',
      wastedBytes: 123,
    }] },
  }, 'http://localhost:3000');
  const phases = summarizeLighthouseLcpBreakdown([
    { label: 'Resource load delay', duration: 321 },
    { label: 'private@example.com?session=secret', duration: 42 },
  ]);
  const serialized = JSON.stringify({ audit, phases });
  for (const secret of ['private@example.com', 'session=secret', 'token=private', '#fragment', '#private-contact']) {
    assert.ok(!serialized.includes(secret), `diagnostic report leaked ${secret}`);
  }
  assert.equal(audit.items[0].urlPath, '/assets/[asset]');
  assert.deepEqual(phases, [
    { phase: 'resource-delay', durationMs: 321 },
    { phase: 'other', durationMs: 42 },
  ]);
  assert.equal(safeLighthousePath('https://outside.invalid/private?token=secret', 'http://localhost:3000'), '[blocked-origin]');
  assert.deepEqual(summarizeLighthouseNode({
    snippet: '<h1 class="private@example.com">Private customer text</h1>',
    boundingRect: { width: 320.4, height: 87.7 },
  }), { tag: 'h1', width: 320, height: 88 });
});

test('S08 report string lengths are bounded and artifact capture rejects the first byte past its budget', async () => {
  const longPath = `http://localhost:3000/${'a'.repeat(4000)}?private=secret`;
  assert.equal(safeLighthousePath(longPath, 'http://localhost:3000'), '[local-resource]');
  assert.equal(safeLighthousePath('http://localhost:3000/uchadz/meno@example.com?token=secret', 'http://localhost:3000'), '[local-resource]');
  assert.equal(safeLighthousePath('http://localhost:3000/kariera/?token=secret', 'http://localhost:3000'), '/kariera/');
  const { exceedsTextCaptureLimit } = await import('./bounded-text-capture.mjs');
  assert.equal(exceedsTextCaptureLimit(3, 2, 5), false);
  assert.equal(exceedsTextCaptureLimit(3, 3, 5), true);
  assert.equal(exceedsTextCaptureLimit(0, 1, Number.NaN), true);
});

test('S08 preserves only the five public audit routes and generalizes every local asset path', () => {
  const origin = 'http://localhost:3000';
  for (const route of [
    '/',
    '/cena-likvidacie-azbestu/',
    '/realizacie/',
    '/poradna/co-je-eternit-a-kedy-obsahuje-azbest/',
    '/kariera/',
  ]) {
    assert.equal(safeLighthousePath(`${origin}${route}?token=private`, origin), route);
  }
  assert.equal(safeLighthousePath(`${origin}/_next/static/chunks/secret-name.js`, origin), '/_next/static/[asset]');
  assert.equal(safeLighthousePath(`${origin}/_next/image?url=private`, origin), '/_next/image');
  assert.equal(safeLighthousePath(`${origin}/assets/name@example.com.png`, origin), '/assets/[asset]');
  assert.equal(safeLighthousePath(`${origin}/fonts/private-user.woff2`, origin), '/fonts/[asset]');
  assert.equal(safeLighthousePath(`${origin}/private/name@example.com/`, origin), '[local-resource]');
  assert.equal(safeLighthousePath('https://outside.invalid/private', origin), '[blocked-origin]');
});
