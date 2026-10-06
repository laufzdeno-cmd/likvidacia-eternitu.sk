import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const receiptTtlMs = 10 * 60_000;
const localSecret = 'local-dev-auth-secret-change-me';

type TestimonialReceiptPayload = {
  v: 1;
  purpose: 'testimonial';
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function signatureFor(payload: string, secret: string) {
  return createHmac('sha256', secret).update(`testimonial-receipt:v1:${payload}`).digest('base64url');
}

export function testimonialReceiptSecret(environment = process.env.NODE_ENV, secret = process.env.AUTH_SECRET) {
  return secret || (environment === 'production' ? '' : localSecret);
}

export function createTestimonialReceiptToken(secret: string, now = Date.now()) {
  if (!secret) throw new Error('AUTH_SECRET is required to sign testimonial receipts.');
  const value: TestimonialReceiptPayload = {
    v: 1,
    purpose: 'testimonial',
    issuedAt: now,
    expiresAt: now + receiptTtlMs,
    nonce: randomUUID(),
  };
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${signatureFor(payload, secret)}`;
}

export function verifyTestimonialReceiptToken(token: string, secret: string, now = Date.now()) {
  if (!secret || token.length > 512) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature)) return false;

  const expected = Buffer.from(signatureFor(payload, secret), 'base64url');
  let received: Buffer;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;

  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<TestimonialReceiptPayload>;
    return value.v === 1 && value.purpose === 'testimonial' &&
      typeof value.issuedAt === 'number' && typeof value.expiresAt === 'number' &&
      typeof value.nonce === 'string' &&
      value.issuedAt <= now + 30_000 && value.expiresAt > now &&
      value.expiresAt - value.issuedAt === receiptTtlMs;
  } catch {
    return false;
  }
}
