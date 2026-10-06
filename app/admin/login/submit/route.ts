import { NextRequest, NextResponse } from 'next/server';
import { adminEmail, setAdminSession, setPendingTwoFactor, verifyAdminCredentials, verifyGuestCsrf } from '@/src/server/auth';
import { getAdminUserByEmail } from '@/src/server/db';
import { isTwoFactorRequired } from '@/src/server/two-factor';
import { consumeSharedRateLimit, trustedRateLimitClientIp } from '@/src/server/shared-rate-limit';
import type { AdminUser } from '@/src/server/types';

const loginWindowMs = 10 * 60_000;
const maxLoginAttempts = 20;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  try {
    await verifyGuestCsrf(formData);
  } catch {
    return NextResponse.redirect(new URL('/admin/login?error=csrf', request.url), { status: 303 });
  }
  const email = String(formData.get('email') || '').trim().slice(0, 254);
  const password = String(formData.get('password') || '');

  try {
    if (await consumeSharedRateLimit('admin-login-address', trustedRateLimitClientIp(request.headers), maxLoginAttempts, loginWindowMs)) {
      return new NextResponse('Príliš veľa pokusov. Skúste znova o 10 minút.', { status: 429 });
    }
  } catch (error) {
    console.error('Admin login rate limit unavailable', error instanceof Error ? error.message : 'unknown');
    return new NextResponse('Prihlásenie je momentálne nedostupné. Skúste to o chvíľu znova.', { status: 503 });
  }

  if (!(await verifyAdminCredentials(email, password))) {
    return NextResponse.redirect(new URL('/admin/login?error=1', request.url), { status: 303 });
  }

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
