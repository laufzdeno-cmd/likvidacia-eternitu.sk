'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminUser, verifyCsrf } from '@/src/server/auth';
import { appendJobCommunication, getAuthorityNotice, prepareAuthorityNotice } from '@/src/server/job-workspace-db';
import { deliverApprovedAuthorityNotice } from '@/src/server/job-authority-delivery';
import type { AuthorityNotice } from '@/src/server/job-workspace-types';

export type JobLinkedActionState = { ok: boolean; message: string; preview?: AuthorityNotice };
export async function addJobCommunicationAction(_previous: JobLinkedActionState, data: FormData): Promise<JobLinkedActionState> {
  await verifyCsrf(data); const actor = await requireAdminUser();
  const parsed = z.object({ jobId: z.uuid(), subject: z.string().trim().min(1).max(300), text: z.string().trim().min(1).max(10000), occurredAt: z.string().datetime({ offset: true }) }).safeParse({ jobId: data.get('jobId'), subject: data.get('subject'), text: data.get('text'), occurredAt: data.get('occurredAt') });
  if (!parsed.success) return { ok: false, message: 'Doplňte predmet, poznámku a platný čas udalosti.' };
  try {
    await appendJobCommunication({ ...parsed.data, source: 'MANUAL', sourceMessageId: null, sender: actor.email, recipient: '', direction: 'NOTE', documentIds: [] }, actor);
    revalidatePath(`/admin/zakazky/${parsed.data.jobId}`);
    return { ok: true, message: 'Poznámka je pridaná do komunikácie s autorom aj časom.' };
  } catch { return { ok: false, message: 'Poznámku sa nepodarilo uložiť. Obnovte kartu a skúste znova.' }; }
}

export async function prepareJobAuthorityNoticeAction(_previous: JobLinkedActionState, data: FormData): Promise<JobLinkedActionState> {
  await verifyCsrf(data); const actor = await requireAdminUser();
  const parsed = z.object({ jobId: z.uuid(), operationId: z.uuid(), expectedRevision: z.coerce.number().int().nonnegative() }).safeParse({ jobId: data.get('jobId'), operationId: data.get('operationId'), expectedRevision: data.get('revision') });
  if (!parsed.success) return { ok: false, message: 'Obnovte zákazkovú kartu.' };
  try {
    const preview = await prepareAuthorityNotice(parsed.data.jobId, parsed.data, actor);
    return { ok: true, message: 'Skontrolujte adresáta a skutočne odoslané podklady. Email ešte nebol odoslaný.', preview };
  } catch { return { ok: false, message: 'Najprv uložte podania, overte email zákazníka a obnovte kartu. Náhľad vyžaduje aktuálne údaje.' }; }
}

export async function sendJobAuthorityNoticeAction(_previous: JobLinkedActionState, data: FormData): Promise<JobLinkedActionState> {
  await verifyCsrf(data); const actor = await requireAdminUser();
  if (data.get('confirmed') !== 'on') return { ok: false, message: 'Potvrďte správnosť adresáta a obsahu.' };
  try {
    const id = z.uuid().parse(data.get('noticeId'));
    const notice = await getAuthorityNotice(id, actor);
    if (!notice) return { ok: false, message: 'Oznámenie nie je dostupné.' };
    const result = await deliverApprovedAuthorityNotice(id, actor);
    revalidatePath(`/admin/zakazky/${notice.jobId}`);
    return { ok: result.state === 'SENT' || result.state === 'ALREADY_HANDLED', message: result.state === 'SENT' ? 'Oznámenie bolo prijaté poštovým serverom.' : result.state === 'ALREADY_HANDLED' ? 'Tento pokus už bol spracovaný. Opakovaný email sme neposlali.' : result.state === 'FAILED' ? 'Poštový server oznámenie neprijal. Výsledok skontrolujte v histórii.' : 'Výsledok odoslania je nejasný. Pred ďalším oznámením overte odoslanú poštu; nič automaticky neopakujeme.' };
  } catch { return { ok: false, message: 'Odoslanie sa nepotvrdilo. Obnovte kartu a skontrolujte stav; pri nejasnom výsledku email neopakujte.' }; }
}
