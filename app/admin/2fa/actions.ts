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
  consumeAdminUserTotpStep,
  enableAdminUserTwoFactor,
  getAdminUserByEmail,
} from '@/src/server/db';
import {
  consumeBackupCode,
  generateBackupCodes,
  hashBackupCode,
  hashBackupCodes,
  isTwoFactorRequired,
  verifyTotpTimeStep,
} from '@/src/server/two-factor';
import { consumeSharedRateLimit } from '@/src/server/shared-rate-limit';

const twoFactorRateWindowMs = 10 * 60_000;
const maxTwoFactorAttempts = 5;

async function twoFactorEmail() {
  return (await currentPendingTwoFactorEmail()) || (await currentAdminEmail());
}

export async function confirmTwoFactorSetupAction(formData: FormData) {
  await verifyGuestCsrf(formData);
  const email = await twoFactorEmail();
  if (!email) redirect('/admin/login');
  const limitState = await twoFactorLimitState(email);
  if (limitState === 'limited') redirect('/admin/2fa/setup?error=limited');
  if (limitState === 'unavailable') redirect('/admin/2fa/setup?error=unavailable');
  const user = await getAdminUserByEmail(email);
  if (!user?.active || !user.twoFactorSecret || user.twoFactorEnabled) redirect('/admin/login');

  const token = String(formData.get('token') || '');
  const timeStep = verifyTotpTimeStep(token, user.twoFactorSecret);
  if (timeStep === null) {
    redirect('/admin/2fa/setup?error=1');
  }

  const backupCodes = generateBackupCodes();
  const enabled = await enableAdminUserTwoFactor(user.email, hashBackupCodes(backupCodes), timeStep, user.twoFactorSecret, user.email);
  if (!enabled) redirect('/admin/2fa/setup?error=1');
  await setPendingBackupCodes(backupCodes);
  await clearPendingTwoFactor();
  await setAdminSession(user.email);
  redirect('/admin/2fa/backup-codes');
}

export async function verifyTwoFactorLoginAction(formData: FormData) {
  await verifyGuestCsrf(formData);
  const email = await currentPendingTwoFactorEmail();
  if (!email) redirect('/admin/login');
  const limitState = await twoFactorLimitState(email);
  if (limitState === 'limited') redirect('/admin/2fa/verify?error=limited');
  if (limitState === 'unavailable') redirect('/admin/2fa/verify?error=unavailable');
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
  const timeStep = verifyTotpTimeStep(token, user.twoFactorSecret);
  const isTotp = timeStep !== null;

  if (isTotp) {
    const consumed = await consumeAdminUserTotpStep(user.email, user.twoFactorSecret, timeStep);
    if (!consumed) redirect('/admin/2fa/verify?error=1');
  } else if (remainingBackupCodes !== null) {
    const consumed = await consumeAdminUserBackupCode(user.email, hashBackupCode(token), user.email);
    if (!consumed) redirect('/admin/2fa/verify?error=1');
  } else redirect('/admin/2fa/verify?error=1');
  await clearPendingTwoFactor();
  await setAdminSession(user.email);
  redirect('/admin/dopyty');
}

async function twoFactorLimitState(email: string): Promise<'allowed' | 'limited' | 'unavailable'> {
  try {
    const limited = await consumeSharedRateLimit(
      'admin-two-factor-account',
      email.trim().toLowerCase(),
      maxTwoFactorAttempts,
      twoFactorRateWindowMs,
    );
    return limited ? 'limited' : 'allowed';
  } catch (error) {
    console.error('Admin two-factor rate limit unavailable', error instanceof Error ? error.message : 'unknown');
    return 'unavailable';
  }
}
