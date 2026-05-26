'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { addBusinessJobNote, deleteBusinessJob, getBusinessJob, markBusinessJobQuoteSent, saveBusinessJob } from '@/src/server/db';
import { sendBusinessQuoteEmail } from '@/src/server/mail';
import type { BusinessJobInput, BusinessJobStatus, BusinessLandfill, BusinessPaymentType, BusinessWorkType } from '@/src/server/types';

function num(value: FormDataEntryValue | null) {
  return Number(String(value || '').replace(',', '.')) || 0;
}

function parseJob(formData: FormData): BusinessJobInput {
  const workerIds = formData.getAll('workerId').map(String).filter(Boolean);
  return {
    demolitionDate: String(formData.get('demolitionDate') || new Date().toISOString().slice(0, 10)),
    customerName: String(formData.get('customerName') || '').trim(),
    customerPhone: String(formData.get('customerPhone') || '').trim(),
    customerEmail: String(formData.get('customerEmail') || '').trim(),
    location: String(formData.get('location') || '').trim(),
    district: String(formData.get('district') || '').trim(),
    materialType: String(formData.get('materialType') || '').trim(),
    objectType: String(formData.get('objectType') || '').trim(),
    term: String(formData.get('term') || '').trim(),
    preferredContact: String(formData.get('preferredContact') || '').trim(),
    m2: num(formData.get('m2')),
    pricePerM2: num(formData.get('pricePerM2')),
    paymentType: String(formData.get('paymentType') || 'FAKTURA') as BusinessPaymentType,
    workType: String(formData.get('workType') || 'DEMONTAZ_A_ODVOZ') as BusinessWorkType,
    wasteKg: num(formData.get('wasteKg')),
    landfill: String(formData.get('landfill') || 'INA') as BusinessLandfill,
    status: String(formData.get('status') || 'DOPYT') as BusinessJobStatus,
    note: String(formData.get('note') || '').trim(),
    workers: workerIds.map((workerId) => ({
      workerId,
      rate: num(formData.get(`workerRate_${workerId}`)),
      reward: num(formData.get(`workerReward_${workerId}`)),
      manuallyEdited: formData.get(`workerManual_${workerId}`) === 'on',
    })),
    costs: {
      fuel: num(formData.get('fuel')),
      suits: num(formData.get('suits')),
      gloves: num(formData.get('gloves')),
      penetrant: num(formData.get('penetrant')),
      landfillCost: num(formData.get('landfillCost')),
      otherName: String(formData.get('otherName') || '').trim(),
      otherAmount: num(formData.get('otherAmount')),
    },
  };
}

export async function saveBusinessJobAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '') || undefined;
  const next = String(formData.get('next') || '');
  const job = await saveBusinessJob(parseJob(formData), actor, id);
  revalidatePath('/admin/zakazky');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/rok');
  revalidatePath(`/admin/zakazky/${job.id}`);
  if (next === 'new') redirect('/admin/zakazky/nova');
  if (!id) redirect('/admin/zakazky');
  redirect(`/admin/zakazky/${job.id}`);
}

export async function deleteBusinessJobAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const id = String(formData.get('id') || '');
  if (id) {
    await deleteBusinessJob(id, actor);
    revalidatePath('/admin/zakazky');
    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/rok');
  }
}

export async function addBusinessJobNoteAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const note = String(formData.get('activityNote') || '');
  if (id && note.trim()) {
    await addBusinessJobNote(id, note, actor);
    revalidatePath(`/admin/zakazky/${id}`);
  }
}

export async function sendBusinessQuoteAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const job = id ? await getBusinessJob(id) : null;
  if (!job) redirect('/admin/zakazky');
  const pricePerM2 = num(formData.get('quotePricePerM2')) || job.pricePerM2;
  const totalPrice = Math.round(job.m2 * pricePerM2 * 100) / 100;
  const validUntil = String(formData.get('validUntil') || '');
  const note = String(formData.get('quoteNote') || '').trim();

  const result = await sendBusinessQuoteEmail(job, { validUntil, pricePerM2, totalPrice, note });
  if (result.sent) {
    await markBusinessJobQuoteSent(id, actor, { validUntil, pricePerM2, totalPrice, note });
  } else {
    await addBusinessJobNote(id, `Cenovú ponuku sa nepodarilo odoslať: ${result.reason || 'neznáma chyba'}`, actor);
  }
  revalidatePath('/admin/zakazky');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/rok');
  revalidatePath(`/admin/zakazky/${id}`);
  redirect(`/admin/zakazky/${id}`);
}
