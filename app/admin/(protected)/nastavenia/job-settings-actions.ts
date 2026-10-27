'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { getAdminUserByEmail, setAdminSetting } from '@/src/server/db';
import { jobWorkspaceEnabled, jobWorkspaceUnavailableMessage } from '@/src/server/job-workspace-feature';

export async function saveJobDefaultOwnerAction(_previous: { message: string }, data: FormData) {
  await verifyCsrf(data); const actor = await requireSuperAdmin();
  if (!jobWorkspaceEnabled()) return { message: jobWorkspaceUnavailableMessage };
  const email = String(data.get('responsibleEmail') || '').trim().toLowerCase();
  try {
    const user = email ? await getAdminUserByEmail(email) : null;
    if (email && (!user?.active || !['OPERATOR', 'SUPER_ADMIN'].includes(user.role))) return { message: 'Vyberte aktívneho pracovníka s prístupom k zákazkám.' };
    await setAdminSetting('job_workspace_default_responsible_email', email, actor.email);
    revalidatePath('/admin/nastavenia');
    return { message: email ? 'Nové prijaté ponuky sa odovzdajú vybranej zodpovednej osobe.' : 'Automatické priradenie je vypnuté. Zodpovednú osobu treba vybrať na karte.' };
  } catch { return { message: 'Priradenie sa nepodarilo uložiť. Obnovte nastavenia a skúste znova.' }; }
}
