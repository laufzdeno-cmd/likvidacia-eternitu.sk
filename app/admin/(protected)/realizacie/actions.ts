'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAdmin, requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { createRealization, listRealizations, updateRealizationStatus } from '@/src/server/db';
import { checkPublicRealizationImagesAvailable, normalizePublicRealizationImageUrl } from '@/src/server/public-realization-image.mjs';
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
  const title = String(formData.get('title') || '').trim();
  const location = String(formData.get('location') || '').trim();
  const materialType = String(formData.get('materialType') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const areaEstimate = Number(formData.get('areaEstimate') || 0);
  const imageUrls = parseImageUrls(formData.get('imageUrls'));

  if (!title || !description) return;
  const normalizedImageUrls = imageUrls.map(normalizePublicRealizationImageUrl);
  if (normalizedImageUrls.some((url) => url === null)) {
    redirect('/admin/realizacie?error=fotky');
  }

  await createRealization({
    title,
    location,
    materialType,
    description,
    areaEstimate: Number.isFinite(areaEstimate) && areaEstimate > 0 ? areaEstimate : undefined,
    imageUrls: normalizedImageUrls.filter((url): url is string => url !== null),
    status: 'draft',
    featured: formData.get('featured') === 'on',
    createdBy: actorEmail,
  });

  revalidatePath('/admin/realizacie');
  revalidatePath('/realizacie');
  revalidatePath('/');
}

export async function updateRealizationStatusAction(formData: FormData) {
  await verifyCsrf(formData);
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as RealizationStatus;
  const actorEmail = status === 'published'
    ? (await requireSuperAdmin()).email
    : await requireAdmin();
  const rightsConfirmed = formData.get('publicationRightsConfirmed') === 'on';
  const locationConfirmed = formData.get('publicationLocationConfirmed') === 'on';
  const evidence = String(formData.get('publicationEvidence') || '').trim();

  if (!id || !allowedStatuses.includes(status)) return;
  if (status === 'published' && (!rightsConfirmed || !locationConfirmed || evidence.length < 4)) {
    redirect('/admin/realizacie?error=schvalenie');
  }
  if (status === 'published') {
    const realization = (await listRealizations()).find((item) => item.id === id);
    if (!realization) redirect('/admin/realizacie?error=fotky');
    if (realization.status !== 'published') {
      const availability = await checkPublicRealizationImagesAvailable(realization.imageUrls, {
        requestHost: (await headers()).get('host'),
      });
      if (!availability.available) {
        redirect(availability.reason === 'verification-unavailable'
          ? '/admin/realizacie?error=foto-overenie'
          : '/admin/realizacie?error=fotky-nedostupne');
      }
    }
  }

  await updateRealizationStatus(id, status, actorEmail, {
    evidence,
    rightsConfirmed,
    locationConfirmed,
  });
  revalidatePath('/admin/realizacie');
  revalidatePath('/realizacie');
  revalidatePath('/');
}
