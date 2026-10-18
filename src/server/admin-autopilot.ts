import { createHash } from 'node:crypto';
import { slovakCalendarDateAfterDays } from '@/src/lib/date-only';
import { priceOfferMaterialFromText } from '@/src/lib/price-offer-material';
import {
  createCaseDraftFromApprovedPhoto,
  createReviewRequest,
  ensureAdminAutopilotSchema,
  finishAdminAutopilotRun,
  getBusinessJobIdsWithPriceOffers,
  getPriceOfferSettings,
  listApprovedPhotosWithoutCaseDraft,
  listBusinessJobs,
  listEligibleReviewJobs,
  recordAdminAutopilotRunItem,
  savePriceOffer,
  startAdminAutopilotRun,
} from './db';
import { getReviewRequestSettings } from './review-request-settings';
import type { AdminAutopilotModule, AdminAutopilotRunStatus, AdminAutopilotTrigger, BusinessJob, PriceOfferInput } from './types';

export type AdminAutopilotResult = {
  runId: string;
  status: Exclude<AdminAutopilotRunStatus, 'running'>;
  priceOffersCreated: number;
  reviewRequestsPrepared: number;
  realizationDraftsCreated: number;
  photosAttached: number;
  blockedOfferJobIds: Array<{ jobId: string; reason: string }>;
  unavailable: string[];
};

const adminAutopilotModules: AdminAutopilotModule[] = ['offers', 'review_requests', 'photo_intake'];

export function classifyAdminAutopilotRun(
  unavailableModules: Iterable<AdminAutopilotModule>,
  createdOutputs: number,
): Exclude<AdminAutopilotRunStatus, 'running'> {
  const unavailable = new Set(unavailableModules);
  if (!unavailable.size) return 'succeeded';
  if (createdOutputs === 0 && adminAutopilotModules.every((module) => unavailable.has(module))) return 'failed';
  return 'degraded';
}

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

export async function reconcileAdminAutopilot(options: {
  actorEmail?: string;
  actorKind?: 'system' | 'superadmin';
  trigger?: AdminAutopilotTrigger;
  limit?: number;
} = {}): Promise<AdminAutopilotResult> {
  const actorEmail = options.actorEmail || 'system:admin-autopilot';
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 50)));
  const trigger = options.trigger ?? (actorEmail.startsWith('cron:') ? 'cron' : actorEmail.startsWith('system:test') ? 'test' : 'manual');
  const actorKind = options.actorKind ?? (trigger === 'manual' ? 'superadmin' : 'system');
  await ensureAdminAutopilotSchema();
  const run = await startAdminAutopilotRun({ trigger, actorKind });
  const result: AdminAutopilotResult = {
    runId: run.id,
    status: 'succeeded',
    priceOffersCreated: 0,
    reviewRequestsPrepared: 0,
    realizationDraftsCreated: 0,
    photosAttached: 0,
    blockedOfferJobIds: [],
    unavailable: [],
  };
  const unavailable = new Set<AdminAutopilotModule>();
  const markUnavailable = (module: AdminAutopilotModule) => unavailable.add(module);

  try {
    try {
      const [jobs, offerSettings] = await Promise.all([listBusinessJobs({ limit: null }), getPriceOfferSettings()]);
      const eligibleJobs = jobs.filter((job) => !job.deletedAt && !job.isTestData
        && ['DOPYT', 'DOPYT_PRIJATY'].includes(job.status));
      const jobsWithOffer = await getBusinessJobIdsWithPriceOffers(eligibleJobs.map((job) => job.id));
      const candidates = eligibleJobs.filter((job) => !jobsWithOffer.has(job.id));
      for (const job of candidates) {
        if (result.priceOffersCreated >= limit) break;
        const input = assistantOfferInput(job, offerSettings);
        const blocker = priceOfferBlocker(job, input.pricePerM2WithoutVat);
        if (blocker) {
          result.blockedOfferJobIds.push({ jobId: job.id, reason: blocker });
          await recordAdminAutopilotRunItem({ runId: run.id, module: 'offers', entityId: job.id, outcome: 'blocked', reasonCode: blocker });
          continue;
        }
        try {
          const offerId = deterministicUuid('assistant-offer', job.id);
          await savePriceOffer(input, actorEmail, offerId, { allowCreateWithId: true });
          result.priceOffersCreated += 1;
          // Created items point to the exact prepared offer. This lets later
          // metrics prove human review/sending without guessing by job.
          await recordAdminAutopilotRunItem({ runId: run.id, module: 'offers', entityId: offerId, outcome: 'created' });
        } catch {
          markUnavailable('offers');
          await recordAdminAutopilotRunItem({ runId: run.id, module: 'offers', entityId: job.id, outcome: 'failed', reasonCode: 'offer_prepare_failed' });
        }
      }
    } catch {
      markUnavailable('offers');
    }

    try {
      const [eligibleJobs, reviewSettings] = await Promise.all([listEligibleReviewJobs(), getReviewRequestSettings()]);
      for (const job of eligibleJobs) {
        if (result.reviewRequestsPrepared >= limit) break;
        try {
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
            // The global setting only makes reminders available. A concrete
            // customer reminder still needs an explicit human opt-in when the
            // first request is approved for sending.
            reminderAllowed: false,
            status: 'pending_approval',
            createdBy: actorEmail,
          });
          result.reviewRequestsPrepared += 1;
          await recordAdminAutopilotRunItem({ runId: run.id, module: 'review_requests', entityId: job.id, outcome: 'created' });
        } catch {
          markUnavailable('review_requests');
          await recordAdminAutopilotRunItem({ runId: run.id, module: 'review_requests', entityId: job.id, outcome: 'failed', reasonCode: 'review_prepare_failed' });
        }
      }
    } catch {
      markUnavailable('review_requests');
    }

    try {
      const photos = await listApprovedPhotosWithoutCaseDraft(limit);
      for (const photo of photos) {
        try {
          const prepared = await createCaseDraftFromApprovedPhoto({ mediaId: photo.id, updatedBy: actorEmail });
          if (prepared.created) result.realizationDraftsCreated += 1;
          if (prepared.attached) result.photosAttached += 1;
          if (prepared.created || prepared.attached) {
            await recordAdminAutopilotRunItem({ runId: run.id, module: 'photo_intake', entityId: photo.id, outcome: 'created' });
          }
        } catch {
          markUnavailable('photo_intake');
          await recordAdminAutopilotRunItem({ runId: run.id, module: 'photo_intake', entityId: photo.id, outcome: 'failed', reasonCode: 'photo_attach_failed' });
        }
      }
    } catch {
      markUnavailable('photo_intake');
    }

    result.unavailable = [...unavailable];
    result.status = classifyAdminAutopilotRun(unavailable,
      result.priceOffersCreated + result.reviewRequestsPrepared + result.realizationDraftsCreated + result.photosAttached);
    await finishAdminAutopilotRun({
      runId: run.id,
      status: result.status,
      counts: {
        priceOffersCreated: result.priceOffersCreated,
        reviewRequestsPrepared: result.reviewRequestsPrepared,
        realizationDraftsCreated: result.realizationDraftsCreated,
        photosAttached: result.photosAttached,
        blockedOffers: result.blockedOfferJobIds.length,
      },
      unavailableModules: result.unavailable as AdminAutopilotModule[],
      errorCode: result.status === 'failed' ? 'all_modules_unavailable' : undefined,
    });
    return result;
  } catch (error) {
    await finishAdminAutopilotRun({
      runId: run.id,
      status: 'failed',
      counts: {
        priceOffersCreated: result.priceOffersCreated,
        reviewRequestsPrepared: result.reviewRequestsPrepared,
        realizationDraftsCreated: result.realizationDraftsCreated,
        photosAttached: result.photosAttached,
        blockedOffers: result.blockedOfferJobIds.length,
      },
      unavailableModules: [...unavailable],
      errorCode: 'assistant_run_failed',
    }).catch(() => undefined);
    throw error;
  }
}

