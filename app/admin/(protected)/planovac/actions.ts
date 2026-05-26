'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, verifyCsrf } from '@/src/server/auth';
import { savePlannerAction } from '@/src/server/db';
import type { PlannerActionStatus, PlannerActionType } from '@/src/server/types';

export async function savePlannerActionAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const workers = formData.getAll('workers').map(String).filter(Boolean).join(',');
  await savePlannerAction(
    {
      date: String(formData.get('date') || new Date().toISOString().slice(0, 10)),
      timeFrom: String(formData.get('timeFrom') || '06:00'),
      timeTo: String(formData.get('timeTo') || '14:00'),
      type: String(formData.get('type') || 'INE') as PlannerActionType,
      address: String(formData.get('address') || '').trim(),
      jobId: String(formData.get('jobId') || ''),
      workers,
      customerName: String(formData.get('customerName') || '').trim(),
      customerEmail: String(formData.get('customerEmail') || '').trim(),
      customerPhone: String(formData.get('customerPhone') || '').trim(),
      note: String(formData.get('note') || '').trim(),
      status: String(formData.get('status') || 'NAPLANOVANA') as PlannerActionStatus,
      notify2Days: formData.get('notify2Days') === 'on',
      notify1Day: formData.get('notify1Day') === 'on',
      notifyCustomer: formData.get('notifyCustomer') === 'on',
    },
    actor,
    String(formData.get('id') || '') || undefined,
  );
  revalidatePath('/admin/planovac');
}
