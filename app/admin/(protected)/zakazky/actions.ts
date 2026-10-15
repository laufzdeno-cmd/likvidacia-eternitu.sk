'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin, requireAdminUser, requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import {
  addBusinessJobNote,
  cancelBusinessInvoice,
  deleteBusinessJob,
  destroyBusinessJob,
  finalizeBusinessJobCompletion,
  recordBusinessInvoice,
  recordBusinessPayment,
  reverseBusinessPayment,
  saveBusinessJob,
  saveBusinessJobCompletion,
  setBusinessJobTestData,
  updateBusinessJobOperational,
} from '@/src/server/db';
import type { BusinessJobInput, BusinessJobOperationalInput, BusinessJobStatus, BusinessLandfill, BusinessPaymentType, BusinessWorkType } from '@/src/server/types';
import { getReviewRequestSettings } from '@/src/server/review-request-settings';

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
  const actor = (await requireSuperAdmin()).email;
  const id = String(formData.get('id') || '') || undefined;
  const next = String(formData.get('next') || '');
  const parsedJob = parseJob(formData);
  if (!id && parsedJob.status === 'DOKONCENA') throw new Error('Novú zákazku nemožno vytvoriť priamo ako dokončenú.');
  const job = await saveBusinessJob(parsedJob, actor, id);
  revalidatePath('/admin/zakazky');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/rok');
  revalidatePath(`/admin/zakazky/${job.id}`);
  if (next === 'new') redirect('/admin/zakazky/nova');
  if (!id) redirect('/admin/zakazky');
  redirect(`/admin/zakazky/${job.id}`);
}

const forbiddenOperationalJobFields = new Set([
  'm2', 'pricePerM2', 'paymentType', 'workType', 'wasteKg', 'landfill',
  'fuel', 'suits', 'gloves', 'penetrant', 'landfillCost', 'otherName', 'otherAmount',
  'totalPrice', 'rewardsTotal', 'grossProfit', 'marginPercent', 'workerId',
]);

function parseOperationalJob(formData: FormData): BusinessJobOperationalInput {
  for (const key of formData.keys()) {
    if (forbiddenOperationalJobFields.has(key) || key.startsWith('workerRate_') || key.startsWith('workerReward_') || key.startsWith('workerManual_')) {
      throw new Error('Operatívne uloženie nesmie meniť finančné údaje zákazky.');
    }
  }
  return {
    demolitionDate: String(formData.get('demolitionDate') || ''),
    customerName: String(formData.get('customerName') || ''),
    customerPhone: String(formData.get('customerPhone') || ''),
    customerEmail: String(formData.get('customerEmail') || ''),
    location: String(formData.get('location') || ''),
    district: String(formData.get('district') || ''),
    materialType: String(formData.get('materialType') || ''),
    objectType: String(formData.get('objectType') || ''),
    term: String(formData.get('term') || ''),
    preferredContact: String(formData.get('preferredContact') || ''),
    status: String(formData.get('status') || '') as BusinessJobStatus,
    note: String(formData.get('note') || ''),
  };
}

export async function saveOperationalBusinessJobAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  if (!id) throw new Error('Chýba identifikátor zákazky.');
  await updateBusinessJobOperational(id, parseOperationalJob(formData), actor);
  revalidatePath('/admin/zakazky');
  revalidatePath(`/admin/zakazky/${id}`);
  redirect(`/admin/zakazky/${id}`);
}

export type FinanceActionState = {
  ok: boolean;
  message: string;
  revision: number;
  values?: Record<string, string>;
};

function financeActionSuccess(previousState: FinanceActionState, message: string): FinanceActionState {
  return { ok: true, message, revision: previousState.revision + 1 };
}

function financeActionFailure(
  previousState: FinanceActionState,
  formData: FormData,
  fields: readonly string[],
  error: unknown,
): FinanceActionState {
  return {
    ok: false,
    message: financeMessage(error),
    revision: previousState.revision + 1,
    values: Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? '')])),
  };
}

function euroCents(value: FormDataEntryValue | null, label: string) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error(`${label} musí byť suma s najviac dvoma desatinnými miestami.`);
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error(`${label} musí byť kladná suma.`);
  return cents;
}

function vatBasisPoints(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Sadzba DPH nie je platná.');
  const basisPoints = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) throw new Error('Sadzba DPH nie je platná.');
  return basisPoints;
}

function financeMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Finančný záznam sa nepodarilo uložiť.';
}

function revalidateFinance(jobId: string) {
  revalidatePath(`/admin/zakazky/${jobId}`);
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/rok');
}

export async function recordBusinessInvoiceAction(
  previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const jobId = String(formData.get('jobId') || '');
  try {
    const amountWithoutVatCents = euroCents(formData.get('amountWithoutVat'), 'Suma bez DPH');
    const vatRateBasisPoints = vatBasisPoints(formData.get('vatRate'));
    await recordBusinessInvoice(jobId, {
      operationId: String(formData.get('operationId') || ''),
      invoiceNumber: String(formData.get('invoiceNumber') || ''),
      issuedOn: String(formData.get('issuedOn') || ''),
      dueOn: String(formData.get('dueOn') || '') || undefined,
      amountWithoutVatCents,
      vatRateBasisPoints,
      amountWithVatCents: amountWithoutVatCents + Math.round(amountWithoutVatCents * vatRateBasisPoints / 10_000),
    }, actor);
    revalidateFinance(jobId);
    return financeActionSuccess(previousState, 'Vystavená faktúra bola zaevidovaná.');
  } catch (error) {
    return financeActionFailure(previousState, formData, ['invoiceNumber', 'issuedOn', 'dueOn', 'amountWithoutVat', 'vatRate'], error);
  }
}

export async function cancelBusinessInvoiceAction(
  previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const jobId = String(formData.get('jobId') || '');
  if (formData.get('confirm') !== 'yes') {
    return financeActionFailure(previousState, formData, ['cancelledOn', 'reasonCode', 'confirm'], new Error('Storno faktúry musíte výslovne potvrdiť.'));
  }
  try {
    await cancelBusinessInvoice(jobId, String(formData.get('invoiceId') || ''), {
      operationId: String(formData.get('operationId') || ''),
      cancelledOn: String(formData.get('cancelledOn') || ''),
      reasonCode: String(formData.get('reasonCode') || ''),
    }, actor);
    revalidateFinance(jobId);
    return financeActionSuccess(previousState, 'Faktúra bola stornovaná bez vymazania histórie.');
  } catch (error) {
    return financeActionFailure(previousState, formData, ['cancelledOn', 'reasonCode', 'confirm'], error);
  }
}

export async function recordBusinessPaymentAction(
  previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const jobId = String(formData.get('jobId') || '');
  try {
    await recordBusinessPayment(jobId, {
      operationId: String(formData.get('operationId') || ''),
      invoiceId: String(formData.get('invoiceId') || '') || undefined,
      occurredOn: String(formData.get('occurredOn') || ''),
      amountCents: euroCents(formData.get('amount'), 'Prijatá suma'),
      method: String(formData.get('method') || 'BANK_TRANSFER') as 'BANK_TRANSFER' | 'CASH' | 'CARD' | 'OTHER',
      reference: String(formData.get('reference') || ''),
    }, actor);
    revalidateFinance(jobId);
    return financeActionSuccess(previousState, 'Prijatá úhrada bola zaevidovaná.');
  } catch (error) {
    return financeActionFailure(previousState, formData, ['invoiceId', 'occurredOn', 'amount', 'method', 'reference'], error);
  }
}

export async function reverseBusinessPaymentAction(
  previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const jobId = String(formData.get('jobId') || '');
  if (formData.get('confirm') !== 'yes') {
    return financeActionFailure(previousState, formData, ['occurredOn', 'reasonCode', 'confirm'], new Error('Storno úhrady musíte výslovne potvrdiť.'));
  }
  try {
    await reverseBusinessPayment(jobId, String(formData.get('receiptId') || ''), {
      operationId: String(formData.get('operationId') || ''),
      occurredOn: String(formData.get('occurredOn') || ''),
      reasonCode: String(formData.get('reasonCode') || ''),
    }, actor);
    revalidateFinance(jobId);
    return financeActionSuccess(previousState, 'Úhrada bola stornovaná novou opravnou udalosťou.');
  } catch (error) {
    return financeActionFailure(previousState, formData, ['occurredOn', 'reasonCode', 'confirm'], error);
  }
}

export async function setBusinessJobTestDataAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const id = String(formData.get('id') || '');
  const rawValue = String(formData.get('isTestData') || '');
  const reason = String(formData.get('reason') || '').trim();
  if (!id || (rawValue !== 'true' && rawValue !== 'false')) throw new Error('Neplatná zmena klasifikácie zákazky.');
  if (!reason) throw new Error('Vyberte dôvod zmeny klasifikácie.');
  const changed = await setBusinessJobTestData(id, rawValue === 'true', actor, reason);
  if (!changed) throw new Error('Zákazka sa nenašla. Obnovte stránku.');
  revalidatePath(`/admin/zakazky/${id}`);
  revalidatePath('/admin/zakazky');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/rok');
  revalidatePath('/realizacie');
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

export async function destroyBusinessJobAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const id = String(formData.get('id') || '');
  if (id) {
    await destroyBusinessJob(id, actor);
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

const completionCommonSchema = z.object({
  jobId: z.string().uuid(),
  revision: z.coerce.number().int().min(0),
  documentsDecision: z.enum(['pending', 'confirmed', 'not_applicable']),
  documentsReason: z.string().trim().max(500),
  photosDecision: z.enum(['pending', 'waiting', 'not_available', 'ready_private']),
  photosReason: z.string().trim().max(500),
  reviewDecision: z.enum(['pending', 'prepare', 'blocked']),
  reviewBlockReason: z.string().trim().max(500),
});

const completionCostsSchema = z.object({
  costsDecision: z.enum(['pending', 'confirmed_recorded', 'confirmed_zero']),
  costsReason: z.string().trim().max(500),
});

function revalidateBusinessJobCompletion(jobId: string) {
  revalidatePath(`/admin/zakazky/${jobId}`);
  revalidatePath('/admin/zakazky');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/referencie');
}

export async function saveBusinessJobCompletionAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  const parsed = completionCommonSchema.parse({
    jobId: formData.get('jobId'),
    revision: formData.get('revision'),
    documentsDecision: formData.get('documentsDecision'),
    documentsReason: formData.get('documentsReason'),
    photosDecision: formData.get('photosDecision'),
    photosReason: formData.get('photosReason'),
    reviewDecision: formData.get('reviewDecision'),
    reviewBlockReason: formData.get('reviewBlockReason'),
  });
  const costs = admin.role === 'SUPER_ADMIN'
    ? completionCostsSchema.parse({ costsDecision: formData.get('costsDecision'), costsReason: formData.get('costsReason') })
    : { costsDecision: 'pending' as const, costsReason: '' };
  await saveBusinessJobCompletion({
    jobId: parsed.jobId,
    expectedRevision: parsed.revision,
    values: { ...parsed, ...costs },
    actorEmail: admin.email,
    actorRole: admin.role,
  });
  revalidateBusinessJobCompletion(parsed.jobId);
  redirect(`/admin/zakazky/${parsed.jobId}?completion=saved#dokoncovanie`);
}

export async function finalizeBusinessJobCompletionAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const parsed = z.object({
    jobId: z.string().uuid(),
    revision: z.coerce.number().int().positive(),
    confirmed: z.literal('on'),
  }).parse({
    jobId: formData.get('jobId'),
    revision: formData.get('revision'),
    confirmed: formData.get('confirmed'),
  });
  const settings = await getReviewRequestSettings();
  const finalized = await finalizeBusinessJobCompletion({
    jobId: parsed.jobId,
    expectedRevision: parsed.revision,
    actorEmail: admin.email,
    actorRole: admin.role,
    reviewRequestTemplate: {
      subject: settings.subject,
      message: settings.body,
      googleReviewLink: settings.googleReviewLink,
      reminderAllowed: false,
    },
  });
  if (!finalized) throw new Error('Dokončenie sa medzičasom zmenilo. Obnovte stránku a skontrolujte ho znova.');
  revalidateBusinessJobCompletion(parsed.jobId);
  revalidatePath('/admin/rok');
  redirect(`/admin/zakazky/${parsed.jobId}?completion=finalized#dokoncovanie`);
}
