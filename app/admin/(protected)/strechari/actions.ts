'use server';

import { redirect } from 'next/navigation';
import { requireAdmin, verifyCsrf } from '@/src/server/auth';
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

function parseBooleanText(value: string) {
  return ['1', 'ano', 'áno', 'true', 'yes', 'overeny', 'overený'].includes(value.trim().toLowerCase());
}

function parseImportLine(line: string) {
  const delimiter = line.includes('\t') ? '\t' : ';';
  const columns = line.split(delimiter).map((item) => item.trim());
  return {
    name: columns[0] || '',
    region: columns[1] || '',
    districts: columns[2] || '',
    phone: columns[3] || '',
    email: columns[4] || '',
    verified: columns[5] || '',
    rating: columns[6] || '',
    internalNote: columns[7] || '',
  };
}

export async function createRooferAction(formData: FormData) {
  await verifyCsrf(formData);
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

export async function importRoofersAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const raw = String(formData.get('rows') || '').trim();
  if (!raw) redirect('/admin/strechari?chyba=import');

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^meno|^firma|^nazov|^názov/i.test(line));

  let created = 0;
  for (const line of lines) {
    const row = parseImportLine(line);
    if (!row.name || !row.region) continue;
    const verifiedPartner = parseBooleanText(row.verified);
    await createRoofer(
      {
        name: row.name,
        phone: row.phone,
        email: row.email,
        region: row.region,
        districts: row.districts.split(/[,|]/).map((item) => item.trim()).filter(Boolean),
        internalNote: row.internalNote,
        active: true,
        verifiedPartner,
        inVerification: !verifiedPartner,
        preferredPartner: false,
        rating: Number(row.rating || 0),
        reviewCount: 0,
        complaintsCount: 0,
        internalScore: 0,
      },
      actor,
    );
    created += 1;
  }

  redirect(`/admin/strechari?import=${created}`);
}

export async function updateRooferFlagsAction(formData: FormData) {
  await verifyCsrf(formData);
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
