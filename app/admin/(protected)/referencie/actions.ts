'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/src/server/auth';
import { createTestimonial, updateTestimonialStatus } from '@/src/server/db';
import type { TestimonialStatus } from '@/src/server/types';

const allowedStatuses: TestimonialStatus[] = ['draft', 'approved', 'hidden'];

export async function createTestimonialAction(formData: FormData) {
  const actorEmail = await requireAdmin();
  const customerName = String(formData.get('customerName') || '').trim();
  const location = String(formData.get('location') || '').trim();
  const text = String(formData.get('text') || '').trim();
  const rating = Number(formData.get('rating') || 5);
  const status = String(formData.get('status') || 'draft') as TestimonialStatus;

  if (!customerName || !text || !allowedStatuses.includes(status)) {
    return;
  }

  await createTestimonial(
    {
      customerName,
      location,
      text,
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      status,
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
