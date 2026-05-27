'use server';

import { redirect } from 'next/navigation';
import {
  clearPendingTwoFactor,
  currentAdminEmail,
  currentPendingTwoFactorEmail,
  setAdminSession,
  setPendingBackupCodes,
  verifyGuestCsrf,
} from '@/src/server/auth';
import {
  consumeAdminUserBackupCode,
  enableAdminUserTwoFactor,
  getAdminUserByEmail,
} from '@/src/server/db';
import {
  consumeBackupCode,
  generateBackupCodes,
  hashBackupCodes,
  isTwoFactorRequired,
  verifyTotp,
} from '@/src/server/two-factor';

async function twoFactorEmail() {
  return (await currentPendingTwoFactorEmail()) || (await currentAdminEmail());
}

export async function confirmTwoFactorSetupAction(formData: FormData) {
  await verifyGuestCsrf(formData);
  const email = await twoFactorEmail();
  if (!email) redirect('/admin/login');
  const user = await getAdminUserByEmail(email);
  if (!user?.active || !user.twoFactorSecret) redirect('/admin/login');

  const token = String(formData.get('token') || '');
  if (!verifyTotp(token, user.twoFactorSecret)) {
    redirect('/admin/2fa/setup?error=1');
  }

  const backupCodes = generateBackupCodes();
  await enableAdminUserTwoFactor(user.email, hashBackupCodes(backupCodes), user.email);
  await setPendingBackupCodes(backupCodes);
  await clearPendingTwoFactor();
  await setAdminSession(user.email);
  redirect('/admin/2fa/backup-codes');
}

export async function verifyTwoFactorLoginAction(formData: FormData) {
  await verifyGuestCsrf(formData);
  const email = await currentPendingTwoFactorEmail();
  if (!email) redirect('/admin/login');
  const user = await getAdminUserByEmail(email);
  if (!user?.active) redirect('/admin/login');
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    if (isTwoFactorRequired(user.role)) redirect('/admin/2fa/setup');
    await clearPendingTwoFactor();
    await setAdminSession(user.email);
    redirect('/admin/dopyty');
  }

  const token = String(formData.get('token') || '').trim();
  const remainingBackupCodes = consumeBackupCode(token, user.twoFactorBackupCodeHashes);
  const valid = verifyTotp(token, user.twoFactorSecret) || remainingBackupCodes !== null;
  if (!valid) redirect('/admin/2fa/verify?error=1');

  if (remainingBackupCodes) {
    await consumeAdminUserBackupCode(user.email, remainingBackupCodes, user.email);
  }
  await clearPendingTwoFactor();
  await setAdminSession(user.email);
  redirect('/admin/dopyty');
}
