import { createHash } from 'node:crypto';
import { isValidIsoCalendarDate, slovakCalendarDateAfterDays } from '@/src/lib/date-only';
import { calculatePriceOfferPricing } from '@/src/lib/price-offer-pricing';
import { priceOfferEmailHtml, priceOfferEmailText } from './mail';
import type { LeadStatus, PriceOffer, PriceOfferSettings } from './types';

export function isPriceOfferLeadStatusOpen(status: LeadStatus | undefined) {
  return Boolean(status && !['nevyslo', 'zrusena', 'archivovane'].includes(status));
}

export type PriceOfferPreflightItem = {
  code: string;
  message: string;
};

export type PriceOfferPreflight = {
  blockers: PriceOfferPreflightItem[];
  warnings: PriceOfferPreflightItem[];
};

export type PriceOfferPreflightOptions = {
  linkedJobAvailable?: boolean;
  linkedJobIsTestData?: boolean;
  linkedLeadActive?: boolean;
  expectedStatus?: PriceOffer['status'];
  now?: Date;
};

function moneyEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.005;
}

function isSingleEmailAddress(value: string) {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);
}

function isUsablePhone(value: string) {
  return /^[+\d][\d\s().\/-]{6,39}$/.test(value) && value.replace(/\D/g, '').length >= 7;
}

export function evaluatePriceOfferPreflight(
  offer: PriceOffer,
  options: PriceOfferPreflightOptions = {},
): PriceOfferPreflight {
  const blockers: PriceOfferPreflightItem[] = [];
  const warnings: PriceOfferPreflightItem[] = [];
  const today = slovakCalendarDateAfterDays(0, options.now);
  const nearExpiry = slovakCalendarDateAfterDays(2, options.now);
  const pricing = calculatePriceOfferPricing(offer, offer.vatRate);

  const expectedStatus = options.expectedStatus ?? 'PRIPRAVENA';
  if (offer.status !== expectedStatus) blockers.push({ code: 'offer_not_ready', message: 'Ponuka už nie je v očakávanom stave na bezpečné odoslanie.' });
  if (offer.deletedAt) blockers.push({ code: 'offer_archived', message: 'Archivovanú ponuku nemožno odoslať.' });
  if (offer.isTestData) blockers.push({ code: 'test_offer', message: 'Testovaciu cenovú ponuku nemožno odoslať zákazníkovi.' });
  if (offer.jobId && options.linkedJobAvailable === false) blockers.push({ code: 'parent_job_unavailable', message: 'Prepojená zákazka už nie je aktívna. Najprv skontrolujte zdroj ponuky.' });
  if (offer.jobId && options.linkedJobIsTestData) blockers.push({ code: 'parent_job_test', message: 'Prepojená zákazka je označená ako testovacia. Ponuku nemožno odoslať.' });
  if (options.linkedLeadActive === false) blockers.push({ code: 'parent_lead_closed', message: 'Prepojený dopyt je uzavretý alebo zrušený. Ponuku nemožno odoslať.' });
  if (!isValidIsoCalendarDate(offer.validUntil) || offer.validUntil < today) blockers.push({ code: 'offer_expired', message: 'Platnosť ponuky uplynula. Pred odoslaním vytvorte aktuálnu verziu.' });
  else if (offer.validUntil <= nearExpiry) warnings.push({ code: 'offer_near_expiry', message: 'Platnosť ponuky končí najneskôr do dvoch dní.' });
  if (!offer.contactPerson.trim()) blockers.push({ code: 'missing_contact', message: 'Chýba kontaktná osoba.' });
  if (!isSingleEmailAddress(offer.email.trim())) blockers.push({ code: 'invalid_email', message: 'Email zákazníka nie je platná samostatná adresa.' });
  if (!isUsablePhone(offer.phone.trim())) blockers.push({ code: 'invalid_phone', message: 'Telefón zákazníka nie je použiteľný.' });
  if (!offer.objectType.trim() || !offer.objectAddress.trim() || !offer.municipality.trim()) blockers.push({ code: 'missing_location', message: 'Chýba typ objektu alebo jeho lokalita.' });
  if (!(offer.areaM2 > 0) || !(offer.pricePerM2WithoutVat >= 0) || !(offer.totalWithVat > 0)) blockers.push({ code: 'invalid_price', message: 'Výmera alebo výsledná cena nie je použiteľná.' });
  if (!moneyEqual(offer.materialPriceWithoutVat, pricing.materialPriceWithoutVat)
    || !moneyEqual(offer.totalWithoutVat, pricing.totalWithoutVat)
    || !moneyEqual(offer.totalWithVat, pricing.totalWithVat)) {
    blockers.push({ code: 'price_mismatch', message: 'Uložené súčty sa nezhodujú s položkami ponuky. Ponuku znovu uložte a skontrolujte.' });
  }
  if (offer.areaM2 >= 100 && offer.includeTransport) blockers.push({ code: 'transport_over_100', message: 'Pri ploche od 100 m² sa doprava po Slovensku neúčtuje. Odstráňte účtovanú dopravu.' });
  if (offer.includeTransport && (!offer.transportFrom.trim() || !offer.transportTo.trim() || offer.transportRoundTripKm <= 0 || offer.transportPricePerKm <= 0)) {
    blockers.push({ code: 'invalid_transport', message: 'Účtovaná doprava nemá kompletnú trasu, kilometre alebo sadzbu.' });
  }
  if ((offer.emailSubject || '').trim().length < 5 || (offer.emailBody || '').trim().length < 20) blockers.push({ code: 'incomplete_email', message: 'Predmet alebo sprievodný list nie je kompletný.' });
  if (!offer.realizationTerm.trim()) warnings.push({ code: 'missing_realization_term', message: 'Termín realizácie zostáva uvedený iba ako „dohodou“.' });

  return { blockers, warnings };
}

export function priceOfferApprovalFingerprint(
  offer: PriceOffer,
  settings: PriceOfferSettings,
  options: Pick<PriceOfferPreflightOptions, 'linkedJobAvailable' | 'linkedJobIsTestData' | 'linkedLeadActive'> = {},
) {
  const approvedSnapshot = {
    id: offer.id,
    jobId: offer.jobId || '',
    workflowStatus: offer.status === 'ODOSIELA' ? 'PRIPRAVENA' : offer.status,
    deletedAt: offer.deletedAt || '',
    isTestData: Boolean(offer.isTestData),
    linkedJobAvailable: offer.jobId ? options.linkedJobAvailable !== false : true,
    linkedJobIsTestData: offer.jobId ? Boolean(options.linkedJobIsTestData) : false,
    linkedLeadActive: options.linkedLeadActive !== false,
    number: offer.number,
    validUntil: offer.validUntil,
    objectType: offer.objectType,
    objectAddress: offer.objectAddress,
    municipality: offer.municipality,
    district: offer.district,
    contactPerson: offer.contactPerson,
    phone: offer.phone,
    email: offer.email,
    realizationTerm: offer.realizationTerm,
    materialType: offer.materialType,
    areaM2: offer.areaM2,
    pricePerM2WithoutVat: offer.pricePerM2WithoutVat,
    documentationFeeWithoutVat: offer.documentationFeeWithoutVat,
    includeDocumentation: offer.includeDocumentation,
    documentationPromotion: offer.documentationPromotion,
    includeTransport: offer.includeTransport,
    transportFrom: offer.transportFrom,
    transportTo: offer.transportTo,
    transportRoundTripKm: offer.transportRoundTripKm,
    transportPricePerKm: offer.transportPricePerKm,
    materialPriceWithoutVat: offer.materialPriceWithoutVat,
    totalWithoutVat: offer.totalWithoutVat,
    totalWithVat: offer.totalWithVat,
    vatRate: offer.vatRate,
    offerNote: offer.offerNote || '',
    emailSubject: offer.emailSubject || '',
    emailBody: offer.emailBody || '',
    emailText: priceOfferEmailText(offer, settings),
    emailHtml: priceOfferEmailHtml(offer, settings),
  };
  return createHash('sha256').update(JSON.stringify(approvedSnapshot), 'utf8').digest('hex');
}
