'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { restoreSiteContentVersion, upsertSiteContentValues } from '@/src/server/db';
import { homepageEditableKeys } from '@/src/server/site-content';

const editableKeys = new Set<string>(homepageEditableKeys);

function maxLengthForKey(key: string) {
  return key.endsWith('Items') ? 10_000 : 3_000;
}

export async function updateSiteContentAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = (await requireSuperAdmin()).email;
  const values: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('content:')) continue;
    const contentKey = key.slice('content:'.length);
    if (!editableKeys.has(contentKey) || typeof value !== 'string' || value.length > maxLengthForKey(contentKey)) {
      redirect('/admin/obsah?stav=neplatne');
    }
    values[contentKey] = value;
  }

  await upsertSiteContentValues(values, actorEmail);
  revalidatePath('/admin/obsah');
  revalidatePath('/');
  redirect('/admin/obsah?stav=ulozene');
}

export async function restoreSiteContentVersionAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = (await requireSuperAdmin()).email;
  const versionId = String(formData.get('versionId') || '');
  const expectedCurrentHash = String(formData.get('expectedCurrentHash') || '');
  const confirmation = String(formData.get('confirmation') || '').trim().toLocaleUpperCase('sk-SK');
  if (confirmation !== 'OBNOVIŤ') redirect('/admin/obsah/historia?stav=potvrdenie');

  const restored = await restoreSiteContentVersion({ versionId, expectedCurrentHash, actorEmail });
  if (!restored) redirect('/admin/obsah/historia?stav=konflikt');
  revalidatePath('/admin/obsah');
  revalidatePath('/admin/obsah/historia');
  revalidatePath('/');
  redirect(`/admin/obsah/historia?stav=obnovene&verzia=${restored.id}`);
}
