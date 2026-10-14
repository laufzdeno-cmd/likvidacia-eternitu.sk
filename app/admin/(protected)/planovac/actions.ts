'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, verifyCsrf } from '@/src/server/auth';
import { getBusinessJob, listWorkers, savePlannerAction } from '@/src/server/db';
import type { PlannerActionStatus, PlannerActionType } from '@/src/server/types';

const allowedTypes = new Set<PlannerActionType>(['DEMONTAZ', 'ODVOZ', 'DOKUMENTACIA', 'INE']);
const allowedStatuses = new Set<PlannerActionStatus>(['NAPLANOVANA', 'DOKONCENA', 'ZRUSENA', 'PRESUNUTA']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function localReturnPath(formData: FormData, notice: string) {
  const savedDate = String(formData.get('date') || '');
  const month = datePattern.test(savedDate) ? savedDate.slice(0, 7) : String(formData.get('month') || '');
  const jobId = String(formData.get('returnJobId') || '');
  const query = new URLSearchParams({ notice });
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) query.set('mesiac', month);
  if (uuidPattern.test(jobId)) query.set('zakazka', jobId);
  return `/admin/planovac?${query.toString()}`;
}

export async function savePlannerActionAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const date = String(formData.get('date') || '');
  const timeFrom = String(formData.get('timeFrom') || '');
  const timeTo = String(formData.get('timeTo') || '');
  const type = String(formData.get('type') || 'INE') as PlannerActionType;
  const status = String(formData.get('status') || 'NAPLANOVANA') as PlannerActionStatus;
  const address = String(formData.get('address') || '').trim();
  const jobId = String(formData.get('jobId') || '');
  const customerName = String(formData.get('customerName') || '').trim();
  const customerEmail = String(formData.get('customerEmail') || '').trim();
  const customerPhone = String(formData.get('customerPhone') || '').trim();
  const note = String(formData.get('note') || '').trim();
  const notifyCustomer = formData.get('notifyCustomer') === 'on';
  if (id && !uuidPattern.test(id)) throw new Error('Akcia nemá platný identifikátor.');
  if (!datePattern.test(date) || !timePattern.test(timeFrom) || !timePattern.test(timeTo) || timeFrom >= timeTo) {
    throw new Error('Skontrolujte dátum a čas. Čas konca musí byť po čase začiatku.');
  }
  if (!allowedTypes.has(type) || !allowedStatuses.has(status)) throw new Error('Typ alebo stav akcie nie je platný.');
  if (address.length < 2 || address.length > 250 || customerName.length > 160 || customerEmail.length > 254 || customerPhone.length > 40 || note.length > 1200) {
    throw new Error('Skontrolujte dĺžku adresy, kontaktov a poznámky.');
  }
  if (customerEmail && !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(customerEmail)) throw new Error('Email zákazníka nie je platný.');
  if (notifyCustomer && !customerEmail) throw new Error('Pre upozornenie zákazníka musí byť vyplnený email.');
  if (jobId && (!uuidPattern.test(jobId) || !(await getBusinessJob(jobId)))) throw new Error('Vybraná zákazka sa nenašla.');
  const activeWorkers = await listWorkers(true);
  const allowedWorkerNames = new Set(activeWorkers.map((worker) => worker.name));
  const selectedWorkers = [...new Set(formData.getAll('workers').map(String).map((value) => value.trim()).filter(Boolean))];
  if (selectedWorkers.some((name) => !allowedWorkerNames.has(name))) throw new Error('Vybraný pracovník nie je aktívny.');
  const workers = selectedWorkers.join(',');
  await savePlannerAction(
    {
      date,
      timeFrom,
      timeTo,
      type,
      address,
      jobId,
      workers,
      customerName,
      customerEmail,
      customerPhone,
      note,
      status,
      notify2Days: formData.get('notify2Days') === 'on',
      notify1Day: formData.get('notify1Day') === 'on',
      notifyCustomer,
    },
    actor,
    id || undefined,
  );
  revalidatePath('/admin/planovac');
  if (jobId) revalidatePath(`/admin/zakazky/${jobId}`);
  redirect(localReturnPath(formData, id ? 'Akcia bola upravená.' : 'Akcia bola naplánovaná.'));
}
