'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { archiveLead as archiveLeadRecord, clearLeadFollowup, deleteLeadFileRecord, destroyArchivedLead, listAdminUsers, restoreLead as restoreLeadRecord, updateLeadInternalNote, updateLeadStatus, updateLeadWorkflow } from '@/src/server/db';
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
    const ownerEmail = String(formData.get('ownerEmail') || '').trim().toLowerCase();
    if (ownerEmail) {
      const adminUsers = await listAdminUsers();
      if (!adminUsers.some((user) => user.active && user.email === ownerEmail)) {
        throw new Error('Vybraný vlastník dopytu nie je aktívny administrátor.');
      }
    }
    await updateLeadWorkflow(
      id,
      {
        status,
        ownerEmail,
        nextAction: String(formData.get('nextAction') || '').slice(0, 500),
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

export async function archiveLeadAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const reason = String(formData.get('reason') || '').trim().slice(0, 500);
  if (!id) return;
  if (reason.length < 3) throw new Error('Uveďte dôvod archivácie dopytu.');
  await archiveLeadRecord(id, actor, reason);
  revalidatePath('/admin/dopyty');
  revalidatePath('/admin/dashboard');
  redirect('/admin/dopyty?archived=1');
}

export async function restoreLeadAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const id = String(formData.get('id') || '');
  if (!id) return;
  await restoreLeadRecord(id, actor);
  revalidatePath('/admin/dopyty');
  revalidatePath(`/admin/dopyty/${id}`);
  revalidatePath('/admin/dashboard');
  redirect('/admin/dopyty?archived=1');
}

export async function destroyArchivedLeadAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const id = String(formData.get('id') || '');
  const reason = String(formData.get('reason') || '').trim().slice(0, 500);
  const confirmation = String(formData.get('confirmation') || '').trim();
  if (!id) return;
  if (reason.length < 3) throw new Error('Uveďte dôvod trvalého odstránenia dopytu.');
  if (confirmation !== 'TRVALO ODSTRÁNIŤ') throw new Error('Pre potvrdenie napíšte TRVALO ODSTRÁNIŤ.');
  const deleted = await destroyArchivedLead(id, actor, reason);
  if (deleted) {
    for (const file of deleted.files) await deleteStoredLeadFile(file);
  }
  revalidatePath('/admin/dopyty');
  redirect('/admin/dopyty?archived=1');
}
