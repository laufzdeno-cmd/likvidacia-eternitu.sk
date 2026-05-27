'use server';

import { revalidatePath } from 'next/cache';
import { hashPassword, requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { getAdminUserByEmail, resetAdminUserTwoFactor, setAdminUserActive, upsertAdminUser } from '@/src/server/db';
import type { AdminRole } from '@/src/server/types';

export async function saveAdminUserAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireSuperAdmin();
  const password = String(formData.get('password') || '');
  await upsertAdminUser(
    {
      id: String(formData.get('id') || '') || undefined,
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      role: String(formData.get('role') || 'OPERATOR') as AdminRole,
      active: formData.get('active') !== 'off',
      passwordHash: password ? hashPassword(password) : undefined,
    },
    actor.email,
  );
  revalidatePath('/admin/users');
}

export async function toggleAdminUserAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireSuperAdmin();
  const id = String(formData.get('id') || '');
  if (id) await setAdminUserActive(id, String(formData.get('active') || '') === 'true', actor.email);
  revalidatePath('/admin/users');
}

export async function resetAdminUserTwoFactorAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireSuperAdmin();
  const id = String(formData.get('id') || '');
  const actorUser = await getAdminUserByEmail(actor.email);
  if (id && id !== actorUser?.id) await resetAdminUserTwoFactor(id, actor.email);
  revalidatePath('/admin/users');
}
