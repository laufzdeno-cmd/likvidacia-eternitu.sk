import { createHash, createHmac } from 'node:crypto';

const uuidNamespace = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
export const nativeLeadRetryWindowMs = 6 * 60 * 60_000;

export function createNativeLeadSubmissionId(fingerprint: string, secret: string, now = Date.now()) {
  if (!secret) throw new Error('AUTH_SECRET is required for native lead retries.');
  const retryWindow = Math.floor(now / nativeLeadRetryWindowMs);
  const keyedFingerprint = createHmac('sha256', secret)
    .update(`native-lead-retry:v1:${retryWindow}:${fingerprint}`)
    .digest();
  const bytes = createHash('sha1').update(uuidNamespace).update(keyedFingerprint).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
