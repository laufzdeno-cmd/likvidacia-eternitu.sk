'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdminUser, requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import {
  approveRequestedTestimonial,
  cancelReviewRequest,
  claimReviewReminder,
  claimReviewRequestForDelivery,
  completeReviewRequestDelivery,
  createReviewRequest,
  listEligibleReviewJobs,
  listReviewRequests,
  publishRequestedTestimonial,
  recordReviewReminderResult,
  resolveUnknownReviewRequestDelivery,
  setReviewJobBlocked,
  upsertSiteContentValues,
} from '@/src/server/db';
import { sendReviewRequestEmail } from '@/src/server/review-request-mail';
import { getReviewRequestSettings } from '@/src/server/review-request-settings';
import { canProcessReviewRequestSelection, maxReviewBatchLimit } from '@/src/server/review-request-policy';

const uuid = z.string().uuid();
const revision = z.coerce.number().int().positive();

function finish(notice: string): never {
  revalidatePath('/admin/referencie');
  revalidatePath('/admin/asistent');
  redirect(`/admin/referencie?notice=${encodeURIComponent(notice)}`);
}

export async function prepareReviewRequestsAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  const parsed = z.array(uuid).min(1).max(maxReviewBatchLimit).safeParse(formData.getAll('jobId').map(String));
  if (!parsed.success) finish('invalid_selection');
  const jobIds = [...new Set(parsed.data)];
  const [eligible, settings] = await Promise.all([listEligibleReviewJobs(), getReviewRequestSettings()]);
  if (!canProcessReviewRequestSelection(admin.role, jobIds.length, settings.batchLimit)) {
    finish(admin.role === 'SUPER_ADMIN' ? 'batch_limit' : 'bulk_denied');
  }
  const eligibleById = new Map(eligible.map((job) => [job.id, job]));
  if (jobIds.some((id) => !eligibleById.has(id))) finish('not_eligible');
  const reminderAllowed = settings.reminderEnabled && formData.get('reminderAllowed') === 'on';
  for (const id of jobIds) {
    const job = eligibleById.get(id)!;
    await createReviewRequest({
      jobId: job.id,
      leadId: job.leadId,
      customerName: job.customerName,
      customerEmail: job.customerEmail,
      phone: job.customerPhone,
      location: job.location,
      objectType: job.objectType,
      realizationDate: job.realizationDate,
      googleReviewLink: settings.googleReviewLink,
      subject: settings.subject,
      message: settings.body,
      reminderAllowed,
      status: 'pending_approval',
      createdBy: admin.email,
    });
  }
  finish(jobIds.length === 1 ? 'prepared' : 'prepared_bulk');
}

export async function sendApprovedReviewRequestsAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  if (formData.get('confirmSend') !== 'on') finish('confirmation_required');
  const ids = [...new Set(formData.getAll('requestId').map(String))];
  const parsed = z.array(uuid).min(1).max(maxReviewBatchLimit).safeParse(ids);
  if (!parsed.success) finish('invalid_selection');
  const settings = await getReviewRequestSettings();
  if (!canProcessReviewRequestSelection(admin.role, parsed.data.length, settings.batchLimit)) {
    finish(admin.role === 'SUPER_ADMIN' ? 'batch_limit' : 'bulk_denied');
  }
  const current = new Map((await listReviewRequests()).map((request) => [request.id, request]));
  let accepted = 0;
  let failed = 0;
  let unknown = 0;
  for (const id of parsed.data) {
    const existing = current.get(id);
    if (!existing) continue;
    const claimed = await claimReviewRequestForDelivery(id, existing.revision, admin.email);
    if (!claimed) continue;
    const outcome = await sendReviewRequestEmail(claimed.request, claimed.token, claimed.request.message);
    const completed = await completeReviewRequestDelivery(
      claimed.request.id, claimed.request.revision, outcome, admin.email, settings.reminderDays,
    );
    if (!completed) {
      unknown += 1;
      continue;
    }
    if (outcome.status === 'smtp_accepted') accepted += 1;
    else if (outcome.status === 'delivery_failed') failed += 1;
    else unknown += 1;
  }
  finish(`delivery_${accepted}_${failed}_${unknown}`);
}

export async function sendReviewReminderAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  if (formData.get('confirmReminder') !== 'on') finish('confirmation_required');
  const parsed = z.object({ id: uuid, revision }).safeParse({ id: formData.get('id'), revision: formData.get('revision') });
  if (!parsed.success) finish('invalid_selection');
  const settings = await getReviewRequestSettings();
  if (!settings.reminderEnabled) finish('reminder_disabled');
  const claimed = await claimReviewReminder(parsed.data.id, parsed.data.revision, admin.email);
  if (!claimed) finish('reminder_not_due');
  const outcome = await sendReviewRequestEmail(claimed.request, claimed.token, settings.reminderBody, { reminder: true });
  const completed = await recordReviewReminderResult(claimed.request.id, claimed.request.revision, outcome, admin.email);
  if (!completed) finish('reminder_result_stale');
  finish(outcome.status === 'smtp_accepted'
    ? 'reminder_sent'
    : outcome.status === 'delivery_unknown' ? 'reminder_unknown' : 'reminder_failed');
}

export async function resolveUnknownReviewRequestDeliveryAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  const parsed = z.object({
    id: uuid,
    revision,
    resolution: z.enum(['smtp_accepted', 'not_sent']),
    confirmed: z.literal('on'),
  }).safeParse({
    id: formData.get('id'),
    revision: formData.get('revision'),
    resolution: formData.get('resolution'),
    confirmed: formData.get('confirmed'),
  });
  if (!parsed.success) finish('resolution_confirmation_required');
  const settings = await getReviewRequestSettings();
  const resolved = await resolveUnknownReviewRequestDelivery(
    parsed.data.id,
    parsed.data.revision,
    parsed.data.resolution,
    admin.email,
    settings.reminderDays,
  );
  finish(resolved ? 'delivery_resolved' : 'delivery_resolution_stale');
}

export async function cancelReviewRequestAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) finish('invalid_selection');
  const cancelled = await cancelReviewRequest(id.data, admin.email);
  finish(cancelled ? 'cancelled' : 'cancellation_stale');
}

export async function setReviewJobBlockedAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  const parsed = z.object({ id: uuid, blocked: z.enum(['true', 'false']), reason: z.string().trim().max(500) })
    .safeParse({ id: formData.get('id'), blocked: formData.get('blocked'), reason: formData.get('reason') || '' });
  if (!parsed.success || (parsed.data.blocked === 'true' && parsed.data.reason.length < 3)) finish('invalid_block');
  await setReviewJobBlocked(parsed.data.id, parsed.data.blocked === 'true', parsed.data.reason, admin.email);
  finish(parsed.data.blocked === 'true' ? 'blocked' : 'unblocked');
}

export async function approveRequestedTestimonialAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  const id = uuid.safeParse(formData.get('testimonialId'));
  if (!id.success) finish('invalid_selection');
  const approved = await approveRequestedTestimonial(id.data, admin.email);
  finish(approved ? 'approved' : 'approval_stale');
}

export async function publishRequestedTestimonialAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const id = uuid.safeParse(formData.get('testimonialId'));
  if (!id.success) finish('invalid_selection');
  const published = await publishRequestedTestimonial(id.data, admin.email);
  finish(published ? 'published' : 'publication_stale');
}

export async function approveAndPublishRequestedTestimonialAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const id = uuid.safeParse(formData.get('testimonialId'));
  if (!id.success) finish('invalid_selection');
  const approved = await approveRequestedTestimonial(id.data, admin.email);
  if (!approved) finish('approval_stale');
  const published = await publishRequestedTestimonial(id.data, admin.email);
  finish(published ? 'published' : 'publication_stale');
}

export async function saveReviewRequestSettingsAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const parsed = z.object({
    subject: z.string().trim().min(5).max(160),
    body: z.string().trim().min(20).max(4000),
    reminderBody: z.string().trim().min(20).max(4000),
    reminderDays: z.coerce.number().int().min(5).max(7),
    batchLimit: z.coerce.number().int().min(1).max(maxReviewBatchLimit),
    googleReviewLink: z.string().trim().url().max(2048).or(z.literal('')),
    reminderEnabled: z.boolean(),
  }).safeParse({
    subject: formData.get('subject'), body: formData.get('body'), reminderBody: formData.get('reminderBody'),
    reminderDays: formData.get('reminderDays'), batchLimit: formData.get('batchLimit'),
    googleReviewLink: formData.get('googleReviewLink') || '', reminderEnabled: formData.get('reminderEnabled') === 'on',
  });
  if (!parsed.success || !parsed.data.body.includes('{{odkaz}}') || !parsed.data.reminderBody.includes('{{odkaz}}')) finish('invalid_settings');
  await upsertSiteContentValues({
    reviewRequestSubject: parsed.data.subject,
    reviewRequestBody: parsed.data.body,
    reviewRequestReminderBody: parsed.data.reminderBody,
    reviewRequestReminderDays: String(parsed.data.reminderDays),
    reviewRequestBatchLimit: String(parsed.data.batchLimit),
    reviewRequestReminderEnabled: String(parsed.data.reminderEnabled),
    googleReviewLink: parsed.data.googleReviewLink,
  }, admin.email);
  finish('settings_saved');
}
