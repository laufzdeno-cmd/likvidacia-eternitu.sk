import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { ANALYTICS_EVENTS_LIMIT, bratislavaMidnightUtc, dateInBratislava, getAnalyticsPeriod, getMeasuredSessionSets, getSequentialMeasuredFunnel, getSessionEntryDevice, getSessionEntryEvents, limitAnalyticsEventRows, summarizeCrmCohort, type AnalyticsPeriod } from './analytics-metrics';
import { isApproximateLocality, isPhotoCategory, isPublishableRealizationLocality } from './photo-intake-policy';
import { isLeadEmailEvidenceValid } from './lead-email-evidence.mjs';
import { isApplicationNotificationEvidenceValid } from './application-notification-evidence.mjs';
import { canManuallyRetryLeadEmail, isLeadSmtpConfigured } from './mail';
import { isAstanaLocalRelayConfigured, leadDeliveryMode } from './astana-local-relay';
import { describeLeadMailHealth } from './lead-mail-health';
import { getRuntimeFeatureHealth } from './runtime-feature-health';
import { isValidLeadSubmissionId } from '../lib/lead-submission-id.mjs';
import { isValidIsoCalendarDate, slovakCalendarDateAfterDays } from '../lib/date-only';
import { priceOfferNumberYear } from '../lib/price-offer-number-year';
import { normalizeAdminSessionEpoch } from './admin-session-policy';
import {
  shouldFallbackToDefaultSiteContent,
  shouldUseDefaultSiteContent,
} from './site-content-build-policy';
import type {
  AuditLog,
  AnalyticsEvent,
  AnalyticsEventInput,
  AnalyticsReport,
  AnalyticsTrafficSlice,
  AnalyticsTrafficSummary,
  LeadAttributionReportRow,
  AdminRole,
  AdminUser,
  ApplicationNotification,
  ApplicationNotificationEntity,
  ApplicationNotificationRecipient,
  AdminUserInput,
  BusinessJob,
  BusinessJobCosts,
  BusinessFinanceMonthlySummary,
  BusinessFinanceSummary,
  BusinessJobFinance,
  BusinessJobInput,
  BusinessJobInvoice,
  BusinessJobInvoiceCancellationInput,
  BusinessJobInvoiceInput,
  BusinessJobPaymentEvent,
  BusinessJobPaymentInput,
  BusinessJobPaymentReversalInput,
  BusinessJobStatus,
  BusinessLandfill,
  BusinessPaymentType,
  BusinessPaymentMethod,
  BusinessSettings,
  BusinessWorkType,
  CareerApplication,
  CareerApplicationFilters,
  CareerApplicationWorkflowInput,
  CareerApplicationCv,
  LandfillPrice,
  Lead,
  LeadDuplicateMatch,
  LeadFile,
  LeadInput,
  LeadQueueCounts,
  LeadSummaryPage,
  LeadStatus,
  LeadSummary,
  MetaCapiDeliveryOutcome,
  MetaCapiDispatchInput,
  MetaCapiOutboxClaim,
  MetaCapiOutboxStatus,
  MetaCapiOutboxSummary,
  PriceOffer,
  PriceOfferInput,
  PriceOfferMaterialType,
  PriceOfferSettings,
  PriceOfferStatus,
  PublishedRealization,
  PublishedRealizationCase,
  PlannerAction,
  PlannerActionInput,
  PlannerActionStatus,
  PlannerActionType,
  Quote,
  QuoteInput,
  Realization,
  RealizationCaseDraft,
  RealizationInput,
  RealizationStatus,
  ReviewRequest,
  ReviewRequestInput,
  ReviewRequestStatus,
  Roofer,
  RooferInput,
  RooferRegistration,
  RooferRegistrationStatus,
  SiteContentItem,
  TestimonialAdminHistoryItem,
  Testimonial,
  TestimonialInput,
  TestimonialStatus,
  Worker,
} from './types';
import { createAcceptedLeadConversion } from './lead-conversion';
import { cleanSlovakText } from './slovak-text';
import { mergeSiteContent } from './site-content-map';
import { canUseTestimonialStatus, testimonialPublicContentHash } from './testimonial-policy';
import { testimonialConsentHistoryEntries } from './testimonial-consent-history';
import {
  adminTestimonialConsentVersion,
  bindPublicTestimonialConsent,
  publicTestimonialConsentVersion,
} from '../lib/testimonial-consent';
import { maxIntakePhotosPerInvite, photoIntakeRetentionDays } from './photo-intake-policy';
import { maxLeadFiles } from './validation';
import { summarizeLeadAttribution } from './lead-attribution-report';
import { persistAcceptedLeadAnalyticsBatch } from './analytics-recovery';
import { careerCvUploadContentTypes, isCareerCvUploadPath, validateCareerCvReservation } from './career-cv-policy';
import type { ApplicationRecipientResult } from './application-notification-policy';
import {
  opsAlertMetricKeys,
  opsAlertReasonCodes,
  type OpsAlertAuditSummary,
  type OpsAlertClaim,
  type OpsAlertState,
  type OpsAlertTransition,
  type OpsAlertWorker,
} from './ops-alert-policy';
import { deploymentDatabaseAccessBlocked, isVerifiedIsolatedStaging, isVerifiedLocalBuildHarness, runtimeSchemaInitializationAllowed, stagingDatabaseMarkerMatches } from './preview-safety';
import { mergeLatestTestClassifications } from './local-lead-test-classification';
import { assertDatabaseConfiguredForRuntime, databasePoolConfig, normalizeDatabaseUrl } from './database-config';
import { isRooferReferralEligible, resolveRooferReferralApproval, resolveRooferReferralApprovalUpdate } from './roofer-referral-policy';
import { calculatePriceOfferPricing } from '../lib/price-offer-pricing';
import { resolvePriceOfferVatRate } from '../lib/price-offer-vat';
import { validatePriceOfferNote } from '../lib/price-offer-note';
import { priceOfferUpdateLifecycle } from '../lib/price-offer-state';
import { MAX_BUSINESS_FINANCE_CENTS, projectBusinessJobFinance } from '../lib/business-billing';

type OpsAlertStateRecord = {
  id: string;
  workerKey: OpsAlertWorker;
  observedState: OpsAlertState;
  observedFingerprint: string;
  lastDeliveredState?: OpsAlertState;
  lastDeliveredFingerprint: string;
  lastDeliveredAt?: string;
  claimId?: string;
  claimTransition?: OpsAlertTransition;
  claimState?: OpsAlertState;
  claimFingerprint: string;
  claimedUntil?: string;
  updatedAt: string;
};

type LocalDb = {
  leads: Lead[];
  leadFiles: LeadFile[];
  leadFileDeletionJobs: LeadFileDeletionJob[];
  leadEmailOutbox: LeadEmailOutbox[];
  metaCapiOutbox: MetaCapiOutboxRecord[];
  metaCapiConsentRevocations: MetaCapiConsentRevocation[];
  auditLogs: AuditLog[];
  quotes: Quote[];
  testimonials: Testimonial[];
  testimonialConsentHistory: TestimonialConsentHistoryRecord[];
  reviewRequests: ReviewRequest[];
  workers: Worker[];
  adminUsers: AdminUser[];
  plannerActions: PlannerAction[];
  businessJobs: BusinessJob[];
  businessJobInvoices: BusinessJobInvoice[];
  businessJobPaymentEvents: BusinessJobPaymentEvent[];
  priceOffers: PriceOffer[];
  landfillPrices: LandfillPrice[];
  realizations: Realization[];
  roofers: Roofer[];
  rooferRegistrations: RooferRegistration[];
  careerApplications: CareerApplication[];
  siteContent: SiteContentItem[];
  analyticsEvents: AnalyticsEvent[];
  opsAlertStates: OpsAlertStateRecord[];
  adminSettings: Record<string, string>;
};

type TestimonialConsentHistoryRecord = {
  id: string;
  testimonialId: string;
  event: 'superseded' | 'granted' | 'revoked' | 'updated_without_consent';
  consentPublication: boolean;
  consentEvidence: string;
  consentCapturedAt?: string;
  consentVersion: string;
  consentRevokedAt?: string;
  snapshotCustomerName: string;
  snapshotRating: number;
  snapshotText: string;
  publicContentHash: string;
  actorEmail: string;
  recordedAt: string;
};

type LeadWithFiles = Lead & { files: LeadFile[]; quotes: Quote[]; auditLogs: AuditLog[] };
type BusinessJobWithActivity = BusinessJob & { activityLogs: AuditLog[] };

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
const localDbPath = process.env.ASTANA_LOCAL_DB_PATH || path.join(process.cwd(), '.data', 'local-db.json');
const siteContentAuditId = '00000000-0000-0000-0000-000000000001';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let pool: Pool | undefined;
let schemaReady = false;
let schemaInitialization: Promise<void> | undefined;
let localLeadSubmissionQueue: Promise<void> = Promise.resolve();
let localDbWriteQueue: Promise<void> = Promise.resolve();

function withLocalLeadSubmissionLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = localLeadSubmissionQueue.then(operation, operation);
  localLeadSubmissionQueue = result.then(() => undefined, () => undefined);
  return result;
}

function getPool() {
  assertDatabaseConfiguredForRuntime(databaseUrl);
  // Schema initialization also writes. A shared Neon Preview connection must never reach it.
  if (deploymentDatabaseAccessBlocked()) {
    throw new Error('Database access is disabled without verified production deployment identity.');
  }
  if (!databaseUrl) return undefined;
  pool ??= new Pool(databasePoolConfig(databaseUrl, process.env.DATABASE_POOL_MAX));
  return pool;
}

function now() {
  return new Date().toISOString();
}

function nextLocalTestimonialVersion(currentVersion?: string) {
  const prior = currentVersion ? Date.parse(currentVersion) : Number.NaN;
  const next = Number.isFinite(prior) ? Math.max(Date.now(), prior + 1) : Date.now();
  return new Date(next).toISOString();
}

function dateOnly(value: unknown) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Bratislava',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : '';
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function bratislavaTimestampRange(from: string, to: string) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Neplatné dátumové obdobie.');
    const [year, month, day] = value.split('-').map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.toISOString().slice(0, 10) !== value) throw new Error('Neplatné dátumové obdobie.');
    return { year, month, day };
  };
  const start = parse(from);
  const end = parse(to);
  if (from > to) throw new Error('Neplatné dátumové obdobie.');
  const dayAfterEnd = new Date(Date.UTC(end.year, end.month - 1, end.day + 1));
  const nextDay = { year: dayAfterEnd.getUTCFullYear(), month: dayAfterEnd.getUTCMonth() + 1, day: dayAfterEnd.getUTCDate() };
  return {
    from: bratislavaMidnightUtc(start).toISOString(),
    toExclusive: bratislavaMidnightUtc(nextDay).toISOString(),
  };
}

function toLead(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id),
    submissionId: row.submission_id || row.submissionId ? String(row.submission_id ?? row.submissionId) : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    status: String(row.status) as LeadStatus,
    isTestData: Boolean(row.is_test_data ?? row.isTestData ?? false),
    fullName: cleanSlovakText(String(row.full_name)),
    phone: String(row.phone),
    email: String(row.email),
    city: cleanSlovakText(String(row.city)),
    district: row.district ? cleanSlovakText(String(row.district)) : '',
    objectType: cleanSlovakText(String(row.object_type)),
    materialType: cleanSlovakText(String(row.material_type)),
    areaEstimate: Number(row.area_estimate),
    preferredContact: cleanSlovakText(row.preferovany_kontakt ? String(row.preferovany_kontakt) : row.preferredContact ? String(row.preferredContact) : 'Zavolajte mi'),
    roofer: row.roofer ? cleanSlovakText(String(row.roofer)) : '',
    term: row.term ? cleanSlovakText(String(row.term)) : '',
    note: row.note ? cleanSlovakText(String(row.note)) : '',
    gdpr: Boolean(row.gdpr),
    source: row.source ? String(row.source) : 'web',
    wantsRooferRecommendation: Boolean(row.wants_roofer_recommendation ?? row.wantsRooferRecommendation),
    selectedRooferId: row.selected_roofer_id ? String(row.selected_roofer_id) : row.selectedRooferId ? String(row.selectedRooferId) : '',
    internalNote: row.internal_note ? cleanSlovakText(String(row.internal_note)) : '',
    ownerEmail: row.owner_email ? String(row.owner_email).trim().toLowerCase() : row.ownerEmail ? String(row.ownerEmail).trim().toLowerCase() : '',
    nextAction: row.next_action ? cleanSlovakText(String(row.next_action)) : row.nextAction ? cleanSlovakText(String(row.nextAction)) : '',
    followupDate: dateOnly(row.followup_date ?? row.followupDate),
    followupNote: row.followup_note ? cleanSlovakText(String(row.followup_note)) : row.followupNote ? cleanSlovakText(String(row.followupNote)) : '',
    followupNotificationSent: Boolean(row.followup_notif_odoslana ?? row.followupNotificationSent),
    deletedAt: row.deleted_at || row.deletedAt ? new Date(String(row.deleted_at ?? row.deletedAt)).toISOString() : undefined,
    rawData: (row.raw_data as Record<string, unknown>) ?? {},
  };
}

function toLeadSummary(row: Record<string, unknown>): LeadSummary {
  return {
    ...toLead(row),
    fileCount: Number(row.file_count ?? 0),
    quoteCount: Number(row.quote_count ?? 0),
  };
}

function toLeadFile(row: Record<string, unknown>): LeadFile {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    originalName: String(row.original_name),
    storageDriver: String(row.storage_driver) as LeadFile['storageDriver'],
    storageKey: String(row.storage_key),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function toAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: String(row.id),
    entityType: String(row.entity_type) as AuditLog['entityType'],
    entityId: String(row.entity_id),
    action: String(row.action),
    actorEmail: String(row.actor_email),
    changes: (row.changes as Record<string, unknown>) ?? {},
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function toQuote(row: Record<string, unknown>): Quote {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    quoteNumber: String(row.quote_number),
    status: String(row.status) as Quote['status'],
    validUntil: dateOnly(row.valid_until),
    areaEstimate: Number(row.area_estimate),
    pricePerM2: Number(row.price_per_m2),
    documentationFee: Number(row.documentation_fee),
    transportFee: Number(row.transport_fee),
    surcharge: Number(row.surcharge),
    discount: Number(row.discount),
    vatRate: Number(row.vat_rate),
    totalWithoutVat: Number(row.total_without_vat),
    totalWithVat: Number(row.total_with_vat),
    note: row.note ? String(row.note) : '',
    createdBy: String(row.created_by),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

async function cleanupLegacyData(db: Pool | PoolClient) {
  await db.query(`
    UPDATE leads SET
      material_type = replace(replace(material_type, 'Vlnit? eternit', 'Vlnitý eternit'), 'Hladk? eternit', 'Hladký eternit'),
      object_type = replace(replace(object_type, 'Rodinn? dom', 'Rodinný dom'), 'Hospod?rska budova', 'Hospodárska budova'),
      roofer = replace(roofer, 'Nem?m strech?ra', 'Nemám strechára'),
      term = replace(term, '?o najsk?r', 'Čo najskôr')
    WHERE material_type LIKE '%?%' OR object_type LIKE '%?%' OR roofer LIKE '%?%' OR term LIKE '%?%'
  `);
  await db.query(`
    UPDATE business_jobs SET
      material_type = replace(replace(material_type, 'Vlnit? eternit', 'Vlnitý eternit'), 'Hladk? eternit', 'Hladký eternit'),
      object_type = replace(replace(object_type, 'Rodinn? dom', 'Rodinný dom'), 'Hospod?rska budova', 'Hospodárska budova'),
      term = replace(term, '?o najsk?r', 'Čo najskôr')
    WHERE material_type LIKE '%?%' OR object_type LIKE '%?%' OR term LIKE '%?%'
  `);
  await db.query(`
    UPDATE price_offers SET
      object_type = replace(replace(object_type, 'Rodinn? dom', 'Rodinný dom'), 'Hospod?rska budova', 'Hospodárska budova'),
      realization_term = replace(realization_term, '?o najsk?r', 'Čo najskôr')
    WHERE object_type LIKE '%?%' OR realization_term LIKE '%?%'
  `);
  await migrateLegacyMetaCapiOutbox(db);
  // Never infer that a lead, job, or offer is disposable from its name/email.
  // Historical records are retained; archival/deletion must be an explicit admin action.
}

async function ensureSchema() {
  if (schemaReady) return;
  if (!runtimeSchemaInitializationAllowed()) {
    schemaReady = true;
    return;
  }
  schemaInitialization ??= initializeSchema().catch((error) => {
    schemaInitialization = undefined;
    throw error;
  });
  await schemaInitialization;
}

export async function migrateLegacyMetaCapiOutbox(db: Pool | PoolClient) {
  const legacyExists = (await db.query("SELECT to_regclass('public.meta_capi_delivery_outbox') AS relation")).rows[0]?.relation;
  if (!legacyExists) return;

  await db.query(`
    UPDATE meta_capi_delivery_outbox
    SET client_ip=NULL, client_user_agent=NULL, fbp=NULL, fbc=NULL, updated_at=now()
    WHERE client_ip IS NOT NULL OR client_user_agent IS NOT NULL OR fbp IS NOT NULL OR fbc IS NOT NULL
  `);
  const legacy = await db.query(`
    SELECT old.*, leads.submission_id, leads.material_type, leads.raw_data, leads.deleted_at
    FROM meta_capi_delivery_outbox old
    INNER JOIN leads ON leads.id=old.event_id
    WHERE old.state IN ('pending','retrying','sending')
    ORDER BY old.created_at, old.event_id
    FOR UPDATE OF old
  `);
  for (const row of legacy.rows) {
    const conversion = row.submission_id && !row.deleted_at
      ? createAcceptedLeadConversion(String(row.submission_id), String(row.material_type ?? row.material ?? ''))
      : null;
    const consentSubject = String(row.consent_subject ?? '');
    const canMigrate = row.state !== 'sending' && conversion && validMetaCapiConsentSubject(consentSubject);
    let migrated = false;
    if (canMigrate && conversion) {
      const rawData = row.raw_data && typeof row.raw_data === 'object' ? { ...row.raw_data } : {};
      rawData.marketingConsentAtSubmit = true;
      rawData.marketingConsentSubjectAtSubmit = consentSubject;
      await db.query('UPDATE leads SET raw_data=$2::jsonb, updated_at=now() WHERE id=$1', [row.event_id, rawData]);
      const sourceUrl = /^https:\/\/likvidacia-eternitu\.sk\/(?:[^\s#]{0,500})$/u.test(String(row.event_source_url ?? ''))
        ? String(row.event_source_url)
        : 'https://likvidacia-eternitu.sk/';
      const inserted = await db.query(
        `INSERT INTO lead_meta_capi_outbox (
          id, lead_id, event_id, consent_subject, event_time, event_source_url, material, status, attempts,
          max_attempts, retryable, next_attempt_at, last_error_code, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,true,$10,'legacy_migrated',$11,$11)
        ON CONFLICT (lead_id) DO NOTHING RETURNING id`,
        [
          randomUUID(), row.event_id, conversion.eventId, consentSubject, row.event_time,
          sourceUrl, conversion.material, Math.max(0, Number(row.attempt_count ?? 0)),
          Math.max(1, Number(row.max_attempts ?? 5), Number(row.attempt_count ?? 0) + 1), new Date().toISOString(), row.created_at,
        ],
      );
      migrated = Boolean(inserted.rowCount);
      if (inserted.rows[0]) {
        await db.query(
          `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
           VALUES ($1,'system',$2,'meta_capi_legacy_migrated','system',$3,now())`,
          [randomUUID(), inserted.rows[0].id, { previousState: row.state, status: 'pending' }],
        );
      }
    }
    const terminalCode = row.state === 'sending'
      ? 'legacy_delivery_unknown_no_retry'
      : migrated ? 'migrated_to_privacy_safe_outbox' : 'legacy_event_superseded';
    await db.query(
      `UPDATE meta_capi_delivery_outbox
       SET state='permanently_failed', lease_token=NULL, lease_expires_at=NULL,
           last_error_code=$2, updated_at=now() WHERE event_id=$1`,
      [row.event_id, terminalCode],
    );
  }
}

async function initializeSchema() {
  const db = getPool();
  if (!db) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required in production.');
    }
    await withLocalLeadSubmissionLock(async () => {
      await readLocalDb();
    });
    schemaReady = true;
    return;
  }

  // Schema writes run on one connection and inside one transaction. The local
  // promise coalesces requests in this process; the advisory lock also guards
  // cold starts in other serverless instances sharing the database.
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS leads (
      id uuid PRIMARY KEY,
      submission_id uuid,
      submission_hash text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'novy',
      full_name text NOT NULL,
      phone text NOT NULL,
      email text NOT NULL,
      city text NOT NULL,
      district text,
      object_type text NOT NULL,
      material_type text NOT NULL,
      area_estimate numeric(12,2) NOT NULL,
      preferovany_kontakt text NOT NULL DEFAULT 'Zavolajte mi',
      roofer text,
      term text,
      note text,
      gdpr boolean NOT NULL DEFAULT true,
      source text NOT NULL DEFAULT 'web',
      wants_roofer_recommendation boolean NOT NULL DEFAULT false,
      selected_roofer_id text NOT NULL DEFAULT '',
      internal_note text NOT NULL DEFAULT '',
      owner_email text NOT NULL DEFAULT '',
      next_action text NOT NULL DEFAULT '',
      followup_date date,
      followup_note text NOT NULL DEFAULT '',
      followup_notif_odoslana boolean NOT NULL DEFAULT false,
      deleted_at timestamptz,
    raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      is_test_data boolean NOT NULL DEFAULT false
    );

    ALTER TABLE leads ADD COLUMN IF NOT EXISTS wants_roofer_recommendation boolean NOT NULL DEFAULT false;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS submission_id uuid;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS submission_hash text;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS selected_roofer_id text NOT NULL DEFAULT '';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferovany_kontakt text NOT NULL DEFAULT 'Zavolajte mi';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_email text NOT NULL DEFAULT '';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action text NOT NULL DEFAULT '';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_date date;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_note text NOT NULL DEFAULT '';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_notif_odoslana boolean NOT NULL DEFAULT false;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS lead_files (
      id uuid PRIMARY KEY,
      lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      original_name text NOT NULL,
      storage_driver text NOT NULL,
      storage_key text NOT NULL,
      mime_type text NOT NULL,
      size_bytes integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS lead_file_deletion_jobs (
      id uuid PRIMARY KEY,
      lead_id uuid NOT NULL,
      file_id uuid NOT NULL,
      storage_driver text NOT NULL CHECK (storage_driver IN ('local', 's3', 'vercel_blob')),
      storage_key text NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deleting', 'failed', 'deleted')),
      attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      claim_id uuid,
      claimed_until timestamptz,
      last_error text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      UNIQUE (storage_driver, storage_key)
    );
    CREATE INDEX IF NOT EXISTS lead_file_deletion_jobs_due_idx ON lead_file_deletion_jobs (status, next_attempt_at, created_at);

    CREATE TABLE IF NOT EXISTS lead_upload_drafts (
      storage_key text PRIMARY KEY,
      submission_id uuid NOT NULL,
      storage_driver text NOT NULL DEFAULT 'vercel_blob',
      file_fingerprint text NOT NULL DEFAULT '',
      blob_etag text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'uploading',
      lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      uploaded_at timestamptz,
      attached_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      deletion_claim_id uuid,
      deletion_claimed_until timestamptz
    );
    ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS storage_driver text NOT NULL DEFAULT 'vercel_blob';
    ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS file_fingerprint text NOT NULL DEFAULT '';
    -- The currently deployed uploader stores these three fields. Keep them
    -- during the staged rollout/rollback window even though the new uploader
    -- no longer consumes them. A fresh deployment of the old schema made all
    -- three NOT NULL without defaults, which would reject new reservations.
    ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS client_file_id uuid;
    ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT '';
    ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS size_bytes integer NOT NULL DEFAULT 0;
    ALTER TABLE lead_upload_drafts ALTER COLUMN client_file_id DROP NOT NULL;
    ALTER TABLE lead_upload_drafts ALTER COLUMN content_type SET DEFAULT '';
    ALTER TABLE lead_upload_drafts ALTER COLUMN size_bytes SET DEFAULT 0;
    ALTER TABLE lead_upload_drafts DROP CONSTRAINT IF EXISTS lead_upload_drafts_size_bytes_check;
    ALTER TABLE lead_upload_drafts ADD CONSTRAINT lead_upload_drafts_size_bytes_check
      CHECK (size_bytes >= 0 AND size_bytes <= 10485760) NOT VALID;
    ALTER TABLE lead_upload_drafts VALIDATE CONSTRAINT lead_upload_drafts_size_bytes_check;
    ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS blob_etag text NOT NULL DEFAULT '';
    ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS deletion_claim_id uuid;
    ALTER TABLE lead_upload_drafts ADD COLUMN IF NOT EXISTS deletion_claimed_until timestamptz;
    ALTER TABLE lead_upload_drafts DROP CONSTRAINT IF EXISTS lead_upload_drafts_status_check;
    ALTER TABLE lead_upload_drafts ADD CONSTRAINT lead_upload_drafts_status_check
      CHECK (status IN ('uploading', 'uploaded', 'attached', 'superseded', 'deleting', 'deleted'));
    CREATE INDEX IF NOT EXISTS lead_upload_drafts_status_created_idx ON lead_upload_drafts (status, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS lead_upload_drafts_client_file_uq
      ON lead_upload_drafts (submission_id, client_file_id) WHERE client_file_id IS NOT NULL;

    -- The previous backend did not inspect upload-draft state when attaching a
    -- lead file. Serialize that attachment with retention claims in the DB so
    -- a mixed-version rollout/rollback cannot attach an object being deleted.
    CREATE OR REPLACE FUNCTION guard_lead_file_against_upload_retention()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE matched_key text;
    BEGIN
      UPDATE lead_upload_drafts
      SET updated_at = now()
      WHERE storage_key = NEW.storage_key AND storage_driver = NEW.storage_driver
        AND status NOT IN ('deleting', 'deleted')
      RETURNING storage_key INTO matched_key;
      IF matched_key IS NULL AND EXISTS (
        SELECT 1 FROM lead_upload_drafts
        WHERE storage_key = NEW.storage_key AND storage_driver = NEW.storage_driver
      ) THEN
        RAISE EXCEPTION 'Príloha sa už bezpečne odstraňuje. Vyberte ju a nahrajte znovu.';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE OR REPLACE TRIGGER lead_files_upload_retention_guard
    BEFORE INSERT OR UPDATE OF storage_driver, storage_key ON lead_files
    FOR EACH ROW EXECUTE FUNCTION guard_lead_file_against_upload_retention();

    CREATE TABLE IF NOT EXISTS lead_blob_reconciliation_state (
      id integer PRIMARY KEY CHECK (id = 1),
      cursor text NOT NULL DEFAULT '',
      claim_id uuid,
      claimed_until timestamptz,
      list_failures integer NOT NULL DEFAULT 0 CHECK (list_failures >= 0),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE lead_blob_reconciliation_state ADD COLUMN IF NOT EXISTS list_failures integer NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
      bucket_key text NOT NULL,
      window_started_at timestamptz NOT NULL,
      hit_count integer NOT NULL DEFAULT 0,
      PRIMARY KEY (bucket_key, window_started_at)
    );
    CREATE INDEX IF NOT EXISTS api_rate_limit_buckets_window_idx ON api_rate_limit_buckets (window_started_at);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY,
      entity_type text NOT NULL,
      entity_id uuid NOT NULL,
      action text NOT NULL,
      actor_email text NOT NULL,
      changes jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS audit_price_offer_number_idx ON audit_logs ((changes->>'number'))
      WHERE entity_type = 'business_job' AND action IN ('price_offer_created', 'price_offer_updated');

    CREATE TABLE IF NOT EXISTS ops_alert_states (
      id uuid NOT NULL UNIQUE,
      worker_key text PRIMARY KEY CHECK (worker_key IN ('lead_email_delivery', 'application_notifications')),
      observed_state text NOT NULL CHECK (observed_state IN ('healthy', 'unhealthy')),
      observed_fingerprint text NOT NULL DEFAULT '',
      last_delivered_state text CHECK (last_delivered_state IS NULL OR last_delivered_state IN ('healthy', 'unhealthy')),
      last_delivered_fingerprint text NOT NULL DEFAULT '',
      last_delivered_at timestamptz,
      claim_id uuid,
      claim_transition text CHECK (claim_transition IS NULL OR claim_transition IN ('degraded', 'repeated', 'recovered')),
      claim_state text CHECK (claim_state IS NULL OR claim_state IN ('healthy', 'unhealthy')),
      claim_fingerprint text NOT NULL DEFAULT '',
      claimed_until timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (
        (claim_id IS NULL AND claim_transition IS NULL AND claim_state IS NULL AND claimed_until IS NULL)
        OR
        (claim_id IS NOT NULL AND claim_transition IS NOT NULL AND claim_state IS NOT NULL AND claimed_until IS NOT NULL)
      )
    );
    CREATE INDEX IF NOT EXISTS ops_alert_states_claim_idx ON ops_alert_states (claimed_until) WHERE claim_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS testimonial_consent_history (
      id uuid PRIMARY KEY,
      history_sequence bigserial NOT NULL UNIQUE,
      testimonial_id uuid NOT NULL,
      event text NOT NULL CHECK (event IN ('superseded', 'granted', 'revoked', 'updated_without_consent')),
      consent_publication boolean NOT NULL,
      consent_evidence text NOT NULL DEFAULT '',
      consent_captured_at timestamptz,
      consent_version text NOT NULL DEFAULT '',
      consent_revoked_at timestamptz,
      snapshot_customer_name text NOT NULL DEFAULT '',
      snapshot_rating integer NOT NULL DEFAULT 0,
      snapshot_text text NOT NULL DEFAULT '',
      public_content_hash text NOT NULL,
      actor_email text NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS testimonial_consent_history_recorded_idx
      ON testimonial_consent_history (testimonial_id, history_sequence DESC);

    ALTER TABLE testimonial_consent_history ADD COLUMN IF NOT EXISTS snapshot_customer_name text NOT NULL DEFAULT '';
    ALTER TABLE testimonial_consent_history ADD COLUMN IF NOT EXISTS snapshot_rating integer NOT NULL DEFAULT 0;
    ALTER TABLE testimonial_consent_history ADD COLUMN IF NOT EXISTS snapshot_text text NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS quotes (
      id uuid PRIMARY KEY,
      lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      quote_number text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'draft',
      valid_until date NOT NULL,
      area_estimate numeric(12,2) NOT NULL,
      price_per_m2 numeric(12,2) NOT NULL,
      documentation_fee numeric(12,2) NOT NULL DEFAULT 0,
      transport_fee numeric(12,2) NOT NULL DEFAULT 0,
      surcharge numeric(12,2) NOT NULL DEFAULT 0,
      discount numeric(12,2) NOT NULL DEFAULT 0,
      vat_rate numeric(5,2) NOT NULL DEFAULT 23,
      total_without_vat numeric(12,2) NOT NULL,
      total_with_vat numeric(12,2) NOT NULL,
      note text,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'draft',
      customer_name text NOT NULL,
      location text,
      rating integer NOT NULL DEFAULT 5,
      text text NOT NULL,
      approved_at timestamptz,
      approved_by text,
      submission_id text
    );

    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS submission_id text;
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS customer_email text;
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS consent_publication boolean NOT NULL DEFAULT false;
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS consent_evidence text NOT NULL DEFAULT '';
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS consent_captured_at timestamptz;
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS consent_version text NOT NULL DEFAULT '';
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS consent_revoked_at timestamptz;
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin';
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS object_type text NOT NULL DEFAULT '';
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS realization_date date;
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS internal_note text NOT NULL DEFAULT '';
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS photo_url text NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS review_requests (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'sent',
      customer_name text NOT NULL,
      phone text NOT NULL,
      location text NOT NULL DEFAULT '',
      object_type text NOT NULL DEFAULT '',
      realization_date date,
      google_review_link text NOT NULL DEFAULT '',
      message text NOT NULL DEFAULT '',
      created_by text NOT NULL DEFAULT '',
      lead_id uuid REFERENCES leads(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS realizations (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz,
      status text NOT NULL DEFAULT 'draft',
      title text NOT NULL,
      location text NOT NULL DEFAULT '',
      material_type text NOT NULL DEFAULT '',
      area_estimate numeric(12,2),
      description text NOT NULL DEFAULT '',
      image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
      featured boolean NOT NULL DEFAULT false,
      created_by text NOT NULL,
      publication_evidence text NOT NULL DEFAULT '',
      publication_approved_by text NOT NULL DEFAULT '',
      publication_approved_at timestamptz
    );
    ALTER TABLE realizations ADD COLUMN IF NOT EXISTS publication_evidence text NOT NULL DEFAULT '';
    ALTER TABLE realizations ADD COLUMN IF NOT EXISTS publication_approved_by text NOT NULL DEFAULT '';
    ALTER TABLE realizations ADD COLUMN IF NOT EXISTS publication_approved_at timestamptz;

    CREATE TABLE IF NOT EXISTS lead_email_outbox (
      id uuid PRIMARY KEY,
      lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      recipient_role text NOT NULL CHECK (recipient_role IN ('customer', 'internal')),
      dedupe_key text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'unknown')),
      attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      retryable boolean NOT NULL DEFAULT false,
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      locked_at timestamptz,
      message_id text NOT NULL DEFAULT '',
      last_error text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      sent_at timestamptz
    );

    ALTER TABLE lead_email_outbox ADD COLUMN IF NOT EXISTS message_id text NOT NULL DEFAULT '';
    ALTER TABLE lead_email_outbox ADD COLUMN IF NOT EXISTS retryable boolean NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS lead_meta_capi_outbox (
      id uuid PRIMARY KEY,
      lead_id uuid NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
      event_id text NOT NULL UNIQUE,
      consent_subject uuid,
      event_time timestamptz NOT NULL,
      event_source_url text NOT NULL,
      material text NOT NULL CHECK (material IN ('vlnity', 'plocha', 'iny', 'neviem')),
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'unknown', 'cancelled')),
      attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      max_attempts integer NOT NULL DEFAULT 6 CHECK (max_attempts > 0),
      retryable boolean NOT NULL DEFAULT true,
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      claim_id uuid,
      claimed_until timestamptz,
      last_http_status integer,
      last_error_code text NOT NULL DEFAULT '',
      consent_revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      sent_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS lead_meta_capi_consent_subjects (
      consent_subject uuid PRIMARY KEY,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE lead_meta_capi_outbox ALTER COLUMN event_id TYPE text USING event_id::text;
    ALTER TABLE lead_meta_capi_outbox ADD COLUMN IF NOT EXISTS consent_subject uuid;
    CREATE INDEX IF NOT EXISTS lead_meta_capi_outbox_due_idx
      ON lead_meta_capi_outbox (next_attempt_at, created_at)
      WHERE status IN ('pending', 'failed', 'unknown', 'sending');
    CREATE INDEX IF NOT EXISTS lead_meta_capi_outbox_consent_subject_idx
      ON lead_meta_capi_outbox (consent_subject)
      WHERE consent_subject IS NOT NULL AND status NOT IN ('sent', 'cancelled');

    -- A short-lived predecessor stored advertising identifiers in its outbox.
    -- If that table exists from a mixed-version environment, neutralize those
    -- values instead of importing them into the privacy-minimal replacement.
    DO $$
    BEGIN
      IF to_regclass('public.meta_capi_delivery_outbox') IS NOT NULL THEN
        EXECUTE 'UPDATE meta_capi_delivery_outbox SET client_ip = NULL, client_user_agent = NULL, fbp = NULL, fbc = NULL';
      END IF;
    END
    $$;

    CREATE TABLE IF NOT EXISTS photo_upload_invites (
      id uuid PRIMARY KEY,
      token_hash char(64) NOT NULL UNIQUE,
      created_by text NOT NULL,
      worker_label text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      consumed_at timestamptz
    );
    ALTER TABLE photo_upload_invites ADD COLUMN IF NOT EXISTS worker_label text NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS realization_media_intake (
      id uuid PRIMARY KEY,
      invite_id uuid NOT NULL REFERENCES photo_upload_invites(id) ON DELETE CASCADE,
      storage_driver text NOT NULL DEFAULT 'vercel_blob',
      storage_key text NOT NULL UNIQUE,
      original_name text NOT NULL,
      mime_type text NOT NULL DEFAULT '',
      size_bytes integer NOT NULL DEFAULT 0,
      content_hash text NOT NULL DEFAULT '',
      sanitized_at timestamptz,
      locality text NOT NULL DEFAULT '',
      categories jsonb NOT NULL DEFAULT '[]'::jsonb,
      metadata_version integer NOT NULL DEFAULT 1,
      status text NOT NULL DEFAULT 'pending_upload',
      deletion_reason text NOT NULL DEFAULT '',
      deletion_attempted_at timestamptz,
      deletion_error text NOT NULL DEFAULT '',
      deletion_attempts integer NOT NULL DEFAULT 0,
      upload_token_issued_at timestamptz,
      sanitization_attempt_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      uploaded_at timestamptz,
      reviewed_at timestamptz,
      reviewed_by text,
      CONSTRAINT realization_media_intake_status_check CHECK (status IN ('pending_upload', 'pending_review', 'approved_private', 'rejected', 'deletion_pending')),
      CONSTRAINT realization_media_intake_size_check CHECK (size_bytes >= 0)
    );
    ALTER TABLE realization_media_intake ADD COLUMN IF NOT EXISTS deletion_reason text NOT NULL DEFAULT '';
    ALTER TABLE realization_media_intake ADD COLUMN IF NOT EXISTS metadata_version integer NOT NULL DEFAULT 1;
    ALTER TABLE realization_media_intake ADD COLUMN IF NOT EXISTS deletion_attempted_at timestamptz;
    ALTER TABLE realization_media_intake ADD COLUMN IF NOT EXISTS deletion_error text NOT NULL DEFAULT '';
    ALTER TABLE realization_media_intake ADD COLUMN IF NOT EXISTS deletion_attempts integer NOT NULL DEFAULT 0;
    ALTER TABLE realization_media_intake ADD COLUMN IF NOT EXISTS upload_token_issued_at timestamptz;
    ALTER TABLE realization_media_intake ADD COLUMN IF NOT EXISTS sanitization_attempt_id uuid;
    ALTER TABLE realization_media_intake ADD COLUMN IF NOT EXISTS content_hash text NOT NULL DEFAULT '';
    ALTER TABLE realization_media_intake ADD COLUMN IF NOT EXISTS sanitized_at timestamptz;
    ALTER TABLE realization_media_intake DROP CONSTRAINT IF EXISTS realization_media_intake_status_check;
    ALTER TABLE realization_media_intake ADD CONSTRAINT realization_media_intake_status_check
      CHECK (status IN ('pending_upload', 'pending_review', 'approved_private', 'rejected', 'deletion_pending'));
    CREATE INDEX IF NOT EXISTS realization_media_intake_retention_idx
      ON realization_media_intake (status, created_at, reviewed_at);

    CREATE TABLE IF NOT EXISTS photo_intake_sanitization_attempts (
      id uuid PRIMARY KEY,
      media_id uuid NOT NULL REFERENCES realization_media_intake(id) ON DELETE CASCADE,
      source_storage_key text NOT NULL,
      target_storage_key text NOT NULL UNIQUE,
      status text NOT NULL CHECK (status IN ('active', 'committed', 'abandoned')),
      cleanup_status text NOT NULL DEFAULT 'pending' CHECK (cleanup_status IN ('pending', 'deleting', 'failed', 'done')),
      cleanup_storage_key text NOT NULL DEFAULT '',
      cleanup_attempted_at timestamptz,
      cleanup_error text NOT NULL DEFAULT '',
      cleanup_attempts integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS photo_intake_sanitization_attempts_due_idx
      ON photo_intake_sanitization_attempts (status, cleanup_status, created_at);

    CREATE TABLE IF NOT EXISTS realization_case_drafts (
      id uuid PRIMARY KEY,
      title text NOT NULL DEFAULT '',
      locality text NOT NULL DEFAULT '',
      locality_precision text NOT NULL DEFAULT 'none' CHECK (locality_precision IN ('none', 'municipality', 'district')),
      object_type text NOT NULL DEFAULT '',
      material_type text NOT NULL DEFAULT '',
      work_description text NOT NULL DEFAULT '',
      result_description text NOT NULL DEFAULT '',
      area_estimate numeric(12,2),
      work_period text NOT NULL DEFAULT '',
      lifecycle text NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'reviewed', 'approved', 'published', 'withdrawn')),
      publication_evidence text NOT NULL DEFAULT '',
      publication_rights_confirmed boolean NOT NULL DEFAULT false,
      publication_location_confirmed boolean NOT NULL DEFAULT false,
      publication_content_confirmed boolean NOT NULL DEFAULT false,
      publication_approved_by text NOT NULL DEFAULT '',
      publication_approved_at timestamptz,
      published_at timestamptz,
      withdrawn_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text NOT NULL DEFAULT '',
      CONSTRAINT realization_case_drafts_publication_approval_check CHECK (
        lifecycle NOT IN ('approved', 'published', 'withdrawn') OR (
          publication_rights_confirmed = true AND publication_location_confirmed = true
          AND publication_content_confirmed = true AND length(btrim(publication_evidence)) >= 4
          AND length(btrim(publication_approved_by)) > 0 AND publication_approved_at IS NOT NULL
        )
      ),
      CONSTRAINT realization_case_drafts_published_at_check CHECK (lifecycle <> 'published' OR published_at IS NOT NULL)
    );
    CREATE TABLE IF NOT EXISTS realization_case_draft_media (
      draft_id uuid NOT NULL REFERENCES realization_case_drafts(id) ON DELETE CASCADE,
      media_id uuid NOT NULL REFERENCES realization_media_intake(id) ON DELETE CASCADE,
      photo_phase text NOT NULL DEFAULT 'during' CHECK (photo_phase IN ('before', 'during', 'after')),
      public_caption text NOT NULL DEFAULT '',
      sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (draft_id, media_id)
    );
    ALTER TABLE realization_case_draft_media ADD COLUMN IF NOT EXISTS photo_phase text NOT NULL DEFAULT 'during';
    ALTER TABLE realization_case_draft_media ADD COLUMN IF NOT EXISTS public_caption text NOT NULL DEFAULT '';
    ALTER TABLE realization_case_draft_media ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
    ALTER TABLE realization_case_draft_media DROP CONSTRAINT IF EXISTS realization_case_draft_media_photo_phase_check;
    ALTER TABLE realization_case_draft_media ADD CONSTRAINT realization_case_draft_media_photo_phase_check
      CHECK (photo_phase IN ('before', 'during', 'after'));
    ALTER TABLE realization_case_draft_media DROP CONSTRAINT IF EXISTS realization_case_draft_media_sort_order_check;
    ALTER TABLE realization_case_draft_media ADD CONSTRAINT realization_case_draft_media_sort_order_check
      CHECK (sort_order BETWEEN 0 AND 999);
    CREATE INDEX IF NOT EXISTS realization_case_drafts_updated_idx ON realization_case_drafts (updated_at DESC);

    CREATE TABLE IF NOT EXISTS roofers (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      name text NOT NULL,
      ico text NOT NULL DEFAULT '',
      contact_person text NOT NULL DEFAULT '',
      phone text NOT NULL DEFAULT '',
      email text NOT NULL DEFAULT '',
      web text NOT NULL DEFAULT '',
      region text NOT NULL DEFAULT '',
      districts jsonb NOT NULL DEFAULT '[]'::jsonb,
      specialization text NOT NULL DEFAULT '',
      public_note text NOT NULL DEFAULT '',
      internal_note text NOT NULL DEFAULT '',
      active boolean NOT NULL DEFAULT true,
      verified_partner boolean NOT NULL DEFAULT false,
      in_verification boolean NOT NULL DEFAULT true,
      preferred_partner boolean NOT NULL DEFAULT false,
      customer_referral_approved boolean NOT NULL DEFAULT false,
      customer_referral_evidence text NOT NULL DEFAULT '',
      customer_referral_approved_at timestamptz,
      customer_referral_approved_by text NOT NULL DEFAULT '',
      rating numeric(3,2) NOT NULL DEFAULT 0,
      review_count integer NOT NULL DEFAULT 0,
      complaints_count integer NOT NULL DEFAULT 0,
      card_view_count integer NOT NULL DEFAULT 0,
      contact_reveal_count integer NOT NULL DEFAULT 0,
      quote_use_click_count integer NOT NULL DEFAULT 0,
      referral_count integer NOT NULL DEFAULT 0,
      recommended_jobs_count integer NOT NULL DEFAULT 0,
      confirmed_jobs_count integer NOT NULL DEFAULT 0,
      failed_jobs_count integer NOT NULL DEFAULT 0,
      internal_score numeric(5,2) NOT NULL DEFAULT 0,
      total_m2 numeric(12,2) NOT NULL DEFAULT 0,
      revenue_without_vat numeric(12,2) NOT NULL DEFAULT 0,
      profit numeric(12,2) NOT NULL DEFAULT 0,
      CONSTRAINT roofers_customer_referral_approval_check CHECK (
        customer_referral_approved = false
        OR (
          length(btrim(customer_referral_evidence)) >= 8
          AND customer_referral_approved_at IS NOT NULL
          AND length(btrim(customer_referral_approved_by)) > 0
        )
      )
    );

    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS in_verification boolean NOT NULL DEFAULT true;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS card_view_count integer NOT NULL DEFAULT 0;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS contact_reveal_count integer NOT NULL DEFAULT 0;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS quote_use_click_count integer NOT NULL DEFAULT 0;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS failed_jobs_count integer NOT NULL DEFAULT 0;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS internal_score numeric(5,2) NOT NULL DEFAULT 0;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS customer_referral_approved boolean NOT NULL DEFAULT false;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS customer_referral_evidence text NOT NULL DEFAULT '';
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS customer_referral_approved_at timestamptz;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS customer_referral_approved_by text NOT NULL DEFAULT '';
    ALTER TABLE roofers DROP CONSTRAINT IF EXISTS roofers_customer_referral_approval_check;
    ALTER TABLE roofers ADD CONSTRAINT roofers_customer_referral_approval_check CHECK (
      customer_referral_approved = false
      OR (
        length(btrim(customer_referral_evidence)) >= 8
        AND customer_referral_approved_at IS NOT NULL
        AND length(btrim(customer_referral_approved_by)) > 0
      )
    ) NOT VALID;
    ALTER TABLE roofers VALIDATE CONSTRAINT roofers_customer_referral_approval_check;

    CREATE TABLE IF NOT EXISTS roofer_registrations (
      id uuid PRIMARY KEY,
      submission_id text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      business_type text NOT NULL DEFAULT 'other',
      company_name text NOT NULL DEFAULT '',
      company_id text NOT NULL DEFAULT '',
      contact_person text NOT NULL DEFAULT '',
      phone text NOT NULL DEFAULT '',
      email text NOT NULL DEFAULT '',
      website text NOT NULL DEFAULT '',
      service_regions jsonb NOT NULL DEFAULT '[]'::jsonb,
      specializations jsonb NOT NULL DEFAULT '[]'::jsonb,
      other_specialization text NOT NULL DEFAULT '',
      can_build_roof_truss text NOT NULL DEFAULT 'by_scope',
      accept_customer_referrals boolean NOT NULL DEFAULT false,
      consent_public_profile boolean NOT NULL DEFAULT false,
      privacy_consent boolean NOT NULL DEFAULT false,
      note text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'new'
    );

    CREATE TABLE IF NOT EXISTS career_applications (
      id uuid PRIMARY KEY,
      submission_id text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'new',
      owner_email text NOT NULL DEFAULT '',
      next_action text NOT NULL DEFAULT '',
      followup_date date,
      full_name text NOT NULL,
      phone text NOT NULL,
      email text NOT NULL,
      city text NOT NULL,
      cooperation_type text NOT NULL DEFAULT 'szco',
      work_regions text NOT NULL DEFAULT '',
      has_trade_license boolean NOT NULL DEFAULT false,
      work_at_heights boolean NOT NULL DEFAULT false,
      has_asbestos_experience boolean NOT NULL DEFAULT false,
      asbestos_experience text NOT NULL DEFAULT '',
      experience text NOT NULL DEFAULT '',
      note text NOT NULL DEFAULT '',
      privacy_consent boolean NOT NULL DEFAULT false,
      cv_original_name text NOT NULL DEFAULT '',
      cv_storage_driver text NOT NULL DEFAULT '',
      cv_storage_key text NOT NULL DEFAULT '',
      cv_mime_type text NOT NULL DEFAULT '',
      cv_size_bytes integer NOT NULL DEFAULT 0,
      cv_sha256 text NOT NULL DEFAULT '',
      cv_expected boolean NOT NULL DEFAULT false
    );
    ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS cv_sha256 text NOT NULL DEFAULT '';
    ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS cv_expected boolean NOT NULL DEFAULT false;
    ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS has_asbestos_experience boolean NOT NULL DEFAULT false;
    ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS asbestos_experience text NOT NULL DEFAULT '';
    ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS owner_email text NOT NULL DEFAULT '';
    ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS next_action text NOT NULL DEFAULT '';
    ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS followup_date date;
    UPDATE career_applications SET status = 'new' WHERE status NOT IN ('new', 'reviewed', 'archived');
    ALTER TABLE career_applications DROP CONSTRAINT IF EXISTS career_applications_status_check;
    ALTER TABLE career_applications ADD CONSTRAINT career_applications_status_check
      CHECK (status IN ('new', 'reviewed', 'archived'));
    CREATE INDEX IF NOT EXISTS career_applications_created_idx ON career_applications (created_at DESC);
    CREATE INDEX IF NOT EXISTS career_applications_workflow_idx ON career_applications (status, followup_date, owner_email, created_at DESC);

    -- A token is issued only after this durable, non-public reservation exists.
    -- Keep reservations when an application is deleted until a retention worker
    -- has safely reconciled the private object; no cascading orphan blobs.
    CREATE TABLE IF NOT EXISTS career_cv_uploads (
      pathname text PRIMARY KEY,
      application_id uuid NOT NULL REFERENCES career_applications(id),
      submission_id text NOT NULL,
      original_name text NOT NULL,
      expected_size integer NOT NULL CHECK (expected_size > 0 AND expected_size <= 5242880),
      expected_sha256 text NOT NULL CHECK (expected_sha256 ~ '^[0-9a-f]{64}$'),
      status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'uploaded', 'attached', 'deleting', 'deletion_pending', 'deleted')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      uploaded_at timestamptz,
      attached_at timestamptz,
      deletion_claim_id uuid,
      deletion_claimed_until timestamptz,
      deletion_attempts integer NOT NULL DEFAULT 0 CHECK (deletion_attempts >= 0),
      deleted_at timestamptz
    );
    ALTER TABLE career_cv_uploads ADD COLUMN IF NOT EXISTS deletion_claim_id uuid;
    ALTER TABLE career_cv_uploads ADD COLUMN IF NOT EXISTS deletion_claimed_until timestamptz;
    ALTER TABLE career_cv_uploads ADD COLUMN IF NOT EXISTS deletion_attempts integer NOT NULL DEFAULT 0;
    ALTER TABLE career_cv_uploads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
    ALTER TABLE career_cv_uploads DROP CONSTRAINT IF EXISTS career_cv_uploads_status_check;
    ALTER TABLE career_cv_uploads ADD CONSTRAINT career_cv_uploads_status_check
      CHECK (status IN ('reserved', 'uploaded', 'attached', 'deleting', 'deletion_pending', 'deleted'));
    CREATE INDEX IF NOT EXISTS career_cv_uploads_application_status_idx
      ON career_cv_uploads (application_id, status, created_at);
    CREATE INDEX IF NOT EXISTS career_cv_uploads_retention_due_idx
      ON career_cv_uploads (status, created_at, deletion_claimed_until);

    -- A mixed-version server may still use the older CV attach helper. Its
    -- application-row UPDATE must not attach a Blob already claimed for deletion.
    CREATE OR REPLACE FUNCTION guard_career_cv_against_retention()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.cv_storage_key <> '' AND EXISTS (
        SELECT 1 FROM career_cv_uploads
        WHERE pathname = NEW.cv_storage_key AND application_id = NEW.id
          AND status IN ('deleting', 'deletion_pending', 'deleted')
      ) THEN
        RAISE EXCEPTION 'Životopis sa už bezpečne odstraňuje. Nahrajte ho znova.';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE OR REPLACE TRIGGER career_cv_retention_guard
    BEFORE UPDATE OF cv_storage_key ON career_applications
    FOR EACH ROW EXECUTE FUNCTION guard_career_cv_against_retention();

    CREATE TABLE IF NOT EXISTS application_notification_outbox (
      id uuid PRIMARY KEY,
      entity_type text NOT NULL CHECK (entity_type IN ('career_application', 'roofer_registration')),
      entity_id uuid NOT NULL,
      recipient_role text NOT NULL CHECK (recipient_role IN ('applicant', 'internal')),
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'unknown')),
      attempts integer NOT NULL DEFAULT 0,
      retryable boolean NOT NULL DEFAULT false,
      attempt_token uuid,
      claimed_at timestamptz,
      attempted_at timestamptz,
      sent_at timestamptz,
      message_id text NOT NULL DEFAULT '',
      last_error text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (entity_type, entity_id, recipient_role)
    );
    ALTER TABLE application_notification_outbox
      DROP CONSTRAINT IF EXISTS application_notification_outbox_status_check;
    ALTER TABLE application_notification_outbox
      ADD CONSTRAINT application_notification_outbox_status_check
      CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'unknown', 'confirmed_delivered', 'confirmed_not_delivered'));
    CREATE INDEX IF NOT EXISTS application_notification_retry_idx
      ON application_notification_outbox (updated_at, entity_type, entity_id)
      WHERE status = 'failed' AND retryable = true;
    CREATE INDEX IF NOT EXISTS application_notification_pending_idx
      ON application_notification_outbox (updated_at, entity_type, entity_id)
      WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS application_notification_entity_idx
      ON application_notification_outbox (entity_type, entity_id, recipient_role);

    CREATE TABLE IF NOT EXISTS roofer_events (
      id uuid PRIMARY KEY,
      roofer_id uuid NOT NULL REFERENCES roofers(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      region text NOT NULL DEFAULT '',
      page text NOT NULL DEFAULT '',
      referrer text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS site_content (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id uuid PRIMARY KEY,
      email text NOT NULL UNIQUE,
      name text NOT NULL DEFAULT '',
      role text NOT NULL DEFAULT 'OPERATOR',
      active boolean NOT NULL DEFAULT true,
      password_hash text NOT NULL DEFAULT '',
      two_factor_secret text NOT NULL DEFAULT '',
      two_factor_enabled boolean NOT NULL DEFAULT false,
      two_factor_last_used_step bigint NOT NULL DEFAULT -1,
      two_factor_backup_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
      session_epoch bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_secret text NOT NULL DEFAULT '';
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_last_used_step bigint NOT NULL DEFAULT -1;
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_backup_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS session_epoch bigint NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS analytics_events (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      session_id text NOT NULL,
      event_type text NOT NULL,
      path text NOT NULL DEFAULT '',
      referrer text NOT NULL DEFAULT '',
      device text NOT NULL DEFAULT '',
      viewport_width integer,
      utm_source text NOT NULL DEFAULT '',
      utm_medium text NOT NULL DEFAULT '',
      utm_campaign text NOT NULL DEFAULT '',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS workers (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      rate_per_m2 numeric(12,2) NOT NULL DEFAULT 0,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS landfill_prices (
      id uuid PRIMARY KEY,
      year integer NOT NULL,
      landfill text NOT NULL,
      price_per_ton numeric(12,2) NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(year, landfill)
    );

    CREATE TABLE IF NOT EXISTS business_jobs (
      id uuid PRIMARY KEY,
      lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      demolition_date date NOT NULL,
      customer_name text NOT NULL,
      customer_phone text NOT NULL DEFAULT '',
      customer_email text NOT NULL DEFAULT '',
      location text NOT NULL DEFAULT '',
      district text NOT NULL DEFAULT '',
      material_type text NOT NULL DEFAULT '',
      object_type text NOT NULL DEFAULT '',
      term text NOT NULL DEFAULT '',
      lead_source text NOT NULL DEFAULT '',
      preferovany_kontakt text NOT NULL DEFAULT '',
      m2 numeric(12,2) NOT NULL DEFAULT 0,
      price_per_m2 numeric(12,2) NOT NULL DEFAULT 0,
      total_price numeric(12,2) NOT NULL DEFAULT 0,
      payment_type text NOT NULL DEFAULT 'FAKTURA',
      work_type text NOT NULL DEFAULT 'DEMONTAZ_A_ODVOZ',
      waste_kg numeric(12,2) NOT NULL DEFAULT 0,
      landfill text NOT NULL DEFAULT 'INA',
      status text NOT NULL DEFAULT 'DOPYT',
      note text NOT NULL DEFAULT '',
      is_test_data boolean NOT NULL DEFAULT false
    );
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS customer_phone text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS customer_email text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS material_type text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS object_type text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS term text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS lead_source text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS preferovany_kontakt text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS offer_confirmed_date date;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS ruvz_submitted_date date;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS ouzp_submitted_date date;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS ruvz_approved_date date;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS ouzp_approved_date date;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS demolition_finished_date date;

    -- Internal financial evidence only. Existing jobs are intentionally not backfilled:
    -- a quoted value, job status or preferred payment type is not proof of an invoice or payment.
    CREATE TABLE IF NOT EXISTS business_job_invoices (
      id uuid PRIMARY KEY,
      job_id uuid NOT NULL REFERENCES business_jobs(id) ON DELETE RESTRICT,
      operation_id uuid NOT NULL UNIQUE,
      request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
      invoice_number text NOT NULL,
      issued_on date NOT NULL,
      due_on date,
      amount_without_vat_cents bigint NOT NULL CHECK (amount_without_vat_cents > 0 AND amount_without_vat_cents <= 200000000),
      vat_rate_basis_points integer NOT NULL CHECK (vat_rate_basis_points >= 0 AND vat_rate_basis_points <= 10000),
      amount_with_vat_cents bigint NOT NULL CHECK (amount_with_vat_cents > 0 AND amount_with_vat_cents <= 200000000),
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by text NOT NULL,
      cancelled_on date,
      cancelled_at timestamptz,
      cancelled_by text,
      cancel_reason_code text,
      cancel_operation_id uuid UNIQUE,
      cancel_request_hash char(64) CHECK (cancel_request_hash IS NULL OR cancel_request_hash ~ '^[0-9a-f]{64}$'),
      UNIQUE (id, job_id),
      CHECK (due_on IS NULL OR due_on >= issued_on),
      CHECK (
        (cancelled_on IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancel_reason_code IS NULL
          AND cancel_operation_id IS NULL AND cancel_request_hash IS NULL)
        OR
        (cancelled_on IS NOT NULL AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancel_reason_code IS NOT NULL
          AND cancel_operation_id IS NOT NULL AND cancel_request_hash IS NOT NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS business_job_payment_events (
      id uuid PRIMARY KEY,
      job_id uuid NOT NULL REFERENCES business_jobs(id) ON DELETE RESTRICT,
      invoice_id uuid,
      operation_id uuid NOT NULL UNIQUE,
      request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
      event_type text NOT NULL CHECK (event_type IN ('RECEIPT', 'REVERSAL')),
      occurred_on date NOT NULL,
      amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 200000000),
      method text NOT NULL CHECK (method IN ('BANK_TRANSFER', 'CASH', 'CARD', 'OTHER')),
      reference text NOT NULL DEFAULT '',
      reversal_of uuid REFERENCES business_job_payment_events(id) ON DELETE RESTRICT,
      reason_code text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by text NOT NULL,
      FOREIGN KEY (invoice_id, job_id) REFERENCES business_job_invoices(id, job_id) ON DELETE RESTRICT,
      CHECK (
        (event_type = 'RECEIPT' AND reversal_of IS NULL AND reason_code = '')
        OR
        (event_type = 'REVERSAL' AND reversal_of IS NOT NULL AND reason_code <> '')
      )
    );

    -- New crew photo invitations are tied to an already completed CRM job.
    -- Older invitations remain readable with a NULL assignment.
    ALTER TABLE photo_upload_invites ADD COLUMN IF NOT EXISTS business_job_id uuid REFERENCES business_jobs(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS photo_upload_invites_business_job_idx ON photo_upload_invites (business_job_id);
    -- Keep a private case draft bound to the CRM job whose crew supplied its photos.
    ALTER TABLE realization_case_drafts ADD COLUMN IF NOT EXISTS business_job_id uuid REFERENCES business_jobs(id) ON DELETE SET NULL;
    ALTER TABLE realization_case_drafts ADD COLUMN IF NOT EXISTS publication_evidence text NOT NULL DEFAULT '';
    ALTER TABLE realization_case_drafts ADD COLUMN IF NOT EXISTS publication_rights_confirmed boolean NOT NULL DEFAULT false;
    ALTER TABLE realization_case_drafts ADD COLUMN IF NOT EXISTS publication_location_confirmed boolean NOT NULL DEFAULT false;
    ALTER TABLE realization_case_drafts ADD COLUMN IF NOT EXISTS publication_content_confirmed boolean NOT NULL DEFAULT false;
    ALTER TABLE realization_case_drafts ADD COLUMN IF NOT EXISTS publication_approved_by text NOT NULL DEFAULT '';
    ALTER TABLE realization_case_drafts ADD COLUMN IF NOT EXISTS publication_approved_at timestamptz;
    ALTER TABLE realization_case_drafts ADD COLUMN IF NOT EXISTS published_at timestamptz;
    ALTER TABLE realization_case_drafts ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;
    ALTER TABLE realization_case_drafts DROP CONSTRAINT IF EXISTS realization_case_drafts_lifecycle_check;
    ALTER TABLE realization_case_drafts ADD CONSTRAINT realization_case_drafts_lifecycle_check
      CHECK (lifecycle IN ('draft', 'reviewed', 'approved', 'published', 'withdrawn'));
    ALTER TABLE realization_case_drafts DROP CONSTRAINT IF EXISTS realization_case_drafts_publication_approval_check;
    ALTER TABLE realization_case_drafts ADD CONSTRAINT realization_case_drafts_publication_approval_check CHECK (
      lifecycle NOT IN ('approved', 'published', 'withdrawn') OR (
        publication_rights_confirmed = true AND publication_location_confirmed = true
        AND publication_content_confirmed = true AND length(btrim(publication_evidence)) >= 4
        AND length(btrim(publication_approved_by)) > 0 AND publication_approved_at IS NOT NULL
      )
    );
    ALTER TABLE realization_case_drafts DROP CONSTRAINT IF EXISTS realization_case_drafts_published_at_check;
    ALTER TABLE realization_case_drafts ADD CONSTRAINT realization_case_drafts_published_at_check
      CHECK (lifecycle <> 'published' OR published_at IS NOT NULL);
    CREATE INDEX IF NOT EXISTS realization_case_drafts_business_job_idx ON realization_case_drafts (business_job_id);

    CREATE TABLE IF NOT EXISTS price_offers (
      id uuid PRIMARY KEY,
      number text NOT NULL UNIQUE,
      job_id uuid REFERENCES business_jobs(id) ON DELETE SET NULL,
      lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      valid_until date NOT NULL,
      object_type text NOT NULL DEFAULT '',
      object_address text NOT NULL DEFAULT '',
      municipality text NOT NULL DEFAULT '',
      district text NOT NULL DEFAULT '',
      contact_person text NOT NULL DEFAULT '',
      phone text NOT NULL DEFAULT '',
      email text NOT NULL DEFAULT '',
      realization_term text NOT NULL DEFAULT '',
      material_type text NOT NULL DEFAULT 'VLNITY_ETERNIT',
      area_m2 numeric(12,2) NOT NULL DEFAULT 0,
      price_per_m2_without_vat numeric(12,2) NOT NULL DEFAULT 0,
      documentation_fee_without_vat numeric(12,2) NOT NULL DEFAULT 161,
      include_documentation boolean NOT NULL DEFAULT true,
      documentation_promotion boolean NOT NULL DEFAULT false,
      include_transport boolean NOT NULL DEFAULT false,
      transport_from text NOT NULL DEFAULT '',
      transport_to text NOT NULL DEFAULT '',
      transport_round_trip_km numeric(12,2) NOT NULL DEFAULT 0,
      transport_price_per_km numeric(12,2) NOT NULL DEFAULT 0.70,
      material_price_without_vat numeric(12,2) NOT NULL DEFAULT 0,
      total_without_vat numeric(12,2) NOT NULL DEFAULT 0,
      total_with_vat numeric(12,2) NOT NULL DEFAULT 0,
      offer_note text NOT NULL DEFAULT '',
      internal_note text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'PRIPRAVENA',
      send_started_at timestamptz,
      send_attempt_id text,
      sent_at timestamptz,
      accepted_at timestamptz,
      source_inquiry text NOT NULL DEFAULT '',
      source_job_ids uuid[] NOT NULL DEFAULT '{}',
      is_test_data boolean NOT NULL DEFAULT false,
      vat_rate numeric(5,2) NOT NULL DEFAULT 23
    );
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS source_job_ids uuid[] NOT NULL DEFAULT '{}';
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS send_started_at timestamptz;
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS send_attempt_id text;
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS documentation_promotion boolean NOT NULL DEFAULT false;
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS include_transport boolean NOT NULL DEFAULT false;
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS transport_from text NOT NULL DEFAULT '';
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS transport_to text NOT NULL DEFAULT '';
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS transport_round_trip_km numeric(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS transport_price_per_km numeric(12,2) NOT NULL DEFAULT 0.70;
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2);
    UPDATE price_offers SET vat_rate = CASE
      WHEN total_without_vat > 0 AND total_with_vat >= total_without_vat
        AND ((total_with_vat / total_without_vat - 1) * 100) BETWEEN 0 AND 100
        THEN round(((total_with_vat / total_without_vat - 1) * 100)::numeric, 2)
      ELSE 23
    END WHERE vat_rate IS NULL;
    ALTER TABLE price_offers ALTER COLUMN vat_rate SET DEFAULT 23;
    ALTER TABLE price_offers ALTER COLUMN vat_rate SET NOT NULL;
    UPDATE price_offers o SET source_job_ids = ARRAY(
      SELECT DISTINCT source_id FROM (
        SELECT unnest(o.source_job_ids) AS source_id
        UNION SELECT o.job_id WHERE o.job_id IS NOT NULL
        UNION SELECT a.entity_id FROM audit_logs a JOIN business_jobs j ON j.id = a.entity_id
          WHERE a.entity_type = 'business_job' AND a.action IN ('price_offer_created', 'price_offer_updated')
            AND a.changes->>'number' = o.number
      ) source_links
    ) WHERE (o.job_id IS NOT NULL AND NOT (o.job_id = ANY(o.source_job_ids)))
      OR EXISTS (
        SELECT 1 FROM audit_logs a JOIN business_jobs j ON j.id = a.entity_id
        WHERE a.entity_type = 'business_job' AND a.action IN ('price_offer_created', 'price_offer_updated')
          AND a.changes->>'number' = o.number AND NOT (a.entity_id = ANY(o.source_job_ids))
      );
    UPDATE price_offers o SET lead_id = j.lead_id FROM business_jobs j
      WHERE o.lead_id IS NULL AND o.job_id = j.id AND j.lead_id IS NOT NULL;
    UPDATE price_offers o SET lead_id = l.id FROM leads l
      WHERE o.lead_id IS NULL AND o.source_inquiry = 'dopyt:' || l.id::text;

    CREATE TABLE IF NOT EXISTS business_job_workers (
      id uuid PRIMARY KEY,
      job_id uuid NOT NULL REFERENCES business_jobs(id) ON DELETE CASCADE,
      worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
      worker_name text NOT NULL DEFAULT '',
      m2_share numeric(12,2) NOT NULL DEFAULT 0,
      rate numeric(12,2) NOT NULL DEFAULT 0,
      reward numeric(12,2) NOT NULL DEFAULT 0,
      manually_edited boolean NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS business_job_costs (
      job_id uuid PRIMARY KEY REFERENCES business_jobs(id) ON DELETE CASCADE,
      fuel numeric(12,2) NOT NULL DEFAULT 0,
      suits numeric(12,2) NOT NULL DEFAULT 0,
      gloves numeric(12,2) NOT NULL DEFAULT 0,
      penetrant numeric(12,2) NOT NULL DEFAULT 0,
      landfill_cost numeric(12,2) NOT NULL DEFAULT 0,
      other_name text NOT NULL DEFAULT '',
      other_amount numeric(12,2) NOT NULL DEFAULT 0,
      total numeric(12,2) NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS planner_actions (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      datum date NOT NULL,
      cas_od text NOT NULL DEFAULT '',
      cas_do text NOT NULL DEFAULT '',
      typ text NOT NULL DEFAULT 'INE',
      adresa text NOT NULL DEFAULT '',
      zakazka_id uuid REFERENCES business_jobs(id) ON DELETE SET NULL,
      pracovnici text NOT NULL DEFAULT '',
      zakaznik_meno text NOT NULL DEFAULT '',
      zakaznik_email text NOT NULL DEFAULT '',
      zakaznik_telefon text NOT NULL DEFAULT '',
      poznamka text NOT NULL DEFAULT '',
      stav text NOT NULL DEFAULT 'NAPLANOVANA',
      notif_2dni boolean NOT NULL DEFAULT false,
      notif_1den boolean NOT NULL DEFAULT false,
      notif_zakaznik boolean NOT NULL DEFAULT false,
      notif_2dni_odoslana boolean NOT NULL DEFAULT false,
      notif_1den_odoslana boolean NOT NULL DEFAULT false,
      notif_zakaznik_odoslana boolean NOT NULL DEFAULT false
    );

    CREATE INDEX IF NOT EXISTS leads_status_created_at_idx ON leads (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS leads_owner_followup_idx ON leads (owner_email, followup_date, created_at DESC);
    CREATE INDEX IF NOT EXISTS lead_files_lead_id_idx ON lead_files (lead_id);
    CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_uq ON leads (submission_id);
    CREATE UNIQUE INDEX IF NOT EXISTS business_jobs_lead_id_uq ON business_jobs (lead_id);
    CREATE UNIQUE INDEX IF NOT EXISTS lead_email_outbox_lead_role_uq ON lead_email_outbox (lead_id, recipient_role);
    CREATE INDEX IF NOT EXISTS lead_email_outbox_pending_idx ON lead_email_outbox (status, next_attempt_at) WHERE status IN ('pending', 'failed');
    CREATE INDEX IF NOT EXISTS lead_email_outbox_retryable_idx ON lead_email_outbox (next_attempt_at, lead_id) WHERE status = 'failed' AND retryable = true;
    CREATE INDEX IF NOT EXISTS audit_logs_entity_created_at_idx ON audit_logs (entity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_logs_action_created_at_idx ON audit_logs (action, created_at DESC);
    CREATE INDEX IF NOT EXISTS quotes_lead_id_idx ON quotes (lead_id);
    CREATE INDEX IF NOT EXISTS testimonials_status_created_at_idx ON testimonials (status, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS testimonials_submission_id_unique_idx ON testimonials (submission_id) WHERE submission_id IS NOT NULL AND submission_id <> '';
    CREATE INDEX IF NOT EXISTS review_requests_status_created_at_idx ON review_requests (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS realizations_status_created_at_idx ON realizations (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS photo_upload_invites_expiry_idx ON photo_upload_invites (expires_at, revoked_at);
    CREATE INDEX IF NOT EXISTS realization_media_intake_invite_idx ON realization_media_intake (invite_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS realization_media_intake_status_idx ON realization_media_intake (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS roofers_active_region_idx ON roofers (active, region, updated_at DESC);
    CREATE INDEX IF NOT EXISTS roofer_events_roofer_created_idx ON roofer_events (roofer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS roofer_registrations_status_created_idx ON roofer_registrations (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS analytics_events_created_type_idx ON analytics_events (created_at DESC, event_type);
    CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON analytics_events (session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS business_jobs_date_status_idx ON business_jobs (demolition_date DESC, status);
    CREATE UNIQUE INDEX IF NOT EXISTS business_job_invoices_number_uq
      ON business_job_invoices (lower(btrim(invoice_number)));
    CREATE INDEX IF NOT EXISTS business_job_invoices_job_issued_idx
      ON business_job_invoices (job_id, issued_on DESC);
    CREATE INDEX IF NOT EXISTS business_job_invoices_due_idx
      ON business_job_invoices (due_on) WHERE cancelled_at IS NULL AND due_on IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS business_job_payment_events_reversal_uq
      ON business_job_payment_events (reversal_of) WHERE event_type = 'REVERSAL';
    CREATE INDEX IF NOT EXISTS business_job_payment_events_job_occurred_idx
      ON business_job_payment_events (job_id, occurred_on DESC);
    CREATE INDEX IF NOT EXISTS business_job_payment_events_invoice_idx
      ON business_job_payment_events (invoice_id, occurred_on DESC) WHERE invoice_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS business_job_workers_worker_idx ON business_job_workers (worker_id);
    CREATE INDEX IF NOT EXISTS price_offers_created_status_idx ON price_offers (created_at DESC, status);
    CREATE INDEX IF NOT EXISTS price_offers_job_idx ON price_offers (job_id);
    CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (lower(email));
    CREATE INDEX IF NOT EXISTS planner_actions_date_idx ON planner_actions (datum, stav);
  `;
  // DDL edits change this signature automatically. Bump the data version when
  // changing cleanupLegacyData without changing DDL.
  const schemaSignature = createHash('sha256')
    .update('astana-schema-data-v2\n')
    .update(schemaSql)
    .digest('hex');
  const client = await db.connect();
  try {
    if (isVerifiedLocalBuildHarness()) {
      const expectedToken = process.env.ASTANA_ISOLATED_PG_RUN_TOKEN?.trim().toLowerCase() ?? '';
      const marker = await client.query(
        'SELECT run_token FROM astana_isolated_runner_guard WHERE run_token = $1 LIMIT 1',
        [expectedToken],
      );
      const actualToken = typeof marker.rows[0]?.run_token === 'string' ? marker.rows[0].run_token.trim().toLowerCase() : '';
      if (marker.rowCount !== 1 || actualToken.length !== expectedToken.length
        || !timingSafeEqual(Buffer.from(actualToken), Buffer.from(expectedToken))) {
        throw new Error('Isolated build database marker does not match the owned test run.');
      }
    }
    if (isVerifiedIsolatedStaging()) {
      const marker = await client.query(
        "SELECT marker FROM astana_environment_guard WHERE environment = 'staging' LIMIT 1",
      );
      if (marker.rowCount !== 1 || !stagingDatabaseMarkerMatches(marker.rows[0]?.marker)) {
        throw new Error('Staging database identity marker does not match the configured isolated environment.');
      }
    }
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [1377690931, 1]);
    const workersTableExisted = (await client.query("SELECT to_regclass('workers') AS relation")).rows[0]?.relation !== null;
    await client.query(`
      CREATE TABLE IF NOT EXISTS astana_schema_revisions (
        signature text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const applied = await client.query('SELECT 1 FROM astana_schema_revisions WHERE signature = $1', [schemaSignature]);
    if (applied.rowCount === 0) {
      await client.query(schemaSql);
      await cleanupLegacyData(client);
      await client.query('INSERT INTO astana_schema_revisions (signature) VALUES ($1)', [schemaSignature]);
    }
    // Existing workers may have been renamed or intentionally removed; seed
    // defaults only when this transaction created the workers table.
    if (!workersTableExisted) await seedDefaultWorkers(client);
    await seedDefaultAdminUser(client);
    await client.query('COMMIT');
    schemaReady = true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function toPriceOffer(row: Record<string, unknown>): PriceOffer {
  const sourceJobIds = row.source_job_ids ?? row.sourceJobIds;
  return {
    id: String(row.id),
    leadId: row.lead_id || row.leadId ? String(row.lead_id ?? row.leadId) : undefined,
    sourceJobIds: Array.isArray(sourceJobIds) ? sourceJobIds.map(String) : [],
    isTestData: Boolean(row.is_test_data ?? row.isTestData ?? false),
    number: String(row.number ?? row.cislo ?? ''),
    jobId: row.job_id || row.jobId ? String(row.job_id ?? row.jobId) : '',
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
    deletedAt: row.deleted_at || row.deletedAt ? new Date(String(row.deleted_at ?? row.deletedAt)).toISOString() : undefined,
    validUntil: dateOnly(row.valid_until ?? row.validUntil),
    objectType: String(row.object_type ?? row.objectType ?? ''),
    objectAddress: String(row.object_address ?? row.objectAddress ?? ''),
    municipality: String(row.municipality ?? ''),
    district: String(row.district ?? ''),
    contactPerson: String(row.contact_person ?? row.contactPerson ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    realizationTerm: String(row.realization_term ?? row.realizationTerm ?? ''),
    materialType: String(row.material_type ?? row.materialType ?? 'VLNITY_ETERNIT') as PriceOfferMaterialType,
    areaM2: Number(row.area_m2 ?? row.areaM2 ?? 0),
    pricePerM2WithoutVat: Number(row.price_per_m2_without_vat ?? row.pricePerM2WithoutVat ?? 0),
    documentationFeeWithoutVat: Number(row.documentation_fee_without_vat ?? row.documentationFeeWithoutVat ?? 0),
    includeDocumentation: Boolean(row.include_documentation ?? row.includeDocumentation ?? true),
    documentationPromotion: Boolean(row.documentation_promotion ?? row.documentationPromotion ?? false),
    includeTransport: Boolean(row.include_transport ?? row.includeTransport ?? false),
    transportFrom: String(row.transport_from ?? row.transportFrom ?? ''),
    transportTo: String(row.transport_to ?? row.transportTo ?? ''),
    transportRoundTripKm: Number(row.transport_round_trip_km ?? row.transportRoundTripKm ?? 0),
    transportPricePerKm: Number(row.transport_price_per_km ?? row.transportPricePerKm ?? 0.7),
    vatRate: resolvePriceOfferVatRate({
      vatRate: row.vat_rate === undefined ? row.vatRate as number | string | null | undefined : row.vat_rate as number | string | null,
      totalWithoutVat: Number(row.total_without_vat ?? row.totalWithoutVat ?? 0),
      totalWithVat: Number(row.total_with_vat ?? row.totalWithVat ?? 0),
    }, 23),
    materialPriceWithoutVat: Number(row.material_price_without_vat ?? row.materialPriceWithoutVat ?? 0),
    totalWithoutVat: Number(row.total_without_vat ?? row.totalWithoutVat ?? 0),
    totalWithVat: Number(row.total_with_vat ?? row.totalWithVat ?? 0),
    offerNote: String(row.offer_note ?? row.offerNote ?? ''),
    internalNote: String(row.internal_note ?? row.internalNote ?? ''),
    status: String(row.status ?? 'PRIPRAVENA') as PriceOfferStatus,
    sendStartedAt: row.send_started_at || row.sendStartedAt ? new Date(String(row.send_started_at ?? row.sendStartedAt)).toISOString() : undefined,
    sendAttemptId: String(row.send_attempt_id ?? row.sendAttemptId ?? '') || undefined,
    sentAt: row.sent_at || row.sentAt ? new Date(String(row.sent_at ?? row.sentAt)).toISOString() : undefined,
    acceptedAt: row.accepted_at || row.acceptedAt ? new Date(String(row.accepted_at ?? row.acceptedAt)).toISOString() : undefined,
    sourceInquiry: String(row.source_inquiry ?? row.sourceInquiry ?? ''),
  };
}

function normalizeLocalMetaCapiOutbox(rows: unknown[]): MetaCapiOutboxRecord[] {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const metaEventId = /^lead:[a-f0-9]{64}$/;
  const statuses = new Set<MetaCapiOutboxStatus>(['pending', 'sending', 'sent', 'failed', 'unknown', 'cancelled']);
  const materials = new Set<MetaCapiOutboxClaim['material']>(['vlnity', 'plocha', 'iny', 'neviem']);
  const safeIso = (value: unknown, fallback: string) => {
    const timestamp = Date.parse(String(value ?? ''));
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
  };
  return rows.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    const leadId = String(row.leadId ?? row.lead_id ?? '');
    const eventId = String(row.eventId ?? row.event_id ?? '');
    const legacy = typeof row.id !== 'string' || typeof row.status !== 'string' || !metaEventId.test(eventId);
    const consentSubject = String(row.consentSubject ?? row.consent_subject ?? '');
    const id = String(row.id ?? eventId);
    if (!uuid.test(id) || !uuid.test(leadId) || (!metaEventId.test(eventId) && !uuid.test(eventId))) return [];
    const requestedStatus = String(row.status ?? row.state ?? 'cancelled') as MetaCapiOutboxStatus;
    const status: MetaCapiOutboxStatus = legacy || !uuid.test(consentSubject)
      ? (requestedStatus === 'sent' ? 'sent' : 'cancelled')
      : (statuses.has(requestedStatus) ? requestedStatus : 'cancelled');
    const createdAt = safeIso(row.createdAt ?? row.created_at, new Date(0).toISOString());
    const updatedAt = safeIso(row.updatedAt ?? row.updated_at, createdAt);
    const eventTime = safeIso(row.eventTime ?? row.event_time, createdAt);
    const material = String(row.material ?? 'iny') as MetaCapiOutboxClaim['material'];
    return [{
      id,
      leadId,
      eventId,
      consentSubject: uuid.test(consentSubject) ? consentSubject : undefined,
      eventTime,
      eventSourceUrl: /^https:\/\/likvidacia-eternitu\.sk\//.test(String(row.eventSourceUrl ?? row.event_source_url ?? ''))
        ? String(row.eventSourceUrl ?? row.event_source_url)
        : 'https://likvidacia-eternitu.sk/',
      material: materials.has(material) ? material : 'iny',
      status,
      attempts: Math.max(0, Number(row.attempts ?? row.attempt_count ?? 0) || 0),
      maxAttempts: Math.max(1, Number(row.maxAttempts ?? row.max_attempts ?? 6) || 6),
      retryable: !legacy && Boolean(row.retryable) && !['sent', 'cancelled'].includes(status),
      nextAttemptAt: safeIso(row.nextAttemptAt ?? row.next_attempt_at, createdAt),
      claimId: !legacy && uuid.test(String(row.claimId ?? row.claim_id ?? '')) ? String(row.claimId ?? row.claim_id) : undefined,
      claimedUntil: !legacy && (row.claimedUntil || row.claimed_until) ? safeIso(row.claimedUntil ?? row.claimed_until, createdAt) : undefined,
      lastHttpStatus: Number.isInteger(Number(row.lastHttpStatus ?? row.last_http_status)) ? Number(row.lastHttpStatus ?? row.last_http_status) : undefined,
      lastErrorCode: legacy ? 'legacy_record_neutralized' : String(row.lastErrorCode ?? row.last_error_code ?? '').slice(0, 80),
      consentRevokedAt: row.consentRevokedAt || row.consent_revoked_at ? safeIso(row.consentRevokedAt ?? row.consent_revoked_at, createdAt) : undefined,
      createdAt,
      updatedAt,
      sentAt: row.sentAt || row.sent_at ? safeIso(row.sentAt ?? row.sent_at, createdAt) : undefined,
    }];
  });
}

function normalizeLocalDb(data: Partial<LocalDb>): LocalDb {
  const existingJobIds = new Set((data.businessJobs ?? []).map((job) => job.id));
  const auditedJobsByOfferNumber = new Map<string, Set<string>>();
  for (const audit of data.auditLogs ?? []) {
    if (audit.entityType !== 'business_job' || !['price_offer_created', 'price_offer_updated'].includes(audit.action)
      || !existingJobIds.has(audit.entityId)) continue;
    const number = typeof audit.changes?.number === 'string' ? audit.changes.number : '';
    if (!number) continue;
    const ids = auditedJobsByOfferNumber.get(number) ?? new Set<string>();
    ids.add(audit.entityId);
    auditedJobsByOfferNumber.set(number, ids);
  }
  return {
    leads: data.leads ?? [],
    leadFiles: data.leadFiles ?? [],
    leadFileDeletionJobs: data.leadFileDeletionJobs ?? [],
    leadEmailOutbox: data.leadEmailOutbox ?? [],
    metaCapiOutbox: normalizeLocalMetaCapiOutbox(data.metaCapiOutbox ?? []),
    metaCapiConsentRevocations: (data.metaCapiConsentRevocations ?? []).filter((item) => (
      validMetaCapiConsentSubject(item.consentSubject) && Boolean(item.revokedAt)
    )),
    auditLogs: data.auditLogs ?? [],
    quotes: data.quotes ?? [],
    testimonials: data.testimonials ?? [],
    testimonialConsentHistory: data.testimonialConsentHistory ?? [],
    reviewRequests: data.reviewRequests ?? [],
    workers: data.workers ?? [],
    adminUsers: (data.adminUsers ?? []).map((user) => ({
      ...user,
      twoFactorLastUsedStep: Number(user.twoFactorLastUsedStep ?? -1),
      sessionEpoch: normalizeAdminSessionEpoch(user.sessionEpoch),
    })),
    plannerActions: data.plannerActions ?? [],
    businessJobs: data.businessJobs ?? [],
    businessJobInvoices: data.businessJobInvoices ?? [],
    businessJobPaymentEvents: data.businessJobPaymentEvents ?? [],
    priceOffers: (data.priceOffers ?? []).map((offer) => ({
      ...offer,
      documentationPromotion: Boolean(offer.documentationPromotion),
      includeTransport: Boolean(offer.includeTransport),
      transportFrom: offer.transportFrom ?? '',
      transportTo: offer.transportTo ?? '',
      transportRoundTripKm: Number(offer.transportRoundTripKm ?? 0),
      transportPricePerKm: Number(offer.transportPricePerKm ?? 0.7),
      vatRate: resolvePriceOfferVatRate(offer, 23),
      sourceJobIds: [...new Set([...(offer.sourceJobIds ?? []), ...(offer.jobId ? [offer.jobId] : []), ...(auditedJobsByOfferNumber.get(offer.number) ?? [])])],
    })),
    landfillPrices: data.landfillPrices ?? [],
    realizations: data.realizations ?? [],
    roofers: data.roofers ?? [],
    rooferRegistrations: data.rooferRegistrations ?? [],
    careerApplications: data.careerApplications ?? [],
    siteContent: data.siteContent ?? [],
    analyticsEvents: data.analyticsEvents ?? [],
    opsAlertStates: (data.opsAlertStates ?? []).filter((item) => (
      (item.workerKey === 'lead_email_delivery' || item.workerKey === 'application_notifications')
      && (item.observedState === 'healthy' || item.observedState === 'unhealthy')
    )).map((item) => ({
      ...item,
      observedFingerprint: String(item.observedFingerprint ?? '').slice(0, 64),
      lastDeliveredFingerprint: String(item.lastDeliveredFingerprint ?? '').slice(0, 64),
      claimFingerprint: String(item.claimFingerprint ?? '').slice(0, 64),
      updatedAt: Number.isFinite(Date.parse(String(item.updatedAt)))
        ? new Date(String(item.updatedAt)).toISOString()
        : new Date(0).toISOString(),
    })),
    adminSettings: data.adminSettings ?? {},
  };
}

function parseImageUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toRealization(row: Record<string, unknown>): Realization {
  return {
    id: String(row.id),
    title: String(row.title),
    location: row.location ? String(row.location) : '',
    materialType: row.material_type ? String(row.material_type) : '',
    areaEstimate: row.area_estimate === null || row.area_estimate === undefined ? undefined : Number(row.area_estimate),
    description: row.description ? String(row.description) : '',
    imageUrls: parseImageUrls(row.image_urls),
    status: String(row.status) as RealizationStatus,
    featured: Boolean(row.featured),
    createdBy: row.created_by ? String(row.created_by) : '',
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : undefined,
    publicationEvidence: row.publication_evidence ? String(row.publication_evidence) : '',
    publicationApprovedBy: row.publication_approved_by ? String(row.publication_approved_by) : '',
    publicationApprovedAt: row.publication_approved_at ? new Date(String(row.publication_approved_at)).toISOString() : undefined,
  };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : value.split(',').map((item) => item.trim()).filter(Boolean);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function toRoofer(row: Record<string, unknown>): Roofer {
  return {
    id: String(row.id),
    name: String(row.name),
    ico: row.ico ? String(row.ico) : '',
    contactPerson: row.contact_person ? String(row.contact_person) : row.contactPerson ? String(row.contactPerson) : '',
    phone: row.phone ? String(row.phone) : '',
    email: row.email ? String(row.email) : '',
    web: row.web ? String(row.web) : '',
    region: row.region ? String(row.region) : '',
    districts: parseStringArray(row.districts),
    specialization: row.specialization ? String(row.specialization) : '',
    publicNote: row.public_note ? String(row.public_note) : row.publicNote ? String(row.publicNote) : '',
    internalNote: row.internal_note ? String(row.internal_note) : row.internalNote ? String(row.internalNote) : '',
    active: Boolean(row.active),
    verifiedPartner: Boolean(row.verified_partner ?? row.verifiedPartner),
    inVerification: Boolean(row.in_verification ?? row.inVerification ?? !row.verified_partner),
    preferredPartner: Boolean(row.preferred_partner ?? row.preferredPartner),
    customerReferralApproved: Boolean(row.customer_referral_approved ?? row.customerReferralApproved),
    customerReferralEvidence: row.customer_referral_evidence ? String(row.customer_referral_evidence) : row.customerReferralEvidence ? String(row.customerReferralEvidence) : '',
    customerReferralApprovedAt: row.customer_referral_approved_at || row.customerReferralApprovedAt
      ? new Date(String(row.customer_referral_approved_at ?? row.customerReferralApprovedAt)).toISOString()
      : undefined,
    customerReferralApprovedBy: row.customer_referral_approved_by ? String(row.customer_referral_approved_by) : row.customerReferralApprovedBy ? String(row.customerReferralApprovedBy) : '',
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? row.reviewCount ?? 0),
    complaintsCount: Number(row.complaints_count ?? row.complaintsCount ?? 0),
    cardViewCount: Number(row.card_view_count ?? row.cardViewCount ?? 0),
    contactRevealCount: Number(row.contact_reveal_count ?? row.contactRevealCount ?? 0),
    quoteUseClickCount: Number(row.quote_use_click_count ?? row.quoteUseClickCount ?? 0),
    referralCount: Number(row.referral_count ?? row.referralCount ?? 0),
    recommendedJobsCount: Number(row.recommended_jobs_count ?? row.recommendedJobsCount ?? 0),
    confirmedJobsCount: Number(row.confirmed_jobs_count ?? row.confirmedJobsCount ?? 0),
    failedJobsCount: Number(row.failed_jobs_count ?? row.failedJobsCount ?? 0),
    internalScore: Number(row.internal_score ?? row.internalScore ?? 0),
    totalM2: Number(row.total_m2 ?? row.totalM2 ?? 0),
    revenueWithoutVat: Number(row.revenue_without_vat ?? row.revenueWithoutVat ?? 0),
    profit: Number(row.profit ?? 0),
    createdAt: new Date(String(row.created_at ?? row.createdAt ?? now())).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.updatedAt ?? now())).toISOString(),
  };
}

function toRooferRegistration(row: Record<string, unknown>): RooferRegistration {
  return {
    id: String(row.id),
    submissionId: String(row.submission_id ?? row.submissionId ?? ''),
    createdAt: new Date(String(row.created_at ?? row.createdAt ?? now())).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.updatedAt ?? now())).toISOString(),
    businessType: String(row.business_type ?? row.businessType ?? 'other') as RooferRegistration['businessType'],
    companyName: String(row.company_name ?? row.companyName ?? ''),
    companyId: String(row.company_id ?? row.companyId ?? ''),
    contactPerson: String(row.contact_person ?? row.contactPerson ?? row.full_name ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    website: String(row.website ?? row.web ?? ''),
    serviceRegions: parseStringArray(row.service_regions ?? row.serviceRegions ?? row.regions),
    specializations: parseStringArray(row.specializations ?? row.specialization),
    otherSpecialization: String(row.other_specialization ?? row.otherSpecialization ?? ''),
    canBuildRoofTruss: String(row.can_build_roof_truss ?? row.canBuildRoofTruss ?? 'by_scope') as RooferRegistration['canBuildRoofTruss'],
    acceptCustomerReferrals: Boolean(row.accept_customer_referrals ?? row.acceptCustomerReferrals),
    consentPublicProfile: Boolean(row.consent_public_profile ?? row.consentPublicProfile),
    privacyConsent: Boolean(row.privacy_consent ?? row.privacyConsent),
    note: String(row.note ?? row.message ?? ''),
    status: String(row.status ?? 'new') as RooferRegistrationStatus,
  };
}

function toCareerApplication(row: Record<string, unknown>): CareerApplication {
  const nestedCv = row.cv && typeof row.cv === 'object' && !Array.isArray(row.cv)
    ? row.cv as Record<string, unknown> : null;
  const storageKey = String(row.cv_storage_key ?? row.cvStorageKey ?? nestedCv?.storageKey ?? '');
  const storageDriver = String(row.cv_storage_driver ?? row.cvStorageDriver ?? nestedCv?.storageDriver ?? '');
  const cv = storageKey && ['vercel_blob', 's3', 'local'].includes(storageDriver)
    ? {
        originalName: String(row.cv_original_name ?? row.cvOriginalName ?? nestedCv?.originalName ?? 'životopis'),
        storageDriver: storageDriver as CareerApplicationCv['storageDriver'],
        storageKey,
        mimeType: String(row.cv_mime_type ?? row.cvMimeType ?? nestedCv?.mimeType ?? 'application/octet-stream'),
        sizeBytes: Number(row.cv_size_bytes ?? row.cvSizeBytes ?? nestedCv?.sizeBytes ?? 0),
        sha256: String(row.cv_sha256 ?? row.cvSha256 ?? nestedCv?.sha256 ?? '') || undefined,
      }
    : undefined;
  return {
    id: String(row.id),
    submissionId: String(row.submission_id ?? row.submissionId ?? ''),
    createdAt: new Date(String(row.created_at ?? row.createdAt ?? now())).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.updatedAt ?? now())).toISOString(),
    status: String(row.status ?? 'new') as CareerApplication['status'],
    ownerEmail: String(row.owner_email ?? row.ownerEmail ?? '').trim().toLowerCase(),
    nextAction: cleanSlovakText(String(row.next_action ?? row.nextAction ?? '')),
    followupDate: dateOnly(row.followup_date ?? row.followupDate),
    fullName: cleanSlovakText(String(row.full_name ?? row.fullName ?? '')),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    city: cleanSlovakText(String(row.city ?? '')),
    cooperationType: String(row.cooperation_type ?? row.cooperationType ?? 'szco') as CareerApplication['cooperationType'],
    workRegions: cleanSlovakText(String(row.work_regions ?? row.workRegions ?? '')),
    hasTradeLicense: Boolean(row.has_trade_license ?? row.hasTradeLicense),
    workAtHeights: Boolean(row.work_at_heights ?? row.workAtHeights),
    hasAsbestosExperience: Boolean(row.has_asbestos_experience ?? row.hasAsbestosExperience),
    asbestosExperience: cleanSlovakText(String(row.asbestos_experience ?? row.asbestosExperience ?? '')),
    experience: cleanSlovakText(String(row.experience ?? '')),
    note: cleanSlovakText(String(row.note ?? '')),
    privacyConsent: Boolean(row.privacy_consent ?? row.privacyConsent),
    cvExpected: Boolean(row.cv_expected ?? row.cvExpected),
    cv,
  };
}

function toSiteContent(row: Record<string, unknown>): SiteContentItem {
  return {
    key: String(row.key),
    value: String(row.value ?? ''),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
  };
}

function toReviewRequest(row: Record<string, unknown>): ReviewRequest {
  return {
    id: String(row.id),
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.updatedAt)).toISOString(),
    status: String(row.status ?? 'sent') as ReviewRequestStatus,
    customerName: cleanSlovakText(String(row.customer_name ?? row.customerName ?? '')),
    phone: String(row.phone ?? ''),
    location: String(row.location ?? ''),
    objectType: String(row.object_type ?? row.objectType ?? ''),
    realizationDate: row.realization_date || row.realizationDate ? String(row.realization_date ?? row.realizationDate) : '',
    googleReviewLink: String(row.google_review_link ?? row.googleReviewLink ?? ''),
    message: String(row.message ?? ''),
    createdBy: String(row.created_by ?? row.createdBy ?? ''),
    leadId: row.lead_id || row.leadId ? String(row.lead_id ?? row.leadId) : '',
  };
}

function toWorker(row: Record<string, unknown>): Worker {
  return {
    id: String(row.id),
    name: String(row.name),
    ratePerM2: Number(row.rate_per_m2 ?? row.ratePerM2 ?? 0),
    active: Boolean(row.active),
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.updatedAt)).toISOString(),
  };
}

function toAdminUser(row: Record<string, unknown>): AdminUser {
  const rawBackupHashes = row.two_factor_backup_code_hashes ?? row.twoFactorBackupCodeHashes ?? [];
  const backupHashes = Array.isArray(rawBackupHashes)
    ? rawBackupHashes.map(String)
    : typeof rawBackupHashes === 'string'
      ? parseStringArray(rawBackupHashes)
      : [];
  return {
    id: String(row.id),
    email: String(row.email ?? '').trim().toLowerCase(),
    name: String(row.name ?? ''),
    role: String(row.role ?? 'OPERATOR') as AdminRole,
    active: Boolean(row.active),
    passwordHash: String(row.password_hash ?? row.passwordHash ?? ''),
    twoFactorSecret: String(row.two_factor_secret ?? row.twoFactorSecret ?? '') || undefined,
    twoFactorEnabled: Boolean(row.two_factor_enabled ?? row.twoFactorEnabled ?? false),
    twoFactorLastUsedStep: Number(row.two_factor_last_used_step ?? row.twoFactorLastUsedStep ?? -1),
    twoFactorBackupCodeHashes: backupHashes,
    sessionEpoch: normalizeAdminSessionEpoch(row.session_epoch ?? row.sessionEpoch),
    createdAt: new Date(String(row.created_at ?? row.createdAt ?? now())).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.updatedAt ?? now())).toISOString(),
  };
}

function toPlannerAction(row: Record<string, unknown>): PlannerAction {
  return {
    id: String(row.id),
    createdAt: new Date(String(row.created_at ?? row.createdAt ?? now())).toISOString(),
    date: dateOnly(row.datum ?? row.date),
    timeFrom: String(row.cas_od ?? row.timeFrom ?? ''),
    timeTo: String(row.cas_do ?? row.timeTo ?? ''),
    type: String(row.typ ?? row.type ?? 'INE') as PlannerActionType,
    address: String(row.adresa ?? row.address ?? ''),
    jobId: row.zakazka_id || row.jobId ? String(row.zakazka_id ?? row.jobId) : '',
    workers: String(row.pracovnici ?? row.workers ?? ''),
    customerName: String(row.zakaznik_meno ?? row.customerName ?? ''),
    customerEmail: String(row.zakaznik_email ?? row.customerEmail ?? ''),
    customerPhone: String(row.zakaznik_telefon ?? row.customerPhone ?? ''),
    note: String(row.poznamka ?? row.note ?? ''),
    status: String(row.stav ?? row.status ?? 'NAPLANOVANA') as PlannerActionStatus,
    notify2Days: Boolean(row.notif_2dni ?? row.notify2Days),
    notify1Day: Boolean(row.notif_1den ?? row.notify1Day),
    notifyCustomer: Boolean(row.notif_zakaznik ?? row.notifyCustomer),
    notify2DaysSent: Boolean(row.notif_2dni_odoslana ?? row.notify2DaysSent),
    notify1DaySent: Boolean(row.notif_1den_odoslana ?? row.notify1DaySent),
    notifyCustomerSent: Boolean(row.notif_zakaznik_odoslana ?? row.notifyCustomerSent),
  };
}

function toLandfillPrice(row: Record<string, unknown>): LandfillPrice {
  return {
    id: String(row.id),
    year: Number(row.year),
    landfill: String(row.landfill) as BusinessLandfill,
    pricePerTon: Number(row.price_per_ton ?? row.pricePerTon ?? 0),
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.updatedAt)).toISOString(),
  };
}

function toBusinessJobCosts(row: Record<string, unknown>): BusinessJobCosts {
  return {
    jobId: String(row.job_id ?? row.jobId ?? ''),
    fuel: Number(row.fuel ?? 0),
    suits: Number(row.suits ?? 0),
    gloves: Number(row.gloves ?? 0),
    penetrant: Number(row.penetrant ?? 0),
    landfillCost: Number(row.landfill_cost ?? row.landfillCost ?? 0),
    otherName: String(row.other_name ?? row.otherName ?? ''),
    otherAmount: Number(row.other_amount ?? row.otherAmount ?? 0),
    total: Number(row.total ?? 0),
  };
}

function enrichBusinessJob(
  row: Record<string, unknown>,
  workers: BusinessJob['workers'] = [],
  costs?: BusinessJobCosts,
): BusinessJob {
  const totalPrice = Number(row.total_price ?? row.totalPrice ?? 0);
  const jobCosts =
    costs ??
    ({ jobId: String(row.id), fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0, total: 0 } satisfies BusinessJobCosts);
  const rewardsTotal = workers.reduce((sum, worker) => sum + worker.reward, 0);
  const grossProfit = totalPrice - rewardsTotal - jobCosts.total;
  return {
    id: String(row.id),
    leadId: row.lead_id || row.leadId ? String(row.lead_id ?? row.leadId) : undefined,
    isTestData: Boolean(row.is_test_data ?? row.isTestData ?? false),
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.updatedAt)).toISOString(),
    deletedAt: row.deleted_at || row.deletedAt ? new Date(String(row.deleted_at ?? row.deletedAt)).toISOString() : undefined,
    demolitionDate: dateOnly(row.demolition_date ?? row.demolitionDate),
    customerName: String(row.customer_name ?? row.customerName ?? ''),
    customerPhone: String(row.customer_phone ?? row.customerPhone ?? ''),
    customerEmail: String(row.customer_email ?? row.customerEmail ?? ''),
    location: cleanSlovakText(String(row.location ?? '')),
    district: cleanSlovakText(String(row.district ?? '')),
    materialType: cleanSlovakText(String(row.material_type ?? row.materialType ?? '')),
    objectType: cleanSlovakText(String(row.object_type ?? row.objectType ?? '')),
    term: cleanSlovakText(String(row.term ?? '')),
    leadSource: String(row.lead_source ?? row.leadSource ?? ''),
    preferredContact: String(row.preferovany_kontakt ?? row.preferredContact ?? ''),
    m2: Number(row.m2 ?? 0),
    pricePerM2: Number(row.price_per_m2 ?? row.pricePerM2 ?? 0),
    totalPrice,
    paymentType: String(row.payment_type ?? row.paymentType ?? 'FAKTURA') as BusinessPaymentType,
    workType: String(row.work_type ?? row.workType ?? 'DEMONTAZ_A_ODVOZ') as BusinessWorkType,
    wasteKg: Number(row.waste_kg ?? row.wasteKg ?? 0),
    landfill: String(row.landfill ?? 'INA') as BusinessLandfill,
    status: String(row.status ?? 'DOPYT') as BusinessJobStatus,
    note: String(row.note ?? ''),
    workers,
    costs: jobCosts,
    rewardsTotal,
    grossProfit,
    marginPercent: totalPrice ? Math.round((grossProfit / totalPrice) * 1000) / 10 : 0,
  };
}

function toAnalyticsEvent(row: Record<string, unknown>): AnalyticsEvent {
  return {
    id: String(row.id),
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
    sessionId: String(row.session_id ?? row.sessionId ?? ''),
    eventType: String(row.event_type ?? row.eventType) as AnalyticsEvent['eventType'],
    path: String(row.path ?? ''),
    referrer: String(row.referrer ?? ''),
    device: String(row.device ?? '') as AnalyticsEvent['device'],
    viewportWidth: row.viewport_width === null || row.viewport_width === undefined ? undefined : Number(row.viewport_width),
    utmSource: String(row.utm_source ?? row.utmSource ?? ''),
    utmMedium: String(row.utm_medium ?? row.utmMedium ?? ''),
    utmCampaign: String(row.utm_campaign ?? row.utmCampaign ?? ''),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

async function readLocalDb(): Promise<LocalDb> {
  await mkdir(/*turbopackIgnore: true*/ path.dirname(localDbPath), { recursive: true });
  let serialized: string;
  try {
    serialized = await readFile(/*turbopackIgnore: true*/ localDbPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const empty: LocalDb = {
      leads: [],
      leadFiles: [],
      leadFileDeletionJobs: [],
      leadEmailOutbox: [],
      metaCapiOutbox: [],
      metaCapiConsentRevocations: [],
      auditLogs: [],
      quotes: [],
      testimonials: [],
      testimonialConsentHistory: [],
      reviewRequests: [],
      workers: [],
      adminUsers: [],
      plannerActions: [],
      businessJobs: [],
      businessJobInvoices: [],
      businessJobPaymentEvents: [],
      priceOffers: [],
      landfillPrices: [],
      realizations: [],
      roofers: [],
      rooferRegistrations: [],
      careerApplications: [],
      siteContent: [],
      analyticsEvents: [],
      opsAlertStates: [],
      adminSettings: {},
    };
    await writeLocalDb(empty);
    return empty;
  }
  try {
    return normalizeLocalDb(JSON.parse(serialized) as Partial<LocalDb>);
  } catch (error) {
    throw new Error('Local database could not be read; the original file was preserved.', { cause: error });
  }
}

async function writeLocalDb(data: LocalDb, options: {
  purgeLeadAuditId?: string;
  writeAdminUsers?: boolean;
  adminSettingKey?: string;
} = {}) {
  const persist = async () => {
    await mkdir(/*turbopackIgnore: true*/ path.dirname(localDbPath), { recursive: true });
    const tempPath = `${localDbPath}.${randomUUID()}.tmp`;
    try {
      let existingDb = normalizeLocalDb({});
      let existingAnalytics: AnalyticsEvent[] = [];
      try {
        const serialized = await readFile(/*turbopackIgnore: true*/ localDbPath, 'utf8');
        existingDb = normalizeLocalDb(JSON.parse(serialized) as Partial<LocalDb>);
        existingAnalytics = existingDb.analyticsEvents;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const archivedJobIds = new Set(existingDb.businessJobs.filter((job) => job.deletedAt).map((job) => job.id));
      if (data.businessJobs.some((job) => archivedJobIds.has(job.id) && !job.deletedAt)) {
        throw new Error('Archivovanú zákazku nemožno upravovať.');
      }
      const uniqueAnalytics = new Map<string, AnalyticsEvent>();
      for (const event of [...existingAnalytics, ...data.analyticsEvents]) {
        if (!uniqueAnalytics.has(event.id)) uniqueAnalytics.set(event.id, event);
      }
      const orderedAnalytics = [...uniqueAnalytics.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const acceptedLeadEvents = orderedAnalytics.filter((item) => item.eventType === 'form_submit_success');
      const otherEvents = orderedAnalytics.filter((item) => item.eventType !== 'form_submit_success').slice(0, 5000);
      const uniqueById = <T extends { id: string }>(existing: T[], incoming: T[]) => {
        const values = new Map<string, T>();
        for (const item of [...existing, ...incoming]) if (!values.has(item.id)) values.set(item.id, item);
        return [...values.values()];
      };
      const latestTestimonials = new Map(existingDb.testimonials.map((item) => [item.id, item]));
      for (const testimonial of data.testimonials) {
        const persisted = latestTestimonials.get(testimonial.id);
        if (!persisted || testimonial.updatedAt > persisted.updatedAt) latestTestimonials.set(testimonial.id, testimonial);
      }
      const durableAuditLogs = uniqueById(existingDb.auditLogs.filter((log) => !(options.purgeLeadAuditId
        && log.entityType === 'lead' && log.entityId === options.purgeLeadAuditId)), data.auditLogs)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const durableLeads = mergeLatestTestClassifications(data.leads, durableAuditLogs, 'lead');
      const durableBusinessJobs = mergeLatestTestClassifications(data.businessJobs, durableAuditLogs, 'business_job');
      const durableInvoices = new Map(existingDb.businessJobInvoices.map((item) => [item.id, item]));
      for (const invoice of data.businessJobInvoices) {
        const persisted = durableInvoices.get(invoice.id);
        if (persisted?.cancelledAt) continue;
        durableInvoices.set(invoice.id, invoice);
      }
      const durableOpsAlertStates = new Map(existingDb.opsAlertStates.map((item) => [item.workerKey, item]));
      for (const alertState of data.opsAlertStates) {
        const persisted = durableOpsAlertStates.get(alertState.workerKey);
        if (!persisted || alertState.updatedAt >= persisted.updatedAt) durableOpsAlertStates.set(alertState.workerKey, alertState);
      }
      const durableData = {
        ...data,
        // Only locked, fresh-read owners may replace authentication state.
        // Ordinary snapshots must preserve complete records, including same-epoch changes.
        adminUsers: options.writeAdminUsers ? data.adminUsers : existingDb.adminUsers,
        adminSettings: {
          ...existingDb.adminSettings,
          ...(options.adminSettingKey ? { [options.adminSettingKey]: data.adminSettings[options.adminSettingKey] } : {}),
        },
        leads: durableLeads,
        businessJobs: durableBusinessJobs,
        businessJobInvoices: [...durableInvoices.values()],
        businessJobPaymentEvents: uniqueById(existingDb.businessJobPaymentEvents, data.businessJobPaymentEvents),
        testimonials: [...latestTestimonials.values()],
        auditLogs: durableAuditLogs,
        testimonialConsentHistory: uniqueById(existingDb.testimonialConsentHistory, data.testimonialConsentHistory)
          .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
        opsAlertStates: [...durableOpsAlertStates.values()],
        analyticsEvents: [...acceptedLeadEvents, ...otherEvents],
      };
      await writeFile(/*turbopackIgnore: true*/ tempPath, JSON.stringify(durableData, null, 2), 'utf8');
      for (let attempt = 0; ; attempt += 1) {
        try {
          await rename(/*turbopackIgnore: true*/ tempPath, /*turbopackIgnore: true*/ localDbPath);
          break;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (attempt >= 4 || (code !== 'EPERM' && code !== 'EACCES')) throw error;
          await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        }
      }
    } catch (error) {
      await unlink(/*turbopackIgnore: true*/ tempPath).catch(() => undefined);
      throw error;
    }
  };
  const result = localDbWriteQueue.then(persist, persist);
  localDbWriteQueue = result.then(() => undefined, () => undefined);
  await result;
}

export async function createLead(input: LeadInput): Promise<Lead> {
  await ensureSchema();
  const id = randomUUID();
  const timestamp = now();
  const lead: Lead = {
    ...input,
    id,
    status: 'novy',
    internalNote: '',
    district: input.district ?? '',
    roofer: input.roofer ?? '',
    term: input.term ?? '',
    note: input.note ?? '',
    source: input.source ?? 'web',
    preferredContact: input.preferredContact ?? 'Zavolajte mi',
    wantsRooferRecommendation: Boolean(input.wantsRooferRecommendation),
    selectedRooferId: input.selectedRooferId ?? '',
    ownerEmail: '',
    nextAction: '',
    rawData: input.rawData ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.leads.unshift(lead);
    await writeLocalDb(local);
    await addAuditLog('lead', id, 'lead_created', 'system', { status: 'novy' });
    return lead;
  }

  await db.query(
    `INSERT INTO leads (
      id, created_at, updated_at, status, full_name, phone, email, city, district,
      object_type, material_type, area_estimate, preferovany_kontakt, roofer, term, note, gdpr, source,
      internal_note, raw_data, wants_roofer_recommendation, selected_roofer_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    [
      lead.id,
      lead.createdAt,
      lead.updatedAt,
      lead.status,
      lead.fullName,
      lead.phone,
      lead.email,
      lead.city,
      lead.district,
      lead.objectType,
      lead.materialType,
      lead.areaEstimate,
      lead.preferredContact,
      lead.roofer,
      lead.term,
      lead.note,
      lead.gdpr,
      lead.source,
      lead.internalNote,
      lead.rawData,
      lead.wantsRooferRecommendation,
      lead.selectedRooferId,
    ],
  );
  await addAuditLog('lead', id, 'lead_created', 'system', { status: 'novy' });
  return lead;
}

export class LeadSubmissionConflictError extends Error {
  constructor() {
    super('Dopyt z tohto formulára sme už prijali. Opakované údaje alebo fotky sa k nemu nepripojili. Nevytvárajte nový dopyt; zavolajte nám na 0905 217 946 a prijatie spolu overíme.');
    this.name = 'LeadSubmissionConflictError';
  }
}

export type LeadSubmissionResult = {
  lead: Lead;
  businessJobId: string;
  files: LeadFile[];
  duplicate: boolean;
};

function requireLeadUploadDraftDatabase() {
  const db = getPool();
  if (!db) throw new Error('Prednahrávanie príloh vyžaduje databázu PostgreSQL.');
  return db;
}

export async function consumeApiRateLimit(bucketKey: string, windowStartedAt: Date, maxHits: number) {
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const { rows } = await db.query(
    `INSERT INTO api_rate_limit_buckets (bucket_key, window_started_at, hit_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (bucket_key, window_started_at) DO UPDATE
       SET hit_count = api_rate_limit_buckets.hit_count + 1
     RETURNING hit_count`,
    [bucketKey, windowStartedAt],
  );
  await purgeExpiredApiRateLimitBucketsWithPool(db);
  return Number(rows[0]?.hit_count ?? maxHits + 1) > maxHits;
}

async function purgeExpiredApiRateLimitBucketsWithPool(db: Pool) {
  const { rowCount } = await db.query(
    `DELETE FROM api_rate_limit_buckets
     WHERE window_started_at < now() - interval '10 minutes'`,
  );
  return rowCount ?? 0;
}

export async function purgeExpiredApiRateLimitBuckets() {
  await ensureSchema();
  return purgeExpiredApiRateLimitBucketsWithPool(requireLeadUploadDraftDatabase());
}

export async function reserveLeadUploadDraft(
  submissionId: string,
  storageKey: string,
  replacesStorageKey?: string | string[],
  storageDriver: 'vercel_blob' | 's3' = 'vercel_blob',
  fileFingerprint = '',
  contentType = '',
  sizeBytes = 0,
) {
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [submissionId]);
    const previousKeys = [...new Set((Array.isArray(replacesStorageKey) ? replacesStorageKey : [replacesStorageKey])
      .filter((key): key is string => Boolean(key && key !== storageKey)))];
    if (previousKeys.length > 128) throw new Error('Príliš veľa pokusov o nahratie tej istej fotky.');
    if (previousKeys.length) {
      const priorAttempts = await client.query(
        'SELECT storage_key, submission_id, status FROM lead_upload_drafts WHERE storage_key = ANY($1::text[]) FOR UPDATE',
        [previousKeys],
      );
      for (const row of priorAttempts.rows) {
        if (String(row.submission_id) !== submissionId || !['uploading', 'uploaded', 'superseded', 'deleted'].includes(String(row.status))) {
          throw new Error('Predchádzajúci pokus o nahratie sa už nedá obnoviť. Vyberte fotku znova.');
        }
      }
      // A missing key may be a token request that failed before reservation.
      // Supersede every known predecessor atomically, including old rows without a fingerprint.
      await client.query(
        `UPDATE lead_upload_drafts SET status = 'superseded', updated_at = now()
         WHERE storage_key = ANY($1::text[]) AND submission_id = $2
           AND status IN ('uploading', 'uploaded', 'superseded')`,
        [previousKeys, submissionId],
      );
    }
    if (fileFingerprint) {
      await client.query(
        `UPDATE lead_upload_drafts SET status = 'superseded', updated_at = now()
         WHERE submission_id = $1 AND storage_driver = $2 AND file_fingerprint = $3
           AND storage_key <> $4 AND status IN ('uploading', 'uploaded')`,
        [submissionId, storageDriver, fileFingerprint, storageKey],
      );
    }
    const prior = await client.query(
      'SELECT storage_key, submission_id, storage_driver, status FROM lead_upload_drafts WHERE storage_key = $1 FOR UPDATE',
      [storageKey],
    );

    if (prior.rows[0]) {
      const row = prior.rows[0];
      if (String(row.submission_id) !== submissionId || String(row.storage_driver) !== storageDriver || !['uploading', 'uploaded'].includes(String(row.status))) {
        throw new Error('Táto príloha už bola priradená alebo sa spracúva.');
      }
      if (String(row.status) === 'uploaded') {
        throw new Error('Táto fotka už bola nahraná. Vyberte ju prosím znova, ak ju chcete nahrať opakovane.');
      }
      await client.query(
        `UPDATE lead_upload_drafts SET updated_at = now()
         WHERE storage_key = $1 AND submission_id = $2 AND status = 'uploading'`,
        [storageKey, submissionId],
      );
      await client.query('COMMIT');
      return { storageKey: String(row.storage_key), submissionId: String(row.submission_id), status: String(row.status) };
    }

    const count = await client.query(
      `SELECT COUNT(*)::int AS count FROM lead_upload_drafts
       WHERE submission_id = $1 AND status IN ('uploading', 'uploaded')`,
      [submissionId],
    );
    if (Number(count.rows[0]?.count ?? 0) >= maxLeadFiles) {
      // Pre-fingerprint browser tabs re-upload all selected photos on retry. Free only
      // one oldest unattached legacy reservation per new token, never a modern or
      // already attached photo. The accepted lead still has the strict file limit.
      const legacy = previousKeys.length === 0 ? await client.query(
        `SELECT storage_key FROM lead_upload_drafts
         WHERE submission_id = $1 AND status IN ('uploading', 'uploaded')
           AND COALESCE(file_fingerprint, '') = ''
         ORDER BY created_at ASC, storage_key ASC LIMIT 1 FOR UPDATE`,
        [submissionId],
      ) : { rows: [] };
      if (!legacy.rows[0]) throw new Error(`K jednému dopytu možno priložiť najviac ${maxLeadFiles} súborov.`);
      await client.query(
        `UPDATE lead_upload_drafts SET status = 'superseded', updated_at = now()
         WHERE storage_key = $1 AND submission_id = $2 AND status IN ('uploading', 'uploaded')`,
        [legacy.rows[0].storage_key, submissionId],
      );
    }
    const legacyClientFileId = storageKey.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.[a-z0-9]+$/i)?.[1] ?? null;
    const { rows } = await client.query(
      `INSERT INTO lead_upload_drafts (
         storage_key, submission_id, storage_driver, file_fingerprint,
         client_file_id, content_type, size_bytes, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'uploading')
       RETURNING storage_key, submission_id, storage_driver, status`,
      [storageKey, submissionId, storageDriver, fileFingerprint, legacyClientFileId, contentType, sizeBytes],
    );
    await client.query('COMMIT');
    return { storageKey: String(rows[0].storage_key), submissionId: String(rows[0].submission_id), status: String(rows[0].status) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function claimExpiredLeadUploadDrafts(limit = 50) {
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const claimId = randomUUID();
  const { rows } = await db.query(
    `WITH candidates AS (
       SELECT draft.storage_key FROM lead_upload_drafts AS draft
       WHERE ((draft.status = 'deleting' AND (draft.deletion_claimed_until IS NULL OR draft.deletion_claimed_until < now()))
          OR (draft.status IN ('uploading', 'uploaded', 'superseded') AND draft.updated_at < now() - interval '24 hours'))
         AND NOT EXISTS (
           SELECT 1 FROM lead_files AS file
           WHERE file.storage_driver = draft.storage_driver AND file.storage_key = draft.storage_key
         )
         AND NOT EXISTS (
           SELECT 1 FROM lead_file_deletion_jobs AS job
           WHERE job.storage_driver = draft.storage_driver AND job.storage_key = draft.storage_key
         )
       ORDER BY draft.updated_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE lead_upload_drafts AS draft
     SET status = 'deleting', deletion_claim_id = $2,
         deletion_claimed_until = now() + interval '15 minutes', updated_at = now()
     FROM candidates
     WHERE draft.storage_key = candidates.storage_key
     RETURNING draft.storage_key, draft.storage_driver, draft.blob_etag, draft.deletion_claim_id`,
    [Math.max(1, Math.min(200, Math.floor(limit))), claimId],
  );
  return rows.map((row) => ({
    storageKey: String(row.storage_key),
    storageDriver: String(row.storage_driver) as 'vercel_blob' | 's3',
    blobEtag: String(row.blob_etag || ''),
    claimId: String(row.deletion_claim_id),
  }));
}

export async function completeLeadUploadDraftDeletion(storageKey: string, claimId: string) {
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE lead_upload_drafts AS draft
       SET status = 'deleted', deletion_claim_id = NULL, deletion_claimed_until = NULL, updated_at = now()
       WHERE draft.storage_key = $1 AND draft.status = 'deleting' AND draft.deletion_claim_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM lead_files AS file
           WHERE file.storage_driver = draft.storage_driver AND file.storage_key = draft.storage_key
         )
         AND NOT EXISTS (
           SELECT 1 FROM lead_file_deletion_jobs AS job
           WHERE job.storage_driver = draft.storage_driver AND job.storage_key = draft.storage_key
         )
       RETURNING draft.submission_id, draft.storage_driver`,
      [storageKey, claimId],
    );
    if (!rows[0]) { await client.query('COMMIT'); return false; }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'system', $2, 'lead_upload_retention_deleted', 'cron:lead-upload-retention', $3::jsonb, now())`,
      [randomUUID(), rows[0].submission_id, JSON.stringify({
        storageDriver: String(rows[0].storage_driver),
        storageKeyHash: createHash('sha256').update(storageKey).digest('hex'),
      })],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function mayDeleteClaimedLeadUploadDraft(storageKey: string, claimId: string) {
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const { rows } = await db.query(
    `SELECT 1 FROM lead_upload_drafts AS draft
     WHERE draft.storage_key = $1 AND draft.status = 'deleting' AND draft.deletion_claim_id = $2
       AND draft.deletion_claimed_until > now()
       AND NOT EXISTS (
         SELECT 1 FROM lead_files AS file
         WHERE file.storage_driver = draft.storage_driver AND file.storage_key = draft.storage_key
       )
       AND NOT EXISTS (
         SELECT 1 FROM lead_file_deletion_jobs AS job
         WHERE job.storage_driver = draft.storage_driver AND job.storage_key = draft.storage_key
       )`,
    [storageKey, claimId],
  );
  return Boolean(rows[0]);
}

export async function supersedeLeadUploadDraft(submissionId: string, storageKey: string) {
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const { rowCount } = await db.query(
    `UPDATE lead_upload_drafts SET status = 'superseded', updated_at = now()
     WHERE submission_id = $1 AND storage_key = $2 AND lead_id IS NULL AND status IN ('uploading', 'uploaded')`,
    [submissionId, storageKey],
  );
  return (rowCount ?? 0) > 0;
}

export async function trackUnreservedLegacyLeadPhoto(submissionId: string, storageKey: string, blobEtag = '') {
  const prefix = `lead-drafts/${submissionId}/`;
  if (!isValidLeadSubmissionId(submissionId)
    || !storageKey.startsWith(prefix)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|heic|heif)$/i.test(storageKey.slice(prefix.length))) {
    throw new Error('Neplatná cesta staršej prílohy.');
  }
  if (blobEtag.length > 256 || /[\u0000-\u001f\u007f]/.test(blobEtag)) throw new Error('Neplatná identita staršej prílohy.');
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const { rowCount } = await db.query(
    `INSERT INTO lead_upload_drafts (storage_key, submission_id, storage_driver, file_fingerprint, blob_etag, status)
     SELECT $1, $2, 'vercel_blob', '', $3, 'superseded'
     WHERE NOT EXISTS (SELECT 1 FROM lead_files WHERE storage_key = $1)
       AND NOT EXISTS (SELECT 1 FROM lead_file_deletion_jobs WHERE storage_key = $1)
     ON CONFLICT (storage_key) DO NOTHING`,
    [storageKey, submissionId, blobEtag],
  );
  return (rowCount ?? 0) > 0;
}

export async function claimLeadBlobReconciliation() {
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  await db.query('INSERT INTO lead_blob_reconciliation_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
  const claimId = randomUUID();
  const { rows } = await db.query(
    `UPDATE lead_blob_reconciliation_state
     SET claim_id = $1, claimed_until = now() + interval '10 minutes', updated_at = now()
     WHERE id = 1 AND (claim_id IS NULL OR claimed_until < now())
     RETURNING cursor`,
    [claimId],
  );
  return rows[0] ? { claimId, cursor: String(rows[0].cursor || '') } : null;
}

export async function advanceLeadBlobReconciliation(claimId: string, cursor: string) {
  if (cursor.length > 4096) throw new Error('Blob inventory cursor is too long.');
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const { rowCount } = await db.query(
    `UPDATE lead_blob_reconciliation_state
     SET cursor = $2, list_failures = 0, claimed_until = now() + interval '10 minutes', updated_at = now()
     WHERE id = 1 AND claim_id = $1 AND claimed_until > now()`,
    [claimId, cursor],
  );
  return (rowCount ?? 0) === 1;
}

export async function recordLeadBlobInventoryListFailure(claimId: string) {
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const { rows } = await db.query(
    `UPDATE lead_blob_reconciliation_state
     SET cursor = CASE WHEN list_failures + 1 >= 3 THEN '' ELSE cursor END,
         list_failures = CASE WHEN list_failures + 1 >= 3 THEN 0 ELSE list_failures + 1 END,
         updated_at = now()
     WHERE id = 1 AND claim_id = $1
     RETURNING cursor, list_failures`,
    [claimId],
  );
  return rows[0] ? { cursorReset: String(rows[0].cursor) === '', failures: Number(rows[0].list_failures) } : null;
}

export async function releaseLeadBlobReconciliation(claimId: string) {
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const { rowCount } = await db.query(
    `UPDATE lead_blob_reconciliation_state
     SET claim_id = NULL, claimed_until = NULL, updated_at = now()
     WHERE id = 1 AND claim_id = $1`,
    [claimId],
  );
  return (rowCount ?? 0) === 1;
}

export async function markLeadUploadDraftUploaded(
  submissionId: string,
  storageKey: string,
  metadata: { contentType?: string; sizeBytes?: number; blobEtag?: string } = {},
) {
  await ensureSchema();
  const db = requireLeadUploadDraftDatabase();
  const contentType = metadata.contentType?.trim() || '';
  const sizeBytes = Number(metadata.sizeBytes ?? 0);
  const blobEtag = metadata.blobEtag?.trim() || '';
  if (!Number.isInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > 10 * 1024 * 1024) {
    throw new Error('Neplatná veľkosť nahranej prílohy.');
  }
  const { rows } = await db.query(
    `UPDATE lead_upload_drafts SET
       status = 'uploaded',
       content_type = CASE WHEN $3 <> '' THEN $3 ELSE content_type END,
       size_bytes = CASE WHEN $4 > 0 THEN $4 ELSE size_bytes END,
       blob_etag = CASE WHEN $5 <> '' THEN $5 ELSE blob_etag END,
       uploaded_at = COALESCE(uploaded_at, now()), updated_at = now()
     WHERE submission_id = $1 AND storage_key = $2 AND status IN ('uploading', 'uploaded')
     RETURNING storage_key`,
    [submissionId, storageKey, contentType, sizeBytes, blobEtag],
  );
  if (!rows[0]) {
    const attached = await db.query(
      `SELECT storage_key FROM lead_upload_drafts WHERE submission_id = $1 AND storage_key = $2 AND status = 'attached'`,
      [submissionId, storageKey],
    );
    if (attached.rows[0]) return true;
    throw new Error('Rezervácia prílohy sa nenašla alebo už bola uzavretá.');
  }
  return true;
}

export async function getExistingLeadSubmission(
  submissionId: string,
  submissionHash: string,
): Promise<LeadSubmissionResult | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.submissionId === submissionId);
    if (!lead) return null;
    if (lead.rawData?.submissionFingerprintHash !== submissionHash) throw new LeadSubmissionConflictError();
    const businessJob = local.businessJobs.find((item) => item.leadId === lead.id);
    if (!businessJob) throw new Error('Uložený dopyt nemá priradenú zákazku.');
    return {
      lead,
      businessJobId: businessJob.id,
      files: local.leadFiles.filter((item) => item.leadId === lead.id),
      duplicate: true,
    };
  }

  const { rows } = await db.query('SELECT * FROM leads WHERE submission_id = $1 LIMIT 1', [submissionId]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  if (String(row.submission_hash ?? '') !== submissionHash) throw new LeadSubmissionConflictError();
  const lead = toLead(row);
  const [jobResult, fileResult] = await Promise.all([
    db.query('SELECT id FROM business_jobs WHERE lead_id = $1 LIMIT 1', [lead.id]),
    db.query('SELECT * FROM lead_files WHERE lead_id = $1 ORDER BY created_at', [lead.id]),
  ]);
  if (!jobResult.rows[0]) throw new Error('Uložený dopyt nemá priradenú zákazku.');
  return {
    lead,
    businessJobId: String(jobResult.rows[0].id),
    files: fileResult.rows.map((item) => toLeadFile(item)),
    duplicate: true,
  };
}

function toBusinessJobInvoice(row: Record<string, unknown>): BusinessJobInvoice {
  const financeDate = (value: unknown) => value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : dateOnly(value);
  return {
    id: String(row.id),
    jobId: String(row.job_id ?? row.jobId),
    operationId: String(row.operation_id ?? row.operationId),
    requestHash: String(row.request_hash ?? row.requestHash),
    invoiceNumber: String(row.invoice_number ?? row.invoiceNumber),
    issuedOn: financeDate(row.issued_on ?? row.issuedOn),
    dueOn: row.due_on || row.dueOn ? financeDate(row.due_on ?? row.dueOn) : undefined,
    amountWithoutVatCents: Number(row.amount_without_vat_cents ?? row.amountWithoutVatCents),
    vatRateBasisPoints: Number(row.vat_rate_basis_points ?? row.vatRateBasisPoints),
    amountWithVatCents: Number(row.amount_with_vat_cents ?? row.amountWithVatCents),
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
    createdBy: String(row.created_by ?? row.createdBy),
    cancelledOn: row.cancelled_on || row.cancelledOn ? financeDate(row.cancelled_on ?? row.cancelledOn) : undefined,
    cancelledAt: row.cancelled_at || row.cancelledAt ? new Date(String(row.cancelled_at ?? row.cancelledAt)).toISOString() : undefined,
    cancelledBy: row.cancelled_by || row.cancelledBy ? String(row.cancelled_by ?? row.cancelledBy) : undefined,
    cancelReasonCode: row.cancel_reason_code || row.cancelReasonCode ? String(row.cancel_reason_code ?? row.cancelReasonCode) : undefined,
    cancelOperationId: row.cancel_operation_id || row.cancelOperationId ? String(row.cancel_operation_id ?? row.cancelOperationId) : undefined,
    cancelRequestHash: row.cancel_request_hash || row.cancelRequestHash ? String(row.cancel_request_hash ?? row.cancelRequestHash) : undefined,
  };
}

function toBusinessJobPaymentEvent(row: Record<string, unknown>): BusinessJobPaymentEvent {
  const financeDate = (value: unknown) => value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : dateOnly(value);
  return {
    id: String(row.id),
    jobId: String(row.job_id ?? row.jobId),
    invoiceId: row.invoice_id || row.invoiceId ? String(row.invoice_id ?? row.invoiceId) : undefined,
    operationId: String(row.operation_id ?? row.operationId),
    requestHash: String(row.request_hash ?? row.requestHash),
    eventType: String(row.event_type ?? row.eventType) as BusinessJobPaymentEvent['eventType'],
    occurredOn: financeDate(row.occurred_on ?? row.occurredOn),
    amountCents: Number(row.amount_cents ?? row.amountCents),
    method: String(row.method) as BusinessPaymentMethod,
    reference: String(row.reference ?? ''),
    reversalOf: row.reversal_of || row.reversalOf ? String(row.reversal_of ?? row.reversalOf) : undefined,
    reasonCode: row.reason_code || row.reasonCode ? String(row.reason_code ?? row.reasonCode) : undefined,
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
    createdBy: String(row.created_by ?? row.createdBy),
  };
}

/** Fetches an existing submission for the narrowly scoped, content-verified retry path. */
export async function getLeadSubmissionForRetry(submissionId: string): Promise<LeadSubmissionResult | null> {
  if (!isValidLeadSubmissionId(submissionId)) return null;
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.submissionId === submissionId);
    if (!lead) return null;
    const businessJob = local.businessJobs.find((item) => item.leadId === lead.id);
    if (!businessJob) throw new Error('Uložený dopyt nemá priradenú zákazku.');
    return {
      lead,
      businessJobId: businessJob.id,
      files: local.leadFiles.filter((item) => item.leadId === lead.id),
      duplicate: true,
    };
  }

  const { rows } = await db.query('SELECT * FROM leads WHERE submission_id = $1 LIMIT 1', [submissionId]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const lead = toLead(row);
  const [jobResult, fileResult] = await Promise.all([
    db.query('SELECT id FROM business_jobs WHERE lead_id = $1 LIMIT 1', [lead.id]),
    db.query('SELECT * FROM lead_files WHERE lead_id = $1 ORDER BY created_at', [lead.id]),
  ]);
  if (!jobResult.rows[0]) throw new Error('Uložený dopyt nemá priradenú zákazku.');
  return {
    lead,
    businessJobId: String(jobResult.rows[0].id),
    files: fileResult.rows.map((item) => toLeadFile(item)),
    duplicate: true,
  };
}

function validMetaCapiConsentSubject(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requestedMetaCapiConsentSubject(rawData: Record<string, unknown> | undefined) {
  const subject = rawData?.marketingConsentSubjectAtSubmit;
  return rawData?.marketingConsentAtSubmit === true && validMetaCapiConsentSubject(subject)
    ? subject
    : undefined;
}

function metaCapiEventSourceUrl(rawData: Record<string, unknown> | undefined) {
  const attribution = rawData?.attribution && typeof rawData.attribution === 'object'
    ? rawData.attribution as Record<string, unknown>
    : {};
  const landingPath = typeof attribution.landingPath === 'string' ? attribution.landingPath.trim() : '';
  return /^\/(?!\/)[A-Za-z0-9._~/%-]{0,299}$/u.test(landingPath)
    ? `https://likvidacia-eternitu.sk${landingPath}`
    : 'https://likvidacia-eternitu.sk/';
}

function buildMetaCapiOutboxRecord(lead: Lead, submissionId: string, timestamp: string): MetaCapiOutboxRecord | undefined {
  const consentSubject = lead.rawData?.marketingConsentSubjectAtSubmit;
  const conversion = createAcceptedLeadConversion(submissionId, lead.materialType);
  if (!validMetaCapiConsentSubject(consentSubject) || !conversion) return undefined;
  return {
    id: randomUUID(),
    leadId: lead.id,
    eventId: conversion.eventId,
    consentSubject,
    eventTime: lead.createdAt,
    eventSourceUrl: metaCapiEventSourceUrl(lead.rawData),
    material: conversion.material,
    status: 'pending',
    attempts: 0,
    maxAttempts: 6,
    retryable: true,
    nextAttemptAt: timestamp,
    lastErrorCode: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function createLeadSubmission(
  input: LeadInput & { submissionId: string; submissionHash: string },
  uploadedFiles: Omit<LeadFile, 'id' | 'createdAt'>[],
): Promise<LeadSubmissionResult> {
  await ensureSchema();
  const db = getPool();
  const timestamp = now();
  const settings = await getBusinessSettings();
  const directDraftKeys = uploadedFiles
    .filter((file) => file.storageDriver !== 'local' && file.storageKey.startsWith('lead-drafts/'))
    .map((file) => file.storageKey);

  if (!db) {
    if (directDraftKeys.length) throw new Error('Prednahrávané prílohy nemožno pripojiť bez databázy PostgreSQL.');
    return withLocalLeadSubmissionLock(async () => {
    const local = await readLocalDb();
    const previous = local.leads.find((item) => item.submissionId === input.submissionId);
    if (previous) {
      if (previous.rawData?.submissionFingerprintHash !== input.submissionHash) throw new LeadSubmissionConflictError();
      const businessJob = local.businessJobs.find((item) => item.leadId === previous.id);
      if (!businessJob) throw new Error('Uložený dopyt nemá priradenú zákazku.');
      return {
        lead: previous,
        businessJobId: businessJob.id,
        files: local.leadFiles.filter((item) => item.leadId === previous.id),
        duplicate: true,
      };
    }

    const consentSubject = requestedMetaCapiConsentSubject(input.rawData);
    const consentRevoked = Boolean(consentSubject && local.metaCapiConsentRevocations.some((item) => item.consentSubject === consentSubject));
    const storedRawData = consentRevoked ? neutralizedMarketingRawData(input.rawData) : input.rawData;
    const leadId = randomUUID();
    const lead: Lead = {
      ...input,
      id: leadId,
      status: 'novy',
      internalNote: '',
      district: input.district ?? '',
      roofer: input.roofer ?? '',
      term: input.term ?? '',
      note: input.note ?? '',
      source: input.source ?? 'web',
      preferredContact: input.preferredContact ?? 'Zavolajte mi',
      wantsRooferRecommendation: Boolean(input.wantsRooferRecommendation),
      selectedRooferId: input.selectedRooferId ?? '',
      ownerEmail: '',
      nextAction: '',
      rawData: { ...(storedRawData ?? {}), submissionFingerprintHash: input.submissionHash },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const businessJob = enrichBusinessJob({
      id: randomUUID(),
      lead_id: lead.id,
      created_at: timestamp,
      updated_at: timestamp,
      demolition_date: timestamp.slice(0, 10),
      customer_name: lead.fullName,
      customer_phone: lead.phone,
      customer_email: lead.email,
      location: lead.city,
      district: lead.district,
      material_type: lead.materialType,
      object_type: lead.objectType,
      term: lead.term,
      lead_source: lead.source || 'likvidacia-eternitu.sk',
      preferovany_kontakt: lead.preferredContact,
      m2: lead.areaEstimate,
      price_per_m2: settings.defaultPricePerM2,
      total_price: money(lead.areaEstimate * settings.defaultPricePerM2),
      payment_type: 'FAKTURA',
      work_type: 'DEMONTAZ_A_ODVOZ',
      waste_kg: 0,
      landfill: 'INA',
      status: 'DOPYT',
      note: lead.note,
    });
    businessJob.costs.jobId = businessJob.id;
    const files = uploadedFiles.map((file) => ({ ...file, leadId, id: randomUUID(), createdAt: timestamp }));
    const outbox = (['customer', 'internal'] as const).map((recipientRole): LeadEmailOutbox => ({
      id: randomUUID(),
      leadId,
      recipientRole,
      dedupeKey: `lead:${input.submissionId}:${recipientRole}`,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: timestamp,
      messageId: '',
      lastError: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    const metaOutbox = lead.rawData?.marketingConsentAtSubmit === true && validMetaCapiConsentSubject(lead.rawData?.marketingConsentSubjectAtSubmit)
      ? buildMetaCapiOutboxRecord(lead, input.submissionId, timestamp)
      : undefined;
    const auditLogs: AuditLog[] = [
      { id: randomUUID(), entityType: 'lead', entityId: leadId, action: 'lead_created', actorEmail: 'system', changes: { status: 'novy' }, createdAt: timestamp },
      { id: randomUUID(), entityType: 'business_job', entityId: businessJob.id, action: 'business_job_created', actorEmail: 'system', changes: { status: businessJob.status, leadId }, createdAt: timestamp },
      { id: randomUUID(), entityType: 'business_job', entityId: businessJob.id, action: 'business_job_lead_received', actorEmail: 'system', changes: { leadId }, createdAt: timestamp },
      ...(files.length ? [{ id: randomUUID(), entityType: 'lead' as const, entityId: leadId, action: 'files_uploaded', actorEmail: 'system', changes: { count: files.length }, createdAt: timestamp }] : []),
      ...(metaOutbox ? [{ id: randomUUID(), entityType: 'system' as const, entityId: metaOutbox.id, action: 'meta_capi_queued', actorEmail: 'system', changes: { status: 'pending' }, createdAt: timestamp }] : []),
    ];
    local.leads.unshift(lead);
    local.businessJobs.unshift(businessJob);
    local.leadFiles.unshift(...files);
    local.leadEmailOutbox.unshift(...outbox);
    if (metaOutbox) local.metaCapiOutbox.unshift(metaOutbox);
    local.auditLogs.unshift(...auditLogs);
    await writeLocalDb(local);
    return { lead, businessJobId: businessJob.id, files, duplicate: false };
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const consentSubject = requestedMetaCapiConsentSubject(input.rawData);
    let storedRawData = { ...(input.rawData ?? {}) };
    if (consentSubject) {
      await client.query(
        `INSERT INTO lead_meta_capi_consent_subjects (consent_subject, created_at, updated_at)
         VALUES ($1,$2,$2) ON CONFLICT (consent_subject) DO NOTHING`,
        [consentSubject, timestamp],
      );
      const consentState = await client.query(
        'SELECT revoked_at FROM lead_meta_capi_consent_subjects WHERE consent_subject=$1 FOR UPDATE',
        [consentSubject],
      );
      if (consentState.rows[0]?.revoked_at) storedRawData = neutralizedMarketingRawData(storedRawData);
    }
    const leadId = randomUUID();
    const jobId = randomUUID();
    const insertLead = await client.query(
      `INSERT INTO leads (
        id, submission_id, submission_hash, created_at, updated_at, status, full_name, phone, email, city, district,
        object_type, material_type, area_estimate, preferovany_kontakt, roofer, term, note, gdpr, source,
        internal_note, raw_data, wants_roofer_recommendation, selected_roofer_id
      ) VALUES ($1,$2,$3,$4,$5,'novy',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      ON CONFLICT (submission_id) DO NOTHING RETURNING *`,
      [
        leadId, input.submissionId, input.submissionHash, timestamp, timestamp, input.fullName, input.phone, input.email,
        input.city, input.district ?? '', input.objectType, input.materialType, input.areaEstimate,
        input.preferredContact ?? 'Zavolajte mi', input.roofer ?? '', input.term ?? '', input.note ?? '', input.gdpr,
        input.source ?? 'web', '', { ...storedRawData, submissionFingerprintHash: input.submissionHash },
        Boolean(input.wantsRooferRecommendation), input.selectedRooferId ?? '',
      ],
    );

    if (!insertLead.rows[0]) {
      const existing = await client.query('SELECT * FROM leads WHERE submission_id = $1 FOR UPDATE', [input.submissionId]);
      const row = existing.rows[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error('Dopyt sa nepodarilo overiť po opakovanom odoslaní.');
      if (String(row.submission_hash ?? '') !== input.submissionHash) throw new LeadSubmissionConflictError();
      const existingJob = await client.query('SELECT id FROM business_jobs WHERE lead_id = $1 LIMIT 1', [String(row.id)]);
      if (!existingJob.rows[0]) throw new Error('Uložený dopyt nemá priradenú zákazku.');
      const existingFiles = await client.query('SELECT * FROM lead_files WHERE lead_id = $1 ORDER BY created_at', [String(row.id)]);
      await client.query('COMMIT');
      return {
        lead: toLead(row),
        businessJobId: String(existingJob.rows[0].id),
        files: existingFiles.rows.map((item) => toLeadFile(item)),
        duplicate: true,
      };
    }

    if (directDraftKeys.length) {
      const drafts = await client.query(
        `SELECT storage_key, submission_id, storage_driver, status FROM lead_upload_drafts
         WHERE storage_key = ANY($1::text[]) ORDER BY storage_key FOR UPDATE`,
        [directDraftKeys],
      );
      const validDrafts = drafts.rows.length === directDraftKeys.length
        && drafts.rows.every((draft) => {
          const attachment = uploadedFiles.find((file) => file.storageKey === String(draft.storage_key));
          return String(draft.submission_id) === input.submissionId
            && attachment?.storageDriver === String(draft.storage_driver)
            && draft.status === 'uploaded';
        });
      if (!validDrafts) throw new Error('Niektorú fotografiu sa nepodarilo bezpečne priradiť k tomuto dopytu. Vyberte ju prosím znova.');
    }

    const lead = toLead(insertLead.rows[0]);
    const jobValues = [
      jobId, lead.id, timestamp, timestamp, timestamp.slice(0, 10), lead.fullName, lead.phone, lead.email,
      lead.city, lead.district ?? '', lead.materialType, lead.objectType, lead.term ?? '', lead.source || 'likvidacia-eternitu.sk',
      lead.preferredContact ?? 'Zavolajte mi', lead.areaEstimate, settings.defaultPricePerM2,
      money(lead.areaEstimate * settings.defaultPricePerM2), 'FAKTURA', 'DEMONTAZ_A_ODVOZ', 0, 'INA', 'DOPYT', lead.note ?? '',
    ];
    await client.query(
      `INSERT INTO business_jobs (
        id, lead_id, created_at, updated_at, demolition_date, customer_name, customer_phone, customer_email, location, district,
        material_type, object_type, term, lead_source, preferovany_kontakt, m2, price_per_m2, total_price, payment_type,
        work_type, waste_kg, landfill, status, note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
      jobValues,
    );
    await client.query(
      `INSERT INTO business_job_costs (job_id, fuel, suits, gloves, penetrant, landfill_cost, other_name, other_amount, total)
       VALUES ($1,0,0,0,0,0,'',0,0)`,
      [jobId],
    );

    const files: LeadFile[] = [];
    for (const file of uploadedFiles) {
      const stored = { ...file, leadId: lead.id, id: randomUUID(), createdAt: timestamp };
      await client.query(
        `INSERT INTO lead_files (id, lead_id, original_name, storage_driver, storage_key, mime_type, size_bytes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [stored.id, stored.leadId, stored.originalName, stored.storageDriver, stored.storageKey, stored.mimeType, stored.sizeBytes, stored.createdAt],
      );
      files.push(stored);
    }

    if (directDraftKeys.length) {
      const attached = await client.query(
        `UPDATE lead_upload_drafts SET status = 'attached', lead_id = $2, attached_at = $3, updated_at = $3
         WHERE submission_id = $1 AND storage_key = ANY($4::text[]) AND status = 'uploaded'
         RETURNING storage_key`,
        [input.submissionId, lead.id, timestamp, directDraftKeys],
      );
      if (attached.rows.length !== directDraftKeys.length) {
        throw new Error('Prílohy sa nepodarilo pripojiť k dopytu.');
      }
    }

    await client.query(
      `UPDATE lead_upload_drafts SET status = 'superseded', updated_at = $2
       WHERE submission_id = $1 AND status IN ('uploading', 'uploaded')
         AND NOT (storage_key = ANY($3::text[]))`,
      [input.submissionId, timestamp, directDraftKeys],
    );

    const metaOutbox = lead.rawData?.marketingConsentAtSubmit === true && validMetaCapiConsentSubject(lead.rawData?.marketingConsentSubjectAtSubmit)
      ? buildMetaCapiOutboxRecord(lead, input.submissionId, timestamp)
      : undefined;
    const auditRows = [
      ['lead', lead.id, 'lead_created', { status: 'novy' }],
      ['business_job', jobId, 'business_job_created', { status: 'DOPYT', leadId: lead.id }],
      ['business_job', jobId, 'business_job_lead_received', { leadId: lead.id }],
      ...(files.length ? [['lead', lead.id, 'files_uploaded', { count: files.length }]] : []),
      ...(metaOutbox ? [['system', metaOutbox.id, 'meta_capi_queued', { status: 'pending' }]] : []),
    ] as const;
    for (const [entityType, entityId, action, changes] of auditRows) {
      await client.query(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
         VALUES ($1,$2,$3,$4,'system',$5,$6)`,
        [randomUUID(), entityType, entityId, action, changes, timestamp],
      );
    }
    for (const recipientRole of ['customer', 'internal'] as const) {
      await client.query(
        `INSERT INTO lead_email_outbox (id, lead_id, recipient_role, dedupe_key, status, attempts, next_attempt_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'pending',0,$5,$5,$5)`,
        [randomUUID(), lead.id, recipientRole, `lead:${input.submissionId}:${recipientRole}`, timestamp],
      );
    }
    if (metaOutbox) {
      await client.query(
        `INSERT INTO lead_meta_capi_outbox (
          id, lead_id, event_id, consent_subject, event_time, event_source_url, material, status, attempts,
          max_attempts, retryable, next_attempt_at, last_error_code, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',0,$8,true,$9,'',$9,$9)`,
        [metaOutbox.id, lead.id, metaOutbox.eventId, metaOutbox.consentSubject, lead.createdAt, metaOutbox.eventSourceUrl, metaOutbox.material, metaOutbox.maxAttempts, timestamp],
      );
    }

    await client.query('COMMIT');
    return { lead, businessJobId: jobId, files, duplicate: false };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const metaCapiClaimDurationMs = 5 * 60_000;

function metaCapiRetryAt(at: Date, attempts: number) {
  const delay = Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 60 * 60_000);
  return new Date(at.getTime() + delay).toISOString();
}

function metaCapiClaim(record: MetaCapiOutboxRecord): MetaCapiOutboxClaim {
  return {
    id: record.id,
    leadId: record.leadId,
    eventId: record.eventId,
    eventTime: record.eventTime,
    eventSourceUrl: record.eventSourceUrl,
    material: record.material,
    attempt: record.attempts,
    claimId: record.claimId || '',
  };
}

function neutralizedMarketingRawData(rawData: Record<string, unknown> | undefined) {
  const next = { ...(rawData ?? {}) };
  delete next.marketingConsentAtSubmit;
  delete next.marketingConsentSubjectAtSubmit;
  if (next.attribution && typeof next.attribution === 'object') {
    const attribution = { ...(next.attribution as Record<string, unknown>) };
    delete attribution.fbclid;
    delete attribution.gclid;
    delete attribution.gbraid;
    delete attribution.wbraid;
    next.attribution = attribution;
  }
  return next;
}

function safeMetaCapiOutcome(outcome: MetaCapiDeliveryOutcome): MetaCapiDeliveryOutcome {
  const allowedCodes = new Set(['provider_rejected', 'provider_unavailable', 'transport_unknown', 'invalid_event']);
  const providerCode = typeof outcome.errorCode === 'string' && /^meta_(?:rejected|unavailable)_\d{1,10}(?:_\d{1,10})?$/.test(outcome.errorCode)
    ? outcome.errorCode
    : undefined;
  return {
    status: ['sent', 'failed', 'unknown'].includes(outcome.status) ? outcome.status : 'unknown',
    httpStatus: Number.isInteger(outcome.httpStatus) && Number(outcome.httpStatus) >= 100 && Number(outcome.httpStatus) <= 599
      ? Number(outcome.httpStatus)
      : undefined,
    retryable: Boolean(outcome.retryable),
    errorCode: outcome.errorCode && allowedCodes.has(outcome.errorCode) ? outcome.errorCode : providerCode,
  };
}

export async function claimMetaCapiOutboxEvents(limit = 10, at = new Date()): Promise<MetaCapiOutboxClaim[]> {
  await ensureSchema();
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 25);
  const timestamp = at.toISOString();
  const claimedUntil = new Date(at.getTime() + metaCapiClaimDurationMs).toISOString();
  const claimId = randomUUID();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      let changed = false;
      for (const record of local.metaCapiOutbox) {
        const lead = local.leads.find((item) => item.id === record.leadId);
        if (['sent', 'cancelled'].includes(record.status) || record.consentRevokedAt) continue;
        if (!lead || lead.deletedAt || lead.rawData?.marketingConsentAtSubmit !== true
          || !record.consentSubject || lead.rawData?.marketingConsentSubjectAtSubmit !== record.consentSubject) {
          record.status = 'cancelled';
          record.retryable = false;
          record.claimId = undefined;
          record.claimedUntil = undefined;
          record.lastErrorCode = 'consent_unavailable';
          record.consentRevokedAt = timestamp;
          record.updatedAt = timestamp;
          local.auditLogs.unshift({ id: randomUUID(), entityType: 'system', entityId: record.id, action: 'meta_capi_cancelled', actorEmail: 'meta-capi-cron', changes: { status: 'cancelled', reason: 'consent_unavailable' }, createdAt: timestamp });
          changed = true;
        }
      }
      const candidates = local.metaCapiOutbox
        .filter((record) => {
          if (record.attempts >= record.maxAttempts || record.consentRevokedAt) return false;
          const due = record.nextAttemptAt <= timestamp;
          const abandoned = record.status === 'sending' && (!record.claimedUntil || record.claimedUntil <= timestamp);
          return abandoned || (due && (record.status === 'pending' || ((record.status === 'failed' || record.status === 'unknown') && record.retryable)));
        })
        .sort((left, right) => left.nextAttemptAt.localeCompare(right.nextAttemptAt) || left.id.localeCompare(right.id))
        .slice(0, boundedLimit);
      for (const record of candidates) {
        const reclaimed = record.status === 'sending';
        if (reclaimed) local.auditLogs.unshift({ id: randomUUID(), entityType: 'system', entityId: record.id, action: 'meta_capi_unknown', actorEmail: 'meta-capi-cron', changes: { status: 'unknown', reason: 'claim_expired', attempt: record.attempts }, createdAt: timestamp });
        record.status = 'sending';
        record.attempts += 1;
        record.retryable = false;
        record.claimId = claimId;
        record.claimedUntil = claimedUntil;
        record.updatedAt = timestamp;
        local.auditLogs.unshift({ id: randomUUID(), entityType: 'system', entityId: record.id, action: 'meta_capi_claimed', actorEmail: 'meta-capi-cron', changes: { status: 'sending', attempt: record.attempts, reclaimed }, createdAt: timestamp });
        changed = true;
      }
      if (changed) await writeLocalDb(local);
      return candidates.map(metaCapiClaim);
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const cancelled = await client.query(
      `UPDATE lead_meta_capi_outbox outbox
       SET status='cancelled', retryable=false, claim_id=NULL, claimed_until=NULL,
           last_error_code='consent_unavailable', consent_revoked_at=COALESCE(consent_revoked_at,$1), updated_at=$1
       FROM leads
       WHERE leads.id=outbox.lead_id AND outbox.status NOT IN ('sent','cancelled')
         AND (leads.deleted_at IS NOT NULL
           OR leads.raw_data->>'marketingConsentAtSubmit' IS DISTINCT FROM 'true'
           OR outbox.consent_subject IS NULL
           OR leads.raw_data->>'marketingConsentSubjectAtSubmit' IS DISTINCT FROM outbox.consent_subject::text)
       RETURNING outbox.id`,
      [timestamp],
    );
    for (const row of cancelled.rows) await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'system',$2,'meta_capi_cancelled','meta-capi-cron',$3,$4)`,
      [randomUUID(), row.id, { status: 'cancelled', reason: 'consent_unavailable' }, timestamp],
    );
    const claimed = await client.query(
      `WITH candidates AS (
         SELECT outbox.id, outbox.status='sending' AS reclaimed
         FROM lead_meta_capi_outbox outbox
         INNER JOIN leads ON leads.id=outbox.lead_id
         WHERE outbox.consent_revoked_at IS NULL AND leads.deleted_at IS NULL
           AND leads.raw_data->>'marketingConsentAtSubmit'='true'
           AND outbox.consent_subject IS NOT NULL
           AND leads.raw_data->>'marketingConsentSubjectAtSubmit'=outbox.consent_subject::text
           AND outbox.attempts < outbox.max_attempts
           AND (
             (outbox.status='pending' AND outbox.next_attempt_at <= $1)
             OR (outbox.status IN ('failed','unknown') AND outbox.retryable=true AND outbox.next_attempt_at <= $1)
             OR (outbox.status='sending' AND (outbox.claimed_until IS NULL OR outbox.claimed_until <= $1))
           )
         ORDER BY outbox.next_attempt_at, outbox.created_at, outbox.id
         FOR UPDATE OF outbox SKIP LOCKED
         LIMIT $2
       )
       UPDATE lead_meta_capi_outbox outbox
       SET status='sending', attempts=outbox.attempts+1, retryable=false,
           claim_id=$3, claimed_until=$4, updated_at=$1
       FROM candidates
       WHERE outbox.id=candidates.id
       RETURNING outbox.*, candidates.reclaimed`,
      [timestamp, boundedLimit, claimId, claimedUntil],
    );
    for (const row of claimed.rows) {
      if (row.reclaimed) await client.query(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
         VALUES ($1,'system',$2,'meta_capi_unknown','meta-capi-cron',$3,$4)`,
        [randomUUID(), row.id, { status: 'unknown', reason: 'claim_expired', attempt: Number(row.attempts) - 1 }, timestamp],
      );
      await client.query(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
         VALUES ($1,'system',$2,'meta_capi_claimed','meta-capi-cron',$3,$4)`,
        [randomUUID(), row.id, { status: 'sending', attempt: Number(row.attempts), reclaimed: Boolean(row.reclaimed) }, timestamp],
      );
    }
    await client.query('COMMIT');
    return claimed.rows.map((row) => ({
      id: String(row.id), leadId: String(row.lead_id), eventId: String(row.event_id),
      eventTime: new Date(String(row.event_time)).toISOString(), eventSourceUrl: String(row.event_source_url),
      material: String(row.material) as MetaCapiOutboxClaim['material'], attempt: Number(row.attempts), claimId: String(row.claim_id),
    }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function prepareClaimedMetaCapiEvent(
  claim: MetaCapiOutboxClaim,
  at = new Date(),
): Promise<MetaCapiDispatchInput | null> {
  await ensureSchema();
  const timestamp = at.toISOString();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const record = local.metaCapiOutbox.find((item) => item.id === claim.id && item.status === 'sending' && item.claimId === claim.claimId);
      const lead = record ? local.leads.find((item) => item.id === record.leadId) : undefined;
      if (!record || !lead || lead.deletedAt || lead.rawData?.marketingConsentAtSubmit !== true || record.consentRevokedAt
        || !record.consentSubject || lead.rawData?.marketingConsentSubjectAtSubmit !== record.consentSubject) {
        if (record) {
          record.status = 'cancelled'; record.retryable = false; record.claimId = undefined; record.claimedUntil = undefined;
          record.lastErrorCode = 'consent_unavailable'; record.consentRevokedAt = timestamp; record.updatedAt = timestamp;
          local.auditLogs.unshift({ id: randomUUID(), entityType: 'system', entityId: record.id, action: 'meta_capi_cancelled', actorEmail: 'meta-capi-cron', changes: { status: 'cancelled', reason: 'consent_unavailable' }, createdAt: timestamp });
          await writeLocalDb(local);
        }
        return null;
      }
      return {
        ...claim,
        email: lead.email,
        phone: lead.phone,
        clientUserAgent: typeof lead.rawData?.userAgent === 'string' ? lead.rawData.userAgent : undefined,
      };
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT outbox.*, leads.email, leads.phone, leads.raw_data, leads.deleted_at
       FROM lead_meta_capi_outbox outbox
       INNER JOIN leads ON leads.id=outbox.lead_id
       WHERE outbox.id=$1 AND outbox.status='sending' AND outbox.claim_id=$2
       FOR UPDATE OF outbox, leads`,
      [claim.id, claim.claimId],
    );
    const row = locked.rows[0];
    if (!row) { await client.query('ROLLBACK'); return null; }
    if (row.deleted_at || row.consent_revoked_at || row.raw_data?.marketingConsentAtSubmit !== true
      || !row.consent_subject || row.raw_data?.marketingConsentSubjectAtSubmit !== String(row.consent_subject)) {
      await client.query(
        `UPDATE lead_meta_capi_outbox SET status='cancelled', retryable=false, claim_id=NULL, claimed_until=NULL,
         last_error_code='consent_unavailable', consent_revoked_at=COALESCE(consent_revoked_at,$2), updated_at=$2 WHERE id=$1`,
        [claim.id, timestamp],
      );
      await client.query(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
         VALUES ($1,'system',$2,'meta_capi_cancelled','meta-capi-cron',$3,$4)`,
        [randomUUID(), claim.id, { status: 'cancelled', reason: 'consent_unavailable' }, timestamp],
      );
      await client.query('COMMIT');
      return null;
    }
    const input: MetaCapiDispatchInput = {
        ...claim,
        email: String(row.email),
        phone: String(row.phone),
        clientUserAgent: typeof row.raw_data?.userAgent === 'string' ? row.raw_data.userAgent : undefined,
    };
    await client.query('COMMIT');
    return input;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function settleClaimedMetaCapiEvent(
  claim: MetaCapiOutboxClaim,
  rawOutcome: MetaCapiDeliveryOutcome,
  at = new Date(),
): Promise<MetaCapiOutboxStatus | null> {
  await ensureSchema();
  const timestamp = at.toISOString();
  const outcome = safeMetaCapiOutcome(rawOutcome);
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const record = local.metaCapiOutbox.find((item) => item.id === claim.id && item.status === 'sending' && item.claimId === claim.claimId);
      if (!record) return null;
      const exhausted = record.attempts >= record.maxAttempts;
      record.status = outcome.status;
      record.retryable = outcome.status !== 'sent' && outcome.retryable && !exhausted;
      record.nextAttemptAt = record.retryable ? metaCapiRetryAt(at, record.attempts) : record.nextAttemptAt;
      record.claimId = undefined;
      record.claimedUntil = undefined;
      record.lastHttpStatus = outcome.httpStatus;
      record.lastErrorCode = outcome.status === 'sent' ? '' : exhausted ? 'retry_limit_reached' : outcome.errorCode || 'provider_unavailable';
      record.updatedAt = timestamp;
      if (outcome.status === 'sent') record.sentAt = timestamp;
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'system', entityId: record.id, action: `meta_capi_${outcome.status}`, actorEmail: 'meta-capi-cron', changes: { status: outcome.status, attempt: record.attempts, httpStatus: outcome.httpStatus ?? null, retryable: record.retryable, errorCode: record.lastErrorCode || null }, createdAt: timestamp });
      await writeLocalDb(local);
      return record.status;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT attempts, max_attempts
       FROM lead_meta_capi_outbox
       WHERE id=$1 AND status='sending' AND claim_id=$2
       FOR UPDATE`,
      [claim.id, claim.claimId],
    );
    const row = locked.rows[0];
    if (!row) { await client.query('ROLLBACK'); return null; }
    const attempts = Number(row.attempts);
    const exhausted = attempts >= Number(row.max_attempts);
    const retryable = outcome.status !== 'sent' && outcome.retryable && !exhausted;
    const errorCode = outcome.status === 'sent' ? '' : exhausted ? 'retry_limit_reached' : outcome.errorCode || 'provider_unavailable';
    const nextAttemptAt = retryable ? metaCapiRetryAt(at, attempts) : null;
    await client.query(
      `UPDATE lead_meta_capi_outbox
       SET status=$3, retryable=$4, next_attempt_at=COALESCE($5,next_attempt_at), claim_id=NULL, claimed_until=NULL,
           last_http_status=$6, last_error_code=$7, updated_at=$8,
           sent_at=CASE WHEN $3='sent' THEN $8 ELSE sent_at END
       WHERE id=$1 AND claim_id=$2`,
      [claim.id, claim.claimId, outcome.status, retryable, nextAttemptAt, outcome.httpStatus ?? null, errorCode, timestamp],
    );
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'system',$2,$3,'meta-capi-cron',$4,$5)`,
      [randomUUID(), claim.id, `meta_capi_${outcome.status}`, { status: outcome.status, attempt: attempts, httpStatus: outcome.httpStatus ?? null, retryable, errorCode: errorCode || null }, timestamp],
    );
    await client.query('COMMIT');
    return outcome.status;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeMetaCapiConsentForLead(leadId: string, actor = 'consent-revocation', at = new Date()) {
  await ensureSchema();
  const timestamp = at.toISOString();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const lead = local.leads.find((item) => item.id === leadId);
      if (!lead) return 0;
      lead.rawData = neutralizedMarketingRawData(lead.rawData);
      delete lead.rawData.marketingConsentSubjectAtSubmit;
      lead.updatedAt = timestamp;
      const records = local.metaCapiOutbox.filter((item) => item.leadId === leadId);
      for (const record of records) {
        const previousStatus = record.status;
        record.consentRevokedAt = timestamp;
        if (record.status === 'sending') record.status = 'unknown';
        else if (record.status !== 'sent') record.status = 'cancelled';
        record.retryable = false; record.claimId = undefined; record.claimedUntil = undefined;
        record.lastErrorCode = 'consent_revoked'; record.updatedAt = timestamp;
        local.auditLogs.unshift({ id: randomUUID(), entityType: 'system', entityId: record.id, action: 'meta_capi_consent_revoked', actorEmail: actor, changes: { previousStatus, status: record.status }, createdAt: timestamp });
      }
      await writeLocalDb(local);
      return records.length;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const lead = await client.query('SELECT id FROM leads WHERE id=$1 FOR UPDATE', [leadId]);
    if (!lead.rowCount) { await client.query('ROLLBACK'); return 0; }
    await client.query(
      `UPDATE leads SET raw_data=jsonb_set(
         raw_data - 'marketingConsentAtSubmit' - 'marketingConsentSubjectAtSubmit', '{attribution}',
         COALESCE(raw_data->'attribution','{}'::jsonb) - 'fbclid' - 'gclid' - 'gbraid' - 'wbraid', true
       ), updated_at=$2 WHERE id=$1`,
      [leadId, timestamp],
    );
    const before = await client.query('SELECT id, status FROM lead_meta_capi_outbox WHERE lead_id=$1 FOR UPDATE', [leadId]);
    await client.query(
      `UPDATE lead_meta_capi_outbox
       SET status=CASE WHEN status='sent' THEN status WHEN status='sending' THEN 'unknown' ELSE 'cancelled' END, retryable=false,
           claim_id=NULL, claimed_until=NULL, last_error_code='consent_revoked', consent_revoked_at=$2, updated_at=$2
       WHERE lead_id=$1`,
      [leadId, timestamp],
    );
    for (const row of before.rows) await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'system',$2,'meta_capi_consent_revoked',$3,$4,$5)`,
      [randomUUID(), row.id, actor, { previousStatus: row.status, status: row.status === 'sent' ? 'sent' : row.status === 'sending' ? 'unknown' : 'cancelled' }, timestamp],
    );
    await client.query('COMMIT');
    return before.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeMetaCapiOutboxForConsentSubject(consentSubject: string, at = new Date()) {
  if (!validMetaCapiConsentSubject(consentSubject)) return 0;
  await ensureSchema();
  const timestamp = at.toISOString();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const existingRevocation = local.metaCapiConsentRevocations.find((item) => item.consentSubject === consentSubject);
      if (existingRevocation) existingRevocation.revokedAt = existingRevocation.revokedAt || timestamp;
      else local.metaCapiConsentRevocations.push({ consentSubject, revokedAt: timestamp });
      const leads = local.leads.filter((item) => item.rawData?.marketingConsentSubjectAtSubmit === consentSubject);
      const records = local.metaCapiOutbox.filter((item) => item.consentSubject === consentSubject);
      const affectedLeadIds = new Set([...leads.map((item) => item.id), ...records.map((item) => item.leadId)]);
      for (const lead of leads) {
        lead.rawData = neutralizedMarketingRawData(lead.rawData);
        lead.updatedAt = timestamp;
        local.auditLogs.unshift({ id: randomUUID(), entityType: 'lead', entityId: lead.id, action: 'marketing_consent_revoked', actorEmail: 'consent-revocation', changes: { marketingDataCleared: true }, createdAt: timestamp });
      }
      for (const record of records) {
        const previousStatus = record.status;
        record.status = record.status === 'sent' ? 'sent' : record.status === 'sending' ? 'unknown' : 'cancelled';
        record.retryable = false;
        record.claimId = undefined;
        record.claimedUntil = undefined;
        record.lastErrorCode = 'consent_revoked';
        record.consentRevokedAt = timestamp;
        record.updatedAt = timestamp;
        local.auditLogs.unshift({ id: randomUUID(), entityType: 'system', entityId: record.id, action: 'meta_capi_consent_revoked', actorEmail: 'consent-revocation', changes: { previousStatus, status: record.status }, createdAt: timestamp });
      }
      await writeLocalDb(local);
      return affectedLeadIds.size;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO lead_meta_capi_consent_subjects (consent_subject, revoked_at, created_at, updated_at)
       VALUES ($1,$2,$2,$2)
       ON CONFLICT (consent_subject) DO UPDATE
       SET revoked_at=COALESCE(lead_meta_capi_consent_subjects.revoked_at, EXCLUDED.revoked_at), updated_at=EXCLUDED.updated_at`,
      [consentSubject, timestamp],
    );
    const matchingLeads = await client.query(
      `SELECT id FROM leads
       WHERE raw_data->>'marketingConsentSubjectAtSubmit'=$1
       FOR UPDATE`,
      [consentSubject],
    );
    const before = await client.query(
      `SELECT id, lead_id, status FROM lead_meta_capi_outbox
       WHERE consent_subject=$1 FOR UPDATE`,
      [consentSubject],
    );
    await client.query(
      `UPDATE leads SET raw_data=jsonb_set(
         (raw_data - 'marketingConsentAtSubmit' - 'marketingConsentSubjectAtSubmit'), '{attribution}',
         COALESCE(raw_data->'attribution','{}'::jsonb) - 'fbclid' - 'gclid' - 'gbraid' - 'wbraid', true
       ), updated_at=$2 WHERE raw_data->>'marketingConsentSubjectAtSubmit'=$1`,
      [consentSubject, timestamp],
    );
    await client.query(
      `UPDATE lead_meta_capi_outbox
       SET status=CASE WHEN status='sent' THEN status WHEN status='sending' THEN 'unknown' ELSE 'cancelled' END, retryable=false, claim_id=NULL, claimed_until=NULL,
           last_error_code='consent_revoked', consent_revoked_at=$2, updated_at=$2
       WHERE consent_subject=$1`,
      [consentSubject, timestamp],
    );
    for (const row of matchingLeads.rows) await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'lead',$2,'marketing_consent_revoked','consent-revocation',$3,$4)`,
      [randomUUID(), row.id, { marketingDataCleared: true }, timestamp],
    );
    for (const row of before.rows) await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'system',$2,'meta_capi_consent_revoked','consent-revocation',$3,$4)`,
      [randomUUID(), row.id, { previousStatus: row.status, status: row.status === 'sent' ? 'sent' : row.status === 'sending' ? 'unknown' : 'cancelled' }, timestamp],
    );
    await client.query('COMMIT');
    return new Set([
      ...matchingLeads.rows.map((row) => String(row.id)),
      ...before.rows.map((row) => String(row.lead_id)),
    ]).size;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getMetaCapiOutboxHealth(): Promise<MetaCapiOutboxSummary> {
  await ensureSchema();
  const empty: MetaCapiOutboxSummary = { pending: 0, sending: 0, sent: 0, failed: 0, unknown: 0, cancelled: 0 };
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    for (const item of local.metaCapiOutbox) empty[item.status] += 1;
    return empty;
  }
  const { rows } = await db.query('SELECT status, count(*)::int AS count FROM lead_meta_capi_outbox GROUP BY status');
  for (const row of rows) if (row.status in empty) empty[row.status as keyof MetaCapiOutboxSummary] = Number(row.count);
  return empty;
}

export async function claimLeadEmailOutbox(leadId: string, recipientRole?: 'customer' | 'internal') {
  await ensureSchema();
  const db = getPool();
  const lockedAt = now();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      if (!local.leads.some((lead) => lead.id === leadId && !lead.deletedAt)) return false;
      const claimable = (item: LeadEmailOutbox) => (item.status === 'pending' || (item.status === 'failed' && item.retryable === true && item.attempts < 3)) && item.nextAttemptAt <= lockedAt;
      const rows = local.leadEmailOutbox.filter((item) => item.leadId === leadId && claimable(item) && (!recipientRole || item.recipientRole === recipientRole));
      if (recipientRole ? rows.length !== 1 : rows.length !== 2) return false;
      for (const row of rows) {
        row.status = 'sending';
        row.retryable = false;
        row.attempts += 1;
        row.lockedAt = lockedAt;
        row.updatedAt = lockedAt;
      }
      await writeLocalDb(local);
      return lockedAt;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const activeLead = await client.query('SELECT id FROM leads WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [leadId]);
    if (activeLead.rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    const { rows } = await client.query(
      `UPDATE lead_email_outbox SET status = 'sending', retryable = false, locked_at = $3, attempts = attempts + 1, updated_at = $3
       WHERE lead_id = $1 AND ((status = 'pending') OR (status = 'failed' AND retryable = true AND attempts < 3 AND next_attempt_at <= $3))
         AND next_attempt_at <= $3 AND ($2::text IS NULL OR recipient_role = $2) RETURNING id`,
      [leadId, recipientRole || null, lockedAt],
    );
    if (rows.length !== (recipientRole ? 1 : 2)) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('COMMIT');
    return lockedAt;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function safeLeadEmailMessageId(messageId: string | undefined) {
  const secret = process.env.AUTH_SECRET?.trim();
  return messageId && secret ? `hmac-sha256:${createHmac('sha256', secret).update(messageId, 'utf8').digest('hex')}` : '';
}

function safeLeadEmailFailureReason(status: 'sent' | 'failed' | 'unknown') {
  if (status === 'sent') return '';
  if (status === 'unknown') return 'Výsledok odoslania nie je potvrdený; pred opakovaním treba preveriť doručenie.';
  return 'Odoslanie zlyhalo.';
}

export async function recordLeadEmailOutboxResult(
  leadId: string,
  result: { customerSent: boolean; adminSent: boolean; customerStatus?: 'sent' | 'failed' | 'unknown'; adminStatus?: 'sent' | 'failed' | 'unknown'; customerMessageId?: string; adminMessageId?: string; customerReason?: string; adminReason?: string; reason?: string },
  attemptLockedAt: string,
) {
  await ensureSchema();
  const updatedAt = now();
  const customerStatus = result.customerStatus || (result.customerSent ? 'sent' : 'unknown');
  const adminStatus = result.adminStatus || (result.adminSent ? 'sent' : 'unknown');
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const sendingRows = local.leadEmailOutbox.filter((row) => row.leadId === leadId && row.status === 'sending' && row.lockedAt === attemptLockedAt);
      if (sendingRows.length === 0) return false;
      for (const item of sendingRows) {
        const sent = item.recipientRole === 'customer' ? result.customerSent : result.adminSent;
        item.status = item.recipientRole === 'customer' ? customerStatus : adminStatus;
        item.messageId = safeLeadEmailMessageId(item.recipientRole === 'customer' ? result.customerMessageId : result.adminMessageId);
        item.lastError = safeLeadEmailFailureReason(item.status);
        item.lockedAt = undefined;
        item.sentAt = item.status === 'sent' ? updatedAt : undefined;
        item.updatedAt = updatedAt;
      }
      await writeLocalDb(local);
      return true;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE lead_email_outbox SET
         status = CASE WHEN recipient_role = 'customer' THEN $2 ELSE $3 END,
         message_id = CASE WHEN recipient_role = 'customer' THEN $6 ELSE $7 END,
         last_error = CASE WHEN recipient_role = 'customer' THEN CASE WHEN $2 = 'sent' THEN '' ELSE $8 END ELSE CASE WHEN $3 = 'sent' THEN '' ELSE $9 END END,
         locked_at = NULL,
         sent_at = CASE WHEN (recipient_role = 'customer' AND $2 = 'sent') OR (recipient_role = 'internal' AND $3 = 'sent') THEN $4::timestamptz ELSE NULL END,
         updated_at = $4
       WHERE lead_id = $1 AND status = 'sending' AND locked_at = $5`,
       [leadId, customerStatus, adminStatus, updatedAt, attemptLockedAt, safeLeadEmailMessageId(result.customerMessageId), safeLeadEmailMessageId(result.adminMessageId), safeLeadEmailFailureReason(customerStatus), safeLeadEmailFailureReason(adminStatus)],
    );
    await client.query('COMMIT');
    return (rowCount ?? 0) > 0;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function hasConfirmedLeadEmail(leadId: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.leadEmailOutbox.some((item) => item.leadId === leadId && item.recipientRole === 'customer' && item.status === 'sent');
  }
  const { rows } = await db.query(
    `SELECT COALESCE(bool_or(recipient_role = 'customer' AND status = 'sent'), false) AS confirmed FROM lead_email_outbox WHERE lead_id = $1`,
    [leadId],
  );
  return Boolean(rows[0]?.confirmed);
}

function manuallyConfirmedLeadEmailNonDelivery(item: LeadEmailOutbox, auditLogs: AuditLog[]) {
  return item.status === 'failed' && item.retryable === false && item.lastError === confirmedLeadEmailNonDelivery
    && auditLogs.some((log) => log.entityType === 'lead' && log.entityId === item.leadId
      && log.action === 'lead_email_delivery_resolved' && log.createdAt === item.updatedAt
      && log.changes.recipientRole === item.recipientRole && log.changes.outcome === 'failed');
}

export async function listLeadEmailOutbox(leadId: string): Promise<LeadEmailOutboxSummary[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.leadEmailOutbox
      .filter((item) => item.leadId === leadId)
      .map((item) => ({ recipientRole: item.recipientRole, status: item.status, attempts: item.attempts,
        updatedAt: item.updatedAt, lastError: item.lastError, messageId: item.messageId || '',
        retryable: item.retryable, manualRetryReady: manuallyConfirmedLeadEmailNonDelivery(item, local.auditLogs) }));
  }
  const { rows } = await db.query(
    `SELECT o.recipient_role, o.status, o.attempts, o.updated_at, o.last_error, o.message_id, o.retryable,
       (o.status = 'failed' AND o.retryable = false AND o.last_error = $2 AND EXISTS (
         SELECT 1 FROM audit_logs a WHERE a.entity_type = 'lead' AND a.entity_id = o.lead_id
           AND a.action = 'lead_email_delivery_resolved' AND a.created_at = o.updated_at
           AND a.changes->>'recipientRole' = o.recipient_role AND a.changes->>'outcome' = 'failed'
       )) AS manual_retry_ready
     FROM lead_email_outbox o WHERE o.lead_id = $1 ORDER BY o.recipient_role`,
    [leadId, confirmedLeadEmailNonDelivery],
  );
  return rows.map((row) => ({
    recipientRole: String(row.recipient_role) as LeadEmailOutboxSummary['recipientRole'],
    status: String(row.status) as LeadEmailOutboxSummary['status'],
    attempts: Number(row.attempts ?? 0),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    lastError: String(row.last_error ?? ''),
    messageId: String(row.message_id ?? ''),
    retryable: Boolean(row.retryable),
    manualRetryReady: Boolean(row.manual_retry_ready),
  }));
}

export async function getLeadEmailOutboxHealth() {
  await ensureSchema();
  const empty = { pending: 0, sending: 0, failed: 0, unknown: 0 };
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.leadEmailOutbox.reduce((counts, row) => {
      if (row.status !== 'sent') counts[row.status] += 1;
      return counts;
    }, { ...empty });
  }
  const { rows } = await db.query(
    `SELECT status, COUNT(*)::int AS count FROM lead_email_outbox
     WHERE status <> 'sent' GROUP BY status`,
  );
  const counts = { ...empty };
  for (const row of rows) {
    const status = String(row.status) as keyof typeof counts;
    if (status in counts) counts[status] = Number(row.count);
  }
  return counts;
}

export async function getLeadEmailOutboxAttention() {
  await ensureSchema();
  const pendingCutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const sendingCutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const empty = {
    pending: 0,
    overduePending: 0,
    sending: 0,
    staleSending: 0,
    failed: 0,
    unknown: 0,
    oldestUnresolvedAt: null as string | null,
    oldestAttentionLeadId: null as string | null,
  };
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const unresolved = local.leadEmailOutbox.filter((item) => item.status !== 'sent');
    const attention = unresolved.filter((item) =>
      (item.status === 'pending' && item.createdAt <= pendingCutoff)
      || (item.status === 'sending' && (item.lockedAt || item.updatedAt) <= sendingCutoff)
      || item.status === 'failed'
      || item.status === 'unknown');
    return {
      pending: unresolved.filter((item) => item.status === 'pending').length,
      overduePending: unresolved.filter((item) => item.status === 'pending' && item.createdAt <= pendingCutoff).length,
      sending: unresolved.filter((item) => item.status === 'sending').length,
      staleSending: unresolved.filter((item) => item.status === 'sending' && (item.lockedAt || item.updatedAt) <= sendingCutoff).length,
      failed: unresolved.filter((item) => item.status === 'failed').length,
      unknown: unresolved.filter((item) => item.status === 'unknown').length,
      oldestUnresolvedAt: unresolved.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.createdAt || null,
      oldestAttentionLeadId: attention.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.leadId || null,
    };
  }
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'pending' AND created_at <= $1)::int AS overdue_pending,
       COUNT(*) FILTER (WHERE status = 'sending')::int AS sending,
       COUNT(*) FILTER (WHERE status = 'sending' AND COALESCE(locked_at, updated_at) <= $2)::int AS stale_sending,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
       COUNT(*) FILTER (WHERE status = 'unknown')::int AS unknown,
       MIN(created_at) FILTER (WHERE status <> 'sent') AS oldest_unresolved_at,
       (SELECT lead_id FROM lead_email_outbox
        WHERE (status = 'pending' AND created_at <= $1)
           OR (status = 'sending' AND COALESCE(locked_at, updated_at) <= $2)
           OR status IN ('failed', 'unknown')
        ORDER BY created_at ASC LIMIT 1) AS oldest_attention_lead_id
     FROM lead_email_outbox`,
    [pendingCutoff, sendingCutoff],
  );
  const row = rows[0];
  if (!row) return empty;
  return {
    pending: Number(row.pending || 0),
    overduePending: Number(row.overdue_pending || 0),
    sending: Number(row.sending || 0),
    staleSending: Number(row.stale_sending || 0),
    failed: Number(row.failed || 0),
    unknown: Number(row.unknown || 0),
    oldestUnresolvedAt: row.oldest_unresolved_at ? new Date(String(row.oldest_unresolved_at)).toISOString() : null,
    oldestAttentionLeadId: row.oldest_attention_lead_id ? String(row.oldest_attention_lead_id) : null,
  };
}

type ClaimOpsAlertInput = {
  worker: OpsAlertWorker;
  state: OpsAlertState;
  fingerprint: string;
  repeatAfterMinutes: number;
  now: string;
};

function opsAlertTransition(
  lastDeliveredState: OpsAlertState | undefined,
  lastDeliveredAt: string | undefined,
  uncertainClaimState: OpsAlertState | undefined,
  desiredState: OpsAlertState,
  timestamp: string,
  repeatAfterMinutes: number,
): OpsAlertTransition | undefined {
  if (desiredState === 'healthy') {
    return lastDeliveredState === 'unhealthy' || uncertainClaimState === 'unhealthy' ? 'recovered' : undefined;
  }
  if (uncertainClaimState === 'healthy') return 'degraded';
  if (lastDeliveredState !== 'unhealthy') return 'degraded';
  const lastDeliveredMs = lastDeliveredAt ? Date.parse(lastDeliveredAt) : Number.NaN;
  const nowMs = Date.parse(timestamp);
  return !Number.isFinite(lastDeliveredMs) || nowMs - lastDeliveredMs >= repeatAfterMinutes * 60_000
    ? 'repeated'
    : undefined;
}

function validOpsAlertClaimInput(input: ClaimOpsAlertInput) {
  return (input.worker === 'lead_email_delivery' || input.worker === 'application_notifications')
    && (input.state === 'healthy' || input.state === 'unhealthy')
    && /^[a-f0-9]{64}$/.test(input.fingerprint)
    && Number.isFinite(Date.parse(input.now))
    && Number.isSafeInteger(input.repeatAfterMinutes)
    && input.repeatAfterMinutes >= 15
    && input.repeatAfterMinutes <= 1440;
}

function clearOpsAlertClaim(state: OpsAlertStateRecord) {
  state.claimId = undefined;
  state.claimTransition = undefined;
  state.claimState = undefined;
  state.claimFingerprint = '';
  state.claimedUntil = undefined;
}

function safeOpsAlertAuditSummary(summary: OpsAlertAuditSummary) {
  const allowedReasons = new Set<string>(opsAlertReasonCodes);
  const allowedMetrics = new Set<string>(opsAlertMetricKeys);
  const reasonCodes = [...new Set(summary.reasonCodes.filter((reason) => allowedReasons.has(reason)))].sort();
  const metrics = Object.fromEntries(Object.entries(summary.metrics)
    .filter(([key]) => allowedMetrics.has(key))
    .slice(0, 20)
    .map(([key, value]) => [key, Number.isFinite(value) ? Math.min(1_000_000_000, Math.max(0, Math.trunc(value))) : 0]));
  return { reasonCodes, metrics };
}

export async function claimOpsAlert(input: ClaimOpsAlertInput): Promise<OpsAlertClaim | null> {
  if (!validOpsAlertClaimInput(input)) throw new Error('Invalid operations alert claim.');
  await ensureSchema();
  const db = getPool();
  const claimId = randomUUID();
  const claimedUntil = new Date(Date.parse(input.now) + 5 * 60_000).toISOString();

  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      let state = local.opsAlertStates.find((item) => item.workerKey === input.worker);
      if (!state) {
        state = {
          id: randomUUID(),
          workerKey: input.worker,
          observedState: input.state,
          observedFingerprint: input.fingerprint,
          lastDeliveredFingerprint: '',
          claimFingerprint: '',
          updatedAt: input.now,
        };
        local.opsAlertStates.push(state);
      }
      if (state.claimId && state.claimedUntil && state.claimedUntil > input.now) return null;

      if (state.claimId && state.claimTransition && state.claimState === input.state && state.claimFingerprint === input.fingerprint) {
        state.observedState = input.state;
        state.observedFingerprint = input.fingerprint;
        state.claimedUntil = claimedUntil;
        state.updatedAt = input.now;
        await writeLocalDb(local);
        return {
          claimId: state.claimId,
          worker: input.worker,
          state: input.state,
          transition: state.claimTransition,
          fingerprint: input.fingerprint,
        };
      }

      const transition = opsAlertTransition(
        state.lastDeliveredState,
        state.lastDeliveredAt,
        state.claimState,
        input.state,
        input.now,
        input.repeatAfterMinutes,
      );
      const reusableClaim = state.claimId
        && state.claimTransition === transition
        && state.claimState === input.state
        && state.claimFingerprint === input.fingerprint
        ? state.claimId
        : undefined;
      state.observedState = input.state;
      state.observedFingerprint = input.fingerprint;
      state.updatedAt = input.now;
      if (!transition) {
        clearOpsAlertClaim(state);
        await writeLocalDb(local);
        return null;
      }

      state.claimId = reusableClaim ?? claimId;
      state.claimTransition = transition;
      state.claimState = input.state;
      state.claimFingerprint = input.fingerprint;
      state.claimedUntil = claimedUntil;
      await writeLocalDb(local);
      return { claimId: state.claimId, worker: input.worker, state: input.state, transition, fingerprint: input.fingerprint };
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ops_alert_states (id, worker_key, observed_state, observed_fingerprint, updated_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (worker_key) DO NOTHING`,
      [randomUUID(), input.worker, input.state, input.fingerprint, input.now],
    );
    const locked = await client.query('SELECT * FROM ops_alert_states WHERE worker_key = $1 FOR UPDATE', [input.worker]);
    const row = locked.rows[0];
    if (!row) throw new Error('Operations alert state is unavailable.');
    if (row.claim_id && row.claimed_until && new Date(String(row.claimed_until)).toISOString() > input.now) {
      await client.query('COMMIT');
      return null;
    }
    if (row.claim_id && row.claim_transition && String(row.claim_state || '') === input.state
      && String(row.claim_fingerprint || '') === input.fingerprint) {
      await client.query(
        `UPDATE ops_alert_states SET observed_state=$2, observed_fingerprint=$3, claimed_until=$4, updated_at=$5
         WHERE worker_key=$1 AND claim_id=$6`,
        [input.worker, input.state, input.fingerprint, claimedUntil, input.now, String(row.claim_id)],
      );
      await client.query('COMMIT');
      return {
        claimId: String(row.claim_id),
        worker: input.worker,
        state: input.state,
        transition: String(row.claim_transition) as OpsAlertTransition,
        fingerprint: input.fingerprint,
      };
    }
    const transition = opsAlertTransition(
      row.last_delivered_state ? String(row.last_delivered_state) as OpsAlertState : undefined,
      row.last_delivered_at ? new Date(String(row.last_delivered_at)).toISOString() : undefined,
      row.claim_state ? String(row.claim_state) as OpsAlertState : undefined,
      input.state,
      input.now,
      input.repeatAfterMinutes,
    );
    const reusableClaim = row.claim_id
      && String(row.claim_transition || '') === transition
      && String(row.claim_state || '') === input.state
      && String(row.claim_fingerprint || '') === input.fingerprint
      ? String(row.claim_id)
      : undefined;
    if (!transition) {
      await client.query(
        `UPDATE ops_alert_states SET observed_state=$2, observed_fingerprint=$3,
           claim_id=NULL, claim_transition=NULL, claim_state=NULL, claim_fingerprint='', claimed_until=NULL, updated_at=$4
         WHERE worker_key=$1`,
        [input.worker, input.state, input.fingerprint, input.now],
      );
      await client.query('COMMIT');
      return null;
    }
    await client.query(
      `UPDATE ops_alert_states SET observed_state=$2, observed_fingerprint=$3, claim_id=$4,
         claim_transition=$5, claim_state=$2, claim_fingerprint=$3, claimed_until=$6, updated_at=$7
       WHERE worker_key=$1`,
      [input.worker, input.state, input.fingerprint, reusableClaim ?? claimId, transition, claimedUntil, input.now],
    );
    await client.query('COMMIT');
    return { claimId: reusableClaim ?? claimId, worker: input.worker, state: input.state, transition, fingerprint: input.fingerprint };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function completeOpsAlert(input: {
  worker: OpsAlertWorker;
  claimId: string;
  deliveredAt: string;
  summary: OpsAlertAuditSummary;
}) {
  if (!uuidPattern.test(input.claimId) || !Number.isFinite(Date.parse(input.deliveredAt))) return false;
  await ensureSchema();
  const db = getPool();
  const summary = safeOpsAlertAuditSummary(input.summary);

  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const state = local.opsAlertStates.find((item) => item.workerKey === input.worker && item.claimId === input.claimId);
      if (!state?.claimTransition || !state.claimState) return false;
      const transition = state.claimTransition;
      const deliveredState = state.claimState;
      state.lastDeliveredState = deliveredState;
      state.lastDeliveredFingerprint = state.claimFingerprint;
      state.lastDeliveredAt = input.deliveredAt;
      state.updatedAt = input.deliveredAt;
      clearOpsAlertClaim(state);
      local.auditLogs.unshift({
        id: randomUUID(),
        entityType: 'system',
        entityId: state.id,
        action: 'ops_alert_delivered',
        actorEmail: 'system:ops-alert',
        changes: { worker: input.worker, transition, state: deliveredState, ...summary },
        createdAt: input.deliveredAt,
      });
      await writeLocalDb(local);
      return true;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const completed = await client.query(
      `WITH claimed AS (
         SELECT id, worker_key, claim_transition, claim_state, claim_fingerprint
         FROM ops_alert_states WHERE worker_key=$1 AND claim_id=$2 FOR UPDATE
       ), updated AS (
         UPDATE ops_alert_states AS state SET last_delivered_state=claimed.claim_state,
           last_delivered_fingerprint=claimed.claim_fingerprint, last_delivered_at=$3,
           claim_id=NULL, claim_transition=NULL, claim_state=NULL, claim_fingerprint='', claimed_until=NULL, updated_at=$3
         FROM claimed WHERE state.worker_key=claimed.worker_key
         RETURNING claimed.id, claimed.claim_transition, claimed.claim_state
       ) SELECT * FROM updated`,
      [input.worker, input.claimId, input.deliveredAt],
    );
    if (completed.rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    const row = completed.rows[0];
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'system',$2,'ops_alert_delivered','system:ops-alert',$3::jsonb,$4)`,
      [randomUUID(), row.id, JSON.stringify({
        worker: input.worker,
        transition: row.claim_transition,
        state: row.claim_state,
        ...summary,
      }), input.deliveredAt],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseOpsAlertClaim(worker: OpsAlertWorker, claimId: string) {
  if (!uuidPattern.test(claimId)) return false;
  await ensureSchema();
  const db = getPool();
  const updatedAt = now();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const state = local.opsAlertStates.find((item) => item.workerKey === worker && item.claimId === claimId);
      if (!state) return false;
      clearOpsAlertClaim(state);
      state.updatedAt = updatedAt;
      await writeLocalDb(local);
      return true;
    });
  }
  const result = await db.query(
    `UPDATE ops_alert_states SET claim_id=NULL, claim_transition=NULL, claim_state=NULL,
       claim_fingerprint='', claimed_until=NULL, updated_at=$3
     WHERE worker_key=$1 AND claim_id=$2`,
    [worker, claimId, updatedAt],
  );
  return result.rowCount === 1;
}

const confirmedLeadEmailNonDelivery = 'Administrátor potvrdil nedoručenie; opakované odoslanie vyžaduje samostatný pokyn.';

export async function prepareLeadEmailRecipientManualRetry(
  leadId: string,
  recipientRole: 'customer' | 'internal',
  actorEmail: string,
  evidence: string,
) {
  if (!isLeadEmailEvidenceValid('failed', evidence) || !actorEmail.trim() || !canManuallyRetryLeadEmail()) return false;
  await ensureSchema();
  const db = getPool();
  const updatedAt = now();

  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      if (!local.leads.some((lead) => lead.id === leadId && !lead.deletedAt)) return false;
      const item = local.leadEmailOutbox.find((row) => row.leadId === leadId && row.recipientRole === recipientRole);
      if (!item || !manuallyConfirmedLeadEmailNonDelivery(item, local.auditLogs)) return false;
      item.status = 'sending';
      item.retryable = false;
      item.attempts += 1;
      item.nextAttemptAt = updatedAt;
      item.lockedAt = updatedAt;
      item.lastError = 'Administrátor po kontrole schránky a logu poskytovateľa potvrdil opakované odoslanie.';
      item.updatedAt = updatedAt;
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'lead', entityId: leadId, action: 'lead_email_manual_retry_started', actorEmail, changes: { recipientRole, evidence }, createdAt: updatedAt });
      await writeLocalDb(local);
      return updatedAt;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const activeLead = await client.query('SELECT id FROM leads WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [leadId]);
    if (activeLead.rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    const { rows } = await client.query(
      `SELECT o.status, o.retryable, o.last_error, EXISTS (
         SELECT 1 FROM audit_logs a WHERE a.entity_type = 'lead' AND a.entity_id = o.lead_id
           AND a.action = 'lead_email_delivery_resolved' AND a.created_at = o.updated_at
           AND a.changes->>'recipientRole' = o.recipient_role AND a.changes->>'outcome' = 'failed'
       ) AS confirmed_non_delivery
       FROM lead_email_outbox o WHERE o.lead_id = $1 AND o.recipient_role = $2 FOR UPDATE OF o`,
      [leadId, recipientRole],
    );
    if (rows.length !== 1 || rows[0].status !== 'failed' || rows[0].retryable !== false
      || rows[0].last_error !== confirmedLeadEmailNonDelivery || rows[0].confirmed_non_delivery !== true) {
      await client.query('ROLLBACK');
      return false;
    }
    const updated = await client.query(
      `UPDATE lead_email_outbox SET status = 'sending', attempts = attempts + 1, retryable = false, next_attempt_at = $3, locked_at = $3,
       last_error = 'Administrátor po kontrole schránky a logu poskytovateľa potvrdil opakované odoslanie.', updated_at = $3
       WHERE lead_id = $1 AND recipient_role = $2 AND status = 'failed' AND retryable = false AND last_error = $4 RETURNING id`,
      [leadId, recipientRole, updatedAt, confirmedLeadEmailNonDelivery],
    );
    if (updated.rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [randomUUID(), 'lead', leadId, 'lead_email_manual_retry_started', actorEmail, { recipientRole, evidence }, updatedAt],
    );
    await client.query('COMMIT');
    return updatedAt;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordLeadEmailRecipientResult(
  leadId: string,
  recipientRole: 'customer' | 'internal',
  result: { status: 'sent' | 'failed' | 'unknown'; messageId?: string; reason?: string; retryable?: boolean },
  attemptLockedAt: string,
  actorEmail = 'system:lead-email-outbox',
) {
  await ensureSchema();
  const updatedAt = now();
  const db = getPool();
  const messageIdHash = safeLeadEmailMessageId(result.messageId);
  const reasonCode = result.status === 'sent' ? 'sent' : result.status === 'unknown' ? 'delivery_unknown' : result.retryable ? 'retryable_failure' : 'definitive_failure';
  const safeReason = safeLeadEmailFailureReason(result.status);
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const item = local.leadEmailOutbox.find((row) => row.leadId === leadId && row.recipientRole === recipientRole && row.status === 'sending' && row.lockedAt === attemptLockedAt);
      if (!item) return false;
      const retryable = result.status === 'failed' && result.retryable === true && item.attempts < 3;
      item.status = result.status;
      item.retryable = retryable;
      if (retryable) item.nextAttemptAt = new Date(Date.now() + (item.attempts === 1 ? 15 : 60) * 60_000).toISOString();
      item.messageId = messageIdHash;
      item.lastError = safeReason;
      item.lockedAt = undefined;
      item.sentAt = result.status === 'sent' ? updatedAt : undefined;
      item.updatedAt = updatedAt;
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'lead', entityId: leadId, action: `lead_email_delivery_${result.status}`, actorEmail, changes: { recipientRole, messageIdHash, reasonCode, attemptLockedAt }, createdAt: updatedAt });
      await writeLocalDb(local);
      return true;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
    `UPDATE lead_email_outbox SET status = $4, message_id = $5, last_error = $6, locked_at = NULL,
     retryable = ($8::boolean AND $4 = 'failed' AND attempts < 3),
     next_attempt_at = CASE WHEN $8::boolean AND $4 = 'failed' AND attempts < 3 THEN $7::timestamptz + CASE WHEN attempts = 1 THEN INTERVAL '15 minutes' ELSE INTERVAL '60 minutes' END ELSE next_attempt_at END,
     sent_at = CASE WHEN $4 = 'sent' THEN $7::timestamptz ELSE NULL END, updated_at = $7
     WHERE lead_id = $1 AND recipient_role = $2 AND status = 'sending' AND locked_at = $3`,
      [leadId, recipientRole, attemptLockedAt, result.status, messageIdHash, safeReason, updatedAt, result.retryable === true],
    );
    if (rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [randomUUID(), 'lead', leadId, `lead_email_delivery_${result.status}`, actorEmail, { recipientRole, messageIdHash, reasonCode, attemptLockedAt }, updatedAt],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function resolveLeadEmailRecipientDelivery(
  leadId: string,
  recipientRole: 'customer' | 'internal',
  outcome: 'sent' | 'failed',
  actorEmail: string,
  evidence: string,
  checkedDelivery: string,
) {
  if (checkedDelivery !== 'yes' || !actorEmail.trim() || !isLeadEmailEvidenceValid(outcome, evidence)) return false;
  await ensureSchema();
  const updatedAt = now();
  const db = getPool();
  const audit = { recipientRole, outcome, evidence };
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      if (!local.leads.some((lead) => lead.id === leadId && !lead.deletedAt)) return false;
      const item = local.leadEmailOutbox.find((row) => row.leadId === leadId && row.recipientRole === recipientRole
        && (row.status === 'unknown' || (outcome === 'failed' && row.status === 'failed' && row.retryable === false
          && !manuallyConfirmedLeadEmailNonDelivery(row, local.auditLogs))));
      if (!item) return false;
      item.status = outcome;
      item.retryable = false;
      item.lockedAt = undefined;
      item.sentAt = outcome === 'sent' ? updatedAt : undefined;
      item.lastError = outcome === 'sent' ? '' : confirmedLeadEmailNonDelivery;
      item.updatedAt = updatedAt;
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'lead', entityId: leadId, action: 'lead_email_delivery_resolved', actorEmail, changes: audit, createdAt: updatedAt });
      await writeLocalDb(local);
      return true;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const activeLead = await client.query('SELECT id FROM leads WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [leadId]);
    if (activeLead.rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    const { rowCount } = await client.query(
      `UPDATE lead_email_outbox SET status = $3, retryable = false, locked_at = NULL, sent_at = CASE WHEN $3 = 'sent' THEN $4::timestamptz ELSE NULL END,
       last_error = CASE WHEN $3 = 'sent' THEN '' ELSE $5 END, updated_at = $4
        WHERE lead_id = $1 AND recipient_role = $2
          AND (status = 'unknown' OR ($3 = 'failed' AND status = 'failed' AND retryable = false AND last_error <> $5))`,
      [leadId, recipientRole, outcome, updatedAt, confirmedLeadEmailNonDelivery],
    );
    if (rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [randomUUID(), 'lead', leadId, 'lead_email_delivery_resolved', actorEmail, audit, updatedAt],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listPendingLeadEmailDeliveries(limit = 25, requireBothRecipients = false) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const activeLeadIds = new Set(local.leads.filter((lead) => !lead.deletedAt).map((lead) => lead.id));
    const pendingByLead = new Map<string, ('customer' | 'internal')[]>();
    const nextDueByLead = new Map<string, number>();
    for (const item of local.leadEmailOutbox) {
      if (!activeLeadIds.has(item.leadId)) continue;
      const eligible = item.status === 'pending' || (item.status === 'failed' && item.retryable === true && item.attempts < 3);
      if (!eligible || item.nextAttemptAt > now()) continue;
      const roles = pendingByLead.get(item.leadId) || [];
      roles.push(item.recipientRole);
      pendingByLead.set(item.leadId, roles);
      const dueAt = Date.parse(item.nextAttemptAt);
      nextDueByLead.set(item.leadId, Math.min(nextDueByLead.get(item.leadId) ?? Number.POSITIVE_INFINITY, dueAt));
    }
    return [...pendingByLead.entries()]
      .filter(([, pendingRoles]) => !requireBothRecipients || pendingRoles.length === 2)
      .sort(([leadIdA], [leadIdB]) => (nextDueByLead.get(leadIdA) ?? 0) - (nextDueByLead.get(leadIdB) ?? 0))
      .slice(0, Math.max(1, Math.min(100, limit))).flatMap(([leadId, pendingRoles]) => {
      const lead = local.leads.find((item) => item.id === leadId);
      const businessJob = local.businessJobs.find((item) => item.leadId === leadId);
       return lead && !lead.deletedAt && businessJob
        ? [{ lead, businessJobId: businessJob.id, fileCount: local.leadFiles.filter((item) => item.leadId === leadId).length, pendingRoles }]
        : [];
    });
  }
  const { rows } = await db.query(
    `SELECT o.lead_id, array_agg(o.recipient_role ORDER BY o.recipient_role) AS pending_roles
     FROM lead_email_outbox o JOIN leads l ON l.id = o.lead_id AND l.deleted_at IS NULL
     WHERE (o.status = 'pending' OR (o.status = 'failed' AND o.retryable = true AND o.attempts < 3)) AND o.next_attempt_at <= now()
     GROUP BY o.lead_id
     HAVING NOT $2::boolean OR COUNT(*) = 2
     ORDER BY MIN(o.next_attempt_at) ASC
     LIMIT $1`,
    [Math.max(1, Math.min(100, limit)), requireBothRecipients],
  );
  const deliveries = [];
  for (const row of rows) {
    const leadId = String(row.lead_id);
    const lead = await getLeadWithFiles(leadId);
    const { rows: jobs } = await db.query('SELECT id FROM business_jobs WHERE lead_id = $1 LIMIT 1', [leadId]);
    if (lead && jobs[0]) deliveries.push({ lead, businessJobId: String(jobs[0].id), fileCount: lead.files.length, pendingRoles: (row.pending_roles as string[]).filter((role): role is 'customer' | 'internal' => role === 'customer' || role === 'internal') });
  }
  return deliveries;
}

export async function markStaleLeadEmailClaimsUnknown(staleMinutes = 15) {
  await ensureSchema();
  const updatedAt = now();
  const staleBefore = new Date(Date.now() - Math.max(5, Math.min(120, staleMinutes)) * 60_000).toISOString();
  const message = 'Proces odosielania sa prerušil; doručenie treba preveriť v schránke alebo u poskytovateľa pred opakovaním.';
  const db = getPool();
  if (!db) {
    await withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      for (const item of local.leadEmailOutbox) {
        if (item.status === 'sending' && (item.lockedAt || item.updatedAt) < staleBefore) {
          item.status = 'unknown';
          item.retryable = false;
          item.lastError = message;
          item.lockedAt = undefined;
          item.updatedAt = updatedAt;
        }
      }
      await writeLocalDb(local);
    });
    return;
  }
  await db.query(
    `UPDATE lead_email_outbox SET status = 'unknown', retryable = false, last_error = $1, locked_at = NULL, updated_at = $2
      WHERE status = 'sending' AND COALESCE(locked_at, updated_at) < $3`,
    [message, updatedAt, staleBefore],
  );
}

export async function addLeadFiles(files: Omit<LeadFile, 'id' | 'createdAt'>[]) {
  if (!files.length) return [];
  await ensureSchema();
  const created = files.map((file) => ({ ...file, id: randomUUID(), createdAt: now() }));
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.leadFiles.unshift(...created);
    await writeLocalDb(local);
    return created;
  }
  for (const file of created) {
    await db.query(
      `INSERT INTO lead_files (id, lead_id, original_name, storage_driver, storage_key, mime_type, size_bytes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [file.id, file.leadId, file.originalName, file.storageDriver, file.storageKey, file.mimeType, file.sizeBytes, file.createdAt],
    );
  }
  return created;
}

export async function listLeads(): Promise<Lead[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.leads].filter((lead) => !lead.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { rows } = await db.query('SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 300');
  return rows.map(toLead);
}

export async function listLeadSummaries(includeDeleted = false): Promise<LeadSummary[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.leads]
      .filter((lead) => includeDeleted || !lead.deletedAt)
      .map((lead) => ({
        ...lead,
        fileCount: local.leadFiles.filter((file) => file.leadId === lead.id).length,
        quoteCount: local.quotes.filter((quote) => quote.leadId === lead.id).length,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { rows } = await db.query(`
    SELECT
      l.*,
      COALESCE(f.file_count, 0)::int AS file_count,
      COALESCE(q.quote_count, 0)::int AS quote_count
    FROM leads l
    LEFT JOIN (
      SELECT lead_id, count(*) AS file_count
      FROM lead_files
      GROUP BY lead_id
    ) f ON f.lead_id = l.id
    LEFT JOIN (
      SELECT lead_id, count(*) AS quote_count
      FROM quotes
      GROUP BY lead_id
    ) q ON q.lead_id = l.id
    WHERE ($1::boolean OR l.deleted_at IS NULL)
    ORDER BY l.created_at DESC
    LIMIT 300
  `, [includeDeleted]);
  return rows.map(toLeadSummary);
}

type LeadSummaryPageFilters = {
  archivedOnly?: boolean;
  excludeTestData?: boolean;
  q?: string;
  status?: LeadStatus | '';
  tag?: string;
  queue?: 'new' | 'unassigned' | 'followup' | 'waiting' | 'quote' | 'active' | '';
  ownerEmail?: string;
  today?: string;
  page?: number;
  pageSize?: number;
};

const leadSummaryQualitySql = `
  (CASE WHEN NULLIF(l.full_name, '') IS NOT NULL AND NULLIF(l.phone, '') IS NOT NULL AND NULLIF(l.email, '') IS NOT NULL THEN 20 ELSE 0 END) +
  (CASE WHEN NULLIF(l.city, '') IS NOT NULL THEN 15 ELSE 0 END) +
  (CASE WHEN NULLIF(l.object_type, '') IS NOT NULL AND NULLIF(l.material_type, '') IS NOT NULL THEN 20 ELSE 0 END) +
  (CASE WHEN l.area_estimate > 0 THEN 20 ELSE 0 END) +
  (CASE WHEN COALESCE(f.file_count, 0) > 0 THEN 20 ELSE 0 END) +
  (CASE WHEN NULLIF(l.note, '') IS NOT NULL OR NULLIF(l.term, '') IS NOT NULL OR NULLIF(l.roofer, '') IS NOT NULL THEN 5 ELSE 0 END)
`;

function normalizeAdminSearch(value: string | undefined) {
  return (value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function leadSummaryPageSize(value: number | undefined) {
  return value === 10 || value === 50 || value === 100 ? value : 25;
}

function leadSummaryPageNumber(value: number | undefined) {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : 1;
}

function localLeadMatchesTag(lead: LeadSummary, tag: string) {
  const term = normalizeAdminSearch(lead.term);
  const roofer = normalizeAdminSearch(lead.roofer);
  if (tag === 'chyba_fotka') return lead.fileCount === 0;
  if (tag === 'potrebuje_strechara') return Boolean(lead.wantsRooferRecommendation || lead.selectedRooferId || roofer.includes('potrebujem') || roofer.includes('chcem odporucit'));
  if (tag === 'urgentne') return term.includes('najskor') || term.includes('urgent') || term.includes('co naj');
  if (tag === 'nad_100_m2') return lead.areaEstimate >= 100;
  if (tag === 'pripravene_na_nacenenie') {
    const score =
      (lead.fullName && lead.phone && lead.email ? 20 : 0) +
      (lead.city ? 15 : 0) +
      (lead.objectType && lead.materialType ? 20 : 0) +
      (lead.areaEstimate > 0 ? 20 : 0) +
      (lead.fileCount > 0 ? 20 : 0) +
      (lead.note || lead.term || lead.roofer ? 5 : 0);
    return score >= 75 && lead.fileCount > 0;
  }
  return true;
}

function localLeadMatchesQueue(lead: LeadSummary, queue: LeadSummaryPageFilters['queue'], today: string) {
  if (!queue) return true;
  if (queue === 'new') return lead.status === 'novy';
  if (queue === 'unassigned') return !lead.ownerEmail;
  if (queue === 'followup') return Boolean(lead.followupDate && lead.followupDate <= today);
  if (queue === 'waiting') return lead.status === 'caka_na_doplnenie';
  if (queue === 'quote') return lead.status === 'naceneny';
  return ['kontaktovany', 'cenova_ponuka_odoslana', 'objednane', 'v_realizacii'].includes(lead.status);
}

function buildLeadSummaryPageWhere(filters: LeadSummaryPageFilters) {
  const values: unknown[] = [];
  const conditions = [filters.archivedOnly ? 'l.deleted_at IS NOT NULL' : 'l.deleted_at IS NULL'];
  if (filters.excludeTestData) conditions.push('COALESCE(l.is_test_data, false) = false');
  const addValue = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  const q = filters.q?.trim().slice(0, 100) || '';
  if (q) {
    const parameter = addValue(`%${escapeLikePattern(normalizeAdminSearch(q))}%`);
    conditions.push(`TRANSLATE(LOWER(CONCAT_WS(' ', l.full_name, l.phone, l.email, l.city, l.district, l.material_type, l.object_type, l.id::text)), 'áäčďéěíĺľňóôŕšťúůýž', 'aacdeeillnoorstuuyz') LIKE ${parameter} ESCAPE E'\\\\'`);
  }
  if (filters.status) conditions.push(`l.status = ${addValue(filters.status)}`);

  if (filters.queue === 'new') conditions.push(`l.status = 'novy'`);
  if (filters.queue === 'unassigned') conditions.push(`COALESCE(NULLIF(l.owner_email, ''), '') = ''`);
  if (filters.queue === 'followup') {
    conditions.push(`l.followup_date IS NOT NULL AND l.followup_date <= ${addValue(filters.today || new Date().toISOString().slice(0, 10))}`);
  }
  if (filters.queue === 'waiting') conditions.push(`l.status = 'caka_na_doplnenie'`);
  if (filters.queue === 'quote') conditions.push(`l.status = 'naceneny'`);
  if (filters.queue === 'active') {
    conditions.push(`l.status = ANY(${addValue(['kontaktovany', 'cenova_ponuka_odoslana', 'objednane', 'v_realizacii'])}::text[])`);
  }
  if (filters.ownerEmail) conditions.push(`LOWER(COALESCE(l.owner_email, '')) = LOWER(${addValue(filters.ownerEmail)})`);

  if (filters.tag === 'chyba_fotka') conditions.push('COALESCE(f.file_count, 0) = 0');
  if (filters.tag === 'potrebuje_strechara') {
    conditions.push(`(l.wants_roofer_recommendation = true OR NULLIF(l.selected_roofer_id, '') IS NOT NULL OR LOWER(COALESCE(l.roofer, '')) LIKE '%potrebujem%' OR LOWER(COALESCE(l.roofer, '')) LIKE '%chcem odporucit%')`);
  }
  if (filters.tag === 'urgentne') {
    conditions.push(`(LOWER(COALESCE(l.term, '')) LIKE '%najskor%' OR LOWER(COALESCE(l.term, '')) LIKE '%urgent%' OR LOWER(COALESCE(l.term, '')) LIKE '%co naj%' OR LOWER(COALESCE(l.term, '')) LIKE '%čo naj%')`);
  }
  if (filters.tag === 'nad_100_m2') conditions.push('l.area_estimate >= 100');
  if (filters.tag === 'pripravene_na_nacenenie') conditions.push(`COALESCE(f.file_count, 0) > 0 AND (${leadSummaryQualitySql}) >= 75`);

  return { values, where: conditions.join(' AND ') };
}

export async function listLeadSummaryPage(filters: LeadSummaryPageFilters = {}): Promise<LeadSummaryPage> {
  await ensureSchema();
  const requestedPage = leadSummaryPageNumber(filters.page);
  const pageSize = leadSummaryPageSize(filters.pageSize);
  const today = filters.today || new Date().toISOString().slice(0, 10);
  const db = getPool();

  if (!db) {
    const all = await listLeadSummaries(Boolean(filters.archivedOnly));
    const q = normalizeAdminSearch(filters.q?.trim() || '');
    const filtered = all
      .filter((lead) => filters.archivedOnly ? Boolean(lead.deletedAt) : !lead.deletedAt)
      .filter((lead) => !filters.excludeTestData || !lead.isTestData)
      .filter((lead) => !q || normalizeAdminSearch([lead.fullName, lead.phone, lead.email, lead.city, lead.district, lead.materialType, lead.objectType, lead.id].join(' ')).includes(q))
      .filter((lead) => !filters.status || lead.status === filters.status)
      .filter((lead) => localLeadMatchesQueue(lead, filters.queue, today))
      .filter((lead) => !filters.ownerEmail || (lead.ownerEmail || '').toLowerCase() === filters.ownerEmail.toLowerCase())
      .filter((lead) => !filters.tag || localLeadMatchesTag(lead, filters.tag));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages };
  }

  const base = `
    FROM leads l
    LEFT JOIN (
      SELECT lead_id, count(*) AS file_count
      FROM lead_files
      GROUP BY lead_id
    ) f ON f.lead_id = l.id
    LEFT JOIN (
      SELECT lead_id, count(*) AS quote_count
      FROM quotes
      GROUP BY lead_id
    ) q ON q.lead_id = l.id
  `;
  const where = buildLeadSummaryPageWhere({ ...filters, today });
  const countResult = await db.query(`SELECT count(*)::int AS total ${base} WHERE ${where.where}`, where.values);
  const total = Number(countResult.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const rowValues = [...where.values, pageSize, (page - 1) * pageSize];
  const { rows } = await db.query(
    `SELECT l.*, COALESCE(f.file_count, 0)::int AS file_count, COALESCE(q.quote_count, 0)::int AS quote_count
     ${base}
     WHERE ${where.where}
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT $${rowValues.length - 1} OFFSET $${rowValues.length}`,
    rowValues,
  );
  return { items: rows.map(toLeadSummary), total, page, pageSize, totalPages };
}

export async function getLeadQueueCounts(today = new Date().toISOString().slice(0, 10), excludeTestData = false): Promise<LeadQueueCounts> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const leads = (await listLeadSummaries(false)).filter((lead) => !excludeTestData || !lead.isTestData);
    return {
      total: leads.length,
      newLeads: leads.filter((lead) => lead.status === 'novy').length,
      unassigned: leads.filter((lead) => !lead.ownerEmail).length,
      followups: leads.filter((lead) => Boolean(lead.followupDate && lead.followupDate <= today)).length,
      waiting: leads.filter((lead) => lead.status === 'caka_na_doplnenie').length,
      quote: leads.filter((lead) => lead.status === 'naceneny').length,
      active: leads.filter((lead) => ['kontaktovany', 'cenova_ponuka_odoslana', 'objednane', 'v_realizacii'].includes(lead.status)).length,
    };
  }

  const { rows } = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'novy')::int AS new_leads,
       COUNT(*) FILTER (WHERE COALESCE(NULLIF(owner_email, ''), '') = '')::int AS unassigned,
       COUNT(*) FILTER (WHERE followup_date IS NOT NULL AND followup_date <= $1)::int AS followups,
       COUNT(*) FILTER (WHERE status = 'caka_na_doplnenie')::int AS waiting,
       COUNT(*) FILTER (WHERE status = 'naceneny')::int AS quote,
       COUNT(*) FILTER (WHERE status = ANY($2::text[]))::int AS active
     FROM leads
     WHERE deleted_at IS NULL AND ($3::boolean = false OR COALESCE(is_test_data, false) = false)`,
    [today, ['kontaktovany', 'cenova_ponuka_odoslana', 'objednane', 'v_realizacii'], excludeTestData],
  );
  const row = rows[0] ?? {};
  return {
    total: Number(row.total ?? 0),
    newLeads: Number(row.new_leads ?? 0),
    unassigned: Number(row.unassigned ?? 0),
    followups: Number(row.followups ?? 0),
    waiting: Number(row.waiting ?? 0),
    quote: Number(row.quote ?? 0),
    active: Number(row.active ?? 0),
  };
}

export async function getLeadWithFiles(id: string, includeArchived = false): Promise<LeadWithFiles | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.id === id && (includeArchived || !item.deletedAt));
    if (!lead) return null;
    return {
      ...lead,
      files: local.leadFiles.filter((file) => file.leadId === id),
      quotes: local.quotes.filter((quote) => quote.leadId === id),
      auditLogs: local.auditLogs.filter((log) => log.entityId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }
  const leadResult = await db.query(`SELECT * FROM leads WHERE id = $1 ${includeArchived ? '' : 'AND deleted_at IS NULL'} LIMIT 1`, [id]);
  if (!leadResult.rowCount) return null;
  const [filesResult, quotesResult, auditResult] = await Promise.all([
    db.query('SELECT * FROM lead_files WHERE lead_id = $1 ORDER BY created_at DESC', [id]),
    db.query('SELECT * FROM quotes WHERE lead_id = $1 ORDER BY created_at DESC', [id]),
    db.query('SELECT * FROM audit_logs WHERE entity_id = $1 ORDER BY created_at DESC', [id]),
  ]);
  return {
    ...toLead(leadResult.rows[0]),
    files: filesResult.rows.map(toLeadFile),
    quotes: quotesResult.rows.map(toQuote),
    auditLogs: auditResult.rows.map(toAuditLog),
  };
}

export async function isLeadTestData(id: string): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return Boolean(local.leads.find((lead) => lead.id === id)?.isTestData);
  }
  const { rows } = await db.query('SELECT is_test_data FROM leads WHERE id = $1 LIMIT 1', [id]);
  return Boolean(rows[0]?.is_test_data);
}

export async function setLeadTestData(id: string, isTestData: boolean, actorEmail: string, reason: string): Promise<boolean> {
  await ensureSchema();
  const safeReason = reason.trim();
  const allowedReasons = new Set(['Lokálny test formulára', 'Test doručovania emailov', 'Testovacie CRM údaje', 'Iný dôvod bez osobných údajov']);
  if (!allowedReasons.has(safeReason)) throw new Error('Vyberte povolený dôvod bez osobných údajov.');
  const timestamp = now();
  const auditId = randomUUID();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const lead = local.leads.find((item) => item.id === id);
      if (!lead) return false;
      const previous = Boolean(lead.isTestData);
      if (previous === isTestData) return true;
      const latestClassificationAt = local.auditLogs
        .filter((log) => log.entityType === 'lead' && log.entityId === id && log.action === 'lead_test_classification_changed')
        .reduce((latest, log) => Math.max(latest, Date.parse(log.createdAt) || 0), 0);
      const localTimestamp = new Date(Math.max(Date.now(), latestClassificationAt + 1)).toISOString();
      lead.isTestData = isTestData;
      lead.updatedAt = localTimestamp;
      local.auditLogs.unshift({
        id: auditId, entityType: 'lead', entityId: id, action: 'lead_test_classification_changed', actorEmail,
        changes: { previous, next: isTestData, reason: safeReason }, createdAt: localTimestamp,
      });
      await writeLocalDb(local);
      return true;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT is_test_data FROM leads WHERE id = $1 FOR UPDATE', [id]);
    if (!current.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }
    const previous = Boolean(current.rows[0].is_test_data);
    if (previous !== isTestData) {
      await client.query('UPDATE leads SET is_test_data = $1, updated_at = $2 WHERE id = $3', [isTestData, timestamp, id]);
      await client.query(
        'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [auditId, 'lead', id, 'lead_test_classification_changed', actorEmail, { previous, next: isTestData, reason: safeReason }, timestamp],
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setBusinessJobTestData(id: string, isTestData: boolean, actorEmail: string, reason: string): Promise<boolean> {
  await ensureSchema();
  const safeReason = reason.trim();
  const allowedReasons = new Set(['Lokálny test formulára', 'Test doručovania emailov', 'Testovacie CRM údaje', 'Iný dôvod bez osobných údajov']);
  if (!allowedReasons.has(safeReason)) throw new Error('Vyberte povolený dôvod bez osobných údajov.');
  const timestamp = now();
  const auditId = randomUUID();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const job = local.businessJobs.find((item) => item.id === id);
      if (!job) return false;
      const previous = Boolean(job.isTestData);
      if (previous === isTestData) return true;
      const latestClassificationAt = local.auditLogs
        .filter((log) => log.entityType === 'business_job' && log.entityId === id && log.action === 'business_job_test_classification_changed')
        .reduce((latest, log) => Math.max(latest, Date.parse(log.createdAt) || 0), 0);
      const localTimestamp = new Date(Math.max(Date.now(), latestClassificationAt + 1)).toISOString();
      job.isTestData = isTestData;
      job.updatedAt = localTimestamp;
      local.auditLogs.unshift({
        id: auditId, entityType: 'business_job', entityId: id, action: 'business_job_test_classification_changed', actorEmail,
        changes: { previous, next: isTestData, reason: safeReason }, createdAt: localTimestamp,
      });
      await writeLocalDb(local);
      return true;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT is_test_data FROM business_jobs WHERE id = $1 FOR UPDATE', [id]);
    if (!current.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }
    const previous = Boolean(current.rows[0].is_test_data);
    if (previous !== isTestData) {
      await client.query('UPDATE business_jobs SET is_test_data = $1, updated_at = $2 WHERE id = $3', [isTestData, timestamp, id]);
      await client.query(
        'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [auditId, 'business_job', id, 'business_job_test_classification_changed', actorEmail, { previous, next: isTestData, reason: safeReason }, timestamp],
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function duplicateText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function duplicatePhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('421') && digits.length === 12) return digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits.slice(1);
  return digits;
}

function leadExplicitAddress(lead: Lead) {
  const data = lead.rawData && typeof lead.rawData === 'object' ? lead.rawData as Record<string, unknown> : {};
  for (const key of ['address', 'objectAddress', 'propertyAddress', 'adresa', 'object_address']) {
    const value = duplicateText(data[key]);
    if (value) return value;
  }
  return '';
}

export async function findDuplicateLeads(leadId: string): Promise<LeadDuplicateMatch[]> {
  const lead = await getLeadWithFiles(leadId);
  if (!lead) return [];
  const phone = duplicatePhone(lead.phone);
  const email = duplicateText(lead.email);
  const address = leadExplicitAddress(lead);
  if (!phone && !email && !address) return [];

  const matches = (await listLeadSummaries(true))
    .filter((candidate) => candidate.id !== lead.id)
    .map((candidate) => {
      const reasons: LeadDuplicateMatch['reasons'] = [];
      if (phone && duplicatePhone(candidate.phone) === phone) reasons.push('telefón');
      if (email && duplicateText(candidate.email) === email) reasons.push('email');
      if (address && leadExplicitAddress(candidate) === address) reasons.push('adresa');
      if (!reasons.length) return null;
      return {
        leadId: candidate.id,
        fullName: candidate.fullName,
        email: candidate.email,
        phone: candidate.phone,
        city: candidate.city,
        status: candidate.status,
        createdAt: candidate.createdAt,
        reasons,
      } satisfies LeadDuplicateMatch;
    })
    .filter((candidate): candidate is LeadDuplicateMatch => Boolean(candidate));

  const reasonRank: Record<LeadDuplicateMatch['reasons'][number], number> = { telefón: 0, email: 1, adresa: 2 };
  return matches
    .sort((a, b) => Math.min(...a.reasons.map((reason) => reasonRank[reason])) - Math.min(...b.reasons.map((reason) => reasonRank[reason])) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);
}

export async function getLeadFile(id: string): Promise<LeadFile | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.leadFiles.find((file) => file.id === id) ?? null;
  }
  const { rows } = await db.query('SELECT * FROM lead_files WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ? toLeadFile(rows[0]) : null;
}

export async function updateLeadStatus(id: string, status: LeadStatus, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.id === id && !item.deletedAt);
    if (!lead) return null;
    const previous = lead.status;
    lead.status = status;
    lead.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('lead', id, 'status_changed', actorEmail, { previous, next: status });
    return lead;
  }
  const previous = await getLeadWithFiles(id);
  const { rows } = await db.query('UPDATE leads SET status = $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL RETURNING *', [status, id]);
  if (!rows[0]) return null;
  await addAuditLog('lead', id, 'status_changed', actorEmail, { previous: previous?.status, next: status });
  return toLead(rows[0]);
}

export async function updateLeadWorkflow(
  id: string,
  input: { status: LeadStatus; ownerEmail?: string; nextAction?: string; followupDate?: string; followupNote?: string; rejectionReason?: string },
  actorEmail: string,
) {
  await ensureSchema();
  const followupDate = input.followupDate || null;
  const followupNote = input.followupNote?.trim() || input.rejectionReason?.trim() || '';
  const ownerEmail = input.ownerEmail?.trim().toLowerCase().slice(0, 254) || '';
  const nextAction = input.nextAction?.trim().slice(0, 500) || '';
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.id === id && !item.deletedAt);
    if (!lead) return null;
    const previous = {
      status: lead.status,
      ownerEmail: lead.ownerEmail || '',
      nextAction: lead.nextAction || '',
      followupDate: lead.followupDate || '',
      followupNote: lead.followupNote || '',
    };
    lead.status = input.status;
    lead.ownerEmail = ownerEmail;
    lead.nextAction = nextAction;
    lead.followupDate = followupDate || '';
    lead.followupNote = followupNote;
    lead.followupNotificationSent = false;
    lead.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('lead', id, 'status_changed', actorEmail, {
      previous: previous.status,
      next: input.status,
      previousWorkflow: previous,
      nextWorkflow: { status: input.status, ownerEmail, nextAction, followupDate: followupDate || '', followupNote },
      changedFields: Object.keys(previous).filter((key) => previous[key as keyof typeof previous] !== ({ status: input.status, ownerEmail, nextAction, followupDate: followupDate || '', followupNote } as Record<string, string>)[key]),
    });
    return lead;
  }
  const previous = await getLeadWithFiles(id);
  const previousWorkflow = {
    status: previous?.status || '',
    ownerEmail: previous?.ownerEmail || '',
    nextAction: previous?.nextAction || '',
    followupDate: previous?.followupDate || '',
    followupNote: previous?.followupNote || '',
  };
  const nextWorkflow = { status: input.status, ownerEmail, nextAction, followupDate: followupDate || '', followupNote };
  const { rows } = await db.query(
    `UPDATE leads SET status = $1, owner_email = $2, next_action = $3, followup_date = $4, followup_note = $5, followup_notif_odoslana = false, updated_at = now()
     WHERE id = $6 AND deleted_at IS NULL RETURNING *`,
    [input.status, ownerEmail, nextAction, followupDate, followupNote, id],
  );
  if (!rows[0]) return null;
  await addAuditLog('lead', id, 'status_changed', actorEmail, {
    previous: previous?.status,
    next: input.status,
    previousWorkflow,
    nextWorkflow,
    changedFields: Object.keys(previousWorkflow).filter((key) => previousWorkflow[key as keyof typeof previousWorkflow] !== nextWorkflow[key as keyof typeof nextWorkflow]),
  });
  return toLead(rows[0]);
}

export async function clearLeadFollowup(id: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  const previousLead = await getLeadWithFiles(id);
  if (!previousLead) return null;
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.id === id && !item.deletedAt);
    if (lead) {
      lead.followupDate = '';
      lead.followupNote = '';
      lead.followupNotificationSent = false;
      lead.updatedAt = now();
      await writeLocalDb(local);
    }
  } else {
    await db.query("UPDATE leads SET followup_date = NULL, followup_note = '', followup_notif_odoslana = false, updated_at = now() WHERE id = $1 AND deleted_at IS NULL", [id]);
  }
  await addAuditLog('lead', id, 'followup_cancelled', actorEmail, {
    previous: { followupDate: previousLead?.followupDate || '', followupNote: previousLead?.followupNote || '' },
    next: { followupDate: '', followupNote: '' },
  });
  return previousLead;
}

export async function updateLeadInternalNote(id: string, internalNote: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.id === id && !item.deletedAt);
    if (!lead) return null;
    const previous = lead.internalNote;
    lead.internalNote = internalNote;
    lead.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('lead', id, 'internal_note_changed', actorEmail, { previous, next: internalNote });
    return lead;
  }
  const previous = await getLeadWithFiles(id);
  const { rows } = await db.query('UPDATE leads SET internal_note = $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL RETURNING *', [internalNote, id]);
  if (!rows[0]) return null;
  await addAuditLog('lead', id, 'internal_note_changed', actorEmail, { previous: previous?.internalNote, next: internalNote });
  return toLead(rows[0]);
}

export async function deleteLeadFileRecord(fileId: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const file = local.leadFiles.find((item) => item.id === fileId);
      if (!file || !local.leads.some((lead) => lead.id === file.leadId && !lead.deletedAt)) return null;
      const timestamp = now();
      const existing = local.leadFileDeletionJobs.find((job) => job.storageDriver === file.storageDriver && job.storageKey === file.storageKey);
      if (!existing) local.leadFileDeletionJobs.push({ id: randomUUID(), leadId: file.leadId, fileId: file.id, storageDriver: file.storageDriver, storageKey: file.storageKey, status: 'pending', attempts: 0, nextAttemptAt: timestamp, lastError: '', createdAt: timestamp, updatedAt: timestamp });
      local.leadFiles = local.leadFiles.filter((item) => item.id !== fileId);
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'lead', entityId: file.leadId, action: 'lead_file_deletion_queued', actorEmail, changes: { fileId, fileName: file.originalName }, createdAt: timestamp });
      await writeLocalDb(local);
      return file;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT f.* FROM lead_files f JOIN leads l ON l.id = f.lead_id
       WHERE f.id = $1 AND l.deleted_at IS NULL FOR UPDATE OF f`,
      [fileId],
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return null; }
    const file = toLeadFile(rows[0]);
    const timestamp = now();
    await client.query(
      `INSERT INTO lead_file_deletion_jobs (id, lead_id, file_id, storage_driver, storage_key, status, attempts, next_attempt_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'pending',0,$6,$6,$6) ON CONFLICT (storage_driver, storage_key) DO NOTHING`,
      [randomUUID(), file.leadId, file.id, file.storageDriver, file.storageKey, timestamp],
    );
    await client.query("UPDATE lead_upload_drafts SET status = 'deleting', updated_at = $2 WHERE storage_key = $1 AND status = 'attached'", [file.storageKey, timestamp]);
    await client.query('DELETE FROM lead_files WHERE id = $1', [fileId]);
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'lead', file.leadId, 'lead_file_deletion_queued', actorEmail, { fileId, fileName: file.originalName }, timestamp],
    );
    await client.query('COMMIT');
    return file;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export type LeadDashboardMetrics = {
  receivedInPeriod: number;
  newToday: number;
  waitingForOffer: number;
  followupsDue: number;
};

export type BusinessJobDashboardRow = {
  id: string;
  demolitionDate: string;
  status: BusinessJobStatus;
  totalPrice: number;
  costsTotal: number;
  rewardsTotal: number;
  workers: Array<{ workerId: string; reward: number }>;
};

/** Returns only the fields needed by dashboard charts and worker reward totals. */
export async function listBusinessJobDashboardRows(from: string, to: string): Promise<BusinessJobDashboardRow[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const testLeadIds = new Set(local.leads.filter((lead) => lead.isTestData).map((lead) => lead.id));
    return local.businessJobs
      .filter((job) => !job.deletedAt && !job.isTestData && !testLeadIds.has(job.leadId || '') && job.demolitionDate >= from && job.demolitionDate <= to)
      .map((job) => ({
        id: job.id,
        demolitionDate: job.demolitionDate,
        status: job.status,
        totalPrice: job.totalPrice,
        costsTotal: job.costs.total,
        rewardsTotal: job.rewardsTotal,
        workers: job.workers.map((worker) => ({ workerId: worker.workerId, reward: worker.reward })),
      }));
  }
  const { rows } = await db.query(
    `SELECT j.id, j.demolition_date, j.status, j.total_price,
       COALESCE(costs.total, 0) AS costs_total,
       COALESCE(rewards.total, 0) AS rewards_total
     FROM business_jobs j
     LEFT JOIN business_job_costs costs ON costs.job_id = j.id
     LEFT JOIN (
       SELECT job_id, sum(reward)::numeric AS total
       FROM business_job_workers GROUP BY job_id
     ) rewards ON rewards.job_id = j.id
     WHERE j.deleted_at IS NULL AND j.demolition_date >= $1::date AND j.demolition_date <= $2::date
       AND COALESCE(j.is_test_data, false) = false
       AND NOT EXISTS (SELECT 1 FROM leads test_lead WHERE test_lead.id = j.lead_id AND test_lead.is_test_data = true)
     ORDER BY j.demolition_date DESC, j.created_at DESC, j.id DESC`,
    [from, to],
  );
  const ids = rows.map((row) => String(row.id));
  const workerRows = ids.length
    ? await db.query('SELECT job_id, worker_id, reward FROM business_job_workers WHERE job_id = ANY($1::uuid[])', [ids])
    : { rows: [] as Record<string, unknown>[] };
  const workersByJob = new Map<string, BusinessJobDashboardRow['workers']>();
  for (const worker of workerRows.rows) {
    const jobId = String(worker.job_id);
    const workers = workersByJob.get(jobId) ?? [];
    workers.push({ workerId: String(worker.worker_id), reward: Number(worker.reward ?? 0) });
    workersByJob.set(jobId, workers);
  }
  return rows.map((row) => ({
    id: String(row.id),
    demolitionDate: String(row.demolition_date).slice(0, 10),
    status: String(row.status) as BusinessJobStatus,
    totalPrice: Number(row.total_price ?? 0),
    costsTotal: Number(row.costs_total ?? 0),
    rewardsTotal: Number(row.rewards_total ?? 0),
    workers: workersByJob.get(String(row.id)) ?? [],
  }));
}

export async function getLeadDashboardMetrics(from: string, to: string, today: string): Promise<LeadDashboardMetrics> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const leads = (await readLocalDb()).leads.filter((lead) => !lead.deletedAt && !lead.isTestData);
    return {
      receivedInPeriod: leads.filter((lead) => {
        const date = dateInBratislava(lead.createdAt);
        return date >= from && date <= to;
      }).length,
      newToday: leads.filter((lead) => dateInBratislava(lead.createdAt) === today).length,
      waitingForOffer: leads.filter((lead) => ['novy', 'kontaktovany', 'naceneny'].includes(lead.status)).length,
      followupsDue: leads.filter((lead) => Boolean(lead.followupDate && lead.followupDate <= today)).length,
    };
  }
  const periodWindow = bratislavaTimestampRange(from, to);
  const todayWindow = bratislavaTimestampRange(today, today);
  const { rows } = await db.query(
    `SELECT
       count(*) FILTER (WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz)::int AS received_in_period,
       count(*) FILTER (WHERE created_at >= $3::timestamptz AND created_at < $4::timestamptz)::int AS new_today,
       count(*) FILTER (WHERE status = ANY($5::text[]))::int AS waiting_for_offer,
       count(*) FILTER (WHERE followup_date IS NOT NULL AND followup_date <= $6::date)::int AS followups_due
     FROM leads WHERE deleted_at IS NULL AND COALESCE(is_test_data, false) = false`,
    [periodWindow.from, periodWindow.toExclusive, todayWindow.from, todayWindow.toExclusive, ['novy', 'kontaktovany', 'naceneny'], today],
  );
  const row = rows[0] ?? {};
  return {
    receivedInPeriod: Number(row.received_in_period ?? 0),
    newToday: Number(row.new_today ?? 0),
    waitingForOffer: Number(row.waiting_for_offer ?? 0),
    followupsDue: Number(row.followups_due ?? 0),
  };
}

export type LeadFileDeletionJobClaim = Pick<LeadFileDeletionJob, 'id' | 'leadId' | 'fileId' | 'storageDriver' | 'storageKey' | 'attempts' | 'claimId'>;

export async function claimLeadFileDeletionJobs(limit = 10) {
  await ensureSchema();
  const claimId = randomUUID();
  const timestamp = now();
  const safeLimit = Math.max(1, Math.min(25, Math.round(limit)));
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const selected = local.leadFileDeletionJobs
        .filter((job) => (job.status === 'pending' || (job.status === 'failed' && Date.parse(job.nextAttemptAt) <= Date.now()) || (job.status === 'deleting' && Date.parse(job.claimedUntil || '') <= Date.now())) && Date.parse(job.nextAttemptAt) <= Date.now())
        .sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt)).slice(0, safeLimit);
      const expiry = new Date(Date.now() + 10 * 60_000).toISOString();
      for (const job of selected) { job.status = 'deleting'; job.attempts += 1; job.claimId = claimId; job.claimedUntil = expiry; job.updatedAt = timestamp; }
      await writeLocalDb(local);
      return selected.map(({ id, leadId, fileId, storageDriver, storageKey, attempts }) => ({ id, leadId, fileId, storageDriver, storageKey, attempts, claimId }));
    });
  }
  const { rows } = await db.query(
    `WITH candidates AS (
       SELECT id FROM lead_file_deletion_jobs
       WHERE (status IN ('pending','failed') AND next_attempt_at <= $1)
          OR (status = 'deleting' AND claimed_until <= $1)
       ORDER BY next_attempt_at, created_at LIMIT $2 FOR UPDATE SKIP LOCKED
     )
     UPDATE lead_file_deletion_jobs j SET status = 'deleting', attempts = attempts + 1, claim_id = $3,
       claimed_until = $1::timestamptz + interval '10 minutes', updated_at = $1
     FROM candidates c WHERE j.id = c.id
     RETURNING j.id, j.lead_id, j.file_id, j.storage_driver, j.storage_key, j.attempts`,
    [timestamp, safeLimit, claimId],
  );
  return rows.map((row) => ({ id: String(row.id), leadId: String(row.lead_id), fileId: String(row.file_id), storageDriver: String(row.storage_driver) as LeadFile['storageDriver'], storageKey: String(row.storage_key), attempts: Number(row.attempts), claimId }));
}

export async function completeLeadFileDeletionJob(id: string, claimId: string) {
  await ensureSchema();
  const timestamp = now();
  const db = getPool();
  if (!db) return withLocalLeadSubmissionLock(async () => {
    const local = await readLocalDb();
    const job = local.leadFileDeletionJobs.find((item) => item.id === id && item.status === 'deleting' && item.claimId === claimId);
    if (!job) return false;
    job.status = 'deleted'; job.deletedAt = timestamp; job.updatedAt = timestamp; job.lastError = ''; job.claimId = undefined; job.claimedUntil = undefined;
    await writeLocalDb(local); return true;
  });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query("UPDATE lead_file_deletion_jobs SET status = 'deleted', deleted_at = $3, updated_at = $3, last_error = '', claim_id = NULL, claimed_until = NULL WHERE id = $1 AND status = 'deleting' AND claim_id = $2 RETURNING storage_key", [id, claimId, timestamp]);
    if (updated.rowCount !== 1) { await client.query('ROLLBACK'); return false; }
    await client.query("UPDATE lead_upload_drafts SET status = 'deleted', deletion_claim_id = NULL, deletion_claimed_until = NULL, updated_at = $2 WHERE storage_key = $1 AND status = 'deleting'", [String(updated.rows[0].storage_key), timestamp]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export async function failLeadFileDeletionJob(id: string, claimId: string, error: string) {
  await ensureSchema();
  const timestamp = now();
  const safeError = error.replace(/[\r\n\t]+/g, ' ').slice(0, 300) || 'Úložisko nepotvrdilo odstránenie.';
  const db = getPool();
  if (!db) return withLocalLeadSubmissionLock(async () => {
    const local = await readLocalDb();
    const job = local.leadFileDeletionJobs.find((item) => item.id === id && item.status === 'deleting' && item.claimId === claimId);
    if (!job) return false;
    job.status = 'failed'; job.nextAttemptAt = new Date(Date.now() + Math.min(24, 2 ** Math.min(job.attempts, 4)) * 60 * 60_000).toISOString(); job.updatedAt = timestamp; job.lastError = safeError; job.claimId = undefined; job.claimedUntil = undefined;
    await writeLocalDb(local); return true;
  });
  const { rowCount } = await db.query(
    `UPDATE lead_file_deletion_jobs SET status = 'failed', next_attempt_at = $3::timestamptz + LEAST(24, POWER(2, LEAST(attempts, 4))) * interval '1 hour',
       updated_at = $3, last_error = $4, claim_id = NULL, claimed_until = NULL
     WHERE id = $1 AND status = 'deleting' AND claim_id = $2`,
    [id, claimId, timestamp, safeError],
  );
  return rowCount === 1;
}

export async function listDueFollowups(date = new Date().toISOString().slice(0, 10)) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.leads.filter((lead) => !lead.deletedAt && lead.followupDate === date && !lead.followupNotificationSent);
  }
  const { rows } = await db.query(
    'SELECT * FROM leads WHERE deleted_at IS NULL AND followup_date = $1 AND followup_notif_odoslana = false ORDER BY created_at ASC',
    [date],
  );
  return rows.map(toLead);
}

export async function markLeadFollowupNotificationSent(id: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.id === id);
    if (lead) lead.followupNotificationSent = true;
    await writeLocalDb(local);
    return;
  }
  await db.query('UPDATE leads SET followup_notif_odoslana = true WHERE id = $1', [id]);
}

export async function exportDatabaseBackup() {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return { exportedAt: now(), driver: 'local', tables: local };
  }
  const tableResult = await db.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const tables: Record<string, unknown[]> = {};
  for (const row of tableResult.rows) {
    const table = String(row.table_name);
    if (!/^[a-zA-Z0-9_]+$/.test(table)) continue;
    const data = await db.query(`SELECT * FROM ${table}`);
    tables[table] = data.rows;
  }
  return { exportedAt: now(), driver: 'postgres', tables };
}

function safeLeadEmailAggregateAudit(changes: Record<string, unknown>) {
  const status = (value: unknown) => value === 'sent' || value === 'failed' || value === 'unknown' ? value : undefined;
  const role = (value: unknown) => value === 'customer' || value === 'internal' ? value : undefined;
  const processedRoles = Array.isArray(changes.processedRoles) ? changes.processedRoles.map(role).filter(Boolean) : undefined;
  const statuses = Array.isArray(changes.statuses) ? changes.statuses.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const recipientRole = role(row.recipientRole);
    const deliveryStatus = status(row.status);
    return recipientRole && deliveryStatus ? [{ recipientRole, status: deliveryStatus, attempts: Number.isSafeInteger(row.attempts) ? row.attempts : 0 }] : [];
  }) : undefined;
  return { sent: changes.sent === true, customerSent: changes.customerSent === true, adminSent: changes.adminSent === true,
    customerStatus: status(changes.customerStatus), adminStatus: status(changes.adminStatus), processedRoles, statuses };
}

export async function addAuditLog(
  entityType: AuditLog['entityType'],
  entityId: string,
  action: string,
  actorEmail: string,
  changes: Record<string, unknown>,
) {
  await ensureSchema();
  const safeChanges = entityType === 'lead' && ['lead_email_sent', 'lead_email_error', 'lead_email_skipped'].includes(action)
    ? safeLeadEmailAggregateAudit(changes) : changes;
  const log: AuditLog = { id: randomUUID(), entityType, entityId, action, actorEmail, changes: safeChanges, createdAt: now() };
  const db = getPool();
  if (!db) {
    await withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      local.auditLogs.unshift(log);
      await writeLocalDb(local);
    });
    return log;
  }
  await db.query(
    'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [log.id, log.entityType, log.entityId, log.action, log.actorEmail, log.changes, log.createdAt],
  );
  return log;
}

export async function listAuditLogs(limit = 300): Promise<AuditLog[]> {
  await ensureSchema();
  const safeLimit = Math.min(1000, Math.max(1, Math.round(limit)));
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.auditLogs
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, safeLimit);
  }
  const result = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1', [safeLimit]);
  return result.rows.map(toAuditLog);
}

export function calculateQuoteTotals(input: Pick<QuoteInput, 'areaEstimate' | 'pricePerM2' | 'documentationFee' | 'transportFee' | 'surcharge' | 'discount' | 'vatRate'>) {
  const base = input.areaEstimate * input.pricePerM2 + input.documentationFee + input.transportFee + input.surcharge - input.discount;
  const totalWithoutVat = Math.max(0, Math.round(base * 100) / 100);
  const totalWithVat = Math.round(totalWithoutVat * (1 + input.vatRate / 100) * 100) / 100;
  return { totalWithoutVat, totalWithVat };
}

export async function nextQuoteNumber() {
  await ensureSchema();
  const prefix = new Date().toISOString().slice(0, 7).replace('-', '');
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const count = local.quotes.filter((quote) => quote.quoteNumber.startsWith(prefix)).length + 1;
    return `${prefix}${String(count).padStart(3, '0')}`;
  }
  const { rows } = await db.query('SELECT count(*)::int AS count FROM quotes WHERE quote_number LIKE $1', [`${prefix}%`]);
  return `${prefix}${String(Number(rows[0]?.count ?? 0) + 1).padStart(3, '0')}`;
}

export async function createQuote(input: QuoteInput): Promise<Quote> {
  await ensureSchema();
  const totals = calculateQuoteTotals(input);
  const quote: Quote = {
    ...input,
    id: randomUUID(),
    status: 'draft',
    totalWithoutVat: totals.totalWithoutVat,
    totalWithVat: totals.totalWithVat,
    note: input.note ?? '',
    createdAt: now(),
    updatedAt: now(),
  };
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.quotes.unshift(quote);
    await writeLocalDb(local);
    await updateLeadStatus(input.leadId, 'naceneny', input.createdBy);
    await addAuditLog('quote', quote.id, 'quote_created', input.createdBy, { leadId: input.leadId, quoteNumber: quote.quoteNumber });
    return quote;
  }
  await db.query(
    `INSERT INTO quotes (
      id, lead_id, quote_number, status, valid_until, area_estimate, price_per_m2, documentation_fee,
      transport_fee, surcharge, discount, vat_rate, total_without_vat, total_with_vat, note, created_by,
      created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      quote.id,
      quote.leadId,
      quote.quoteNumber,
      quote.status,
      quote.validUntil,
      quote.areaEstimate,
      quote.pricePerM2,
      quote.documentationFee,
      quote.transportFee,
      quote.surcharge,
      quote.discount,
      quote.vatRate,
      quote.totalWithoutVat,
      quote.totalWithVat,
      quote.note,
      quote.createdBy,
      quote.createdAt,
      quote.updatedAt,
    ],
  );
  await updateLeadStatus(input.leadId, 'naceneny', input.createdBy);
  await addAuditLog('quote', quote.id, 'quote_created', input.createdBy, { leadId: input.leadId, quoteNumber: quote.quoteNumber });
  return quote;
}

export async function listQuotes(): Promise<Quote[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.quotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { rows } = await db.query('SELECT * FROM quotes ORDER BY created_at DESC LIMIT 300');
  return rows.map(toQuote);
}

export async function getQuote(id: string): Promise<Quote | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.quotes.find((quote) => quote.id === id) ?? null;
  }
  const { rows } = await db.query('SELECT * FROM quotes WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ? toQuote(rows[0]) : null;
}

export async function listTestimonials(): Promise<Testimonial[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.testimonials].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { rows } = await db.query('SELECT * FROM testimonials ORDER BY created_at DESC LIMIT 200');
  return rows.map(toTestimonial);
}

export async function getTestimonial(id: string): Promise<Testimonial | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.testimonials.find((item) => item.id === id) ?? null;
  }
  const { rows } = await db.query('SELECT * FROM testimonials WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ? toTestimonial(rows[0]) : null;
}

export async function listTestimonialsPage(options: { page?: number; pageSize?: number; status?: TestimonialStatus } = {}) {
  await ensureSchema();
  const db = getPool();
  const pageSize = Math.max(1, Math.min(100, Math.trunc(options.pageSize ?? 50) || 50));
  const status = options.status && ['draft', 'approved', 'hidden'].includes(options.status) ? options.status : undefined;
  if (!db) {
    const local = await readLocalDb();
    const matching = local.testimonials
      .filter((item) => !status || item.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    const total = matching.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(totalPages, Math.max(1, Math.trunc(options.page ?? 1) || 1));
    return { records: matching.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages };
  }
  const where = status ? 'WHERE status=$1' : '';
  const values: unknown[] = status ? [status] : [];
  const count = await db.query(`SELECT COUNT(*)::int AS total FROM testimonials ${where}`, values);
  const total = Number(count.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.trunc(options.page ?? 1) || 1));
  const rows = await db.query(
    `SELECT * FROM testimonials ${where} ORDER BY created_at DESC, id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  return { records: rows.rows.map(toTestimonial), total, page, pageSize, totalPages };
}

export async function listTestimonialAdminHistory(testimonialId: string, limit = 50): Promise<TestimonialAdminHistoryItem[]> {
  await ensureSchema();
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit) || 50));
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const consent: TestimonialAdminHistoryItem[] = local.testimonialConsentHistory
      .filter((item) => item.testimonialId === testimonialId)
      .map((item) => ({
        id: item.id, source: 'consent', event: item.event, actorEmail: item.actorEmail,
        createdAt: new Date(item.recordedAt).toISOString(),
        snapshot: {
          customerName: item.snapshotCustomerName, rating: item.snapshotRating, text: item.snapshotText,
          consentPublication: item.consentPublication, consentEvidence: item.consentEvidence,
          consentCapturedAt: item.consentCapturedAt, consentVersion: item.consentVersion,
          consentRevokedAt: item.consentRevokedAt, publicContentHash: item.publicContentHash,
        },
      }));
    const audit: TestimonialAdminHistoryItem[] = local.auditLogs
      .filter((item) => item.entityType === 'testimonial' && item.entityId === testimonialId)
      .map((item) => ({ id: item.id, source: 'audit', event: item.action, actorEmail: item.actorEmail, createdAt: item.createdAt, changes: item.changes }));
    return [...consent, ...audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, safeLimit);
  }
  const [consentRows, auditRows] = await Promise.all([
    db.query(
      `SELECT id, event, consent_publication, consent_evidence, consent_captured_at, consent_version,
              consent_revoked_at, snapshot_customer_name, snapshot_rating, snapshot_text,
              public_content_hash, actor_email, recorded_at
       FROM testimonial_consent_history WHERE testimonial_id=$1
       ORDER BY history_sequence DESC LIMIT $2`,
      [testimonialId, safeLimit],
    ),
    db.query(
      `SELECT id, action, actor_email, changes, created_at FROM audit_logs
       WHERE entity_type='testimonial' AND entity_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2`,
      [testimonialId, safeLimit],
    ),
  ]);
  const consent: TestimonialAdminHistoryItem[] = consentRows.rows.map((row) => ({
    id: String(row.id), source: 'consent', event: String(row.event), actorEmail: String(row.actor_email),
    createdAt: new Date(String(row.recorded_at)).toISOString(),
    snapshot: {
      customerName: String(row.snapshot_customer_name), rating: Number(row.snapshot_rating), text: String(row.snapshot_text),
      consentPublication: Boolean(row.consent_publication), consentEvidence: String(row.consent_evidence ?? ''),
      consentCapturedAt: row.consent_captured_at ? new Date(String(row.consent_captured_at)).toISOString() : undefined,
      consentVersion: String(row.consent_version ?? ''),
      consentRevokedAt: row.consent_revoked_at ? new Date(String(row.consent_revoked_at)).toISOString() : undefined,
      publicContentHash: String(row.public_content_hash),
    },
  }));
  const audit: TestimonialAdminHistoryItem[] = auditRows.rows.map((row) => ({
    id: String(row.id), source: 'audit', event: String(row.action), actorEmail: String(row.actor_email),
    createdAt: new Date(String(row.created_at)).toISOString(),
    changes: row.changes && typeof row.changes === 'object' && !Array.isArray(row.changes)
      ? row.changes as Record<string, unknown> : {},
  }));
  return [...consent, ...audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, safeLimit);
}

export async function listApprovedTestimonials(limit = 6): Promise<Testimonial[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.testimonials]
    .filter((testimonial) => testimonial.status === 'approved' && canUseTestimonialStatus(
        testimonial.status,
        Boolean(testimonial.consentPublication),
        testimonial.consentEvidence || '',
        testimonial.consentCapturedAt,
        testimonial.consentRevokedAt,
        testimonial.consentVersion,
        testimonial.customerName,
        testimonial.rating,
        testimonial.text,
      ))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  const { rows } = await db.query(
    `SELECT * FROM testimonials
     WHERE status = $1 AND consent_publication = true
       AND BTRIM(consent_evidence) <> '' AND consent_captured_at IS NOT NULL AND BTRIM(consent_version) <> '' AND consent_revoked_at IS NULL
       AND consent_version IN ($2, $3)
     ORDER BY created_at DESC LIMIT 300`,
    ['approved', publicTestimonialConsentVersion, adminTestimonialConsentVersion],
  );
  return rows.map(toTestimonial).filter((testimonial) => canUseTestimonialStatus(
    testimonial.status,
    Boolean(testimonial.consentPublication),
    testimonial.consentEvidence || '',
    testimonial.consentCapturedAt,
    testimonial.consentRevokedAt,
    testimonial.consentVersion,
    testimonial.customerName,
    testimonial.rating,
    testimonial.text,
  )).slice(0, limit);
}

export async function createTestimonial(input: TestimonialInput, actorEmail: string): Promise<Testimonial> {
  await ensureSchema();
  if (!canUseTestimonialStatus(input.status, Boolean(input.consentPublication), input.consentEvidence || '', input.consentCapturedAt, input.consentRevokedAt, input.consentVersion, input.customerName, input.rating, input.text)) {
    throw new Error('TESTIMONIAL_PUBLICATION_CONSENT_REQUIRED');
  }
  const timestamp = now();
  const testimonial: Testimonial = {
    id: randomUUID(),
    submissionId: input.submissionId,
    customerName: input.customerName.trim(),
    location: input.location?.trim() ?? '',
    objectType: input.objectType?.trim() ?? '',
    realizationDate: input.realizationDate || '',
    rating: Math.min(5, Math.max(1, Math.round(input.rating || 5))),
    text: input.text.trim(),
    status: input.status,
    customerEmail: input.customerEmail?.trim() ?? '',
    consentPublication: Boolean(input.consentPublication),
    consentEvidence: input.consentEvidence?.trim() ?? '',
    consentCapturedAt: input.consentPublication ? input.consentCapturedAt || timestamp : undefined,
    consentVersion: input.consentPublication ? input.consentVersion || '' : '',
    consentRevokedAt: undefined,
    source: input.source ?? 'admin',
    internalNote: input.internalNote?.trim() ?? '',
    photoUrl: input.photoUrl?.trim() ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
    approvedAt: input.status === 'approved' ? timestamp : undefined,
    approvedBy: input.status === 'approved' ? actorEmail : undefined,
  };

  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const existing = input.submissionId
        ? local.testimonials.find((entry) => entry.submissionId === input.submissionId)
        : undefined;
      if (existing) {
        if (!sameTestimonialSubmission(existing, input)) throw new Error('TESTIMONIAL_IDEMPOTENCY_CONFLICT');
        return existing;
      }
      local.testimonials.unshift(testimonial);
      local.auditLogs.unshift({
        id: randomUUID(),
        entityType: 'testimonial',
        entityId: testimonial.id,
        action: 'testimonial_created',
        actorEmail,
        changes: {
          status: testimonial.status,
          consentPublication: testimonial.consentPublication,
          consentEvidenceRecorded: Boolean(testimonial.consentEvidence),
          consentVersion: testimonial.consentVersion,
        },
        createdAt: timestamp,
      });
      await writeLocalDb(local);
      return testimonial;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO testimonials (
        id, created_at, updated_at, status, customer_name, location, rating, text, approved_at, approved_by,
        customer_email, consent_publication, source, object_type, realization_date, internal_note, photo_url,
        consent_evidence, consent_captured_at, consent_version, consent_revoked_at, submission_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      ON CONFLICT (submission_id) WHERE submission_id IS NOT NULL AND submission_id <> '' DO NOTHING
      RETURNING id`,
      [
        testimonial.id,
        testimonial.createdAt,
        testimonial.updatedAt,
        testimonial.status,
        testimonial.customerName,
        testimonial.location,
        testimonial.rating,
        testimonial.text,
        testimonial.approvedAt,
        testimonial.approvedBy,
        testimonial.customerEmail,
        testimonial.consentPublication,
        testimonial.source,
        testimonial.objectType,
        testimonial.realizationDate || null,
        testimonial.internalNote,
        testimonial.photoUrl,
        testimonial.consentEvidence,
        testimonial.consentCapturedAt ?? null,
        testimonial.consentVersion,
        testimonial.consentRevokedAt ?? null,
        input.submissionId || null,
      ],
    );
    if (!inserted.rowCount) {
      const existing = await client.query('SELECT * FROM testimonials WHERE submission_id = $1 LIMIT 1 FOR UPDATE', [input.submissionId]);
      if (!existing.rows[0]) throw new Error('TESTIMONIAL_IDEMPOTENCY_LOOKUP_FAILED');
      const prior = toTestimonial(existing.rows[0]);
      if (!sameTestimonialSubmission(prior, input)) throw new Error('TESTIMONIAL_IDEMPOTENCY_CONFLICT');
      await client.query('COMMIT');
      return prior;
    }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'testimonial', $2, 'testimonial_created', $3, $4::jsonb, $5)`,
      [randomUUID(), testimonial.id, actorEmail, JSON.stringify({
      status: testimonial.status,
      consentPublication: testimonial.consentPublication,
      consentEvidenceRecorded: Boolean(testimonial.consentEvidence),
      consentVersion: testimonial.consentVersion,
      }), testimonial.createdAt],
    );
    await client.query('COMMIT');
    return testimonial;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function sameTestimonialSubmission(existing: Testimonial, input: TestimonialInput) {
  return existing.customerName === input.customerName.trim()
    && existing.customerEmail === (input.customerEmail?.trim() ?? '')
    && existing.location === (input.location?.trim() ?? '')
    && existing.rating === Math.min(5, Math.max(1, Math.round(input.rating || 5)))
    && existing.text === input.text.trim()
    && existing.consentEvidence === (input.consentEvidence?.trim() ?? '')
    && existing.consentVersion === (input.consentVersion || '')
    && existing.source === (input.source ?? 'admin');
}

export async function updateTestimonial(id: string, input: TestimonialInput, actorEmail: string): Promise<Testimonial | null> {
  await ensureSchema();
  if (!canUseTestimonialStatus(input.status, Boolean(input.consentPublication), input.consentEvidence || '', input.consentCapturedAt, input.consentRevokedAt, input.consentVersion, input.customerName, input.rating, input.text)) {
    throw new Error('TESTIMONIAL_PUBLICATION_CONSENT_REQUIRED');
  }

  const timestamp = now();
  const normalized: TestimonialInput = {
    ...input,
    customerName: input.customerName.trim(),
    location: input.location?.trim() ?? '',
    objectType: input.objectType?.trim() ?? '',
    realizationDate: input.realizationDate || '',
    rating: Math.min(5, Math.max(1, Math.round(input.rating || 5))),
    text: input.text.trim(),
    customerEmail: input.customerEmail?.trim() ?? '',
    consentPublication: Boolean(input.consentPublication),
    consentEvidence: input.consentEvidence?.trim() ?? '',
    consentCapturedAt: input.consentPublication ? input.consentCapturedAt || timestamp : undefined,
    consentVersion: input.consentPublication ? input.consentVersion || '' : '',
    consentRevokedAt: undefined,
    source: input.source ?? 'admin',
    internalNote: input.internalNote?.trim() ?? '',
    photoUrl: input.photoUrl?.trim() ?? '',
  };

  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
    const local = await readLocalDb();
    const testimonial = local.testimonials.find((item) => item.id === id);
    if (!testimonial) return null;
    const localTimestamp = nextLocalTestimonialVersion(testimonial.updatedAt);
    const previousStatus = testimonial.status;
    const previousConsent = {
      consentPublication: Boolean(testimonial.consentPublication),
      consentEvidence: testimonial.consentEvidence || '',
      consentCapturedAt: testimonial.consentCapturedAt,
      consentVersion: testimonial.consentVersion || '',
      consentRevokedAt: testimonial.consentRevokedAt,
      customerName: testimonial.customerName,
      rating: testimonial.rating,
      text: testimonial.text,
    };
    Object.assign(testimonial, normalized, {
      updatedAt: localTimestamp,
      consentCapturedAt: normalized.consentPublication
        ? normalized.consentCapturedAt ?? localTimestamp
        : previousConsent.consentCapturedAt,
      consentVersion: normalized.consentPublication
        ? normalized.consentVersion || ''
        : previousConsent.consentVersion,
      consentEvidence: normalized.consentPublication ? normalized.consentEvidence : previousConsent.consentEvidence,
      consentRevokedAt: normalized.consentPublication ? undefined : (previousConsent.consentPublication && !previousConsent.consentRevokedAt ? localTimestamp : previousConsent.consentRevokedAt),
      approvedAt: normalized.status === 'approved' ? (previousStatus === 'approved' ? testimonial.approvedAt ?? localTimestamp : localTimestamp) : undefined,
      approvedBy: normalized.status === 'approved' ? (previousStatus === 'approved' ? testimonial.approvedBy ?? actorEmail : actorEmail) : undefined,
    });
    const nextConsent = {
      consentPublication: Boolean(testimonial.consentPublication),
      consentEvidence: testimonial.consentEvidence || '',
      consentCapturedAt: testimonial.consentCapturedAt,
      consentVersion: testimonial.consentVersion || '',
      consentRevokedAt: testimonial.consentRevokedAt,
      customerName: testimonial.customerName,
      rating: testimonial.rating,
      text: testimonial.text,
    };
    for (const entry of testimonialConsentHistoryEntries(previousConsent, nextConsent)) {
      local.testimonialConsentHistory.unshift({
        id: randomUUID(),
        testimonialId: id,
        event: entry.event,
        consentPublication: entry.snapshot.consentPublication,
        consentEvidence: entry.snapshot.consentEvidence,
        consentCapturedAt: entry.snapshot.consentCapturedAt instanceof Date
          ? entry.snapshot.consentCapturedAt.toISOString()
          : entry.snapshot.consentCapturedAt || undefined,
        consentVersion: entry.snapshot.consentVersion,
        consentRevokedAt: entry.snapshot.consentRevokedAt instanceof Date
          ? entry.snapshot.consentRevokedAt.toISOString()
          : entry.snapshot.consentRevokedAt || undefined,
        snapshotCustomerName: entry.snapshot.customerName,
        snapshotRating: entry.snapshot.rating,
        snapshotText: entry.snapshot.text,
        publicContentHash: testimonialPublicContentHash(entry.snapshot.customerName, entry.snapshot.rating, entry.snapshot.text),
        actorEmail,
        recordedAt: localTimestamp,
      });
    }
    local.auditLogs.unshift({
      id: randomUUID(),
      entityType: 'testimonial',
      entityId: id,
      action: 'testimonial_updated',
      actorEmail,
      changes: {
      status: normalized.status,
      consentPublication: Boolean(testimonial.consentPublication && !testimonial.consentRevokedAt),
      consentEvidenceRecorded: Boolean(testimonial.consentEvidence),
      consentRevoked: Boolean(testimonial.consentRevokedAt),
      consentVersion: testimonial.consentVersion || '',
      },
      createdAt: localTimestamp,
    });
    await writeLocalDb(local);
    return testimonial;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const previousResult = await client.query('SELECT * FROM testimonials WHERE id = $1 FOR UPDATE', [id]);
    const previousRow = previousResult.rows[0];
    if (!previousRow) {
      await client.query('COMMIT');
      return null;
    }

    const previousConsent = {
      consentPublication: Boolean(previousRow.consent_publication),
      consentEvidence: String(previousRow.consent_evidence || ''),
      consentCapturedAt: previousRow.consent_captured_at ?? undefined,
      consentVersion: String(previousRow.consent_version || ''),
      consentRevokedAt: previousRow.consent_revoked_at ?? undefined,
      customerName: String(previousRow.customer_name || ''),
      rating: Number(previousRow.rating || 0),
      text: String(previousRow.text || ''),
    };

    const { rows } = await client.query(
    `UPDATE testimonials
      SET updated_at = $1,
          status = $2,
          customer_name = $3,
          location = $4,
          rating = $5,
          text = $6,
          approved_at = CASE
            WHEN $2 = 'approved' AND status = 'approved' THEN COALESCE(approved_at, $1)
            WHEN $2 = 'approved' THEN $1 ELSE NULL END,
          approved_by = CASE
            WHEN $2 = 'approved' AND status = 'approved' THEN COALESCE(approved_by, $7)
            WHEN $2 = 'approved' THEN $7 ELSE NULL END,
          customer_email = $8,
          consent_publication = $9,
          consent_evidence = CASE WHEN $9 THEN $16 ELSE consent_evidence END,
          consent_captured_at = CASE WHEN $9 THEN $17::timestamptz ELSE consent_captured_at END,
          consent_version = CASE WHEN $9 THEN $18 ELSE consent_version END,
          consent_revoked_at = CASE WHEN $9 THEN NULL WHEN consent_publication THEN $19 ELSE consent_revoked_at END,
          source = $10,
          object_type = $11,
          realization_date = $12,
          internal_note = $13,
          photo_url = $14
      WHERE id = $15 AND ($2 <> 'approved' OR (
        $9 = true AND BTRIM($16) <> '' AND $17::timestamptz IS NOT NULL AND BTRIM($18) <> ''
        AND (($18 = $20 AND $16 = $21) OR ($18 = $22 AND $16 ~ $23
          AND char_length(split_part($16, E'\\nOdtlačok schváleného znenia: ', 1)) - char_length('Presné znenie súhlasu: ') BETWEEN 10 AND 2000))
      ))
      RETURNING *`,
    [
      timestamp,
      normalized.status,
      normalized.customerName,
      normalized.location,
      normalized.rating,
      normalized.text,
      actorEmail,
      normalized.customerEmail,
      normalized.consentPublication,
      normalized.source,
      normalized.objectType,
      normalized.realizationDate || null,
      normalized.internalNote,
      normalized.photoUrl,
      id,
      normalized.consentEvidence,
      normalized.consentPublication ? normalized.consentCapturedAt || timestamp : timestamp,
      normalized.consentPublication ? normalized.consentVersion || '' : '',
      timestamp,
      publicTestimonialConsentVersion,
      bindPublicTestimonialConsent(testimonialPublicContentHash(normalized.customerName, normalized.rating, normalized.text)),
      adminTestimonialConsentVersion,
      '(?s)^Presné znenie súhlasu: .+\\nOdtlačok schváleného znenia: [a-f0-9]{64}\\nZdroj súhlasu: (webový formulár|e-mail|SMS|WhatsApp|písomný súhlas|osobne); dátum súhlasu: [0-9]{4}-[0-9]{2}-[0-9]{2}\\.$',
    ],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const updatedRow = rows[0];
    const nextConsent = {
      consentPublication: Boolean(updatedRow.consent_publication),
      consentEvidence: String(updatedRow.consent_evidence || ''),
      consentCapturedAt: updatedRow.consent_captured_at ?? undefined,
      consentVersion: String(updatedRow.consent_version || ''),
      consentRevokedAt: updatedRow.consent_revoked_at ?? undefined,
      customerName: String(updatedRow.customer_name || ''),
      rating: Number(updatedRow.rating || 0),
      text: String(updatedRow.text || ''),
    };
    for (const entry of testimonialConsentHistoryEntries(previousConsent, nextConsent)) {
      const snapshot = entry.snapshot;
      await client.query(
        `INSERT INTO testimonial_consent_history (
          id, testimonial_id, event, consent_publication, consent_evidence, consent_captured_at,
          consent_version, consent_revoked_at, snapshot_customer_name, snapshot_rating, snapshot_text,
          public_content_hash, actor_email, recorded_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          randomUUID(), id, entry.event, snapshot.consentPublication, snapshot.consentEvidence,
          snapshot.consentCapturedAt ?? null, snapshot.consentVersion, snapshot.consentRevokedAt ?? null,
          snapshot.customerName, snapshot.rating, snapshot.text,
          testimonialPublicContentHash(snapshot.customerName, snapshot.rating, snapshot.text), actorEmail, timestamp,
        ],
      );
    }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'testimonial', $2, 'testimonial_updated', $3, $4::jsonb, $5)`,
      [randomUUID(), id, actorEmail, JSON.stringify({
    status: normalized.status,
        consentPublication: Boolean(updatedRow.consent_publication && !updatedRow.consent_revoked_at),
        consentEvidenceRecorded: Boolean(updatedRow.consent_evidence),
        consentRevoked: Boolean(updatedRow.consent_revoked_at),
        consentVersion: String(updatedRow.consent_version || ''),
      }), timestamp],
    );
    await client.query('COMMIT');
    return toTestimonial(updatedRow);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTestimonialStatus(id: string, status: TestimonialStatus, actorEmail: string): Promise<Testimonial | null> {
  await ensureSchema();
  const timestamp = now();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
    const local = await readLocalDb();
    const testimonial = local.testimonials.find((item) => item.id === id);
    if (!testimonial) return null;
    const localTimestamp = nextLocalTestimonialVersion(testimonial.updatedAt);
    if (!canUseTestimonialStatus(status, Boolean(testimonial.consentPublication), testimonial.consentEvidence || '', testimonial.consentCapturedAt, testimonial.consentRevokedAt, testimonial.consentVersion, testimonial.customerName, testimonial.rating, testimonial.text)) throw new Error('TESTIMONIAL_PUBLICATION_CONSENT_REQUIRED');
    const previous = testimonial.status;
    testimonial.status = status;
    testimonial.updatedAt = localTimestamp;
    testimonial.approvedAt = status === 'approved' ? localTimestamp : undefined;
    testimonial.approvedBy = status === 'approved' ? actorEmail : undefined;
    local.auditLogs.unshift({
      id: randomUUID(), entityType: 'testimonial', entityId: id, action: 'testimonial_status_changed', actorEmail,
      changes: { previous, next: status }, createdAt: localTimestamp,
    });
    await writeLocalDb(local);
    return testimonial;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const previous = await client.query('SELECT * FROM testimonials WHERE id = $1 FOR UPDATE', [id]);
    if (!previous.rows[0]) {
      await client.query('COMMIT');
      return null;
    }
    const prior = previous.rows[0];
    if (!canUseTestimonialStatus(
      status,
      Boolean(prior.consent_publication),
      String(prior.consent_evidence || ''),
      prior.consent_captured_at ? new Date(String(prior.consent_captured_at)).toISOString() : undefined,
      prior.consent_revoked_at ? new Date(String(prior.consent_revoked_at)).toISOString() : undefined,
      String(prior.consent_version || ''),
      String(prior.customer_name || ''),
      Number(prior.rating),
      String(prior.text || ''),
    )) throw new Error('TESTIMONIAL_PUBLICATION_CONSENT_REQUIRED');
    const { rows } = await client.query(
    `UPDATE testimonials
      SET status = $1,
          updated_at = $2::timestamptz,
          approved_at = CASE WHEN $1 = 'approved' THEN $2::timestamptz ELSE NULL END,
          approved_by = CASE WHEN $1 = 'approved' THEN $3 ELSE NULL END
      WHERE id = $4 AND ($1 <> 'approved' OR (
        consent_publication = true AND BTRIM(consent_evidence) <> ''
        AND consent_captured_at IS NOT NULL AND BTRIM(consent_version) <> '' AND consent_revoked_at IS NULL
        AND ((consent_version = $5 AND consent_evidence = $6)
          OR (consent_version = $7 AND consent_evidence ~ $8
            AND char_length(split_part(consent_evidence, E'\\nOdtlačok schváleného znenia: ', 1)) - char_length('Presné znenie súhlasu: ') BETWEEN 10 AND 2000))
      ))
      RETURNING *`,
    [
      status, timestamp, actorEmail, id, publicTestimonialConsentVersion, bindPublicTestimonialConsent(testimonialPublicContentHash(String(previous.rows[0].customer_name || ''), Number(previous.rows[0].rating), String(previous.rows[0].text || ''))),
      adminTestimonialConsentVersion,
      '(?s)^Presné znenie súhlasu: .+\\nOdtlačok schváleného znenia: [a-f0-9]{64}\\nZdroj súhlasu: (webový formulár|e-mail|SMS|WhatsApp|písomný súhlas|osobne); dátum súhlasu: [0-9]{4}-[0-9]{2}-[0-9]{2}\\.$',
    ],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'testimonial', $2, 'testimonial_status_changed', $3, $4::jsonb, $5)`,
      [randomUUID(), id, actorEmail, JSON.stringify({ previous: prior.status, next: status }), timestamp],
    );
    await client.query('COMMIT');
    return toTestimonial(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listReviewRequests(): Promise<ReviewRequest[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.reviewRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { rows } = await db.query('SELECT * FROM review_requests ORDER BY created_at DESC LIMIT 300');
  return rows.map(toReviewRequest);
}

export async function createReviewRequest(input: ReviewRequestInput): Promise<ReviewRequest> {
  await ensureSchema();
  const timestamp = now();
  const request: ReviewRequest = {
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: input.status ?? 'sent',
    customerName: input.customerName.trim(),
    phone: input.phone.trim(),
    location: input.location?.trim() ?? '',
    objectType: input.objectType?.trim() ?? '',
    realizationDate: input.realizationDate || '',
    googleReviewLink: input.googleReviewLink.trim(),
    message: input.message.trim(),
    createdBy: input.createdBy,
    leadId: input.leadId || '',
  };

  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.reviewRequests.unshift(request);
    await writeLocalDb(local);
    await addAuditLog('review_request', request.id, 'review_request_created', input.createdBy, { status: request.status });
    return request;
  }

  await db.query(
    `INSERT INTO review_requests (
      id, created_at, updated_at, status, customer_name, phone, location, object_type,
      realization_date, google_review_link, message, created_by, lead_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      request.id,
      request.createdAt,
      request.updatedAt,
      request.status,
      request.customerName,
      request.phone,
      request.location,
      request.objectType,
      request.realizationDate || null,
      request.googleReviewLink,
      request.message,
      request.createdBy,
      request.leadId || null,
    ],
  );
  await addAuditLog('review_request', request.id, 'review_request_created', input.createdBy, { status: request.status });
  return request;
}

export async function updateReviewRequestStatus(id: string, status: ReviewRequestStatus, actorEmail: string): Promise<ReviewRequest | null> {
  await ensureSchema();
  const timestamp = now();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const request = local.reviewRequests.find((item) => item.id === id);
    if (!request) return null;
    const previous = request.status;
    request.status = status;
    request.updatedAt = timestamp;
    await writeLocalDb(local);
    await addAuditLog('review_request', id, 'review_request_status_changed', actorEmail, { previous, next: status });
    return request;
  }
  const previous = await db.query('SELECT status FROM review_requests WHERE id = $1 LIMIT 1', [id]);
  const { rows } = await db.query(
    'UPDATE review_requests SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *',
    [status, timestamp, id],
  );
  if (!rows[0]) return null;
  await addAuditLog('review_request', id, 'review_request_status_changed', actorEmail, { previous: previous.rows[0]?.status, next: status });
  return toReviewRequest(rows[0]);
}

const defaultWorkers = [
  { name: 'Robo', ratePerM2: 2 },
  { name: 'Maťo', ratePerM2: 1.5 },
  { name: 'Miloš', ratePerM2: 1.5 },
];

async function seedDefaultWorkers(db: Pool | PoolClient | undefined = getPool()) {
  if (!db) return;
  for (const worker of defaultWorkers) {
    await db.query(
      `INSERT INTO workers (id, name, rate_per_m2, active)
       SELECT $1, $2, $3, true
       WHERE NOT EXISTS (SELECT 1 FROM workers WHERE lower(name) = lower($2))`,
      [randomUUID(), worker.name, worker.ratePerM2],
    );
  }
}

async function seedDefaultAdminUser(db: Pool | PoolClient | undefined = getPool()) {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) return;
  if (!db) return;
  await db.query(
    `INSERT INTO admin_users (id, email, name, role, active, password_hash)
     SELECT $1, $2, 'ASTANA', 'SUPER_ADMIN', true, ''
     WHERE NOT EXISTS (SELECT 1 FROM admin_users)`,
    [randomUUID(), email],
  );
}

async function ensureLocalBusinessDefaults(): Promise<LocalDb> {
  // Call only outside the mutation lock: this helper owns the fresh read and initialization.
  return withLocalLeadSubmissionLock(async () => {
    const local = await readLocalDb();
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const addAdmin = Boolean(adminEmail && local.adminUsers.length === 0);
    if (addAdmin) {
      local.adminUsers.push({
        id: randomUUID(),
        email: adminEmail,
        name: 'ASTANA',
        role: 'SUPER_ADMIN',
        active: true,
        passwordHash: '',
        twoFactorSecret: '',
        twoFactorEnabled: false,
        twoFactorBackupCodeHashes: [],
        sessionEpoch: 0,
        createdAt: now(),
        updatedAt: now(),
      });
    }
    const addWorkers = !local.workers.length;
    if (addWorkers) {
      local.workers = defaultWorkers.map((worker) => ({
        id: randomUUID(),
        name: worker.name,
        ratePerM2: worker.ratePerM2,
        active: true,
        createdAt: now(),
        updatedAt: now(),
      }));
    }
    if (addAdmin || addWorkers) await writeLocalDb(local, { writeAdminUsers: addAdmin });
    return local;
  });
}

function money(value: unknown) {
  return Math.max(0, Math.round(Number(value || 0) * 100) / 100);
}

function calculateCosts(input: Omit<BusinessJobCosts, 'jobId' | 'total'>): Omit<BusinessJobCosts, 'jobId'> {
  const costs = {
    fuel: money(input.fuel),
    suits: money(input.suits),
    gloves: money(input.gloves),
    penetrant: money(input.penetrant),
    landfillCost: money(input.landfillCost),
    otherName: String(input.otherName || '').trim(),
    otherAmount: money(input.otherAmount),
  };
  return { ...costs, total: money(costs.fuel + costs.suits + costs.gloves + costs.penetrant + costs.landfillCost + costs.otherAmount) };
}

export async function listWorkers(includeInactive = false): Promise<Worker[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await ensureLocalBusinessDefaults();
    return [...local.workers].filter((worker) => includeInactive || worker.active).sort((a, b) => a.name.localeCompare(b.name, 'sk'));
  }
  const { rows } = await db.query(`SELECT * FROM workers ${includeInactive ? '' : 'WHERE active = true'} ORDER BY name ASC`);
  return rows.map(toWorker);
}

export async function upsertWorker(input: { id?: string; name: string; ratePerM2: number; active?: boolean }): Promise<Worker> {
  await ensureSchema();
  const timestamp = now();
  const db = getPool();
  if (!db) {
    const local = await ensureLocalBusinessDefaults();
    const existing = input.id ? local.workers.find((worker) => worker.id === input.id) : undefined;
    if (existing) {
      existing.name = input.name.trim();
      existing.ratePerM2 = money(input.ratePerM2);
      existing.active = Boolean(input.active);
      existing.updatedAt = timestamp;
      await writeLocalDb(local);
      return existing;
    }
    const worker: Worker = { id: randomUUID(), name: input.name.trim(), ratePerM2: money(input.ratePerM2), active: true, createdAt: timestamp, updatedAt: timestamp };
    local.workers.push(worker);
    await writeLocalDb(local);
    return worker;
  }
  const id = input.id || randomUUID();
  const { rows } = await db.query(
    `INSERT INTO workers (id, name, rate_per_m2, active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$5)
     ON CONFLICT (id) DO UPDATE SET name = $2, rate_per_m2 = $3, active = $4, updated_at = $5
     RETURNING *`,
    [id, input.name.trim(), money(input.ratePerM2), Boolean(input.active ?? true), timestamp],
  );
  return toWorker(rows[0]);
}

export async function listLandfillPrices(): Promise<LandfillPrice[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.landfillPrices].sort((a, b) => b.year - a.year || a.landfill.localeCompare(b.landfill));
  }
  const { rows } = await db.query('SELECT * FROM landfill_prices ORDER BY year DESC, landfill ASC');
  return rows.map(toLandfillPrice);
}

export async function upsertLandfillPrice(input: { id?: string; year: number; landfill: BusinessLandfill; pricePerTon: number }): Promise<LandfillPrice> {
  await ensureSchema();
  const timestamp = now();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const existing = input.id ? local.landfillPrices.find((price) => price.id === input.id) : local.landfillPrices.find((price) => price.year === input.year && price.landfill === input.landfill);
    if (existing) {
      existing.year = input.year;
      existing.landfill = input.landfill;
      existing.pricePerTon = money(input.pricePerTon);
      existing.updatedAt = timestamp;
      await writeLocalDb(local);
      return existing;
    }
    const price: LandfillPrice = { id: randomUUID(), year: input.year, landfill: input.landfill, pricePerTon: money(input.pricePerTon), createdAt: timestamp, updatedAt: timestamp };
    local.landfillPrices.push(price);
    await writeLocalDb(local);
    return price;
  }
  const id = input.id || randomUUID();
  const { rows } = await db.query(
    `INSERT INTO landfill_prices (id, year, landfill, price_per_ton, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$5)
     ON CONFLICT (year, landfill) DO UPDATE SET price_per_ton = $4, updated_at = $5
     RETURNING *`,
    [id, input.year, input.landfill, money(input.pricePerTon), timestamp],
  );
  return toLandfillPrice(rows[0]);
}

export async function deleteLandfillPrice(id: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.landfillPrices = local.landfillPrices.filter((price) => price.id !== id);
    await writeLocalDb(local);
    return;
  }
  await db.query('DELETE FROM landfill_prices WHERE id = $1', [id]);
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const content = await getSiteContentMap();
  return {
    defaultPricePerM2: Number(content.defaultPricePerM2 || 12),
    googleReviewLink: content.googleReviewLink || '',
  };
}

export async function saveBusinessSettings(input: BusinessSettings, actorEmail: string) {
  await upsertSiteContentValues(
    {
      defaultPricePerM2: String(money(input.defaultPricePerM2)),
      googleReviewLink: input.googleReviewLink.trim(),
    },
    actorEmail,
  );
}

export const materialTypeLabels: Record<PriceOfferMaterialType, string> = {
  VLNITY_ETERNIT: 'Vlnitý eternit (AZC)',
  HLADKY_ETERNIT: 'Hladký eternit',
  AZBESTOVE_RURY: 'Azbestové rúry',
  PODHLADOVE_DOSKY: 'Podhľadové dosky',
  BOLETICKY: 'Boletické panely',
  INE: 'Iné',
};

const defaultMaterialPrices: Record<PriceOfferMaterialType, number> = {
  VLNITY_ETERNIT: 10.5,
  HLADKY_ETERNIT: 11.5,
  AZBESTOVE_RURY: 13,
  PODHLADOVE_DOSKY: 12,
  BOLETICKY: 14,
  INE: 0,
};

export async function getPriceOfferSettings(): Promise<PriceOfferSettings> {
  const content = await getSiteContentMap();
  const materialPrices = { ...defaultMaterialPrices };
  for (const key of Object.keys(materialPrices) as PriceOfferMaterialType[]) {
    materialPrices[key] = Number(content[`priceOfferMaterial.${key}`] || materialPrices[key]);
  }
  const vatRate = Number(content.priceOfferVatRate || 23);
  const preparedByName = content.priceOfferPreparedByName || 'Ing. Peklanská Jadroňová';
  const preparedByPhone = content.priceOfferPreparedByPhone || '0918 518 277';
  return {
    materialPrices,
    documentationFee: Number(content.priceOfferDocumentationFee || 161),
    vatRate,
    preparedByName,
    preparedByPhone,
    company: {
      name: content.companyName || 'ASTANA, s.r.o.',
      street: content.companyStreet || 'Scherffelova 1364/28',
      city: content.companyCity || 'Poprad',
      postalCode: content.companyPostalCode || '058 01',
      phone: content.companyPhone || '0905 217 946',
      email: content.companyEmail || 'astana@astana.sk',
      mainWeb: content.companyMainWeb || 'www.astana.sk',
      asbestosWeb: content.companyAsbestosWeb || 'likvidacia-eternitu.sk',
      ico: content.companyIco || '46 157 701',
      dic: content.companyDic || '2023253771',
      icDph: content.companyIcDph || 'SK2023253771',
      authorization: content.companyAuthorization || 'OPPL/3064/2013-Fe',
      preparedByName,
      preparedByPhone,
      vatRate,
    },
  };
}

export async function savePriceOfferSettings(input: PriceOfferSettings, actorEmail: string) {
  await upsertSiteContentValues(
    {
      priceOfferDocumentationFee: String(money(input.documentationFee)),
      priceOfferVatRate: String(money(input.vatRate)),
      priceOfferPreparedByName: input.preparedByName.trim(),
      priceOfferPreparedByPhone: input.preparedByPhone.trim(),
      ...Object.fromEntries(Object.entries(input.materialPrices).map(([key, value]) => [`priceOfferMaterial.${key}`, String(money(value))])),
    },
    actorEmail,
  );
}

export async function calculateLandfillCostForJob(date: string, landfill: BusinessLandfill, wasteKg?: number) {
  const year = new Date(date).getFullYear();
  const weight = money(wasteKg);
  if (!weight || landfill === 'INA') return { cost: 0, missingPrice: false };
  const prices = await listLandfillPrices();
  const price = prices.find((item) => item.year === year && item.landfill === landfill);
  if (!price) return { cost: 0, missingPrice: true };
  return { cost: money((weight / 1000) * price.pricePerTon), missingPrice: false };
}

async function hydrateBusinessJobs(rows: Record<string, unknown>[]): Promise<BusinessJob[]> {
  const ids = rows.map((row) => String(row.id));
  if (!ids.length) return [];
  const db = getPool();
  if (!db) return [];
  const [workerRows, costRows] = await Promise.all([
    db.query('SELECT * FROM business_job_workers WHERE job_id = ANY($1::uuid[])', [ids]),
    db.query('SELECT * FROM business_job_costs WHERE job_id = ANY($1::uuid[])', [ids]),
  ]);
  const workerMap = new Map<string, BusinessJob['workers']>();
  for (const row of workerRows.rows) {
    const jobId = String(row.job_id);
    const items = workerMap.get(jobId) ?? [];
    items.push({
      id: String(row.id),
      jobId,
      workerId: String(row.worker_id),
      workerName: String(row.worker_name),
      m2Share: Number(row.m2_share),
      rate: Number(row.rate),
      reward: Number(row.reward),
      manuallyEdited: Boolean(row.manually_edited),
    });
    workerMap.set(jobId, items);
  }
  const costMap = new Map(costRows.rows.map((row) => [String(row.job_id), toBusinessJobCosts(row)]));
  return rows.map((row) => enrichBusinessJob(row, workerMap.get(String(row.id)) ?? [], costMap.get(String(row.id))));
}

export type BusinessJobListFilters = {
  from?: string;
  to?: string;
  includeArchived?: boolean;
  excludeTestData?: boolean;
  status?: BusinessJobStatus;
  paymentType?: BusinessPaymentType;
  landfill?: BusinessLandfill;
  workerId?: string;
  q?: string;
  /** Defaults to the historical 1,000-row page. Pass null to explicitly request all matches. */
  limit?: number | null;
  offset?: number;
};

export type BusinessJobsSummary = {
  totalCount: number;
  activeCount: number;
  recordedValue: number;
  recordedCost: number;
  recordedRewards: number;
  remainder: number;
  canceledCount: number;
  canceledValue: number;
  archivedCount: number;
  archivedValue: number;
};

function buildBusinessJobsWhere(filters: BusinessJobListFilters = {}) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const add = (condition: (parameter: string) => string, value: unknown) => {
    values.push(value);
    conditions.push(condition(`$${values.length}`));
  };

  if (!filters.includeArchived) conditions.push('j.deleted_at IS NULL');
  if (filters.excludeTestData) conditions.push("COALESCE(j.is_test_data, false) = false AND NOT EXISTS (SELECT 1 FROM leads test_lead WHERE test_lead.id = j.lead_id AND test_lead.is_test_data = true)");
  if (filters.from) add((parameter) => `j.demolition_date >= ${parameter}::date`, filters.from);
  if (filters.to) add((parameter) => `j.demolition_date <= ${parameter}::date`, filters.to);
  if (filters.status) add((parameter) => `j.status = ${parameter}`, filters.status);
  if (filters.paymentType) add((parameter) => `j.payment_type = ${parameter}`, filters.paymentType);
  if (filters.landfill) add((parameter) => `j.landfill = ${parameter}`, filters.landfill);
  if (filters.workerId) {
    add(
      (parameter) => `EXISTS (SELECT 1 FROM business_job_workers worker_filter WHERE worker_filter.job_id = j.id AND worker_filter.worker_id::text = ${parameter})`,
      filters.workerId,
    );
  }
  const search = filters.q?.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('sk');
  if (search) {
    values.push(search);
    const parameter = `$${values.length}`;
    conditions.push(`(
      strpos(translate(lower(COALESCE(j.customer_name, '')), 'áäčďéíĺľňóôŕšťúýž', 'aacdeillnoorstuyz'), ${parameter}) > 0 OR
      strpos(translate(lower(COALESCE(j.location, '')), 'áäčďéíĺľňóôŕšťúýž', 'aacdeillnoorstuyz'), ${parameter}) > 0 OR
      strpos(translate(lower(COALESCE(j.district, '')), 'áäčďéíĺľňóôŕšťúýž', 'aacdeillnoorstuyz'), ${parameter}) > 0
    )`);
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values };
}

function businessJobMatchesFilters(job: BusinessJob, filters: BusinessJobListFilters, testLeadIds = new Set<string>()) {
  const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('sk');
  const search = filters.q?.trim() ? fold(filters.q.trim()) : undefined;
  return (filters.includeArchived || !job.deletedAt)
    && (!filters.excludeTestData || (!job.isTestData && !testLeadIds.has(job.leadId || '')))
    && (!filters.from || job.demolitionDate >= filters.from)
    && (!filters.to || job.demolitionDate <= filters.to)
    && (!filters.status || job.status === filters.status)
    && (!filters.paymentType || job.paymentType === filters.paymentType)
    && (!filters.landfill || job.landfill === filters.landfill)
    && (!filters.workerId || job.workers.some((worker) => worker.workerId === filters.workerId))
    && (!search || [job.customerName, job.location, job.district].some((value) => fold(value).includes(search)));
}

function businessJobPage(filters: BusinessJobListFilters) {
  const requestedLimit = filters.limit === undefined ? 1000 : filters.limit;
  const limit = requestedLimit === null
    ? undefined
    : Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.floor(requestedLimit)
      : 1000;
  const offset = Number.isFinite(filters.offset) && Number(filters.offset) >= 0 ? Math.floor(Number(filters.offset)) : 0;
  return { limit, offset };
}

function sumMoney(values: number[]) {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
}

export async function listBusinessJobs(filters: BusinessJobListFilters = {}): Promise<BusinessJob[]> {
  await ensureSchema();
  const { limit, offset } = businessJobPage(filters);
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const testLeadIds = new Set(local.leads.filter((lead) => lead.isTestData).map((lead) => lead.id));
    const matching = [...local.businessJobs]
      .filter((job) => businessJobMatchesFilters(job, filters, testLeadIds))
      .sort((a, b) => b.demolitionDate.localeCompare(a.demolitionDate) || b.createdAt.localeCompare(a.createdAt));
    return matching.slice(offset, limit === undefined ? undefined : offset + limit);
  }
  const query = buildBusinessJobsWhere(filters);
  const pageValues = [...query.values];
  let pageSql = '';
  if (limit !== undefined) {
    pageValues.push(limit);
    pageSql += ` LIMIT $${pageValues.length}`;
  }
  if (offset > 0) {
    pageValues.push(offset);
    pageSql += ` OFFSET $${pageValues.length}`;
  }
  const { rows } = await db.query(
    `SELECT j.* FROM business_jobs j ${query.where} ORDER BY j.demolition_date DESC, j.created_at DESC, j.id DESC${pageSql}`,
    pageValues,
  );
  return hydrateBusinessJobs(rows);
}

export async function countBusinessJobs(filters: BusinessJobListFilters = {}): Promise<number> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const testLeadIds = new Set(local.leads.filter((lead) => lead.isTestData).map((lead) => lead.id));
    return local.businessJobs.filter((job) => businessJobMatchesFilters(job, filters, testLeadIds)).length;
  }
  const query = buildBusinessJobsWhere(filters);
  const { rows } = await db.query(`SELECT count(*)::bigint AS total FROM business_jobs j ${query.where}`, query.values);
  return Number(rows[0]?.total ?? 0);
}

export async function getBusinessJobsSummary(filters: BusinessJobListFilters = {}): Promise<BusinessJobsSummary> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const testLeadIds = new Set(local.leads.filter((lead) => lead.isTestData).map((lead) => lead.id));
    const jobs = local.businessJobs.filter((job) => businessJobMatchesFilters(job, filters, testLeadIds));
    const active = jobs.filter((job) => !job.deletedAt && job.status !== 'ZRUSENA');
    const canceled = jobs.filter((job) => !job.deletedAt && job.status === 'ZRUSENA');
    const archived = jobs.filter((job) => Boolean(job.deletedAt));
    const recordedValue = sumMoney(active.map((job) => job.totalPrice));
    const recordedCost = sumMoney(active.map((job) => job.costs.total));
    const recordedRewards = sumMoney(active.map((job) => job.rewardsTotal));
    return {
      totalCount: jobs.length,
      activeCount: active.length,
      recordedValue,
      recordedCost,
      recordedRewards,
      remainder: Math.round((recordedValue - recordedCost - recordedRewards) * 100) / 100,
      canceledCount: canceled.length,
      canceledValue: sumMoney(canceled.map((job) => job.totalPrice)),
      archivedCount: archived.length,
      archivedValue: sumMoney(archived.map((job) => job.totalPrice)),
    };
  }
  const query = buildBusinessJobsWhere(filters);
  const { rows } = await db.query(
    `SELECT
       count(*)::bigint AS total_count,
       count(*) FILTER (WHERE j.deleted_at IS NULL AND j.status <> 'ZRUSENA')::bigint AS active_count,
       COALESCE(sum(j.total_price) FILTER (WHERE j.deleted_at IS NULL AND j.status <> 'ZRUSENA'), 0)::numeric AS recorded_value,
       COALESCE(sum(COALESCE(costs.total, 0)) FILTER (WHERE j.deleted_at IS NULL AND j.status <> 'ZRUSENA'), 0)::numeric AS recorded_cost,
       COALESCE(sum(COALESCE(rewards.total, 0)) FILTER (WHERE j.deleted_at IS NULL AND j.status <> 'ZRUSENA'), 0)::numeric AS recorded_rewards,
       COALESCE(sum(j.total_price - COALESCE(costs.total, 0) - COALESCE(rewards.total, 0)) FILTER (WHERE j.deleted_at IS NULL AND j.status <> 'ZRUSENA'), 0)::numeric AS remainder,
       count(*) FILTER (WHERE j.deleted_at IS NULL AND j.status = 'ZRUSENA')::bigint AS canceled_count,
       COALESCE(sum(j.total_price) FILTER (WHERE j.deleted_at IS NULL AND j.status = 'ZRUSENA'), 0)::numeric AS canceled_value,
       count(*) FILTER (WHERE j.deleted_at IS NOT NULL)::bigint AS archived_count,
       COALESCE(sum(j.total_price) FILTER (WHERE j.deleted_at IS NOT NULL), 0)::numeric AS archived_value
     FROM business_jobs j
     LEFT JOIN business_job_costs costs ON costs.job_id = j.id
     LEFT JOIN (
       SELECT job_id, sum(reward)::numeric AS total
       FROM business_job_workers
       GROUP BY job_id
     ) rewards ON rewards.job_id = j.id
     ${query.where}`,
    query.values,
  );
  const row = rows[0] ?? {};
  return {
    totalCount: Number(row.total_count ?? 0),
    activeCount: Number(row.active_count ?? 0),
    recordedValue: Number(row.recorded_value ?? 0),
    recordedCost: Number(row.recorded_cost ?? 0),
    recordedRewards: Number(row.recorded_rewards ?? 0),
    remainder: Number(row.remainder ?? 0),
    canceledCount: Number(row.canceled_count ?? 0),
    canceledValue: Number(row.canceled_value ?? 0),
    archivedCount: Number(row.archived_count ?? 0),
    archivedValue: Number(row.archived_value ?? 0),
  };
}

export async function getBusinessJob(id: string, includeArchived = false): Promise<BusinessJob | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.businessJobs.find((job) => job.id === id && (includeArchived || !job.deletedAt)) ?? null;
  }
  const { rows } = await db.query(`SELECT * FROM business_jobs WHERE id = $1 ${includeArchived ? '' : 'AND deleted_at IS NULL'} LIMIT 1`, [id]);
  if (!rows[0]) return null;
  const jobs = await hydrateBusinessJobs(rows);
  return jobs[0] ?? null;
}

export async function getBusinessJobIdByLeadId(leadId: string): Promise<string | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.businessJobs.find((job) => job.leadId === leadId && !job.deletedAt)?.id ?? null;
  }
  const { rows } = await db.query('SELECT id FROM business_jobs WHERE lead_id = $1 AND deleted_at IS NULL LIMIT 1', [leadId]);
  return rows[0]?.id ? String(rows[0].id) : null;
}

export async function getBusinessJobWithActivity(id: string): Promise<BusinessJobWithActivity | null> {
  const job = await getBusinessJob(id, true);
  if (!job) return null;
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return {
      ...job,
      activityLogs: local.auditLogs.filter((log) => log.entityId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }
  const { rows } = await db.query('SELECT * FROM audit_logs WHERE entity_id = $1 ORDER BY created_at DESC', [id]);
  return { ...job, activityLogs: rows.map(toAuditLog) };
}

const financeReasonCodes = new Set(['DUPLICATE', 'DATA_ERROR', 'CUSTOMER_CANCELLED', 'REFUNDED', 'OTHER']);
const financePaymentMethods = new Set<BusinessPaymentMethod>(['BANK_TRANSFER', 'CASH', 'CARD', 'OTHER']);

function requireFinanceUuid(value: string, label: string) {
  if (!uuidPattern.test(value)) throw new Error(`${label} nemá platný identifikátor.`);
  return value;
}

function requireFinanceDate(value: string, label: string) {
  if (!isValidIsoCalendarDate(value)) throw new Error(`${label} nemá platný dátum.`);
  return value;
}

function requireFinanceEventDate(value: string, label: string) {
  requireFinanceDate(value, label);
  if (value > dateOnly(new Date())) throw new Error(`${label} nemôže byť v budúcnosti.`);
  return value;
}

function requireFinanceCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_BUSINESS_FINANCE_CENTS) {
    throw new Error(`${label} musí byť kladná suma v eurocentoch.`);
  }
  return value;
}

function requireFinanceReason(value: string) {
  const reason = value.trim().toUpperCase();
  if (!financeReasonCodes.has(reason)) throw new Error('Vyberte platný dôvod opravy.');
  return reason;
}

function financeRequestHash(kind: string, payload: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify({ kind, ...payload })).digest('hex');
}

function financeAuditLog(
  jobId: string,
  action: string,
  actorEmail: string,
  changes: Record<string, unknown>,
): AuditLog {
  return {
    id: randomUUID(),
    entityType: 'business_job',
    entityId: jobId,
    action,
    actorEmail: actorEmail.trim().toLowerCase(),
    changes,
    createdAt: now(),
  };
}

async function insertFinanceAudit(client: PoolClient, log: AuditLog) {
  await client.query(
    'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [log.id, log.entityType, log.entityId, log.action, log.actorEmail, log.changes, log.createdAt],
  );
}

export async function getBusinessJobFinance(jobId: string): Promise<BusinessJobFinance> {
  await ensureSchema();
  requireFinanceUuid(jobId, 'Zákazka');
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return projectBusinessJobFinance(
      local.businessJobInvoices.filter((item) => item.jobId === jobId),
      local.businessJobPaymentEvents.filter((item) => item.jobId === jobId),
      dateInBratislava(new Date()),
    );
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const invoiceResult = await client.query(
      'SELECT * FROM business_job_invoices WHERE job_id = $1 ORDER BY issued_on DESC, created_at DESC',
      [jobId],
    );
    const eventResult = await client.query(
      'SELECT * FROM business_job_payment_events WHERE job_id = $1 ORDER BY occurred_on DESC, created_at DESC',
      [jobId],
    );
    await client.query('COMMIT');
    return projectBusinessJobFinance(
      invoiceResult.rows.map(toBusinessJobInvoice),
      eventResult.rows.map(toBusinessJobPaymentEvent),
      dateInBratislava(new Date()),
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function loadReportableBusinessFinanceEvidence(): Promise<{
  invoices: BusinessJobInvoice[];
  paymentEvents: BusinessJobPaymentEvent[];
}> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const testLeadIds = new Set(local.leads.filter((lead) => lead.isTestData).map((lead) => lead.id));
    const allowedJobIds = new Set(local.businessJobs.filter((job) => !job.isTestData && !(job.leadId && testLeadIds.has(job.leadId))).map((job) => job.id));
    return {
      invoices: local.businessJobInvoices.filter((invoice) => allowedJobIds.has(invoice.jobId)),
      paymentEvents: local.businessJobPaymentEvents.filter((event) => allowedJobIds.has(event.jobId)),
    };
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const invoices = await client.query(
      `SELECT invoice.* FROM business_job_invoices invoice
       JOIN business_jobs job ON job.id = invoice.job_id
       LEFT JOIN leads lead ON lead.id = job.lead_id
       WHERE COALESCE(job.is_test_data, false) = false AND COALESCE(lead.is_test_data, false) = false`,
    );
    const events = await client.query(
      `SELECT event.* FROM business_job_payment_events event
       JOIN business_jobs job ON job.id = event.job_id
       LEFT JOIN leads lead ON lead.id = job.lead_id
       WHERE COALESCE(job.is_test_data, false) = false AND COALESCE(lead.is_test_data, false) = false`,
    );
    await client.query('COMMIT');
    return { invoices: invoices.rows.map(toBusinessJobInvoice), paymentEvents: events.rows.map(toBusinessJobPaymentEvent) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listBusinessFinanceEvidence() {
  return loadReportableBusinessFinanceEvidence();
}

export async function getBusinessFinanceSummary(from: string, to: string): Promise<BusinessFinanceSummary> {
  requireFinanceDate(from, 'Začiatok obdobia');
  requireFinanceDate(to, 'Koniec obdobia');
  if (to < from) throw new Error('Koniec obdobia nemôže byť pred začiatkom.');
  const { invoices, paymentEvents } = await loadReportableBusinessFinanceEvidence();
  const inPeriod = (value: string) => value >= from && value <= to;
  const invoicesInPeriod = invoices.filter((invoice) => inPeriod(invoice.issuedOn));
  const cancellationsInPeriod = invoices.filter((invoice) => invoice.cancelledOn && inPeriod(invoice.cancelledOn));
  const receiptsInPeriod = paymentEvents.filter((event) => event.eventType === 'RECEIPT' && inPeriod(event.occurredOn));
  const reversalsInPeriod = paymentEvents.filter((event) => event.eventType === 'REVERSAL' && inPeriod(event.occurredOn));
  const jobIds = new Set([...invoices.map((item) => item.jobId), ...paymentEvents.map((item) => item.jobId)]);
  const projections = [...jobIds].map((jobId) => projectBusinessJobFinance(
    invoices.filter((item) => item.jobId === jobId),
    paymentEvents.filter((item) => item.jobId === jobId),
    dateInBratislava(new Date()),
  ));
  return {
    invoicedInPeriodCents: invoicesInPeriod.reduce((sum, item) => sum + item.amountWithVatCents, 0),
    cancelledInPeriodCents: cancellationsInPeriod.reduce((sum, item) => sum + item.amountWithVatCents, 0),
    receivedInPeriodCents: receiptsInPeriod.reduce((sum, item) => sum + item.amountCents, 0),
    reversedInPeriodCents: reversalsInPeriod.reduce((sum, item) => sum + item.amountCents, 0),
    netReceivedInPeriodCents: receiptsInPeriod.reduce((sum, item) => sum + item.amountCents, 0)
      - reversalsInPeriod.reduce((sum, item) => sum + item.amountCents, 0),
    currentOutstandingCents: projections.reduce((sum, item) => sum + item.outstandingCents, 0),
    currentOverdueCents: projections.reduce((sum, item) => sum + item.overdueCents, 0),
    currentUnallocatedCents: projections.reduce((sum, item) => sum + item.unallocatedReceivedCents, 0),
    currentOverpaidCents: projections.reduce((sum, item) => sum + item.overpaidCents, 0),
    jobsWithEvidence: jobIds.size,
  };
}

export async function listBusinessFinanceMonthlySummary(year: number): Promise<BusinessFinanceMonthlySummary[]> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Rok finančného prehľadu nie je platný.');
  const { invoices, paymentEvents } = await loadReportableBusinessFinanceEvidence();
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const issued = invoices.filter((item) => item.issuedOn.startsWith(prefix));
    const cancelled = invoices.filter((item) => item.cancelledOn?.startsWith(prefix));
    const receipts = paymentEvents.filter((item) => item.eventType === 'RECEIPT' && item.occurredOn.startsWith(prefix));
    const reversals = paymentEvents.filter((item) => item.eventType === 'REVERSAL' && item.occurredOn.startsWith(prefix));
    const receivedCents = receipts.reduce((sum, item) => sum + item.amountCents, 0);
    const reversedCents = reversals.reduce((sum, item) => sum + item.amountCents, 0);
    return {
      month,
      invoicedCents: issued.reduce((sum, item) => sum + item.amountWithVatCents, 0),
      cancelledCents: cancelled.reduce((sum, item) => sum + item.amountWithVatCents, 0),
      receivedCents,
      reversedCents,
      netReceivedCents: receivedCents - reversedCents,
    };
  });
}

export async function recordBusinessInvoice(
  jobId: string,
  input: BusinessJobInvoiceInput,
  actorEmail: string,
): Promise<BusinessJobInvoice> {
  await ensureSchema();
  requireFinanceUuid(jobId, 'Zákazka');
  requireFinanceUuid(input.operationId, 'Operácia');
  const invoiceNumber = input.invoiceNumber.trim().replace(/\s+/g, ' ');
  if (!invoiceNumber || invoiceNumber.length > 80) throw new Error('Číslo faktúry je povinné a môže mať najviac 80 znakov.');
  requireFinanceEventDate(input.issuedOn, 'Dátum vystavenia');
  if (input.dueOn) requireFinanceDate(input.dueOn, 'Dátum splatnosti');
  if (input.dueOn && input.dueOn < input.issuedOn) throw new Error('Dátum splatnosti nemôže byť pred dátumom vystavenia.');
  requireFinanceCents(input.amountWithoutVatCents, 'Suma bez DPH');
  if (!Number.isSafeInteger(input.vatRateBasisPoints) || input.vatRateBasisPoints < 0 || input.vatRateBasisPoints > 10_000) {
    throw new Error('Sadzba DPH nie je platná.');
  }
  requireFinanceCents(input.amountWithVatCents, 'Suma s DPH');
  const expectedWithVat = input.amountWithoutVatCents + Math.round(input.amountWithoutVatCents * input.vatRateBasisPoints / 10_000);
  if (input.amountWithVatCents !== expectedWithVat) throw new Error('Suma s DPH nezodpovedá základu a sadzbe DPH.');
  const normalized = {
    jobId,
    invoiceNumber: invoiceNumber.toLocaleLowerCase('sk-SK'),
    issuedOn: input.issuedOn,
    dueOn: input.dueOn || '',
    amountWithoutVatCents: input.amountWithoutVatCents,
    vatRateBasisPoints: input.vatRateBasisPoints,
    amountWithVatCents: input.amountWithVatCents,
  };
  const requestHash = financeRequestHash('invoice-recorded', normalized);
  const timestamp = now();
  const invoice: BusinessJobInvoice = {
    id: randomUUID(), jobId, operationId: input.operationId, requestHash, invoiceNumber,
    issuedOn: input.issuedOn, dueOn: input.dueOn || undefined,
    amountWithoutVatCents: input.amountWithoutVatCents,
    vatRateBasisPoints: input.vatRateBasisPoints,
    amountWithVatCents: input.amountWithVatCents,
    createdAt: timestamp, createdBy: actorEmail.trim().toLowerCase(),
  };
  const db = getPool();
  if (!db) return withLocalLeadSubmissionLock(async () => {
    const local = await readLocalDb();
    const existingOperation = local.businessJobInvoices.find((item) => item.operationId === input.operationId);
    if (existingOperation) {
      if (existingOperation.requestHash !== requestHash) throw new Error('Táto operácia už bola použitá s inými údajmi.');
      return existingOperation;
    }
    if (local.businessJobInvoices.some((item) => item.cancelOperationId === input.operationId)
      || local.businessJobPaymentEvents.some((item) => item.operationId === input.operationId)) {
      throw new Error('Táto operácia už bola použitá na inú finančnú udalosť.');
    }
    const targetJob = local.businessJobs.find((item) => item.id === jobId);
    if (!targetJob) throw new Error('Zákazka sa nenašla.');
    if (targetJob.deletedAt) throw new Error('K archivovanej zákazke nemožno pridať novú faktúru.');
    if (local.businessJobInvoices.some((item) => item.invoiceNumber.trim().toLocaleLowerCase('sk-SK') === normalized.invoiceNumber)) {
      throw new Error('Faktúra s týmto číslom je už evidovaná.');
    }
    local.businessJobInvoices.push(invoice);
    local.auditLogs.unshift(financeAuditLog(jobId, 'business_invoice_recorded', actorEmail, {
      invoiceId: invoice.id, issuedOn: invoice.issuedOn, dueOn: invoice.dueOn,
      amountWithoutVatCents: invoice.amountWithoutVatCents, vatRateBasisPoints: invoice.vatRateBasisPoints,
      amountWithVatCents: invoice.amountWithVatCents,
    }));
    await writeLocalDb(local);
    return invoice;
  });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.operationId]);
    const prior = await client.query('SELECT * FROM business_job_invoices WHERE operation_id = $1 FOR UPDATE', [input.operationId]);
    if (prior.rows[0]) {
      const existing = toBusinessJobInvoice(prior.rows[0]);
      if (existing.requestHash !== requestHash) throw new Error('Táto operácia už bola použitá s inými údajmi.');
      await client.query('COMMIT');
      return existing;
    }
    const job = await client.query('SELECT id, deleted_at FROM business_jobs WHERE id = $1 FOR UPDATE', [jobId]);
    if (!job.rowCount) throw new Error('Zákazka sa nenašla.');
    if (job.rows[0].deleted_at) throw new Error('K archivovanej zákazke nemožno pridať novú faktúru.');
    const operationConflict = await client.query(
      `SELECT EXISTS (SELECT 1 FROM business_job_invoices WHERE cancel_operation_id = $1)
           OR EXISTS (SELECT 1 FROM business_job_payment_events WHERE operation_id = $1) AS present`,
      [input.operationId],
    );
    if (operationConflict.rows[0]?.present) throw new Error('Táto operácia už bola použitá na inú finančnú udalosť.');
    const duplicate = await client.query('SELECT id FROM business_job_invoices WHERE lower(btrim(invoice_number)) = lower(btrim($1)) LIMIT 1', [invoiceNumber]);
    if (duplicate.rowCount) throw new Error('Faktúra s týmto číslom je už evidovaná.');
    const inserted = await client.query(
      `INSERT INTO business_job_invoices
       (id, job_id, operation_id, request_hash, invoice_number, issued_on, due_on, amount_without_vat_cents, vat_rate_basis_points, amount_with_vat_cents, created_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [invoice.id, jobId, input.operationId, requestHash, invoiceNumber, input.issuedOn, input.dueOn || null,
        input.amountWithoutVatCents, input.vatRateBasisPoints, input.amountWithVatCents, timestamp, invoice.createdBy],
    );
    await insertFinanceAudit(client, financeAuditLog(jobId, 'business_invoice_recorded', actorEmail, {
      invoiceId: invoice.id, issuedOn: invoice.issuedOn, dueOn: invoice.dueOn,
      amountWithoutVatCents: invoice.amountWithoutVatCents, vatRateBasisPoints: invoice.vatRateBasisPoints,
      amountWithVatCents: invoice.amountWithVatCents,
    }));
    await client.query('COMMIT');
    return toBusinessJobInvoice(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505'
      && 'constraint' in error && error.constraint === 'business_job_invoices_number_uq') {
      throw new Error('Faktúra s týmto číslom je už evidovaná.');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelBusinessInvoice(
  jobId: string,
  invoiceId: string,
  input: BusinessJobInvoiceCancellationInput,
  actorEmail: string,
): Promise<BusinessJobInvoice> {
  await ensureSchema();
  requireFinanceUuid(jobId, 'Zákazka');
  requireFinanceUuid(invoiceId, 'Faktúra');
  requireFinanceUuid(input.operationId, 'Operácia');
  requireFinanceEventDate(input.cancelledOn, 'Dátum storna');
  const reasonCode = requireFinanceReason(input.reasonCode);
  const requestHash = financeRequestHash('invoice-cancelled', { jobId, invoiceId, cancelledOn: input.cancelledOn, reasonCode });
  const timestamp = now();
  const db = getPool();
  if (!db) return withLocalLeadSubmissionLock(async () => {
    const local = await readLocalDb();
    const sameOperation = local.businessJobInvoices.find((item) => item.cancelOperationId === input.operationId);
    if (sameOperation) {
      if (sameOperation.cancelRequestHash !== requestHash) throw new Error('Táto operácia už bola použitá s inými údajmi.');
      return sameOperation;
    }
    if (local.businessJobInvoices.some((item) => item.operationId === input.operationId)
      || local.businessJobPaymentEvents.some((item) => item.operationId === input.operationId)) {
      throw new Error('Táto operácia už bola použitá na inú finančnú udalosť.');
    }
    const invoice = local.businessJobInvoices.find((item) => item.id === invoiceId && item.jobId === jobId);
    if (!invoice) throw new Error('Faktúra sa nenašla.');
    if (invoice.cancelledAt) throw new Error('Faktúra už bola stornovaná.');
    if (input.cancelledOn < invoice.issuedOn) throw new Error('Dátum storna nemôže byť pred dátumom vystavenia faktúry.');
    const reversedIds = new Set(local.businessJobPaymentEvents.filter((item) => item.eventType === 'REVERSAL').map((item) => item.reversalOf));
    if (local.businessJobPaymentEvents.some((item) => item.eventType === 'RECEIPT' && item.invoiceId === invoiceId && !reversedIds.has(item.id))) {
      throw new Error('Faktúru s aktívnou úhradou nemožno stornovať. Najprv stornujte priradenú úhradu.');
    }
    invoice.cancelledOn = input.cancelledOn;
    invoice.cancelledAt = timestamp;
    invoice.cancelledBy = actorEmail.trim().toLowerCase();
    invoice.cancelReasonCode = reasonCode;
    invoice.cancelOperationId = input.operationId;
    invoice.cancelRequestHash = requestHash;
    local.auditLogs.unshift(financeAuditLog(jobId, 'business_invoice_cancelled', actorEmail, {
      invoiceId, cancelledOn: input.cancelledOn, reasonCode,
    }));
    await writeLocalDb(local);
    return invoice;
  });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.operationId]);
    const sameOperation = await client.query('SELECT * FROM business_job_invoices WHERE cancel_operation_id = $1 FOR UPDATE', [input.operationId]);
    if (sameOperation.rows[0]) {
      const existing = toBusinessJobInvoice(sameOperation.rows[0]);
      if (existing.cancelRequestHash !== requestHash) throw new Error('Táto operácia už bola použitá s inými údajmi.');
      await client.query('COMMIT');
      return existing;
    }
    const operationConflict = await client.query(
      `SELECT EXISTS (SELECT 1 FROM business_job_invoices WHERE operation_id = $1)
           OR EXISTS (SELECT 1 FROM business_job_payment_events WHERE operation_id = $1) AS present`,
      [input.operationId],
    );
    if (operationConflict.rows[0]?.present) throw new Error('Táto operácia už bola použitá na inú finančnú udalosť.');
    const current = await client.query('SELECT * FROM business_job_invoices WHERE id = $1 AND job_id = $2 FOR UPDATE', [invoiceId, jobId]);
    if (!current.rows[0]) throw new Error('Faktúra sa nenašla.');
    if (current.rows[0].cancelled_at) throw new Error('Faktúra už bola stornovaná.');
    if (input.cancelledOn < dateOnly(current.rows[0].issued_on)) throw new Error('Dátum storna nemôže byť pred dátumom vystavenia faktúry.');
    const activePayment = await client.query(
      `SELECT receipt.id FROM business_job_payment_events receipt
       WHERE receipt.invoice_id = $1 AND receipt.event_type = 'RECEIPT'
         AND NOT EXISTS (
           SELECT 1 FROM business_job_payment_events reversal
           WHERE reversal.reversal_of = receipt.id AND reversal.event_type = 'REVERSAL'
         )
       LIMIT 1 FOR UPDATE OF receipt`,
      [invoiceId],
    );
    if (activePayment.rowCount) throw new Error('Faktúru s aktívnou úhradou nemožno stornovať. Najprv stornujte priradenú úhradu.');
    const updated = await client.query(
      `UPDATE business_job_invoices SET cancelled_on = $3, cancelled_at = $4, cancelled_by = $5,
       cancel_reason_code = $6, cancel_operation_id = $7, cancel_request_hash = $8
       WHERE id = $1 AND job_id = $2 RETURNING *`,
      [invoiceId, jobId, input.cancelledOn, timestamp, actorEmail.trim().toLowerCase(), reasonCode, input.operationId, requestHash],
    );
    await insertFinanceAudit(client, financeAuditLog(jobId, 'business_invoice_cancelled', actorEmail, {
      invoiceId, cancelledOn: input.cancelledOn, reasonCode,
    }));
    await client.query('COMMIT');
    return toBusinessJobInvoice(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordBusinessPayment(
  jobId: string,
  input: BusinessJobPaymentInput,
  actorEmail: string,
): Promise<BusinessJobPaymentEvent> {
  await ensureSchema();
  requireFinanceUuid(jobId, 'Zákazka');
  requireFinanceUuid(input.operationId, 'Operácia');
  if (input.invoiceId) requireFinanceUuid(input.invoiceId, 'Faktúra');
  requireFinanceEventDate(input.occurredOn, 'Dátum úhrady');
  requireFinanceCents(input.amountCents, 'Prijatá suma');
  if (!financePaymentMethods.has(input.method)) throw new Error('Vyberte platný spôsob úhrady.');
  const reference = (input.reference ?? '').trim().replace(/\s+/g, ' ');
  if (reference.length > 80) throw new Error('Referencia môže mať najviac 80 znakov.');
  const normalized = { jobId, invoiceId: input.invoiceId || '', occurredOn: input.occurredOn, amountCents: input.amountCents, method: input.method, reference };
  const requestHash = financeRequestHash('payment-received', normalized);
  const event: BusinessJobPaymentEvent = {
    id: randomUUID(), jobId, invoiceId: input.invoiceId || undefined, operationId: input.operationId, requestHash,
    eventType: 'RECEIPT', occurredOn: input.occurredOn, amountCents: input.amountCents,
    method: input.method, reference, createdAt: now(), createdBy: actorEmail.trim().toLowerCase(),
  };
  const db = getPool();
  if (!db) return withLocalLeadSubmissionLock(async () => {
    const local = await readLocalDb();
    const existing = local.businessJobPaymentEvents.find((item) => item.operationId === input.operationId);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new Error('Táto operácia už bola použitá s inými údajmi.');
      return existing;
    }
    if (local.businessJobInvoices.some((item) => item.operationId === input.operationId || item.cancelOperationId === input.operationId)) {
      throw new Error('Táto operácia už bola použitá na inú finančnú udalosť.');
    }
    const targetJob = local.businessJobs.find((item) => item.id === jobId);
    if (!targetJob) throw new Error('Zákazka sa nenašla.');
    if (targetJob.deletedAt) throw new Error('K archivovanej zákazke nemožno pridať novú úhradu.');
    if (input.invoiceId) {
      const invoice = local.businessJobInvoices.find((item) => item.id === input.invoiceId && item.jobId === jobId);
      if (!invoice) throw new Error('Faktúra nepatrí k tejto zákazke.');
      if (invoice.cancelledAt) throw new Error('Úhradu nemožno priradiť k stornovanej faktúre.');
    }
    local.businessJobPaymentEvents.push(event);
    local.auditLogs.unshift(financeAuditLog(jobId, 'business_payment_recorded', actorEmail, {
      paymentEventId: event.id, invoiceId: event.invoiceId, occurredOn: event.occurredOn,
      amountCents: event.amountCents, method: event.method, allocated: Boolean(event.invoiceId),
    }));
    await writeLocalDb(local);
    return event;
  });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.operationId]);
    const existingResult = await client.query('SELECT * FROM business_job_payment_events WHERE operation_id = $1 FOR UPDATE', [input.operationId]);
    if (existingResult.rows[0]) {
      const existing = toBusinessJobPaymentEvent(existingResult.rows[0]);
      if (existing.requestHash !== requestHash) throw new Error('Táto operácia už bola použitá s inými údajmi.');
      await client.query('COMMIT');
      return existing;
    }
    const job = await client.query('SELECT id, deleted_at FROM business_jobs WHERE id = $1 FOR UPDATE', [jobId]);
    if (!job.rowCount) throw new Error('Zákazka sa nenašla.');
    if (job.rows[0].deleted_at) throw new Error('K archivovanej zákazke nemožno pridať novú úhradu.');
    const operationConflict = await client.query(
      'SELECT EXISTS (SELECT 1 FROM business_job_invoices WHERE operation_id = $1 OR cancel_operation_id = $1) AS present',
      [input.operationId],
    );
    if (operationConflict.rows[0]?.present) throw new Error('Táto operácia už bola použitá na inú finančnú udalosť.');
    if (input.invoiceId) {
      const invoice = await client.query('SELECT cancelled_at FROM business_job_invoices WHERE id = $1 AND job_id = $2 FOR UPDATE', [input.invoiceId, jobId]);
      if (!invoice.rows[0]) throw new Error('Faktúra nepatrí k tejto zákazke.');
      if (invoice.rows[0].cancelled_at) throw new Error('Úhradu nemožno priradiť k stornovanej faktúre.');
    }
    const inserted = await client.query(
      `INSERT INTO business_job_payment_events
       (id, job_id, invoice_id, operation_id, request_hash, event_type, occurred_on, amount_cents, method, reference, reversal_of, reason_code, created_at, created_by)
       VALUES ($1,$2,$3,$4,$5,'RECEIPT',$6,$7,$8,$9,NULL,'',$10,$11) RETURNING *`,
      [event.id, jobId, input.invoiceId || null, input.operationId, requestHash, input.occurredOn,
        input.amountCents, input.method, reference, event.createdAt, event.createdBy],
    );
    await insertFinanceAudit(client, financeAuditLog(jobId, 'business_payment_recorded', actorEmail, {
      paymentEventId: event.id, invoiceId: event.invoiceId, occurredOn: event.occurredOn,
      amountCents: event.amountCents, method: event.method, allocated: Boolean(event.invoiceId),
    }));
    await client.query('COMMIT');
    return toBusinessJobPaymentEvent(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function reverseBusinessPayment(
  jobId: string,
  receiptId: string,
  input: BusinessJobPaymentReversalInput,
  actorEmail: string,
): Promise<BusinessJobPaymentEvent> {
  await ensureSchema();
  requireFinanceUuid(jobId, 'Zákazka');
  requireFinanceUuid(receiptId, 'Úhrada');
  requireFinanceUuid(input.operationId, 'Operácia');
  requireFinanceEventDate(input.occurredOn, 'Dátum storna úhrady');
  const reasonCode = requireFinanceReason(input.reasonCode);
  const requestHash = financeRequestHash('payment-reversed', { jobId, receiptId, occurredOn: input.occurredOn, reasonCode });
  const db = getPool();
  if (!db) return withLocalLeadSubmissionLock(async () => {
    const local = await readLocalDb();
    const existingOperation = local.businessJobPaymentEvents.find((item) => item.operationId === input.operationId);
    if (existingOperation) {
      if (existingOperation.requestHash !== requestHash) throw new Error('Táto operácia už bola použitá s inými údajmi.');
      return existingOperation;
    }
    if (local.businessJobInvoices.some((item) => item.operationId === input.operationId || item.cancelOperationId === input.operationId)) {
      throw new Error('Táto operácia už bola použitá na inú finančnú udalosť.');
    }
    const receipt = local.businessJobPaymentEvents.find((item) => item.id === receiptId && item.jobId === jobId && item.eventType === 'RECEIPT');
    if (!receipt) throw new Error('Prijatá úhrada sa nenašla.');
    if (input.occurredOn < receipt.occurredOn) throw new Error('Dátum storna nemôže byť pred dátumom prijatia úhrady.');
    if (local.businessJobPaymentEvents.some((item) => item.eventType === 'REVERSAL' && item.reversalOf === receiptId)) {
      throw new Error('Táto úhrada už bola stornovaná.');
    }
    const event: BusinessJobPaymentEvent = {
      id: randomUUID(), jobId, invoiceId: receipt.invoiceId, operationId: input.operationId, requestHash,
      eventType: 'REVERSAL', occurredOn: input.occurredOn, amountCents: receipt.amountCents,
      method: receipt.method, reference: '', reversalOf: receipt.id, reasonCode,
      createdAt: now(), createdBy: actorEmail.trim().toLowerCase(),
    };
    local.businessJobPaymentEvents.push(event);
    local.auditLogs.unshift(financeAuditLog(jobId, 'business_payment_reversed', actorEmail, {
      paymentEventId: event.id, reversalOf: receipt.id, invoiceId: receipt.invoiceId,
      occurredOn: event.occurredOn, amountCents: event.amountCents, reasonCode,
    }));
    await writeLocalDb(local);
    return event;
  });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.operationId]);
    const existingResult = await client.query('SELECT * FROM business_job_payment_events WHERE operation_id = $1 FOR UPDATE', [input.operationId]);
    if (existingResult.rows[0]) {
      const existing = toBusinessJobPaymentEvent(existingResult.rows[0]);
      if (existing.requestHash !== requestHash) throw new Error('Táto operácia už bola použitá s inými údajmi.');
      await client.query('COMMIT');
      return existing;
    }
    const operationConflict = await client.query(
      'SELECT EXISTS (SELECT 1 FROM business_job_invoices WHERE operation_id = $1 OR cancel_operation_id = $1) AS present',
      [input.operationId],
    );
    if (operationConflict.rows[0]?.present) throw new Error('Táto operácia už bola použitá na inú finančnú udalosť.');
    const receiptResult = await client.query(
      `SELECT * FROM business_job_payment_events
       WHERE id = $1 AND job_id = $2 AND event_type = 'RECEIPT' FOR UPDATE`,
      [receiptId, jobId],
    );
    if (!receiptResult.rows[0]) throw new Error('Prijatá úhrada sa nenašla.');
    const receipt = toBusinessJobPaymentEvent(receiptResult.rows[0]);
    if (input.occurredOn < receipt.occurredOn) throw new Error('Dátum storna nemôže byť pred dátumom prijatia úhrady.');
    const reversal = await client.query("SELECT id FROM business_job_payment_events WHERE reversal_of = $1 AND event_type = 'REVERSAL' LIMIT 1", [receiptId]);
    if (reversal.rowCount) throw new Error('Táto úhrada už bola stornovaná.');
    const event: BusinessJobPaymentEvent = {
      id: randomUUID(), jobId, invoiceId: receipt.invoiceId, operationId: input.operationId, requestHash,
      eventType: 'REVERSAL', occurredOn: input.occurredOn, amountCents: receipt.amountCents,
      method: receipt.method, reference: '', reversalOf: receipt.id, reasonCode,
      createdAt: now(), createdBy: actorEmail.trim().toLowerCase(),
    };
    const inserted = await client.query(
      `INSERT INTO business_job_payment_events
       (id, job_id, invoice_id, operation_id, request_hash, event_type, occurred_on, amount_cents, method, reference, reversal_of, reason_code, created_at, created_by)
       VALUES ($1,$2,$3,$4,$5,'REVERSAL',$6,$7,$8,'',$9,$10,$11,$12) RETURNING *`,
      [event.id, jobId, event.invoiceId || null, input.operationId, requestHash, input.occurredOn,
        event.amountCents, event.method, receiptId, reasonCode, event.createdAt, event.createdBy],
    );
    await insertFinanceAudit(client, financeAuditLog(jobId, 'business_payment_reversed', actorEmail, {
      paymentEventId: event.id, reversalOf: receipt.id, invoiceId: receipt.invoiceId,
      occurredOn: event.occurredOn, amountCents: event.amountCents, reasonCode,
    }));
    await client.query('COMMIT');
    return toBusinessJobPaymentEvent(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteBusinessJob(id: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    await withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const job = local.businessJobs.find((item) => item.id === id && !item.deletedAt);
      if (!job) return;
      const timestamp = now();
      job.deletedAt = timestamp;
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'business_job', entityId: id, action: 'business_job_archived', actorEmail, changes: {}, createdAt: timestamp });
      await writeLocalDb(local);
    });
    return;
  }
  await db.query('UPDATE business_jobs SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL', [id]);
  await addAuditLog('business_job', id, 'business_job_archived', actorEmail, {});
}

export async function destroyBusinessJob(id: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    await withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const job = local.businessJobs.find((item) => item.id === id);
      if (!job) return;
      if (local.businessJobInvoices.some((item) => item.jobId === id)
        || local.businessJobPaymentEvents.some((item) => item.jobId === id)) {
        throw new Error('Zákazku s evidovanou faktúrou alebo úhradou nemožno natrvalo vymazať. Môžete ju archivovať.');
      }
      const linkedLeadIsTest = local.leads.some((lead) => lead.id === job.leadId && lead.isTestData);
      const wasTest = Boolean(job.isTestData || linkedLeadIsTest);
      local.priceOffers = local.priceOffers.map((offer) => {
        const historicallyLinked = (offer.sourceJobIds ?? []).includes(id);
        if (offer.jobId !== id && !historicallyLinked) return offer;
        return {
          ...offer,
          jobId: offer.jobId === id ? undefined : offer.jobId,
          leadId: offer.leadId || job.leadId,
          isTestData: Boolean(offer.isTestData || wasTest),
        };
      });
      local.plannerActions = local.plannerActions.map((action) => (action.jobId === id ? { ...action, jobId: '' } : action));
      local.businessJobs = local.businessJobs.filter((item) => item.id !== id);
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'business_job', entityId: id, action: 'business_job_deleted', actorEmail, changes: {}, createdAt: now() });
      await writeLocalDb(local);
    });
    return;
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const parent = await client.query('SELECT lead_id FROM business_jobs WHERE id = $1', [id]);
    if (parent.rows[0]?.lead_id) await client.query('SELECT id FROM leads WHERE id = $1 FOR UPDATE', [parent.rows[0].lead_id]);
    const current = await client.query(
      'SELECT j.lead_id, j.is_test_data, COALESCE(l.is_test_data, false) AS lead_is_test_data FROM business_jobs j LEFT JOIN leads l ON l.id = j.lead_id WHERE j.id = $1 FOR UPDATE OF j',
      [id],
    );
    if (!current.rowCount) {
      await client.query('ROLLBACK');
      return;
    }
    const financeEvidence = await client.query(
      `SELECT EXISTS (SELECT 1 FROM business_job_invoices WHERE job_id = $1)
           OR EXISTS (SELECT 1 FROM business_job_payment_events WHERE job_id = $1) AS present`,
      [id],
    );
    if (financeEvidence.rows[0]?.present) {
      throw new Error('Zákazku s evidovanou faktúrou alebo úhradou nemožno natrvalo vymazať. Môžete ju archivovať.');
    }
    if (current.rows[0].is_test_data || current.rows[0].lead_is_test_data) {
      await client.query('UPDATE price_offers SET is_test_data = true WHERE job_id = $1::uuid OR $1::uuid = ANY(source_job_ids)', [id]);
    }
    await client.query('UPDATE price_offers SET lead_id = COALESCE(lead_id, $2::uuid), job_id = NULL WHERE job_id = $1', [id, current.rows[0].lead_id || null]);
    await client.query('UPDATE planner_actions SET zakazka_id = NULL WHERE zakazka_id = $1', [id]);
    await client.query('DELETE FROM business_jobs WHERE id = $1', [id]);
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'business_job', id, 'business_job_deleted', actorEmail, {}, now()],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function addBusinessJobNote(id: string, note: string, actorEmail: string) {
  const text = note.trim();
  if (!text) return null;
  return addAuditLog('business_job', id, 'business_job_note_added', actorEmail, { note: text });
}

export async function saveBusinessJob(input: BusinessJobInput, actorEmail: string, id?: string): Promise<BusinessJob> {
  await ensureSchema();
  if (id && (await getBusinessJob(id, true))?.deletedAt) throw new Error('Archivovanú zákazku nemožno upravovať.');
  const timestamp = now();
  const jobId = id || randomUUID();
  const previousJob = id ? await getBusinessJob(id) : null;
  const totalPrice = money(input.m2 * input.pricePerM2);
  const landfillCost = input.costs.landfillCost || (await calculateLandfillCostForJob(input.demolitionDate, input.landfill, input.wasteKg)).cost;
  const costs = calculateCosts({ ...input.costs, landfillCost });
  const allWorkers = await listWorkers(true);
  const selectedWorkers = input.workers
    .map((item) => ({ ...item, worker: allWorkers.find((worker) => worker.id === item.workerId) }))
    .filter((item) => item.worker);
  const share = selectedWorkers.length ? Math.round((input.m2 / selectedWorkers.length) * 100) / 100 : 0;
  const jobWorkers = selectedWorkers.map((item) => {
    const rate = money(item.rate ?? item.worker?.ratePerM2 ?? 0);
    const automaticReward = Math.round((share * rate) * 100) / 100;
    const reward = item.manuallyEdited ? money(item.reward) : automaticReward;
    return {
      id: randomUUID(),
      jobId,
      workerId: item.workerId,
      workerName: item.worker?.name ?? '',
      m2Share: share,
      rate,
      reward,
      manuallyEdited: Boolean(item.manuallyEdited),
    };
  });

  const baseRow = {
    id: jobId,
    createdAt: timestamp,
    updatedAt: timestamp,
    demolitionDate: input.demolitionDate,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() ?? '',
    customerEmail: input.customerEmail?.trim() ?? '',
    location: input.location.trim(),
    district: input.district?.trim() ?? '',
    materialType: input.materialType?.trim() ?? '',
    objectType: input.objectType?.trim() ?? '',
    term: input.term?.trim() ?? '',
    leadSource: input.leadSource?.trim() ?? '',
    preferredContact: input.preferredContact?.trim() ?? '',
    m2: money(input.m2),
    pricePerM2: money(input.pricePerM2),
    totalPrice,
    paymentType: input.paymentType,
    workType: input.workType,
    wasteKg: money(input.wasteKg),
    landfill: input.landfill,
    status: input.status,
    note: input.note?.trim() ?? '',
  };

  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const previous = local.businessJobs.find((job) => job.id === jobId);
      if (id && !previous) throw new Error('Zákazka už neexistuje. Obnovte stránku.');
      if (previous?.deletedAt) throw new Error('Archivovanú zákazku nemožno upravovať.');
      const job = enrichBusinessJob(baseRow, jobWorkers, { ...costs, jobId });
      job.createdAt = previous?.createdAt ?? timestamp;
      job.leadId = previous?.leadId ?? previousJob?.leadId;
      job.isTestData = Boolean(previous?.isTestData ?? previousJob?.isTestData);
      local.businessJobs = [job, ...local.businessJobs.filter((item) => item.id !== jobId)];
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'business_job', entityId: jobId, action: id ? 'business_job_updated' : 'business_job_created', actorEmail, changes: { status: job.status }, createdAt: timestamp });
      if (previous?.status && previous.status !== job.status) {
        local.auditLogs.unshift({ id: randomUUID(), entityType: 'business_job', entityId: jobId, action: 'business_job_status_changed', actorEmail, changes: { previous: previous.status, next: job.status }, createdAt: timestamp });
      }
      await writeLocalDb(local);
      return job;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const current = id ? await client.query('SELECT status, deleted_at FROM business_jobs WHERE id = $1 FOR UPDATE', [jobId]) : null;
    if (id && !current?.rowCount) throw new Error('Zákazka už neexistuje. Obnovte stránku.');
    if (current?.rows[0]?.deleted_at) throw new Error('Archivovanú zákazku nemožno upravovať.');
    const upsert = await client.query(
      `INSERT INTO business_jobs (
        id, created_at, updated_at, demolition_date, customer_name, customer_phone, customer_email, location, district,
        material_type, object_type, term, lead_source, preferovany_kontakt, m2, price_per_m2, total_price, payment_type, work_type, waste_kg, landfill, status, note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      ON CONFLICT (id) DO UPDATE SET
        updated_at = $3, demolition_date = $4, customer_name = $5, customer_phone = $6, customer_email = $7,
        location = $8, district = $9, material_type = $10, object_type = $11, term = $12, lead_source = $13,
        preferovany_kontakt = $14, m2 = $15, price_per_m2 = $16, total_price = $17, payment_type = $18,
        work_type = $19, waste_kg = $20, landfill = $21, status = $22, note = $23
       WHERE business_jobs.deleted_at IS NULL RETURNING id`,
      [
        jobId,
        timestamp,
        timestamp,
        baseRow.demolitionDate,
        baseRow.customerName,
        baseRow.customerPhone,
        baseRow.customerEmail,
        baseRow.location,
        baseRow.district,
        baseRow.materialType,
        baseRow.objectType,
        baseRow.term,
        baseRow.leadSource,
        baseRow.preferredContact,
        baseRow.m2,
        baseRow.pricePerM2,
        baseRow.totalPrice,
        baseRow.paymentType,
        baseRow.workType,
        baseRow.wasteKg,
        baseRow.landfill,
        baseRow.status,
        baseRow.note,
      ],
    );
    if (upsert.rowCount !== 1) throw new Error('Archivovanú zákazku nemožno upravovať.');
    await client.query('DELETE FROM business_job_workers WHERE job_id = $1', [jobId]);
    for (const worker of jobWorkers) {
      await client.query(
        `INSERT INTO business_job_workers (id, job_id, worker_id, worker_name, m2_share, rate, reward, manually_edited)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [worker.id, jobId, worker.workerId, worker.workerName, worker.m2Share, worker.rate, worker.reward, worker.manuallyEdited],
      );
    }
    await client.query(
      `INSERT INTO business_job_costs (job_id, fuel, suits, gloves, penetrant, landfill_cost, other_name, other_amount, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (job_id) DO UPDATE SET fuel = $2, suits = $3, gloves = $4, penetrant = $5,
       landfill_cost = $6, other_name = $7, other_amount = $8, total = $9`,
      [jobId, costs.fuel, costs.suits, costs.gloves, costs.penetrant, costs.landfillCost, costs.otherName, costs.otherAmount, costs.total],
    );
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'business_job', jobId, id ? 'business_job_updated' : 'business_job_created', actorEmail, { status: input.status }, timestamp],
    );
    const previousStatus = current?.rows[0]?.status as BusinessJobStatus | undefined;
    if (previousStatus && previousStatus !== input.status) {
      await client.query(
        'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), 'business_job', jobId, 'business_job_status_changed', actorEmail, { previous: previousStatus, next: input.status }, timestamp],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  const saved = await getBusinessJob(jobId, true);
  if (!saved) throw new Error('Zákazku sa nepodarilo uložiť.');
  return saved;
}

export async function createBusinessJobFromLead(lead: Lead): Promise<BusinessJob> {
  const settings = await getBusinessSettings();
  const job = await saveBusinessJob(
    {
      demolitionDate: new Date().toISOString().slice(0, 10),
      customerName: lead.fullName,
      customerPhone: lead.phone,
      customerEmail: lead.email,
      location: lead.city,
      district: lead.district,
      materialType: lead.materialType,
      objectType: lead.objectType,
      term: lead.term,
      leadSource: lead.source || process.env.LEAD_SOURCE || 'likvidacia-eternitu.sk',
      preferredContact: lead.preferredContact || 'Zavolajte mi',
      m2: lead.areaEstimate,
      pricePerM2: settings.defaultPricePerM2,
      paymentType: 'FAKTURA',
      workType: 'DEMONTAZ_A_ODVOZ',
      wasteKg: 0,
      landfill: 'INA',
      status: 'DOPYT',
      note: lead.note,
      workers: [],
      costs: { fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0 },
    },
    'system',
  );
  await addAuditLog('business_job', job.id, 'business_job_lead_received', 'system', { leadId: lead.id });
  return job;
}

function defaultValidUntil(days = 60) {
  return slovakCalendarDateAfterDays(days);
}

export async function nextPriceOfferNumber() {
  await ensureSchema();
  const year = priceOfferNumberYear();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const count = local.priceOffers.filter((offer) => offer.number.startsWith(year)).length + 1;
    return `${year}${String(count).padStart(4, '0')}`;
  }
  const { rows } = await db.query('SELECT number FROM price_offers WHERE number LIKE $1 ORDER BY number DESC LIMIT 1', [`${year}%`]);
  const last = rows[0]?.number ? Number(String(rows[0].number).slice(4)) : 0;
  return `${year}${String(last + 1).padStart(4, '0')}`;
}

function calculatePriceOfferTotals(input: PriceOfferInput, vatRate: number) {
  const pricing = calculatePriceOfferPricing(input, vatRate);
  return {
    materialPriceWithoutVat: pricing.materialPriceWithoutVat,
    totalWithoutVat: pricing.totalWithoutVat,
    totalWithVat: pricing.totalWithVat,
  };
}

type PriceOfferParentTransition = 'prepared' | 'sent' | 'accepted';

const leadStatusOrder: Partial<Record<LeadStatus, number>> = {
  novy: 0,
  kontaktovany: 1,
  caka_na_doplnenie: 1,
  naceneny: 2,
  cenova_ponuka_odoslana: 3,
  objednane: 4,
  v_realizacii: 5,
  dokoncena: 6,
};

const businessJobStatusOrder: Partial<Record<BusinessJobStatus, number>> = {
  DOPYT: 0,
  DOPYT_PRIJATY: 1,
  PONUKA_ODOSLANA: 2,
  PRIJATA: 3,
  PONUKA_POTVRDENA: 3,
  URADY_PODANE: 4,
  URADY_SCHVALENE: 5,
  V_REALIZACII: 6,
  DEMONT_NAPLANOVANA: 7,
  DEMONT_DOKONCENA: 8,
  VYUCTOVANIE: 9,
  DOKONCENA: 10,
};

function parentTransitionTargets(transition: PriceOfferParentTransition) {
  if (transition === 'prepared') return { lead: 'naceneny' as const };
  if (transition === 'sent') return { lead: 'cenova_ponuka_odoslana' as const, job: 'PONUKA_ODOSLANA' as const };
  return { lead: 'objednane' as const, job: 'PONUKA_POTVRDENA' as const };
}

function shouldAdvanceLeadStatus(current: LeadStatus, target: LeadStatus) {
  const currentRank = leadStatusOrder[current];
  const targetRank = leadStatusOrder[target];
  return currentRank !== undefined && targetRank !== undefined && currentRank < targetRank;
}

function shouldAdvanceBusinessJobStatus(current: BusinessJobStatus, target: BusinessJobStatus) {
  const currentRank = businessJobStatusOrder[current];
  const targetRank = businessJobStatusOrder[target];
  return currentRank !== undefined && targetRank !== undefined && currentRank < targetRank;
}

const priceOfferConfirmationEvidenceCodes = new Set([
  'sent_folder_verified',
  'recipient_confirmed',
  'provider_confirmed',
]);

function normalizePriceOfferConfirmationReason(reason: string) {
  const normalized = reason.trim();
  if (!priceOfferConfirmationEvidenceCodes.has(normalized)) {
    throw new Error('Vyberte platný interný dôkaz o odoslaní ponuky.');
  }
  return normalized;
}

function localLinkedBusinessJob(local: LocalDb, offer: PriceOffer) {
  if (offer.jobId) {
    return local.businessJobs.find((job) => job.id === offer.jobId && !job.deletedAt && job.status !== 'ZRUSENA');
  }
  if (!offer.leadId) return undefined;
  const candidates = local.businessJobs.filter(
    (job) => job.leadId === offer.leadId && !job.deletedAt && job.status !== 'ZRUSENA',
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

function priceOfferParentAuditChanges(
  offer: PriceOffer,
  previous: string,
  next: string,
  reasonCode: string,
) {
  return {
    offerId: offer.id,
    number: offer.number,
    previous,
    next,
    reasonCode,
  };
}

function syncPriceOfferParentsLocal(
  local: LocalDb,
  offer: PriceOffer,
  transition: PriceOfferParentTransition,
  actorEmail: string,
  timestamp: string,
  reasonCode: string,
) {
  const targets = parentTransitionTargets(transition);
  const linkedJob = localLinkedBusinessJob(local, offer);
  const leadId = offer.leadId || linkedJob?.leadId;
  const lead = leadId ? local.leads.find((item) => item.id === leadId && !item.deletedAt) : undefined;
  if (lead && shouldAdvanceLeadStatus(lead.status, targets.lead)) {
    const previous = lead.status;
    lead.status = targets.lead;
    lead.updatedAt = timestamp;
    local.auditLogs.unshift({
      id: randomUUID(),
      entityType: 'lead',
      entityId: lead.id,
      action: 'status_changed',
      actorEmail,
      changes: priceOfferParentAuditChanges(offer, previous, targets.lead, reasonCode),
      createdAt: timestamp,
    });
  }
  if (targets.job && linkedJob && shouldAdvanceBusinessJobStatus(linkedJob.status, targets.job)) {
    const previous = linkedJob.status;
    linkedJob.status = targets.job;
    linkedJob.updatedAt = timestamp;
    local.auditLogs.unshift({
      id: randomUUID(),
      entityType: 'business_job',
      entityId: linkedJob.id,
      action: 'business_job_status_changed',
      actorEmail,
      changes: priceOfferParentAuditChanges(offer, previous, targets.job, reasonCode),
      createdAt: timestamp,
    });
  }
}

async function resolvePriceOfferBusinessJobForUpdate(client: PoolClient, offer: PriceOffer) {
  let jobId = offer.jobId;
  let discoveredLeadId = offer.leadId;
  if (jobId) {
    const linked = await client.query(
      `SELECT id, lead_id FROM business_jobs
       WHERE id = $1 AND deleted_at IS NULL AND status <> 'ZRUSENA' LIMIT 1`,
      [jobId],
    );
    if (!linked.rows[0]) return { jobId: '', leadId: discoveredLeadId };
    discoveredLeadId ||= linked.rows[0].lead_id ? String(linked.rows[0].lead_id) : undefined;
  } else if (discoveredLeadId) {
    const linked = await client.query(
      `SELECT id FROM business_jobs
       WHERE lead_id = $1 AND deleted_at IS NULL AND status <> 'ZRUSENA'
       ORDER BY created_at DESC, id DESC LIMIT 2`,
      [discoveredLeadId],
    );
    jobId = linked.rows.length === 1 && linked.rows[0]?.id ? String(linked.rows[0].id) : '';
  }
  return { jobId, leadId: discoveredLeadId };
}

async function syncPriceOfferParentsPostgres(
  client: PoolClient,
  offer: PriceOffer,
  transition: PriceOfferParentTransition,
  actorEmail: string,
  timestamp: string,
  reasonCode: string,
) {
  const targets = parentTransitionTargets(transition);
  const linked = await resolvePriceOfferBusinessJobForUpdate(client, offer);
  if (linked.leadId) {
    const currentLead = await client.query(
      'SELECT status FROM leads WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [linked.leadId],
    );
    const previous = currentLead.rows[0]?.status as LeadStatus | undefined;
    if (previous && shouldAdvanceLeadStatus(previous, targets.lead)) {
      await client.query('UPDATE leads SET status = $2, updated_at = $3 WHERE id = $1', [linked.leadId, targets.lead, timestamp]);
      await client.query(
        'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), 'lead', linked.leadId, 'status_changed', actorEmail,
          priceOfferParentAuditChanges(offer, previous, targets.lead, reasonCode), timestamp],
      );
    }
  }
  if (targets.job && linked.jobId) {
    const currentJob = await client.query(
      `SELECT status FROM business_jobs
       WHERE id = $1 AND deleted_at IS NULL AND status <> 'ZRUSENA' FOR UPDATE`,
      [linked.jobId],
    );
    const previous = currentJob.rows[0]?.status as BusinessJobStatus | undefined;
    if (previous && shouldAdvanceBusinessJobStatus(previous, targets.job)) {
      await client.query('UPDATE business_jobs SET status = $2, updated_at = $3 WHERE id = $1', [linked.jobId, targets.job, timestamp]);
      await client.query(
        'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), 'business_job', linked.jobId, 'business_job_status_changed', actorEmail,
          priceOfferParentAuditChanges(offer, previous, targets.job, reasonCode), timestamp],
      );
    }
  }
}

export async function savePriceOffer(input: PriceOfferInput, actorEmail: string, id?: string): Promise<PriceOffer> {
  if (input.validUntil && !isValidIsoCalendarDate(input.validUntil)) {
    throw new Error('Platnosť cenovej ponuky musí byť skutočný kalendárny dátum.');
  }
  await ensureSchema();
  const settings = await getPriceOfferSettings();
  const timestamp = now();
  const offerId = id || randomUUID();
  const existing = id ? await getPriceOffer(id) : null;
  const lifecycle = priceOfferUpdateLifecycle(existing || undefined);
  if (!lifecycle.allowed) {
    if (lifecycle.status === 'PRIJATA' || lifecycle.status === 'ODOSLANA') throw new Error('Odoslanú alebo prijatú cenovú ponuku nie je možné upraviť. Vytvorte novú ponuku, aby zostala obchodná história zachovaná.');
    throw new Error('Ponuka sa práve odosiela alebo má neoverený stav doručenia. Najprv overte e-mail; ponuku zatiaľ neupravujte.');
  }
  const normalizedInput: PriceOfferInput = {
    ...input,
    documentationPromotion: input.includeDocumentation && input.documentationPromotion,
    transportFrom: input.transportFrom.trim(),
    transportTo: input.transportTo.trim(),
  };
  const linkedJob = input.jobId ? await getBusinessJob(input.jobId) : null;
  if (input.jobId && !linkedJob) throw new Error('Vybraná zákazka neexistuje alebo je archivovaná. Obnovte formulár.');
  const previousJob = existing?.jobId ? await getBusinessJob(existing.jobId, true) : null;
  const sourceIsDirectLead = (input.sourceInquiry?.trim() || '').startsWith('dopyt:');
  const directLeadId = /^dopyt:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(input.sourceInquiry?.trim() || '')?.[1];
  const directLead = !input.jobId && directLeadId ? await getLeadWithFiles(directLeadId, true) : null;
  if (!existing && !input.jobId && sourceIsDirectLead && !directLead) throw new Error('Zdrojový dopyt už neexistuje. Obnovte formulár; ponuku nemožno bezpečne priradiť.');
  const offerLeadId = input.jobId ? linkedJob?.leadId : directLead?.id ?? existing?.leadId ?? previousJob?.leadId;
  const vatRate = existing?.vatRate ?? settings.vatRate;
  const totals = calculatePriceOfferTotals(normalizedInput, vatRate);
  const offer: PriceOffer = {
    ...normalizedInput,
    id: offerId,
    leadId: offerLeadId,
    sourceJobIds: [...new Set([...(existing?.sourceJobIds ?? []), ...(existing?.jobId ? [existing.jobId] : []), ...(input.jobId ? [input.jobId] : [])])],
    isTestData: Boolean(existing?.isTestData),
    number: existing?.number || '',
    createdAt: existing?.createdAt || timestamp,
    validUntil: input.validUntil || defaultValidUntil(),
    vatRate,
    documentationFeeWithoutVat: money(normalizedInput.documentationFeeWithoutVat),
    transportRoundTripKm: money(normalizedInput.transportRoundTripKm),
    transportPricePerKm: money(normalizedInput.transportPricePerKm),
    areaM2: money(normalizedInput.areaM2),
    pricePerM2WithoutVat: money(normalizedInput.pricePerM2WithoutVat),
    materialPriceWithoutVat: totals.materialPriceWithoutVat,
    totalWithoutVat: totals.totalWithoutVat,
    totalWithVat: totals.totalWithVat,
    offerNote: validatePriceOfferNote(input.offerNote),
    internalNote: normalizedInput.internalNote?.trim() ?? '',
    sourceInquiry: input.sourceInquiry?.trim() || process.env.LEAD_SOURCE || 'likvidacia-eternitu.sk',
    status: lifecycle.status,
    sentAt: lifecycle.sentAt,
    acceptedAt: existing?.acceptedAt,
  };
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const currentExisting = id ? local.priceOffers.find((item) => item.id === id && !item.deletedAt) : undefined;
      if (id && !currentExisting) throw new Error('Cenová ponuka už neexistuje. Obnovte stránku.');
      const currentJob = input.jobId ? local.businessJobs.find((item) => item.id === input.jobId && !item.deletedAt) : undefined;
      if (input.jobId && !currentJob) throw new Error('Vybraná zákazka neexistuje alebo je archivovaná. Obnovte formulár.');
      const currentDirectLead = !input.jobId && directLeadId ? local.leads.find((item) => item.id === directLeadId) : undefined;
      if (!currentExisting && !input.jobId && sourceIsDirectLead && !currentDirectLead) {
        throw new Error('Zdrojový dopyt už neexistuje. Obnovte formulár; ponuku nemožno bezpečne priradiť.');
      }
      const currentPreviousJob = currentExisting?.jobId ? local.businessJobs.find((item) => item.id === currentExisting.jobId) : undefined;
      offer.leadId = input.jobId ? currentJob?.leadId : currentDirectLead?.id ?? currentExisting?.leadId ?? currentPreviousJob?.leadId;
      offer.sourceJobIds = [...new Set([...(currentExisting?.sourceJobIds ?? []), ...(currentExisting?.jobId ? [currentExisting.jobId] : []), ...(input.jobId ? [input.jobId] : [])])];
      offer.isTestData = Boolean(currentExisting?.isTestData);
      if (!offer.number) {
        const year = priceOfferNumberYear();
        const highest = local.priceOffers
          .map((item) => item.number)
          .filter((number) => number.startsWith(year))
          .reduce((max, number) => Math.max(max, Number(number.slice(4)) || 0), 0);
        offer.number = `${year}${String(highest + 1).padStart(4, '0')}`;
      }
      const current = local.priceOffers.find((item) => item.id === offerId && !item.deletedAt);
      if (current?.status === 'PRIJATA' || current?.status === 'ODOSLANA') throw new Error('Cenová ponuka už bola odoslaná alebo prijatá. Vytvorte novú ponuku, ak potrebujete zmenu.');
      if (current?.status === 'ODOSIELA' || current?.status === 'NEISTY_STAV') throw new Error('Odoslanie ponuky prebieha alebo sa musí overiť. Zatiaľ ju neupravujte ani neodosielajte znova.');
      local.priceOffers = [offer, ...local.priceOffers.filter((item) => item.id !== offerId)];
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'business_job', entityId: offer.jobId || offer.id, action: id ? 'price_offer_updated' : 'price_offer_created', actorEmail, changes: { number: offer.number, requiresResend: lifecycle.requiresResend }, createdAt: timestamp });
      syncPriceOfferParentsLocal(local, offer, 'prepared', actorEmail, timestamp, 'price_offer_prepared');
      await writeLocalDb(local);
      return offer;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    if (!offer.number) {
      const year = priceOfferNumberYear();
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`price-offer-number:${year}`]);
      const numberResult = await client.query(
        'SELECT number FROM price_offers WHERE number LIKE $1 ORDER BY number DESC LIMIT 1',
        [`${year}%`],
      );
      const last = numberResult.rows[0]?.number ? Number(String(numberResult.rows[0].number).slice(4)) : 0;
      offer.number = `${year}${String(last + 1).padStart(4, '0')}`;
    }
    const result = await client.query(
    `INSERT INTO price_offers (
      id, number, job_id, created_at, valid_until, object_type, object_address, municipality, district,
      contact_person, phone, email, realization_term, material_type, area_m2, price_per_m2_without_vat,
      documentation_fee_without_vat, include_documentation, material_price_without_vat, total_without_vat,
      total_with_vat, offer_note, internal_note, status, sent_at, accepted_at, source_inquiry, lead_id, is_test_data, source_job_ids,
      documentation_promotion, include_transport, transport_from, transport_to, transport_round_trip_km, transport_price_per_km, vat_rate
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
    ON CONFLICT (id) DO UPDATE SET
      job_id = $3, valid_until = $5, object_type = $6, object_address = $7, municipality = $8, district = $9,
      contact_person = $10, phone = $11, email = $12, realization_term = $13, material_type = $14, lead_id = $28,
      is_test_data = price_offers.is_test_data OR EXCLUDED.is_test_data,
      source_job_ids = ARRAY(SELECT DISTINCT source_job_id FROM unnest(price_offers.source_job_ids || EXCLUDED.source_job_ids) AS source_job_id),
      area_m2 = $15, price_per_m2_without_vat = $16, documentation_fee_without_vat = $17,
      include_documentation = $18, material_price_without_vat = $19, total_without_vat = $20,
      total_with_vat = $21, offer_note = $22, internal_note = $23, source_inquiry = $27,
      documentation_promotion = $31, include_transport = $32, transport_from = $33, transport_to = $34,
      transport_round_trip_km = $35, transport_price_per_km = $36, vat_rate = $37,
      status = $24, sent_at = $25
     WHERE price_offers.status NOT IN ('PRIJATA', 'ODOSLANA', 'ODOSIELA', 'NEISTY_STAV')
    RETURNING id`,
    [
      offer.id,
      offer.number,
      offer.jobId || null,
      offer.createdAt,
      offer.validUntil,
      offer.objectType,
      offer.objectAddress,
      offer.municipality,
      offer.district,
      offer.contactPerson,
      offer.phone,
      offer.email,
      offer.realizationTerm,
      offer.materialType,
      offer.areaM2,
      offer.pricePerM2WithoutVat,
      offer.documentationFeeWithoutVat,
      offer.includeDocumentation,
      offer.materialPriceWithoutVat,
      offer.totalWithoutVat,
      offer.totalWithVat,
      offer.offerNote,
      offer.internalNote,
      offer.status,
      offer.sentAt || null,
      offer.acceptedAt || null,
      offer.sourceInquiry,
      offer.leadId || null,
      offer.isTestData || false,
      offer.sourceJobIds || [],
      offer.documentationPromotion,
      offer.includeTransport,
      offer.transportFrom,
      offer.transportTo,
      offer.transportRoundTripKm,
      offer.transportPricePerKm,
      offer.vatRate,
    ],
    );
    if (!result.rows.length) throw new Error('Cenová ponuka bola počas úpravy odoslaná, prijatá alebo uzamknutá a nebola zmenená. Vytvorte novú ponuku.');
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'business_job',$2,$3,$4,$5,$6)`,
      [randomUUID(), offer.jobId || offer.id, id ? 'price_offer_updated' : 'price_offer_created', actorEmail,
        { number: offer.number, requiresResend: lifecycle.requiresResend }, timestamp],
    );
    await syncPriceOfferParentsPostgres(client, offer, 'prepared', actorEmail, timestamp, 'price_offer_prepared');
    await client.query('COMMIT');
    return offer;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listPriceOffers(filters: { status?: PriceOfferStatus | ''; month?: string; jobId?: string; includeArchived?: boolean } = {}): Promise<PriceOffer[]> {
  await ensureSchema();
  const db = getPool();
  const monthRange = filters.month ? priceOfferMonthRange(filters.month) : null;
  if (!db) {
    const local = await readLocalDb();
    return [...local.priceOffers]
      .filter((offer) => (filters.includeArchived || !offer.deletedAt) && (!filters.status || offer.status === filters.status) && (!filters.jobId || offer.jobId === filters.jobId)
        && (!monthRange || (offer.createdAt >= monthRange.from && offer.createdAt < monthRange.toExclusive)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (!filters.includeArchived) conditions.push('deleted_at IS NULL');
  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }
  if (filters.jobId) {
    values.push(filters.jobId);
    conditions.push(`job_id = $${values.length}`);
  }
  if (monthRange) {
    values.push(monthRange.from);
    conditions.push(`created_at >= $${values.length}::timestamptz`);
    values.push(monthRange.toExclusive);
    conditions.push(`created_at < $${values.length}::timestamptz`);
  }
  const { rows } = await db.query(`SELECT * FROM price_offers ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 1000`, values);
  return rows.map(toPriceOffer);
}

export async function getLatestPriceOffersByInquiryIds(inquiryIds: string[]): Promise<Map<string, PriceOffer>> {
  await ensureSchema();
  const ids = [...new Set(inquiryIds.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))];
  if (!ids.length) return new Map();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const wanted = new Set(ids);
    const latest = new Map<string, PriceOffer>();
    for (const offer of [...local.priceOffers].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number.localeCompare(a.number))) {
      if (offer.deletedAt) continue;
      const id = offer.leadId || (/^dopyt:([0-9a-f-]{36})$/i.exec(offer.sourceInquiry || '')?.[1] ?? '');
      if (wanted.has(id) && !latest.has(id)) latest.set(id, offer);
    }
    return latest;
  }
  const { rows } = await db.query(
    `SELECT DISTINCT ON (lead_id) * FROM price_offers
     WHERE lead_id = ANY($1::uuid[]) AND deleted_at IS NULL
     ORDER BY lead_id, created_at DESC, number DESC`,
    [ids],
  );
  return new Map(rows.map((row) => {
    const offer = toPriceOffer(row);
    return [offer.leadId!, offer] as const;
  }));
}

export type PriceOfferEventMetrics = { created: number; sent: number; accepted: number };

function localBusinessPriceOffers(local: LocalDb): PriceOffer[] {
  const testLeadIds = new Set(local.leads.filter((lead) => lead.isTestData).map((lead) => lead.id));
  const testJobIds = new Set(local.businessJobs.filter((job) => job.isTestData || (job.leadId && testLeadIds.has(job.leadId))).map((job) => job.id));
  return local.priceOffers.filter((offer) => !offer.deletedAt
    && !offer.isTestData
    && !testJobIds.has(offer.jobId || '')
    && !(offer.sourceJobIds ?? []).some((jobId) => testJobIds.has(jobId))
    && !testLeadIds.has(offer.leadId || '')
    && !testLeadIds.has(offer.sourceInquiry?.startsWith('dopyt:') ? offer.sourceInquiry.slice(6) : ''));
}

const businessPriceOfferCondition = `COALESCE(o.is_test_data, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM business_jobs related_job
    LEFT JOIN leads related_lead ON related_lead.id = related_job.lead_id
    WHERE (related_job.id = o.job_id OR related_job.id = ANY(o.source_job_ids))
      AND (related_job.is_test_data = true OR COALESCE(related_lead.is_test_data, false) = true)
  )
  AND NOT EXISTS (
    SELECT 1 FROM leads source_lead
    WHERE (source_lead.id = o.lead_id OR LOWER(o.source_inquiry) = 'dopyt:' || source_lead.id::text)
      AND source_lead.is_test_data = true
  )`;

const priceOfferAttributionOwnerCondition = `(
  o.lead_id = lead_base.id
  OR (o.lead_id IS NULL AND o.job_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM business_jobs current_job
      WHERE current_job.id = o.job_id AND current_job.lead_id = lead_base.id)
  )
  OR (o.lead_id IS NULL AND LOWER(o.source_inquiry) = 'dopyt:' || lead_base.id::text
    AND NOT EXISTS (SELECT 1 FROM business_jobs current_job
      WHERE current_job.id = o.job_id AND current_job.lead_id IS NOT NULL)
  )
  OR (o.lead_id IS NULL AND o.job_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM leads direct_source WHERE LOWER(o.source_inquiry) = 'dopyt:' || direct_source.id::text)
    AND EXISTS (SELECT 1 FROM business_jobs owner_job WHERE owner_job.lead_id = lead_base.id
      AND (owner_job.id = o.job_id OR owner_job.id = ANY(o.source_job_ids)))
    AND NOT EXISTS (SELECT 1 FROM business_jobs other_job WHERE other_job.lead_id IS NOT NULL
      AND other_job.lead_id <> lead_base.id
      AND (other_job.id = o.job_id OR other_job.id = ANY(o.source_job_ids)))
  )
)`;

export async function getPriceOfferEventMetrics(from: string, to: string): Promise<PriceOfferEventMetrics> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const offers = localBusinessPriceOffers(local);
    const inPeriod = (value?: string) => {
      if (!value) return false;
      const date = dateInBratislava(value);
      return date >= from && date <= to;
    };
    return {
      created: offers.filter((offer) => inPeriod(offer.createdAt)).length,
      sent: offers.filter((offer) => inPeriod(offer.sentAt)).length,
      accepted: offers.filter((offer) => inPeriod(offer.acceptedAt)).length,
    };
  }
  const window = bratislavaTimestampRange(from, to);
  const { rows } = await db.query(
    `SELECT
       count(*) FILTER (WHERE o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz)::int AS created,
       count(*) FILTER (WHERE o.sent_at >= $1::timestamptz AND o.sent_at < $2::timestamptz)::int AS sent,
       count(*) FILTER (WHERE o.accepted_at >= $1::timestamptz AND o.accepted_at < $2::timestamptz)::int AS accepted
     FROM price_offers o
       WHERE o.deleted_at IS NULL
         AND ${businessPriceOfferCondition}`,
    [window.from, window.toExclusive],
  );
  const row = rows[0] ?? {};
  return { created: Number(row.created ?? 0), sent: Number(row.sent ?? 0), accepted: Number(row.accepted ?? 0) };
}

export type PriceOfferStatusSummary = { created: number; sent: number; accepted: number; acceptedValue: number };

function priceOfferMonthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Neplatný mesiac pre súhrn ponúk.');
  const [year, monthNumber] = month.split('-').map(Number);
  const from = bratislavaMidnightUtc({ year, month: monthNumber, day: 1 }).toISOString();
  const nextMonth = monthNumber === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: monthNumber + 1, day: 1 };
  const toExclusive = bratislavaMidnightUtc(nextMonth).toISOString();
  return { from, toExclusive };
}

export async function getPriceOfferStatusSummary(month: string): Promise<PriceOfferStatusSummary> {
  const { from, toExclusive } = priceOfferMonthRange(month);
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const offers = localBusinessPriceOffers(local).filter((offer) => offer.createdAt >= from && offer.createdAt < toExclusive);
    const sent = offers.filter((offer) => offer.status === 'ODOSLANA' || offer.status === 'PRIJATA');
    const accepted = offers.filter((offer) => offer.status === 'PRIJATA');
    return { created: offers.length, sent: sent.length, accepted: accepted.length,
      acceptedValue: accepted.reduce((sum, offer) => sum + offer.totalWithVat, 0) };
  }
  const { rows } = await db.query(`SELECT
      count(*)::int AS created,
      count(*) FILTER (WHERE o.status IN ('ODOSLANA', 'PRIJATA'))::int AS sent,
      count(*) FILTER (WHERE o.status = 'PRIJATA')::int AS accepted,
      COALESCE(sum(o.total_with_vat) FILTER (WHERE o.status = 'PRIJATA'), 0)::numeric AS accepted_value
    FROM price_offers o
    WHERE o.deleted_at IS NULL AND o.created_at >= $1::timestamptz
      AND o.created_at < $2::timestamptz
      AND ${businessPriceOfferCondition}`, [from, toExclusive]);
  const row = rows[0] ?? {};
  return { created: Number(row.created ?? 0), sent: Number(row.sent ?? 0),
    accepted: Number(row.accepted ?? 0), acceptedValue: Number(row.accepted_value ?? 0) };
}

export async function getPriceOffer(id: string): Promise<PriceOffer | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.priceOffers.find((offer) => offer.id === id && !offer.deletedAt) ?? null;
  }
  const { rows } = await db.query('SELECT * FROM price_offers WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [id]);
  return rows[0] ? toPriceOffer(rows[0]) : null;
}

export async function updatePriceOfferStatus(id: string, status: PriceOfferStatus, actorEmail: string) {
  await ensureSchema();
  if (status !== 'PRIJATA') throw new Error('Nepodporovaná zmena stavu cenovej ponuky.');
  const timestamp = now();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const offer = local.priceOffers.find((item) => item.id === id && !item.deletedAt && item.status === 'ODOSLANA');
      if (!offer) return null;
      const previous = offer.status;
      offer.status = status;
      offer.acceptedAt = timestamp;
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'business_job', entityId: offer.jobId || offer.id,
        action: 'price_offer_status_changed', actorEmail,
        changes: priceOfferParentAuditChanges(offer, previous, status, 'price_offer_accepted'), createdAt: timestamp });
      syncPriceOfferParentsLocal(local, offer, 'accepted', actorEmail, timestamp, 'price_offer_accepted');
      await writeLocalDb(local);
      return offer;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE price_offers SET status = $1, accepted_at = $2
       WHERE id = $3 AND deleted_at IS NULL AND status = 'ODOSLANA' RETURNING *`,
      [status, timestamp, id],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const offer = toPriceOffer(rows[0]);
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'business_job', offer.jobId || offer.id, 'price_offer_status_changed', actorEmail,
        priceOfferParentAuditChanges(offer, 'ODOSLANA', status, 'price_offer_accepted'), timestamp],
    );
    await syncPriceOfferParentsPostgres(client, offer, 'accepted', actorEmail, timestamp, 'price_offer_accepted');
    await client.query('COMMIT');
    return offer;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePriceOffer(id: string, actorEmail: string) {
  await ensureSchema();
  const offer = await getPriceOffer(id);
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const localOffer = local.priceOffers.find((item) => item.id === id);
    if (localOffer) localOffer.deletedAt = now();
    await writeLocalDb(local);
  } else {
    await db.query('UPDATE price_offers SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', [id]);
  }
  await addAuditLog('business_job', offer?.jobId || id, 'price_offer_archived', actorEmail, { number: offer?.number });
}

export async function listRealizations(): Promise<Realization[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.realizations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { rows } = await db.query('SELECT * FROM realizations ORDER BY featured DESC, created_at DESC LIMIT 200');
  return rows.map(toRealization);
}

function toPublishedRealization(realization: Realization): PublishedRealization {
  return {
    id: realization.id,
    title: realization.title,
    location: realization.location,
    materialType: realization.materialType,
    areaEstimate: realization.areaEstimate,
    description: realization.description,
    imageUrls: realization.imageUrls,
    featured: realization.featured,
    createdAt: realization.createdAt,
    publishedAt: realization.publishedAt,
  };
}

export async function claimPriceOfferForSending(id: string, actorEmail: string): Promise<PriceOffer | null> {
  await ensureSchema();
  const timestamp = now();
  const attemptId = randomUUID();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const offer = local.priceOffers.find((item) => item.id === id && !item.deletedAt);
      if (!offer || offer.status !== 'PRIPRAVENA') return null;
      offer.status = 'ODOSIELA';
      offer.sendStartedAt = timestamp;
      offer.sendAttemptId = attemptId;
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'business_job', entityId: offer.jobId || offer.id,
        action: 'price_offer_send_claimed', actorEmail, changes: { number: offer.number }, createdAt: timestamp });
      await writeLocalDb(local);
      return offer;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE price_offers SET status = 'ODOSIELA', send_started_at = $2, send_attempt_id = $3
       WHERE id = $1 AND deleted_at IS NULL AND status = 'PRIPRAVENA' RETURNING *`,
      [id, timestamp, attemptId],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const offer = toPriceOffer(rows[0]);
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'business_job', offer.jobId || offer.id, 'price_offer_send_claimed', actorEmail, { number: offer.number }, timestamp],
    );
    await client.query('COMMIT');
    return offer;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function finishPriceOfferSending(id: string, attemptId: string, result: 'sent' | 'not_sent' | 'unknown', actorEmail: string) {
  await ensureSchema();
  const timestamp = now();
  const nextStatus: PriceOfferStatus = result === 'sent' ? 'ODOSLANA' : result === 'not_sent' ? 'PRIPRAVENA' : 'NEISTY_STAV';
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const offer = local.priceOffers.find((item) => item.id === id && !item.deletedAt);
      if (!offer || offer.status !== 'ODOSIELA' || offer.sendAttemptId !== attemptId) return null;
      offer.status = nextStatus;
      if (result === 'sent') offer.sentAt = timestamp;
      offer.sendStartedAt = result === 'unknown' ? (offer.sendStartedAt || timestamp) : undefined;
      offer.sendAttemptId = result === 'unknown' ? attemptId : undefined;
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'business_job', entityId: offer.jobId || offer.id,
        action: `price_offer_send_${result}`, actorEmail,
        changes: priceOfferParentAuditChanges(offer, 'ODOSIELA', nextStatus, `price_offer_send_${result}`), createdAt: timestamp });
      if (result === 'sent') syncPriceOfferParentsLocal(local, offer, 'sent', actorEmail, timestamp, 'price_offer_sent');
      await writeLocalDb(local);
      return offer;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE price_offers SET status = $2,
         sent_at = CASE WHEN $3 = 'sent' THEN $4 ELSE sent_at END,
         send_started_at = CASE WHEN $3 = 'unknown' THEN COALESCE(send_started_at, $4) ELSE NULL END,
         send_attempt_id = CASE WHEN $3 = 'unknown' THEN send_attempt_id ELSE NULL END
       WHERE id = $1 AND deleted_at IS NULL AND status = 'ODOSIELA' AND send_attempt_id = $5 RETURNING *`,
      [id, nextStatus, result, timestamp, attemptId],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const offer = toPriceOffer(rows[0]);
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'business_job', offer.jobId || offer.id, `price_offer_send_${result}`, actorEmail,
        priceOfferParentAuditChanges(offer, 'ODOSIELA', nextStatus, `price_offer_send_${result}`), timestamp],
    );
    if (result === 'sent') await syncPriceOfferParentsPostgres(client, offer, 'sent', actorEmail, timestamp, 'price_offer_sent');
    await client.query('COMMIT');
    return offer;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmUncertainPriceOfferSent(id: string, actorEmail: string, reason: string) {
  await ensureSchema();
  const evidenceCode = normalizePriceOfferConfirmationReason(reason);
  const timestamp = now();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const offer = local.priceOffers.find((item) => item.id === id && !item.deletedAt);
      const startedAt = offer?.sendStartedAt ? new Date(offer.sendStartedAt).getTime() : Number.NaN;
      const staleSending = offer?.status === 'ODOSIELA' && Number.isFinite(startedAt) && Date.now() - startedAt >= 15 * 60_000;
      if (!offer || (offer.status !== 'NEISTY_STAV' && !staleSending)) return null;
      const previous = offer.status;
      offer.status = 'ODOSLANA';
      offer.sentAt = timestamp;
      offer.sendStartedAt = undefined;
      offer.sendAttemptId = undefined;
      local.auditLogs.unshift({
        id: randomUUID(),
        entityType: 'business_job',
        entityId: offer.jobId || offer.id,
        action: 'price_offer_uncertain_send_confirmed',
        actorEmail,
        changes: priceOfferParentAuditChanges(offer, previous, 'ODOSLANA', evidenceCode),
        createdAt: timestamp,
      });
      syncPriceOfferParentsLocal(local, offer, 'sent', actorEmail, timestamp, evidenceCode);
      await writeLocalDb(local);
      return offer;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      'SELECT * FROM price_offers WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [id],
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const currentOffer = toPriceOffer(current.rows[0]);
    const startedAt = currentOffer.sendStartedAt ? new Date(currentOffer.sendStartedAt).getTime() : Number.NaN;
    const staleSending = currentOffer.status === 'ODOSIELA' && Number.isFinite(startedAt) && Date.now() - startedAt >= 15 * 60_000;
    if (currentOffer.status !== 'NEISTY_STAV' && !staleSending) {
      await client.query('ROLLBACK');
      return null;
    }
    const { rows } = await client.query(
      `UPDATE price_offers
       SET status = 'ODOSLANA', sent_at = $2, send_started_at = NULL, send_attempt_id = NULL
       WHERE id = $1 RETURNING *`,
      [id, timestamp],
    );
    const offer = toPriceOffer(rows[0]);
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'business_job', offer.jobId || offer.id, 'price_offer_uncertain_send_confirmed', actorEmail,
        priceOfferParentAuditChanges(offer, currentOffer.status, 'ODOSLANA', evidenceCode), timestamp],
    );
    await syncPriceOfferParentsPostgres(client, offer, 'sent', actorEmail, timestamp, evidenceCode);
    await client.query('COMMIT');
    return offer;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function resetUncertainPriceOfferSend(id: string, actorEmail: string) {
  await ensureSchema();
  const timestamp = now();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const offer = local.priceOffers.find((item) => item.id === id && !item.deletedAt);
      const startedAt = offer?.sendStartedAt ? new Date(offer.sendStartedAt).getTime() : NaN;
      if (!offer || !['NEISTY_STAV', 'ODOSIELA'].includes(offer.status) || !Number.isFinite(startedAt) || Date.now() - startedAt < 15 * 60_000) return null;
      offer.status = 'PRIPRAVENA';
      offer.sendStartedAt = undefined;
      offer.sendAttemptId = undefined;
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'business_job', entityId: offer.jobId || offer.id,
        action: 'price_offer_uncertain_send_reset', actorEmail, changes: { number: offer.number }, createdAt: timestamp });
      await writeLocalDb(local);
      return offer;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE price_offers SET status = 'PRIPRAVENA', send_started_at = NULL, send_attempt_id = NULL
       WHERE id = $1 AND deleted_at IS NULL AND status IN ('NEISTY_STAV', 'ODOSIELA')
         AND send_started_at <= $2::timestamptz - interval '15 minutes'
       RETURNING *`,
      [id, timestamp],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const offer = toPriceOffer(rows[0]);
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'business_job', offer.jobId || offer.id, 'price_offer_uncertain_send_reset', actorEmail, { number: offer.number }, timestamp],
    );
    await client.query('COMMIT');
    return offer;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listPublishedRealizations(limit = 6): Promise<PublishedRealization[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.realizations]
      .filter((realization) => realization.status === 'published')
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(toPublishedRealization);
  }
  const { rows } = await db.query(
    'SELECT * FROM realizations WHERE status = $1 ORDER BY featured DESC, created_at DESC LIMIT $2',
    ['published', limit],
  );
  return rows.map(toRealization).map(toPublishedRealization);
}

export async function createRealization(input: RealizationInput): Promise<Realization> {
  await ensureSchema();
  const timestamp = now();
  const publicationEvidence = String(input.publicationEvidence ?? '').trim().slice(0, 500);
  if (input.status === 'published' && (!input.publicationRightsConfirmed || !input.publicationLocationConfirmed || publicationEvidence.length < 4)) {
    throw new Error('Zverejnenie vyžaduje potvrdenie práv, približnej lokality a evidenciu podkladu.');
  }
  const realization: Realization = {
    id: randomUUID(),
    title: input.title.trim(),
    location: input.location.trim(),
    materialType: input.materialType.trim(),
    areaEstimate: input.areaEstimate ? Number(input.areaEstimate) : undefined,
    description: input.description.trim(),
    imageUrls: input.imageUrls.map((url) => url.trim()).filter(Boolean).slice(0, 6),
    status: input.status,
    featured: Boolean(input.featured),
    createdBy: input.createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: input.status === 'published' ? timestamp : undefined,
    publicationEvidence,
    publicationApprovedBy: input.status === 'published' ? input.createdBy : '',
    publicationApprovedAt: input.status === 'published' ? timestamp : undefined,
  };

  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      local.realizations.unshift(realization);
      local.auditLogs.unshift({
        id: randomUUID(),
        entityType: 'realization',
        entityId: realization.id,
        action: 'realization_created',
        actorEmail: input.createdBy,
        changes: {
          status: realization.status,
          publicationApproved: realization.status === 'published',
          publicationEvidenceRecorded: realization.status === 'published' && Boolean(publicationEvidence),
        },
        createdAt: timestamp,
      });
      await writeLocalDb(local);
      return realization;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO realizations (
        id, created_at, updated_at, published_at, status, title, location, material_type,
        area_estimate, description, image_urls, featured, created_by, publication_evidence, publication_approved_by, publication_approved_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16)`,
      [
        realization.id,
        realization.createdAt,
        realization.updatedAt,
        realization.publishedAt,
        realization.status,
        realization.title,
        realization.location,
        realization.materialType,
        realization.areaEstimate ?? null,
        realization.description,
        JSON.stringify(realization.imageUrls),
        realization.featured,
        realization.createdBy,
        realization.publicationEvidence ?? '',
        realization.publicationApprovedBy ?? '',
        realization.publicationApprovedAt ?? null,
      ],
    );
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization', $2, 'realization_created', $3, $4::jsonb, $5)`,
      [randomUUID(), realization.id, input.createdBy, JSON.stringify({
        status: realization.status,
        publicationApproved: realization.status === 'published',
        publicationEvidenceRecorded: realization.status === 'published' && Boolean(publicationEvidence),
      }), timestamp],
    );
    await client.query('COMMIT');
    return realization;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRealizationStatus(id: string, status: RealizationStatus, actorEmail: string, publication?: {
  evidence: string;
  rightsConfirmed: boolean;
  locationConfirmed: boolean;
}): Promise<Realization | null> {
  await ensureSchema();
  const timestamp = now();
  const publicationEvidence = String(publication?.evidence ?? '').trim().slice(0, 500);
  if (status === 'published' && (!publication?.rightsConfirmed || !publication.locationConfirmed || publicationEvidence.length < 4)) {
    throw new Error('Zverejnenie vyžaduje potvrdenie práv, približnej lokality a evidenciu podkladu.');
  }
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const realization = local.realizations.find((item) => item.id === id);
      if (!realization) return null;
      const previous = realization.status;
      realization.status = status;
      realization.updatedAt = timestamp;
      realization.publishedAt = status === 'published' ? timestamp : undefined;
      if (status === 'published') {
        realization.publicationEvidence = publicationEvidence;
        realization.publicationApprovedBy = actorEmail;
        realization.publicationApprovedAt = timestamp;
      }
      local.auditLogs.unshift({
        id: randomUUID(),
        entityType: 'realization',
        entityId: id,
        action: 'realization_status_changed',
        actorEmail,
        changes: { previous, next: status },
        createdAt: timestamp,
      });
      await writeLocalDb(local);
      return realization;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const previous = await client.query('SELECT status FROM realizations WHERE id = $1 FOR UPDATE', [id]);
    if (!previous.rows[0]) {
      await client.query('COMMIT');
      return null;
    }
    const { rows } = await client.query(
      `UPDATE realizations
        SET status = $1::text,
            updated_at = $2::timestamptz,
            published_at = CASE WHEN $1::text = 'published' THEN $2::timestamptz ELSE NULL::timestamptz END,
            publication_evidence = CASE WHEN $1::text = 'published' THEN $3::text ELSE publication_evidence END,
            publication_approved_by = CASE WHEN $1::text = 'published' THEN $4::text ELSE publication_approved_by END,
            publication_approved_at = CASE WHEN $1::text = 'published' THEN $2::timestamptz ELSE publication_approved_at END
        WHERE id = $5::uuid
        RETURNING *`,
      [status, timestamp, publicationEvidence, actorEmail, id],
    );
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization', $2, 'realization_status_changed', $3, $4::jsonb, $5)`,
      [randomUUID(), id, actorEmail, JSON.stringify({ previous: previous.rows[0].status, next: status, publicationApproved: status === 'published', publicationEvidenceRecorded: status === 'published' }), timestamp],
    );
    await client.query('COMMIT');
    return toRealization(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listRoofers(options: { referralEligibleOnly?: boolean; region?: string; district?: string } = {}): Promise<Roofer[]> {
  await ensureSchema();
  const db = getPool();
  const region = options.region?.trim() ?? '';
  const district = options.district?.trim() ?? '';

  if (!db) {
    const local = await readLocalDb();
    return local.roofers
      .map((roofer) => toRoofer(roofer as unknown as Record<string, unknown>))
      .filter((roofer) => (!options.referralEligibleOnly || isRooferReferralEligible(roofer)))
      .filter((roofer) => (!region || roofer.region === region))
      .filter((roofer) => (!district || roofer.districts.includes(district)))
      .sort((a, b) =>
        Number(b.verifiedPartner) - Number(a.verifiedPartner)
        || b.rating - a.rating
        || b.confirmedJobsCount - a.confirmedJobsCount
        || Number(b.preferredPartner) - Number(a.preferredPartner)
        || a.name.localeCompare(b.name, 'sk'),
      );
  }

  const clauses: string[] = [];
  const values: unknown[] = [];
  if (options.referralEligibleOnly) {
    clauses.push(`active = true
      AND customer_referral_approved = true
      AND length(btrim(customer_referral_evidence)) >= 8
      AND customer_referral_approved_at IS NOT NULL
      AND length(btrim(customer_referral_approved_by)) > 0`);
  }
  if (region) {
    values.push(region);
    clauses.push(`region = $${values.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT * FROM roofers ${where}
     ORDER BY verified_partner DESC, rating DESC, confirmed_jobs_count DESC, preferred_partner DESC, name ASC
     LIMIT 300`,
    values,
  );
  return rows
    .map(toRoofer)
    .filter((roofer) => (!district || roofer.districts.includes(district)));
}

export async function listReferralEligibleRoofers(filters: { region?: string; district?: string } = {}) {
  return listRoofers({ ...filters, referralEligibleOnly: true });
}

export type PhotoUploadInvite = {
  id: string;
  createdBy: string;
  workerLabel: string;
  businessJob?: { id: string; demolitionDate: string; district: string; status: string };
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  consumedAt?: string;
};

type LeadEmailOutbox = {
  id: string;
  leadId: string;
  recipientRole: 'customer' | 'internal';
  dedupeKey: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'unknown';
  attempts: number;
  retryable?: boolean;
  nextAttemptAt: string;
  lockedAt?: string;
  messageId: string;
  lastError: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
};

type MetaCapiOutboxRecord = {
  id: string;
  leadId: string;
  eventId: string;
  consentSubject?: string;
  eventTime: string;
  eventSourceUrl: string;
  material: MetaCapiOutboxClaim['material'];
  status: MetaCapiOutboxStatus;
  attempts: number;
  maxAttempts: number;
  retryable: boolean;
  nextAttemptAt: string;
  claimId?: string;
  claimedUntil?: string;
  lastHttpStatus?: number;
  lastErrorCode: string;
  consentRevokedAt?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
};

type MetaCapiConsentRevocation = {
  consentSubject: string;
  revokedAt: string;
};

type LeadFileDeletionJob = {
  id: string;
  leadId: string;
  fileId: string;
  storageDriver: LeadFile['storageDriver'];
  storageKey: string;
  status: 'pending' | 'deleting' | 'failed' | 'deleted';
  attempts: number;
  nextAttemptAt: string;
  claimId?: string;
  claimedUntil?: string;
  lastError: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type LeadEmailOutboxSummary = Pick<LeadEmailOutbox, 'recipientRole' | 'status' | 'attempts' | 'updatedAt' | 'lastError' | 'messageId' | 'retryable'> & { manualRetryReady: boolean };

export type RealizationMediaIntake = {
  id: string;
  inviteId: string;
  businessJobId?: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  sanitizedAt?: string;
  locality: string;
  categories: string[];
  metadataVersion: number;
  status: 'pending_upload' | 'pending_review' | 'approved_private' | 'rejected' | 'deletion_pending';
  deletionReason: string;
  deletionError: string;
  deletionAttempts: number;
  createdAt: string;
  uploadedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

function toRealizationCaseDraft(row: Record<string, unknown>, mediaRows: Record<string, unknown>[] = []): RealizationCaseDraft {
  return {
    id: String(row.id),
    businessJobId: row.business_job_id ? String(row.business_job_id) : undefined,
    businessJob: row.case_job_id ? {
      id: String(row.case_job_id),
      demolitionDate: dateOnly(row.case_job_date),
      district: cleanSlovakText(String(row.case_job_district ?? '')),
      exactLocation: cleanSlovakText(String(row.case_job_location ?? '')),
    } : undefined,
    title: cleanSlovakText(String(row.title ?? '')),
    locality: cleanSlovakText(String(row.locality ?? '')),
    localityPrecision: String(row.locality_precision ?? 'none') as RealizationCaseDraft['localityPrecision'],
    lifecycle: String(row.lifecycle ?? 'draft') as RealizationCaseDraft['lifecycle'],
    publicationEvidence: cleanSlovakText(String(row.publication_evidence ?? '')),
    publicationRightsConfirmed: row.publication_rights_confirmed === true,
    publicationLocationConfirmed: row.publication_location_confirmed === true,
    publicationContentConfirmed: row.publication_content_confirmed === true,
    publicationApprovedBy: String(row.publication_approved_by ?? ''),
    publicationApprovedAt: row.publication_approved_at ? new Date(String(row.publication_approved_at)).toISOString() : undefined,
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : undefined,
    withdrawnAt: row.withdrawn_at ? new Date(String(row.withdrawn_at)).toISOString() : undefined,
    objectType: cleanSlovakText(String(row.object_type ?? '')),
    materialType: cleanSlovakText(String(row.material_type ?? '')),
    workDescription: cleanSlovakText(String(row.work_description ?? '')),
    resultDescription: cleanSlovakText(String(row.result_description ?? '')),
    areaEstimate: row.area_estimate == null ? undefined : Number(row.area_estimate),
    workPeriod: cleanSlovakText(String(row.work_period ?? '')),
    media: mediaRows.map((media) => ({
      id: String(media.id),
      originalName: cleanSlovakText(String(media.original_name ?? 'fotografia')),
      locality: cleanSlovakText(String(media.locality ?? '')),
      categories: parseStringArray(media.categories),
      phase: String(media.photo_phase ?? 'during') as 'before' | 'during' | 'after',
      publicCaption: cleanSlovakText(String(media.public_caption ?? '')),
      sortOrder: Math.max(0, Math.min(999, Number(media.sort_order ?? 0) || 0)),
      createdAt: new Date(String(media.created_at)).toISOString(),
      uploadedAt: media.uploaded_at ? new Date(String(media.uploaded_at)).toISOString() : undefined,
    })),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    updatedBy: String(row.updated_by ?? ''),
  };
}

export async function listRealizationCaseDrafts(): Promise<RealizationCaseDraft[]> {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const { rows } = await db.query(
    `SELECT d.*, j.id AS case_job_id, j.demolition_date::text AS case_job_date, j.district AS case_job_district,
       j.location AS case_job_location,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'id', m.id, 'original_name', m.original_name, 'locality', m.locality, 'categories', m.categories,
           'photo_phase', link.photo_phase, 'public_caption', link.public_caption, 'sort_order', link.sort_order,
           'created_at', m.created_at, 'uploaded_at', m.uploaded_at
         ) ORDER BY link.sort_order, m.created_at)
         FROM realization_case_draft_media link
         JOIN realization_media_intake m ON m.id = link.media_id AND m.status = 'approved_private' AND m.sanitized_at IS NOT NULL
         JOIN photo_upload_invites i ON i.id = m.invite_id AND i.business_job_id IS NOT DISTINCT FROM d.business_job_id
         WHERE link.draft_id = d.id
       ), '[]'::jsonb) AS media_rows
     FROM realization_case_drafts d
     LEFT JOIN business_jobs j ON j.id = d.business_job_id
     ORDER BY d.updated_at DESC, d.id DESC`,
  );
  return rows.map((row) => toRealizationCaseDraft(row, Array.isArray(row.media_rows) ? row.media_rows as Record<string, unknown>[] : []));
}

export async function listPublishedRealizationCases(limit = 30, offset = 0): Promise<PublishedRealizationCase[]> {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const boundedLimit = Math.max(1, Math.min(60, Math.floor(limit)));
  const boundedOffset = Math.max(0, Math.min(1_000_000, Math.floor(offset)));
  const { rows } = await db.query(
    `SELECT d.id, d.title, d.locality, d.locality_precision, d.object_type, d.material_type,
       d.work_description, d.result_description, d.area_estimate, d.work_period, d.published_at,
       array_agg(media.id ORDER BY link.sort_order, media.created_at) AS photo_ids,
       jsonb_agg(jsonb_build_object(
         'id', media.id,
         'phase', link.photo_phase,
         'publicCaption', link.public_caption,
         'sortOrder', link.sort_order
       ) ORDER BY link.sort_order, media.created_at) AS photos
     FROM realization_case_drafts d
      JOIN business_jobs job ON job.id=d.business_job_id AND job.deleted_at IS NULL
        AND job.status IN ('DEMONT_DOKONCENA', 'DOKONCENA', 'VYUCTOVANIE')
        AND job.is_test_data=false
        AND NOT EXISTS (SELECT 1 FROM leads source_lead WHERE source_lead.id=job.lead_id AND source_lead.is_test_data=true)
      JOIN realization_case_draft_media link ON link.draft_id=d.id
     JOIN realization_media_intake media ON media.id=link.media_id AND media.status='approved_private'
       AND media.sanitized_at IS NOT NULL AND media.mime_type='image/jpeg'
     JOIN photo_upload_invites invite ON invite.id=media.invite_id AND invite.business_job_id=d.business_job_id
     WHERE d.lifecycle='published' AND d.publication_rights_confirmed=true
       AND d.publication_location_confirmed=true AND d.publication_content_confirmed=true
       AND length(btrim(d.publication_evidence)) >= 4 AND d.published_at IS NOT NULL
       AND ((d.locality_precision IN ('municipality', 'district') AND length(btrim(d.locality)) >= 2)
         OR (d.locality_precision = 'none' AND length(btrim(d.locality)) = 0))
     GROUP BY d.id
     ORDER BY d.published_at DESC, d.id DESC
     LIMIT $1 OFFSET $2`,
    [boundedLimit, boundedOffset],
  );
  return rows.map((row) => ({
    id: String(row.id),
    title: cleanSlovakText(String(row.title ?? '')),
    locality: cleanSlovakText(String(row.locality ?? '')),
    localityPrecision: String(row.locality_precision) as PublishedRealizationCase['localityPrecision'],
    objectType: cleanSlovakText(String(row.object_type ?? '')),
    materialType: cleanSlovakText(String(row.material_type ?? '')),
    workDescription: cleanSlovakText(String(row.work_description ?? '')),
    resultDescription: cleanSlovakText(String(row.result_description ?? '')),
    areaEstimate: row.area_estimate == null ? undefined : Number(row.area_estimate),
    workPeriod: cleanSlovakText(String(row.work_period ?? '')),
    photoIds: Array.isArray(row.photo_ids) ? row.photo_ids.map((id: unknown) => String(id)) : [],
    photos: Array.isArray(row.photos) ? row.photos.map((photo: Record<string, unknown>) => ({
      id: String(photo.id),
      phase: String(photo.phase ?? 'during') as 'before' | 'during' | 'after',
      publicCaption: cleanSlovakText(String(photo.publicCaption ?? '')),
      sortOrder: Math.max(0, Math.min(999, Number(photo.sortOrder ?? 0) || 0)),
    })) : [],
    publishedAt: new Date(String(row.published_at)).toISOString(),
  }));
}

export async function countPublishedRealizationCases(): Promise<number> {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const { rows } = await db.query(
    `SELECT count(DISTINCT d.id)::integer AS total
     FROM realization_case_drafts d
     JOIN business_jobs job ON job.id=d.business_job_id AND job.deleted_at IS NULL
       AND job.status IN ('DEMONT_DOKONCENA', 'DOKONCENA', 'VYUCTOVANIE')
       AND job.is_test_data=false
       AND NOT EXISTS (SELECT 1 FROM leads source_lead WHERE source_lead.id=job.lead_id AND source_lead.is_test_data=true)
     JOIN realization_case_draft_media link ON link.draft_id=d.id
     JOIN realization_media_intake media ON media.id=link.media_id AND media.status='approved_private'
       AND media.sanitized_at IS NOT NULL AND media.mime_type='image/jpeg'
     JOIN photo_upload_invites invite ON invite.id=media.invite_id AND invite.business_job_id=d.business_job_id
     WHERE d.lifecycle='published' AND d.publication_rights_confirmed=true
       AND d.publication_location_confirmed=true AND d.publication_content_confirmed=true
       AND length(btrim(d.publication_evidence)) >= 4 AND d.published_at IS NOT NULL
       AND ((d.locality_precision IN ('municipality', 'district') AND length(btrim(d.locality)) >= 2)
         OR (d.locality_precision = 'none' AND length(btrim(d.locality)) = 0))`,
  );
  return Math.max(0, Number(rows[0]?.total ?? 0));
}

export async function getPublishedRealizationCasePhoto(mediaId: string): Promise<{ storageKey: string } | null> {
  await ensureSchema();
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return null;
  const db = requirePhotoIntakeDatabase();
  const { rows } = await db.query(
    `SELECT media.storage_key
     FROM realization_media_intake media
     JOIN realization_case_draft_media link ON link.media_id=media.id
     JOIN realization_case_drafts d ON d.id=link.draft_id AND d.lifecycle='published'
       AND d.publication_rights_confirmed=true AND d.publication_location_confirmed=true
       AND d.publication_content_confirmed=true AND length(btrim(d.publication_evidence)) >= 4
      JOIN business_jobs job ON job.id=d.business_job_id AND job.deleted_at IS NULL
        AND job.status IN ('DEMONT_DOKONCENA', 'DOKONCENA', 'VYUCTOVANIE')
        AND job.is_test_data=false
        AND NOT EXISTS (SELECT 1 FROM leads source_lead WHERE source_lead.id=job.lead_id AND source_lead.is_test_data=true)
      JOIN photo_upload_invites invite ON invite.id=media.invite_id AND invite.business_job_id=d.business_job_id
     WHERE media.id=$1 AND media.status='approved_private' AND media.sanitized_at IS NOT NULL
       AND media.mime_type='image/jpeg' AND media.storage_key LIKE ('photo-intake/sanitized/' || media.id::text || '/%')
     LIMIT 1`,
    [mediaId],
  );
  return rows[0] ? { storageKey: String(rows[0].storage_key) } : null;
}

/**
 * Turns an internally approved crew photo into an editable private case draft.
 * The completed CRM job is locked so repeated/concurrent requests for photos
 * from one job reuse the same draft instead of creating duplicates.
 */
export async function createCaseDraftFromApprovedPhoto(input: { mediaId: string; updatedBy: string }): Promise<{ draftId: string; lifecycle: RealizationCaseDraft['lifecycle']; created: boolean; attached: boolean; localityPrefilled: boolean; objectTypePrefilled: boolean }> {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  const actor = cleanSlovakText(input.updatedBy).trim().slice(0, 254);
  try {
    await client.query('BEGIN');
    const selected = await client.query(
      `SELECT media.id, media.status, media.sanitized_at, media.mime_type, media.storage_key,
              media.locality, media.categories, invite.business_job_id
       FROM realization_media_intake media
       JOIN photo_upload_invites invite ON invite.id=media.invite_id
       WHERE media.id=$1
       FOR SHARE OF media`,
      [input.mediaId],
    );
    const photo = selected.rows[0];
    if (!photo || photo.status !== 'approved_private' || !photo.sanitized_at
      || photo.mime_type !== 'image/jpeg'
      || !String(photo.storage_key ?? '').startsWith(`photo-intake/sanitized/${input.mediaId}/`)) {
      throw new Error('Koncept možno pripraviť iba z interne schválenej a očistenej súkromnej fotografie.');
    }
    const locality = cleanSlovakText(String(photo.locality ?? '')).trim();
    const categories = parseStringArray(photo.categories);
    if (!isApproximateLocality(locality) || categories.length === 0 || categories.some((category) => !isPhotoCategory(category))) {
      throw new Error('Fotografia nemá overenú približnú lokalitu alebo platný typ objektu. Najprv skontrolujte jej popis.');
    }
    const jobId = String(photo.business_job_id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new Error('Fotografia nie je priradená k dokončenej CRM zákazke.');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), 74321)', [jobId]);
    const jobResult = await client.query(
      `SELECT id FROM business_jobs WHERE id=$1 AND deleted_at IS NULL
       AND status IN ('DEMONT_DOKONCENA', 'DOKONCENA', 'VYUCTOVANIE') FOR UPDATE`,
      [jobId],
    );
    if (!jobResult.rows[0]) throw new Error('Koncept možno vytvoriť iba z fotografie dokončenej CRM zákazky.');

    const existingResult = await client.query(
      `SELECT id, lifecycle, locality, object_type FROM realization_case_drafts
       WHERE business_job_id=$1
       ORDER BY (lifecycle='draft') DESC, updated_at DESC, id
       LIMIT 1 FOR UPDATE`,
      [jobId],
    );
    let draftId: string;
    let lifecycle: RealizationCaseDraft['lifecycle'];
    let created = false;
    let attached = false;
    let localityPrefilled = false;
    let objectTypePrefilled = false;
    if (existingResult.rows[0]) {
      draftId = String(existingResult.rows[0].id);
      lifecycle = String(existingResult.rows[0].lifecycle) as RealizationCaseDraft['lifecycle'];
      if (lifecycle !== 'draft') {
        await client.query('COMMIT');
        return { draftId, lifecycle, created, attached, localityPrefilled, objectTypePrefilled };
      }
      const existingLocality = String(existingResult.rows[0].locality ?? '').trim();
      const existingObjectType = String(existingResult.rows[0].object_type ?? '').trim();
      if (existingLocality && existingLocality.toLocaleLowerCase('sk') !== locality.toLocaleLowerCase('sk')) {
        throw new Error('Lokalita fotografie sa líši od existujúceho konceptu tejto zákazky. Skontrolujte ju ručne.');
      }
      const objectTypes: Record<string, string> = {
        family_house: 'Rodinný dom', outbuilding: 'Hospodárska budova', garage: 'Garáž',
        illegal_dump: 'Nelegálna skládka', interior: 'Interiér',
      };
      const inferredObjectType = [...new Set(categories.map((category) => objectTypes[category]))].join(', ');
      localityPrefilled = !existingLocality;
      objectTypePrefilled = !existingObjectType;
      if (localityPrefilled || objectTypePrefilled) {
        await client.query(
          `UPDATE realization_case_drafts SET
             locality=CASE WHEN btrim(locality)='' THEN $2 ELSE locality END,
             object_type=CASE WHEN btrim(object_type)='' THEN $3 ELSE object_type END,
             updated_at=now(), updated_by=$4
           WHERE id=$1`,
          [draftId, locality, inferredObjectType, actor],
        );
      }
    } else {
      draftId = randomUUID();
      lifecycle = 'draft';
      created = true;
      localityPrefilled = true;
      objectTypePrefilled = true;
      const objectTypes: Record<string, string> = {
        family_house: 'Rodinný dom', outbuilding: 'Hospodárska budova', garage: 'Garáž',
        illegal_dump: 'Nelegálna skládka', interior: 'Interiér',
      };
      const objectType = [...new Set(categories.map((category) => objectTypes[category]))].join(', ');
      await client.query(
        `INSERT INTO realization_case_drafts (id, title, locality, locality_precision, object_type, business_job_id, updated_by)
         VALUES ($1,$2,$3,'none',$4,$5,$6)`,
        [draftId, `Realizácia – ${locality}`, locality, objectType, jobId, actor],
      );
    }
    const linked = await client.query(
      `INSERT INTO realization_case_draft_media (draft_id, media_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING RETURNING media_id`,
      [draftId, input.mediaId],
    );
    attached = Boolean(linked.rows[0]);
    if (created || attached || localityPrefilled || objectTypePrefilled) {
      await client.query(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
         VALUES ($1,'realization_case_draft',$2,$3,$4,$5::jsonb,now())`,
        [randomUUID(), draftId, created ? 'case_draft_created_from_photo' : attached ? 'case_draft_photo_attached_from_intake' : 'case_draft_metadata_prefilled_from_photo', actor,
          JSON.stringify({ mediaId: input.mediaId, businessJobId: jobId, localityPrefilled, objectTypePrefilled, lifecycle: 'draft' })],
      );
    }
    await client.query('COMMIT');
    return { draftId, lifecycle, created, attached, localityPrefilled, objectTypePrefilled };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveRealizationCaseDraft(input: {
  id?: string;
  title: string;
  locality: string;
  localityPrecision: RealizationCaseDraft['localityPrecision'];
  objectType: string;
  materialType: string;
  workDescription: string;
  resultDescription: string;
  areaEstimate?: number;
  workPeriod: string;
  businessJobId?: string;
  updatedBy: string;
}): Promise<RealizationCaseDraft> {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  let id = input.id || randomUUID();
  const fields = [
    cleanSlovakText(input.title).trim().slice(0, 160),
    cleanSlovakText(input.locality).trim().slice(0, 120),
    input.localityPrecision,
    cleanSlovakText(input.objectType).trim().slice(0, 100),
    cleanSlovakText(input.materialType).trim().slice(0, 100),
    cleanSlovakText(input.workDescription).trim().slice(0, 3000),
    cleanSlovakText(input.resultDescription).trim().slice(0, 3000),
    input.areaEstimate ?? null,
    cleanSlovakText(input.workPeriod).trim().slice(0, 80),
    cleanSlovakText(input.updatedBy).trim().slice(0, 254),
  ];
  try {
    await client.query('BEGIN');
    const existingSnapshot = input.id
      ? await client.query(`SELECT id, business_job_id FROM realization_case_drafts WHERE id=$1 AND lifecycle='draft'`, [id])
      : { rows: [] as Record<string, unknown>[] };
    if (input.id && !existingSnapshot.rows[0]) throw new Error('Koncept sa nenašiel alebo už nie je upraviteľný.');
    const existingJobId = existingSnapshot.rows[0]?.business_job_id ? String(existingSnapshot.rows[0].business_job_id) : undefined;
    const requestedJobId = input.businessJobId || existingJobId;
    for (const jobId of [...new Set([existingJobId, requestedJobId].filter((value): value is string => Boolean(value)))].sort()) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), 74321)', [jobId]);
    }
    const existing = input.id
      ? await client.query(`SELECT id, business_job_id FROM realization_case_drafts WHERE id=$1 AND lifecycle='draft' FOR UPDATE`, [id])
      : { rows: [] as Record<string, unknown>[] };
    if (input.id && !existing.rows[0]) throw new Error('Koncept sa nenašiel alebo už nie je upraviteľný.');
    const lockedExistingJobId = existing.rows[0]?.business_job_id ? String(existing.rows[0].business_job_id) : undefined;
    if (input.id && lockedExistingJobId !== existingJobId) throw new Error('Koncept sa medzitým zmenil. Obnovte stránku a skúste znova.');
    if (requestedJobId) {
      const job = await client.query(
        `SELECT id, demolition_date::text AS demolition_date, district FROM business_jobs WHERE id=$1
         AND (id=$2::uuid OR (deleted_at IS NULL AND status IN ('DEMONT_DOKONCENA', 'DOKONCENA', 'VYUCTOVANIE'))) FOR UPDATE`,
        [requestedJobId, existingJobId ?? null],
      );
      if (!job.rows[0]) throw new Error('Koncept možno priradiť iba k existujúcej dokončenej CRM zákazke.');
      if (!input.id) {
        const existingDraft = await client.query(
          `SELECT id FROM realization_case_drafts WHERE business_job_id=$1 AND lifecycle <> 'withdrawn' ORDER BY updated_at DESC, id LIMIT 1 FOR UPDATE`,
          [requestedJobId],
        );
        if (existingDraft.rows[0]) throw new Error('Táto zákazka už má rozpracovaný alebo zverejnený prípad. Otvorte existujúci prípad alebo použite tlačidlo pri schválenej fotke.');
      }
    }
    const crossJobMedia = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM realization_case_draft_media link
       JOIN realization_media_intake media ON media.id=link.media_id
       JOIN photo_upload_invites invite ON invite.id=media.invite_id
       WHERE link.draft_id=$1 AND invite.business_job_id IS DISTINCT FROM $2::uuid`,
      [id, requestedJobId ?? null],
    );
    if (Number(crossJobMedia.rows[0]?.count ?? 0) > 0) throw new Error('Koncept obsahuje fotografie z inej CRM zákazky. Najprv ich odpojte.');
    const saved = await client.query(
      `INSERT INTO realization_case_drafts (id, title, locality, locality_precision, object_type, material_type, work_description, result_description, area_estimate, work_period, updated_by, business_job_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, locality=EXCLUDED.locality, locality_precision=EXCLUDED.locality_precision,
         object_type=EXCLUDED.object_type, material_type=EXCLUDED.material_type, work_description=EXCLUDED.work_description,
         result_description=EXCLUDED.result_description, area_estimate=EXCLUDED.area_estimate, work_period=EXCLUDED.work_period,
         business_job_id=EXCLUDED.business_job_id, updated_at=now(), updated_by=EXCLUDED.updated_by
       WHERE realization_case_drafts.lifecycle = 'draft' RETURNING *`,
      [id, ...fields.slice(0, 9), fields[9], requestedJobId ?? null],
    );
    if (!saved.rows[0]) throw new Error('Koncept sa nenašiel alebo už nie je upraviteľný.');
    const attachedCount = await client.query('SELECT COUNT(*)::int AS count FROM realization_case_draft_media WHERE draft_id = $1', [id]);
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_case_draft', $2, $3, $4, $5::jsonb, now())`,
      [randomUUID(), id, input.id ? 'case_draft_updated' : 'case_draft_created', fields[9], JSON.stringify({ lifecycle: 'draft', attachedMediaCount: Number(attachedCount.rows[0]?.count ?? 0) })],
    );
    const media = await client.query(
      `SELECT m.id, m.original_name, m.locality, m.categories, link.photo_phase, link.public_caption, link.sort_order, m.created_at, m.uploaded_at FROM realization_case_draft_media link
       JOIN realization_media_intake m ON m.id = link.media_id AND m.status = 'approved_private' AND m.sanitized_at IS NOT NULL
       JOIN photo_upload_invites i ON i.id=m.invite_id AND i.business_job_id IS NOT DISTINCT FROM $2::uuid
       WHERE link.draft_id = $1 ORDER BY link.sort_order, m.created_at`,
      [id, requestedJobId ?? null],
    );
    await client.query('COMMIT');
    const jobRow = requestedJobId ? (await client.query('SELECT id, demolition_date::text AS demolition_date, district, location FROM business_jobs WHERE id=$1', [requestedJobId])).rows[0] : undefined;
    return toRealizationCaseDraft({
      ...saved.rows[0],
      case_job_id: jobRow?.id,
      case_job_date: jobRow?.demolition_date,
      case_job_district: jobRow?.district,
      case_job_location: jobRow?.location,
    }, media.rows);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function transitionRealizationCaseDraft(input: {
  draftId: string;
  nextLifecycle: RealizationCaseDraft['lifecycle'];
  updatedBy: string;
  publicationEvidence?: string;
  rightsConfirmed?: boolean;
  locationConfirmed?: boolean;
  contentConfirmed?: boolean;
}) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  const actor = cleanSlovakText(input.updatedBy).trim().slice(0, 254);
  const publicationEvidence = cleanSlovakText(input.publicationEvidence ?? '').trim().slice(0, 500);
  const timestamp = now();
  try {
    await client.query('BEGIN');
    const selected = await client.query(
      `SELECT * FROM realization_case_drafts WHERE id=$1 FOR UPDATE`,
      [input.draftId],
    );
    const current = selected.rows[0];
    if (!current) throw new Error('Koncept prípadu sa nenašiel.');
    const previous = String(current.lifecycle) as RealizationCaseDraft['lifecycle'];

    if (input.nextLifecycle === 'reviewed') {
      if (previous !== 'draft') throw new Error('Na posúdenie možno odovzdať iba súkromný koncept.');
    } else if (input.nextLifecycle === 'draft') {
      if (previous !== 'reviewed' && previous !== 'approved') throw new Error('Do konceptu možno vrátiť iba prípad v redakčnom posúdení alebo nezverejnený schválený prípad.');
    } else if (input.nextLifecycle === 'approved') {
      if (previous !== 'reviewed') throw new Error('Schváliť možno iba prípad po redakčnom posúdení.');
      const locality = cleanSlovakText(String(current.locality ?? '')).trim();
      const localityPrecision = String(current.locality_precision);
      const isValidPrecision = ['none', 'municipality', 'district'].includes(localityPrecision);
      const safePublicLocality = isValidPrecision
        && isPublishableRealizationLocality(locality, localityPrecision as 'none' | 'municipality' | 'district');
      if (!String(current.title ?? '').trim() || !safePublicLocality
        || !String(current.object_type ?? '').trim() || !String(current.material_type ?? '').trim()
        || !String(current.work_description ?? '').trim() || !String(current.result_description ?? '').trim()) {
        throw new Error('Pred schválením doplňte názov, bezpečnú približnú lokalitu alebo zvoľte jej úplné vynechanie, typ objektu, materiál, priebeh a výsledok práce.');
      }
      if (!input.rightsConfirmed || !input.locationConfirmed || !input.contentConfirmed || publicationEvidence.length < 4) {
        throw new Error('Schválenie vyžaduje potvrdenie práv, približnej lokality, bezpečného obsahu a evidenciu podkladu.');
      }
      if (!current.business_job_id) throw new Error('Prípad musí byť priradený k dokončenej CRM zákazke.');
      const photos = await client.query(
         `SELECT COUNT(*)::int AS count FROM realization_case_draft_media link
         JOIN business_jobs job ON job.id=$2::uuid AND job.deleted_at IS NULL AND job.status IN ('DEMONT_DOKONCENA', 'DOKONCENA', 'VYUCTOVANIE')
         JOIN realization_media_intake media ON media.id=link.media_id AND media.status='approved_private'
           AND media.sanitized_at IS NOT NULL AND media.mime_type='image/jpeg'
           AND media.storage_key LIKE ('photo-intake/sanitized/' || media.id::text || '/%')
         JOIN photo_upload_invites invite ON invite.id=media.invite_id AND invite.business_job_id=$2::uuid
         WHERE link.draft_id=$1`,
        [input.draftId, current.business_job_id],
      );
      // Do not let an empty, stale, or cross-job photo attachment become evidence.
      if (Number(photos.rows[0]?.count ?? 0) < 1) throw new Error('Pred schválením pripojte aspoň jednu interne schválenú očistenú fotku z tejto zákazky.');
    } else if (input.nextLifecycle === 'published') {
      if (previous !== 'approved' || !current.publication_rights_confirmed
        || !current.publication_location_confirmed || !current.publication_content_confirmed
        || String(current.publication_evidence ?? '').trim().length < 4) {
        throw new Error('Zverejniť možno iba úplne schválený prípad.');
      }
      const photos = await client.query(
         `SELECT COUNT(*)::int AS count FROM realization_case_draft_media link
         JOIN business_jobs job ON job.id=$2::uuid AND job.deleted_at IS NULL AND job.status IN ('DEMONT_DOKONCENA', 'DOKONCENA', 'VYUCTOVANIE')
         JOIN realization_media_intake media ON media.id=link.media_id AND media.status='approved_private'
           AND media.sanitized_at IS NOT NULL AND media.mime_type='image/jpeg'
           AND media.storage_key LIKE ('photo-intake/sanitized/' || media.id::text || '/%')
         JOIN photo_upload_invites invite ON invite.id=media.invite_id AND invite.business_job_id=$2::uuid
         WHERE link.draft_id=$1`,
        [input.draftId, current.business_job_id],
      );
      if (Number(photos.rows[0]?.count ?? 0) < 1) throw new Error('K publikovaniu musí zostať pripojená aspoň jedna schválená fotografia.');
    } else if (input.nextLifecycle === 'withdrawn') {
      if (previous !== 'published') throw new Error('Stiahnuť možno iba zverejnený prípad.');
    } else {
      throw new Error('Nepovolená zmena stavu prípadu.');
    }

    const updated = await client.query(
      `UPDATE realization_case_drafts SET lifecycle=$1,
         publication_evidence=CASE WHEN $1='approved' THEN $2 WHEN $1='draft' AND lifecycle='approved' THEN '' ELSE publication_evidence END,
         publication_rights_confirmed=CASE WHEN $1='approved' THEN $3 WHEN $1='draft' AND lifecycle='approved' THEN false ELSE publication_rights_confirmed END,
         publication_location_confirmed=CASE WHEN $1='approved' THEN $4 WHEN $1='draft' AND lifecycle='approved' THEN false ELSE publication_location_confirmed END,
         publication_content_confirmed=CASE WHEN $1='approved' THEN $5 WHEN $1='draft' AND lifecycle='approved' THEN false ELSE publication_content_confirmed END,
         publication_approved_by=CASE WHEN $1='approved' THEN $6 WHEN $1='draft' AND lifecycle='approved' THEN '' ELSE publication_approved_by END,
         publication_approved_at=CASE WHEN $1='approved' THEN $7::timestamptz WHEN $1='draft' AND lifecycle='approved' THEN NULL ELSE publication_approved_at END,
         published_at=CASE WHEN $1='published' THEN $7::timestamptz ELSE published_at END,
         withdrawn_at=CASE WHEN $1='withdrawn' THEN $7::timestamptz ELSE withdrawn_at END,
         updated_at=$7, updated_by=$6 WHERE id=$8 RETURNING lifecycle`,
      [input.nextLifecycle, publicationEvidence, Boolean(input.rightsConfirmed), Boolean(input.locationConfirmed), Boolean(input.contentConfirmed), actor, timestamp, input.draftId],
    );
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_case_draft', $2, $3, $4, $5::jsonb, $6)`,
      [randomUUID(), input.draftId, `case_${input.nextLifecycle}`, actor, JSON.stringify({
        previous,
        next: input.nextLifecycle,
        publicationRightsConfirmed: input.nextLifecycle === 'approved' ? Boolean(input.rightsConfirmed) : undefined,
        publicationLocationConfirmed: input.nextLifecycle === 'approved' ? Boolean(input.locationConfirmed) : undefined,
        publicationContentConfirmed: input.nextLifecycle === 'approved' ? Boolean(input.contentConfirmed) : undefined,
        publicationEvidenceRecorded: input.nextLifecycle === 'approved' && publicationEvidence.length >= 4,
      }), timestamp],
    );
    await client.query('COMMIT');
    return String(updated.rows[0]?.lifecycle ?? input.nextLifecycle) as RealizationCaseDraft['lifecycle'];
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setRealizationCaseDraftMedia(input: { draftId: string; mediaId: string; attach: boolean; updatedBy: string }): Promise<boolean> {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const draft = await client.query(`SELECT id, business_job_id FROM realization_case_drafts WHERE id=$1 AND lifecycle='draft' FOR UPDATE`, [input.draftId]);
    if (!draft.rows[0]) throw new Error('Koncept sa nenašiel alebo už nie je upraviteľný.');
    if (input.attach) {
      const photo = await client.query(
        `SELECT media.id FROM realization_media_intake media
         JOIN photo_upload_invites invite ON invite.id=media.invite_id
         WHERE media.id=$1 AND media.status='approved_private' AND media.sanitized_at IS NOT NULL
           AND invite.business_job_id IS NOT DISTINCT FROM $2::uuid
         FOR SHARE OF media, invite`,
        [input.mediaId, draft.rows[0].business_job_id ?? null],
      );
      if (!photo.rows[0]) throw new Error('Fotku možno pripojiť iba po internom schválení a z rovnakej CRM zákazky.');
      await client.query('INSERT INTO realization_case_draft_media (draft_id, media_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [input.draftId, input.mediaId]);
    } else {
      await client.query('DELETE FROM realization_case_draft_media WHERE draft_id=$1 AND media_id=$2', [input.draftId, input.mediaId]);
    }
    const actor = cleanSlovakText(input.updatedBy).trim().slice(0, 254);
    await client.query('UPDATE realization_case_drafts SET updated_at=now(), updated_by=$2 WHERE id=$1', [input.draftId, actor]);
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_case_draft', $2, $3, $4, $5::jsonb, now())`,
      [randomUUID(), input.draftId, input.attach ? 'case_draft_photo_attached' : 'case_draft_photo_detached', actor, JSON.stringify({ lifecycle: 'draft', attached: input.attach, mediaId: input.mediaId })],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRealizationCaseDraftMediaMetadata(input: {
  draftId: string;
  mediaId: string;
  phase: 'before' | 'during' | 'after';
  publicCaption: string;
  sortOrder: number;
  updatedBy: string;
}): Promise<boolean> {
  await ensureSchema();
  if (!(['before', 'during', 'after'] as const).includes(input.phase)) throw new Error('Neplatná fáza fotografie.');
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 999) throw new Error('Poradie fotografie musí byť celé číslo od 0 do 999.');
  const actor = cleanSlovakText(input.updatedBy).trim().slice(0, 254);
  const publicCaption = cleanSlovakText(input.publicCaption).trim().slice(0, 240);
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const draft = await client.query(
      `SELECT id FROM realization_case_drafts WHERE id=$1 AND lifecycle='draft' FOR UPDATE`,
      [input.draftId],
    );
    if (!draft.rows[0]) throw new Error('Koncept sa nenašiel alebo už nie je upraviteľný.');
    const updated = await client.query(
      `UPDATE realization_case_draft_media link
       SET photo_phase=$1, public_caption=$2, sort_order=$3
       FROM realization_media_intake media
       WHERE link.draft_id=$4 AND link.media_id=$5 AND media.id=link.media_id
         AND media.status='approved_private' AND media.sanitized_at IS NOT NULL
       RETURNING link.media_id`,
      [input.phase, publicCaption, input.sortOrder, input.draftId, input.mediaId],
    );
    if (!updated.rows[0]) throw new Error('Pripojená schválená fotografia sa nenašla.');
    await client.query(
      'UPDATE realization_case_drafts SET updated_at=now(), updated_by=$2 WHERE id=$1',
      [input.draftId, actor],
    );
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_case_draft', $2, 'case_draft_photo_metadata_updated', $3, $4::jsonb, now())`,
      [randomUUID(), input.draftId, actor, JSON.stringify({ mediaId: input.mediaId, phase: input.phase, sortOrder: input.sortOrder, publicCaptionRecorded: Boolean(publicCaption) })],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function toPhotoUploadInvite(row: Record<string, unknown>): PhotoUploadInvite {
  return {
    id: String(row.id),
    createdBy: String(row.created_by),
    workerLabel: cleanSlovakText(String(row.worker_label ?? '')),
    businessJob: row.photo_job_id ? {
      id: String(row.photo_job_id),
      demolitionDate: dateOnly(row.photo_job_date),
      district: cleanSlovakText(String(row.photo_job_district ?? '')),
      status: String(row.photo_job_status ?? ''),
    } : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)).toISOString() : undefined,
    consumedAt: row.consumed_at ? new Date(String(row.consumed_at)).toISOString() : undefined,
  };
}

function toRealizationMediaIntake(row: Record<string, unknown>): RealizationMediaIntake {
  return {
    id: String(row.id),
    inviteId: String(row.invite_id),
    businessJobId: row.invite_business_job_id ? String(row.invite_business_job_id) : undefined,
    storageKey: String(row.storage_key),
    originalName: cleanSlovakText(String(row.original_name ?? 'fotografia')),
    mimeType: String(row.mime_type ?? ''),
    sizeBytes: Number(row.size_bytes ?? 0),
    contentHash: String(row.content_hash ?? ''),
    sanitizedAt: row.sanitized_at ? new Date(String(row.sanitized_at)).toISOString() : undefined,
    locality: cleanSlovakText(String(row.locality ?? '')),
    categories: parseStringArray(row.categories),
    metadataVersion: Math.max(1, Number(row.metadata_version ?? 1)),
    status: String(row.status ?? 'pending_upload') as RealizationMediaIntake['status'],
    deletionReason: String(row.deletion_reason ?? ''),
    deletionError: String(row.deletion_error ?? ''),
    deletionAttempts: Number(row.deletion_attempts ?? 0),
    createdAt: new Date(String(row.created_at)).toISOString(),
    uploadedAt: row.uploaded_at ? new Date(String(row.uploaded_at)).toISOString() : undefined,
    reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)).toISOString() : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
  };
}

function requirePhotoIntakeDatabase() {
  const db = getPool();
  if (!db) throw new Error('Súkromný príjem fotiek vyžaduje databázu PostgreSQL.');
  return db;
}

export async function listPhotoIntakeJobOptions() {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const { rows } = await db.query(
    `SELECT id, demolition_date::text AS demolition_date, district, status FROM business_jobs
     WHERE deleted_at IS NULL AND status IN ('DEMONT_DOKONCENA', 'DOKONCENA', 'VYUCTOVANIE')
     ORDER BY demolition_date DESC, created_at DESC LIMIT 500`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    demolitionDate: dateOnly(row.demolition_date),
    district: cleanSlovakText(String(row.district ?? '')),
    status: String(row.status),
  }));
}

export async function createPhotoUploadInvite(tokenHash: string, createdBy: string, expiresAt: Date, workerLabel: string, businessJobId: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  const id = randomUUID();
  try {
    await client.query('BEGIN');
    const job = await client.query(
      `SELECT id, status FROM business_jobs WHERE id=$1 AND deleted_at IS NULL
       AND status IN ('DEMONT_DOKONCENA', 'DOKONCENA', 'VYUCTOVANIE') FOR SHARE`,
      [businessJobId],
    );
    if (!job.rows[0]) throw new Error('Na nahratie fotiek vyberte existujúcu dokončenú zákazku.');
    const { rows } = await client.query(
      `INSERT INTO photo_upload_invites (id, token_hash, created_by, worker_label, expires_at, business_job_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, tokenHash, createdBy, workerLabel, expiresAt, businessJobId],
    );
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_media', $2, 'photo_invite_created', $3, $4::jsonb, now())`,
      [randomUUID(), id, createdBy, JSON.stringify({ businessJobId, expiresAt: expiresAt.toISOString() })],
    );
    await client.query('COMMIT');
    return toPhotoUploadInvite(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function consumePhotoUploadInviteByHash(tokenHash: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const { rows } = await db.query(
    `WITH consumed AS (
       UPDATE photo_upload_invites AS invite SET consumed_at = now()
       WHERE token_hash = $1 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()
       RETURNING invite.*
     )
     SELECT consumed.*, job.id AS photo_job_id, job.demolition_date::text AS photo_job_date,
       job.district AS photo_job_district, job.status AS photo_job_status
     FROM consumed LEFT JOIN business_jobs job ON job.id = consumed.business_job_id`,
    [tokenHash],
  );
  return rows[0] ? toPhotoUploadInvite(rows[0]) : null;
}

export async function getActivePhotoUploadInvite(id: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const { rows } = await db.query(
    `SELECT invite.*, job.id AS photo_job_id, job.demolition_date::text AS photo_job_date,
       job.district AS photo_job_district, job.status AS photo_job_status
     FROM photo_upload_invites invite
     LEFT JOIN business_jobs job ON job.id = invite.business_job_id
     WHERE invite.id = $1 AND invite.revoked_at IS NULL AND invite.expires_at > now()
     LIMIT 1`,
    [id],
  );
  return rows[0] ? toPhotoUploadInvite(rows[0]) : null;
}

export async function listPhotoUploadInvites(options: { page?: number; pageSize?: number } = {}) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 50)));
  const requestedPage = Math.max(1, Math.floor(options.page ?? 1));
  const countResult = await db.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM photo_upload_invites');
  const total = Number(countResult.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const { rows } = await db.query(
    `SELECT invite.*, job.id AS photo_job_id, job.demolition_date::text AS photo_job_date,
       job.district AS photo_job_district, job.status AS photo_job_status
     FROM photo_upload_invites invite
     LEFT JOIN business_jobs job ON job.id = invite.business_job_id
     ORDER BY invite.created_at DESC, invite.id DESC LIMIT $1 OFFSET $2`,
    [pageSize, (page - 1) * pageSize],
  );
  return { invites: rows.map(toPhotoUploadInvite), total, page, pageSize, totalPages };
}

export async function listRevokedPendingPhotoCleanupInvites() {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const { rows } = await db.query(
    `SELECT invite.id, invite.expires_at, invite.revoked_at, COUNT(media.id)::int AS pending_count
     FROM photo_upload_invites AS invite
     JOIN realization_media_intake AS media ON media.invite_id = invite.id AND media.status = 'pending_upload'
     WHERE invite.revoked_at IS NOT NULL OR invite.expires_at <= now()
     GROUP BY invite.id, invite.expires_at, invite.revoked_at
     ORDER BY invite.expires_at ASC`,
  );
  return rows.map((row) => ({
    inviteId: String(row.id),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)).toISOString() : undefined,
    pendingCount: Number(row.pending_count),
  }));
}

export async function listRevokedPendingPhotoRecords(inviteId: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE realization_media_intake AS media
       SET status = 'deletion_pending', deletion_reason = 'revoked_invite_cleanup',
           deletion_attempted_at = now(), deletion_error = ''
       FROM photo_upload_invites AS invite
       WHERE media.invite_id = $1 AND media.status = 'pending_upload'
         AND invite.id = media.invite_id
         AND (invite.revoked_at IS NOT NULL OR invite.expires_at <= now())
         AND (media.upload_token_issued_at IS NULL OR media.upload_token_issued_at <= now() - interval '1 day')
         AND NOT EXISTS (
           SELECT 1 FROM photo_intake_sanitization_attempts AS attempt
           WHERE attempt.media_id = media.id AND attempt.cleanup_status <> 'done'
         )
       RETURNING media.id, media.invite_id, media.storage_driver, media.storage_key, media.deletion_reason`,
      [inviteId],
    );
    await client.query('COMMIT');
    return rows.map((row) => ({
      id: String(row.id), inviteId: String(row.invite_id), storageDriver: String(row.storage_driver),
      storageKey: String(row.storage_key), reason: String(row.deletion_reason),
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function revokePhotoUploadInvite(id: string, actorEmail: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE photo_upload_invites SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!rows[0]) { await client.query('COMMIT'); return { revoked: false, pendingRecords: [] as Array<{ id: string; storageKey: string }> }; }
    const pending = await client.query(
      `SELECT media.id, media.storage_key FROM realization_media_intake AS media
       WHERE media.invite_id = $1 AND media.status = 'pending_upload'
         AND NOT EXISTS (
           SELECT 1 FROM photo_intake_sanitization_attempts AS attempt
           WHERE attempt.media_id = media.id AND attempt.cleanup_status <> 'done'
         )`,
      [id],
    );
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_media', $2, 'photo_invite_revoked', $3, '{}'::jsonb, now())`,
      [randomUUID(), id, actorEmail],
    );
    await client.query('COMMIT');
    return { revoked: true, pendingRecords: pending.rows.map((row) => ({ id: String(row.id), storageKey: String(row.storage_key) })) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRevokedPendingPhotoRecord(id: string, inviteId: string, deletedBy: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `DELETE FROM realization_media_intake AS media
       USING photo_upload_invites AS invite
       WHERE media.id = $1 AND media.invite_id = $2 AND media.status = 'pending_upload'
         AND invite.id = media.invite_id
         AND (invite.revoked_at IS NOT NULL OR invite.expires_at <= now())
         AND NOT EXISTS (
           SELECT 1 FROM photo_intake_sanitization_attempts AS attempt
           WHERE attempt.media_id = media.id AND attempt.cleanup_status <> 'done'
         )
       RETURNING media.id`,
      [id, inviteId],
    );
    if (!rows[0]) { await client.query('COMMIT'); return false; }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_media', $2, 'orphan_photo_record_deleted', $3, '{}'::jsonb, now())`,
      [randomUUID(), id, deletedBy],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type PhotoIntakeDeletionCandidate = {
  id: string;
  inviteId: string;
  storageDriver: string;
  storageKey: string;
  reason: string;
};

export async function claimDuePhotoIntakeDeletions(limit = 50): Promise<PhotoIntakeDeletionCandidate[]> {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const batchSize = Math.max(1, Math.min(100, Math.trunc(limit) || 1));
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const due = await client.query(
      `SELECT media.id,
         CASE
           WHEN media.status = 'deletion_pending' THEN media.deletion_reason
           WHEN media.status = 'pending_upload' THEN 'pending_upload_retention'
           WHEN media.status = 'pending_review' THEN 'pending_review_retention'
           WHEN media.status = 'approved_private' THEN 'approved_private_retention'
           ELSE 'rejected_retention'
         END AS reason
       FROM realization_media_intake AS media
       LEFT JOIN photo_upload_invites AS invite ON invite.id = media.invite_id
       WHERE (
         (media.status = 'deletion_pending' AND (media.deletion_attempted_at IS NULL OR media.deletion_attempted_at <= now() - ($1::int * interval '1 day')))
         OR (media.status = 'pending_upload' AND (
           (media.created_at <= now() - ($2::int * interval '1 day')
             OR invite.revoked_at IS NOT NULL OR invite.expires_at <= now())
           AND (media.upload_token_issued_at IS NULL OR media.upload_token_issued_at <= now() - ($2::int * interval '1 day'))
         ))
         OR (media.status = 'pending_review' AND COALESCE(media.uploaded_at, media.created_at) <= now() - ($3::int * interval '1 day'))
         OR (media.status = 'approved_private' AND COALESCE(media.reviewed_at, media.created_at) <= now() - ($4::int * interval '1 day'))
         OR (media.status = 'rejected' AND COALESCE(media.reviewed_at, media.created_at) <= now() - ($5::int * interval '1 day'))
       )
         AND NOT EXISTS (
           SELECT 1 FROM photo_intake_sanitization_attempts AS attempt
           WHERE attempt.media_id = media.id AND attempt.cleanup_status <> 'done'
         )
         AND NOT EXISTS (
           SELECT 1 FROM realization_case_draft_media AS linked
           WHERE linked.media_id = media.id
           AND media.deletion_reason <> 'admin_withdrawal'
         )
       ORDER BY COALESCE(media.reviewed_at, media.uploaded_at, media.created_at) ASC
       LIMIT $6
       FOR UPDATE OF media SKIP LOCKED`,
      [
        photoIntakeRetentionDays.deletionRetry,
        photoIntakeRetentionDays.pendingUpload,
        photoIntakeRetentionDays.pendingReview,
        photoIntakeRetentionDays.approvedPrivate,
        photoIntakeRetentionDays.rejected,
        batchSize,
      ],
    );
    const dueRows = due.rows as Array<{ id: string; reason: string }>;
    const claimed = dueRows.length
      ? await client.query(
        `UPDATE realization_media_intake AS media
         SET status = 'deletion_pending',
             deletion_reason = CASE WHEN media.status = 'deletion_pending' THEN media.deletion_reason ELSE due.reason END,
             deletion_attempted_at = now(), deletion_error = ''
         FROM unnest($1::uuid[], $2::text[]) AS due(id, reason)
         WHERE media.id = due.id
           AND NOT EXISTS (
             SELECT 1 FROM photo_intake_sanitization_attempts AS attempt
             WHERE attempt.media_id = media.id AND attempt.cleanup_status <> 'done'
           )
           AND NOT EXISTS (
           SELECT 1 FROM realization_case_draft_media AS linked
           WHERE linked.media_id = media.id
             AND media.deletion_reason <> 'admin_withdrawal'
         )
         RETURNING media.id, media.invite_id, media.storage_driver, media.storage_key, media.deletion_reason`,
        [dueRows.map((row) => row.id), dueRows.map((row) => row.reason)],
      )
      : { rows: [] };
    await client.query('COMMIT');
    return claimed.rows.map((row) => ({
      id: String(row.id), inviteId: String(row.invite_id), storageDriver: String(row.storage_driver),
      storageKey: String(row.storage_key), reason: String(row.deletion_reason),
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function markPhotoIntakeDeletionFailed(id: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  await db.query(
    `UPDATE realization_media_intake
     SET deletion_attempted_at = now(), deletion_attempts = deletion_attempts + 1,
         deletion_error = 'Odstránenie súkromného objektu zlyhalo; pokus sa zopakuje.'
     WHERE id = $1 AND status = 'deletion_pending'`,
    [id],
  );
}

export async function completePhotoIntakeDeletion(id: string, deletedBy = 'cron:photo-intake-retention') {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `DELETE FROM realization_media_intake
       WHERE id = $1 AND status = 'deletion_pending'
         AND NOT EXISTS (
           SELECT 1 FROM photo_intake_sanitization_attempts AS attempt
           WHERE attempt.media_id = realization_media_intake.id AND attempt.cleanup_status <> 'done'
         )
       RETURNING id, deletion_reason, deletion_attempts`,
      [id],
    );
    if (!rows[0]) { await client.query('COMMIT'); return false; }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_media', $2, 'photo_intake_retention_deleted', $3, $4::jsonb, now())`,
      [randomUUID(), id, deletedBy, JSON.stringify({ reason: rows[0].deletion_reason, previousDeleteAttempts: Number(rows[0].deletion_attempts) })],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createPhotoIntakeRecord(input: {
  id: string;
  inviteId: string;
  storageKey: string;
  originalName: string;
}) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.inviteId]);
    const invite = await client.query(
      `SELECT id FROM photo_upload_invites WHERE id = $1 AND revoked_at IS NULL AND expires_at > now() LIMIT 1`,
      [input.inviteId],
    );
    if (!invite.rows[0]) throw new Error('Pozvánka už nie je platná.');
    const prior = await client.query(
      `SELECT * FROM realization_media_intake WHERE id = $1 AND invite_id = $2 AND storage_key = $3 LIMIT 1`,
      [input.id, input.inviteId, input.storageKey],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].status !== 'pending_upload') throw new Error('Táto fotografia už bola spracovaná.');
      await client.query('COMMIT');
      return toRealizationMediaIntake(prior.rows[0]);
    }
    const count = await client.query(
      `SELECT COUNT(*)::int AS count FROM realization_media_intake WHERE invite_id = $1`,
      [input.inviteId],
    );
    if (Number(count.rows[0]?.count ?? 0) >= maxIntakePhotosPerInvite) throw new Error('Tento nahrávací odkaz dosiahol limit fotografií.');
    const { rows } = await client.query(
      `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [input.id, input.inviteId, input.storageKey, cleanSlovakText(input.originalName).slice(0, 240) || 'fotografia'],
    );
    const media = rows[0];
    if (!media) throw new Error('Fotografiu sa nepodarilo bezpečne pripraviť.');
    await client.query('COMMIT');
    return toRealizationMediaIntake(media);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function markPhotoIntakeUploadTokenIssued(id: string, inviteId: string, storageKey: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const { rows } = await db.query(
    `UPDATE realization_media_intake AS media
     SET upload_token_issued_at = now()
     FROM photo_upload_invites AS invite
     WHERE media.id = $1 AND media.invite_id = $2 AND media.storage_key = $3
       AND media.status = 'pending_upload'
       AND invite.id = media.invite_id AND invite.revoked_at IS NULL AND invite.expires_at > now()
     RETURNING media.id`,
    [id, inviteId, storageKey],
  );
  return rows.length === 1;
}

export async function getPhotoIntakeRecord(id: string, inviteId?: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const values: unknown[] = [id];
  const inviteClause = inviteId ? `AND invite_id = $${values.push(inviteId)}` : '';
  const { rows } = await db.query(
    `SELECT * FROM realization_media_intake WHERE id = $1 ${inviteClause} LIMIT 1`,
    values,
  );
  return rows[0] ? toRealizationMediaIntake(rows[0]) : null;
}

export async function reservePhotoIntakeSanitizationAttempt(id: string, inviteId: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const invite = await client.query(
      `SELECT id FROM photo_upload_invites WHERE id = $1 AND revoked_at IS NULL AND expires_at > now() FOR UPDATE`,
      [inviteId],
    );
    if (!invite.rows[0]) { await client.query('ROLLBACK'); return null; }
    const mediaResult = await client.query(
      `SELECT * FROM realization_media_intake
       WHERE id = $1 AND invite_id = $2 AND status IN ('pending_upload', 'pending_review') FOR UPDATE`,
      [id, inviteId],
    );
    const media = mediaResult.rows[0];
    if (!media) { await client.query('ROLLBACK'); return null; }

    if (media.sanitization_attempt_id) {
      const active = await client.query(
        `SELECT id, status, created_at > now() - interval '5 minutes' AS fresh FROM photo_intake_sanitization_attempts WHERE id = $1 FOR UPDATE`,
        [media.sanitization_attempt_id],
      );
      const attempt = active.rows[0];
      if (attempt?.status === 'active' && attempt.fresh) {
        await client.query('ROLLBACK');
        return null;
      }
      if (attempt?.status === 'active') {
        await client.query(
          `UPDATE photo_intake_sanitization_attempts SET status = 'abandoned', updated_at = now() WHERE id = $1 AND status = 'active'`,
          [attempt.id],
        );
      }
      await client.query('UPDATE realization_media_intake SET sanitization_attempt_id = NULL WHERE id = $1', [id]);
    }

    const attemptId = randomUUID();
    const sourceStorageKey = String(media.storage_key);
    const targetStorageKey = `photo-intake/sanitized/${id}/${attemptId}.jpg`;
    await client.query(
      `INSERT INTO photo_intake_sanitization_attempts
       (id, media_id, source_storage_key, target_storage_key, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [attemptId, id, sourceStorageKey, targetStorageKey],
    );
    await client.query('UPDATE realization_media_intake SET sanitization_attempt_id = $2 WHERE id = $1', [id, attemptId]);
    await client.query('COMMIT');
    return {
      id: attemptId,
      mediaId: id,
      inviteId,
      sourceStorageKey,
      targetStorageKey,
      sanitizedAt: media.sanitized_at ? new Date(String(media.sanitized_at)).toISOString() : undefined,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function abandonPhotoIntakeSanitizationAttempt(id: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const attemptMedia = await client.query(
      'SELECT media_id FROM photo_intake_sanitization_attempts WHERE id = $1',
      [id],
    );
    if (!attemptMedia.rows[0]) { await client.query('COMMIT'); return; }
    await client.query('SELECT id FROM realization_media_intake WHERE id = $1 FOR UPDATE', [attemptMedia.rows[0].media_id]);
    const { rows } = await client.query(
      `UPDATE photo_intake_sanitization_attempts
       SET status = 'abandoned', updated_at = now()
       WHERE id = $1 AND status = 'active' RETURNING media_id`,
      [id],
    );
    if (rows[0]) {
      await client.query(
        'UPDATE realization_media_intake SET sanitization_attempt_id = NULL WHERE id = $1 AND sanitization_attempt_id = $2',
        [rows[0].media_id, id],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export type PhotoIntakeSanitizationCleanup = { id: string; storageDriver: string; storageKey: string };

export async function claimPhotoIntakeSanitizationCleanups(limit = 50): Promise<PhotoIntakeSanitizationCleanup[]> {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  const batchSize = Math.max(1, Math.min(100, Math.trunc(limit) || 1));
  try {
    await client.query('BEGIN');
    const due = await client.query(
      `SELECT attempt.id, attempt.media_id, attempt.status, attempt.source_storage_key, attempt.target_storage_key
       FROM photo_intake_sanitization_attempts AS attempt
       WHERE (
         (attempt.cleanup_status = 'pending' AND (
           (attempt.status IN ('abandoned', 'active') AND attempt.created_at <= now() - interval '5 minutes')
           OR (attempt.status = 'committed' AND attempt.created_at <= now() - interval '1 day')
         ))
         OR (attempt.cleanup_status = 'failed' AND attempt.cleanup_attempted_at <= now() - interval '1 day')
         OR (attempt.cleanup_status = 'deleting' AND attempt.cleanup_attempted_at <= now() - interval '1 day')
       )
       ORDER BY attempt.created_at ASC
       LIMIT $1 FOR UPDATE OF attempt SKIP LOCKED`,
      [batchSize],
    );
    const claimed: PhotoIntakeSanitizationCleanup[] = [];
    for (const attempt of due.rows) {
      const status = String(attempt.status);
      if (status === 'active') {
        await client.query(
          `UPDATE photo_intake_sanitization_attempts SET status = 'abandoned', updated_at = now() WHERE id = $1 AND status = 'active'`,
          [attempt.id],
        );
      }
      const cleanupKey = status === 'committed' ? String(attempt.source_storage_key) : String(attempt.target_storage_key);
      await client.query(
        `UPDATE photo_intake_sanitization_attempts
         SET cleanup_status = 'deleting', cleanup_storage_key = $2, cleanup_attempted_at = now(), cleanup_error = ''
         WHERE id = $1`,
        [attempt.id, cleanupKey],
      );
      claimed.push({ id: String(attempt.id), storageDriver: 'vercel_blob', storageKey: cleanupKey });
    }
    await client.query('COMMIT');
    return claimed;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function completePhotoIntakeSanitizationCleanup(id: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const { rows } = await db.query(
    `UPDATE photo_intake_sanitization_attempts SET cleanup_status = 'done', updated_at = now()
     WHERE id = $1 AND cleanup_status = 'deleting' RETURNING id`,
    [id],
  );
  return rows.length === 1;
}

export async function failPhotoIntakeSanitizationCleanup(id: string) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  await db.query(
    `UPDATE photo_intake_sanitization_attempts
     SET cleanup_status = 'failed', cleanup_attempted_at = now(), cleanup_attempts = cleanup_attempts + 1,
         cleanup_error = 'Súkromný pomocný objekt sa nepodarilo odstrániť; pokus sa zopakuje.'
     WHERE id = $1 AND cleanup_status = 'deleting'`,
    [id],
  );
}

export async function completePhotoIntakeRecord(input: {
  id: string;
  inviteId: string;
  storageKey: string;
  targetStorageKey: string;
  sanitizationAttemptId: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  locality: string;
  categories: string[];
  expectedMetadataVersion: number;
}) {
  if (input.targetStorageKey === input.storageKey || !input.targetStorageKey.startsWith(`photo-intake/sanitized/${input.id}/`)) {
    throw new Error('Neplatná súkromná cesta očistenej fotografie.');
  }
  if (input.mimeType !== 'image/jpeg' || !Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || !/^[0-9a-f]{64}$/.test(input.contentHash)) {
    throw new Error('Neplatné údaje očistenej fotografie.');
  }
  if ((input.locality && !isApproximateLocality(input.locality)) || input.categories.some((category) => !isPhotoCategory(category))
    || new Set(input.categories).size !== input.categories.length) throw new Error('Skontrolujte približnú lokalitu a typy objektov fotografie.');
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const invite = await client.query(
      `SELECT id FROM photo_upload_invites
       WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [input.inviteId],
    );
    if (!invite.rows[0]) { await client.query('ROLLBACK'); return null; }
    const current = await client.query(
      `SELECT media.*, attempt.status AS sanitization_attempt_status
       FROM realization_media_intake AS media
       JOIN photo_intake_sanitization_attempts AS attempt ON attempt.id = media.sanitization_attempt_id
       WHERE media.id = $1 AND media.invite_id = $2 AND media.storage_key = $3
         AND media.sanitization_attempt_id = $4 AND attempt.id = $4 AND attempt.status = 'active'
         AND attempt.source_storage_key = media.storage_key AND attempt.target_storage_key = $5
         AND media.status IN ('pending_upload', 'pending_review')
       FOR UPDATE OF media, attempt`,
      [input.id, input.inviteId, input.storageKey, input.sanitizationAttemptId, input.targetStorageKey],
    );
    const row = current.rows[0];
    if (!row) { await client.query('ROLLBACK'); return null; }
    const mimeType = input.mimeType;
    const sizeBytes = input.sizeBytes;
    const contentHash = input.contentHash;
    const locality = cleanSlovakText(input.locality).trim().slice(0, 120);
    const sameContent = String(row.content_hash ?? '') === contentHash;
    const currentCategories = parseStringArray(row.categories);
    const sameMetadata = String(row.locality ?? '') === locality
      && JSON.stringify(currentCategories) === JSON.stringify(input.categories);
    const currentVersion = Math.max(1, Number(row.metadata_version ?? 1));
    if (currentVersion !== input.expectedMetadataVersion && (!sameMetadata || !sameContent)) {
      await client.query('ROLLBACK');
      return null;
    }
    if (sameMetadata && sameContent && row.uploaded_at) {
      const stable = await client.query(
        `UPDATE realization_media_intake SET status = 'pending_review', storage_key = $2, mime_type = $3, size_bytes = $4,
           content_hash = $5, sanitized_at = COALESCE(sanitized_at, now()), sanitization_attempt_id = NULL
         WHERE id = $1 AND status IN ('pending_upload', 'pending_review') RETURNING *`,
        [input.id, input.targetStorageKey, mimeType, sizeBytes, contentHash],
      );
      await client.query(
        `UPDATE photo_intake_sanitization_attempts SET status = 'committed', updated_at = now() WHERE id = $1 AND status = 'active'`,
        [input.sanitizationAttemptId],
      );
      await client.query('COMMIT');
      return stable.rows[0] ? toRealizationMediaIntake(stable.rows[0]) : null;
    }
    const { rows } = await client.query(
      `UPDATE realization_media_intake
       SET storage_key = $1, mime_type = $2, size_bytes = $3, content_hash = $4, sanitized_at = now(), locality = $5, categories = $6::jsonb,
           uploaded_at = COALESCE(uploaded_at, now()),
           metadata_version = metadata_version + 1, status = 'pending_review', sanitization_attempt_id = NULL
       WHERE id = $7 AND invite_id = $8 AND storage_key = $9 AND metadata_version = $10
         AND sanitization_attempt_id = $11 AND status IN ('pending_upload', 'pending_review')
       RETURNING *`,
      [input.targetStorageKey, mimeType, sizeBytes, contentHash, locality, JSON.stringify(input.categories), input.id, input.inviteId,
        input.storageKey, currentVersion, input.sanitizationAttemptId],
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return null; }
    await client.query(
      `UPDATE photo_intake_sanitization_attempts SET status = 'committed', updated_at = now()
       WHERE id = $1 AND status = 'active'`,
      [input.sanitizationAttemptId],
    );
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_media', $2, 'photo_intake_metadata_updated_by_worker', 'worker:photo-intake', $3::jsonb, now())`,
      [randomUUID(), input.id, JSON.stringify({ fields: ['locality', 'categories'], categories: input.categories })],
    );
    await client.query('COMMIT');
    return toRealizationMediaIntake(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listPhotoIntakeRecords(options: { inviteId?: string; businessJobId?: string | null; pendingOnly?: boolean; approvedOnly?: boolean; page?: number; pageSize?: number } = {}) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (options.inviteId) {
    values.push(options.inviteId);
    clauses.push(`m.invite_id = $${values.length}`);
  }
  if (Object.hasOwn(options, 'businessJobId')) {
    values.push(options.businessJobId ?? null);
    clauses.push(`EXISTS (SELECT 1 FROM photo_upload_invites job_invite WHERE job_invite.id=m.invite_id AND job_invite.business_job_id IS NOT DISTINCT FROM $${values.length}::uuid)`);
  }
  if (options.pendingOnly) clauses.push(`m.status = 'pending_review'`);
  if (options.approvedOnly) clauses.push(`m.status = 'approved_private' AND m.sanitized_at IS NOT NULL`);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const count = await db.query(`SELECT COUNT(*)::int AS total FROM realization_media_intake m ${where}`, values);
  const total = Number(count.rows[0]?.total ?? 0);
  const pageSize = Math.max(1, Math.min(100, Math.trunc(options.pageSize ?? 50) || 50));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(totalPages, Math.trunc(options.page ?? 1) || 1));
  const { rows } = await db.query(
    `SELECT m.*, i.business_job_id AS invite_business_job_id FROM realization_media_intake m
     JOIN photo_upload_invites i ON i.id=m.invite_id ${where}
     ORDER BY m.created_at DESC, m.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  return { records: rows.map(toRealizationMediaIntake), total, page, pageSize, totalPages };
}

export async function reviewPhotoIntakeRecord(input: { id: string; approve: boolean; reviewedBy: string; expectedMetadataVersion: number }) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE realization_media_intake SET status = $1, reviewed_at = now(), reviewed_by = $2
       WHERE id = $3 AND status = 'pending_review' AND metadata_version = $4
         AND ($1 <> 'approved_private' OR (
           sanitized_at IS NOT NULL
           AND char_length(regexp_replace(locality, '^[[:space:]]+|[[:space:]]+$', '', 'g')) BETWEEN 2 AND 120
           AND locality !~ '^[[:space:]]*$'
           AND btrim(locality) !~ '[0-9]'
           AND btrim(locality) !~* '(^|[[:space:]])(ul\\.?|ulica|námestie|nám\\.?|súpisné číslo|číslo domu)([[:space:]]|$)'
           AND jsonb_typeof(categories) = 'array'
           AND jsonb_array_length(categories) > 0
           AND categories <@ '["family_house","outbuilding","garage","illegal_dump","interior"]'::jsonb
         ))
       RETURNING *`,
      [input.approve ? 'approved_private' : 'rejected', input.reviewedBy, input.id, input.expectedMetadataVersion],
    );
    if (!rows[0]) { await client.query('COMMIT'); return null; }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_media', $2, $3, $4, $5::jsonb, now())`,
      [randomUUID(), input.id, input.approve ? 'photo_approved_private' : 'photo_rejected', input.reviewedBy, JSON.stringify({ status: rows[0].status })],
    );
    await client.query('COMMIT');
    return toRealizationMediaIntake(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePhotoIntakeMetadata(input: { id: string; locality: string; categories: string[]; updatedBy: string; expectedMetadataVersion: number; inviteId?: string }) {
  if ((input.locality && !isApproximateLocality(input.locality)) || input.categories.some((category) => !isPhotoCategory(category))
    || new Set(input.categories).size !== input.categories.length) throw new Error('Doplňte iba približnú lokalitu a aspoň jednu platnú kategóriu fotografie.');
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    if (input.inviteId) {
      const { rows: activeInvites } = await client.query(
        `SELECT id FROM photo_upload_invites
         WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [input.inviteId],
      );
      if (!activeInvites[0]) { await client.query('ROLLBACK'); return null; }
    }
    const { rows } = await client.query(
      `UPDATE realization_media_intake
       SET locality = $1, categories = $2::jsonb, metadata_version = metadata_version + 1
       WHERE id = $3 AND status IN ('pending_review', 'approved_private') AND metadata_version = $4
         AND ($5::uuid IS NULL OR (invite_id = $5 AND status = 'pending_review'))
         AND (status <> 'approved_private' OR (
           char_length(regexp_replace($1, '^[[:space:]]+|[[:space:]]+$', '', 'g')) BETWEEN 2 AND 120
           AND $1 !~ '^[[:space:]]*$'
           AND btrim($1) !~ '[0-9]'
           AND btrim($1) !~* '(^|[[:space:]])(ul\\.?|ulica|námestie|nám\\.?|súpisné číslo|číslo domu)([[:space:]]|$)'
           AND jsonb_array_length($2::jsonb) > 0
           AND $2::jsonb <@ '["family_house","outbuilding","garage","illegal_dump","interior"]'::jsonb
         ))
       RETURNING *`,
      [cleanSlovakText(input.locality).trim().slice(0, 120), JSON.stringify(input.categories), input.id, input.expectedMetadataVersion, input.inviteId ?? null],
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return null; }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_media', $2, 'photo_intake_metadata_updated', $3, $4::jsonb, now())`,
      [randomUUID(), input.id, input.updatedBy, JSON.stringify({ fields: ['locality', 'categories'], categories: input.categories })],
    );
    await client.query('COMMIT');
    return toRealizationMediaIntake(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withdrawApprovedPhotoIntakeRecord(input: { id: string; withdrawnBy: string; expectedMetadataVersion: number }) {
  await ensureSchema();
  const db = requirePhotoIntakeDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE realization_media_intake
       SET status = 'deletion_pending', deletion_reason = 'admin_withdrawal', deletion_attempted_at = NULL, deletion_error = ''
       WHERE id = $1 AND status = 'approved_private' AND metadata_version = $2
       RETURNING id`,
      [input.id, input.expectedMetadataVersion],
    );
    if (!rows[0]) { await client.query('COMMIT'); return null; }
    const links = await client.query('SELECT COUNT(*)::int AS count FROM realization_case_draft_media WHERE media_id = $1', [input.id]);
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'realization_media', $2, 'photo_intake_withdrawal_requested', $3, $4::jsonb, now())`,
      [randomUUID(), input.id, input.withdrawnBy, JSON.stringify({ deletionReason: 'admin_withdrawal', linkedDraftCount: Number(links.rows[0]?.count ?? 0) })],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveLead(id: string, actorEmail: string, reason = '') {
  await ensureSchema();
  const db = getPool();
  const archivedAt = now();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const lead = local.leads.find((item) => item.id === id && !item.deletedAt);
      if (!lead || local.leadEmailOutbox.some((item) => item.leadId === id && item.status === 'sending')) return null;
      const frozenRecipients = local.leadEmailOutbox.filter((item) => item.leadId === id
        && (item.status === 'pending' || (item.status === 'failed' && item.retryable)));
      for (const item of frozenRecipients) {
        item.status = 'unknown';
        item.retryable = false;
        item.lockedAt = undefined;
        item.lastError = 'Dopyt bol archivovaný pred odoslaním; výsledok vyžaduje samostatné preverenie.';
        item.updatedAt = archivedAt;
      }
      const frozenMetaEvents = local.metaCapiOutbox.filter((item) => item.leadId === id && !['sent', 'cancelled'].includes(item.status));
      for (const item of frozenMetaEvents) {
        item.status = 'cancelled'; item.retryable = false; item.claimId = undefined; item.claimedUntil = undefined;
        item.lastErrorCode = 'lead_archived'; item.updatedAt = archivedAt;
      }
      lead.deletedAt = archivedAt;
      lead.updatedAt = archivedAt;
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'lead', entityId: id, action: 'lead_archived', actorEmail, changes: { deletedAt: archivedAt, reason: reason.trim().slice(0, 500) }, createdAt: archivedAt });
      if (frozenRecipients.length) local.auditLogs.unshift({ id: randomUUID(), entityType: 'lead', entityId: id, action: 'lead_email_archive_frozen', actorEmail, changes: { recipientRoles: frozenRecipients.map((item) => item.recipientRole) }, createdAt: archivedAt });
      for (const item of frozenMetaEvents) local.auditLogs.unshift({ id: randomUUID(), entityType: 'system', entityId: item.id, action: 'meta_capi_cancelled', actorEmail, changes: { status: 'cancelled', reason: 'lead_archived' }, createdAt: archivedAt });
      await writeLocalDb(local);
      return lead;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const activeLead = await client.query('SELECT id FROM leads WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [id]);
    if (activeLead.rowCount !== 1) {
      await client.query('ROLLBACK');
      return null;
    }
    const sending = await client.query("SELECT 1 FROM lead_email_outbox WHERE lead_id = $1 AND status = 'sending' LIMIT 1", [id]);
    if (sending.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    const { rows } = await client.query(
      'UPDATE leads SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING *',
      [archivedAt, id],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const frozen = await client.query(
      `UPDATE lead_email_outbox SET status = 'unknown', retryable = false, locked_at = NULL, updated_at = $2,
         last_error = 'Dopyt bol archivovaný pred odoslaním; výsledok vyžaduje samostatné preverenie.'
       WHERE lead_id = $1 AND (status = 'pending' OR (status = 'failed' AND retryable = true)) RETURNING recipient_role`,
      [id, archivedAt],
    );
    const frozenMeta = await client.query(
      `UPDATE lead_meta_capi_outbox SET status='cancelled', retryable=false, claim_id=NULL, claimed_until=NULL,
       last_error_code='lead_archived', updated_at=$2 WHERE lead_id=$1 AND status NOT IN ('sent','cancelled') RETURNING id`,
      [id, archivedAt],
    );
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'lead', id, 'lead_archived', actorEmail, { deletedAt: archivedAt, reason: reason.trim().slice(0, 500) }, archivedAt],
    );
    if (frozen.rows.length) await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'lead', id, 'lead_email_archive_frozen', actorEmail, { recipientRoles: frozen.rows.map((row) => row.recipient_role) }, archivedAt],
    );
    for (const row of frozenMeta.rows) await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'system', row.id, 'meta_capi_cancelled', actorEmail, { status: 'cancelled', reason: 'lead_archived' }, archivedAt],
    );
    await client.query('COMMIT');
    return toLead(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function restoreLead(id: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const lead = local.leads.find((item) => item.id === id && item.deletedAt);
      if (!lead) return null;
      const restoredAt = now();
      const frozenRecipients = local.leadEmailOutbox.filter((item) => item.leadId === id
        && (item.status === 'pending' || (item.status === 'failed' && item.retryable)));
      for (const item of frozenRecipients) {
        item.status = 'unknown';
        item.retryable = false;
        item.lockedAt = undefined;
        item.lastError = 'Starý emailový pokus po obnovení dopytu vyžaduje samostatné preverenie.';
        item.updatedAt = restoredAt;
      }
      lead.deletedAt = undefined;
      lead.updatedAt = restoredAt;
      if (frozenRecipients.length) local.auditLogs.unshift({ id: randomUUID(), entityType: 'lead', entityId: id, action: 'lead_email_restore_frozen', actorEmail, changes: { recipientRoles: frozenRecipients.map((item) => item.recipientRole) }, createdAt: restoredAt });
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'lead', entityId: id, action: 'lead_restored', actorEmail, changes: {}, createdAt: restoredAt });
      await writeLocalDb(local);
      return lead;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const archived = await client.query('SELECT id FROM leads WHERE id = $1 AND deleted_at IS NOT NULL FOR UPDATE', [id]);
    if (archived.rowCount !== 1) {
      await client.query('ROLLBACK');
      return null;
    }
    const restoredAt = now();
    const frozen = await client.query(
      `UPDATE lead_email_outbox SET status = 'unknown', retryable = false, locked_at = NULL, updated_at = $2,
         last_error = 'Starý emailový pokus po obnovení dopytu vyžaduje samostatné preverenie.'
       WHERE lead_id = $1 AND (status = 'pending' OR (status = 'failed' AND retryable = true)) RETURNING recipient_role`,
      [id, restoredAt],
    );
    const { rows } = await client.query('UPDATE leads SET deleted_at = NULL, updated_at = $2 WHERE id = $1 RETURNING *', [id, restoredAt]);
    if (frozen.rows.length) await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'lead', id, 'lead_email_restore_frozen', actorEmail, { recipientRoles: frozen.rows.map((row) => row.recipient_role) }, restoredAt],
    );
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'lead', id, 'lead_restored', actorEmail, {}, restoredAt],
    );
    await client.query('COMMIT');
    return toLead(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function destroyArchivedLead(id: string, actorEmail: string, reason: string) {
  await ensureSchema();
  const lead = await getLeadWithFiles(id, true);
  if (!lead?.deletedAt) return null;
  const cleanReason = reason.trim().slice(0, 500);
  if (cleanReason.length < 3) throw new Error('Trvalé odstránenie vyžaduje dôvod.');
  const blockingQuotes = lead.quotes.filter((quote) => !['draft', 'cancelled'].includes(quote.status));
  if (blockingQuotes.length) {
    throw new Error('Trvalé odstránenie je zablokované, pretože dopyt má aktívnu alebo historickú cenovú ponuku. Najprv ju zrušte alebo archivujte.');
  }
  const db = getPool();
  if (!db) {
    const removed = await withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const currentLead = local.leads.find((item) => item.id === id && item.deletedAt);
      if (!currentLead) return false;
      const currentQuotes = local.quotes.filter((quote) => quote.leadId === id);
      if (currentQuotes.some((quote) => !['draft', 'cancelled'].includes(quote.status))) {
        throw new Error('Trvalé odstránenie je zablokované, pretože dopyt má aktívnu alebo historickú cenovú ponuku. Najprv ju zrušte alebo archivujte.');
      }
      const currentFiles = local.leadFiles.filter((file) => file.leadId === id);
      const timestamp = now();
      for (const file of currentFiles) {
        if (!local.leadFileDeletionJobs.some((job) => job.storageDriver === file.storageDriver && job.storageKey === file.storageKey)) {
          local.leadFileDeletionJobs.push({ id: randomUUID(), leadId: id, fileId: file.id, storageDriver: file.storageDriver, storageKey: file.storageKey, status: 'pending', attempts: 0, nextAttemptAt: timestamp, lastError: '', createdAt: timestamp, updatedAt: timestamp });
        }
      }
      if (currentLead.isTestData) {
        const latestJobClassificationAt = (jobId: string) => local.auditLogs
          .filter((log) => log.entityType === 'business_job' && log.entityId === jobId && log.action === 'business_job_test_classification_changed')
          .reduce((latest, log) => Math.max(latest, Date.parse(log.createdAt) || 0), 0);
        for (const job of local.businessJobs) {
          if (job.leadId !== id || job.isTestData) continue;
          job.isTestData = true;
          local.auditLogs.unshift({
            id: randomUUID(), entityType: 'business_job', entityId: job.id, action: 'business_job_test_classification_changed', actorEmail,
            changes: { previous: false, next: true, reason: 'Zdrojový testovací dopyt bol trvalo odstránený' },
            createdAt: new Date(Math.max(Date.now(), latestJobClassificationAt(job.id) + 1)).toISOString(),
          });
        }
      }
      const linkedJobIds = new Set(local.businessJobs.filter((job) => job.leadId === id).map((job) => job.id));
      for (const offer of local.priceOffers) {
        if (offer.leadId === id || offer.sourceInquiry === `dopyt:${id}` || linkedJobIds.has(offer.jobId || '')
          || (offer.sourceJobIds ?? []).some((jobId) => linkedJobIds.has(jobId))) {
          if (currentLead.isTestData) offer.isTestData = true;
          if (offer.leadId === id) offer.leadId = undefined;
        }
      }
      local.leads = local.leads.filter((item) => item.id !== id);
      local.leadFiles = local.leadFiles.filter((file) => file.leadId !== id);
      local.leadEmailOutbox = local.leadEmailOutbox.filter((item) => item.leadId !== id);
      local.metaCapiOutbox = local.metaCapiOutbox.filter((item) => item.leadId !== id);
      local.quotes = local.quotes.filter((quote) => quote.leadId !== id);
      local.reviewRequests = local.reviewRequests.map((request) => request.leadId === id ? { ...request, leadId: undefined } : request);
      local.auditLogs = local.auditLogs.filter((log) => !(log.entityType === 'lead' && log.entityId === id));
      local.auditLogs.unshift({ id: randomUUID(), entityType: 'lead', entityId: id, action: 'lead_deleted', actorEmail, changes: { reasonRecorded: true, removedFiles: currentFiles.length, removedQuotes: currentQuotes.length, fileDeletionJobsQueued: currentFiles.length }, createdAt: timestamp });
      await writeLocalDb(local, { purgeLeadAuditId: id });
      return true;
    });
    if (!removed) return null;
  } else {
    const client = await db.connect();
    let discardConnection: Error | undefined;
    try {
      await client.query('BEGIN');
      const timestamp = now();
      const current = await client.query('SELECT is_test_data FROM leads WHERE id = $1 AND deleted_at IS NOT NULL FOR UPDATE', [id]);
      if (current.rowCount !== 1) throw new Error('Archivovaný dopyt sa medzičasom zmenil.');
      if (current.rows[0].is_test_data) {
        await client.query('UPDATE business_jobs SET is_test_data = true WHERE lead_id = $1', [id]);
        await client.query(`UPDATE price_offers o SET is_test_data = true
          WHERE o.lead_id = $1::uuid OR o.source_inquiry = 'dopyt:' || $1::text
            OR EXISTS (SELECT 1 FROM business_jobs j WHERE j.lead_id = $1::uuid
              AND (j.id = o.job_id OR j.id = ANY(o.source_job_ids)))`, [id]);
      }
      for (const file of lead.files) {
        await client.query(
          `INSERT INTO lead_file_deletion_jobs (id, lead_id, file_id, storage_driver, storage_key, status, attempts, next_attempt_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,'pending',0,$6,$6,$6) ON CONFLICT (storage_driver, storage_key) DO NOTHING`,
          [randomUUID(), id, file.id, file.storageDriver, file.storageKey, timestamp],
        );
        await client.query("UPDATE lead_upload_drafts SET status = 'deleting', updated_at = $2 WHERE storage_key = $1 AND status = 'attached'", [file.storageKey, timestamp]);
      }
      await client.query('UPDATE review_requests SET lead_id = NULL WHERE lead_id = $1', [id]);
      await client.query('DELETE FROM quotes WHERE lead_id = $1', [id]);
      await client.query('DELETE FROM lead_files WHERE lead_id = $1', [id]);
      const deletedLead = await client.query('DELETE FROM leads WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
      if (deletedLead.rowCount !== 1) throw new Error('Archivovaný dopyt sa medzičasom zmenil.');
      await client.query("DELETE FROM audit_logs WHERE entity_type = 'lead' AND entity_id = $1", [id]);
      await client.query(
        'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), 'lead', id, 'lead_deleted', actorEmail, { reasonRecorded: true, removedFiles: lead.files.length, removedQuotes: lead.quotes.length, fileDeletionJobsQueued: lead.files.length }, timestamp],
      );
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        discardConnection = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
        throw new AggregateError([error, rollbackError], 'Trvalé odstránenie zlyhalo a rollback sa nepodaril.');
      }
      throw error;
    } finally {
      client.release(discardConnection);
    }
  }
  return lead;
}

type RooferRegistrationCreateResult = {
  registration: RooferRegistration;
  duplicate: boolean;
};

const rooferRegistrationWrites = new Map<string, Promise<RooferRegistrationCreateResult>>();

export async function listRooferRegistrations(): Promise<RooferRegistration[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.rooferRegistrations
      .map((registration) => toRooferRegistration(registration as unknown as Record<string, unknown>))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { rows } = await db.query('SELECT * FROM roofer_registrations ORDER BY created_at DESC LIMIT 300');
  return rows.map(toRooferRegistration);
}

export async function getRooferRegistrationBySubmissionId(submissionId: string): Promise<RooferRegistration | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query('SELECT * FROM roofer_registrations WHERE submission_id = $1 LIMIT 1', [submissionId]);
  return rows[0] ? toRooferRegistration(rows[0]) : null;
}

export async function createRooferRegistration(input: Omit<RooferRegistration, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<RooferRegistrationCreateResult> {
  const existingWrite = rooferRegistrationWrites.get(input.submissionId);
  if (existingWrite) {
    return { registration: (await existingWrite).registration, duplicate: true };
  }

  const write = (async () => {
    await ensureSchema();
    const db = getPool();
    if (!db) throw new Error('Perspektívne doručovanie vyžaduje trvalú databázu; lokálny režim registráciu neprijme.');

    const timestamp = now();
    const client = await db.connect();
    let registration: RooferRegistration;
    let created = false;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO roofer_registrations (
        id, submission_id, created_at, updated_at, business_type, company_name, company_id,
        contact_person, phone, email, website, service_regions, specializations,
        other_specialization, can_build_roof_truss, accept_customer_referrals,
        consent_public_profile, privacy_consent, note, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (submission_id) DO NOTHING
      RETURNING *`,
        [randomUUID(), input.submissionId, timestamp, timestamp, input.businessType, input.companyName, input.companyId,
          input.contactPerson, input.phone, input.email, input.website, JSON.stringify(input.serviceRegions),
          JSON.stringify(input.specializations), input.otherSpecialization, input.canBuildRoofTruss,
          input.acceptCustomerReferrals, input.consentPublicProfile, input.privacyConsent, input.note, 'new'],
      );
      if (rows[0]) {
        registration = toRooferRegistration(rows[0]);
        created = true;
        await client.query(
          `INSERT INTO application_notification_outbox (id, entity_type, entity_id, recipient_role)
           VALUES ($1, 'roofer_registration', $2, 'applicant'), ($3, 'roofer_registration', $2, 'internal')`,
          [randomUUID(), registration.id, randomUUID()],
        );
      } else {
        const duplicate = await client.query('SELECT * FROM roofer_registrations WHERE submission_id = $1 LIMIT 1', [input.submissionId]);
        if (!duplicate.rows[0]) throw new Error('Roofer registration was not persisted.');
        registration = toRooferRegistration(duplicate.rows[0]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    if (created) await addAuditLog('roofer_registration', registration.id, 'roofer_registration_created', 'public', {
      businessType: registration.businessType,
      companyName: registration.companyName,
      serviceRegions: registration.serviceRegions,
    }).catch((error) => console.error('Roofer registration committed; audit entry failed', { registrationId: registration.id, error }));
    return { registration, duplicate: !created };
  })();

  rooferRegistrationWrites.set(input.submissionId, write);
  try {
    return await write;
  } finally {
    if (rooferRegistrationWrites.get(input.submissionId) === write) rooferRegistrationWrites.delete(input.submissionId);
  }
}

type CareerApplicationCreateResult = {
  application: CareerApplication;
  duplicate: boolean;
};

const careerApplicationWrites = new Map<string, Promise<CareerApplicationCreateResult>>();

const careerApplicationStatuses = new Set<CareerApplication['status']>(['new', 'reviewed', 'archived']);

function normalizeCareerApplicationFilters(filters: CareerApplicationFilters = {}): CareerApplicationFilters {
  if (filters.status && !careerApplicationStatuses.has(filters.status)) throw new Error('Neplatný stav kariérnej žiadosti.');
  const unassignedOnly = filters.unassignedOnly === true;
  return {
    status: filters.status,
    ownerEmail: unassignedOnly ? undefined : filters.ownerEmail?.trim().toLowerCase() || undefined,
    unassignedOnly,
    dueOnly: filters.dueOnly === true,
  };
}

function careerApplicationMatchesFilters(application: CareerApplication, filters: CareerApplicationFilters) {
  if (filters.status ? application.status !== filters.status : application.status === 'archived') return false;
  if (filters.unassignedOnly && application.ownerEmail !== '') return false;
  if (filters.ownerEmail && application.ownerEmail !== filters.ownerEmail) return false;
  if (filters.dueOnly && (!application.followupDate || application.followupDate > dateInBratislava(new Date()))) return false;
  return true;
}

function careerApplicationFilterSql(filters: CareerApplicationFilters) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const addValue = (clause: string, value: unknown) => {
    values.push(value);
    clauses.push(clause.replace('?', `$${values.length}`));
  };
  if (filters.status) addValue('status = ?', filters.status);
  else clauses.push("status <> 'archived'");
  if (filters.unassignedOnly) clauses.push("owner_email = ''");
  if (filters.ownerEmail) addValue('lower(owner_email) = ?', filters.ownerEmail);
  if (filters.dueOnly) addValue('followup_date IS NOT NULL AND followup_date <= ?', dateInBratislava(new Date()));
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
}

export async function countCareerApplications(filters: CareerApplicationFilters = {}): Promise<{ total: number; incompleteCv: number }> {
  await ensureSchema();
  const normalizedFilters = normalizeCareerApplicationFilters(filters);
  const db = getPool();
  if (!db) {
    const applications = (await readLocalDb()).careerApplications
      .map((item) => toCareerApplication(item as unknown as Record<string, unknown>))
      .filter((item) => careerApplicationMatchesFilters(item, normalizedFilters));
    return { total: applications.length, incompleteCv: applications.filter((item) => item.cvExpected && !item.cv).length };
  }
  const filter = careerApplicationFilterSql(normalizedFilters);
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE cv_expected AND NOT (cv_storage_key <> '' AND cv_storage_driver IN ('vercel_blob', 's3', 'local')))::int AS incomplete_cv
     FROM career_applications ${filter.where}`,
    filter.values,
  );
  return { total: Number(rows[0]?.total ?? 0), incompleteCv: Number(rows[0]?.incomplete_cv ?? 0) };
}

export async function listCareerApplications(page = 1, limit = 50, filters: CareerApplicationFilters = {}): Promise<CareerApplication[]> {
  await ensureSchema();
  const normalizedFilters = normalizeCareerApplicationFilters(filters);
  const db = getPool();
  const pageSize = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 50;
  const pageNumber = Number.isSafeInteger(page) ? Math.max(1, Math.min(page, 100_000)) : 1;
  const offset = (pageNumber - 1) * pageSize;
  if (!db) {
    const local = await readLocalDb();
    return local.careerApplications
      .map((application) => toCareerApplication(application as unknown as Record<string, unknown>))
      .filter((application) => careerApplicationMatchesFilters(application, normalizedFilters))
      .sort((a, b) => Number(b.cvExpected && !b.cv) - Number(a.cvExpected && !a.cv) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .slice(offset, offset + pageSize);
  }
  const filter = careerApplicationFilterSql(normalizedFilters);
  const { rows } = await db.query(
    `SELECT * FROM career_applications ${filter.where}
     ORDER BY (cv_expected AND NOT (cv_storage_key <> '' AND cv_storage_driver IN ('vercel_blob', 's3', 'local'))) DESC, created_at DESC, id DESC
     LIMIT $${filter.values.length + 1} OFFSET $${filter.values.length + 2}`,
    [...filter.values, pageSize, offset],
  );
  return rows.map(toCareerApplication);
}

export async function getCareerApplication(id: string): Promise<CareerApplication | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const application = local.careerApplications.find((item) => item.id === id);
    return application ? toCareerApplication(application as unknown as Record<string, unknown>) : null;
  }
  const { rows } = await db.query('SELECT * FROM career_applications WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ? toCareerApplication(rows[0]) : null;
}

function normalizeCareerWorkflowInput(input: CareerApplicationWorkflowInput): CareerApplicationWorkflowInput {
  if (input.status !== 'new' && input.status !== 'reviewed') throw new Error('Neplatný stav kariérnej žiadosti.');
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const nextAction = cleanSlovakText(input.nextAction.trim());
  if (nextAction.length > 300) throw new Error('Ďalší krok môže mať najviac 300 znakov.');
  const followupDate = input.followupDate.trim();
  if (followupDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(followupDate)) throw new Error('Neplatný termín ďalšieho kroku.');
    const parsed = new Date(`${followupDate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== followupDate) {
      throw new Error('Neplatný termín ďalšieho kroku.');
    }
  }
  const expectedUpdatedAt = input.expectedUpdatedAt.trim();
  const parsedUpdatedAt = new Date(expectedUpdatedAt);
  if (Number.isNaN(parsedUpdatedAt.getTime()) || parsedUpdatedAt.toISOString() !== expectedUpdatedAt) {
    throw new Error('Neplatná verzia kariérnej žiadosti. Obnovte stránku a skúste to znova.');
  }
  return { status: input.status, ownerEmail, nextAction, followupDate, expectedUpdatedAt };
}

function careerWorkflowChangedFields(previous: CareerApplication, next: CareerApplicationWorkflowInput) {
  return (['status', 'ownerEmail', 'nextAction', 'followupDate'] as const)
    .filter((field) => previous[field] !== next[field]);
}

export async function updateCareerApplicationWorkflow(
  id: string,
  input: CareerApplicationWorkflowInput,
  actorEmail: string,
): Promise<CareerApplication | null> {
  const normalized = normalizeCareerWorkflowInput(input);
  const actor = actorEmail.trim().toLowerCase();
  if (!actor) throw new Error('Chýba administrátor zmeny.');
  await ensureSchema();
  const db = getPool();
  const timestamp = now();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const index = local.careerApplications.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const previous = toCareerApplication(local.careerApplications[index] as unknown as Record<string, unknown>);
      if (previous.updatedAt !== normalized.expectedUpdatedAt) {
        throw new Error('Žiadosť bola medzitým zmenená iným používateľom. Obnovte stránku a skúste to znova.');
      }
      if (previous.status === 'archived') throw new Error('Archivovanú žiadosť treba najprv obnoviť.');
      if (normalized.ownerEmail && !local.adminUsers.some((user) => user.active && user.email.trim().toLowerCase() === normalized.ownerEmail)) {
        throw new Error('Vlastníkom môže byť iba aktívny administrátor.');
      }
      const changedFields = careerWorkflowChangedFields(previous, normalized);
      if (!changedFields.length) return previous;
      const updated: CareerApplication = {
        ...previous,
        status: normalized.status,
        ownerEmail: normalized.ownerEmail,
        nextAction: normalized.nextAction,
        followupDate: normalized.followupDate,
        updatedAt: timestamp,
      };
      local.careerApplications[index] = updated;
      local.auditLogs.unshift({
        id: randomUUID(), entityType: 'career_application', entityId: id, action: 'career_application_workflow_updated', actorEmail: actor,
        changes: { changedFields, previousStatus: previous.status, nextStatus: updated.status, ownerEmail: updated.ownerEmail, followupDate: updated.followupDate },
        createdAt: timestamp,
      });
      await writeLocalDb(local);
      return updated;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM career_applications WHERE id=$1 FOR UPDATE', [id]);
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const previous = toCareerApplication(current.rows[0]);
    if (previous.updatedAt !== normalized.expectedUpdatedAt) {
      throw new Error('Žiadosť bola medzitým zmenená iným používateľom. Obnovte stránku a skúste to znova.');
    }
    if (previous.status === 'archived') throw new Error('Archivovanú žiadosť treba najprv obnoviť.');
    if (normalized.ownerEmail) {
      const owner = await client.query('SELECT 1 FROM admin_users WHERE lower(email)=lower($1) AND active=true LIMIT 1', [normalized.ownerEmail]);
      if (owner.rowCount !== 1) throw new Error('Vlastníkom môže byť iba aktívny administrátor.');
    }
    const changedFields = careerWorkflowChangedFields(previous, normalized);
    if (!changedFields.length) {
      await client.query('COMMIT');
      return previous;
    }
    const updated = await client.query(
      `UPDATE career_applications SET status=$2, owner_email=$3, next_action=$4, followup_date=NULLIF($5, '')::date, updated_at=$6
       WHERE id=$1 AND status <> 'archived' RETURNING *`,
      [id, normalized.status, normalized.ownerEmail, normalized.nextAction, normalized.followupDate, timestamp],
    );
    if (!updated.rows[0]) throw new Error('Kariérnu žiadosť sa nepodarilo uložiť.');
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'career_application', id, 'career_application_workflow_updated', actor,
        { changedFields, previousStatus: previous.status, nextStatus: normalized.status, ownerEmail: normalized.ownerEmail, followupDate: normalized.followupDate }, timestamp],
    );
    await client.query('COMMIT');
    return toCareerApplication(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function setCareerApplicationArchived(id: string, archived: boolean, actorEmail: string): Promise<CareerApplication | null> {
  const actor = actorEmail.trim().toLowerCase();
  if (!actor) throw new Error('Chýba administrátor zmeny.');
  await ensureSchema();
  const db = getPool();
  const timestamp = now();
  const nextStatus: CareerApplication['status'] = archived ? 'archived' : 'reviewed';
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const index = local.careerApplications.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const previous = toCareerApplication(local.careerApplications[index] as unknown as Record<string, unknown>);
      if ((archived && previous.status === 'archived') || (!archived && previous.status !== 'archived')) return previous;
      const updated: CareerApplication = { ...previous, status: nextStatus, updatedAt: timestamp };
      local.careerApplications[index] = updated;
      local.auditLogs.unshift({
        id: randomUUID(), entityType: 'career_application', entityId: id,
        action: archived ? 'career_application_archived' : 'career_application_restored', actorEmail: actor,
        changes: { previousStatus: previous.status, nextStatus }, createdAt: timestamp,
      });
      await writeLocalDb(local);
      return updated;
    });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM career_applications WHERE id=$1 FOR UPDATE', [id]);
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const previous = toCareerApplication(current.rows[0]);
    if ((archived && previous.status === 'archived') || (!archived && previous.status !== 'archived')) {
      await client.query('COMMIT');
      return previous;
    }
    const updated = await client.query('UPDATE career_applications SET status=$2, updated_at=$3 WHERE id=$1 RETURNING *', [id, nextStatus, timestamp]);
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'career_application', id, archived ? 'career_application_archived' : 'career_application_restored', actor,
        { previousStatus: previous.status, nextStatus }, timestamp],
    );
    await client.query('COMMIT');
    return toCareerApplication(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveCareerApplication(id: string, actorEmail: string) {
  return setCareerApplicationArchived(id, true, actorEmail);
}

export async function restoreCareerApplication(id: string, actorEmail: string) {
  return setCareerApplicationArchived(id, false, actorEmail);
}

export async function getCareerApplicationBySubmissionId(submissionId: string): Promise<CareerApplication | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) throw new Error('Obnoviteľné prijatie žiadosti vyžaduje trvalú databázu.');
  const { rows } = await db.query('SELECT * FROM career_applications WHERE submission_id = $1 LIMIT 1', [submissionId]);
  return rows[0] ? toCareerApplication(rows[0]) : null;
}

export type CareerCvUploadReservation = {
  applicationId: string;
  pathname: string;
  createdAt: string;
  originalName: string;
  expectedSize: number;
  expectedSha256: string;
  status: 'reserved' | 'uploaded' | 'attached' | 'deleting' | 'deletion_pending' | 'deleted';
};

function toCareerCvUploadReservation(row: Record<string, unknown>): CareerCvUploadReservation {
  return {
    applicationId: String(row.application_id),
    pathname: String(row.pathname),
    createdAt: new Date(String(row.created_at)).toISOString(),
    originalName: String(row.original_name),
    expectedSize: Number(row.expected_size),
    expectedSha256: String(row.expected_sha256),
    status: String(row.status) as CareerCvUploadReservation['status'],
  };
}

export async function reserveCareerCvUpload(input: {
  submissionId: string;
  pathname: string;
  originalName: string;
  expectedSize: number;
  expectedSha256: string;
}): Promise<CareerCvUploadReservation> {
  if (!validateCareerCvReservation(input)) throw new Error('Neplatná rezervácia životopisu.');
  await ensureSchema();
  const db = getPool();
  if (!db) throw new Error('Rezervácia životopisu vyžaduje trvalú databázu.');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const application = await client.query(
      'SELECT id, cv_expected, cv_storage_key FROM career_applications WHERE submission_id=$1 FOR UPDATE',
      [input.submissionId],
    );
    const row = application.rows[0];
    if (!row || row.cv_expected !== true || row.cv_storage_key) throw new Error('K žiadosti nemožno nahrať životopis.');

    const existing = await client.query('SELECT * FROM career_cv_uploads WHERE pathname=$1 FOR UPDATE', [input.pathname]);
    if (existing.rows[0]) {
      const prior = existing.rows[0];
      if (String(prior.application_id) !== String(row.id) || String(prior.submission_id) !== input.submissionId ||
          String(prior.original_name) !== input.originalName || Number(prior.expected_size) !== input.expectedSize ||
          String(prior.expected_sha256) !== input.expectedSha256 || prior.status !== 'reserved' ||
          new Date(prior.created_at).getTime() < Date.now() - 23 * 60 * 60_000) {
        throw new Error('Táto cesta životopisu už bola použitá. Vyberte súbor znova.');
      }
      await client.query('COMMIT');
      return toCareerCvUploadReservation(prior);
    }

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS count FROM career_cv_uploads
       WHERE application_id=$1 AND status IN ('reserved', 'uploaded')
         AND created_at >= now() - interval '23 hours'`,
      [row.id],
    );
    if (Number(countRows[0]?.count ?? 0) >= 3) throw new Error('Príliš veľa pokusov o nahratie životopisu.');
    const { rows } = await client.query(
      `INSERT INTO career_cv_uploads
       (pathname, application_id, submission_id, original_name, expected_size, expected_sha256)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [input.pathname, row.id, input.submissionId, input.originalName, input.expectedSize, input.expectedSha256],
    );
    await client.query('COMMIT');
    return toCareerCvUploadReservation(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getCareerCvUploadByPath(
  submissionId: string,
  pathname: string,
): Promise<CareerCvUploadReservation | null> {
  if (!isCareerCvUploadPath(submissionId, pathname)) return null;
  await ensureSchema();
  const db = getPool();
  if (!db) throw new Error('Overenie životopisu vyžaduje trvalú databázu.');
  const { rows } = await db.query(
    'SELECT * FROM career_cv_uploads WHERE submission_id=$1 AND pathname=$2 LIMIT 1',
    [submissionId, pathname],
  );
  return rows[0] ? toCareerCvUploadReservation(rows[0]) : null;
}

export async function markCareerCvUploadUploaded(
  submissionId: string,
  pathname: string,
  actualSize: number,
): Promise<boolean> {
  if (!isCareerCvUploadPath(submissionId, pathname) || !Number.isSafeInteger(actualSize)) return false;
  await ensureSchema();
  const db = getPool();
  if (!db) throw new Error('Overenie životopisu vyžaduje trvalú databázu.');
  const { rowCount } = await db.query(
    `UPDATE career_cv_uploads
     SET status=CASE WHEN status='attached' THEN 'attached' ELSE 'uploaded' END,
         uploaded_at=COALESCE(uploaded_at, now()), updated_at=now()
     WHERE submission_id=$1 AND pathname=$2 AND expected_size=$3
       AND status IN ('reserved', 'uploaded', 'attached')`,
    [submissionId, pathname, actualSize],
  );
  return rowCount === 1;
}

export async function attachCareerCvUpload(
  submissionId: string,
  pathname: string,
  verifiedCv: CareerApplicationCv,
): Promise<CareerApplication | null> {
  if (!isCareerCvUploadPath(submissionId, pathname) || verifiedCv.storageDriver !== 'vercel_blob' ||
      verifiedCv.storageKey !== pathname || !verifiedCv.sha256 ||
      !careerCvUploadContentTypes.includes(verifiedCv.mimeType as typeof careerCvUploadContentTypes[number]) ||
      !Number.isSafeInteger(verifiedCv.sizeBytes)) return null;
  await ensureSchema();
  const db = getPool();
  if (!db) throw new Error('Pripojenie životopisu vyžaduje trvalú databázu.');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const applicationResult = await client.query(
      'SELECT * FROM career_applications WHERE submission_id=$1 FOR UPDATE', [submissionId],
    );
    const application = applicationResult.rows[0];
    if (!application || application.cv_expected !== true) { await client.query('COMMIT'); return null; }
    const reservationResult = await client.query(
      'SELECT * FROM career_cv_uploads WHERE submission_id=$1 AND pathname=$2 FOR UPDATE',
      [submissionId, pathname],
    );
    const reservation = reservationResult.rows[0];
    if (!reservation || String(reservation.application_id) !== String(application.id) ||
        reservation.original_name !== verifiedCv.originalName ||
        Number(reservation.expected_size) !== verifiedCv.sizeBytes ||
        reservation.expected_sha256 !== verifiedCv.sha256) {
      await client.query('COMMIT');
      return null;
    }
    if (reservation.status === 'attached') {
      const same = application.cv_storage_key === pathname && application.cv_storage_driver === 'vercel_blob' &&
        application.cv_sha256 === verifiedCv.sha256 && Number(application.cv_size_bytes) === verifiedCv.sizeBytes;
      await client.query('COMMIT');
      return same ? toCareerApplication(application) : null;
    }
    if (!['reserved', 'uploaded'].includes(String(reservation.status)) || application.cv_storage_key) {
      await client.query('COMMIT');
      return null;
    }
    const updated = await client.query(
      `UPDATE career_applications
       SET cv_original_name=$1, cv_storage_driver='vercel_blob', cv_storage_key=$2,
           cv_mime_type=$3, cv_size_bytes=$4, cv_sha256=$5, updated_at=now()
       WHERE id=$6 AND cv_expected=true AND cv_storage_key='' RETURNING *`,
      [verifiedCv.originalName, pathname, verifiedCv.mimeType, verifiedCv.sizeBytes, verifiedCv.sha256, application.id],
    );
    if (!updated.rows[0]) throw new Error('Životopis sa nepodarilo pripojiť.');
    const marked = await client.query(
      `UPDATE career_cv_uploads SET status='attached', attached_at=now(), updated_at=now()
       WHERE submission_id=$1 AND pathname=$2 AND status IN ('reserved', 'uploaded') RETURNING pathname`,
      [submissionId, pathname],
    );
    if (!marked.rows[0]) throw new Error('Rezervácia životopisu sa zmenila počas pripojenia.');
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'career_application', $2, 'career_cv_uploaded', 'public', $3::jsonb, now())`,
      [randomUUID(), application.id, JSON.stringify({ sizeBytes: verifiedCv.sizeBytes })],
    );
    await client.query('COMMIT');
    return toCareerApplication(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export type CareerCvRetentionClaim = { pathname: string; claimId: string };

export async function claimExpiredCareerCvUploads(limit = 25): Promise<CareerCvRetentionClaim[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) throw new Error('Retencia životopisov vyžaduje trvalú databázu.');
  const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const candidates = await db.query(
    `SELECT upload.pathname, upload.application_id
     FROM career_cv_uploads AS upload
     JOIN career_applications AS application ON application.id=upload.application_id
     WHERE upload.created_at <= now() - interval '24 hours'
       AND application.cv_storage_key <> upload.pathname
        AND (upload.status IN ('reserved', 'uploaded', 'deleting') OR
            (upload.status='deletion_pending' AND
             (upload.deletion_claimed_until IS NULL OR upload.deletion_claimed_until < now())))
     ORDER BY upload.created_at, upload.pathname LIMIT $1`,
    [boundedLimit],
  );
  const claims: CareerCvRetentionClaim[] = [];
  for (const candidate of candidates.rows) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // Same lock order as attachCareerCvUpload and the legacy attach trigger:
      // application first, reservation second. No Blob operation holds a DB lock.
      const application = await client.query(
        'SELECT id, submission_id, cv_storage_key FROM career_applications WHERE id=$1 FOR UPDATE SKIP LOCKED',
        [candidate.application_id],
      );
      if (!application.rows[0]) { await client.query('ROLLBACK'); continue; }
      const reservation = await client.query(
        `SELECT pathname, application_id, submission_id, status
         FROM career_cv_uploads
         WHERE pathname=$1 AND created_at <= now() - interval '24 hours'
            AND (status IN ('reserved', 'uploaded', 'deleting') OR
                (status='deletion_pending' AND
                 (deletion_claimed_until IS NULL OR deletion_claimed_until < now())))
         FOR UPDATE SKIP LOCKED`,
        [candidate.pathname],
      );
      const row = reservation.rows[0];
      if (!row || String(row.application_id) !== String(application.rows[0].id) ||
          String(row.submission_id) !== String(application.rows[0].submission_id) ||
          !isCareerCvUploadPath(String(row.submission_id), String(row.pathname)) ||
          application.rows[0].cv_storage_key === row.pathname) {
        await client.query('ROLLBACK');
        continue;
      }
      const claimId = randomUUID();
      const updated = await client.query(
        `UPDATE career_cv_uploads
         SET status='deletion_pending', deletion_claim_id=$2,
             deletion_claimed_until=now() + interval '15 minutes',
             deletion_attempts=deletion_attempts + 1, updated_at=now()
          WHERE pathname=$1 AND status IN ('reserved', 'uploaded', 'deleting', 'deletion_pending')
         RETURNING pathname`,
        [row.pathname, claimId],
      );
      if (!updated.rows[0]) { await client.query('ROLLBACK'); continue; }
      await client.query('COMMIT');
      claims.push({ pathname: String(row.pathname), claimId });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  return claims;
}

export async function mayDeleteClaimedCareerCvUpload(pathname: string, claimId: string): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  if (!db) throw new Error('Retencia životopisov vyžaduje trvalú databázu.');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const application = await client.query(
      `SELECT application.id, application.submission_id, application.cv_storage_key
       FROM career_applications AS application
       JOIN career_cv_uploads AS upload ON upload.application_id=application.id
       WHERE upload.pathname=$1 FOR UPDATE OF application`,
      [pathname],
    );
    const reservation = await client.query(
      `SELECT submission_id, status, deletion_claim_id, deletion_claimed_until
       FROM career_cv_uploads WHERE pathname=$1 FOR UPDATE`,
      [pathname],
    );
    const app = application.rows[0];
    const row = reservation.rows[0];
    const allowed = Boolean(app && row && app.cv_storage_key !== pathname &&
      app.submission_id === row.submission_id && isCareerCvUploadPath(String(row.submission_id), pathname) &&
      row.status === 'deletion_pending' && String(row.deletion_claim_id) === claimId &&
      row.deletion_claimed_until && new Date(row.deletion_claimed_until).getTime() > Date.now());
    await client.query('COMMIT');
    return allowed;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function completeCareerCvUploadDeletion(pathname: string, claimId: string): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  if (!db) throw new Error('Retencia životopisov vyžaduje trvalú databázu.');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const application = await client.query(
      `SELECT application.id, application.submission_id, application.cv_storage_key
       FROM career_applications AS application
       JOIN career_cv_uploads AS upload ON upload.application_id=application.id
       WHERE upload.pathname=$1 FOR UPDATE OF application`,
      [pathname],
    );
    const reservation = await client.query(
      'SELECT submission_id, status, deletion_claim_id FROM career_cv_uploads WHERE pathname=$1 FOR UPDATE',
      [pathname],
    );
    const app = application.rows[0];
    const row = reservation.rows[0];
    if (!app || !row || app.cv_storage_key === pathname || app.submission_id !== row.submission_id ||
        !isCareerCvUploadPath(String(row.submission_id), pathname) ||
        row.status !== 'deletion_pending' || String(row.deletion_claim_id) !== claimId) {
      await client.query('COMMIT');
      return false;
    }
    const result = await client.query(
      `UPDATE career_cv_uploads
       SET status='deleted', deleted_at=now(), deletion_claim_id=NULL,
           deletion_claimed_until=NULL, original_name='', expected_sha256=repeat('0', 64),
           updated_at=now()
       WHERE pathname=$1 AND status='deletion_pending' AND deletion_claim_id=$2
       RETURNING pathname`,
      [pathname, claimId],
    );
    if (!result.rows[0]) throw new Error('Rezervácia životopisu sa zmenila počas mazania.');
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, 'career_application', $2, 'career_cv_orphan_deleted',
               'cron:career-cv-retention', $3::jsonb, now())`,
      [randomUUID(), app.id, JSON.stringify({ pathnameHash: createHash('sha256').update(pathname).digest('hex') })],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createCareerApplication(
  input: Omit<CareerApplication, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'ownerEmail' | 'nextAction' | 'followupDate' | 'cv'>,
): Promise<CareerApplicationCreateResult> {
  const existingWrite = careerApplicationWrites.get(input.submissionId);
  if (existingWrite) return { application: (await existingWrite).application, duplicate: true };

  const write = (async () => {
    await ensureSchema();
    const db = getPool();
    if (!db) throw new Error('Obnoviteľné doručovanie vyžaduje trvalú databázu; lokálny režim žiadosť neprijme.');

    const timestamp = now();
    const client = await db.connect();
    let application: CareerApplication;
    let created = false;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO career_applications (
        id, submission_id, created_at, updated_at, status, full_name, phone, email, city, cooperation_type,
        work_regions, has_trade_license, work_at_heights, has_asbestos_experience, asbestos_experience, experience, note, privacy_consent, cv_expected
      ) VALUES ($1,$2,$3,$4,'new',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (submission_id) DO NOTHING RETURNING *`,
        [randomUUID(), input.submissionId, timestamp, timestamp, input.fullName, input.phone, input.email, input.city, input.cooperationType,
          input.workRegions, input.hasTradeLicense, input.workAtHeights, input.hasAsbestosExperience, input.asbestosExperience,
          input.experience, input.note, input.privacyConsent, input.cvExpected],
      );
      if (rows[0]) {
        application = toCareerApplication(rows[0]);
        created = true;
        await client.query(
          `INSERT INTO application_notification_outbox (id, entity_type, entity_id, recipient_role)
           VALUES ($1, 'career_application', $2, 'applicant'), ($3, 'career_application', $2, 'internal')`,
          [randomUUID(), application.id, randomUUID()],
        );
      } else {
        const duplicate = await client.query('SELECT * FROM career_applications WHERE submission_id = $1 LIMIT 1', [input.submissionId]);
        if (!duplicate.rows[0]) throw new Error('Career application was not persisted.');
        application = toCareerApplication(duplicate.rows[0]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    if (created) await addAuditLog('career_application', application.id, 'career_application_created', 'public', { cooperationType: application.cooperationType })
      .catch((error) => console.error('Career application committed; audit entry failed', { applicationId: application.id, error }));
    return { application, duplicate: !created };
  })();

  careerApplicationWrites.set(input.submissionId, write);
  try {
    return await write;
  } finally {
    if (careerApplicationWrites.get(input.submissionId) === write) careerApplicationWrites.delete(input.submissionId);
  }
}

export async function attachCareerApplicationCv(id: string, cv: CareerApplicationCv): Promise<CareerApplication | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) throw new Error('CV nemožno pripojiť bez trvalej databázy.');
  const { rows } = await db.query(
    `UPDATE career_applications SET cv_original_name=$1, cv_storage_driver=$2, cv_storage_key=$3, cv_mime_type=$4, cv_size_bytes=$5, cv_sha256=$6, updated_at=now()
     WHERE id=$7 AND cv_storage_key = '' RETURNING *`,
    [cv.originalName, cv.storageDriver, cv.storageKey, cv.mimeType, cv.sizeBytes, cv.sha256 || '', id],
  );
  if (rows[0]) {
    await addAuditLog('career_application', id, 'career_cv_uploaded', 'public', { sizeBytes: cv.sizeBytes })
      .catch((error) => console.error('Career CV attached; audit entry failed', { applicationId: id, error }));
    return toCareerApplication(rows[0]);
  }
  const existing = await db.query('SELECT * FROM career_applications WHERE id=$1 LIMIT 1', [id]);
  return existing.rows[0] ? toCareerApplication(existing.rows[0]) : null;
}

function toApplicationNotification(row: Record<string, unknown>): ApplicationNotification {
  return {
    entityType: String(row.entity_type) as ApplicationNotificationEntity,
    entityId: String(row.entity_id),
    recipient: String(row.recipient_role) as ApplicationNotificationRecipient,
    status: String(row.status) as ApplicationNotification['status'],
    attempts: Number(row.attempts || 0),
    retryable: row.retryable === true,
    attemptedAt: row.attempted_at ? new Date(String(row.attempted_at)).toISOString() : undefined,
    sentAt: row.sent_at ? new Date(String(row.sent_at)).toISOString() : undefined,
    messageId: String(row.message_id || '') || undefined,
    lastError: String(row.last_error || '') || undefined,
  };
}

export async function listApplicationNotificationStatuses(
  entityType: ApplicationNotificationEntity,
  entityIds: string[],
): Promise<ApplicationNotification[]> {
  await ensureSchema();
  if (!entityIds.length) return [];
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query(
    `SELECT * FROM application_notification_outbox
     WHERE entity_type=$1 AND entity_id = ANY($2::uuid[])
     ORDER BY entity_id, recipient_role`,
    [entityType, entityIds],
  );
  return rows.map(toApplicationNotification);
}

export async function listDueApplicationNotifications(limit = 20): Promise<ApplicationNotification[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query(
    `SELECT notification.* FROM application_notification_outbox AS notification
     WHERE (notification.status='pending' OR (notification.status='failed' AND notification.retryable=true
       AND notification.updated_at <= now() - interval '5 minutes'))
       AND (notification.entity_type <> 'career_application' OR EXISTS (
         SELECT 1 FROM career_applications AS application
         WHERE application.id=notification.entity_id
           AND (application.cv_expected=false OR (application.cv_storage_key <> '' AND application.cv_storage_driver IN ('vercel_blob', 's3', 'local')))
       ))
     ORDER BY notification.updated_at ASC LIMIT $1`,
    [Math.max(1, Math.min(limit, 100))],
  );
  return rows.map(toApplicationNotification);
}

export async function getApplicationNotificationHealth() {
  await ensureSchema();
  const db = getPool();
  if (!db) return { pending: 0, failed: 0, unknown: 0, staleSending: 0 };
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status='pending' AND (entity_type <> 'career_application' OR EXISTS (
         SELECT 1 FROM career_applications AS application
         WHERE application.id=application_notification_outbox.entity_id
           AND (application.cv_expected=false OR (application.cv_storage_key <> '' AND application.cv_storage_driver IN ('vercel_blob', 's3', 'local')))
       )))::int AS pending,
       COUNT(*) FILTER (WHERE status='failed')::int AS failed,
       COUNT(*) FILTER (WHERE status='unknown')::int AS unknown,
       COUNT(*) FILTER (WHERE status='sending' AND claimed_at < now() - interval '10 minutes')::int AS stale_sending
     FROM application_notification_outbox`,
  );
  const row = rows[0] || {};
  return {
    pending: Number(row.pending || 0),
    failed: Number(row.failed || 0),
    unknown: Number(row.unknown || 0),
    staleSending: Number(row.stale_sending || 0),
  };
}

export async function claimCareerNotificationBatch(entityId: string): Promise<string | false> {
  await ensureSchema();
  const db = getPool();
  if (!db) return false;
  const client = await db.connect();
  const token = randomUUID();
  try {
    await client.query('BEGIN');
    const application = await client.query(
      `SELECT cv_expected, cv_storage_key, cv_storage_driver FROM career_applications WHERE id=$1 FOR UPDATE`,
      [entityId],
    );
    if (!application.rows[0] || (application.rows[0].cv_expected &&
      (!application.rows[0].cv_storage_key || !['vercel_blob', 's3', 'local'].includes(application.rows[0].cv_storage_driver)))) {
      await client.query('ROLLBACK');
      return false;
    }
    const rows = await client.query(
      `SELECT recipient_role FROM application_notification_outbox
       WHERE entity_type='career_application' AND entity_id=$1
       AND (status='pending' OR (status='failed' AND retryable=true AND updated_at <= now() - interval '5 minutes'))
       FOR UPDATE`,
      [entityId],
    );
    if (rows.rowCount !== 2 || new Set(rows.rows.map((row) => row.recipient_role)).size !== 2) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(
      `UPDATE application_notification_outbox
       SET status='sending', attempts=attempts+1, retryable=false, attempt_token=$2,
           claimed_at=now(), attempted_at=now(), updated_at=now(), last_error=''
       WHERE entity_type='career_application' AND entity_id=$1 AND recipient_role IN ('applicant','internal')`,
      [entityId, token],
    );
    await client.query('COMMIT');
    return token;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function claimApplicationNotification(
  entityType: ApplicationNotificationEntity,
  entityId: string,
  recipient: ApplicationNotificationRecipient,
): Promise<string | false> {
  await ensureSchema();
  const db = getPool();
  if (!db) return false;
  const token = randomUUID();
  const { rowCount } = await db.query(
    `UPDATE application_notification_outbox
     SET status='sending', attempts=attempts+1, retryable=false, attempt_token=$4,
         claimed_at=now(), attempted_at=now(), updated_at=now(), last_error=''
     WHERE entity_type=$1 AND entity_id=$2 AND recipient_role=$3
       AND (status='pending' OR (status='failed' AND retryable=true AND updated_at <= now() - interval '5 minutes'))`,
    [entityType, entityId, recipient, token],
  );
  return rowCount === 1 ? token : false;
}

export async function recordApplicationNotificationResult(
  entityType: ApplicationNotificationEntity,
  entityId: string,
  recipient: ApplicationNotificationRecipient,
  attemptToken: string,
  result: { status: 'sent' | 'failed' | 'unknown'; retryable?: boolean; messageId?: string; reason?: string },
): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  if (!db) return false;
  const status = result.status;
  const retryable = status === 'failed' && result.retryable === true;
  const error = (result.reason || '').slice(0, 1000);
  const { rowCount } = await db.query(
    `UPDATE application_notification_outbox
     SET status=$5, retryable=$6, attempt_token=NULL, claimed_at=NULL,
         sent_at=CASE WHEN $5='sent' THEN now() ELSE sent_at END,
         message_id=CASE WHEN $5='sent' THEN $7 ELSE message_id END,
         last_error=$8, updated_at=now()
     WHERE entity_type=$1 AND entity_id=$2 AND recipient_role=$3
       AND status='sending' AND attempt_token=$4`,
    [entityType, entityId, recipient, attemptToken, status, retryable, result.messageId || '', error],
  );
  return rowCount === 1;
}

export async function recordCareerNotificationBatchResult(
  entityId: string,
  attemptToken: string,
  results: { applicant: ApplicationRecipientResult; internal: ApplicationRecipientResult },
): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  if (!db) return false;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT recipient_role FROM application_notification_outbox
       WHERE entity_type='career_application' AND entity_id=$1
         AND status='sending' AND attempt_token=$2 FOR UPDATE`,
      [entityId, attemptToken],
    );
    if (current.rowCount !== 2 || new Set(current.rows.map((row) => row.recipient_role)).size !== 2) {
      await client.query('ROLLBACK');
      return false;
    }
    for (const recipient of ['applicant', 'internal'] as const) {
      const result = results[recipient];
      const retryable = result.status === 'failed' && result.retryable === true;
      const { rowCount } = await client.query(
        `UPDATE application_notification_outbox
         SET status=$4, retryable=$5, attempt_token=NULL, claimed_at=NULL,
             sent_at=CASE WHEN $4='sent' THEN now() ELSE sent_at END,
             message_id=CASE WHEN $4='sent' THEN $6 ELSE message_id END,
             last_error=$7, updated_at=now()
         WHERE entity_type='career_application' AND entity_id=$1 AND recipient_role=$2
           AND status='sending' AND attempt_token=$3`,
        [entityId, recipient, attemptToken, result.status, retryable, result.messageId || '', (result.reason || '').slice(0, 1000)],
      );
      if (rowCount !== 1) throw new Error('Kariérny emailový pár sa počas zápisu zmenil.');
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function markStaleApplicationNotificationClaimsUnknown(): Promise<number> {
  await ensureSchema();
  const db = getPool();
  if (!db) return 0;
  const { rowCount } = await db.query(
    `UPDATE application_notification_outbox
     SET status='unknown', retryable=false, attempt_token=NULL, claimed_at=NULL,
         last_error='Proces bol prerušený počas odosielania; výsledok nie je možné bezpečne potvrdiť.', updated_at=now()
     WHERE status='sending' AND claimed_at < now() - interval '10 minutes'`,
  );
  return rowCount || 0;
}

export async function resolveUnknownApplicationNotification(input: {
  entityType: ApplicationNotificationEntity;
  entityId: string;
  recipient: ApplicationNotificationRecipient;
  resolution: 'delivered' | 'not_delivered';
  evidence: string;
  actorEmail: string;
}): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  if (!db || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.entityId)) return false;
  if (!isApplicationNotificationEvidenceValid(input.resolution, input.evidence) || !input.actorEmail.trim()) return false;
  const evidence = input.evidence;
  const status = input.resolution === 'delivered' ? 'confirmed_delivered' : 'confirmed_not_delivered';
  const action = input.resolution === 'delivered'
    ? 'application_notification_delivery_confirmed'
    : 'application_notification_non_delivery_confirmed';
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE application_notification_outbox
       SET status=$4, retryable=false, attempt_token=NULL, claimed_at=NULL,
           sent_at=CASE WHEN $4='confirmed_delivered' THEN COALESCE(sent_at, now()) ELSE NULL END,
           last_error='', updated_at=now()
       WHERE entity_type=$1 AND entity_id=$2 AND recipient_role=$3
         AND (status='unknown' OR ($5='not_delivered' AND status='failed' AND retryable=false))
       RETURNING id`,
      [input.entityType, input.entityId, input.recipient, status, input.resolution],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
      [randomUUID(), input.entityType, input.entityId, action, input.actorEmail, JSON.stringify({
        recipient: input.recipient,
        resolution: input.resolution,
        evidence,
      })],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function prepareConfirmedApplicationNotificationRetry(input: {
  entityType: ApplicationNotificationEntity;
  entityId: string;
  recipient: ApplicationNotificationRecipient;
  actorEmail: string;
}): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  if (!db || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.entityId)) return false;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let recipients: ApplicationNotificationRecipient[] = [];
    if (input.entityType === 'career_application') {
      const selected = await client.query(
        `SELECT recipient_role, status FROM application_notification_outbox
         WHERE entity_type='career_application' AND entity_id=$1
         ORDER BY recipient_role FOR UPDATE`,
        [input.entityId],
      );
      if (selected.rowCount !== 2 || selected.rows.some((row) => row.status !== 'confirmed_not_delivered')
        || new Set(selected.rows.map((row) => row.recipient_role)).size !== 2) {
        await client.query('ROLLBACK');
        return false;
      }
      recipients = ['applicant', 'internal'];
      await client.query(
        `UPDATE application_notification_outbox
         SET status='pending', retryable=false, attempt_token=NULL, claimed_at=NULL,
             sent_at=NULL, message_id='', last_error='', updated_at=now()
         WHERE entity_type='career_application' AND entity_id=$1 AND status='confirmed_not_delivered'`,
        [input.entityId],
      );
    } else {
      const { rowCount } = await client.query(
        `UPDATE application_notification_outbox
         SET status='pending', retryable=false, attempt_token=NULL, claimed_at=NULL,
             sent_at=NULL, message_id='', last_error='', updated_at=now()
         WHERE entity_type='roofer_registration' AND entity_id=$1 AND recipient_role=$2 AND status='confirmed_not_delivered'`,
        [input.entityId, input.recipient],
      );
      if (rowCount !== 1) {
        await client.query('ROLLBACK');
        return false;
      }
      recipients = [input.recipient];
    }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1, $2, $3, 'application_notification_retry_queued', $4, $5::jsonb, now())`,
      [randomUUID(), input.entityType, input.entityId, input.actorEmail, JSON.stringify({
        recipients,
        requiresPriorConfirmedNonDelivery: true,
        careerRelayPair: input.entityType === 'career_application',
      })],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function getApplicationNotificationEntity(entityType: 'career_application', entityId: string): Promise<CareerApplication | null>;
export function getApplicationNotificationEntity(entityType: 'roofer_registration', entityId: string): Promise<RooferRegistration | null>;
export async function getApplicationNotificationEntity(
  entityType: ApplicationNotificationEntity,
  entityId: string,
): Promise<CareerApplication | RooferRegistration | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) return null;
  if (entityType === 'career_application') {
    const { rows } = await db.query('SELECT * FROM career_applications WHERE id=$1 LIMIT 1', [entityId]);
    return rows[0] ? toCareerApplication(rows[0]) : null;
  }
  const { rows } = await db.query('SELECT * FROM roofer_registrations WHERE id=$1 LIMIT 1', [entityId]);
  return rows[0] ? toRooferRegistration(rows[0]) : null;
}

export async function listMatchingRoofers(lead: Pick<Lead, 'city' | 'district'>, limit = 5) {
  const district = lead.district?.trim() || '';
  const city = lead.city?.trim() || '';
  const all = await listReferralEligibleRoofers();
  return all
    .filter((roofer) => !district || roofer.districts.includes(district) || roofer.districts.includes(city))
    .slice(0, limit);
}

export async function getRoofer(id: string): Promise<Roofer | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const roofer = local.roofers.find((item) => item.id === id);
    return roofer ? toRoofer(roofer as unknown as Record<string, unknown>) : null;
  }
  const { rows } = await db.query('SELECT * FROM roofers WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ? toRoofer(rows[0]) : null;
}

export async function getReferralEligibleRoofer(id: string): Promise<Roofer | null> {
  const roofer = await getRoofer(id);
  return roofer && isRooferReferralEligible(roofer) ? roofer : null;
}

function rooferFlagsAuditSnapshot(input: Pick<
  Roofer,
  'active' | 'verifiedPartner' | 'inVerification' | 'preferredPartner' | 'customerReferralApproved' | 'customerReferralEvidence' | 'customerReferralApprovedAt' | 'customerReferralApprovedBy'
>) {
  return {
    active: input.active,
    verifiedPartner: input.verifiedPartner,
    inVerification: input.inVerification,
    preferredPartner: input.preferredPartner,
    customerReferralApproved: input.customerReferralApproved,
    customerReferralEvidenceRecorded: Boolean(input.customerReferralEvidence?.trim()),
    customerReferralApprovedAt: input.customerReferralApprovedAt ?? null,
    customerReferralApprovedBy: input.customerReferralApprovedBy ?? '',
  };
}

export async function createRoofer(input: RooferInput, actorEmail: string): Promise<Roofer> {
  await ensureSchema();
  const timestamp = now();
  const referralApproval = resolveRooferReferralApproval(
    Boolean(input.customerReferralApproved),
    input.customerReferralEvidence,
    actorEmail,
    timestamp,
  );
  const roofer: Roofer = {
    id: randomUUID(),
    name: input.name.trim(),
    ico: input.ico?.trim() ?? '',
    contactPerson: input.contactPerson?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    email: input.email?.trim() ?? '',
    web: input.web?.trim() ?? '',
    region: input.region.trim(),
    districts: input.districts.map((item) => item.trim()).filter(Boolean),
    specialization: input.specialization?.trim() ?? '',
    publicNote: input.publicNote?.trim() ?? '',
    internalNote: input.internalNote?.trim() ?? '',
    active: input.active ?? true,
    verifiedPartner: Boolean(input.verifiedPartner),
    inVerification: Boolean(input.inVerification ?? !input.verifiedPartner),
    preferredPartner: Boolean(input.preferredPartner),
    ...referralApproval,
    rating: Math.min(5, Math.max(0, Number(input.rating ?? 0))),
    reviewCount: Math.max(0, Math.round(Number(input.reviewCount ?? 0))),
    complaintsCount: Math.max(0, Math.round(Number(input.complaintsCount ?? 0))),
    cardViewCount: 0,
    contactRevealCount: 0,
    quoteUseClickCount: 0,
    referralCount: 0,
    recommendedJobsCount: 0,
    confirmedJobsCount: 0,
    failedJobsCount: 0,
    internalScore: Math.min(100, Math.max(0, Number(input.internalScore ?? 0))),
    totalM2: 0,
    revenueWithoutVat: 0,
    profit: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.roofers.unshift(roofer);
    await writeLocalDb(local);
    await addAuditLog('roofer', roofer.id, 'roofer_created', actorEmail, rooferFlagsAuditSnapshot(roofer));
    return roofer;
  }

  await db.query(
    `INSERT INTO roofers (
      id, created_at, updated_at, name, ico, contact_person, phone, email, web, region, districts,
      specialization, public_note, internal_note, active, verified_partner, in_verification, preferred_partner,
      customer_referral_approved, customer_referral_evidence, customer_referral_approved_at, customer_referral_approved_by, rating,
      review_count, complaints_count, card_view_count, contact_reveal_count, quote_use_click_count,
      referral_count, recommended_jobs_count, confirmed_jobs_count, failed_jobs_count, internal_score,
      total_m2, revenue_without_vat, profit
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)`,
    [
      roofer.id,
      roofer.createdAt,
      roofer.updatedAt,
      roofer.name,
      roofer.ico,
      roofer.contactPerson,
      roofer.phone,
      roofer.email,
      roofer.web,
      roofer.region,
      JSON.stringify(roofer.districts),
      roofer.specialization,
      roofer.publicNote,
      roofer.internalNote,
      roofer.active,
      roofer.verifiedPartner,
      roofer.inVerification,
      roofer.preferredPartner,
      roofer.customerReferralApproved,
      roofer.customerReferralEvidence,
      roofer.customerReferralApprovedAt ?? null,
      roofer.customerReferralApprovedBy,
      roofer.rating,
      roofer.reviewCount,
      roofer.complaintsCount,
      roofer.cardViewCount,
      roofer.contactRevealCount,
      roofer.quoteUseClickCount,
      roofer.referralCount,
      roofer.recommendedJobsCount,
      roofer.confirmedJobsCount,
      roofer.failedJobsCount,
      roofer.internalScore,
      roofer.totalM2,
      roofer.revenueWithoutVat,
      roofer.profit,
    ],
  );
  await addAuditLog('roofer', roofer.id, 'roofer_created', actorEmail, rooferFlagsAuditSnapshot(roofer));
  return roofer;
}

export async function updateRooferFlags(
  id: string,
  input: Pick<RooferInput, 'active' | 'verifiedPartner' | 'inVerification' | 'preferredPartner' | 'customerReferralApproved' | 'customerReferralEvidence'>,
  actorEmail: string,
): Promise<Roofer | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const roofer = local.roofers.find((item) => item.id === id);
    if (!roofer) return null;
    const current = toRoofer(roofer as unknown as Record<string, unknown>);
    const previous = rooferFlagsAuditSnapshot(current);
    const referralApproval = resolveRooferReferralApprovalUpdate(
      {
        customerReferralApproved: current.customerReferralApproved,
        customerReferralEvidence: current.customerReferralEvidence ?? '',
        customerReferralApprovedAt: current.customerReferralApprovedAt,
        customerReferralApprovedBy: current.customerReferralApprovedBy ?? '',
      },
      Boolean(input.customerReferralApproved),
      input.customerReferralEvidence,
      actorEmail,
    );
    roofer.active = Boolean(input.active);
    roofer.verifiedPartner = Boolean(input.verifiedPartner);
    roofer.inVerification = Boolean(input.inVerification);
    roofer.preferredPartner = Boolean(input.preferredPartner);
    Object.assign(roofer, referralApproval);
    roofer.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('roofer', id, 'roofer_flags_changed', actorEmail, { previous, next: rooferFlagsAuditSnapshot(roofer) });
    return roofer;
  }
  const previous = await getRoofer(id);
  if (!previous) return null;
  const referralApproval = resolveRooferReferralApproval(
    Boolean(input.customerReferralApproved),
    input.customerReferralEvidence,
    actorEmail,
  );
  const { rows } = await db.query(
    `UPDATE roofers
     SET active = $1, verified_partner = $2, in_verification = $3, preferred_partner = $4,
         customer_referral_approved = $5, customer_referral_evidence = $6,
         customer_referral_approved_at = CASE
           WHEN $5 = true AND customer_referral_approved = true AND btrim(customer_referral_evidence) = btrim($6)
             THEN customer_referral_approved_at
           ELSE $7
         END,
         customer_referral_approved_by = CASE
           WHEN $5 = true AND customer_referral_approved = true AND btrim(customer_referral_evidence) = btrim($6)
             THEN customer_referral_approved_by
           ELSE $8
         END,
         updated_at = now()
     WHERE id = $9
     RETURNING *`,
    [
      Boolean(input.active),
      Boolean(input.verifiedPartner),
      Boolean(input.inVerification),
      Boolean(input.preferredPartner),
      referralApproval.customerReferralApproved,
      referralApproval.customerReferralEvidence,
      referralApproval.customerReferralApprovedAt ?? null,
      referralApproval.customerReferralApprovedBy,
      id,
    ],
  );
  if (!rows[0]) return null;
  const updated = toRoofer(rows[0]);
  await addAuditLog('roofer', id, 'roofer_flags_changed', actorEmail, {
    previous: rooferFlagsAuditSnapshot(previous),
    next: rooferFlagsAuditSnapshot(updated),
  });
  return updated;
}

export type RooferEventType = 'card_viewed' | 'contact_revealed' | 'quote_selected';

export async function recordRooferEvent(
  rooferId: string,
  eventType: RooferEventType,
  context: { region?: string; page?: string; referrer?: string } = {},
) {
  await ensureSchema();
  const db = getPool();
  const changes = {
    eventType,
    region: context.region?.slice(0, 120) ?? '',
    page: context.page?.slice(0, 300) ?? '',
    referrer: context.referrer?.slice(0, 300) ?? '',
  };

  if (!db) {
    const local = await readLocalDb();
    const roofer = local.roofers.find((item) => item.id === rooferId);
    if (!roofer) return null;
    if (eventType === 'card_viewed') roofer.cardViewCount = (roofer.cardViewCount ?? 0) + 1;
    if (eventType === 'contact_revealed') roofer.contactRevealCount = (roofer.contactRevealCount ?? 0) + 1;
    if (eventType === 'quote_selected') roofer.quoteUseClickCount = (roofer.quoteUseClickCount ?? 0) + 1;
    roofer.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('roofer', rooferId, `roofer_${eventType}`, 'public', changes);
    return toRoofer(roofer as unknown as Record<string, unknown>);
  }

  const column =
    eventType === 'card_viewed'
      ? 'card_view_count'
      : eventType === 'contact_revealed'
        ? 'contact_reveal_count'
        : 'quote_use_click_count';

  const { rows } = await db.query(
    `UPDATE roofers
      SET ${column} = ${column} + 1, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [rooferId],
  );
  if (!rows[0]) return null;

  await db.query(
    `INSERT INTO roofer_events (id, roofer_id, event_type, region, page, referrer, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [randomUUID(), rooferId, eventType, changes.region, changes.page, changes.referrer, now()],
  );
  await addAuditLog('roofer', rooferId, `roofer_${eventType}`, 'public', changes);
  return toRoofer(rows[0]);
}

export async function listSiteContent(): Promise<SiteContentItem[]> {
  const phase = process.env.NEXT_PHASE;
  if (shouldUseDefaultSiteContent(phase, Boolean(databaseUrl))) return [];
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.siteContent].sort((a, b) => a.key.localeCompare(b.key));
  }
  try {
    const { rows } = await db.query('SELECT * FROM site_content ORDER BY key ASC');
    return rows.map(toSiteContent);
  } catch (error) {
    if (shouldFallbackToDefaultSiteContent(error, phase)) return [];
    throw error;
  }
}

export async function getSiteContentMap(defaults: Record<string, string> = {}) {
  const items = await listSiteContent();
  return mergeSiteContent(defaults, items);
}

export async function upsertSiteContentValues(values: Record<string, string>, actorEmail: string) {
  await ensureSchema();
  const entries = Object.entries(values)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key]) => key.length > 0);
  if (!entries.length) return [];

  const timestamp = now();
  const db = getPool();
  if (!db) {
    await withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      for (const [key, value] of entries) {
        const existing = local.siteContent.find((item) => item.key === key);
        if (existing) {
          existing.value = value;
          existing.updatedAt = timestamp;
          existing.updatedBy = actorEmail;
        } else {
          local.siteContent.push({ key, value, updatedAt: timestamp, updatedBy: actorEmail });
        }
      }
      await writeLocalDb(local);
    });
    await addAuditLog('site_content', siteContentAuditId, 'site_content_updated', actorEmail, { keys: entries.map(([key]) => key) });
    return entries.map(([key]) => key);
  }

  for (const [key, value] of entries) {
    await db.query(
      `INSERT INTO site_content (key, value, updated_at, updated_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
      [key, value, timestamp, actorEmail],
    );
  }
  await addAuditLog('site_content', siteContentAuditId, 'site_content_updated', actorEmail, { keys: entries.map(([key]) => key) });
  return entries.map(([key]) => key);
}

export async function getAdminSetting(key: string) {
  await ensureSchema();
  const normalizedKey = key.trim();
  if (!normalizedKey) return null;

  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.adminSettings[normalizedKey] ?? null;
  }

  const { rows } = await db.query('SELECT value FROM admin_settings WHERE key = $1 LIMIT 1', [normalizedKey]);
  return rows[0]?.value ? String(rows[0].value) : null;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await ensureLocalBusinessDefaults();
    return [...local.adminUsers].map((user) => toAdminUser(user as unknown as Record<string, unknown>)).sort((a, b) => a.email.localeCompare(b.email));
  }
  const { rows } = await db.query('SELECT * FROM admin_users ORDER BY email ASC');
  return rows.map(toAdminUser);
}

export async function getAdminUserByEmail(email: string): Promise<AdminUser | null> {
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const db = getPool();
  if (!db) {
    const local = await ensureLocalBusinessDefaults();
    const user = local.adminUsers.find((item) => item.email.toLowerCase() === normalized);
    return user ? toAdminUser(user as unknown as Record<string, unknown>) : null;
  }
  const { rows } = await db.query('SELECT * FROM admin_users WHERE lower(email) = lower($1) LIMIT 1', [normalized]);
  return rows[0] ? toAdminUser(rows[0]) : null;
}

export async function changeAdminUserPassword(
  email: string,
  passwordHash: string,
  expectedSessionEpoch: number,
  actorEmail: string,
): Promise<AdminUser | null> {
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  if (!normalized || !passwordHash || !Number.isSafeInteger(expectedSessionEpoch) || expectedSessionEpoch < 0) return null;
  const timestamp = now();
  const auditId = randomUUID();
  const db = getPool();

  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const user = local.adminUsers.find((item) => item.email.toLowerCase() === normalized);
      if (!user || !user.active || normalizeAdminSessionEpoch(user.sessionEpoch) !== expectedSessionEpoch) return null;
      user.passwordHash = passwordHash;
      user.sessionEpoch = expectedSessionEpoch + 1;
      user.updatedAt = timestamp;
      local.auditLogs.unshift({
        id: auditId,
        entityType: 'admin_user',
        entityId: user.id,
        action: 'admin_user_password_changed',
        actorEmail,
        changes: { sessionsRevoked: true },
        createdAt: timestamp,
      });
      await writeLocalDb(local, { writeAdminUsers: true });
      return toAdminUser(user as unknown as Record<string, unknown>);
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE admin_users
       SET password_hash = $1, session_epoch = session_epoch + 1, updated_at = $2
       WHERE lower(email) = lower($3) AND active = true AND session_epoch = $4
       RETURNING *`,
      [passwordHash, timestamp, normalized, expectedSessionEpoch],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [auditId, 'admin_user', rows[0].id, 'admin_user_password_changed', actorEmail, { sessionsRevoked: true }, timestamp],
    );
    await client.query('COMMIT');
    return toAdminUser(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertAdminUser(input: AdminUserInput, actorEmail: string): Promise<AdminUser> {
  await ensureSchema();
  const timestamp = now();
  const user: AdminUser = {
    id: input.id || randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name?.trim() ?? '',
    role: input.role,
    active: input.active ?? true,
    passwordHash: input.passwordHash ?? '',
    twoFactorSecret: input.twoFactorSecret ?? '',
    twoFactorEnabled: input.twoFactorEnabled ?? false,
    twoFactorLastUsedStep: -1,
    twoFactorBackupCodeHashes: input.twoFactorBackupCodeHashes ?? [],
    sessionEpoch: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const existingIndex = local.adminUsers.findIndex((item) => item.id === user.id || item.email.toLowerCase() === user.email);
      if (existingIndex >= 0) {
        const existing = local.adminUsers[existingIndex];
        local.adminUsers[existingIndex] = {
          ...existing,
          email: user.email,
          name: user.name,
          role: user.role,
          active: user.active,
          passwordHash: user.passwordHash || existing.passwordHash,
          twoFactorSecret: user.twoFactorSecret || existing.twoFactorSecret,
          twoFactorEnabled: input.twoFactorEnabled ?? existing.twoFactorEnabled,
          twoFactorLastUsedStep: user.twoFactorSecret && user.twoFactorSecret !== existing.twoFactorSecret ? -1 : (existing.twoFactorLastUsedStep ?? -1),
          twoFactorBackupCodeHashes: input.twoFactorBackupCodeHashes ?? existing.twoFactorBackupCodeHashes ?? [],
          updatedAt: timestamp,
        };
        local.auditLogs.unshift({
          id: randomUUID(), entityType: 'admin_user', entityId: local.adminUsers[existingIndex].id,
          action: 'admin_user_updated', actorEmail,
          changes: { email: user.email, role: user.role }, createdAt: timestamp,
        });
        await writeLocalDb(local, { writeAdminUsers: true });
        return local.adminUsers[existingIndex];
      }
      local.adminUsers.push(user);
      local.auditLogs.unshift({
        id: randomUUID(), entityType: 'admin_user', entityId: user.id,
        action: 'admin_user_created', actorEmail,
        changes: { email: user.email, role: user.role }, createdAt: timestamp,
      });
      await writeLocalDb(local, { writeAdminUsers: true });
      return user;
    });
  }
  const { rows } = await db.query(
    `INSERT INTO admin_users (id, email, name, role, active, password_hash, two_factor_secret, two_factor_enabled, two_factor_backup_code_hashes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$10)
     ON CONFLICT (email)
     DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       active = EXCLUDED.active,
       password_hash = CASE WHEN EXCLUDED.password_hash = '' THEN admin_users.password_hash ELSE EXCLUDED.password_hash END,
       two_factor_secret = CASE WHEN EXCLUDED.two_factor_secret = '' THEN admin_users.two_factor_secret ELSE EXCLUDED.two_factor_secret END,
       two_factor_enabled = EXCLUDED.two_factor_enabled,
       two_factor_last_used_step = CASE WHEN EXCLUDED.two_factor_secret <> '' AND EXCLUDED.two_factor_secret IS DISTINCT FROM admin_users.two_factor_secret THEN -1 ELSE admin_users.two_factor_last_used_step END,
       two_factor_backup_code_hashes = EXCLUDED.two_factor_backup_code_hashes,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      user.id,
      user.email,
      user.name,
      user.role,
      user.active,
      user.passwordHash,
      user.twoFactorSecret || '',
      user.twoFactorEnabled,
      JSON.stringify(user.twoFactorBackupCodeHashes),
      timestamp,
    ],
  );
  const saved = toAdminUser(rows[0]);
  await addAuditLog('admin_user', saved.id, 'admin_user_upserted', actorEmail, { email: saved.email, role: saved.role, active: saved.active });
  return saved;
}

export type ManagedAdminUserInput = {
  id?: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  passwordHash?: string;
  expectedSessionEpoch?: number;
};

export type AdminUserManagementErrorCode =
  | 'ACTOR_REVOKED'
  | 'CONFLICT'
  | 'DUPLICATE_EMAIL'
  | 'LAST_SUPER_ADMIN'
  | 'MISSING_PASSWORD'
  | 'SELF_ACCESS_CHANGE'
  | 'USER_NOT_FOUND';

export class AdminUserManagementError extends Error {
  readonly code: AdminUserManagementErrorCode;

  constructor(code: AdminUserManagementErrorCode) {
    super(code);
    this.name = 'AdminUserManagementError';
    this.code = code;
  }
}

export type ManagedAdminActor = {
  email: string;
  sessionEpoch: number;
};

function assertManagedAdminActor(user: AdminUser | null | undefined, actor: ManagedAdminActor) {
  if (!user
    || !user.active
    || user.role !== 'SUPER_ADMIN'
    || normalizeAdminSessionEpoch(user.sessionEpoch) !== actor.sessionEpoch) {
    throw new AdminUserManagementError('ACTOR_REVOKED');
  }
}

function managedAdminSecurityChanged(existing: AdminUser, input: ManagedAdminUserInput) {
  return existing.email !== input.email
    || existing.role !== input.role
    || existing.active !== input.active
    || Boolean(input.passwordHash);
}

function assertManagedAdminChange(
  existing: AdminUser,
  input: ManagedAdminUserInput,
  actorEmail: string,
  activeSuperAdminsExcludingTarget: number,
) {
  if (existing.email === actorEmail.trim().toLowerCase()
    && (input.role !== 'SUPER_ADMIN' || !input.active)) {
    throw new AdminUserManagementError('SELF_ACCESS_CHANGE');
  }
  if (existing.role === 'SUPER_ADMIN'
    && existing.active
    && (input.role !== 'SUPER_ADMIN' || !input.active)
    && activeSuperAdminsExcludingTarget === 0) {
    throw new AdminUserManagementError('LAST_SUPER_ADMIN');
  }
  if (input.active && !(input.passwordHash || existing.passwordHash)) {
    throw new AdminUserManagementError('MISSING_PASSWORD');
  }
}

export async function saveManagedAdminUser(input: ManagedAdminUserInput, actor: ManagedAdminActor): Promise<AdminUser> {
  await ensureSchema();
  if (input.id && input.expectedSessionEpoch === undefined) throw new AdminUserManagementError('CONFLICT');
  const timestamp = now();
  const normalizedInput: ManagedAdminUserInput = {
    ...input,
    id: input.id?.trim() || undefined,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
  };
  const normalizedActor: ManagedAdminActor = {
    email: actor.email.trim().toLowerCase(),
    sessionEpoch: actor.sessionEpoch,
  };
  if (!normalizedActor.email || !Number.isSafeInteger(normalizedActor.sessionEpoch) || normalizedActor.sessionEpoch < 0) {
    throw new AdminUserManagementError('ACTOR_REVOKED');
  }
  const db = getPool();

  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const actorUser = local.adminUsers.find((item) => item.email.toLowerCase() === normalizedActor.email);
      assertManagedAdminActor(actorUser ? toAdminUser(actorUser as unknown as Record<string, unknown>) : null, normalizedActor);
      const duplicate = local.adminUsers.find((item) => item.email.toLowerCase() === normalizedInput.email && item.id !== normalizedInput.id);
      if (duplicate) throw new AdminUserManagementError('DUPLICATE_EMAIL');

      if (!normalizedInput.id) {
        if (normalizedInput.active && !normalizedInput.passwordHash) throw new AdminUserManagementError('MISSING_PASSWORD');
        const created: AdminUser = {
          id: randomUUID(),
          email: normalizedInput.email,
          name: normalizedInput.name,
          role: normalizedInput.role,
          active: normalizedInput.active,
          passwordHash: normalizedInput.passwordHash || '',
          twoFactorSecret: '',
          twoFactorEnabled: false,
          twoFactorLastUsedStep: -1,
          twoFactorBackupCodeHashes: [],
          sessionEpoch: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        local.adminUsers.push(created);
        local.auditLogs.unshift({
          id: randomUUID(), entityType: 'admin_user', entityId: created.id,
          action: 'admin_user_created', actorEmail: normalizedActor.email,
          changes: { email: created.email, role: created.role, active: created.active }, createdAt: timestamp,
        });
        await writeLocalDb(local, { writeAdminUsers: true });
        return created;
      }

      const existingIndex = local.adminUsers.findIndex((item) => item.id === normalizedInput.id);
      if (existingIndex < 0) throw new AdminUserManagementError('USER_NOT_FOUND');
      const existing = toAdminUser(local.adminUsers[existingIndex] as unknown as Record<string, unknown>);
      if (normalizedInput.expectedSessionEpoch !== undefined && existing.sessionEpoch !== normalizedInput.expectedSessionEpoch) {
        throw new AdminUserManagementError('CONFLICT');
      }
      const activeSuperAdminsExcludingTarget = local.adminUsers.filter((item) => item.id !== existing.id && item.active && item.role === 'SUPER_ADMIN').length;
      assertManagedAdminChange(existing, normalizedInput, normalizedActor.email, activeSuperAdminsExcludingTarget);
      const securityChanged = managedAdminSecurityChanged(existing, normalizedInput);
      const saved: AdminUser = {
        ...existing,
        email: normalizedInput.email,
        name: normalizedInput.name,
        role: normalizedInput.role,
        active: normalizedInput.active,
        passwordHash: normalizedInput.passwordHash || existing.passwordHash,
        sessionEpoch: existing.sessionEpoch + (securityChanged ? 1 : 0),
        updatedAt: timestamp,
      };
      local.adminUsers[existingIndex] = saved;
      local.auditLogs.unshift({
        id: randomUUID(), entityType: 'admin_user', entityId: saved.id,
        action: 'admin_user_updated', actorEmail: normalizedActor.email,
        changes: {
          previousEmail: existing.email, email: saved.email,
          previousRole: existing.role, role: saved.role,
          previousActive: existing.active, active: saved.active,
          passwordChanged: Boolean(normalizedInput.passwordHash), sessionsRevoked: securityChanged,
        }, createdAt: timestamp,
      });
      await writeLocalDb(local, { writeAdminUsers: true });
      return saved;
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('astana:admin-user-management', 0))");
    const actorResult = await client.query('SELECT * FROM admin_users WHERE lower(email) = lower($1) FOR UPDATE', [normalizedActor.email]);
    assertManagedAdminActor(actorResult.rows[0] ? toAdminUser(actorResult.rows[0]) : null, normalizedActor);
    if (!normalizedInput.id) {
      if (normalizedInput.active && !normalizedInput.passwordHash) throw new AdminUserManagementError('MISSING_PASSWORD');
      const { rows } = await client.query(
        `INSERT INTO admin_users (id, email, name, role, active, password_hash, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
         RETURNING *`,
        [randomUUID(), normalizedInput.email, normalizedInput.name, normalizedInput.role, normalizedInput.active, normalizedInput.passwordHash || '', timestamp],
      );
      const created = toAdminUser(rows[0]);
      await client.query(
        'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), 'admin_user', created.id, 'admin_user_created', normalizedActor.email, { email: created.email, role: created.role, active: created.active }, timestamp],
      );
      await client.query('COMMIT');
      return created;
    }

    const currentResult = await client.query('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE', [normalizedInput.id]);
    if (!currentResult.rows[0]) throw new AdminUserManagementError('USER_NOT_FOUND');
    const existing = toAdminUser(currentResult.rows[0]);
    if (normalizedInput.expectedSessionEpoch !== undefined && existing.sessionEpoch !== normalizedInput.expectedSessionEpoch) {
      throw new AdminUserManagementError('CONFLICT');
    }
    const superAdmins = await client.query("SELECT id, active FROM admin_users WHERE role = 'SUPER_ADMIN' FOR UPDATE");
    const activeSuperAdminsExcludingTarget = superAdmins.rows.filter((row) => row.id !== existing.id && row.active).length;
    assertManagedAdminChange(existing, normalizedInput, normalizedActor.email, activeSuperAdminsExcludingTarget);
    const securityChanged = managedAdminSecurityChanged(existing, normalizedInput);
    const { rows } = await client.query(
      `UPDATE admin_users
       SET email = $1, name = $2, role = $3, active = $4,
           password_hash = CASE WHEN $5 = '' THEN password_hash ELSE $5 END,
           session_epoch = session_epoch + $6, updated_at = $7
       WHERE id = $8
       RETURNING *`,
      [normalizedInput.email, normalizedInput.name, normalizedInput.role, normalizedInput.active,
        normalizedInput.passwordHash || '', securityChanged ? 1 : 0, timestamp, existing.id],
    );
    const saved = toAdminUser(rows[0]);
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'admin_user', saved.id, 'admin_user_updated', normalizedActor.email, {
        previousEmail: existing.email, email: saved.email,
        previousRole: existing.role, role: saved.role,
        previousActive: existing.active, active: saved.active,
        passwordChanged: Boolean(normalizedInput.passwordHash), sessionsRevoked: securityChanged,
      }, timestamp],
    );
    await client.query('COMMIT');
    return saved;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      throw new AdminUserManagementError('DUPLICATE_EMAIL');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function setAdminUserActive(id: string, active: boolean, actorEmail: string) {
  const users = await listAdminUsers();
  const user = users.find((item) => item.id === id);
  const actor = users.find((item) => item.email.toLowerCase() === actorEmail.trim().toLowerCase());
  if (!user) return null;
  if (!actor) throw new AdminUserManagementError('ACTOR_REVOKED');
  return saveManagedAdminUser({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active,
    expectedSessionEpoch: user.sessionEpoch,
  }, { email: actor.email, sessionEpoch: actor.sessionEpoch });
}

export async function setAdminUserTwoFactorSecret(email: string, secret: string, actorEmail: string, expectedSessionEpoch: number) {
  if (!Number.isSafeInteger(expectedSessionEpoch) || expectedSessionEpoch < 0 || !secret) return null;
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const user = local.adminUsers.find((item) => item.email.toLowerCase() === normalized);
      if (!user || !user.active || normalizeAdminSessionEpoch(user.sessionEpoch) !== expectedSessionEpoch
        || user.twoFactorEnabled || user.twoFactorSecret) return null;
      user.twoFactorSecret = secret;
      user.twoFactorEnabled = false;
      user.twoFactorLastUsedStep = -1;
      user.twoFactorBackupCodeHashes = [];
      user.updatedAt = now();
      local.auditLogs.unshift({
        id: randomUUID(), entityType: 'admin_user', entityId: user.id,
        action: 'admin_user_2fa_secret_created', actorEmail,
        changes: { email: user.email }, createdAt: user.updatedAt,
      });
      await writeLocalDb(local, { writeAdminUsers: true });
      return user;
    });
  }
  const { rows } = await db.query(
    `UPDATE admin_users
     SET two_factor_secret = $1, two_factor_enabled = false, two_factor_last_used_step = -1, two_factor_backup_code_hashes = '[]'::jsonb, updated_at = now()
     WHERE lower(email) = lower($2) AND active = true AND session_epoch = $3
       AND two_factor_enabled = false AND two_factor_secret = ''
     RETURNING *`,
    [secret, normalized, expectedSessionEpoch],
  );
  if (!rows[0]) return null;
  const user = toAdminUser(rows[0]);
  await addAuditLog('admin_user', user.id, 'admin_user_2fa_secret_created', actorEmail, { email: user.email });
  return user;
}

export async function enableAdminUserTwoFactor(email: string, backupCodeHashes: string[], firstTimeStep: number, expectedSecret: string, actorEmail: string, expectedSessionEpoch: number) {
  if (!Number.isSafeInteger(expectedSessionEpoch) || expectedSessionEpoch < 0
    || !Number.isSafeInteger(firstTimeStep) || firstTimeStep < 0 || !expectedSecret) return null;
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const user = local.adminUsers.find((item) => item.email.toLowerCase() === normalized);
      if (!user || !user.active || normalizeAdminSessionEpoch(user.sessionEpoch) !== expectedSessionEpoch
        || user.twoFactorSecret !== expectedSecret || user.twoFactorEnabled
        || firstTimeStep <= (user.twoFactorLastUsedStep ?? -1)) return null;
      user.twoFactorEnabled = true;
      user.twoFactorLastUsedStep = firstTimeStep;
      user.twoFactorBackupCodeHashes = backupCodeHashes;
      user.sessionEpoch = normalizeAdminSessionEpoch(user.sessionEpoch) + 1;
      user.updatedAt = now();
      local.auditLogs.unshift({
        id: randomUUID(), entityType: 'admin_user', entityId: user.id,
        action: 'admin_user_2fa_enabled', actorEmail,
        changes: { email: user.email }, createdAt: user.updatedAt,
      });
      await writeLocalDb(local, { writeAdminUsers: true });
      return user;
    });
  }
  const { rows } = await db.query(
    `UPDATE admin_users
     SET two_factor_enabled = true, two_factor_last_used_step = $3, two_factor_backup_code_hashes = $1::jsonb,
         session_epoch = session_epoch + 1, updated_at = now()
     WHERE lower(email) = lower($2) AND two_factor_secret = $4 AND two_factor_enabled = false AND two_factor_last_used_step < $3
       AND active = true AND session_epoch = $5
     RETURNING *`,
    [JSON.stringify(backupCodeHashes), normalized, firstTimeStep, expectedSecret, expectedSessionEpoch],
  );
  if (!rows[0]) return null;
  const user = toAdminUser(rows[0]);
  await addAuditLog('admin_user', user.id, 'admin_user_2fa_enabled', actorEmail, { email: user.email });
  return user;
}

export async function consumeAdminUserTotpStep(email: string, expectedSecret: string, timeStep: number, expectedSessionEpoch: number) {
  if (!Number.isSafeInteger(expectedSessionEpoch) || expectedSessionEpoch < 0) return null;
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const db = getPool();
  if (!Number.isSafeInteger(timeStep) || timeStep < 0 || !expectedSecret) return null;
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const user = local.adminUsers.find((item) => item.email.toLowerCase() === normalized);
      if (!user || !user.active || !user.twoFactorEnabled || user.twoFactorSecret !== expectedSecret
        || normalizeAdminSessionEpoch(user.sessionEpoch) !== expectedSessionEpoch
        || timeStep <= (user.twoFactorLastUsedStep ?? -1)) return null;
      user.twoFactorLastUsedStep = timeStep;
      user.updatedAt = now();
      await writeLocalDb(local, { writeAdminUsers: true });
      return user;
    });
  }
  const { rows } = await db.query(
    `UPDATE admin_users
     SET two_factor_last_used_step = $3, updated_at = now()
     WHERE lower(email) = lower($1) AND active = true AND two_factor_enabled = true
       AND two_factor_secret = $2 AND two_factor_last_used_step < $3::bigint
       AND session_epoch = $4
     RETURNING *`,
    [normalized, expectedSecret, timeStep, expectedSessionEpoch],
  );
  return rows[0] ? toAdminUser(rows[0]) : null;
}

export async function consumeAdminUserBackupCode(email: string, backupCodeHash: string, actorEmail: string, expectedSessionEpoch: number) {
  if (!Number.isSafeInteger(expectedSessionEpoch) || expectedSessionEpoch < 0 || !backupCodeHash) return null;
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const user = local.adminUsers.find((item) => item.email.toLowerCase() === normalized);
      if (!user || !user.active || !user.twoFactorEnabled
        || normalizeAdminSessionEpoch(user.sessionEpoch) !== expectedSessionEpoch
        || !user.twoFactorBackupCodeHashes.includes(backupCodeHash)) return null;
      user.twoFactorBackupCodeHashes = user.twoFactorBackupCodeHashes.filter((hash) => hash !== backupCodeHash);
      user.updatedAt = now();
      local.auditLogs.unshift({
        id: randomUUID(), entityType: 'admin_user', entityId: user.id,
        action: 'admin_user_2fa_backup_code_used', actorEmail,
        changes: { email: user.email }, createdAt: now(),
      });
      await writeLocalDb(local, { writeAdminUsers: true });
      return user;
    });
  }
  const { rows } = await db.query(
    `UPDATE admin_users
     SET two_factor_backup_code_hashes = COALESCE((
       SELECT jsonb_agg(code_hash)
       FROM jsonb_array_elements_text(admin_users.two_factor_backup_code_hashes) AS stored(code_hash)
       WHERE code_hash <> $1
     ), '[]'::jsonb), updated_at = now()
     WHERE lower(email) = lower($2)
       AND two_factor_enabled = true
       AND active = true AND session_epoch = $3
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(admin_users.two_factor_backup_code_hashes) AS stored(code_hash)
         WHERE code_hash = $1
       )
     RETURNING *`,
    [backupCodeHash, normalized, expectedSessionEpoch],
  );
  if (!rows[0]) return null;
  const user = toAdminUser(rows[0]);
  await addAuditLog('admin_user', user.id, 'admin_user_2fa_backup_code_used', actorEmail, { email: user.email });
  return user;
}

export async function resetAdminUserTwoFactor(id: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const user = local.adminUsers.find((item) => item.id === id);
      if (!user) return null;
      user.twoFactorSecret = '';
      user.twoFactorEnabled = false;
      user.twoFactorLastUsedStep = -1;
      user.twoFactorBackupCodeHashes = [];
      user.sessionEpoch = normalizeAdminSessionEpoch(user.sessionEpoch) + 1;
      user.updatedAt = now();
      local.auditLogs.unshift({
        id: randomUUID(), entityType: 'admin_user', entityId: id,
        action: 'admin_user_2fa_reset', actorEmail,
        changes: { email: user.email }, createdAt: user.updatedAt,
      });
      await writeLocalDb(local, { writeAdminUsers: true });
      return user;
    });
  }
  const { rows } = await db.query(
    `UPDATE admin_users
     SET two_factor_secret = '', two_factor_enabled = false, two_factor_last_used_step = -1,
         two_factor_backup_code_hashes = '[]'::jsonb, session_epoch = session_epoch + 1, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  if (!rows[0]) return null;
  const user = toAdminUser(rows[0]);
  await addAuditLog('admin_user', id, 'admin_user_2fa_reset', actorEmail, { email: user.email });
  return user;
}

export async function resetManagedAdminUserTwoFactor(id: string, actor: ManagedAdminActor) {
  await ensureSchema();
  const normalizedActor: ManagedAdminActor = {
    email: actor.email.trim().toLowerCase(),
    sessionEpoch: actor.sessionEpoch,
  };
  if (!id || !normalizedActor.email || !Number.isSafeInteger(normalizedActor.sessionEpoch) || normalizedActor.sessionEpoch < 0) {
    throw new AdminUserManagementError('ACTOR_REVOKED');
  }
  const timestamp = now();
  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const actorUser = local.adminUsers.find((item) => item.email.toLowerCase() === normalizedActor.email);
      const verifiedActor = actorUser ? toAdminUser(actorUser as unknown as Record<string, unknown>) : null;
      assertManagedAdminActor(verifiedActor, normalizedActor);
      if (verifiedActor?.id === id) throw new AdminUserManagementError('SELF_ACCESS_CHANGE');
      const user = local.adminUsers.find((item) => item.id === id);
      if (!user) throw new AdminUserManagementError('USER_NOT_FOUND');
      user.twoFactorSecret = '';
      user.twoFactorEnabled = false;
      user.twoFactorLastUsedStep = -1;
      user.twoFactorBackupCodeHashes = [];
      user.sessionEpoch = normalizeAdminSessionEpoch(user.sessionEpoch) + 1;
      user.updatedAt = timestamp;
      local.auditLogs.unshift({
        id: randomUUID(), entityType: 'admin_user', entityId: id,
        action: 'admin_user_2fa_reset', actorEmail: normalizedActor.email,
        changes: { email: user.email }, createdAt: timestamp,
      });
      await writeLocalDb(local, { writeAdminUsers: true });
      return toAdminUser(user as unknown as Record<string, unknown>);
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('astana:admin-user-management', 0))");
    const actorResult = await client.query('SELECT * FROM admin_users WHERE lower(email) = lower($1) FOR UPDATE', [normalizedActor.email]);
    const verifiedActor = actorResult.rows[0] ? toAdminUser(actorResult.rows[0]) : null;
    assertManagedAdminActor(verifiedActor, normalizedActor);
    if (verifiedActor?.id === id) throw new AdminUserManagementError('SELF_ACCESS_CHANGE');
    const { rows } = await client.query(
      `UPDATE admin_users
       SET two_factor_secret = '', two_factor_enabled = false, two_factor_last_used_step = -1,
           two_factor_backup_code_hashes = '[]'::jsonb, session_epoch = session_epoch + 1, updated_at = $2
       WHERE id = $1
       RETURNING *`,
      [id, timestamp],
    );
    if (!rows[0]) throw new AdminUserManagementError('USER_NOT_FOUND');
    const user = toAdminUser(rows[0]);
    await client.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), 'admin_user', id, 'admin_user_2fa_reset', normalizedActor.email, { email: user.email }, timestamp],
    );
    await client.query('COMMIT');
    return user;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listPlannerActions(range?: { from?: string; to?: string }): Promise<PlannerAction[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.plannerActions]
      .filter((item) => (!range?.from || item.date >= range.from) && (!range?.to || item.date <= range.to))
      .sort((a, b) => `${a.date} ${a.timeFrom}`.localeCompare(`${b.date} ${b.timeFrom}`));
  }
  const values: string[] = [];
  const conditions: string[] = [];
  if (range?.from) {
    values.push(range.from);
    conditions.push(`datum >= $${values.length}`);
  }
  if (range?.to) {
    values.push(range.to);
    conditions.push(`datum <= $${values.length}`);
  }
  const { rows } = await db.query(
    `SELECT * FROM planner_actions ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY datum ASC, cas_od ASC`,
    values,
  );
  return rows.map(toPlannerAction);
}

export async function savePlannerAction(input: PlannerActionInput, actorEmail: string, id?: string): Promise<PlannerAction> {
  await ensureSchema();
  const action: PlannerAction = {
    ...input,
    id: id || randomUUID(),
    createdAt: now(),
    jobId: input.jobId || '',
    customerName: input.customerName?.trim() ?? '',
    customerEmail: input.customerEmail?.trim() ?? '',
    customerPhone: input.customerPhone?.trim() ?? '',
    note: input.note?.trim() ?? '',
    notify2DaysSent: false,
    notify1DaySent: false,
    notifyCustomerSent: false,
  };
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const existingIndex = local.plannerActions.findIndex((item) => item.id === action.id);
    if (existingIndex >= 0) {
      local.plannerActions[existingIndex] = { ...local.plannerActions[existingIndex], ...action, createdAt: local.plannerActions[existingIndex].createdAt };
    } else {
      local.plannerActions.push(action);
    }
    await writeLocalDb(local);
    await addAuditLog('planner_action', action.id, id ? 'planner_action_updated' : 'planner_action_created', actorEmail, { date: action.date, type: action.type });
    return action;
  }
  const { rows } = await db.query(
    `INSERT INTO planner_actions (
      id, datum, cas_od, cas_do, typ, adresa, zakazka_id, pracovnici,
      zakaznik_meno, zakaznik_email, zakaznik_telefon, poznamka, stav,
      notif_2dni, notif_1den, notif_zakaznik
    ) VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::uuid,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (id)
    DO UPDATE SET
      datum = EXCLUDED.datum,
      cas_od = EXCLUDED.cas_od,
      cas_do = EXCLUDED.cas_do,
      typ = EXCLUDED.typ,
      adresa = EXCLUDED.adresa,
      zakazka_id = EXCLUDED.zakazka_id,
      pracovnici = EXCLUDED.pracovnici,
      zakaznik_meno = EXCLUDED.zakaznik_meno,
      zakaznik_email = EXCLUDED.zakaznik_email,
      zakaznik_telefon = EXCLUDED.zakaznik_telefon,
      poznamka = EXCLUDED.poznamka,
      stav = EXCLUDED.stav,
      notif_2dni = EXCLUDED.notif_2dni,
      notif_1den = EXCLUDED.notif_1den,
      notif_zakaznik = EXCLUDED.notif_zakaznik
    RETURNING *`,
    [
      action.id,
      action.date,
      action.timeFrom,
      action.timeTo,
      action.type,
      action.address,
      action.jobId,
      action.workers,
      action.customerName,
      action.customerEmail,
      action.customerPhone,
      action.note,
      action.status,
      action.notify2Days,
      action.notify1Day,
      action.notifyCustomer,
    ],
  );
  const saved = toPlannerAction(rows[0]);
  await addAuditLog('planner_action', saved.id, id ? 'planner_action_updated' : 'planner_action_created', actorEmail, { date: saved.date, type: saved.type });
  return saved;
}

export async function markPlannerNotificationSent(id: string, field: 'notify2DaysSent' | 'notify1DaySent' | 'notifyCustomerSent') {
  await ensureSchema();
  const dbField =
    field === 'notify2DaysSent' ? 'notif_2dni_odoslana' : field === 'notify1DaySent' ? 'notif_1den_odoslana' : 'notif_zakaznik_odoslana';
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const action = local.plannerActions.find((item) => item.id === id);
    if (action) action[field] = true;
    await writeLocalDb(local);
    return;
  }
  await db.query(`UPDATE planner_actions SET ${dbField} = true WHERE id = $1`, [id]);
}

export async function setAdminSetting(key: string, value: string, actorEmail: string) {
  await ensureSchema();
  const normalizedKey = key.trim();
  if (!normalizedKey) return;

  const db = getPool();
  if (!db) {
    await withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      local.adminSettings[normalizedKey] = value;
      local.auditLogs.unshift({
        id: randomUUID(), entityType: 'site_content', entityId: siteContentAuditId,
        action: 'admin_setting_updated', actorEmail, changes: { key: normalizedKey }, createdAt: now(),
      });
      await writeLocalDb(local, { adminSettingKey: normalizedKey });
    });
    return;
  }

  await db.query(
    `INSERT INTO admin_settings (key, value, updated_at, updated_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
    [normalizedKey, value, now(), actorEmail],
  );
  await addAuditLog('site_content', siteContentAuditId, 'admin_setting_updated', actorEmail, { key: normalizedKey });
}

export async function getDashboardStats() {
  const leads = await listLeadSummaries();
  const today = new Date().toISOString().slice(0, 10);
  const staleLeads = leads.filter((lead) => lead.status === 'novy' && Date.now() - new Date(lead.createdAt).getTime() > 24 * 60 * 60 * 1000).length;
  return {
    totalLeads: leads.length,
    newLeads: leads.filter((lead) => lead.status === 'novy').length,
    todayLeads: leads.filter((lead) => lead.createdAt.startsWith(today)).length,
    pricedLeads: leads.filter((lead) => lead.status === 'naceneny' || lead.status === 'cenova_ponuka_odoslana').length,
    staleLeads,
    missingPhotos: leads.filter((lead) => lead.fileCount === 0).length,
  };
}

function clampText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function eventDate(value: string) {
  return dateInBratislava(value);
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function sourceFromEvent(event: Pick<AnalyticsEvent, 'utmSource' | 'referrer'>) {
  if (event.utmSource) return event.utmSource;
  if (!event.referrer) return 'direct';
  try {
    const host = new URL(event.referrer).hostname.replace(/^www\./, '');
    if (host.includes('google.')) return 'google';
    if (host.includes('facebook.') || host.includes('instagram.')) return 'social';
    return host;
  } catch {
    return 'referrer';
  }
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput) {
  await ensureSchema();
  const id = input.dedupeId || randomUUID();
  const event: AnalyticsEvent = {
    id,
    createdAt: input.createdAt && Number.isFinite(Date.parse(input.createdAt))
      ? new Date(input.createdAt).toISOString()
      : now(),
    sessionId: clampText(input.sessionId, 80),
    eventType: input.eventType,
    path: clampText(input.path || '/', 500),
    referrer: clampText(input.referrer, 500),
    device: input.device || 'desktop',
    viewportWidth: input.viewportWidth ? Math.max(0, Math.round(Number(input.viewportWidth))) : undefined,
    utmSource: clampText(input.utmSource, 160),
    utmMedium: clampText(input.utmMedium, 160),
    utmCampaign: clampText(input.utmCampaign, 160),
    metadata: input.metadata ?? {},
  };

  const db = getPool();
  if (!db) {
    return withLocalLeadSubmissionLock(async () => {
      const local = await readLocalDb();
      const existing = input.dedupeId ? local.analyticsEvents.find((item) => item.id === id) : undefined;
      if (existing) return existing;
      local.analyticsEvents.unshift(event);
      // Keep accepted-lead conversion IDs permanently available for idempotency;
      // only the high-volume browsing events are capped in the local fallback.
      const acceptedLeadEvents = local.analyticsEvents.filter((item) => item.eventType === 'form_submit_success');
      const otherEvents = local.analyticsEvents.filter((item) => item.eventType !== 'form_submit_success').slice(0, 5000);
      local.analyticsEvents = [...acceptedLeadEvents, ...otherEvents];
      await writeLocalDb(local);
      return event;
    });
  }

  const inserted = await db.query(
    `INSERT INTO analytics_events (
      id, created_at, session_id, event_type, path, referrer, device, viewport_width,
      utm_source, utm_medium, utm_campaign, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      event.id,
      event.createdAt,
      event.sessionId,
      event.eventType,
      event.path,
      event.referrer,
      event.device,
      event.viewportWidth ?? null,
      event.utmSource,
      event.utmMedium,
      event.utmCampaign,
      event.metadata,
    ],
  );
  if (inserted.rowCount === 0 && input.dedupeId) {
    const existing = await db.query('SELECT * FROM analytics_events WHERE id = $1 LIMIT 1', [id]);
    if (existing.rows[0]) return toAnalyticsEvent(existing.rows[0]);
  }
  return event;
}

export async function recordAcceptedLeadAnalytics(lead: Lead) {
  const rawData = lead.rawData ?? {};
  if (rawData.analyticsConsentAtSubmit !== true) return null;
  const sessionId = String(rawData.analyticsSessionId ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) return null;
  const attribution = rawData.attribution && typeof rawData.attribution === 'object'
    ? rawData.attribution as Record<string, unknown>
    : {};
  const landingPath = typeof attribution.landingPath === 'string' && attribution.landingPath.startsWith('/')
    ? attribution.landingPath.slice(0, 300)
    : '/';
  const adClickIds = ['gclid', 'gbraid', 'wbraid', 'fbclid'].reduce<Record<string, string>>((result, key) => {
    const value = attribution[key];
    if (typeof value === 'string' && value.length <= 512) result[key] = value;
    return result;
  }, {});
  const userAgent = String(rawData.userAgent ?? '');
  const device = /iPad|Tablet|PlayBook|Silk/i.test(userAgent)
    || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))
    ? 'tablet'
    : /Mobile|iPhone|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
      ? 'mobile'
      : 'desktop';
  return recordAnalyticsEvent({
    dedupeId: lead.id,
    createdAt: lead.createdAt,
    sessionId,
    eventType: 'form_submit_success',
    path: landingPath,
    device,
    utmSource: typeof attribution.utmSource === 'string' ? attribution.utmSource : undefined,
    utmMedium: typeof attribution.utmMedium === 'string' ? attribution.utmMedium : undefined,
    utmCampaign: typeof attribution.utmCampaign === 'string' ? attribution.utmCampaign : undefined,
    metadata: { form: 'lead', source: 'server-accepted', ...(Object.keys(adClickIds).length ? { adClickIds } : {}) },
  });
}

export async function recoverAcceptedLeadAnalytics(limit = 100): Promise<{ recovered: number; remaining: boolean; failed: boolean; unrecoverable: number }> {
  await ensureSchema();
  const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const db = getPool();
  let candidates: Lead[];
  let unrecoverable = 0;
  if (!db) {
    const local = await readLocalDb();
    const recordedIds = new Set(local.analyticsEvents
      .filter((event) => event.eventType === 'form_submit_success')
      .map((event) => event.id));
    const unrecorded = local.leads.filter((lead) => lead.rawData?.analyticsConsentAtSubmit === true && !recordedIds.has(lead.id));
    const validSession = (lead: Lead) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(lead.rawData?.analyticsSessionId ?? ''));
    unrecoverable = unrecorded.filter((lead) => !validSession(lead)).length;
    candidates = unrecorded
      .filter(validSession)
      .slice(0, boundedLimit + 1);
  } else {
    const invalid = await db.query(`
      SELECT COUNT(*)::int AS count FROM leads l
      LEFT JOIN analytics_events e ON e.id = l.id AND e.event_type = 'form_submit_success'
      WHERE l.deleted_at IS NULL AND l.raw_data->>'analyticsConsentAtSubmit' = 'true'
        AND e.id IS NULL
        AND COALESCE(l.raw_data->>'analyticsSessionId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    `);
    unrecoverable = Number(invalid.rows[0]?.count ?? 0);
    const { rows } = await db.query(`
      SELECT l.* FROM leads l
      LEFT JOIN analytics_events e ON e.id = l.id AND e.event_type = 'form_submit_success'
      WHERE l.deleted_at IS NULL AND l.raw_data->>'analyticsConsentAtSubmit' = 'true' AND e.id IS NULL
        AND l.raw_data->>'analyticsSessionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      ORDER BY l.created_at ASC LIMIT $1
    `, [boundedLimit + 1]);
    candidates = rows.map((row) => toLead(row));
  }

  const pending = candidates.slice(0, boundedLimit);
  const result = await persistAcceptedLeadAnalyticsBatch(
    pending,
    recordAcceptedLeadAnalytics,
    (_lead, error) => console.error('Accepted lead analytics recovery failed for a stored lead.', error),
  );
  return { ...result, remaining: candidates.length > boundedLimit || result.failed, unrecoverable };
}

export async function getAnalyticsEventsWithCoverage(days = 30, sinceOverride?: string): Promise<{ events: AnalyticsEvent[]; coverage: { limit: number; returned: number; truncated: boolean } }> {
  await ensureSchema();
  const rangeDays = Math.min(365, Math.max(1, Math.round(days)));
  const since = sinceOverride ?? getAnalyticsPeriod(rangeDays).since;
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const events = local.analyticsEvents
      .filter((event) => event.createdAt >= since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { events, coverage: { limit: ANALYTICS_EVENTS_LIMIT, returned: events.length, truncated: false } };
  }
  const { rows } = await db.query(
    'SELECT * FROM analytics_events WHERE created_at >= $1 ORDER BY created_at DESC LIMIT $2',
    [since, ANALYTICS_EVENTS_LIMIT + 1],
  );
  const limited = limitAnalyticsEventRows(rows);
  const events = limited.rows.map(toAnalyticsEvent);
  return { events, coverage: limited.coverage };
}

export async function listAnalyticsEvents(days = 30): Promise<AnalyticsEvent[]> {
  return (await getAnalyticsEventsWithCoverage(days)).events;
}

async function getAnalyticsCrmCohort(since: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return summarizeCrmCohort(local.leads, local.quotes, Date.parse(since));
  }

  const { rows } = await db.query(`
    SELECT
      COUNT(DISTINCT l.id)::int AS leads,
      COUNT(q.id) FILTER (WHERE q.status IN ('sent', 'accepted', 'rejected', 'expired'))::int AS quotes,
      COUNT(q.id) FILTER (WHERE q.status = 'accepted')::int AS accepted_quotes,
      COUNT(DISTINCT l.id) FILTER (WHERE q.status IN ('sent', 'accepted', 'rejected', 'expired'))::int AS quoted_leads,
      COUNT(DISTINCT l.id) FILTER (WHERE q.status = 'accepted')::int AS accepted_leads
    FROM leads l
    LEFT JOIN quotes q ON q.lead_id = l.id
    WHERE l.deleted_at IS NULL AND l.is_test_data = false AND l.created_at >= $1
  `, [since]);
  const row = rows[0] ?? {};
  return {
    leads: Number(row.leads ?? 0),
    quotes: Number(row.quotes ?? 0),
    acceptedQuotes: Number(row.accepted_quotes ?? 0),
    quotedLeads: Number(row.quoted_leads ?? 0),
    acceptedLeads: Number(row.accepted_leads ?? 0),
  };
}

export async function getAnalyticsReport(days = 30, periodOverride?: AnalyticsPeriod): Promise<AnalyticsReport> {
  const rangeDays = Math.min(365, Math.max(1, Math.round(days)));
  const nowDate = new Date();
  const period = periodOverride ?? getAnalyticsPeriod(rangeDays, nowDate);
  const [{ events, coverage: eventCoverage }, crm] = await Promise.all([
    getAnalyticsEventsWithCoverage(rangeDays, period.since),
    getAnalyticsCrmCohort(period.since),
  ]);
  const pageViews = events.filter((event) => event.eventType === 'page_view');
  const { visitSessions: sessionIds, quoteViewSessions, formStartSessions, leadSessions } = getMeasuredSessionSets(events);
  const sequentialFunnel = getSequentialMeasuredFunnel({ visitSessions: sessionIds, quoteViewSessions, formStartSessions, leadSessions });
  const measuredEvents = events.filter((event) => sessionIds.has(event.sessionId));
  const sessionEntry = getSessionEntryEvents(pageViews);

  const byEvent = new Map<string, number>();
  for (const event of events) byEvent.set(event.eventType, (byEvent.get(event.eventType) ?? 0) + 1);

  const pageMap = new Map<string, { path: string; views: number; sessions: Set<string>; leads: Set<string> }>();
  for (const event of pageViews) {
    const item = pageMap.get(event.path) ?? { path: event.path, views: 0, sessions: new Set<string>(), leads: new Set<string>() };
    item.views += 1;
    if (event.sessionId) item.sessions.add(event.sessionId);
    pageMap.set(event.path, item);
  }
  for (const event of measuredEvents.filter((item) => item.eventType === 'form_submit_success')) {
    const entry = sessionEntry.get(event.sessionId);
    if (!entry) continue;
    const item = pageMap.get(entry.path) ?? { path: entry.path, views: 0, sessions: new Set<string>(), leads: new Set<string>() };
    item.leads.add(event.sessionId);
    pageMap.set(entry.path, item);
  }

  const sourceMap = new Map<string, { source: string; sessions: Set<string>; leads: Set<string> }>();
  for (const event of sessionEntry.values()) {
    const source = sourceFromEvent(event);
    const item = sourceMap.get(source) ?? { source, sessions: new Set<string>(), leads: new Set<string>() };
    if (event.sessionId) item.sessions.add(event.sessionId);
    sourceMap.set(source, item);
  }

  const campaignMap = new Map<string, { campaign: string; source: string; sessions: Set<string>; leads: Set<string> }>();
  for (const event of sessionEntry.values()) {
    const source = sourceFromEvent(event);
    const campaign = event.utmCampaign?.trim() || 'Bez kampane';
    const key = `${source}\u0000${campaign}`;
    const item = campaignMap.get(key) ?? { campaign, source, sessions: new Set<string>(), leads: new Set<string>() };
    if (event.sessionId) item.sessions.add(event.sessionId);
    campaignMap.set(key, item);
  }
  for (const event of measuredEvents.filter((item) => item.eventType === 'form_submit_success')) {
    const entry = sessionEntry.get(event.sessionId);
    if (!entry) continue;
    const source = sourceFromEvent(entry);
    const campaign = entry.utmCampaign?.trim() || 'Bez kampane';
    const key = `${source}\u0000${campaign}`;
    const item = campaignMap.get(key) ?? { campaign, source, sessions: new Set<string>(), leads: new Set<string>() };
    if (event.sessionId) {
      item.leads.add(event.sessionId);
    }
    campaignMap.set(key, item);
  }
  for (const event of measuredEvents.filter((item) => item.eventType === 'form_submit_success')) {
    const entry = sessionEntry.get(event.sessionId);
    if (!entry) continue;
    const source = sourceFromEvent(entry);
    const item = sourceMap.get(source) ?? { source, sessions: new Set<string>(), leads: new Set<string>() };
    if (event.sessionId) {
      item.leads.add(event.sessionId);
    }
    sourceMap.set(source, item);
  }

  const deviceMap = new Map<string, { device: string; sessions: Set<string>; pageViews: number; leads: Set<string> }>();
  for (const event of pageViews) {
    const device = getSessionEntryDevice(event, sessionEntry);
    const item = deviceMap.get(device) ?? { device, sessions: new Set<string>(), pageViews: 0, leads: new Set<string>() };
    if (event.sessionId) item.sessions.add(event.sessionId);
    item.pageViews += 1;
    deviceMap.set(device, item);
  }
  for (const event of measuredEvents.filter((item) => item.eventType === 'form_submit_success')) {
    const device = getSessionEntryDevice(event, sessionEntry);
    const item = deviceMap.get(device) ?? { device, sessions: new Set<string>(), pageViews: 0, leads: new Set<string>() };
    item.leads.add(event.sessionId);
    deviceMap.set(device, item);
  }

  const dailyMap = new Map<string, { date: string; pageViews: number; sessions: Set<string>; leads: Set<string>; formStarts: Set<string>; quoteViews: Set<string> }>();
  for (const date of period.dates) {
    dailyMap.set(date, { date, pageViews: 0, sessions: new Set<string>(), leads: new Set<string>(), formStarts: new Set<string>(), quoteViews: new Set<string>() });
  }
  for (const event of measuredEvents) {
    const date = eventDate(event.createdAt);
    const item = dailyMap.get(date);
    if (!item) continue;
    if (event.eventType === 'page_view') item.pageViews += 1;
    if (event.eventType === 'page_view' && event.sessionId) item.sessions.add(event.sessionId);
    if (event.eventType === 'form_submit_success' && event.sessionId) item.leads.add(event.sessionId);
    if (event.eventType === 'form_start' && event.sessionId) item.formStarts.add(event.sessionId);
    if (event.eventType === 'quote_section_view' && event.sessionId) item.quoteViews.add(event.sessionId);
  }

  const leadCount = crm.leads;
  const quoteCount = crm.quotes;
  const acceptedQuotes = crm.acceptedQuotes;

  return {
    rangeDays,
    eventCoverage,
    totals: {
      pageViews: pageViews.length,
      sessions: sessionIds.size,
      leads: leadCount,
      quotes: quoteCount,
      acceptedQuotes,
      measuredLeads: leadSessions.size,
      leadConversionRate: percent(leadSessions.size, sessionIds.size),
      quoteRate: percent(crm.quotedLeads, leadCount),
      acceptedQuoteRate: percent(crm.acceptedLeads, crm.quotedLeads),
      quotedLeads: crm.quotedLeads,
      acceptedLeads: crm.acceptedLeads,
    },
    events: [...byEvent.entries()].map(([eventType, count]) => ({ eventType, count })).sort((a, b) => b.count - a.count),
    topPages: [...pageMap.values()]
      .map((item) => ({ path: item.path, views: item.views, sessions: item.sessions.size, leads: item.leads.size, conversionRate: percent(item.leads.size, item.sessions.size) }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    sources: [...sourceMap.values()]
      .map((item) => ({ source: item.source, sessions: item.sessions.size, leads: item.leads.size, conversionRate: percent(item.leads.size, item.sessions.size) }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10),
    campaigns: [...campaignMap.values()]
      .map((item) => ({ campaign: item.campaign, source: item.source, sessions: item.sessions.size, leads: item.leads.size, conversionRate: percent(item.leads.size, item.sessions.size) }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 15),
    devices: [...deviceMap.values()]
      .map((item) => ({ device: item.device, sessions: item.sessions.size, pageViews: item.pageViews, leads: item.leads.size, conversionRate: percent(item.leads.size, item.sessions.size) }))
      .sort((a, b) => b.sessions - a.sessions),
    daily: [...dailyMap.values()].map((item) => ({
      date: item.date,
      pageViews: item.pageViews,
      sessions: item.sessions.size,
      leads: item.leads.size,
      formStarts: item.formStarts.size,
      quoteViews: item.quoteViews.size,
    })),
    funnel: [
      { label: 'Návštevy', count: sessionIds.size, rateFromPrevious: 100 },
      { label: 'Videný dotazník', count: sequentialFunnel.quoteViews.size, rateFromPrevious: percent(sequentialFunnel.quoteViews.size, sessionIds.size) },
      { label: 'Začaté vypĺňanie', count: sequentialFunnel.formStarts.size, rateFromPrevious: percent(sequentialFunnel.formStarts.size, sequentialFunnel.quoteViews.size) },
      { label: 'Odoslaný dopyt (merané relácie)', count: sequentialFunnel.leads.size, rateFromPrevious: percent(sequentialFunnel.leads.size, sequentialFunnel.formStarts.size) },
      { label: 'Dopyty v CRM', count: leadCount, rateFromPrevious: null },
      { label: 'Dopyty s vydanou ponukou', count: crm.quotedLeads, rateFromPrevious: percent(crm.quotedLeads, leadCount) },
      { label: 'Dopyty s prijatou ponukou', count: crm.acceptedLeads, rateFromPrevious: percent(crm.acceptedLeads, crm.quotedLeads) },
    ],
  };
}

export async function getLeadAttributionReport(days = 30, sinceOverride?: string, maxRows: number | null = 50): Promise<LeadAttributionReportRow[]> {
  await ensureSchema();
  const rangeDays = Math.min(365, Math.max(1, Math.round(days)));
  const since = sinceOverride ?? getAnalyticsPeriod(rangeDays).since;
  const sinceMs = Date.parse(since);
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return summarizeLeadAttribution(local.leads, local.quotes, local.businessJobs, local.priceOffers, sinceMs, maxRows);
  }

  const { rows } = await db.query(`
    WITH lead_base AS (
      SELECT
        l.id,
        l.status,
        COALESCE(
          NULLIF(BTRIM(l.raw_data #>> '{attribution,utmSource}'), ''),
          CASE
            WHEN NULLIF(BTRIM(l.raw_data #>> '{attribution,gclid}'), '') IS NOT NULL
              OR NULLIF(BTRIM(l.raw_data #>> '{attribution,gbraid}'), '') IS NOT NULL
              OR NULLIF(BTRIM(l.raw_data #>> '{attribution,wbraid}'), '') IS NOT NULL THEN 'Google Ads'
            WHEN NULLIF(BTRIM(l.raw_data #>> '{attribution,fbclid}'), '') IS NOT NULL THEN 'Meta'
            ELSE 'Nezachytený zdroj'
          END
        ) AS source,
        COALESCE(NULLIF(BTRIM(l.raw_data #>> '{attribution,utmMedium}'), ''), 'Neuvedené') AS medium,
        COALESCE(NULLIF(BTRIM(l.raw_data #>> '{attribution,utmCampaign}'), ''), 'Bez označenia') AS campaign
      FROM leads l
      WHERE l.deleted_at IS NULL AND l.is_test_data = false AND l.created_at >= $1
    ), lead_offer_stages AS (
      SELECT
        lead_base.*,
        (
          EXISTS (SELECT 1 FROM quotes q WHERE q.lead_id = lead_base.id AND q.status IN ('sent', 'accepted', 'rejected', 'expired'))
          OR EXISTS (
            SELECT 1 FROM price_offers o
            WHERE ${priceOfferAttributionOwnerCondition} AND o.status IN ('ODOSLANA', 'PRIJATA')
              AND ${businessPriceOfferCondition}
          )
        ) AS has_issued_offer,
        (
          EXISTS (SELECT 1 FROM quotes q WHERE q.lead_id = lead_base.id AND q.status = 'accepted')
          OR EXISTS (
            SELECT 1 FROM price_offers o
            WHERE ${priceOfferAttributionOwnerCondition} AND o.status = 'PRIJATA'
              AND ${businessPriceOfferCondition}
          )
        ) AS has_accepted_offer
      FROM lead_base
    )
    SELECT
      source,
      medium,
      campaign,
      COUNT(*)::int AS leads,
      COUNT(*) FILTER (WHERE has_issued_offer)::int AS leads_with_issued_offer,
      COUNT(*) FILTER (WHERE has_accepted_offer)::int AS leads_with_accepted_offer,
      COUNT(*) FILTER (WHERE status IN ('objednane', 'v_realizacii', 'dokoncena'))::int AS progressed_leads
    FROM lead_offer_stages
    GROUP BY source, medium, campaign
    ORDER BY leads DESC, source COLLATE "C" ASC, medium COLLATE "C" ASC, campaign COLLATE "C" ASC
    ${maxRows === null ? '' : 'LIMIT $2'}
  `, maxRows === null ? [since] : [since, Math.max(1, Math.min(10000, Math.round(maxRows)))]);

  return rows.map((row) => ({
    source: String(row.source ?? 'Nezachytený zdroj'),
    medium: String(row.medium ?? 'Neuvedené'),
    campaign: String(row.campaign ?? 'Bez označenia'),
    leads: Number(row.leads ?? 0),
    leadsWithIssuedOffer: Number(row.leads_with_issued_offer ?? 0),
    leadsWithAcceptedOffer: Number(row.leads_with_accepted_offer ?? 0),
    progressedLeads: Number(row.progressed_leads ?? 0),
  }));
}

function analyticsTrafficSlice(events: AnalyticsEvent[], sinceMs?: number): AnalyticsTrafficSlice {
  const filtered = sinceMs === undefined ? events : events.filter((event) => new Date(event.createdAt).getTime() >= sinceMs);
  return {
    pageViews: filtered.filter((event) => event.eventType === 'page_view').length,
    sessions: new Set(filtered.filter((event) => event.eventType === 'page_view').map((event) => event.sessionId).filter(Boolean)).size,
    formStarts: filtered.filter((event) => event.eventType === 'form_start').length,
    leads: filtered.filter((event) => event.eventType === 'form_submit_success').length,
  };
}

function slovakDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bratislava',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

function slovakMidnightUtc(parts: { year: number; month: number; day: number }) {
  return bratislavaMidnightUtc(parts);
}

export async function getAnalyticsTrafficSummary(): Promise<AnalyticsTrafficSummary> {
  await ensureSchema();
  const currentDate = slovakDateParts(new Date());
  const todayStart = slovakMidnightUtc(currentDate).toISOString();
  const monthStart = slovakMidnightUtc({ ...currentDate, day: 1 }).toISOString();
  const yearStart = slovakMidnightUtc({ ...currentDate, month: 1, day: 1 }).toISOString();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const events = local.analyticsEvents;
    return {
      today: analyticsTrafficSlice(events, new Date(todayStart).getTime()),
      month: analyticsTrafficSlice(events, new Date(monthStart).getTime()),
      year: analyticsTrafficSlice(events, new Date(yearStart).getTime()),
      allTime: analyticsTrafficSlice(events),
    };
  }

  const { rows } = await db.query(
    `WITH periods AS (SELECT $1::timestamptz AS today_start, $2::timestamptz AS month_start, $3::timestamptz AS year_start)
     SELECT
       COUNT(*) FILTER (WHERE e.created_at >= p.today_start AND e.event_type = 'page_view')::int AS today_page_views,
       COUNT(DISTINCT e.session_id) FILTER (WHERE e.created_at >= p.today_start AND e.event_type = 'page_view' AND e.session_id <> '')::int AS today_sessions,
       COUNT(*) FILTER (WHERE e.created_at >= p.today_start AND e.event_type = 'form_start')::int AS today_form_starts,
       COUNT(*) FILTER (WHERE e.created_at >= p.today_start AND e.event_type = 'form_submit_success')::int AS today_leads,
       COUNT(*) FILTER (WHERE e.created_at >= p.month_start AND e.event_type = 'page_view')::int AS month_page_views,
       COUNT(DISTINCT e.session_id) FILTER (WHERE e.created_at >= p.month_start AND e.event_type = 'page_view' AND e.session_id <> '')::int AS month_sessions,
       COUNT(*) FILTER (WHERE e.created_at >= p.month_start AND e.event_type = 'form_start')::int AS month_form_starts,
       COUNT(*) FILTER (WHERE e.created_at >= p.month_start AND e.event_type = 'form_submit_success')::int AS month_leads,
       COUNT(*) FILTER (WHERE e.created_at >= p.year_start AND e.event_type = 'page_view')::int AS year_page_views,
       COUNT(DISTINCT e.session_id) FILTER (WHERE e.created_at >= p.year_start AND e.event_type = 'page_view' AND e.session_id <> '')::int AS year_sessions,
       COUNT(*) FILTER (WHERE e.created_at >= p.year_start AND e.event_type = 'form_start')::int AS year_form_starts,
       COUNT(*) FILTER (WHERE e.created_at >= p.year_start AND e.event_type = 'form_submit_success')::int AS year_leads,
       COUNT(*) FILTER (WHERE e.event_type = 'page_view')::int AS all_page_views,
       COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'page_view' AND e.session_id <> '')::int AS all_sessions,
       COUNT(*) FILTER (WHERE e.event_type = 'form_start')::int AS all_form_starts,
       COUNT(*) FILTER (WHERE e.event_type = 'form_submit_success')::int AS all_leads
     FROM analytics_events e, periods p`,
    [todayStart, monthStart, yearStart],
  );
  const row = rows[0] ?? {};
  const number = (value: unknown) => Number(value ?? 0);
  return {
    today: { pageViews: number(row.today_page_views), sessions: number(row.today_sessions), formStarts: number(row.today_form_starts), leads: number(row.today_leads) },
    month: { pageViews: number(row.month_page_views), sessions: number(row.month_sessions), formStarts: number(row.month_form_starts), leads: number(row.month_leads) },
    year: { pageViews: number(row.year_page_views), sessions: number(row.year_sessions), formStarts: number(row.year_form_starts), leads: number(row.year_leads) },
    allTime: { pageViews: number(row.all_page_views), sessions: number(row.all_sessions), formStarts: number(row.all_form_starts), leads: number(row.all_leads) },
  };
}

function toTestimonial(row: Record<string, unknown>): Testimonial {
  return {
    id: String(row.id),
    submissionId: row.submission_id ? String(row.submission_id) : undefined,
    customerName: String(row.customer_name),
    location: row.location ? String(row.location) : '',
    rating: Number(row.rating ?? 5),
    text: String(row.text),
    status: String(row.status) as TestimonialStatus,
    customerEmail: row.customer_email ? String(row.customer_email) : '',
    consentPublication: Boolean(row.consent_publication),
    consentEvidence: row.consent_evidence ? String(row.consent_evidence) : '',
    consentCapturedAt: row.consent_captured_at ? new Date(String(row.consent_captured_at)).toISOString() : undefined,
    consentVersion: row.consent_version ? String(row.consent_version) : '',
    consentRevokedAt: row.consent_revoked_at ? new Date(String(row.consent_revoked_at)).toISOString() : undefined,
    source: String(row.source ?? 'admin') as Testimonial['source'],
    objectType: row.object_type ? String(row.object_type) : '',
    realizationDate: row.realization_date ? String(row.realization_date).slice(0, 10) : '',
    internalNote: row.internal_note ? String(row.internal_note) : '',
    photoUrl: row.photo_url ? String(row.photo_url) : '',
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    approvedAt: row.approved_at ? new Date(String(row.approved_at)).toISOString() : undefined,
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
  };
}

export async function getSystemHealth() {
  const deliveryMode = leadDeliveryMode();
  const relayConfigured = isAstanaLocalRelayConfigured();
  const smtpAttemptConfigured = isLeadSmtpConfigured();
  const smtpConfigured = canManuallyRetryLeadEmail();
  const base = {
    database: { ok: false, detail: 'Databáza sa nedá overiť.' },
    storage: {
      ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.S3_BUCKET),
      detail: process.env.BLOB_READ_WRITE_TOKEN
        ? 'Vercel Blob je nastavený.'
        : process.env.S3_BUCKET
          ? 'S3 kompatibilné úložisko je nastavené.'
          : process.env.NODE_ENV === 'production'
            ? 'Produkčný storage nie je nastavený.'
            : 'Lokálne ukladanie do storage/lead-files.',
    },
    smtp: {
      ok: false,
      detail: smtpConfigured ? 'SMTP nastavenie je pripravené; spojenie sa ešte neoverilo.' : 'SMTP nastavenie nie je úplné alebo povolené.',
    },
    leadMail: describeLeadMailHealth(deliveryMode, smtpAttemptConfigured, false, relayConfigured),
    features: getRuntimeFeatureHealth(),
    allowedOrigins: process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://likvidacia-eternitu.sk',
    buildCommit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'lokálne / nezistené',
    lastLead: null as null | LeadSummary,
    lastEmailSent: null as null | AuditLog,
    lastEmailError: null as null | AuditLog,
    pendingLeads: 0,
  };

  if (smtpConfigured) {
    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        connectionTimeout: 5_000,
        greetingTimeout: 5_000,
        socketTimeout: 5_000,
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      });
      await transport.verify();
      base.smtp = { ok: true, detail: 'SMTP spojenie odpovedá; doručenie do schránky nie je overené.' };
    } catch {
      base.smtp = { ok: false, detail: 'SMTP spojenie alebo prihlásenie sa nepodarilo overiť.' };
    }
  }
  base.leadMail = describeLeadMailHealth(deliveryMode, smtpAttemptConfigured, base.smtp.ok, relayConfigured);

  try {
    await ensureSchema();
    const db = getPool();
    if (db) {
      await db.query('SELECT 1');
      base.database = { ok: true, detail: 'PostgreSQL/Neon odpovedá.' };
      const [latestLeads, latestSent, latestError] = await Promise.all([
        listLeadSummaries(),
        db.query("SELECT * FROM audit_logs WHERE action IN ('lead_email_sent', 'lead_email_delivery_sent') OR (action = 'lead_email_delivery_resolved' AND changes->>'outcome' = 'sent') ORDER BY created_at DESC LIMIT 1"),
        db.query("SELECT * FROM audit_logs WHERE action IN ('lead_email_error', 'lead_email_skipped', 'lead_email_delivery_failed', 'lead_email_delivery_unknown') ORDER BY created_at DESC LIMIT 1"),
      ]);
      base.lastLead = latestLeads[0] ?? null;
      base.lastEmailSent = latestSent.rows[0] ? toAuditLog(latestSent.rows[0]) : null;
      base.lastEmailError = latestError.rows[0] ? toAuditLog(latestError.rows[0]) : null;
      base.pendingLeads = latestLeads.filter((lead) => lead.status === 'novy').length;
      return base;
    }

    base.database = { ok: true, detail: 'Lokálny vývojový JSON storage odpovedá.' };
    const local = await readLocalDb();
    const latestLeads = await listLeadSummaries();
    base.lastLead = latestLeads[0] ?? null;
    base.lastEmailSent = local.auditLogs.find((log) => log.action === 'lead_email_sent' || log.action === 'lead_email_delivery_sent'
      || (log.action === 'lead_email_delivery_resolved' && log.changes.outcome === 'sent')) ?? null;
    base.lastEmailError = local.auditLogs.find((log) => log.action === 'lead_email_error' || log.action === 'lead_email_skipped'
      || log.action === 'lead_email_delivery_failed' || log.action === 'lead_email_delivery_unknown') ?? null;
    base.pendingLeads = latestLeads.filter((lead) => lead.status === 'novy').length;
    return base;
  } catch (error) {
    base.database = {
      ok: false,
      detail: error instanceof Error ? error.message : 'Neznáma chyba databázy.',
    };
    return base;
  }
}
