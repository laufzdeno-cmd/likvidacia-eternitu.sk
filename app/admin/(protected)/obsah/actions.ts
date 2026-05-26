'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, verifyCsrf } from '@/src/server/auth';
import { upsertSiteContentValues } from '@/src/server/db';

export async function updateSiteContentAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = await requireAdmin();
  const values: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('content:')) continue;
    values[key.replace('content:', '')] = String(value || '');
  }

  await upsertSiteContentValues(values, actorEmail);
  revalidatePath('/admin/obsah');
  revalidatePath('/');
}
