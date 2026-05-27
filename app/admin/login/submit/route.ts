import { NextRequest, NextResponse } from 'next/server';
import { adminEmail, setAdminSession, setPendingTwoFactor, verifyAdminCredentials, verifyGuestCsrf } from '@/src/server/auth';
import { getAdminUserByEmail } from '@/src/server/db';
import { isTwoFactorRequired } from '@/src/server/two-factor';
import type { AdminUser } from '@/src/server/types';

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 5;

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function isLoginLimited(ip: string) {
  const now = Date.now();
  const bucket = loginAttempts.get(ip);
  if (!bucket || now - bucket.firstAttempt > loginWindowMs) {
    return false;
  }
  return bucket.count >= maxLoginAttempts;
}

function recordFailedLogin(ip: string) {
  const now = Date.now();
  const bucket = loginAttempts.get(ip);
  if (!bucket || now - bucket.firstAttempt > loginWindowMs) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return;
  }
  bucket.count += 1;
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (isLoginLimited(ip)) {
    return new NextResponse('Príliš veľa pokusov. Skúste znova o 15 minút.', { status: 429 });
  }

  const formData = await request.formData();
  try {
    await verifyGuestCsrf(formData);
  } catch {
    return NextResponse.redirect(new URL('/admin/login?error=csrf', request.url), { status: 303 });
  }
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');

  if (!(await verifyAdminCredentials(email, password))) {
    recordFailedLogin(ip);
    return NextResponse.redirect(new URL('/admin/login?error=1', request.url), { status: 303 });
  }

  loginAttempts.delete(ip);
  const normalizedEmail = email.trim().toLowerCase();
  const dbUser = await getAdminUserByEmail(normalizedEmail);
  const fallbackUser: Pick<AdminUser, 'email' | 'role' | 'twoFactorEnabled'> | null =
    !dbUser && normalizedEmail === adminEmail().toLowerCase()
      ? { email: normalizedEmail, role: 'SUPER_ADMIN', twoFactorEnabled: false }
      : null;
  const user = dbUser ?? fallbackUser;
  if (user && (isTwoFactorRequired(user.role) || user.twoFactorEnabled)) {
    await setPendingTwoFactor(normalizedEmail);
    if (!user.twoFactorEnabled) {
      return NextResponse.redirect(new URL('/admin/2fa/setup', request.url), { status: 303 });
    }
    return NextResponse.redirect(new URL('/admin/2fa/verify', request.url), { status: 303 });
  }

  await setAdminSession(normalizedEmail);
  return NextResponse.redirect(new URL('/admin/dopyty', request.url), { status: 303 });
}
