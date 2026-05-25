import { NextRequest, NextResponse } from 'next/server';
import { setAdminSession, verifyAdminCredentials } from '@/src/server/auth';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');

  if (!(await verifyAdminCredentials(email, password))) {
    return NextResponse.redirect(new URL('/admin/login?error=1', request.url), { status: 303 });
  }

  await setAdminSession(email.trim().toLowerCase());
  return NextResponse.redirect(new URL('/admin/dopyty', request.url), { status: 303 });
}
