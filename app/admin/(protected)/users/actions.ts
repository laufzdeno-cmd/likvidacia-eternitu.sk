'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { clearAdminSession, hashPassword, requireSuperAdmin, verifyAdminCredentials, verifyCsrf } from '@/src/server/auth';
import { AdminUserManagementError, getAdminUserByEmail, resetManagedAdminUserTwoFactor, saveManagedAdminUser } from '@/src/server/db';
import type { AdminRole } from '@/src/server/types';

const managedUserSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(['SUPER_ADMIN', 'OPERATOR']),
  active: z.boolean(),
  password: z.string().max(128),
  currentPassword: z.string().min(1).max(128),
  expectedSessionEpoch: z.number().int().min(0).optional(),
});

function userStatusForError(error: unknown) {
  if (!(error instanceof AdminUserManagementError)) return 'chyba';
  return {
    ACTOR_REVOKED: 'pristup-zmeneny',
    CONFLICT: 'konflikt',
    DUPLICATE_EMAIL: 'duplicitny-email',
    LAST_SUPER_ADMIN: 'posledny-superadmin',
    MISSING_PASSWORD: 'chyba-heslo',
    SELF_ACCESS_CHANGE: 'vlastny-pristup',
    USER_NOT_FOUND: 'nenajdeny',
  }[error.code];
}

export async function saveAdminUserAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireSuperAdmin();
  const rawId = formData.get('id');
  const rawEpoch = formData.get('expectedSessionEpoch');
  const parsed = managedUserSchema.safeParse({
    id: typeof rawId === 'string' && rawId ? rawId : undefined,
    name: formData.get('name'),
    email: formData.get('email'),
    role: formData.get('role'),
    active: formData.get('active') === 'on',
    password: formData.get('password'),
    currentPassword: formData.get('currentPassword'),
    expectedSessionEpoch: typeof rawEpoch === 'string' && rawEpoch ? Number(rawEpoch) : undefined,
  });
  if (!parsed.success) redirect('/admin/users?stav=neplatne-udaje');
  const isNew = !parsed.data.id;
  if (!isNew && parsed.data.expectedSessionEpoch === undefined) redirect('/admin/users?stav=konflikt');
  const actorRecord = parsed.data.id ? await getAdminUserByEmail(actor.email) : null;
  if (!(await verifyAdminCredentials(actor.email, parsed.data.currentPassword))) {
    redirect('/admin/users?stav=nespravne-heslo');
  }
  if (parsed.data.password && parsed.data.password.length < 12) redirect('/admin/users?stav=slabe-heslo');
  if (isNew && parsed.data.password.length < 12) redirect('/admin/users?stav=slabe-heslo');
  const passwordHash = parsed.data.password
    ? hashPassword(parsed.data.password)
    : actorRecord && actorRecord.id === parsed.data.id && !actorRecord.passwordHash
      ? hashPassword(parsed.data.currentPassword)
      : undefined;

  let saved;
  try {
    saved = await saveManagedAdminUser(
      {
        id: parsed.data.id,
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role as AdminRole,
        active: parsed.data.active,
        passwordHash,
        expectedSessionEpoch: parsed.data.expectedSessionEpoch,
      },
      { email: actor.email, sessionEpoch: actor.sessionEpoch },
    );
  } catch (error) {
    if (error instanceof AdminUserManagementError && error.code === 'ACTOR_REVOKED') {
      await clearAdminSession();
      redirect('/admin/login?ucet=zmeneny');
    }
    redirect(`/admin/users?stav=${userStatusForError(error)}`);
  }
  revalidatePath('/admin/users');
  if (actorRecord?.id === parsed.data.id && saved.sessionEpoch !== actor.sessionEpoch) {
    await clearAdminSession();
    redirect('/admin/login?ucet=zmeneny');
  }
  redirect(`/admin/users?stav=${isNew ? 'vytvoreny' : 'ulozeny'}`);
}

export async function resetAdminUserTwoFactorAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireSuperAdmin();
  const currentPassword = formData.get('currentPassword');
  if (typeof currentPassword !== 'string' || !(await verifyAdminCredentials(actor.email, currentPassword))) {
    redirect('/admin/users?stav=nespravne-heslo');
  }
  const id = String(formData.get('id') || '');
  const actorUser = await getAdminUserByEmail(actor.email);
  if (id && id !== actorUser?.id) {
    try {
      await resetManagedAdminUserTwoFactor(id, { email: actor.email, sessionEpoch: actor.sessionEpoch });
    } catch (error) {
      if (error instanceof AdminUserManagementError && error.code === 'ACTOR_REVOKED') {
        await clearAdminSession();
        redirect('/admin/login?ucet=zmeneny');
      }
      redirect(`/admin/users?stav=${userStatusForError(error)}`);
    }
  }
  revalidatePath('/admin/users');
  redirect('/admin/users?stav=2fa-reset');
}
