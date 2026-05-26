'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, verifyCsrf } from '@/src/server/auth';
import { createRealization, updateRealizationStatus } from '@/src/server/db';
import type { RealizationStatus } from '@/src/server/types';

const allowedStatuses: RealizationStatus[] = ['draft', 'published', 'hidden'];

function parseImageUrls(value: FormDataEntryValue | null) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function createRealizationAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = await requireAdmin();
  const status = String(formData.get('status') || 'draft') as RealizationStatus;
  const title = String(formData.get('title') || '').trim();
  const location = String(formData.get('location') || '').trim();
  const materialType = String(formData.get('materialType') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const areaEstimate = Number(formData.get('areaEstimate') || 0);
  const imageUrls = parseImageUrls(formData.get('imageUrls'));

  if (!title || !description || !allowedStatuses.includes(status)) return;

  await createRealization({
    title,
    location,
    materialType,
    description,
    areaEstimate: Number.isFinite(areaEstimate) && areaEstimate > 0 ? areaEstimate : undefined,
    imageUrls,
    status,
    featured: formData.get('featured') === 'on',
    createdBy: actorEmail,
  });

  revalidatePath('/admin/realizacie');
  revalidatePath('/');
}

export async function updateRealizationStatusAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = await requireAdmin();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as RealizationStatus;

  if (!id || !allowedStatuses.includes(status)) return;

  await updateRealizationStatus(id, status, actorEmail);
  revalidatePath('/admin/realizacie');
  revalidatePath('/');
}
