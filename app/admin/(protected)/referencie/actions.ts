'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/src/server/auth';
import { createTestimonial, updateTestimonialStatus } from '@/src/server/db';
import type { TestimonialStatus } from '@/src/server/types';

const allowedStatuses: TestimonialStatus[] = ['draft', 'approved', 'hidden'];
const sourceMap: Record<string, 'admin' | 'public' | 'google' | 'phone' | 'whatsapp' | 'email' | 'personal'> = {
  Google: 'google',
  Telefón: 'phone',
  WhatsApp: 'whatsapp',
  Email: 'email',
  Osobne: 'personal',
};

export async function createTestimonialAction(formData: FormData) {
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

  if (!customerName || !text || !allowedStatuses.includes(status)) {
    return;
  }

  await createTestimonial(
    {
      customerName,
      location,
      objectType,
      realizationDate,
      text,
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      status,
      customerEmail,
      consentPublication: formData.get('consentPublication') === 'on',
      source: sourceMap[sourceValue] ?? 'admin',
      internalNote,
      photoUrl,
    },
    actorEmail,
  );

  revalidatePath('/admin/referencie');
  revalidatePath('/');
}

export async function updateTestimonialStatusAction(formData: FormData) {
  const actorEmail = await requireAdmin();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as TestimonialStatus;

  if (!id || !allowedStatuses.includes(status)) return;

  await updateTestimonialStatus(id, status, actorEmail);
  revalidatePath('/admin/referencie');
  revalidatePath('/');
}
