import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { consumeApiRateLimit } from './db';

const localBuckets = new Map<string, { count: number; expiresAt: number }>();
const localBucketLimit = 5_000;

export function createRateLimitBucketKey(namespace: string, identity: string, secret: string) {
  return createHmac('sha256', secret).update(`${namespace}:v1:${identity}`).digest('hex');
}

export function rateLimitWindowStart(now: number, windowMs: number) {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

function rateLimitContext(namespace: string, identity: string, windowMs: number) {
  const now = Date.now();
  const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-dev-auth-secret-change-me');
  if (!secret) throw new Error('AUTH_SECRET is required for rate limiting.');
  return {
    key: createRateLimitBucketKey(namespace, identity, secret),
    windowStartedAt: rateLimitWindowStart(now, windowMs),
    now,
  };
}

function useDatabaseLimiter() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.DATABASE_URL);
}

export function trustedRateLimitClientIp(headers: Headers) {
  const vercelIp = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  if (vercelIp && isIP(vercelIp)) return vercelIp;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('A trusted Vercel client IP header is required for rate limiting.');
  }
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp && isIP(realIp)) return realIp;
  const forwarded = headers.get('x-forwarded-for')?.split(',').map((value) => value.trim()).filter(Boolean);
  const proxyIp = forwarded?.at(-1);
  return proxyIp && isIP(proxyIp) ? proxyIp : 'unknown';
}

function trimLocalBuckets(now: number, key: string) {
  for (const [bucketKey, bucket] of localBuckets) {
    if (bucket.expiresAt <= now) localBuckets.delete(bucketKey);
  }
  if (!localBuckets.has(key) && localBuckets.size >= localBucketLimit) {
    const oldestKey = localBuckets.keys().next().value;
    if (oldestKey) localBuckets.delete(oldestKey);
  }
}

export async function consumeSharedRateLimit(
  namespace: string,
  identity: string,
  maxHits: number,
  windowMs: number,
) {
  const { key, windowStartedAt, now } = rateLimitContext(namespace, identity, windowMs);
  if (useDatabaseLimiter()) return consumeApiRateLimit(key, windowStartedAt, maxHits);
  trimLocalBuckets(now, key);
  const bucket = localBuckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    localBuckets.set(key, { count: 1, expiresAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > maxHits;
}
