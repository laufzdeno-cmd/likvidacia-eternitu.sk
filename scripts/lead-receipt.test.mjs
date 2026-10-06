import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { createLeadReceiptToken, verifyLeadReceiptToken } = require('../src/server/lead-receipt.ts');

test('signed receipt confirms only server-issued accepted submissions', () => {
  const token = createLeadReceiptToken(true, 'receipt-test-secret', 1_800_000_000_000);
  assert.deepEqual(verifyLeadReceiptToken(token, 'receipt-test-secret', 1_800_000_000_001), {
    accepted: true,
    emailSent: true,
  });
  assert.equal(verifyLeadReceiptToken(token, 'different-secret', 1_800_000_000_001), null);
});

test('signed receipt rejects tampering, malformed tokens, expiry, and implausible issue times', () => {
  const now = 1_800_000_000_000;
  const token = createLeadReceiptToken(false, 'receipt-test-secret', now);
  const [payload, signature] = token.split('.');
  const tampered = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}.${signature}`;

  assert.equal(verifyLeadReceiptToken(tampered, 'receipt-test-secret', now + 1), null);
  assert.equal(verifyLeadReceiptToken('not-a-token', 'receipt-test-secret', now + 1), null);
  assert.equal(verifyLeadReceiptToken(token, 'receipt-test-secret', now + 10 * 60_000), null);
  assert.equal(verifyLeadReceiptToken(createLeadReceiptToken(true, 'receipt-test-secret', now + 30_001), 'receipt-test-secret', now), null);
  assert.equal(verifyLeadReceiptToken(token, '', now + 1), null);
});

test('production receipts require the configured server secret', () => {
  assert.throws(() => createLeadReceiptToken(true, ''), /AUTH_SECRET is required/);
});
