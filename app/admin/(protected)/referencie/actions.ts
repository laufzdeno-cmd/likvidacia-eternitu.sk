'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, verifyCsrf } from '@/src/server/auth';
import { createTestimonial, updateTestimonial, updateTestimonialStatus } from '@/src/server/db';
import type { TestimonialInput, TestimonialStatus } from '@/src/server/types';
import { redirect } from 'next/navigation';
import {
  adminTestimonialConsentVersion,
  formatAdminTestimonialConsentEvidence,
  isValidAdminTestimonialConsentEvidence,
  testimonialConsentEvidenceSources,
} from '@/src/lib/testimonial-consent';
import { testimonialPublicContentHash } from '@/src/server/testimonial-policy';

const allowedStatuses: TestimonialStatus[] = ['draft', 'approved', 'hidden'];
const allowedSources = ['admin', 'public', 'google', 'phone', 'whatsapp', 'email', 'personal'] as const;
const sourceMap: Record<string, 'admin' | 'public' | 'google' | 'phone' | 'whatsapp' | 'email' | 'personal'> = {
  Google: 'google',
  Telefón: 'phone',
  WhatsApp: 'whatsapp',
  Email: 'email',
  Osobne: 'personal',
};

const UUID_RE = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function readText(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) ?? '').trim();
  return value.length <= maxLength ? value : null;
}

function isValidOptionalEmail(value: string) {
  return !value || (value.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

export async function createTestimonialAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = await requireAdmin();
  const customerName = String(formData.get('customerName') || '').trim();
  const location = String(formData.get('location') || '').trim();
  const objectType = String(formData.get('objectType') || '').trim();
  const realizationDate = String(formData.get('realizationDate') || '').trim();
  const text = String(formData.get('text') || '').trim();
  const customerEmail = String(formData.get('customerEmail') || '').trim();
  const internalNote = String(formData.get('internalNote') || '').trim();
  const photoUrl = String(formData.get('photoUrl') || '').trim();
  const rating = Number(formData.get('rating') || 5);
  const status = String(formData.get('status') || 'draft') as TestimonialStatus;
  const sourceValue = String(formData.get('source') || 'admin');
  const consentPublication = formData.get('consentPublication') === 'on';
  const consentWording = readText(formData, 'consentWording', 2000);
  const consentSource = readText(formData, 'consentSource', 40);
  const consentDate = readText(formData, 'consentDate', 10);
  const ratingValue = Math.min(5, Math.max(1, Math.round(rating)));
  const contentHash = testimonialPublicContentHash(customerName, ratingValue, text);
  const consentEvidence = consentPublication && consentWording && consentSource && consentDate
    ? formatAdminTestimonialConsentEvidence(consentWording, consentSource as (typeof testimonialConsentEvidenceSources)[number], consentDate, contentHash)
    : '';

  if (!customerName || !text || !allowedStatuses.includes(status)) {
    redirect('/admin/referencie?chyba=udaje');
  }
  if (consentPublication && (consentWording === null || !testimonialConsentEvidenceSources.includes(consentSource as (typeof testimonialConsentEvidenceSources)[number]) || !consentDate || !isValidAdminTestimonialConsentEvidence(consentEvidence))) redirect('/admin/referencie?chyba=suhlas');
  if (status === 'approved' && !consentPublication) redirect('/admin/referencie?chyba=suhlas');

  await createTestimonial(
    {
      customerName,
      location,
      objectType,
      realizationDate,
      text,
      rating: ratingValue,
      status,
      customerEmail,
      consentPublication,
      consentEvidence,
      consentCapturedAt: consentPublication ? new Date().toISOString() : undefined,
      consentVersion: consentPublication ? adminTestimonialConsentVersion : '',
      source: sourceMap[sourceValue] ?? 'admin',
      internalNote,
      photoUrl,
    },
    actorEmail,
  );

  revalidatePath('/admin/referencie');
  revalidatePath('/recenzie/');
  revalidatePath('/');
  redirect('/admin/referencie?ulozene=1');
}

export async function updateTestimonialStatusAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = await requireAdmin();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as TestimonialStatus;

  if (!UUID_RE.test(id)) redirect('/admin/referencie?chyba=id');
  if (!allowedStatuses.includes(status)) redirect('/admin/referencie?chyba=udaje');
  if (status === 'approved') redirect('/admin/referencie?chyba=schvalenie');

  await updateTestimonialStatus(id, status, actorEmail);
  revalidatePath('/admin/referencie');
  revalidatePath('/recenzie/');
  revalidatePath('/');
}

export async function updateTestimonialAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = await requireAdmin();
  const id = String(formData.get('id') || '').trim();
  if (!UUID_RE.test(id)) redirect('/admin/referencie?chyba=id');

  const editUrl = `/admin/referencie?edit=${encodeURIComponent(id)}`;
  const customerName = readText(formData, 'customerName', 120);
  const location = readText(formData, 'location', 120);
  const objectType = readText(formData, 'objectType', 120);
  const realizationDate = readText(formData, 'realizationDate', 40);
  const text = readText(formData, 'text', 1200);
  const customerEmail = readText(formData, 'customerEmail', 160);
  const internalNote = readText(formData, 'internalNote', 2000);
  const photoUrl = readText(formData, 'photoUrl', 2048);
  const rating = Number(formData.get('rating'));
  const status = String(formData.get('status') || '') as TestimonialStatus;
  const source = String(formData.get('source') || 'admin');
  const consentPublication = formData.get('consentPublication') === 'on';
  const consentWording = readText(formData, 'consentWording', 2000);
  const consentSource = readText(formData, 'consentSource', 40);
  const consentDate = readText(formData, 'consentDate', 10);
  const consentEvidence = consentPublication && consentWording && consentSource && consentDate
    ? formatAdminTestimonialConsentEvidence(consentWording, consentSource as (typeof testimonialConsentEvidenceSources)[number], consentDate, testimonialPublicContentHash(customerName ?? '', rating, text ?? ''))
    : '';

  if (
    customerName === null || customerName.length < 2
    || location === null || objectType === null || realizationDate === null
    || text === null || text.length < 1
    || customerEmail === null || !isValidOptionalEmail(customerEmail)
    || internalNote === null || photoUrl === null
    || !Number.isInteger(rating) || rating < 1 || rating > 5
    || !allowedStatuses.includes(status)
    || !allowedSources.includes(source as (typeof allowedSources)[number])
  ) {
    redirect(`${editUrl}&chyba=udaje`);
  }

  if (consentWording === null) redirect(`${editUrl}&chyba=suhlas`);
  if (consentPublication && (!testimonialConsentEvidenceSources.includes(consentSource as (typeof testimonialConsentEvidenceSources)[number]) || !consentDate || !isValidAdminTestimonialConsentEvidence(consentEvidence))) redirect(`${editUrl}&chyba=suhlas`);
  if (status === 'approved' && !consentPublication) redirect(`${editUrl}&chyba=suhlas`);

  const input: TestimonialInput = {
    customerName,
    location,
    objectType,
    realizationDate,
    text,
    customerEmail,
    rating,
    status,
    source: source as NonNullable<TestimonialInput['source']>,
    internalNote,
    photoUrl,
    consentPublication,
    consentEvidence,
    consentCapturedAt: consentPublication ? new Date().toISOString() : undefined,
    consentVersion: consentPublication ? adminTestimonialConsentVersion : '',
  };
  const updated = await updateTestimonial(id, input, actorEmail);
  if (!updated) redirect('/admin/referencie?chyba=nenajdene');

  revalidatePath('/admin/referencie');
  revalidatePath('/recenzie/');
  revalidatePath('/');
  redirect('/admin/referencie?ulozene=1');
}
