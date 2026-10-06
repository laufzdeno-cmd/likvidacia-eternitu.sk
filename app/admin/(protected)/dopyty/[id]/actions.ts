'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { addAuditLog, archiveLead as archiveLeadRecord, clearLeadFollowup, deleteLeadFileRecord, destroyArchivedLead, getBusinessJobIdByLeadId, getLeadWithFiles, listAdminUsers, prepareLeadEmailRecipientManualRetry, recordLeadEmailRecipientResult, resolveLeadEmailRecipientDelivery, restoreLead as restoreLeadRecord, setLeadTestData, updateLeadInternalNote, updateLeadStatus, updateLeadWorkflow } from '@/src/server/db';
import { canManuallyRetryLeadEmail, sendLeadEmailToRecipient } from '@/src/server/mail';
import { isLeadEmailEvidenceValid } from '@/src/server/lead-email-evidence.mjs';
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

export async function setLeadTestDataAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const id = String(formData.get('id') || '');
  const rawValue = String(formData.get('isTestData') || '');
  const reason = String(formData.get('reason') || '').trim();
  if (!id || (rawValue !== 'true' && rawValue !== 'false')) throw new Error('Neplatná zmena klasifikácie dopytu.');
  if (!reason) throw new Error('Vyberte dôvod zmeny klasifikácie.');
  const changed = await setLeadTestData(id, rawValue === 'true', actor, reason);
  if (!changed) throw new Error('Dopyt sa nenašiel. Obnovte stránku.');
  revalidatePath(`/admin/dopyty/${id}`);
  revalidatePath('/admin/dopyty');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/zakazky');
  revalidatePath('/realizacie');
}

export async function deleteLeadFileAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const fileId = String(formData.get('fileId') || '');
  const leadId = String(formData.get('leadId') || '');
  if (!fileId || !leadId) return;
  await deleteLeadFileRecord(fileId, actor);
  revalidatePath(`/admin/dopyty/${leadId}`);
}

export async function resendLeadEmailRecipientAfterReview(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const recipientRole = String(formData.get('recipientRole') || '');
  const confirmation = String(formData.get('checkedDelivery') || '');
  const evidence = String(formData.get('evidence') || '');
  if (!id || (recipientRole !== 'customer' && recipientRole !== 'internal') || confirmation !== 'yes' || !isLeadEmailEvidenceValid('failed', evidence)) {
    throw new Error('Pred opakovaným odoslaním potvrďte kontrolu schránky a logu poskytovateľa pre vybraného príjemcu.');
  }
  if (!canManuallyRetryLeadEmail()) throw new Error('Jednotlivé opakovanie vyžaduje pripravené SMTP.');
  const lead = await getLeadWithFiles(id, true);
  if (!lead || lead.deletedAt) throw new Error('Archivovaný alebo odstránený dopyt nemožno znova odoslať.');
  const businessJobId = recipientRole === 'internal' ? await getBusinessJobIdByLeadId(id) || undefined : undefined;
  const attemptLockedAt = await prepareLeadEmailRecipientManualRetry(id, recipientRole, actor, evidence);
  if (!attemptLockedAt) throw new Error('Tento príjemca už má potvrdené doručenie alebo jeho stav nie je bezpečne obnoviteľný.');

  const result = await sendLeadEmailToRecipient(lead, recipientRole, lead.files.length, businessJobId);
  // After an explicit manual retry, another attempt always needs a fresh delivery check.
  const recorded = await recordLeadEmailRecipientResult(id, recipientRole, { ...result, retryable: false }, attemptLockedAt, actor);
  if (!recorded) await addAuditLog('lead', id, 'lead_email_manual_retry_stale_result', actor, { recipientRole, attemptLockedAt });
  revalidatePath(`/admin/dopyty/${id}`);
}

export async function resolveLeadEmailDeliveryAfterReview(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const recipientRole = String(formData.get('recipientRole') || '');
  const outcome = String(formData.get('outcome') || '');
  const evidence = String(formData.get('evidence') || '');
  const confirmation = String(formData.get('checkedDelivery') || '');
  if (!id || (recipientRole !== 'customer' && recipientRole !== 'internal') || (outcome !== 'sent' && outcome !== 'failed') || confirmation !== 'yes' || !isLeadEmailEvidenceValid(outcome, evidence)) {
    throw new Error('Vyberte výsledok kontroly a uveďte stručný dôkaz z inboxu alebo logu poskytovateľa.');
  }
  const lead = await getLeadWithFiles(id, true);
  if (!lead || lead.deletedAt) throw new Error('Archivovaný alebo odstránený dopyt nemožno meniť.');
  const resolved = await resolveLeadEmailRecipientDelivery(id, recipientRole, outcome, actor, evidence, confirmation);
  if (!resolved) throw new Error('Stav už bol zmenený alebo dopyt nemá nevyriešený výsledok. Obnovte stránku.');
  revalidatePath(`/admin/dopyty/${id}`);
}

export async function archiveLeadAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const reason = String(formData.get('reason') || '').trim().slice(0, 500);
  if (!id) return;
  if (reason.length < 3) throw new Error('Uveďte dôvod archivácie dopytu.');
  const archived = await archiveLeadRecord(id, actor, reason);
  if (!archived) throw new Error('Dopyt sa nepodarilo archivovať; môže práve prebiehať odosielanie emailu. Obnovte stránku.');
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
  await destroyArchivedLead(id, actor, reason);
  revalidatePath('/admin/dopyty');
  redirect('/admin/dopyty?archived=1');
}
