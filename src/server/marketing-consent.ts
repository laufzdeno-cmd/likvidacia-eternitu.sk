import { createHmac, timingSafeEqual } from 'node:crypto';

export const marketingConsentCookieName = 'astana_marketing_consent_v1';
export const marketingConsentMaxAgeSeconds = 60 * 60 * 24 * 180;

type MarketingConsentPayload = {
  status: 'accepted';
  version: 'google-ads-v1';
  timestamp: string;
};

function signingSecret() {
  return process.env.MARKETING_CONSENT_SECRET?.trim()
    || process.env.AUTH_SECRET?.trim()
    || (process.env.NODE_ENV === 'production' ? '' : 'local-development-consent-secret');
}

function sign(encodedPayload: string) {
  const secret = signingSecret();
  return secret ? createHmac('sha256', secret).update(encodedPayload).digest('base64url') : '';
}

function signaturesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createMarketingConsentToken(timestamp = new Date().toISOString()) {
  const encoded = Buffer.from(JSON.stringify({ status: 'accepted', version: 'google-ads-v1', timestamp } satisfies MarketingConsentPayload), 'utf8').toString('base64url');
  const signature = sign(encoded);
  return signature ? `${encoded}.${signature}` : null;
}

export function hasVerifiedMarketingConsent(value: string | undefined) {
  if (!value) return false;
  const [encoded, signature, unexpected] = value.split('.');
  if (!encoded || !signature || unexpected || !signaturesMatch(signature, sign(encoded))) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<MarketingConsentPayload>;
    const timestamp = new Date(String(payload.timestamp || ''));
    const isExpired = !Number.isFinite(timestamp.getTime()) || Date.now() - timestamp.getTime() > marketingConsentMaxAgeSeconds * 1000;
    if (isExpired || timestamp.getTime() > Date.now() + 5 * 60 * 1000) return false;
    return payload.status === 'accepted' && payload.version === 'google-ads-v1';
  } catch {
    return false;
  }
}
