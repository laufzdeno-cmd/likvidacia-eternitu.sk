'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/src/server/auth';
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
  const actorEmail = await requireAdmin();
  const customerName = String(formData.get('customerName') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const location = String(formData.get('location') || '').trim();
  const objectType = String(formData.get('objectType') || '').trim();
  const realizationDate = String(formData.get('realizationDate') || '').trim();
  const googleReviewLink = String(formData.get('googleReviewLink') || '').trim();

  if (!customerName || !phone || !googleReviewLink) return;

  await upsertSiteContentValues({ googleReviewLink }, actorEmail);
  const message = `Dobrý deň ${customerName}, ďakujeme za dôveru pri likvidácii azbestu${location ? ` v ${location}` : ''}. Ak ste boli spokojní, veľmi by nám pomohla recenzia na Google — trvá 2 minúty: ${googleReviewLink}\nĎakujeme, tím ASTANA`;
  await createReviewRequest({
    customerName,
    phone: normalizePhone(phone),
    location,
    objectType,
    realizationDate,
    googleReviewLink,
    message,
    createdBy: actorEmail,
  });

  revalidatePath('/admin/reviews/request');
}

export async function updateReviewRequestStatusAction(formData: FormData) {
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
