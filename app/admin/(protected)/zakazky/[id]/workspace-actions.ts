'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminUser, verifyCsrf } from '@/src/server/auth';
import { saveJobWorkspace } from '@/src/server/job-workspace-db';
import { jobWorkspaceOperationsSchema, jobWorkspaceSettlementSchema } from '@/src/server/job-workspace-policy';
import type { FinancialJobWorkspaceCard, JobWorkspaceCard, JobWorkspacePatch } from '@/src/server/job-workspace-types';

export type WorkspaceActionState = { ok: boolean; message: string; card: JobWorkspaceCard | FinancialJobWorkspaceCard | null };

export async function saveWorkspaceAction(_previous: WorkspaceActionState, data: FormData): Promise<WorkspaceActionState> {
  await verifyCsrf(data);
  const actor = await requireAdminUser();
  if (!['OPERATOR', 'SUPER_ADMIN'].includes(actor.role)) return { ok: false, message: 'Na úpravu zákazky nemáte oprávnenie.', card: null };
  const jobId = String(data.get('jobId') || '');
  const serialized = String(data.get('workspace') || '');
  if (!/^[\da-f-]{36}$/i.test(jobId) || serialized.length > 180_000) return { ok: false, message: 'Údaje zákazky nie sú platné.', card: null };
  try {
    const candidate = JSON.parse(serialized) as JobWorkspacePatch;
    if (!Number.isSafeInteger(candidate.expectedRevision) || candidate.expectedRevision < 0) throw new Error('INVALID');
    const operations = jobWorkspaceOperationsSchema.safeParse(candidate.operations);
    if (!operations.success) return { ok: false, message: 'Skontrolujte dátumy, množstvá a údaje podaní. Rozhodnutie potrebuje dátum podania aj rozhodnutia.', card: null };
    const patch: JobWorkspacePatch = { expectedRevision: candidate.expectedRevision, operations: operations.data };
    if (candidate.settlement !== undefined) {
      if (actor.role !== 'SUPER_ADMIN') return { ok: false, message: 'Finančné údaje môže upravovať iba superadmin.', card: null };
      const settlement = jobWorkspaceSettlementSchema.safeParse(candidate.settlement);
      if (!settlement.success) return { ok: false, message: 'Skontrolujte sumy vyúčtovania. Použite kladné sumy alebo nulu, najviac na dve desatinné miesta.', card: null };
      patch.settlement = settlement.data;
    }
    const card = await saveJobWorkspace(jobId, patch, actor);
    revalidatePath(`/admin/zakazky/${jobId}`);
    revalidatePath('/admin/zakazky');
    revalidatePath('/admin/planovac');
    revalidatePath('/admin/vyhladavanie');
    return { ok: true, message: 'Pracovná karta je uložená. Zmena má autora a čas; zákazníkovi sa zatiaľ nič neposlalo.', card };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const conflict = /revízi|revision|súčasne|zmenil|zmenen|konflikt/i.test(message);
    return { ok: false, message: conflict ? 'Kartu medzitým zmenil niekto ďalší. Vaše rozpracované údaje zostali vo formulári. Otvorte aktuálnu kartu v novej karte a zmeny porovnajte.' : 'Kartu sa nepodarilo uložiť. Skontrolujte údaje a oprávnenie; pôvodný záznam zostal zachovaný.', card: null };
  }
}
