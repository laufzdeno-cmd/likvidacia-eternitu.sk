import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto';

type RuntimeEnvironment = Record<string, string | undefined>;

export type FacebookMessengerConfiguration = {
  configured: boolean;
  missing: string[];
  appId: string;
  appSecret: string;
  encryptionKey?: Buffer;
  verifyToken: string;
  pageId: string;
  reviewParticipantId: string;
  graphVersion: string;
  siteUrl: string;
  redirectUri: string;
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
export function getFacebookMessengerConfiguration(environment: RuntimeEnvironment = process.env): FacebookMessengerConfiguration {
  const appId = environment.META_MESSENGER_APP_ID?.trim() ?? '';
  const appSecret = environment.META_MESSENGER_APP_SECRET?.trim() ?? '';
  const encryptionKey = decodeEncryptionKey(environment.META_MESSENGER_ENCRYPTION_KEY?.trim() ?? '');
  const verifyToken = environment.META_MESSENGER_VERIFY_TOKEN?.trim() ?? '';
  const pageId = environment.META_MESSENGER_PAGE_ID?.trim() ?? '';
  const reviewParticipantId = /^\d{5,32}$/.test(environment.META_MESSENGER_REVIEW_PARTICIPANT_ID?.trim() ?? '')
    ? environment.META_MESSENGER_REVIEW_PARTICIPANT_ID!.trim()
    : '';
  const graphVersion = environment.META_GRAPH_API_VERSION?.trim() ?? '';
  const siteUrl = (environment.NEXT_PUBLIC_SITE_URL?.trim() ?? '').replace(/\/$/, '');
  const missing = [
    !appId && 'META_MESSENGER_APP_ID',
    !appSecret && 'META_MESSENGER_APP_SECRET',
    !encryptionKey && 'META_MESSENGER_ENCRYPTION_KEY',
    !verifyToken && 'META_MESSENGER_VERIFY_TOKEN',
    !pageId && 'META_MESSENGER_PAGE_ID',
    !/^v\d+\.\d+$/.test(graphVersion) && 'META_GRAPH_API_VERSION',
    !/^https:\/\//i.test(siteUrl) && 'NEXT_PUBLIC_SITE_URL',
  ].filter((item): item is string => Boolean(item));
  return {
    configured: missing.length === 0,
    missing,
    appId,
    appSecret,
    encryptionKey,
    verifyToken,
    pageId,
    reviewParticipantId,
    graphVersion,
    siteUrl,
    redirectUri: siteUrl ? `${siteUrl}/api/meta/messenger/oauth/callback` : '',
  };
}

export function encryptFacebookPageToken(token: string, key: Buffer) {
  if (key.length !== 32) throw new Error('Neplatný šifrovací kľúč Facebook integrácie.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptFacebookPageToken(value: string, key: Buffer) {
  const [version, ivText, tagText, payloadText] = value.split('.');
  if (version !== 'v1' || !ivText || !tagText || !payloadText || key.length !== 32) {
    throw new Error('Uložené pripojenie Facebooku nemožno bezpečne prečítať.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(payloadText, 'base64url')), decipher.final()]).toString('utf8');
}
