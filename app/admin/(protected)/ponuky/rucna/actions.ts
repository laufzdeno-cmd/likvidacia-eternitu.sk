'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminUser, verifyCsrf } from '@/src/server/auth';
import { acceptManualPriceOffer, getJobPrivateDocument, getManualPriceOffer, importManualPriceOffer, recordManualPriceOfferOutcome, updateManualPriceOffer, verifyManualPriceOfferSent } from '@/src/server/job-workspace-db';
import type { ManualPriceOfferInput } from '@/src/server/job-workspace-types';
import { jobWorkspaceEnabled, jobWorkspaceUnavailableMessage } from '@/src/server/job-workspace-feature';

export type ManualOfferActionState = { ok: boolean; message: string; id?: string; jobId?: string };

function safeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/medzitým zmenila|rovnakým číslom|Číslo ponuky|už patrí|už existuje|duplicit|dôkaz|dátum|odoslan|súbor/i.test(message) && message.length < 240 && !/SELECT|INSERT|UPDATE|postgres|storageKey/i.test(message)) return message;
  return 'Záznam sa nepodarilo uložiť. Skontrolujte údaje a obnovte kartu; pri opakovaní kontaktujte superadmina.';
}

export async function importManualOfferAction(_previous: ManualOfferActionState, data: FormData): Promise<ManualOfferActionState> {
  await verifyCsrf(data);
  const actor = await requireAdminUser();
  if (!jobWorkspaceEnabled()) return { ok: false, message: jobWorkspaceUnavailableMessage };
  try {
    const raw = String(data.get('payload') || '');
    if (raw.length > 200_000) throw new Error('Príliš veľa údajov.');
    const input = JSON.parse(raw) as ManualPriceOfferInput;
    const document = await getJobPrivateDocument(z.uuid().parse(input.pdf?.documentId), actor);
    if (!document || document.kind !== 'PDF') return { ok: false, message: 'Najprv nahrajte originálnu PDF ponuku.' };
    // The file fingerprint and name come from private storage, never a hidden browser field.
    input.pdf = { documentId: document.id, sha256: document.sha256, originalName: document.fileName };
    const result = await importManualPriceOffer(input, actor);
    revalidatePath('/admin/ponuky');
    return { ok: true, id: result.offer.id, message: result.duplicate ? 'Táto ponuka už je v evidencii. Otvorte existujúcu kartu.' : 'Originál a overené údaje sú uložené. Zákazníkovi sa nič neposlalo.' };
  } catch (error) { return { ok: false, message: safeFailure(error) }; }
}

export async function verifyManualOfferSentAction(_previous: ManualOfferActionState, data: FormData): Promise<ManualOfferActionState> {
  await verifyCsrf(data);
  const actor = await requireAdminUser();
  if (!jobWorkspaceEnabled()) return { ok: false, message: jobWorkspaceUnavailableMessage };
  try {
    if (data.get('confirmSent') !== 'on') return { ok: false, message: 'Potvrďte skutočné odoslanie pôvodnej ponuky.' };
    const id = z.uuid().parse(data.get('id'));
    await verifyManualPriceOfferSent(id, { expectedRevision: Number(data.get('revision')), sentOn: String(data.get('sentOn') || ''), evidence: String(data.get('evidence') || '') }, actor);
    revalidatePath(`/admin/ponuky/rucna/${id}`); revalidatePath('/admin/ponuky');
    return { ok: true, message: 'Ponuka je zaevidovaná ako odoslaná. Opätovný email sme neposlali.' };
  } catch (error) { return { ok: false, message: safeFailure(error) }; }
}

export async function acceptManualOfferAction(_previous: ManualOfferActionState, data: FormData): Promise<ManualOfferActionState> {
  await verifyCsrf(data);
  const actor = await requireAdminUser();
  if (!jobWorkspaceEnabled()) return { ok: false, message: jobWorkspaceUnavailableMessage };
  try {
    if (data.get('confirmAccepted') !== 'on') return { ok: false, message: 'Potvrďte, že zákazník ponuku skutočne prijal.' };
    const id = z.uuid().parse(data.get('id'));
    if (!await getManualPriceOffer(id, actor)) return { ok: false, message: 'Ponuka sa nenašla.' };
    const result = await acceptManualPriceOffer(id, { expectedRevision: Number(data.get('revision')), responsibleEmail: String(data.get('responsibleEmail') || ''), acceptedOn: String(data.get('acceptedOn') || '') }, actor);
    revalidatePath(`/admin/ponuky/rucna/${id}`); revalidatePath('/admin/zakazky'); revalidatePath('/admin/ponuky');
    return { ok: true, jobId: result.jobId, message: 'Prijatie je zaevidované a zákazková karta je pripravená.' };
  } catch (error) { return { ok: false, message: safeFailure(error) }; }
}

export async function updateManualOfferAction(_previous: ManualOfferActionState, data: FormData): Promise<ManualOfferActionState> {
  await verifyCsrf(data); const actor = await requireAdminUser();
  if (!jobWorkspaceEnabled()) return { ok: false, message: jobWorkspaceUnavailableMessage };
  try {
    const id = z.uuid().parse(data.get('id'));
    const raw = String(data.get('payload') || ''); if (raw.length > 200000) throw new Error('limit');
    const { pdf: _pdf, originalNumber: _originalNumber, sourceMessageId: _sourceMessageId, ...fields } = JSON.parse(raw) as ManualPriceOfferInput;
    await updateManualPriceOffer(id, { expectedRevision: Number(data.get('revision')), fields }, actor);
    revalidatePath(`/admin/ponuky/rucna/${id}`); revalidatePath('/admin/ponuky');
    return { ok: true, id, message: 'Overené údaje konceptu sú opravené. Originál a pôvodné číslo ostali zachované.' };
  } catch (error) { return { ok: false, message: safeFailure(error) }; }
}

export async function recordManualOutcomeAction(_previous: ManualOfferActionState, data: FormData): Promise<ManualOfferActionState> {
  await verifyCsrf(data); const actor = await requireAdminUser();
  if (!jobWorkspaceEnabled()) return { ok: false, message: jobWorkspaceUnavailableMessage };
  try {
    const id = z.uuid().parse(data.get('id'));
    const status = z.enum(['DEFERRED', 'REJECTED']).parse(data.get('status'));
    await recordManualPriceOfferOutcome(id, { expectedRevision: Number(data.get('revision')), status, reason: String(data.get('reason') || '') }, actor);
    revalidatePath(`/admin/ponuky/rucna/${id}`); revalidatePath('/admin/ponuky');
    return { ok: true, message: 'Výsledok aj jeho dôvod sú uložené v histórii ponuky.' };
  } catch (error) { return { ok: false, message: safeFailure(error) }; }
}
