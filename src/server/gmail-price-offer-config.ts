import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

type RuntimeEnvironment = Record<string, string | undefined>;

export const gmailPriceOfferScope = 'https://www.googleapis.com/auth/gmail.modify';
export const gmailPriceOfferLabelName = '✓ CP odoslaná';

export type GmailPriceOfferConfiguration = {
  configured: boolean;
  missing: string[];
  clientId: string;
  clientSecret: string;
  encryptionKey?: Buffer;
  siteUrl: string;
  redirectUri: string;
  allowedAccountEmail: string;
};

function decodeEncryptionKey(value: string) {
  if (!value) return undefined;
  try {
    const key = Buffer.from(value, 'base64');
    return key.length === 32 ? key : undefined;
  } catch {
    return undefined;
  }
}

export function getGmailPriceOfferConfiguration(
  environment: RuntimeEnvironment = process.env,
): GmailPriceOfferConfiguration {
  const clientId = environment.GMAIL_OAUTH_CLIENT_ID?.trim() ?? '';
  const clientSecret = environment.GMAIL_OAUTH_CLIENT_SECRET?.trim() ?? '';
  const encryptionKey = decodeEncryptionKey(environment.GMAIL_TOKEN_ENCRYPTION_KEY?.trim() ?? '');
  const siteUrl = (environment.NEXT_PUBLIC_SITE_URL?.trim() ?? '').replace(/\/$/, '');
  const allowedAccountEmail = environment.GMAIL_ALLOWED_ACCOUNT_EMAIL?.trim().toLowerCase() ?? '';
  const missing = [
    !clientId && 'GMAIL_OAUTH_CLIENT_ID',
    !clientSecret && 'GMAIL_OAUTH_CLIENT_SECRET',
    !encryptionKey && 'GMAIL_TOKEN_ENCRYPTION_KEY',
    !/^https:\/\//i.test(siteUrl) && 'NEXT_PUBLIC_SITE_URL',
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowedAccountEmail) && 'GMAIL_ALLOWED_ACCOUNT_EMAIL',
  ].filter((item): item is string => Boolean(item));
  return {
    configured: missing.length === 0,
    missing,
    clientId,
    clientSecret,
    encryptionKey,
    siteUrl,
    redirectUri: siteUrl ? `${siteUrl}/api/google/gmail/oauth/callback` : '',
    allowedAccountEmail,
  };
}

export function encryptGmailSecret(secret: string, key: Buffer) {
  if (!secret || key.length !== 32) throw new Error('Neplatný Gmail secret alebo šifrovací kľúč.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptGmailSecret(value: string, key: Buffer) {
  const [version, ivText, tagText, payloadText] = value.split('.');
  if (version !== 'v1' || !ivText || !tagText || !payloadText || key.length !== 32) {
    throw new Error('Uložené Gmail pripojenie nemožno bezpečne prečítať.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(payloadText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
