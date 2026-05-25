import { NextRequest, NextResponse } from 'next/server';
import { adminEmail, hashPassword } from '@/src/server/auth';
import { setAdminSetting } from '@/src/server/db';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const resetToken = String(formData.get('resetToken') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const newPassword = String(formData.get('newPassword') || '');
  const repeatPassword = String(formData.get('repeatPassword') || '');
  const configuredToken = process.env.ADMIN_RESET_TOKEN || '';
  const configuredEmail = adminEmail().toLowerCase();

  if (!configuredToken || resetToken !== configuredToken || !configuredEmail || email !== configuredEmail) {
    return NextResponse.redirect(new URL('/admin/reset-password?error=token', request.url), { status: 303 });
  }

  if (newPassword.length < 8 || newPassword !== repeatPassword) {
    return NextResponse.redirect(new URL('/admin/reset-password?error=password', request.url), { status: 303 });
  }

  await setAdminSetting('admin_password_hash', hashPassword(newPassword), 'admin-password-reset');
  return NextResponse.redirect(new URL('/admin/login?reset=1', request.url), { status: 303 });
}
