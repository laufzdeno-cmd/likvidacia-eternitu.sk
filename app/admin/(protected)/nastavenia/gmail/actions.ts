'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { configureJobMailSync, disconnectJobMail, getJobMailLabels, importJobMailPdf, reviewJobMailMessage, synchronizeJobMail } from '@/src/server/job-mail-service';
import { disableJobMailSync } from '@/src/server/job-mail-store';
import { listBusinessJobs, listPriceOffers } from '@/src/server/db';
import { listManualPriceOffers } from '@/src/server/job-workspace-db';
import { jobWorkspaceEnabled, jobWorkspaceUnavailableMessage } from '@/src/server/job-workspace-feature';

export type GmailWorkspaceState = { ok: boolean; message: string; labels?: Array<{ id: string; name: string }>; documentId?: string };
export async function manageJobGmailAction(_previous: GmailWorkspaceState, data: FormData): Promise<GmailWorkspaceState> {
  await verifyCsrf(data); const actor = await requireSuperAdmin();
  if (!jobWorkspaceEnabled()) return { ok: false, message: jobWorkspaceUnavailableMessage };
  const task = String(data.get('task') || '');
  try {
    let message = '';
    if (task === 'labels') return { ok: true, message: 'Vyberte iba štítky s firemnou komunikáciou.', labels: await getJobMailLabels(actor) };
    if (task === 'configure') {
      await configureJobMailSync({ enabled: data.get('enabled') === 'on', labelIds: String(data.get('labels') || '').split(',').map(s => s.trim()).filter(Boolean), since: String(data.get('since') || ''), maxMessages: Number(data.get('limit') || 20), verificationAcknowledged: data.get('verificationAcknowledged') === 'on', expectedRevision: Number(data.get('revision')) }, actor);
      message = 'Rozsah synchronizácie bol uložený.';
    } else if (task === 'disable') { await disableJobMailSync(actor); message = 'Čítanie Gmailu je vypnuté. Schválená história zostáva súkromná.'; }
    else if (task === 'disconnect') {
      if (data.get('confirmed') !== 'on') return { ok: false, message: 'Potvrďte odpojenie Gmailu vrátane označovania ponúk.' };
      await disconnectJobMail(actor); message = 'Gmail bol odpojený. Nové správy sa nebudú čítať ani označovať.';
    } else if (task === 'sync') {
      const [jobs, generated, manual] = await Promise.all([listBusinessJobs({ limit: null, excludeTestData: true }), listPriceOffers(), listManualPriceOffers(actor)]);
      const candidates = jobs.map(job => ({ jobId: job.id, number: job.id, email: job.customerEmail, phone: job.customerPhone, offerNumbers: [...generated.filter(o => o.jobId === job.id).map(o => o.number), ...manual.filter(o => o.jobId === job.id).map(o => o.originalNumber)] }));
      const result = await synchronizeJobMail(actor, candidates);
      message = `Skontrolované správy: ${result.scanned}. Nové na priradenie: ${result.added}.${result.hasMoreHistory ? ' Staršie správy načítate ďalšou dávkou.' : ''}`;
    } else if (task === 'review') {
      const decision = data.get('decision'); if (decision !== 'LINK' && decision !== 'IGNORE') return { ok: false, message: 'Vyberte priradiť alebo vynechať.' };
      await reviewJobMailMessage({ id: String(data.get('id') || ''), decision, jobId: String(data.get('jobId') || '') || undefined, confirmed: data.get('confirmed') === 'on' }, actor);
      message = decision === 'LINK' ? 'Správa je pripojená k overenej zákazke. Stav ponuky sa automaticky nemenil.' : 'Správa je vynechaná z priraďovania.';
    } else if (task === 'pdf') {
      const result = await importJobMailPdf({ stagedId: String(data.get('id') || ''), attachmentId: String(data.get('attachmentId') || '') }, actor);
      return { ok: true, message: 'PDF je uložené súkromne. Pokračujte kontrolou jeho čísla, obsahu a odoslania.', documentId: result.document.id };
    } else return { ok: false, message: 'Neznáma operácia.' };
    revalidatePath('/admin/nastavenia/gmail'); revalidatePath('/admin/zakazky');
    return { ok: true, message };
  } catch { return { ok: false, message: 'Operácia sa nepotvrdila. Skontrolujte overenie Google, povolený účet, uložené štítky a aktuálnu revíziu nastavení. Nič automaticky neopakujeme.' }; }
}
