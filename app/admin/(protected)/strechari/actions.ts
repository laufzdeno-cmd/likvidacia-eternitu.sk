'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/src/server/auth';
import { createRoofer, updateRooferFlags } from '@/src/server/db';

function checkbox(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true';
}

function parseDistricts(value: FormDataEntryValue | null) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function createRooferAction(formData: FormData) {
  const actor = await requireAdmin();
  const name = String(formData.get('name') || '').trim();
  const region = String(formData.get('region') || '').trim();
  if (!name || !region) redirect('/admin/strechari?chyba=1');

  await createRoofer(
    {
      name,
      ico: String(formData.get('ico') || ''),
      contactPerson: String(formData.get('contactPerson') || ''),
      phone: String(formData.get('phone') || ''),
      email: String(formData.get('email') || ''),
      web: String(formData.get('web') || ''),
      region,
      districts: parseDistricts(formData.get('districts')),
      specialization: String(formData.get('specialization') || ''),
      publicNote: String(formData.get('publicNote') || ''),
      internalNote: String(formData.get('internalNote') || ''),
      active: checkbox(formData.get('active')),
      verifiedPartner: checkbox(formData.get('verifiedPartner')),
      inVerification: checkbox(formData.get('inVerification')),
      preferredPartner: checkbox(formData.get('preferredPartner')),
      rating: numberValue(formData.get('rating')),
      reviewCount: numberValue(formData.get('reviewCount')),
      complaintsCount: numberValue(formData.get('complaintsCount')),
      internalScore: numberValue(formData.get('internalScore')),
    },
    actor,
  );

  redirect('/admin/strechari?ulozene=1');
}

export async function updateRooferFlagsAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  if (!id) redirect('/admin/strechari');
  await updateRooferFlags(
    id,
    {
      active: checkbox(formData.get('active')),
      verifiedPartner: checkbox(formData.get('verifiedPartner')),
      inVerification: checkbox(formData.get('inVerification')),
      preferredPartner: checkbox(formData.get('preferredPartner')),
    },
    actor,
  );
  redirect('/admin/strechari?ulozene=1');
}
