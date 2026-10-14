'use server';

import { z } from 'zod';
import { requireAdminUser, verifyCsrf } from '@/src/server/auth';
import { addAuditLog } from '@/src/server/db';
import { consumeSharedRateLimit } from '@/src/server/shared-rate-limit';
import { generateAdminDraftWithProvider } from '@/src/server/admin-draft-provider';

const schema = z.object({
  type: z.enum(['summary', 'reply', 'followup', 'note', 'offer']),
  name: z.string().trim().max(100),
  locality: z.string().trim().max(120),
  facts: z.string().trim().min(3).max(2_000),
});

export type AdminAiDraftState = {
  ok: boolean;
  draft: string;
  message: string;
  requestKey: string;
};

export const initialAdminAiDraftState: AdminAiDraftState = { ok: false, draft: '', message: '', requestKey: '' };

export async function generateAdminAiDraftAction(
  _previous: AdminAiDraftState,
  formData: FormData,
): Promise<AdminAiDraftState> {
  await verifyCsrf(formData);
  const actor = await requireAdminUser();
  const parsed = schema.safeParse({
    type: String(formData.get('type') || ''),
    name: String(formData.get('name') || ''),
    locality: String(formData.get('locality') || ''),
    facts: String(formData.get('facts') || ''),
  });
  if (!parsed.success) return { ...initialAdminAiDraftState, message: 'Doplňte aspoň tri znaky overených faktov.' };
  const requestKey = JSON.stringify(parsed.data);
  try {
    const limited = await consumeSharedRateLimit('admin-ai-draft', actor.email, 12, 60 * 60 * 1_000);
    if (limited) return { ...initialAdminAiDraftState, message: 'Hodinový limit AI návrhov je vyčerpaný. Použite lokálnu šablónu.', requestKey };
    const result = await generateAdminDraftWithProvider(parsed.data);
    await addAuditLog('system', 'admin-ai-draft', 'admin_ai_draft_generated', actor.email, {
      type: parsed.data.type,
      model: result.model,
      redactionApplied: result.redactionApplied,
      contentStored: false,
    }).catch(() => undefined);
    return { ok: true, draft: result.draft, message: 'AI pripravil pracovný návrh. Pred použitím ho celý skontrolujte.', requestKey };
  } catch {
    await addAuditLog('system', 'admin-ai-draft', 'admin_ai_draft_failed', actor.email, {
      type: parsed.data.type,
      contentStored: false,
    }).catch(() => undefined);
    return { ...initialAdminAiDraftState, message: 'AI návrh teraz nie je dostupný. Lokálna šablóna zostáva funkčná.', requestKey };
  }
}
