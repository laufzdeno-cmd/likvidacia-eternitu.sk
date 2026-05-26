import { NextRequest, NextResponse } from 'next/server';
import { setAdminSession, verifyAdminCredentials } from '@/src/server/auth';

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
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');

  if (!(await verifyAdminCredentials(email, password))) {
    recordFailedLogin(ip);
    return NextResponse.redirect(new URL('/admin/login?error=1', request.url), { status: 303 });
  }

  loginAttempts.delete(ip);
  await setAdminSession(email.trim().toLowerCase());
  return NextResponse.redirect(new URL('/admin/dopyty', request.url), { status: 303 });
}
