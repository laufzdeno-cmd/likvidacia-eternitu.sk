'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/src/server/auth';
import {
  addAuditLog,
  deletePriceOffer,
  getPriceOffer,
  getPriceOfferSettings,
  savePriceOffer,
  updatePriceOfferStatus,
} from '@/src/server/db';
import { sendPriceOfferDocumentEmail } from '@/src/server/mail';
import { renderPriceOfferPdf } from '@/src/server/price-offer-pdf';
import type { PriceOfferInput, PriceOfferMaterialType, PriceOfferStatus } from '@/src/server/types';

function num(value: FormDataEntryValue | null) {
  return Number(String(value || '').replace(',', '.')) || 0;
}

function parseOffer(formData: FormData): PriceOfferInput {
  return {
    jobId: String(formData.get('jobId') || '') || undefined,
    objectType: String(formData.get('objectType') || '').trim(),
    objectAddress: String(formData.get('objectAddress') || '').trim(),
    municipality: String(formData.get('municipality') || '').trim(),
    district: String(formData.get('district') || '').trim(),
    contactPerson: String(formData.get('contactPerson') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    realizationTerm: String(formData.get('realizationTerm') || '').trim(),
    materialType: String(formData.get('materialType') || 'VLNITY_ETERNIT') as PriceOfferMaterialType,
    areaM2: num(formData.get('areaM2')),
    pricePerM2WithoutVat: num(formData.get('pricePerM2WithoutVat')),
    documentationFeeWithoutVat: num(formData.get('documentationFeeWithoutVat')),
    includeDocumentation: formData.get('includeDocumentation') === 'on',
    validUntil: String(formData.get('validUntil') || ''),
    offerNote: String(formData.get('offerNote') || '').trim(),
    internalNote: String(formData.get('internalNote') || '').trim(),
    sourceInquiry: String(formData.get('sourceInquiry') || '').trim(),
  };
}

export async function savePriceOfferAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '') || undefined;
  const next = String(formData.get('next') || '');
  const offer = await savePriceOffer(parseOffer(formData), actor, id);
  revalidatePath('/admin/ponuky');
  revalidatePath('/admin/zakazky');
  revalidatePath('/admin/dashboard');
  if (next === 'send') redirect(`/admin/ponuky/${offer.id}?send=1`);
  redirect(`/admin/ponuky/${offer.id}`);
}

export async function sendPriceOfferAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const offer = await getPriceOffer(id);
  if (!offer) redirect('/admin/ponuky');
  const settings = await getPriceOfferSettings();
  const pdf = await renderPriceOfferPdf(offer, settings);
  const result = await sendPriceOfferDocumentEmail(offer, settings, pdf);
  if (result.sent) {
    await updatePriceOfferStatus(id, 'ODOSLANA', actor);
    await addAuditLog('business_job', offer.jobId || offer.id, 'price_offer_email_sent', actor, { number: offer.number, email: offer.email });
  } else {
    await addAuditLog('business_job', offer.jobId || offer.id, 'price_offer_email_error', actor, { number: offer.number, reason: result.reason });
  }
  revalidatePath('/admin/ponuky');
  revalidatePath(`/admin/ponuky/${id}`);
  revalidatePath('/admin/dashboard');
  redirect(`/admin/ponuky/${id}`);
}

export async function updatePriceOfferStatusAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || 'PRIPRAVENA') as PriceOfferStatus;
  if (id) await updatePriceOfferStatus(id, status, actor);
  revalidatePath('/admin/ponuky');
}

export async function deletePriceOfferAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  if (id) await deletePriceOffer(id, actor);
  revalidatePath('/admin/ponuky');
}
