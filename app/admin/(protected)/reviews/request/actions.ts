'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, verifyCsrf } from '@/src/server/auth';
import { createReviewRequest, getSiteContentMap, updateReviewRequestStatus, upsertSiteContentValues } from '@/src/server/db';
import type { ReviewRequestStatus } from '@/src/server/types';

const allowedStatuses: ReviewRequestStatus[] = ['sent', 'review_received'];

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('421')) return digits;
  if (digits.startsWith('0')) return `421${digits.slice(1)}`;
  return `421${digits}`;
}

export async function createReviewRequestAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = await requireAdmin();
  const customerName = String(formData.get('customerName') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const location = String(formData.get('location') || '').trim();
  const objectType = String(formData.get('objectType') || '').trim();
  const realizationDate = String(formData.get('realizationDate') || '').trim();
  const googleReviewLink = String(formData.get('googleReviewLink') || '').trim();
  const sentConfirmed = formData.get('sentConfirmed') === 'on';

  if (!customerName || !phone || !googleReviewLink || !sentConfirmed) {
    redirect(`/admin/reviews/request/?result=invalid&attempt=${randomUUID()}`);
  }

  await upsertSiteContentValues({ googleReviewLink }, actorEmail);
  const message = `Dobrý deň ${customerName}, ďakujeme za dôveru pri likvidácii azbestu${location ? ` v ${location}` : ''}. Ak ste boli spokojní, veľmi by nám pomohla recenzia na Google — trvá 2 minúty: ${googleReviewLink}\nĎakujeme, tím ASTANA`;
  const reviewRequest = await createReviewRequest({
    customerName,
    phone: normalizePhone(phone),
    location,
    objectType,
    realizationDate,
    googleReviewLink,
    message,
    createdBy: actorEmail,
    status: 'sent',
  });

  revalidatePath('/admin/reviews/request');
  redirect(`/admin/reviews/request/?result=saved&attempt=${reviewRequest.id}`);
}

export async function updateReviewRequestStatusAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = await requireAdmin();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as ReviewRequestStatus;
  if (!id || !allowedStatuses.includes(status)) return;
  await updateReviewRequestStatus(id, status, actorEmail);
  revalidatePath('/admin/reviews/request');
}

export async function getStoredGoogleReviewLink() {
  const content = await getSiteContentMap();
  return content.googleReviewLink || '';
}
