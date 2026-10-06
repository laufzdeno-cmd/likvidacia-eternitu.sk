import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const receiptTtlMs = 10 * 60_000;
const localReceiptSecret = 'local-dev-auth-secret-change-me';

type LeadReceiptPayload = {
  v: 1;
  accepted: true;
  emailSent: boolean;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function signatureFor(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function leadReceiptSecret(environment = process.env.NODE_ENV, secret = process.env.AUTH_SECRET) {
  return secret || (environment === 'production' ? '' : localReceiptSecret);
}

export function createLeadReceiptToken(emailSent: boolean, secret: string, now = Date.now()) {
  if (!secret) throw new Error('AUTH_SECRET is required to sign lead receipts.');
  const value: LeadReceiptPayload = {
    v: 1,
    accepted: true,
    emailSent,
    issuedAt: now,
    expiresAt: now + receiptTtlMs,
    nonce: randomUUID(),
  };
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${signatureFor(payload, secret)}`;
}

export function verifyLeadReceiptToken(token: string, secret: string, now = Date.now()) {
  if (!secret || token.length > 512) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;

  const expected = Buffer.from(signatureFor(payload, secret), 'base64url');
  let received: Buffer;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<LeadReceiptPayload>;
    if (
      value.v !== 1 || value.accepted !== true || typeof value.emailSent !== 'boolean' ||
      typeof value.issuedAt !== 'number' || typeof value.expiresAt !== 'number' ||
      typeof value.nonce !== 'string' || value.expiresAt <= now || value.issuedAt > now + 30_000 ||
      value.expiresAt - value.issuedAt !== receiptTtlMs
    ) return null;
    return { accepted: true as const, emailSent: value.emailSent };
  } catch {
    return null;
  }
}
