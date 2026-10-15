import { createHash } from 'node:crypto';
import { slovakCalendarDateAfterDays } from '@/src/lib/date-only';
import { priceOfferMaterialFromText } from '@/src/lib/price-offer-material';
import {
  createCaseDraftFromApprovedPhoto,
  createReviewRequest,
  ensureAdminAutopilotSchema,
  getBusinessJobIdsWithPriceOffers,
  getPriceOfferSettings,
  listBusinessJobs,
  listEligibleReviewJobs,
  listPhotoIntakeRecords,
  savePriceOffer,
} from './db';
import { getReviewRequestSettings } from './review-request-settings';
import type { BusinessJob, PriceOfferInput } from './types';

export type AdminAutopilotResult = {
  priceOffersCreated: number;
  reviewRequestsPrepared: number;
  realizationDraftsCreated: number;
  photosAttached: number;
  blockedOfferJobIds: Array<{ jobId: string; reason: string }>;
  unavailable: string[];
};

function deterministicUuid(scope: string, id: string) {
  const hex = createHash('sha256').update(`${scope}:${id}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function emailIsUsable(value: string) {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value.trim());
}

function phoneIsUsable(value: string) {
  return value.replace(/\D/g, '').length >= 7;
}

function priceOfferBlocker(job: BusinessJob, pricePerM2: number) {
  if (!job.customerName.trim()) return 'missing_customer_name';
  if (!emailIsUsable(job.customerEmail)) return 'missing_customer_email';
  if (!phoneIsUsable(job.customerPhone)) return 'missing_customer_phone';
  if (!job.location.trim()) return 'missing_location';
  if (!job.objectType.trim()) return 'missing_object_type';
  if (!job.materialType.trim()) return 'missing_material_type';
  if (job.m2 <= 0) return 'missing_area';
  if (pricePerM2 <= 0) return 'missing_price_rule';
  return '';
}

function assistantOfferInput(job: BusinessJob, settings: Awaited<ReturnType<typeof getPriceOfferSettings>>): PriceOfferInput {
  const materialType = priceOfferMaterialFromText(job.materialType);
  return {
    jobId: job.id,
    objectType: job.objectType,
    objectAddress: job.location,
    municipality: job.location,
    district: job.district,
    contactPerson: job.customerName,
    phone: job.customerPhone,
    email: job.customerEmail,
    realizationTerm: job.term || 'dohodou – po splnení potrebného postupu pred prácami',
    materialType,
    areaM2: job.m2,
    pricePerM2WithoutVat: settings.materialPrices[materialType],
    documentationFeeWithoutVat: settings.documentationFee,
    includeDocumentation: true,
    documentationPromotion: false,
    includeTransport: false,
    transportFrom: 'Poprad',
    transportTo: job.location,
    transportRoundTripKm: 0,
    transportPricePerKm: 0.7,
    validUntil: slovakCalendarDateAfterDays(60),
    internalNote: 'Koncept automaticky pripravil firemný asistent. Pred odoslaním overte výmeru, cenu, rozsah, dopravu, termín a kontaktné údaje.',
    sourceInquiry: job.leadId ? `dopyt:${job.leadId}` : job.leadSource,
  };
}

export async function reconcileAdminAutopilot(options: { actorEmail?: string; limit?: number } = {}): Promise<AdminAutopilotResult> {
  const actorEmail = options.actorEmail || 'system:admin-autopilot';
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 50)));
  const result: AdminAutopilotResult = {
    priceOffersCreated: 0,
    reviewRequestsPrepared: 0,
    realizationDraftsCreated: 0,
    photosAttached: 0,
    blockedOfferJobIds: [],
    unavailable: [],
  };

  await ensureAdminAutopilotSchema();

  const [jobs, offerSettings] = await Promise.all([listBusinessJobs(), getPriceOfferSettings()]);
  const eligibleJobs = jobs.filter((job) => !job.deletedAt && !job.isTestData
    && ['DOPYT', 'DOPYT_PRIJATY'].includes(job.status));
  const jobsWithOffer = await getBusinessJobIdsWithPriceOffers(eligibleJobs.map((job) => job.id));
  const candidates = eligibleJobs.filter((job) => !jobsWithOffer.has(job.id)).slice(0, limit);
  for (const job of candidates) {
    const input = assistantOfferInput(job, offerSettings);
    const blocker = priceOfferBlocker(job, input.pricePerM2WithoutVat);
    if (blocker) {
      result.blockedOfferJobIds.push({ jobId: job.id, reason: blocker });
      continue;
    }
    await savePriceOffer(input, actorEmail, deterministicUuid('assistant-offer', job.id), { allowCreateWithId: true });
    result.priceOffersCreated += 1;
  }

  try {
    const [eligibleJobs, reviewSettings] = await Promise.all([listEligibleReviewJobs(), getReviewRequestSettings()]);
    for (const job of eligibleJobs.slice(0, limit)) {
      await createReviewRequest({
        jobId: job.id,
        leadId: job.leadId,
        customerName: job.customerName,
        customerEmail: job.customerEmail,
        phone: job.customerPhone,
        location: job.location,
        objectType: job.objectType,
        realizationDate: job.realizationDate,
        googleReviewLink: reviewSettings.googleReviewLink,
        subject: reviewSettings.subject,
        message: reviewSettings.body,
        reminderAllowed: reviewSettings.reminderEnabled,
        status: 'pending_approval',
        createdBy: actorEmail,
      });
      result.reviewRequestsPrepared += 1;
    }
  } catch {
    result.unavailable.push('review_requests');
  }

  try {
    const photos = await listPhotoIntakeRecords({ approvedOnly: true, page: 1, pageSize: limit });
    for (const photo of photos.records.filter((item) => item.businessJobId)) {
      const prepared = await createCaseDraftFromApprovedPhoto({ mediaId: photo.id, updatedBy: actorEmail });
      if (prepared.created) result.realizationDraftsCreated += 1;
      if (prepared.attached) result.photosAttached += 1;
    }
  } catch {
    result.unavailable.push('photo_intake');
  }

  return result;
}

