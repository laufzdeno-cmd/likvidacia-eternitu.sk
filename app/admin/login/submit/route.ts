import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminCredentials, clearPendingBackupCodes, clearPendingTwoFactor, setAdminSession, setPendingTwoFactor, verifyGuestCsrf } from '@/src/server/auth';
import { isTwoFactorRequired } from '@/src/server/two-factor';
import { consumeSharedRateLimit, trustedRateLimitClientIp } from '@/src/server/shared-rate-limit';

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

  const user = await authenticateAdminCredentials(email, password);
  if (!user) {
    return NextResponse.redirect(new URL('/admin/login?error=1', request.url), { status: 303 });
  }

  const normalizedEmail = user.email;
  await clearPendingBackupCodes();
  if (!user.localDevelopmentFallback && isTwoFactorRequired(user.role)) {
    await setPendingTwoFactor(normalizedEmail, user.sessionEpoch);
    if (!user.twoFactorEnabled) {
      return NextResponse.redirect(new URL('/admin/2fa/setup', request.url), { status: 303 });
    }
    return NextResponse.redirect(new URL('/admin/2fa/verify', request.url), { status: 303 });
  }

  await clearPendingTwoFactor();
  await setAdminSession(normalizedEmail, user.sessionEpoch);
  return NextResponse.redirect(new URL('/admin/dopyty', request.url), { status: 303 });
}
