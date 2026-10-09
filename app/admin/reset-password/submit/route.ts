import { NextRequest, NextResponse } from 'next/server';
import { adminEmail, hashPassword, verifyGuestCsrf } from '@/src/server/auth';
import { changeAdminUserPassword, getAdminUserByEmail } from '@/src/server/db';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  try {
    await verifyGuestCsrf(formData);
  } catch {
    return NextResponse.redirect(new URL('/admin/reset-password?error=csrf', request.url), { status: 303 });
  }
  const resetToken = String(formData.get('resetToken') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const newPassword = String(formData.get('newPassword') || '');
  const repeatPassword = String(formData.get('repeatPassword') || '');
  const configuredToken = process.env.ADMIN_RESET_TOKEN || '';
  const configuredEmail = adminEmail().toLowerCase();

  if (!configuredToken || resetToken !== configuredToken || !configuredEmail || email !== configuredEmail) {
    return NextResponse.redirect(new URL('/admin/reset-password?error=token', request.url), { status: 303 });
  }

  if (newPassword.length < 12 || newPassword.length > 128 || newPassword !== repeatPassword) {
    return NextResponse.redirect(new URL('/admin/reset-password?error=password', request.url), { status: 303 });
  }

  const user = await getAdminUserByEmail(configuredEmail);
  if (!user?.active) {
    return NextResponse.redirect(new URL('/admin/reset-password?error=account', request.url), { status: 303 });
  }
  const changed = await changeAdminUserPassword(
    configuredEmail,
    hashPassword(newPassword),
    user.sessionEpoch,
    'admin-password-reset',
  );
  if (!changed) {
    return NextResponse.redirect(new URL('/admin/reset-password?error=conflict', request.url), { status: 303 });
  }
  return NextResponse.redirect(new URL('/admin/login?reset=1', request.url), { status: 303 });
}
