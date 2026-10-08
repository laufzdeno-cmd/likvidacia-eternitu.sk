'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import {
  claimPriceOfferForSending,
  confirmUncertainPriceOfferSent,
  deletePriceOffer,
  finishPriceOfferSending,
  getPriceOffer,
  getPriceOfferSettings,
  savePriceOffer,
  resetUncertainPriceOfferSend,
  updatePriceOfferStatus,
} from '@/src/server/db';
import { sendPriceOfferDocumentEmail } from '@/src/server/mail';
import { renderPriceOfferPdf } from '@/src/server/price-offer-pdf';
import { validatePriceOfferNote } from '@/src/lib/price-offer-note';
import { roundTripDistanceKm } from '@/src/lib/price-offer-distance';
import { isValidIsoCalendarDate } from '@/src/lib/date-only';
import type { PriceOfferInput, PriceOfferMaterialType } from '@/src/server/types';

const allowedMaterialTypes = new Set<PriceOfferMaterialType>([
  'VLNITY_ETERNIT',
  'HLADKY_ETERNIT',
  'AZBESTOVE_RURY',
  'PODHLADOVE_DOSKY',
  'BOLETICKY',
  'INE',
]);

function isSingleEmailAddress(value: string) {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);
}

function isUsablePhone(value: string) {
  return /^[+\d][\d\s().\/-]{6,39}$/.test(value) && value.replace(/\D/g, '').length >= 7;
}

function todayInSlovakia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bratislava',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function num(value: FormDataEntryValue | null) {
  return Number(String(value || '').replace(',', '.')) || 0;
}

function actionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Cenovu ponuku sa nepodarilo odoslat.';
}

function parseOffer(formData: FormData): PriceOfferInput {
  const rawJobId = String(formData.get('jobId') || '');
  return {
    jobId: rawJobId && rawJobId !== 'lead-prefill' ? rawJobId : undefined,
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
    documentationPromotion: formData.get('documentationPromotion') === 'on',
    includeTransport: formData.get('includeTransport') === 'on',
    transportFrom: String(formData.get('transportFrom') || '').trim(),
    transportTo: String(formData.get('transportTo') || '').trim(),
    transportRoundTripKm: num(formData.get('transportRoundTripKm')),
    transportPricePerKm: formData.has('transportPricePerKm') ? num(formData.get('transportPricePerKm')) : 0.7,
    validUntil: String(formData.get('validUntil') || ''),
    offerNote: validatePriceOfferNote(formData.get('offerNote')),
    internalNote: String(formData.get('internalNote') || '').trim(),
    sourceInquiry: String(formData.get('sourceInquiry') || '').trim(),
  };
}

export async function calculateTransportDistanceAction(formData: FormData): Promise<{ distanceKm?: number; error?: string }> {
  await verifyCsrf(formData);
  await requireAdmin();
  const origin = String(formData.get('origin') || '').trim();
  const destination = String(formData.get('destination') || '').trim();
  if (!origin || !destination || origin.length > 250 || destination.length > 250) {
    return { error: 'Vyplňte platné miesto odchodu a cieľ cesty.' };
  }
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return { error: 'Automatický výpočet kilometrov nie je nastavený. Kilometre môžete zadať ručne.' };
  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'routes.distanceMeters' },
      body: JSON.stringify({ origin: { address: origin }, destination: { address: destination }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', units: 'METRIC' }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!response.ok) return { error: 'Mapy nevedeli vypočítať trasu. Skontrolujte adresy alebo zadajte kilometre ručne.' };
    const data = await response.json() as { routes?: Array<{ distanceMeters?: number }> };
    const distanceKm = roundTripDistanceKm(data.routes?.[0]?.distanceMeters);
    return distanceKm === null ? { error: 'Pre túto trasu sa nepodarilo získať použiteľnú vzdialenosť. Kilometre môžete zadať ručne.' } : { distanceKm };
  } catch {
    return { error: 'Výpočet trasy sa nepodaril. Kilometre môžete zadať ručne.' };
  }
}

export async function savePriceOfferAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '') || undefined;
  const next = String(formData.get('next') || '');
  const input = parseOffer(formData);
  if (!input.objectType || input.objectType.length > 120 || !input.objectAddress || input.objectAddress.length > 250
    || !input.municipality || input.municipality.length > 120 || input.district.length > 120
    || !input.contactPerson || input.contactPerson.length > 160 || !isUsablePhone(input.phone)
    || input.realizationTerm.length > 250
    || !isSingleEmailAddress(input.email) || input.email.length > 254
    || !allowedMaterialTypes.has(input.materialType)
    || !isValidIsoCalendarDate(input.validUntil) || input.validUntil < todayInSlovakia()
    || input.areaM2 <= 0 || input.areaM2 > 100_000
    || input.pricePerM2WithoutVat < 0 || input.pricePerM2WithoutVat > 100_000
    || input.documentationFeeWithoutVat < 0 || input.documentationFeeWithoutVat > 1_000_000
    || input.transportRoundTripKm < 0 || input.transportRoundTripKm > 4_000
    || input.transportPricePerKm < 0 || input.transportPricePerKm > 100
    || input.transportFrom.length > 250 || input.transportTo.length > 250
    || (input.includeTransport && (!input.transportFrom || !input.transportTo || input.transportRoundTripKm <= 0))) {
    throw new Error('Skontrolujte povinné údaje, telefón, email, platnosť a hodnoty cenovej ponuky. Pri účtovanej doprave zadajte trasu, kilometre aj sadzbu.');
  }
  const offer = await savePriceOffer(input, actor, id);
  revalidatePath('/admin/ponuky');
  revalidatePath('/admin/dopyty');
  revalidatePath('/admin/zakazky');
  if (offer.leadId) revalidatePath(`/admin/dopyty/${offer.leadId}`);
  if (offer.jobId) revalidatePath(`/admin/zakazky/${offer.jobId}`);
  revalidatePath('/admin/dashboard');
  if (next === 'send') redirect(`/admin/ponuky/${offer.id}?send=1`);
  redirect(`/admin/ponuky/${offer.id}`);
}

export async function sendPriceOfferAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const current = await getPriceOffer(id);
  if (!current) redirect('/admin/ponuky');
  if (current.status !== 'PRIPRAVENA') {
    redirect(`/admin/ponuky/${id}?sendError=${encodeURIComponent('Ponuka nie je pripravená na odoslanie. Skontrolujte jej aktuálny stav.')}`);
  }

  const offer = await claimPriceOfferForSending(id, actor);
  if (!offer) {
    redirect(`/admin/ponuky/${id}?sendError=${encodeURIComponent('Ponuku už spracúva iná požiadavka alebo sa jej stav zmenil. Obnovte stránku a skontrolujte stav.')}`);
  }
  const sendAttemptId = offer.sendAttemptId;
  if (!sendAttemptId) throw new Error('Pokus o odoslanie nemá bezpečný identifikátor. Ponuku neposielajte opakovane a skontrolujte jej stav.');

  let outcome: 'sent' | 'not_sent' | 'unknown' = 'not_sent';
  let deliveryReason = '';
  let sent = false;
  let sendError = '';
  try {
    const settings = await getPriceOfferSettings();
    const pdf = await renderPriceOfferPdf(offer, settings);
    outcome = 'unknown';
    const result = await sendPriceOfferDocumentEmail(offer, settings, pdf);
    outcome = result.status;
    deliveryReason = result.reason || '';
    const finalized = await finishPriceOfferSending(id, sendAttemptId, result.status, actor);
    if (!finalized) throw new Error('Stav odoslania sa nepodarilo uzavrieť. E-mail pred ďalším pokusom overte.');
    if (result.status === 'sent') {
      sent = true;
    } else {
      sendError = result.status === 'unknown'
        ? `Výsledok odoslania nie je potvrdený${result.reason ? `: ${result.reason}` : ''}. Skontrolujte schránku pred opakovaným odoslaním.`
        : result.reason || 'E-mail sa neodoslal. Opravte nastavenie a skúste to znova.';
    }
  } catch (error) {
    sendError = actionErrorMessage(error);
    try {
      const finalized = await finishPriceOfferSending(id, sendAttemptId, outcome, actor);
      const persisted = finalized || await getPriceOffer(id);
      const expectedStatePersisted = outcome === 'sent'
        ? Boolean(persisted && ['ODOSLANA', 'PRIJATA'].includes(persisted.status))
        : outcome === 'unknown'
          ? persisted?.status === 'NEISTY_STAV'
          : persisted?.status === 'PRIPRAVENA';
      if (expectedStatePersisted && outcome === 'sent') {
        sent = true;
        sendError = '';
      } else if (expectedStatePersisted && outcome === 'unknown') {
        sendError = `Výsledok odoslania nie je potvrdený${deliveryReason ? `: ${deliveryReason}` : ''}. Skontrolujte schránku pred opakovaným odoslaním.`;
      } else if (expectedStatePersisted) {
        sendError = deliveryReason || 'E-mail sa neodoslal. Opravte nastavenie a skúste to znova.';
      } else {
        sendError = 'Výsledok odoslania sa nepodarilo uložiť. Pred opakovaním overte schránku.';
      }
    } catch {
      sendError = 'Výsledok odoslania sa nepodarilo bezpečne uložiť. Pred opakovaním overte schránku.';
    }
  }

  revalidatePath('/admin/ponuky');
  revalidatePath(`/admin/ponuky/${id}`);
  revalidatePath('/admin/dopyty');
  revalidatePath('/admin/zakazky');
  if (offer.leadId) revalidatePath(`/admin/dopyty/${offer.leadId}`);
  if (offer.jobId) revalidatePath(`/admin/zakazky/${offer.jobId}`);
  revalidatePath('/admin/dashboard');
  if (sent) redirect(`/admin/ponuky/${id}?sent=1`);
  redirect(`/admin/ponuky/${id}?sendError=${encodeURIComponent(sendError.slice(0, 300))}`);
}

const uncertainSendEvidenceCodes = new Set([
  'sent_folder_verified',
  'recipient_confirmed',
  'provider_confirmed',
]);

export async function confirmUncertainPriceOfferSentAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const reason = String(formData.get('confirmationEvidence') || '');
  if (formData.get('confirmedSent') !== 'yes' || !uncertainSendEvidenceCodes.has(reason)) {
    redirect(`/admin/ponuky/${id}?sendError=${encodeURIComponent('Potvrďte kontrolu a vyberte, ako bolo odoslanie overené.')}`);
  }
  const confirmed = await confirmUncertainPriceOfferSent(id, actor, reason);
  if (!confirmed) {
    redirect(`/admin/ponuky/${id}?sendError=${encodeURIComponent('Odoslanie nemožno potvrdiť. Obnovte stránku a skontrolujte aktuálny stav ponuky.')}`);
  }
  revalidatePath('/admin/ponuky');
  revalidatePath(`/admin/ponuky/${id}`);
  revalidatePath('/admin/dopyty');
  revalidatePath('/admin/zakazky');
  if (confirmed.leadId) revalidatePath(`/admin/dopyty/${confirmed.leadId}`);
  if (confirmed.jobId) revalidatePath(`/admin/zakazky/${confirmed.jobId}`);
  revalidatePath('/admin/dashboard');
  redirect(`/admin/ponuky/${id}?sendConfirmed=1`);
}

export async function resetUncertainPriceOfferSendAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  if (formData.get('confirmedNotSent') !== 'yes') {
    redirect(`/admin/ponuky/${id}?sendError=${encodeURIComponent('Pred opätovným pokusom potvrďte kontrolu schránky.')}`);
  }
  const reset = await resetUncertainPriceOfferSend(id, actor);
  revalidatePath('/admin/ponuky');
  revalidatePath(`/admin/ponuky/${id}`);
  revalidatePath('/admin/dopyty');
  revalidatePath('/admin/zakazky');
  if (!reset) {
    redirect(`/admin/ponuky/${id}?sendError=${encodeURIComponent('Stav nemožno obnoviť. Počkajte aspoň 15 minút od pokusu a overte schránku.')}`);
  }
  redirect(`/admin/ponuky/${id}?sendReset=1`);
}

export async function updatePriceOfferStatusAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const id = String(formData.get('id') || '');
  const statusValue = String(formData.get('status') || '');
  if (id && statusValue === 'PRIJATA') {
    const updated = await updatePriceOfferStatus(id, 'PRIJATA', actor);
    if (!updated) throw new Error('Ako prijatú možno označiť iba odoslanú a nearchivovanú cenovú ponuku. Obnovte stránku a skontrolujte jej stav.');
    revalidatePath('/admin/dopyty');
    revalidatePath('/admin/zakazky');
    if (updated.leadId) revalidatePath(`/admin/dopyty/${updated.leadId}`);
    if (updated.jobId) revalidatePath(`/admin/zakazky/${updated.jobId}`);
    revalidatePath('/admin/dashboard');
  }
  revalidatePath('/admin/ponuky');
}

export async function deletePriceOfferAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const id = String(formData.get('id') || '');
  if (id) await deletePriceOffer(id, actor);
  revalidatePath('/admin/ponuky');
}
