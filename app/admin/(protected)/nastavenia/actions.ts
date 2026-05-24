'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/src/server/auth';
import { deleteLandfillPrice, saveBusinessSettings, upsertLandfillPrice, upsertWorker } from '@/src/server/db';
import type { BusinessLandfill } from '@/src/server/types';

function num(value: FormDataEntryValue | null) {
  return Number(String(value || '').replace(',', '.')) || 0;
}

export async function saveWorkerAction(formData: FormData) {
  await requireAdmin();
  await upsertWorker({
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') || '').trim(),
    ratePerM2: num(formData.get('ratePerM2')),
    active: formData.get('active') === 'on',
  });
  revalidatePath('/admin/nastavenia');
}

export async function saveLandfillPriceAction(formData: FormData) {
  await requireAdmin();
  await upsertLandfillPrice({
    id: String(formData.get('id') || '') || undefined,
    year: Number(formData.get('year') || new Date().getFullYear()),
    landfill: String(formData.get('landfill') || 'MOCHOVCE') as BusinessLandfill,
    pricePerTon: num(formData.get('pricePerTon')),
  });
  revalidatePath('/admin/nastavenia');
}

export async function deleteLandfillPriceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') || '');
  if (id) await deleteLandfillPrice(id);
  revalidatePath('/admin/nastavenia');
}

export async function saveGeneralSettingsAction(formData: FormData) {
  const actor = await requireAdmin();
  await saveBusinessSettings({
    defaultPricePerM2: num(formData.get('defaultPricePerM2')),
    googleReviewLink: String(formData.get('googleReviewLink') || '').trim(),
  }, actor);
  revalidatePath('/admin/nastavenia');
}
