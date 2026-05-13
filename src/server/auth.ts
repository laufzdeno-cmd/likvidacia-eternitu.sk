import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const cookieName = 'astana_admin_session';

function authSecret() {
  return process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-dev-auth-secret-change-me');
}

export function adminEmail() {
  return process.env.ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'admin@local.test');
}

function sign(value: string) {
  const secret = authSecret();
  if (!secret) throw new Error('AUTH_SECRET is missing.');
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function encodeSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, iat: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string; iat?: number };
    if (!decoded.email || !decoded.iat) return null;
    if (Date.now() - decoded.iat > 1000 * 60 * 60 * 12) return null;
    return decoded.email;
  } catch {
    return null;
  }
}

export async function currentAdminEmail() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(cookieName)?.value);
}

export async function requireAdmin() {
  const email = await currentAdminEmail();
  if (!email) redirect('/admin/login');
  return email;
}

export async function setAdminSession(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, encodeSession(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(password, salt, 64).toString('base64url');
  return `${salt}:${hash}`;
}

function verifyHash(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function verifyAdminCredentials(email: string, password: string) {
  const configuredEmail = adminEmail();
  if (!configuredEmail || email.trim().toLowerCase() !== configuredEmail.toLowerCase()) return false;

  if (process.env.ADMIN_PASSWORD_HASH) {
    return verifyHash(password, process.env.ADMIN_PASSWORD_HASH);
  }

  if (process.env.ADMIN_PASSWORD) {
    return password === process.env.ADMIN_PASSWORD;
  }

  return process.env.NODE_ENV !== 'production' && password === 'astana-admin';
}
