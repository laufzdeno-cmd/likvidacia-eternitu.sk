'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, verifyCsrf } from '@/src/server/auth';
import { clearLeadFollowup, deleteLeadFileRecord, updateLeadInternalNote, updateLeadStatus, updateLeadWorkflow } from '@/src/server/db';
import { deleteStoredLeadFile } from '@/src/server/storage';
import type { LeadStatus } from '@/src/server/types';

const allowedStatuses = new Set<LeadStatus>([
  'novy',
  'kontaktovany',
  'caka_na_doplnenie',
  'naceneny',
  'cenova_ponuka_odoslana',
  'objednane',
  'v_realizacii',
  'dokoncena',
  'zrusena',
  'nevyslo',
  'archivovane',
]);

export async function saveLeadStatus(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as LeadStatus;
  if (id && allowedStatuses.has(status)) {
    await updateLeadStatus(id, status, actor);
    revalidatePath(`/admin/dopyty/${id}`);
    revalidatePath('/admin/dopyty');
    revalidatePath(`/admin/zakazky/${id}`);
    revalidatePath('/admin/zakazky');
  }
}

export async function saveLeadWorkflow(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as LeadStatus;
  if (id && allowedStatuses.has(status)) {
    await updateLeadWorkflow(
      id,
      {
        status,
        followupDate: String(formData.get('followupDate') || ''),
        followupNote: String(formData.get('followupNote') || '').slice(0, 1000),
        rejectionReason: String(formData.get('rejectionReason') || '').slice(0, 1000),
      },
      actor,
    );
    revalidatePath(`/admin/dopyty/${id}`);
    revalidatePath('/admin/dopyty');
    revalidatePath('/admin/dashboard');
  }
}

export async function cancelLeadFollowup(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  if (id) {
    await clearLeadFollowup(id, actor);
    revalidatePath(`/admin/dopyty/${id}`);
    revalidatePath('/admin/dashboard');
  }
}

export async function saveInternalNote(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const internalNote = String(formData.get('internalNote') || '').slice(0, 5000);
  if (id) {
    await updateLeadInternalNote(id, internalNote, actor);
    revalidatePath(`/admin/dopyty/${id}`);
    revalidatePath(`/admin/zakazky/${id}`);
  }
}

export async function deleteLeadFileAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const fileId = String(formData.get('fileId') || '');
  const leadId = String(formData.get('leadId') || '');
  if (!fileId || !leadId) return;
  const file = await deleteLeadFileRecord(fileId, actor);
  if (file) await deleteStoredLeadFile(file);
  revalidatePath(`/admin/dopyty/${leadId}`);
}
