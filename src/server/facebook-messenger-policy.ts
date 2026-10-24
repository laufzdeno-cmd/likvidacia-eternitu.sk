import { createHmac, timingSafeEqual } from 'node:crypto';

export const facebookReplyWindowMs = 24 * 60 * 60 * 1000;
export const facebookMessageMaxLength = 2_000;
export const facebookWebhookMaxBytes = 1_000_000;

export function isWithinFacebookReplyWindow(lastInboundAt: string | undefined, at = new Date()) {
  if (!lastInboundAt) return false;
  const timestamp = Date.parse(lastInboundAt);
  if (!Number.isFinite(timestamp)) return false;
  const age = at.getTime() - timestamp;
  return age >= 0 && age <= facebookReplyWindowMs;
}
export function facebookReplyWindowEndsAt(lastInboundAt: string | undefined) {
  if (!lastInboundAt) return undefined;
  const timestamp = Date.parse(lastInboundAt);
  return Number.isFinite(timestamp) ? new Date(timestamp + facebookReplyWindowMs).toISOString() : undefined;
}

export function normalizeFacebookReply(value: unknown) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text || text.length > facebookMessageMaxLength) {
    throw new Error(`Odpoveď musí mať 1 až ${facebookMessageMaxLength} znakov.`);
  }
  return text;
}

export function verifyFacebookWebhookSignature(rawBody: string, signature: string | null, appSecret: string) {
  if (!appSecret || !signature?.startsWith('sha256=')) return false;
  const suppliedHex = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest();
  const supplied = Buffer.from(suppliedHex, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function verifyFacebookWebhookToken(supplied: string | null, configured: string) {
  if (!supplied || !configured) return false;
  const left = Buffer.from(supplied, 'utf8');
  const right = Buffer.from(configured, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function facebookAttachmentTypes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const type = String((item as Record<string, unknown>).type ?? '').toLowerCase();
    return ['image', 'video', 'audio', 'file', 'fallback'].includes(type) ? [type] : [];
  }))].slice(0, 10);
}
