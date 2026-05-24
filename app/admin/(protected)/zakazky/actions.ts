'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/src/server/auth';
import { saveBusinessJob } from '@/src/server/db';
import type { BusinessJobInput, BusinessJobStatus, BusinessLandfill, BusinessPaymentType, BusinessWorkType } from '@/src/server/types';

function num(value: FormDataEntryValue | null) {
  return Number(String(value || '').replace(',', '.')) || 0;
}

function parseJob(formData: FormData): BusinessJobInput {
  const workerIds = formData.getAll('workerId').map(String).filter(Boolean);
  return {
    demolitionDate: String(formData.get('demolitionDate') || new Date().toISOString().slice(0, 10)),
    customerName: String(formData.get('customerName') || '').trim(),
    location: String(formData.get('location') || '').trim(),
    district: String(formData.get('district') || '').trim(),
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
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '') || undefined;
  const next = String(formData.get('next') || '');
  const job = await saveBusinessJob(parseJob(formData), actor, id);
  revalidatePath('/admin/zakazky');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/rok');
  revalidatePath(`/admin/zakazky/${job.id}`);
  if (next === 'new') redirect('/admin/zakazky/nova');
  redirect(`/admin/zakazky/${job.id}`);
}
