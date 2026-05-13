'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/src/server/auth';
import { updateLeadInternalNote, updateLeadStatus } from '@/src/server/db';
import type { LeadStatus } from '@/src/server/types';

const allowedStatuses = new Set<LeadStatus>([
  'novy',
  'caka_na_doplnenie',
  'naceneny',
  'cenova_ponuka_odoslana',
  'objednane',
  'nevyslo',
  'archivovane',
]);

export async function saveLeadStatus(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as LeadStatus;
  if (id && allowedStatuses.has(status)) {
    await updateLeadStatus(id, status, actor);
    revalidatePath(`/admin/dopyty/${id}`);
    revalidatePath('/admin/dopyty');
  }
}

export async function saveInternalNote(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const internalNote = String(formData.get('internalNote') || '').slice(0, 5000);
  if (id) {
    await updateLeadInternalNote(id, internalNote, actor);
    revalidatePath(`/admin/dopyty/${id}`);
  }
}
