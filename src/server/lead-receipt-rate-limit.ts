import { createHash } from 'node:crypto';
import { consumeSharedRateLimit } from './shared-rate-limit';

const windowMs = 60_000;
const maxChecksPerToken = 20;
const maxLocalBuckets = 5_000;
const localBuckets = new Map<string, { count: number; windowStart: number }>();

function localLimit(token: string, now = Date.now()) {
  const key = createHash('sha256').update(token).digest('hex');
  const windowStart = Math.floor(now / windowMs) * windowMs;
  for (const [bucketKey, bucket] of localBuckets) {
    if (bucket.windowStart !== windowStart) localBuckets.delete(bucketKey);
  }
  const bucket = localBuckets.get(key);
  if (bucket) {
    bucket.count += 1;
    return bucket.count > maxChecksPerToken;
  }
  if (localBuckets.size >= maxLocalBuckets) {
    const oldestKey = localBuckets.keys().next().value;
    if (oldestKey) localBuckets.delete(oldestKey);
  }
  localBuckets.set(key, { count: 1, windowStart });
  return false;
}

export async function limitValidLeadReceipt(token: string) {
  try {
    return await consumeSharedRateLimit('lead-receipt-valid-token', token, maxChecksPerToken, windowMs);
  } catch {
    // The signed receipt needs no DB lookup. Keep confirmation available during a
    // DB outage, but bound replay on each server instance instead of allowing it forever.
    return localLimit(token);
  }
}
