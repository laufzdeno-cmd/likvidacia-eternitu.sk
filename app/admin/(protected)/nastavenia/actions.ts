'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { clearAdminSession, hashPassword, requireSuperAdmin, verifyAdminCredentials, verifyCsrf } from '@/src/server/auth';
import { changeAdminUserPassword, deleteLandfillPrice, getPriceOfferSettings, saveBusinessSettings, savePriceOfferSettings, upsertLandfillPrice, upsertWorker } from '@/src/server/db';
import type { BusinessLandfill, PriceOfferMaterialType } from '@/src/server/types';
import { decryptGmailSecret, getGmailPriceOfferConfiguration } from '@/src/server/gmail-price-offer-config';
import {
  disconnectGmailPriceOfferConnection,
  getGmailPriceOfferConnectionSecret,
  requeueGmailPriceOfferAttentionJobs,
} from '@/src/server/gmail-price-offer-db';
import { revokeGoogleRefreshToken } from '@/src/server/gmail-price-offer-api';

function num(value: FormDataEntryValue | null) {
  return Number(String(value || '').replace(',', '.')) || 0;
}

export async function saveWorkerAction(formData: FormData) {
  await verifyCsrf(formData);
  await requireSuperAdmin();
  await upsertWorker({
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') || '').trim(),
    ratePerM2: num(formData.get('ratePerM2')),
    active: formData.get('active') === 'on',
  });
  revalidatePath('/admin/nastavenia');
}

export async function saveLandfillPriceAction(formData: FormData) {
  await verifyCsrf(formData);
  await requireSuperAdmin();
  await upsertLandfillPrice({
    id: String(formData.get('id') || '') || undefined,
    year: Number(formData.get('year') || new Date().getFullYear()),
    landfill: String(formData.get('landfill') || 'MOCHOVCE') as BusinessLandfill,
    pricePerTon: num(formData.get('pricePerTon')),
  });
  revalidatePath('/admin/nastavenia');
}

export async function deleteLandfillPriceAction(formData: FormData) {
  await verifyCsrf(formData);
  await requireSuperAdmin();
  const id = String(formData.get('id') || '');
  if (id) await deleteLandfillPrice(id);
  revalidatePath('/admin/nastavenia');
}

export async function saveGeneralSettingsAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  await saveBusinessSettings({
    defaultPricePerM2: num(formData.get('defaultPricePerM2')),
    googleReviewLink: String(formData.get('googleReviewLink') || '').trim(),
  }, actor);
  revalidatePath('/admin/nastavenia');
}

export async function savePriceOfferSettingsAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const current = await getPriceOfferSettings();
  const materialPrices = { ...current.materialPrices };
  for (const key of Object.keys(materialPrices) as PriceOfferMaterialType[]) {
    materialPrices[key] = num(formData.get(`material_${key}`));
  }
  await savePriceOfferSettings(
    {
      ...current,
      materialPrices,
      documentationFee: num(formData.get('documentationFee')),
      vatRate: num(formData.get('vatRate')),
      preparedByName: String(formData.get('preparedByName') || '').trim(),
      preparedByPhone: String(formData.get('preparedByPhone') || '').trim(),
    },
    actor,
  );
  revalidatePath('/admin/nastavenia');
  revalidatePath('/admin/ponuky');
}

export async function changeAdminPasswordAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const actor = admin.email;
  const currentPassword = String(formData.get('currentPassword') || '');
  const newPassword = String(formData.get('newPassword') || '');
  const repeatPassword = String(formData.get('repeatPassword') || '');

  if (!(await verifyAdminCredentials(admin.email, currentPassword))) {
    redirect('/admin/nastavenia?heslo=nespravne');
  }

  if (newPassword.length < 12 || newPassword.length > 128 || newPassword !== repeatPassword) {
    redirect('/admin/nastavenia?heslo=neplatne');
  }

  const changed = await changeAdminUserPassword(admin.email, hashPassword(newPassword), admin.sessionEpoch, actor);
  if (!changed) redirect('/admin/nastavenia?heslo=konflikt');
  await clearAdminSession();
  redirect('/admin/login?heslo=ulozene');
}

export async function disconnectGmailPriceOfferAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const [config, secret] = [getGmailPriceOfferConfiguration(), await getGmailPriceOfferConnectionSecret()];
  if (secret && config.encryptionKey) {
    try {
      await revokeGoogleRefreshToken(decryptGmailSecret(secret.encryptedRefreshToken, config.encryptionKey));
    } catch {
      // The local connection must still be disabled if the stored token can no longer be opened.
    }
  }
  await disconnectGmailPriceOfferConnection(admin.email);
  revalidatePath('/admin/nastavenia');
  redirect('/admin/nastavenia?gmail=disconnected');
}

export async function retryGmailPriceOfferJobsAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const count = await requeueGmailPriceOfferAttentionJobs(admin.email);
  revalidatePath('/admin/nastavenia');
  redirect(`/admin/nastavenia?gmail=${count ? 'requeued' : 'nothing_to_retry'}`);
}
