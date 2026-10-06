import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { createTestimonialReceiptToken, testimonialReceiptSecret, verifyTestimonialReceiptToken } = require('../src/server/testimonial-receipt.ts');
const { createLeadReceiptToken } = require('../src/server/lead-receipt.ts');

test('only a short-lived server-signed testimonial receipt confirms a native form submission', () => {
  const now = 1_800_000_000_000;
  const token = createTestimonialReceiptToken('review-test-secret', now);
  assert.equal(verifyTestimonialReceiptToken(token, 'review-test-secret', now + 1), true);
  assert.equal(verifyTestimonialReceiptToken(token, 'another-secret', now + 1), false);
  assert.equal(verifyTestimonialReceiptToken(token, 'review-test-secret', now + 10 * 60_000), false);
  assert.equal(verifyTestimonialReceiptToken(token, 'review-test-secret', now - 30_001), false);
  assert.equal(verifyTestimonialReceiptToken('1', 'review-test-secret', now), false);
  const [payload, signature] = token.split('.');
  assert.equal(verifyTestimonialReceiptToken(`${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}.${signature}`, 'review-test-secret', now), false);
  assert.equal(verifyTestimonialReceiptToken(createLeadReceiptToken(false, 'review-test-secret', now), 'review-test-secret', now), false);
  assert.deepEqual(Object.keys(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))).sort(), ['expiresAt', 'issuedAt', 'nonce', 'purpose', 'v']);
});

test('production testimonial confirmation needs the configured server secret', () => {
  assert.equal(testimonialReceiptSecret('production', ''), '');
  assert.throws(() => createTestimonialReceiptToken(''), /AUTH_SECRET/);
});
