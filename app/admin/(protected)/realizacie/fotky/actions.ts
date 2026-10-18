'use server';

import { createHash, randomBytes } from 'node:crypto';
import { del } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isPhotoCategory } from '@/src/server/photo-intake-policy';
import { requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { completePhotoIntakeDeletion, createCaseDraftFromApprovedPhoto, createPhotoUploadInvite, getActivePhotoUploadInvite, listRevokedPendingPhotoRecords, markPhotoIntakeDeletionFailed, reviewPhotoIntakeRecord, revokePhotoUploadInvite, updatePhotoIntakeMetadata, withdrawApprovedPhotoIntakeRecord } from '@/src/server/db';
import { privatePhotoIntakeBlobOptions, privatePhotoIntakeEnabled, privatePhotoIntakeStorageReady } from '@/src/server/photo-intake-config';
import { cleanSlovakText } from '@/src/server/slovak-text';

export type PhotoInviteActionState = { code?: string; expiresAt?: string; error?: string };

export async function createPhotoInviteAction(_previous: PhotoInviteActionState, formData: FormData): Promise<PhotoInviteActionState> {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  if (!privatePhotoIntakeEnabled()) return { error: 'Nahrávanie zostáva vypnuté, kým správca nepotvrdí súkromnú konfiguráciu úložiska.' };
  const workerLabelValue = formData.get('workerLabel');
  if (typeof workerLabelValue !== 'string') return { error: 'Doplňte označenie pracovníka alebo partie.' };
  const workerLabel = cleanSlovakText(workerLabelValue).trim();
  if (workerLabel.length < 2 || workerLabel.length > 100) return { error: 'Doplňte označenie pracovníka alebo partie (2 až 100 znakov).' };
  const businessJobIdValue = formData.get('businessJobId');
  if (typeof businessJobIdValue !== 'string' || !/^[0-9a-f-]{36}$/i.test(businessJobIdValue)) return { error: 'Vyberte dokončenú zákazku, ku ktorej patria fotografie.' };
  const days = Number(formData.get('days'));
  if (!Number.isInteger(days) || days < 1 || days > 30) return { error: 'Platnosť musí byť 1 až 30 dní.' };
  const code = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  try {
    await createPhotoUploadInvite(createHash('sha256').update(code).digest('hex'), admin.email, expiresAt, workerLabel, businessJobIdValue);
    revalidatePath('/admin/realizacie/fotky');
    return { code, expiresAt: expiresAt.toISOString() };
  } catch {
    return { error: 'Pozvánku sa nepodarilo uložiť. Skontrolujte pripojenie databázy.' };
  }
}

export async function revokePhotoInviteAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const id = String(formData.get('id') || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await revokePhotoUploadInvite(id, admin.email);
  await cleanupRevokedPhotoUploads(id, admin.email);
  revalidatePath('/admin/realizacie/fotky');
}

export async function cleanupRevokedPendingPhotoInviteAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const inviteId = String(formData.get('inviteId') || '');
  if (!/^[0-9a-f-]{36}$/i.test(inviteId) || await getActivePhotoUploadInvite(inviteId)) return;
  await cleanupRevokedPhotoUploads(inviteId, admin.email);
  revalidatePath('/admin/realizacie/fotky');
}

async function cleanupRevokedPhotoUploads(inviteId: string, actorEmail: string) {
  if (!privatePhotoIntakeStorageReady()) return;
  const records = await listRevokedPendingPhotoRecords(inviteId);
  for (const record of records) {
    try {
      if (record.storageDriver !== 'vercel_blob') throw new Error('Unsupported private storage driver.');
      await del(record.storageKey, privatePhotoIntakeBlobOptions());
      await completePhotoIntakeDeletion(record.id, actorEmail);
    } catch {
      try { await markPhotoIntakeDeletionFailed(record.id); } catch { /* Daily retention retries claimed items. */ }
    }
  }
}

export async function reviewPhotoAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const id = String(formData.get('id') || '');
  const approve = formData.get('decision') === 'approve';
  const expectedMetadataVersion = Number(formData.get('metadataVersion'));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(expectedMetadataVersion) || expectedMetadataVersion < 1) return;
  const reviewed = await reviewPhotoIntakeRecord({ id, approve, reviewedBy: admin.email, expectedMetadataVersion });
  revalidatePath('/admin/realizacie/fotky');
  if (!reviewed) redirect('/admin/realizacie/fotky?review=stale');
}

export async function updatePhotoIntakeMetadataAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const id = String(formData.get('id') || '');
  const localityValue = formData.get('locality');
  const categoryValues = formData.getAll('categories');
  const expectedMetadataVersion = Number(formData.get('metadataVersion'));
  if (!/^[0-9a-f-]{36}$/i.test(id) || typeof localityValue !== 'string' || localityValue.trim().length > 120) return;
  if (!Number.isInteger(expectedMetadataVersion) || expectedMetadataVersion < 1) return;
  if (categoryValues.some((value) => typeof value !== 'string' || !isPhotoCategory(value)) || new Set(categoryValues).size !== categoryValues.length) return;
  const updated = await updatePhotoIntakeMetadata({ id, locality: cleanSlovakText(localityValue), categories: categoryValues as string[], updatedBy: admin.email, expectedMetadataVersion });
  revalidatePath('/admin/realizacie/fotky');
  if (!updated) redirect('/admin/realizacie/fotky?review=stale');
}

export async function withdrawApprovedPhotoAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const id = String(formData.get('id') || '');
  const expectedMetadataVersion = Number(formData.get('metadataVersion'));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(expectedMetadataVersion) || expectedMetadataVersion < 1) return;
  const withdrawn = await withdrawApprovedPhotoIntakeRecord({ id, withdrawnBy: admin.email, expectedMetadataVersion });
  revalidatePath('/admin/realizacie/fotky');
  if (!withdrawn) redirect('/admin/realizacie/fotky?review=stale');
  revalidatePath('/realizacie');
}

export async function createCaseDraftFromPhotoAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const id = String(formData.get('id') || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const result = await createCaseDraftFromApprovedPhoto({ mediaId: id, updatedBy: admin.email });
  revalidatePath('/admin/realizacie/pripady');
  revalidatePath('/admin/realizacie/fotky');
  const hasPrefill = result.localityPrefilled || result.objectTypePrefilled;
  const outcome = result.created ? 'created' : result.lifecycle !== 'draft' ? 'existing'
    : result.attached && hasPrefill ? 'attached-metadata'
      : result.attached ? 'updated' : hasPrefill ? 'metadata' : 'unchanged';
  redirect(`/admin/realizacie/pripady?id=${encodeURIComponent(result.draftId)}&photoDraft=${outcome}`);
}
