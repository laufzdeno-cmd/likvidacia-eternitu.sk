'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { reconcileAdminAutopilot } from '@/src/server/admin-autopilot';

export async function runAdminAutopilotAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const result = await reconcileAdminAutopilot({ actorEmail: admin.email, limit: 100 });
  revalidatePath('/admin/automatizacie');
  revalidatePath('/admin/ponuky');
  revalidatePath('/admin/referencie');
  revalidatePath('/admin/realizacie/pripady');
  revalidatePath('/admin/dashboard');
  const summary = [result.priceOffersCreated, result.reviewRequestsPrepared, result.realizationDraftsCreated,
    result.photosAttached, result.blockedOfferJobIds.length, result.unavailable.length].join('-');
  redirect(`/admin/automatizacie?run=${summary}`);
}

