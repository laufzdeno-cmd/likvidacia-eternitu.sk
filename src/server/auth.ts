import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getAdminSetting, getAdminUserByEmail } from './db';
import { adminSessionEpochMatchesUser } from './admin-session-policy';
import type { AdminRole, AdminUser } from './types';

const cookieName = 'astana_admin_session';
const pendingTwoFactorCookieName = 'astana_admin_2fa_pending';
const backupCodesCookieName = 'astana_admin_2fa_backup_codes';

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

export function csrfTokenForEmail(email: string) {
  return sign(`admin-csrf:${email.trim().toLowerCase()}`);
}

export async function createGuestCsrfToken() {
  const payload = Buffer.from(JSON.stringify({ nonce: randomBytes(24).toString('base64url'), iat: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export async function verifyGuestCsrf(formData: FormData) {
  const token = String(formData.get('_csrf') || '');
  const [payload, signature] = token.split('.');
  if (!payload || !signature || signature !== sign(payload)) {
    throw new Error('Neplatný bezpečnostný token. Obnovte stránku a skúste to znova.');
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { iat?: number };
    if (!decoded.iat || Date.now() - decoded.iat > 1000 * 60 * 30) throw new Error('expired');
  } catch {
    throw new Error('Neplatný bezpečnostný token. Obnovte stránku a skúste to znova.');
  }
}

export async function verifyCsrf(formData: FormData) {
  const email = await currentAdminEmail();
  const token = String(formData.get('_csrf') || '');
  if (!email || !token || token !== csrfTokenForEmail(email)) {
    throw new Error('Neplatný bezpečnostný token. Obnovte stránku a skúste to znova.');
  }
}

type AdminSession = { kind: 'admin-session'; email: string; iat: number; epoch: number };

function encodeSession(email: string, epoch: number) {
  const payload = Buffer.from(JSON.stringify({ kind: 'admin-session', email, iat: Date.now(), epoch })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token?: string): AdminSession | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AdminSession>;
    if (decoded.kind !== 'admin-session' || !decoded.email || !decoded.iat || !Number.isSafeInteger(decoded.epoch) || Number(decoded.epoch) < 0) return null;
    if (Date.now() - decoded.iat > 1000 * 60 * 60 * 12) return null;
    return { kind: 'admin-session', email: decoded.email, iat: decoded.iat, epoch: Number(decoded.epoch) };
  } catch {
    return null;
  }
}

export async function currentAdminEmail() {
  const user = await currentAdminUser();
  return user?.active ? user.email : null;
}

export async function requireAdmin() {
  const user = await requireAdminUser();
  return user.email;
}

type PendingTwoFactor = { kind: 'pending-two-factor'; email: string; iat: number; epoch: number };

function encodeSignedJson(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeSignedJson<T>(token?: string): T | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export async function setPendingTwoFactor(email: string, sessionEpoch: number) {
  if (!Number.isSafeInteger(sessionEpoch) || sessionEpoch < 0) throw new Error('Invalid pending two-factor epoch.');
  const cookieStore = await cookies();
  cookieStore.set(pendingTwoFactorCookieName, encodeSignedJson({
    kind: 'pending-two-factor',
    email: email.trim().toLowerCase(),
    iat: Date.now(),
    epoch: sessionEpoch,
  }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });
}

export async function currentPendingTwoFactorUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const pending = decodeSignedJson<PendingTwoFactor>(cookieStore.get(pendingTwoFactorCookieName)?.value);
  if (pending?.kind !== 'pending-two-factor' || !pending.email || !pending.iat || !Number.isSafeInteger(pending.epoch) || pending.epoch < 0) return null;
  if (Date.now() - pending.iat > 1000 * 60 * 10) return null;
  const user = await getAdminUserByEmail(pending.email).catch(() => null);
  if (!user?.active || !adminSessionEpochMatchesUser(pending.epoch, user.sessionEpoch)) return null;
  return user;
}

export async function currentPendingTwoFactorEmail() {
  return (await currentPendingTwoFactorUser())?.email ?? null;
}

export async function clearPendingTwoFactor() {
  const cookieStore = await cookies();
  cookieStore.delete(pendingTwoFactorCookieName);
}

export async function setPendingBackupCodes(codes: string[], email: string, sessionEpoch: number) {
  if (!Number.isSafeInteger(sessionEpoch) || sessionEpoch < 0) throw new Error('Invalid admin session epoch.');
  const cookieStore = await cookies();
  cookieStore.set(backupCodesCookieName, encodeSignedJson({
    codes, email: email.trim().toLowerCase(), sessionEpoch, iat: Date.now(),
  }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });
}

export async function consumePendingBackupCodes(email: string, sessionEpoch: number) {
  const cookieStore = await cookies();
  const pending = decodeSignedJson<{ codes?: string[]; email?: string; sessionEpoch?: number; iat?: number }>(
    cookieStore.get(backupCodesCookieName)?.value,
  );
  cookieStore.delete(backupCodesCookieName);
  if (!pending?.codes?.length || !pending.iat || pending.email !== email.trim().toLowerCase()
    || pending.sessionEpoch !== sessionEpoch) return [];
  if (Date.now() - pending.iat > 1000 * 60 * 10) return [];
  return pending.codes;
}

export async function clearPendingBackupCodes() {
  (await cookies()).delete(backupCodesCookieName);
}

export async function currentAdminUser(): Promise<Pick<AdminUser, 'email' | 'name' | 'role' | 'active' | 'sessionEpoch'> | null> {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(cookieName)?.value);
  if (!session) return null;
  const email = session.email;

  let user: AdminUser | null = null;
  let lookupFailed = false;
  try {
    user = await getAdminUserByEmail(email);
  } catch (error) {
    lookupFailed = true;
    console.error('Admin user lookup failed; refusing session fallback.', error);
  }
  if (user) {
    if (!adminSessionEpochMatchesUser(session.epoch, user.sessionEpoch)) return null;
    return { email: user.email, name: user.name || user.email, role: user.role, active: user.active, sessionEpoch: user.sessionEpoch };
  }

  const configuredEmail = adminEmail();
  const fallbackEmail = process.env.TEMP_ADMIN_EMAIL || configuredEmail;
  if (!lookupFailed && process.env.NODE_ENV !== 'production' && fallbackEmail && email.toLowerCase() === fallbackEmail.toLowerCase()) {
    if (session.epoch !== 0) return null;
    return { email, name: 'ASTANA', role: 'SUPER_ADMIN', active: true, sessionEpoch: 0 };
  }
  return null;
}

// Setup accepts either a pending password proof or a full session, but never
// upgrades that proof to a newer account generation after an asynchronous read.
export async function currentTwoFactorSetupUser(): Promise<AdminUser | null> {
  const pending = await currentPendingTwoFactorUser();
  if (pending) return pending;
  const session = await currentAdminUser();
  if (!session?.active) return null;
  const user = await getAdminUserByEmail(session.email).catch(() => null);
  return user?.active && adminSessionEpochMatchesUser(session.sessionEpoch, user.sessionEpoch) ? user : null;
}

export async function requireAdminUser() {
  const user = await currentAdminUser();
  if (!user?.active) redirect('/admin/login');
  if (user.role === 'META_REVIEWER') redirect('/admin/facebook?access=restricted');
  return user;
}

export async function requireAnyAdminUser() {
  const user = await currentAdminUser();
  if (!user?.active) redirect('/admin/login');
  return user;
}

export async function requireFacebookAdminUser() {
  return requireAnyAdminUser();
}

export async function requireSuperAdmin() {
  const user = await requireAdminUser();
  if (user.role !== 'SUPER_ADMIN') redirect('/admin/dashboard?access=denied');
  return user;
}

export function canAccessAdminPath(role: AdminRole, pathname: string) {
  if (role === 'SUPER_ADMIN') return true;
  if (role === 'META_REVIEWER') {
    return pathname === '/admin/facebook' || pathname.startsWith('/admin/facebook/');
  }
  return !(
    pathname.startsWith('/admin/analytics') ||
    pathname.startsWith('/admin/rok') ||
    pathname.startsWith('/admin/nastavenia') ||
    pathname.startsWith('/admin/import') ||
    pathname.startsWith('/admin/users') ||
    pathname.startsWith('/admin/health') ||
    pathname.startsWith('/admin/audit') ||
    pathname.startsWith('/admin/obsah') ||
    pathname.startsWith('/admin/automatizacie')
  );
}

export async function setAdminSession(email: string, sessionEpoch: number) {
  if (!Number.isSafeInteger(sessionEpoch) || sessionEpoch < 0) throw new Error('Invalid admin session epoch.');
  const cookieStore = await cookies();
  cookieStore.set(cookieName, encodeSession(email, sessionEpoch), {
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

type VerifiedLoginUser = Pick<AdminUser, 'email' | 'role' | 'twoFactorEnabled' | 'sessionEpoch'> & { localDevelopmentFallback: boolean };

export async function authenticateAdminCredentials(email: string, password: string): Promise<VerifiedLoginUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  let dbUser: AdminUser | null;
  try {
    dbUser = await getAdminUserByEmail(normalizedEmail);
  } catch {
    return null;
  }
  if (dbUser && !dbUser.active) return null;
  const user: VerifiedLoginUser | null = dbUser
    ? { email: dbUser.email, role: dbUser.role, twoFactorEnabled: dbUser.twoFactorEnabled, sessionEpoch: dbUser.sessionEpoch, localDevelopmentFallback: false }
    : process.env.NODE_ENV !== 'production'
      && normalizedEmail === (process.env.TEMP_ADMIN_EMAIL || adminEmail()).toLowerCase()
      ? { email: normalizedEmail, role: 'SUPER_ADMIN', twoFactorEnabled: false, sessionEpoch: 0, localDevelopmentFallback: true }
      : null;
  if (!user) return null;
  const tempEmail = process.env.TEMP_ADMIN_EMAIL;
  const tempHash = process.env.TEMP_ADMIN_PASSWORD_HASH;
  if (process.env.NODE_ENV !== 'production' && tempEmail && tempHash && normalizedEmail === tempEmail.toLowerCase()) {
    return verifyHash(password, tempHash) ? user : null;
  }

  if (dbUser?.passwordHash) {
    return verifyHash(password, dbUser.passwordHash) ? user : null;
  }

  const configuredEmail = adminEmail();
  if (!configuredEmail || normalizedEmail !== configuredEmail.toLowerCase()) return null;

  try {
    const storedAdminHash = await getAdminSetting('admin_password_hash');
    if (storedAdminHash) {
      return verifyHash(password, storedAdminHash) ? user : null;
    }
  } catch (error) {
    console.error('Admin password override could not be read.', error);
    return null;
  }

  if (process.env.ADMIN_PASSWORD_HASH) {
    return verifyHash(password, process.env.ADMIN_PASSWORD_HASH) ? user : null;
  }

  if (process.env.NODE_ENV !== 'production' && process.env.ADMIN_PASSWORD) {
    return password === process.env.ADMIN_PASSWORD ? user : null;
  }

  return process.env.NODE_ENV !== 'production' && password === 'astana-admin' ? user : null;
}

export async function verifyAdminCredentials(email: string, password: string) {
  return Boolean(await authenticateAdminCredentials(email, password));
}
