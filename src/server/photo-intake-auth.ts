import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getActivePhotoUploadInvite } from './db';

const cookieName = 'astana_photo_intake_session';
const sessionLifetimeMs = 12 * 60 * 60 * 1000;
type ParsedPhotoSession = { inviteId: string; expiresAt: number };

function secret() {
  const value = process.env.PHOTO_UPLOAD_SESSION_SECRET || '';
  if (value.length < 32) throw new Error('Súkromný nahrávací portál nemá nastavený bezpečný podpisový kľúč.');
  return value;
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function encode(inviteId: string, expiresAt: number) {
  const payload = Buffer.from(JSON.stringify({ inviteId, expiresAt })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decode(value: string | undefined): ParsedPhotoSession | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { inviteId?: string; expiresAt?: number };
    if (!parsed.inviteId || !/^[0-9a-f-]{36}$/i.test(parsed.inviteId) || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return { inviteId: parsed.inviteId, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export async function setPhotoUploadSession(inviteId: string, inviteExpiresAt: string) {
  const cookieStore = await cookies();
  const expiresAt = Math.min(Date.now() + sessionLifetimeMs, new Date(inviteExpiresAt).getTime());
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Pozvánka už nie je platná.');
  cookieStore.set(cookieName, encode(inviteId, expiresAt), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor((expiresAt - Date.now()) / 1000),
  });
}

export async function currentPhotoUploadInvite() {
  let parsed: ReturnType<typeof decode>;
  try {
    const cookieStore = await cookies();
    parsed = decode(cookieStore.get(cookieName)?.value);
  } catch {
    return null;
  }
  if (!parsed) return null;
  try {
    return await getActivePhotoUploadInvite(parsed.inviteId);
  } catch {
    return null;
  }
}

export async function clearPhotoUploadSession() {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, '', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}
