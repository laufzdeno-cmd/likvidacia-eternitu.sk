'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { saveRealizationCaseDraft, setRealizationCaseDraftMedia, transitionRealizationCaseDraft, updateRealizationCaseDraftMediaMetadata } from '@/src/server/db';
import type { RealizationCaseDraft } from '@/src/server/types';
import { cleanSlovakText } from '@/src/server/slovak-text';

function text(formData: FormData, key: string, max: number) {
  const value = formData.get(key);
  if (typeof value !== 'string') throw new Error('Formulár obsahuje neplatnú hodnotu.');
  return cleanSlovakText(value).trim().slice(0, max);
}

export async function saveCaseDraftAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const id = text(formData, 'id', 36);
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Neplatný identifikátor konceptu.');
  const businessJobId = text(formData, 'businessJobId', 36);
  if (!id && !/^[0-9a-f-]{36}$/i.test(businessJobId)) throw new Error('Vyberte dokončenú CRM zákazku.');
  const localityPrecision = text(formData, 'localityPrecision', 20);
  if (!(['none', 'municipality', 'district'] as string[]).includes(localityPrecision)) throw new Error('Neplatná presnosť lokality.');
  const areaRaw = text(formData, 'areaEstimate', 24);
  const areaEstimate = areaRaw ? Number(areaRaw.replace(',', '.')) : undefined;
  if (areaEstimate !== undefined && (!Number.isFinite(areaEstimate) || areaEstimate <= 0 || areaEstimate > 1000000)) throw new Error('Výmera musí byť kladné číslo najviac 1 000 000 m².');
  const result = await saveRealizationCaseDraft({
    id: id || undefined,
    businessJobId: businessJobId || undefined,
    title: text(formData, 'title', 160),
    locality: text(formData, 'locality', 120),
    localityPrecision: localityPrecision as RealizationCaseDraft['localityPrecision'],
    objectType: text(formData, 'objectType', 100),
    materialType: text(formData, 'materialType', 100),
    workDescription: text(formData, 'workDescription', 3000),
    resultDescription: text(formData, 'resultDescription', 3000),
    areaEstimate,
    workPeriod: text(formData, 'workPeriod', 80),
    updatedBy: admin.email,
  });
  revalidatePath('/admin/realizacie/pripady');
  revalidatePath('/admin/realizacie');
  return result.id;
}

export async function setCaseDraftPhotoAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const draftId = text(formData, 'draftId', 36);
  const mediaId = text(formData, 'mediaId', 36);
  const attachValue = formData.get('attach');
  if (attachValue !== 'true' && attachValue !== 'false') throw new Error('Neplatná akcia fotografie.');
  const attach = attachValue === 'true';
  if (!/^[0-9a-f-]{36}$/i.test(draftId) || !/^[0-9a-f-]{36}$/i.test(mediaId)) throw new Error('Neplatný koncept alebo fotografia.');
  await setRealizationCaseDraftMedia({ draftId, mediaId, attach, updatedBy: admin.email });
  revalidatePath('/admin/realizacie/pripady');
}

export async function updateCaseDraftPhotoMetadataAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const draftId = text(formData, 'draftId', 36);
  const mediaId = text(formData, 'mediaId', 36);
  const phase = text(formData, 'phase', 16);
  const sortOrderRaw = text(formData, 'sortOrder', 4);
  const sortOrder = Number(sortOrderRaw);
  if (!/^[0-9a-f-]{36}$/i.test(draftId) || !/^[0-9a-f-]{36}$/i.test(mediaId)) throw new Error('Neplatný koncept alebo fotografia.');
  if (!(['before', 'during', 'after'] as string[]).includes(phase)) throw new Error('Neplatná fáza fotografie.');
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) throw new Error('Poradie fotografie musí byť celé číslo od 0 do 999.');
  await updateRealizationCaseDraftMediaMetadata({
    draftId,
    mediaId,
    phase: phase as 'before' | 'during' | 'after',
    publicCaption: text(formData, 'publicCaption', 240),
    sortOrder,
    updatedBy: admin.email,
  });
  revalidatePath('/admin/realizacie/pripady');
  revalidatePath('/realizacie');
}

export async function transitionCaseDraftAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const draftId = text(formData, 'draftId', 36);
  const nextLifecycle = text(formData, 'nextLifecycle', 20);
  if (!/^[0-9a-f-]{36}$/i.test(draftId)) throw new Error('Neplatný identifikátor prípadu.');
  if (!(['draft', 'reviewed', 'approved', 'published', 'withdrawn'] as string[]).includes(nextLifecycle)) {
    throw new Error('Neplatný cieľový stav prípadu.');
  }
  const publicationEvidence = nextLifecycle === 'approved' ? text(formData, 'publicationEvidence', 500) : '';
  await transitionRealizationCaseDraft({
    draftId,
    nextLifecycle: nextLifecycle as RealizationCaseDraft['lifecycle'],
    updatedBy: admin.email,
    publicationEvidence,
    rightsConfirmed: formData.get('rightsConfirmed') === 'on',
    locationConfirmed: formData.get('locationConfirmed') === 'on',
    contentConfirmed: formData.get('contentConfirmed') === 'on',
  });
  revalidatePath('/admin/realizacie/pripady');
  revalidatePath('/realizacie');
}

export async function approveAndPublishCaseDraftAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const draftId = text(formData, 'draftId', 36);
  if (!/^[0-9a-f-]{36}$/i.test(draftId)) throw new Error('Neplatný identifikátor prípadu.');
  const publicationEvidence = text(formData, 'publicationEvidence', 500);
  const rightsConfirmed = formData.get('rightsConfirmed') === 'on';
  const locationConfirmed = formData.get('locationConfirmed') === 'on';
  const contentConfirmed = formData.get('contentConfirmed') === 'on';
  await transitionRealizationCaseDraft({
    draftId, nextLifecycle: 'approved', updatedBy: admin.email, publicationEvidence,
    rightsConfirmed, locationConfirmed, contentConfirmed,
  });
  await transitionRealizationCaseDraft({ draftId, nextLifecycle: 'published', updatedBy: admin.email });
  revalidatePath('/admin/realizacie/pripady');
  revalidatePath('/realizacie');
}
