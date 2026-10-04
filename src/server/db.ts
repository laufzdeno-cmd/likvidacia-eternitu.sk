import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import {
  assertAttachableLeadUploadDraft,
  assertLeadUploadCapacity,
  assertReusableLeadUploadDraft,
} from './lead-upload-policy';
import { leadUploadSchemaSql } from './lead-upload-schema';
import type {
  AuditLog,
  AnalyticsEvent,
  AnalyticsEventInput,
  AnalyticsReport,
  AnalyticsTrafficSlice,
  AnalyticsTrafficSummary,
  AdminRole,
  AdminUser,
  AdminUserInput,
  BusinessJob,
  BusinessJobCosts,
  BusinessJobInput,
  BusinessJobStatus,
  BusinessLandfill,
  BusinessPaymentType,
  BusinessSettings,
  BusinessWorkType,
  CareerApplication,
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
  PriceOffer,
  PriceOfferInput,
  PriceOfferMaterialType,
  PriceOfferSettings,
  PriceOfferStatus,
  PlannerAction,
  PlannerActionInput,
  PlannerActionStatus,
  PlannerActionType,
  Quote,
  QuoteInput,
  Realization,
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
  Testimonial,
  TestimonialInput,
  TestimonialStatus,
  Worker,
} from './types';
import { cleanSlovakText } from './slovak-text';

type LocalDb = {
  leads: Lead[];
  leadFiles: LeadFile[];
  auditLogs: AuditLog[];
  quotes: Quote[];
  testimonials: Testimonial[];
  reviewRequests: ReviewRequest[];
  workers: Worker[];
  adminUsers: AdminUser[];
  plannerActions: PlannerAction[];
  businessJobs: BusinessJob[];
  priceOffers: PriceOffer[];
  landfillPrices: LandfillPrice[];
  realizations: Realization[];
  roofers: Roofer[];
  rooferRegistrations: RooferRegistration[];
  careerApplications: CareerApplication[];
  siteContent: SiteContentItem[];
  analyticsEvents: AnalyticsEvent[];
  adminSettings: Record<string, string>;
};

type LeadWithFiles = Lead & { files: LeadFile[]; quotes: Quote[]; auditLogs: AuditLog[] };
type BusinessJobWithActivity = BusinessJob & { activityLogs: AuditLog[] };

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
const localDbPath = process.env.ASTANA_LOCAL_DB_PATH || path.join(process.cwd(), '.data', 'local-db.json');
const siteContentAuditId = '00000000-0000-0000-0000-000000000001';

let pool: Pool | undefined;
let schemaReady = false;

function normalizeDatabaseUrl(value?: string) {
  if (!value || value.includes('localhost') || value.includes('127.0.0.1')) return value;
  try {
    const url = new URL(value);
    const sslMode = url.searchParams.get('sslmode');
    if (!sslMode) {
      url.searchParams.set('sslmode', 'require');
    } else if (['prefer', 'require', 'verify-ca'].includes(sslMode) && !url.searchParams.has('uselibpqcompat')) {
      url.searchParams.set('uselibpqcompat', 'true');
    }
    return url.toString();
  } catch {
    const separator = value.includes('?') ? '&' : '?';
    return `${value}${separator}sslmode=require`;
  }
}

function getPool() {
  if (!databaseUrl) return undefined;
  pool ??= new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
  });
  return pool;
}

function now() {
  return new Date().toISOString();
}

function dateOnly(value: unknown) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function toLead(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id),
    submissionId: row.submission_id ? String(row.submission_id) : undefined,
    submissionHash: row.submission_hash ? String(row.submission_hash) : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    status: String(row.status) as LeadStatus,
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

async function cleanupLegacyData(db: Pool) {
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
  await db.query(`
    UPDATE leads
    SET deleted_at = COALESCE(deleted_at, now()), updated_at = now()
    WHERE deleted_at IS NULL AND (
      full_name ILIKE '%test%' OR full_name = 'debilko' OR email IN ('test@example.com', 'success@example.com')
      OR (email = 'astana@astana.sk' AND full_name <> 'ASTANA admin')
    )
  `);
  await db.query(`
    UPDATE business_jobs
    SET deleted_at = COALESCE(deleted_at, now()), updated_at = now()
    WHERE deleted_at IS NULL AND (
      customer_name ILIKE '%test%' OR customer_name = 'debilko' OR customer_email IN ('test@example.com', 'success@example.com')
      OR (customer_email = 'astana@astana.sk' AND customer_name <> 'ASTANA admin')
    )
  `);
  await db.query(`
    UPDATE price_offers
    SET deleted_at = COALESCE(deleted_at, now())
    WHERE deleted_at IS NULL AND (
      contact_person ILIKE '%test%' OR contact_person = 'debilko' OR email IN ('test@example.com', 'success@example.com')
      OR (email = 'astana@astana.sk' AND contact_person <> 'ASTANA admin')
    )
  `);
}

async function ensureSchema() {
  if (schemaReady) return;
  const db = getPool();
  if (!db) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required in production.');
    }
    await readLocalDb();
    schemaReady = true;
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id uuid PRIMARY KEY,
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
      submission_id uuid,
      submission_hash text
    );

    ALTER TABLE leads ADD COLUMN IF NOT EXISTS submission_id uuid;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS submission_hash text;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS wants_roofer_recommendation boolean NOT NULL DEFAULT false;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS selected_roofer_id text NOT NULL DEFAULT '';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferovany_kontakt text NOT NULL DEFAULT 'Zavolajte mi';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_email text NOT NULL DEFAULT '';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action text NOT NULL DEFAULT '';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_date date;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_note text NOT NULL DEFAULT '';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_notif_odoslana boolean NOT NULL DEFAULT false;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

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

    ${leadUploadSchemaSql}

    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY,
      entity_type text NOT NULL,
      entity_id uuid NOT NULL,
      action text NOT NULL,
      actor_email text NOT NULL,
      changes jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

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
      approved_by text
    );

    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS customer_email text;
    ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS consent_publication boolean NOT NULL DEFAULT false;
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
      created_by text NOT NULL
    );

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
      profit numeric(12,2) NOT NULL DEFAULT 0
    );

    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS in_verification boolean NOT NULL DEFAULT true;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS card_view_count integer NOT NULL DEFAULT 0;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS contact_reveal_count integer NOT NULL DEFAULT 0;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS quote_use_click_count integer NOT NULL DEFAULT 0;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS failed_jobs_count integer NOT NULL DEFAULT 0;
    ALTER TABLE roofers ADD COLUMN IF NOT EXISTS internal_score numeric(5,2) NOT NULL DEFAULT 0;

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
      cv_size_bytes integer NOT NULL DEFAULT 0
    );
    ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS has_asbestos_experience boolean NOT NULL DEFAULT false;
    ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS asbestos_experience text NOT NULL DEFAULT '';
    CREATE INDEX IF NOT EXISTS career_applications_created_idx ON career_applications (created_at DESC);

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
      two_factor_backup_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_secret text NOT NULL DEFAULT '';
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_backup_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb;

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
      note text NOT NULL DEFAULT ''
    );
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS customer_phone text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS customer_email text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS material_type text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS object_type text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS term text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS lead_source text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS preferovany_kontakt text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS offer_confirmed_date date;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS ruvz_submitted_date date;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS ouzp_submitted_date date;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS ruvz_approved_date date;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS ouzp_approved_date date;
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS demolition_finished_date date;

    CREATE TABLE IF NOT EXISTS price_offers (
      id uuid PRIMARY KEY,
      number text NOT NULL UNIQUE,
      job_id uuid REFERENCES business_jobs(id) ON DELETE SET NULL,
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
      material_price_without_vat numeric(12,2) NOT NULL DEFAULT 0,
      total_without_vat numeric(12,2) NOT NULL DEFAULT 0,
      total_with_vat numeric(12,2) NOT NULL DEFAULT 0,
      offer_note text NOT NULL DEFAULT '',
      internal_note text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'PRIPRAVENA',
      sent_at timestamptz,
      accepted_at timestamptz,
      source_inquiry text NOT NULL DEFAULT ''
    );
    ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

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
    CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_uq ON leads (submission_id);
    CREATE INDEX IF NOT EXISTS leads_owner_followup_idx ON leads (owner_email, followup_date, created_at DESC);
    CREATE INDEX IF NOT EXISTS lead_files_lead_id_idx ON lead_files (lead_id);
    CREATE INDEX IF NOT EXISTS audit_logs_entity_created_at_idx ON audit_logs (entity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_logs_action_created_at_idx ON audit_logs (action, created_at DESC);
    CREATE INDEX IF NOT EXISTS quotes_lead_id_idx ON quotes (lead_id);
    CREATE INDEX IF NOT EXISTS testimonials_status_created_at_idx ON testimonials (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS review_requests_status_created_at_idx ON review_requests (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS realizations_status_created_at_idx ON realizations (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS roofers_active_region_idx ON roofers (active, region, updated_at DESC);
    CREATE INDEX IF NOT EXISTS roofer_events_roofer_created_idx ON roofer_events (roofer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS roofer_registrations_status_created_idx ON roofer_registrations (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS analytics_events_created_type_idx ON analytics_events (created_at DESC, event_type);
    CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON analytics_events (session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS business_jobs_date_status_idx ON business_jobs (demolition_date DESC, status);
    CREATE UNIQUE INDEX IF NOT EXISTS business_jobs_lead_id_uq ON business_jobs (lead_id);
    CREATE INDEX IF NOT EXISTS business_job_workers_worker_idx ON business_job_workers (worker_id);
    CREATE INDEX IF NOT EXISTS price_offers_created_status_idx ON price_offers (created_at DESC, status);
    CREATE INDEX IF NOT EXISTS price_offers_job_idx ON price_offers (job_id);
    CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (lower(email));
    CREATE INDEX IF NOT EXISTS planner_actions_date_idx ON planner_actions (datum, stav);
  `);
  await cleanupLegacyData(db);
  await seedDefaultWorkers();
  await seedDefaultAdminUser();
  schemaReady = true;
}

function toPriceOffer(row: Record<string, unknown>): PriceOffer {
  return {
    id: String(row.id),
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
    materialPriceWithoutVat: Number(row.material_price_without_vat ?? row.materialPriceWithoutVat ?? 0),
    totalWithoutVat: Number(row.total_without_vat ?? row.totalWithoutVat ?? 0),
    totalWithVat: Number(row.total_with_vat ?? row.totalWithVat ?? 0),
    offerNote: String(row.offer_note ?? row.offerNote ?? ''),
    internalNote: String(row.internal_note ?? row.internalNote ?? ''),
    status: String(row.status ?? 'PRIPRAVENA') as PriceOfferStatus,
    sentAt: row.sent_at || row.sentAt ? new Date(String(row.sent_at ?? row.sentAt)).toISOString() : undefined,
    acceptedAt: row.accepted_at || row.acceptedAt ? new Date(String(row.accepted_at ?? row.acceptedAt)).toISOString() : undefined,
    sourceInquiry: String(row.source_inquiry ?? row.sourceInquiry ?? ''),
  };
}

function normalizeLocalDb(data: Partial<LocalDb>): LocalDb {
  return {
    leads: data.leads ?? [],
    leadFiles: data.leadFiles ?? [],
    auditLogs: data.auditLogs ?? [],
    quotes: data.quotes ?? [],
    testimonials: data.testimonials ?? [],
    reviewRequests: data.reviewRequests ?? [],
    workers: data.workers ?? [],
    adminUsers: data.adminUsers ?? [],
    plannerActions: data.plannerActions ?? [],
    businessJobs: data.businessJobs ?? [],
    priceOffers: data.priceOffers ?? [],
    landfillPrices: data.landfillPrices ?? [],
    realizations: data.realizations ?? [],
    roofers: data.roofers ?? [],
    rooferRegistrations: data.rooferRegistrations ?? [],
    careerApplications: data.careerApplications ?? [],
    siteContent: data.siteContent ?? [],
    analyticsEvents: data.analyticsEvents ?? [],
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
  const storageKey = String(row.cv_storage_key ?? row.cvStorageKey ?? '');
  const storageDriver = String(row.cv_storage_driver ?? row.cvStorageDriver ?? '');
  const cv = storageKey && ['vercel_blob', 's3', 'local'].includes(storageDriver)
    ? {
        originalName: String(row.cv_original_name ?? row.cvOriginalName ?? 'životopis'),
        storageDriver: storageDriver as CareerApplicationCv['storageDriver'],
        storageKey,
        mimeType: String(row.cv_mime_type ?? row.cvMimeType ?? 'application/octet-stream'),
        sizeBytes: Number(row.cv_size_bytes ?? row.cvSizeBytes ?? 0),
      }
    : undefined;
  return {
    id: String(row.id),
    submissionId: String(row.submission_id ?? row.submissionId ?? ''),
    createdAt: new Date(String(row.created_at ?? row.createdAt ?? now())).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.updatedAt ?? now())).toISOString(),
    status: String(row.status ?? 'new') as CareerApplication['status'],
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
    twoFactorBackupCodeHashes: backupHashes,
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
  await mkdir(path.dirname(localDbPath), { recursive: true });
  try {
    return normalizeLocalDb(JSON.parse(await readFile(localDbPath, 'utf8')) as Partial<LocalDb>);
  } catch {
    const empty: LocalDb = {
      leads: [],
      leadFiles: [],
      auditLogs: [],
      quotes: [],
      testimonials: [],
      reviewRequests: [],
      workers: [],
      adminUsers: [],
      plannerActions: [],
      businessJobs: [],
      priceOffers: [],
      landfillPrices: [],
      realizations: [],
      roofers: [],
      rooferRegistrations: [],
      careerApplications: [],
      siteContent: [],
      analyticsEvents: [],
      adminSettings: {},
    };
    await writeFile(localDbPath, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
}

async function writeLocalDb(data: LocalDb) {
  await mkdir(path.dirname(localDbPath), { recursive: true });
  await writeFile(localDbPath, JSON.stringify(data, null, 2), 'utf8');
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

/** A caller reused one browser submission id with different contents. */
export class LeadSubmissionConflictError extends Error {
  constructor() {
    super('Tento formulár bol už odoslaný s inými údajmi. Obnovte stránku a odošlite dopyt znova.');
    this.name = 'LeadSubmissionConflictError';
  }
}

export type LeadSubmissionResult = {
  lead: Lead;
  duplicate: boolean;
  businessJobId?: string;
  files: LeadFile[];
};

type LeadUploadDraftReservation = {
  storageKey: string;
  status: 'uploading' | 'uploaded';
};

type LeadUploadAttachment = {
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
};

function requireLeadUploadDatabase() {
  const db = getPool();
  if (!db) throw new Error('Prednahrávanie fotiek vyžaduje databázu PostgreSQL.');
  return db;
}

export async function consumeLeadUploadRateLimit(bucketKey: string, windowStartedAt: Date, maxHits: number) {
  await ensureSchema();
  const db = requireLeadUploadDatabase();
  const { rows } = await db.query(
    `INSERT INTO api_rate_limit_buckets (bucket_key, window_started_at, hit_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (bucket_key, window_started_at) DO UPDATE
       SET hit_count = api_rate_limit_buckets.hit_count + 1
     RETURNING hit_count`,
    [bucketKey, windowStartedAt],
  );
  await db.query(`DELETE FROM api_rate_limit_buckets WHERE window_started_at < now() - interval '20 minutes'`);
  return Number(rows[0]?.hit_count ?? maxHits + 1) > maxHits;
}

export async function reserveLeadUploadDraft(input: {
  submissionId: string;
  clientFileId: string;
  extension: string;
  contentType: string;
  sizeBytes: number;
}): Promise<LeadUploadDraftReservation> {
  await ensureSchema();
  const db = requireLeadUploadDatabase();
  return reserveLeadUploadDraftWithPool(db, input);
}

/** @internal Exported so concurrency can be tested against an isolated database adapter. */
export async function reserveLeadUploadDraftWithPool(
  db: Pick<Pool, 'connect'>,
  input: {
    submissionId: string;
    clientFileId: string;
    extension: string;
    contentType: string;
    sizeBytes: number;
  },
): Promise<LeadUploadDraftReservation> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.submissionId]);
    const existing = await client.query(
      `SELECT storage_key, content_type, size_bytes, status
       FROM lead_upload_drafts
       WHERE submission_id = $1 AND client_file_id = $2
       FOR UPDATE`,
      [input.submissionId, input.clientFileId],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      assertReusableLeadUploadDraft({
        contentType: String(row.content_type),
        sizeBytes: Number(row.size_bytes),
        status: String(row.status),
      }, input);
      await client.query(
        `UPDATE lead_upload_drafts SET updated_at = now()
         WHERE submission_id = $1 AND client_file_id = $2`,
        [input.submissionId, input.clientFileId],
      );
      await client.query('COMMIT');
      return { storageKey: String(row.storage_key), status: String(row.status) as LeadUploadDraftReservation['status'] };
    }

    const count = await client.query(
      `SELECT COUNT(*)::int AS count FROM lead_upload_drafts
       WHERE submission_id = $1 AND status IN ('uploading', 'uploaded', 'attached')`,
      [input.submissionId],
    );
    assertLeadUploadCapacity(Number(count.rows[0]?.count ?? 0));

    const storageKey = `lead-drafts/${input.submissionId}/${randomUUID()}${input.extension}`;
    await client.query(
      `INSERT INTO lead_upload_drafts (
         storage_key, submission_id, client_file_id, content_type, size_bytes, status
       ) VALUES ($1,$2,$3,$4,$5,'uploading')`,
      [storageKey, input.submissionId, input.clientFileId, input.contentType, input.sizeBytes],
    );
    await client.query('COMMIT');
    return { storageKey, status: 'uploading' };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmLeadUploadDraft(input: {
  submissionId: string;
  clientFileId: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  blobEtag: string;
}) {
  await ensureSchema();
  const db = requireLeadUploadDatabase();
  const { rows } = await db.query(
    `UPDATE lead_upload_drafts SET
       status = 'uploaded', blob_etag = $6,
       uploaded_at = COALESCE(uploaded_at, now()), updated_at = now()
     WHERE submission_id = $1 AND client_file_id = $2 AND storage_key = $3
       AND content_type = $4 AND size_bytes = $5 AND status IN ('uploading', 'uploaded')
     RETURNING storage_key`,
    [input.submissionId, input.clientFileId, input.storageKey, input.contentType, input.sizeBytes, input.blobEtag],
  );
  if (!rows[0]) throw new Error('Rezervácia fotky sa nenašla alebo už bola uzavretá.');
  return true;
}

/** @internal Exported for deterministic state-machine tests; callers use attachLeadUploadDrafts/createLeadSubmission. */
export async function attachLeadUploadDraftsInTransaction(
  client: PoolClient,
  leadId: string,
  submissionId: string,
  files: LeadUploadAttachment[],
) {
  if (!files.length) return [];
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [submissionId]);
  const keys = files.map((file) => file.storageKey);
  const drafts = await client.query(
    `SELECT storage_key, submission_id, content_type, size_bytes, status, lead_id
     FROM lead_upload_drafts WHERE storage_key = ANY($1::text[])
     ORDER BY storage_key FOR UPDATE`,
    [keys],
  );
  if (drafts.rows.length !== keys.length) throw new Error('Niektorá nahraná fotka nemá platnú rezerváciu.');

  const byKey = new Map(files.map((file) => [file.storageKey, file]));
  const created: LeadFile[] = [];
  let newlyAttached = 0;
  for (const draft of drafts.rows) {
    const file = byKey.get(String(draft.storage_key));
    if (!file) {
      throw new Error('Niektorú fotografiu sa nepodarilo bezpečne priradiť k dopytu.');
    }
    assertAttachableLeadUploadDraft({
      submissionId: String(draft.submission_id),
      contentType: String(draft.content_type),
      sizeBytes: Number(draft.size_bytes),
      status: String(draft.status),
      leadId: draft.lead_id ? String(draft.lead_id) : null,
    }, {
      submissionId,
      leadId,
      contentType: file.mimeType,
      sizeBytes: file.sizeBytes,
    });
    if (String(draft.status) === 'attached') {
      const existing = await client.query(
        `SELECT * FROM lead_files WHERE lead_id = $1 AND storage_driver = 'vercel_blob' AND storage_key = $2 LIMIT 1`,
        [leadId, file.storageKey],
      );
      if (!existing.rows[0]) throw new Error('Pripojená fotka nemá databázový záznam.');
      created.push(toLeadFile(existing.rows[0]));
      continue;
    }

    const row: LeadFile = {
      id: randomUUID(),
      leadId,
      originalName: file.originalName,
      storageDriver: 'vercel_blob',
      storageKey: file.storageKey,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: now(),
    };
    await client.query(
      `INSERT INTO lead_files (id, lead_id, original_name, storage_driver, storage_key, mime_type, size_bytes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, row.leadId, row.originalName, row.storageDriver, row.storageKey, row.mimeType, row.sizeBytes, row.createdAt],
    );
    const updatedDraft = await client.query(
      `UPDATE lead_upload_drafts SET status = 'attached', lead_id = $2,
         attached_at = now(), updated_at = now()
       WHERE storage_key = $1 AND submission_id = $3 AND status = 'uploaded'`,
      [row.storageKey, leadId, submissionId],
    );
    if (updatedDraft.rowCount !== 1) {
      throw new Error('Fotografiu sa nepodarilo atomicky priradiť k dopytu.');
    }
    newlyAttached += 1;
    created.push(row);
  }
  if (newlyAttached > 0) {
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'lead',$2,'files_uploaded','system',$3::jsonb,now())`,
      [randomUUID(), leadId, JSON.stringify({ count: newlyAttached })],
    );
  }
  return created;
}

export async function attachLeadUploadDrafts(
  leadId: string,
  submissionId: string,
  files: LeadUploadAttachment[],
) {
  if (!files.length) return [];
  await ensureSchema();
  const db = requireLeadUploadDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const created = await attachLeadUploadDraftsInTransaction(client, leadId, submissionId, files);
    await client.query('COMMIT');
    return created;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function claimExpiredLeadUploadDrafts(limit = 50) {
  await ensureSchema();
  const db = requireLeadUploadDatabase();
  const claimId = randomUUID();
  const { rows } = await db.query(
    `WITH candidates AS (
       SELECT draft.storage_key FROM lead_upload_drafts AS draft
       WHERE ((draft.status = 'deleting' AND (draft.deletion_claimed_until IS NULL OR draft.deletion_claimed_until < now()))
          OR (draft.status IN ('uploading', 'uploaded', 'superseded') AND draft.updated_at < now() - interval '24 hours'))
         AND draft.lead_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM lead_files WHERE storage_key = draft.storage_key)
       ORDER BY draft.updated_at ASC LIMIT $1 FOR UPDATE OF draft SKIP LOCKED
     )
     UPDATE lead_upload_drafts AS draft SET
       status = 'deleting', deletion_claim_id = $2,
       deletion_claimed_until = now() + interval '15 minutes', updated_at = now()
     FROM candidates WHERE draft.storage_key = candidates.storage_key
     RETURNING draft.storage_key, draft.blob_etag, draft.deletion_claim_id`,
    [Math.max(1, Math.min(200, Math.floor(limit))), claimId],
  );
  return rows.map((row) => ({
    storageKey: String(row.storage_key),
    blobEtag: String(row.blob_etag || ''),
    claimId: String(row.deletion_claim_id),
  }));
}

export async function mayDeleteClaimedLeadUploadDraft(storageKey: string, claimId: string) {
  await ensureSchema();
  const db = requireLeadUploadDatabase();
  const { rows } = await db.query(
    `SELECT 1 FROM lead_upload_drafts AS draft
     WHERE draft.storage_key = $1 AND draft.status = 'deleting'
       AND draft.deletion_claim_id = $2 AND draft.deletion_claimed_until > now()
       AND draft.lead_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM lead_files WHERE storage_key = draft.storage_key)`,
    [storageKey, claimId],
  );
  return Boolean(rows[0]);
}

export async function completeLeadUploadDraftDeletion(storageKey: string, claimId: string) {
  await ensureSchema();
  const db = requireLeadUploadDatabase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE lead_upload_drafts AS draft SET
         status = 'deleted', deletion_claim_id = NULL,
         deletion_claimed_until = NULL, updated_at = now()
       WHERE draft.storage_key = $1 AND draft.status = 'deleting' AND draft.deletion_claim_id = $2
         AND draft.lead_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM lead_files WHERE storage_key = draft.storage_key)
       RETURNING draft.submission_id`,
      [storageKey, claimId],
    );
    if (!rows[0]) {
      await client.query('COMMIT');
      return false;
    }
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'system',$2,'lead_upload_retention_deleted','cron:lead-upload-retention',$3::jsonb,now())`,
      [randomUUID(), rows[0].submission_id, JSON.stringify({ storageKeyHash: createHash('sha256').update(storageKey).digest('hex') })],
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

/**
 * Creates the CRM lead exactly once for a browser submission id.  A repeat of
 * the same request returns the original lead instead of creating a second one.
 */
export async function createLeadSubmission(
  input: LeadInput & { submissionId: string; submissionHash: string },
  uploadAttachments: LeadUploadAttachment[] = [],
): Promise<LeadSubmissionResult> {
  await ensureSchema();
  const timestamp = now();
  const settings = await getBusinessSettings();
  const lead: Lead = {
    ...input,
    id: randomUUID(),
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
    const existing = local.leads.find((item) => item.submissionId === input.submissionId);
    if (existing) {
      if (existing.submissionHash !== input.submissionHash) throw new LeadSubmissionConflictError();
      return { lead: existing, duplicate: true, files: [] };
    }
    local.leads.unshift(lead);
    await writeLocalDb(local);
    await addAuditLog('lead', lead.id, 'lead_created', 'system', { status: 'novy', submissionId: input.submissionId });
    const job = await createBusinessJobFromLead(lead);
    return { lead, duplicate: false, businessJobId: job.id, files: [] };
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO leads (
        id, submission_id, submission_hash, created_at, updated_at, status, full_name, phone, email, city, district,
        object_type, material_type, area_estimate, preferovany_kontakt, roofer, term, note, gdpr, source,
        internal_note, raw_data, wants_roofer_recommendation, selected_roofer_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      ON CONFLICT (submission_id) DO NOTHING
      RETURNING *`,
      [
        lead.id, lead.submissionId, lead.submissionHash, lead.createdAt, lead.updatedAt, lead.status, lead.fullName,
        lead.phone, lead.email, lead.city, lead.district, lead.objectType, lead.materialType, lead.areaEstimate,
        lead.preferredContact, lead.roofer, lead.term, lead.note, lead.gdpr, lead.source, lead.internalNote,
        lead.rawData, lead.wantsRooferRecommendation, lead.selectedRooferId,
      ],
    );

    if (!inserted.rows[0]) {
      const existing = await client.query('SELECT * FROM leads WHERE submission_id = $1 FOR UPDATE', [input.submissionId]);
      const row = existing.rows[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error('Dopyt sa nepodarilo overiť po opakovanom odoslaní.');
      if (String(row.submission_hash ?? '') !== input.submissionHash) throw new LeadSubmissionConflictError();
      const existingJob = await client.query('SELECT id FROM business_jobs WHERE lead_id = $1 LIMIT 1', [String(row.id)]);
      const files = await attachLeadUploadDraftsInTransaction(client, String(row.id), input.submissionId, uploadAttachments);
      await client.query('COMMIT');
      return {
        lead: toLead(row),
        duplicate: true,
        businessJobId: existingJob.rows[0]?.id ? String(existingJob.rows[0].id) : undefined,
        files,
      };
    }

    const businessJobId = randomUUID();
    const demolitionDate = new Date().toISOString().slice(0, 10);
    const pricePerM2 = money(settings.defaultPricePerM2);
    const totalPrice = money(lead.areaEstimate * pricePerM2);
    await client.query(
      `INSERT INTO business_jobs (
        id, lead_id, created_at, updated_at, demolition_date, customer_name, customer_phone, customer_email, location, district,
        material_type, object_type, term, lead_source, preferovany_kontakt, m2, price_per_m2, total_price, payment_type, work_type, waste_kg, landfill, status, note
      ) VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'FAKTURA','DEMONTAZ_A_ODVOZ',0,'INA','DOPYT',$18)`,
      [
        businessJobId, lead.id, timestamp, demolitionDate, lead.fullName, lead.phone, lead.email, lead.city, lead.district,
        lead.materialType, lead.objectType, lead.term, lead.source || process.env.LEAD_SOURCE || 'likvidacia-eternitu.sk',
        lead.preferredContact, lead.areaEstimate, pricePerM2, totalPrice, lead.note,
      ],
    );
    await client.query(
      `INSERT INTO business_job_costs (job_id, fuel, suits, gloves, penetrant, landfill_cost, other_name, other_amount, total)
       VALUES ($1,0,0,0,0,0,'',0,0)`,
      [businessJobId],
    );

    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'lead',$2,'lead_created','system',$3,$4)`,
      [randomUUID(), lead.id, { status: 'novy', submissionId: input.submissionId }, timestamp],
    );
    await client.query(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
       VALUES ($1,'business_job',$2,'business_job_lead_received','system',$3,$4)`,
      [randomUUID(), businessJobId, { leadId: lead.id }, timestamp],
    );
    const files = await attachLeadUploadDraftsInTransaction(client, lead.id, input.submissionId, uploadAttachments);
    await client.query('COMMIT');
    return { lead: toLead(inserted.rows[0] as Record<string, unknown>), duplicate: false, businessJobId, files };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
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
  return value === 50 || value === 100 ? value : 25;
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

export async function getLeadQueueCounts(today = new Date().toISOString().slice(0, 10)): Promise<LeadQueueCounts> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const leads = await listLeadSummaries(false);
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
     WHERE deleted_at IS NULL`,
    [today, ['kontaktovany', 'cenova_ponuka_odoslana', 'objednane', 'v_realizacii']],
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
  const file = await getLeadFile(fileId);
  if (!file) return null;
  if (!(await getLeadWithFiles(file.leadId))) return null;
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.leadFiles = local.leadFiles.filter((item) => item.id !== fileId);
    await writeLocalDb(local);
  } else {
    await db.query('DELETE FROM lead_files WHERE id = $1', [fileId]);
  }
  await addAuditLog('lead', file.leadId, 'lead_file_deleted', actorEmail, { fileName: file.originalName, fileId });
  return file;
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

export async function addAuditLog(
  entityType: AuditLog['entityType'],
  entityId: string,
  action: string,
  actorEmail: string,
  changes: Record<string, unknown>,
) {
  await ensureSchema();
  const log: AuditLog = { id: randomUUID(), entityType, entityId, action, actorEmail, changes, createdAt: now() };
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.auditLogs.unshift(log);
    await writeLocalDb(local);
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

export async function listApprovedTestimonials(limit = 6): Promise<Testimonial[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.testimonials]
      .filter((testimonial) => testimonial.status === 'approved')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  const { rows } = await db.query('SELECT * FROM testimonials WHERE status = $1 ORDER BY created_at DESC LIMIT $2', ['approved', limit]);
  return rows.map(toTestimonial);
}

export async function createTestimonial(input: TestimonialInput, actorEmail: string): Promise<Testimonial> {
  await ensureSchema();
  const timestamp = now();
  const testimonial: Testimonial = {
    id: randomUUID(),
    customerName: input.customerName.trim(),
    location: input.location?.trim() ?? '',
    objectType: input.objectType?.trim() ?? '',
    realizationDate: input.realizationDate || '',
    rating: Math.min(5, Math.max(1, Math.round(input.rating || 5))),
    text: input.text.trim(),
    status: input.status,
    customerEmail: input.customerEmail?.trim() ?? '',
    consentPublication: Boolean(input.consentPublication),
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
    const local = await readLocalDb();
    local.testimonials.unshift(testimonial);
    await writeLocalDb(local);
    await addAuditLog('testimonial', testimonial.id, 'testimonial_created', actorEmail, { status: testimonial.status });
    return testimonial;
  }

  await db.query(
    `INSERT INTO testimonials (
      id, created_at, updated_at, status, customer_name, location, rating, text, approved_at, approved_by,
      customer_email, consent_publication, source, object_type, realization_date, internal_note, photo_url
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
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
    ],
  );
  await addAuditLog('testimonial', testimonial.id, 'testimonial_created', actorEmail, { status: testimonial.status });
  return testimonial;
}

export async function updateTestimonialStatus(id: string, status: TestimonialStatus, actorEmail: string): Promise<Testimonial | null> {
  await ensureSchema();
  const timestamp = now();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const testimonial = local.testimonials.find((item) => item.id === id);
    if (!testimonial) return null;
    const previous = testimonial.status;
    testimonial.status = status;
    testimonial.updatedAt = timestamp;
    testimonial.approvedAt = status === 'approved' ? timestamp : undefined;
    testimonial.approvedBy = status === 'approved' ? actorEmail : undefined;
    await writeLocalDb(local);
    await addAuditLog('testimonial', id, 'testimonial_status_changed', actorEmail, { previous, next: status });
    return testimonial;
  }

  const previous = await db.query('SELECT status FROM testimonials WHERE id = $1 LIMIT 1', [id]);
  const { rows } = await db.query(
    `UPDATE testimonials
      SET status = $1,
          updated_at = $2,
          approved_at = CASE WHEN $1 = 'approved' THEN $2 ELSE NULL END,
          approved_by = CASE WHEN $1 = 'approved' THEN $3 ELSE NULL END
      WHERE id = $4
      RETURNING *`,
    [status, timestamp, actorEmail, id],
  );
  if (!rows[0]) return null;
  await addAuditLog('testimonial', id, 'testimonial_status_changed', actorEmail, { previous: previous.rows[0]?.status, next: status });
  return toTestimonial(rows[0]);
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

async function seedDefaultWorkers() {
  const db = getPool();
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

async function seedDefaultAdminUser() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) return;
  const db = getPool();
  if (!db) return;
  await db.query(
    `INSERT INTO admin_users (id, email, name, role, active, password_hash)
     SELECT $1, $2, 'ASTANA', 'SUPER_ADMIN', true, ''
     WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE lower(email) = lower($2))`,
    [randomUUID(), email],
  );
  await db.query("UPDATE admin_users SET role = 'SUPER_ADMIN', active = true WHERE lower(email) = lower($1)", [email]);
}

async function ensureLocalBusinessDefaults(local: LocalDb) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail && !local.adminUsers.some((user) => user.email.toLowerCase() === adminEmail)) {
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
      createdAt: now(),
      updatedAt: now(),
    });
  }
  if (!local.workers.length) {
    local.workers = defaultWorkers.map((worker) => ({
      id: randomUUID(),
      name: worker.name,
      ratePerM2: worker.ratePerM2,
      active: true,
      createdAt: now(),
      updatedAt: now(),
    }));
  }
  await writeLocalDb(local);
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
    const local = await readLocalDb();
    await ensureLocalBusinessDefaults(local);
    return [...local.workers].filter((worker) => includeInactive || worker.active).sort((a, b) => a.name.localeCompare(b.name, 'sk'));
  }
  await seedDefaultWorkers();
  const { rows } = await db.query(`SELECT * FROM workers ${includeInactive ? '' : 'WHERE active = true'} ORDER BY name ASC`);
  return rows.map(toWorker);
}

export async function upsertWorker(input: { id?: string; name: string; ratePerM2: number; active?: boolean }): Promise<Worker> {
  await ensureSchema();
  const timestamp = now();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    await ensureLocalBusinessDefaults(local);
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

export async function listBusinessJobs(filters: { from?: string; to?: string; includeArchived?: boolean } = {}): Promise<BusinessJob[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.businessJobs]
      .filter((job) => (filters.includeArchived || !job.deletedAt) && (!filters.from || job.demolitionDate >= filters.from) && (!filters.to || job.demolitionDate <= filters.to))
      .sort((a, b) => b.demolitionDate.localeCompare(a.demolitionDate));
  }
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (!filters.includeArchived) conditions.push('deleted_at IS NULL');
  if (filters.from) {
    values.push(filters.from);
    conditions.push(`demolition_date >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    conditions.push(`demolition_date <= $${values.length}`);
  }
  const { rows } = await db.query(`SELECT * FROM business_jobs ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY demolition_date DESC, created_at DESC LIMIT 1000`, values);
  return hydrateBusinessJobs(rows);
}

export async function getBusinessJob(id: string): Promise<BusinessJob | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.businessJobs.find((job) => job.id === id && !job.deletedAt) ?? null;
  }
  const { rows } = await db.query('SELECT * FROM business_jobs WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [id]);
  if (!rows[0]) return null;
  const jobs = await hydrateBusinessJobs(rows);
  return jobs[0] ?? null;
}

export async function getBusinessJobByLeadId(leadId: string): Promise<BusinessJob | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.businessJobs.find((job) => job.leadId === leadId && !job.deletedAt) ?? null;
  }
  const { rows } = await db.query('SELECT * FROM business_jobs WHERE lead_id = $1 AND deleted_at IS NULL LIMIT 1', [leadId]);
  if (!rows[0]) return null;
  const jobs = await hydrateBusinessJobs(rows);
  return jobs[0] ?? null;
}

export async function getBusinessJobWithActivity(id: string): Promise<BusinessJobWithActivity | null> {
  const job = await getBusinessJob(id);
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

export async function deleteBusinessJob(id: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const job = local.businessJobs.find((item) => item.id === id);
    if (job) job.deletedAt = now();
    await writeLocalDb(local);
    await addAuditLog('business_job', id, 'business_job_archived', actorEmail, {});
    return;
  }
  await db.query('UPDATE business_jobs SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL', [id]);
  await addAuditLog('business_job', id, 'business_job_archived', actorEmail, {});
}

export async function destroyBusinessJob(id: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  await addAuditLog('business_job', id, 'business_job_deleted', actorEmail, {});
  if (!db) {
    const local = await readLocalDb();
    local.priceOffers = local.priceOffers.map((offer) => (offer.jobId === id ? { ...offer, jobId: undefined } : offer));
    local.plannerActions = local.plannerActions.map((action) => (action.jobId === id ? { ...action, jobId: '' } : action));
    local.businessJobs = local.businessJobs.filter((item) => item.id !== id);
    await writeLocalDb(local);
    return;
  }
  await db.query('BEGIN');
  try {
    await db.query('UPDATE price_offers SET job_id = NULL WHERE job_id = $1', [id]);
    await db.query('UPDATE planner_actions SET zakazka_id = NULL WHERE zakazka_id = $1', [id]);
    await db.query('DELETE FROM business_jobs WHERE id = $1', [id]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function addBusinessJobNote(id: string, note: string, actorEmail: string) {
  const text = note.trim();
  if (!text) return null;
  return addAuditLog('business_job', id, 'business_job_note_added', actorEmail, { note: text });
}

export async function markBusinessJobQuoteSent(
  id: string,
  actorEmail: string,
  quote: { validUntil: string; pricePerM2: number; totalPrice: number; note?: string },
) {
  await ensureSchema();
  const timestamp = now();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const job = local.businessJobs.find((item) => item.id === id);
    if (!job) return null;
    const previous = job.status;
    job.status = 'PONUKA_ODOSLANA';
    job.updatedAt = timestamp;
    await writeLocalDb(local);
    await addAuditLog('business_job', id, 'business_job_status_changed', actorEmail, { previous, next: job.status });
    await addAuditLog('business_job', id, 'business_job_quote_sent', actorEmail, quote);
    return job;
  }
  const previous = await getBusinessJob(id);
  const { rows } = await db.query('UPDATE business_jobs SET status = $1, updated_at = now() WHERE id = $2 RETURNING *', ['PONUKA_ODOSLANA', id]);
  if (!rows[0]) return null;
  if (previous?.status !== 'PONUKA_ODOSLANA') {
    await addAuditLog('business_job', id, 'business_job_status_changed', actorEmail, { previous: previous?.status, next: 'PONUKA_ODOSLANA' });
  }
  await addAuditLog('business_job', id, 'business_job_quote_sent', actorEmail, quote);
  const saved = await getBusinessJob(id);
  return saved;
}

export async function saveBusinessJob(input: BusinessJobInput, actorEmail: string, id?: string): Promise<BusinessJob> {
  await ensureSchema();
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
    leadId: input.leadId?.trim() || undefined,
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
    const local = await readLocalDb();
    const existingForLead = baseRow.leadId ? local.businessJobs.find((job) => job.leadId === baseRow.leadId && !job.deletedAt) : undefined;
    if (existingForLead && existingForLead.id !== jobId) return existingForLead;
    const previous = local.businessJobs.find((job) => job.id === jobId);
    const job = enrichBusinessJob(baseRow, jobWorkers, { ...costs, jobId });
    job.createdAt = previous?.createdAt ?? timestamp;
    local.businessJobs = [job, ...local.businessJobs.filter((item) => item.id !== jobId)];
    await writeLocalDb(local);
    await addAuditLog('business_job', jobId, id ? 'business_job_updated' : 'business_job_created', actorEmail, { status: job.status });
    if (previous?.status && previous.status !== job.status) {
      await addAuditLog('business_job', jobId, 'business_job_status_changed', actorEmail, { previous: previous.status, next: job.status });
    }
    return job;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO business_jobs (
        id, lead_id, created_at, updated_at, demolition_date, customer_name, customer_phone, customer_email, location, district,
        material_type, object_type, term, lead_source, preferovany_kontakt, m2, price_per_m2, total_price, payment_type, work_type, waste_kg, landfill, status, note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      ON CONFLICT (id) DO UPDATE SET
        lead_id = COALESCE(business_jobs.lead_id, EXCLUDED.lead_id), updated_at = $4, demolition_date = $5,
        customer_name = $6, customer_phone = $7, customer_email = $8, location = $9, district = $10,
        material_type = $11, object_type = $12, term = $13, lead_source = $14, preferovany_kontakt = $15,
        m2 = $16, price_per_m2 = $17, total_price = $18, payment_type = $19, work_type = $20,
        waste_kg = $21, landfill = $22, status = $23, note = $24`,
      [
        jobId,
        baseRow.leadId || null,
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
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await addAuditLog('business_job', jobId, id ? 'business_job_updated' : 'business_job_created', actorEmail, { status: input.status });
  if (previousJob?.status && previousJob.status !== input.status) {
    await addAuditLog('business_job', jobId, 'business_job_status_changed', actorEmail, { previous: previousJob.status, next: input.status });
  }
  const saved = await getBusinessJob(jobId);
  if (!saved) throw new Error('Zákazku sa nepodarilo uložiť.');
  return saved;
}

export async function createBusinessJobFromLead(lead: Lead): Promise<BusinessJob> {
  const existing = await getBusinessJobByLeadId(lead.id);
  if (existing) return existing;
  const settings = await getBusinessSettings();
  let job: BusinessJob;
  try {
    job = await saveBusinessJob(
      {
        leadId: lead.id,
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
  } catch (error) {
    const racedJob = await getBusinessJobByLeadId(lead.id);
    if (racedJob) return racedJob;
    throw error;
  }
  await addAuditLog('business_job', job.id, 'business_job_lead_received', 'system', { leadId: lead.id });
  return job;
}

function defaultValidUntil(days = 60) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function nextPriceOfferNumber() {
  await ensureSchema();
  const year = String(new Date().getFullYear());
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
  const materialPriceWithoutVat = money(input.areaM2 * input.pricePerM2WithoutVat);
  const documentation = input.includeDocumentation ? money(input.documentationFeeWithoutVat) : 0;
  const totalWithoutVat = money(materialPriceWithoutVat + documentation);
  const totalWithVat = money(totalWithoutVat * (1 + vatRate / 100));
  return { materialPriceWithoutVat, totalWithoutVat, totalWithVat };
}

export async function savePriceOffer(input: PriceOfferInput, actorEmail: string, id?: string): Promise<PriceOffer> {
  await ensureSchema();
  const settings = await getPriceOfferSettings();
  const timestamp = now();
  const offerId = id || randomUUID();
  const existing = id ? await getPriceOffer(id) : null;
  const totals = calculatePriceOfferTotals(input, settings.vatRate);
  const offer: PriceOffer = {
    ...input,
    id: offerId,
    number: existing?.number || (await nextPriceOfferNumber()),
    createdAt: existing?.createdAt || timestamp,
    validUntil: input.validUntil || defaultValidUntil(),
    documentationFeeWithoutVat: money(input.documentationFeeWithoutVat),
    areaM2: money(input.areaM2),
    pricePerM2WithoutVat: money(input.pricePerM2WithoutVat),
    materialPriceWithoutVat: totals.materialPriceWithoutVat,
    totalWithoutVat: totals.totalWithoutVat,
    totalWithVat: totals.totalWithVat,
    offerNote: input.offerNote?.trim() ?? '',
    internalNote: input.internalNote?.trim() ?? '',
    sourceInquiry: input.sourceInquiry?.trim() || process.env.LEAD_SOURCE || 'likvidacia-eternitu.sk',
    status: existing?.status || 'PRIPRAVENA',
    sentAt: existing?.sentAt,
    acceptedAt: existing?.acceptedAt,
  };
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.priceOffers = [offer, ...local.priceOffers.filter((item) => item.id !== offerId)];
    await writeLocalDb(local);
    await addAuditLog('business_job', offer.jobId || offer.id, id ? 'price_offer_updated' : 'price_offer_created', actorEmail, { number: offer.number });
    return offer;
  }
  await db.query(
    `INSERT INTO price_offers (
      id, number, job_id, created_at, valid_until, object_type, object_address, municipality, district,
      contact_person, phone, email, realization_term, material_type, area_m2, price_per_m2_without_vat,
      documentation_fee_without_vat, include_documentation, material_price_without_vat, total_without_vat,
      total_with_vat, offer_note, internal_note, status, sent_at, accepted_at, source_inquiry
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
    ON CONFLICT (id) DO UPDATE SET
      job_id = $3, valid_until = $5, object_type = $6, object_address = $7, municipality = $8, district = $9,
      contact_person = $10, phone = $11, email = $12, realization_term = $13, material_type = $14,
      area_m2 = $15, price_per_m2_without_vat = $16, documentation_fee_without_vat = $17,
      include_documentation = $18, material_price_without_vat = $19, total_without_vat = $20,
      total_with_vat = $21, offer_note = $22, internal_note = $23, source_inquiry = $27`,
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
    ],
  );
  await addAuditLog('business_job', offer.jobId || offer.id, id ? 'price_offer_updated' : 'price_offer_created', actorEmail, { number: offer.number });
  return offer;
}

export async function listPriceOffers(filters: { status?: PriceOfferStatus | ''; month?: string; jobId?: string; includeArchived?: boolean } = {}): Promise<PriceOffer[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.priceOffers]
      .filter((offer) => (filters.includeArchived || !offer.deletedAt) && (!filters.status || offer.status === filters.status) && (!filters.jobId || offer.jobId === filters.jobId) && (!filters.month || offer.createdAt.startsWith(filters.month)))
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
  if (filters.month) {
    values.push(`${filters.month}-01`);
    conditions.push(`created_at >= $${values.length}::date`);
    values.push(`${filters.month}-01`);
    conditions.push(`created_at < ($${values.length}::date + interval '1 month')`);
  }
  const { rows } = await db.query(`SELECT * FROM price_offers ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 1000`, values);
  return rows.map(toPriceOffer);
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
  const timestamp = now();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const offer = local.priceOffers.find((item) => item.id === id);
    if (!offer) return null;
    offer.status = status;
    if (status === 'ODOSLANA') offer.sentAt = timestamp;
    if (status === 'PRIJATA') offer.acceptedAt = timestamp;
    await writeLocalDb(local);
    await addAuditLog('business_job', offer.jobId || offer.id, 'price_offer_status_changed', actorEmail, { number: offer.number, status });
    return offer;
  }
  const { rows } = await db.query(
    `UPDATE price_offers SET status = $1,
      sent_at = CASE WHEN $1 = 'ODOSLANA' THEN $2 ELSE sent_at END,
      accepted_at = CASE WHEN $1 = 'PRIJATA' THEN $2 ELSE accepted_at END
      WHERE id = $3 RETURNING *`,
    [status, timestamp, id],
  );
  if (!rows[0]) return null;
  const offer = toPriceOffer(rows[0]);
  await addAuditLog('business_job', offer.jobId || offer.id, 'price_offer_status_changed', actorEmail, { number: offer.number, status });
  return offer;
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

export async function listPublishedRealizations(limit = 6): Promise<Realization[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.realizations]
      .filter((realization) => realization.status === 'published')
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  const { rows } = await db.query(
    'SELECT * FROM realizations WHERE status = $1 ORDER BY featured DESC, created_at DESC LIMIT $2',
    ['published', limit],
  );
  return rows.map(toRealization);
}

export async function createRealization(input: RealizationInput): Promise<Realization> {
  await ensureSchema();
  const timestamp = now();
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
  };

  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.realizations.unshift(realization);
    await writeLocalDb(local);
    await addAuditLog('realization', realization.id, 'realization_created', input.createdBy, { status: realization.status });
    return realization;
  }

  await db.query(
    `INSERT INTO realizations (
      id, created_at, updated_at, published_at, status, title, location, material_type,
      area_estimate, description, image_urls, featured, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
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
    ],
  );
  await addAuditLog('realization', realization.id, 'realization_created', input.createdBy, { status: realization.status });
  return realization;
}

export async function updateRealizationStatus(id: string, status: RealizationStatus, actorEmail: string): Promise<Realization | null> {
  await ensureSchema();
  const timestamp = now();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const realization = local.realizations.find((item) => item.id === id);
    if (!realization) return null;
    const previous = realization.status;
    realization.status = status;
    realization.updatedAt = timestamp;
    realization.publishedAt = status === 'published' ? timestamp : undefined;
    await writeLocalDb(local);
    await addAuditLog('realization', id, 'realization_status_changed', actorEmail, { previous, next: status });
    return realization;
  }

  const previous = await db.query('SELECT status FROM realizations WHERE id = $1 LIMIT 1', [id]);
  const { rows } = await db.query(
    `UPDATE realizations
      SET status = $1,
          updated_at = $2,
          published_at = CASE WHEN $1 = 'published' THEN $2 ELSE NULL END
      WHERE id = $3
      RETURNING *`,
    [status, timestamp, id],
  );
  if (!rows[0]) return null;
  await addAuditLog('realization', id, 'realization_status_changed', actorEmail, { previous: previous.rows[0]?.status, next: status });
  return toRealization(rows[0]);
}

export async function listRoofers(options: { publicOnly?: boolean; region?: string; district?: string } = {}): Promise<Roofer[]> {
  await ensureSchema();
  const db = getPool();
  const region = options.region?.trim() ?? '';
  const district = options.district?.trim() ?? '';

  if (!db) {
    const local = await readLocalDb();
    return local.roofers
      .map((roofer) => toRoofer(roofer as unknown as Record<string, unknown>))
      .filter((roofer) => (!options.publicOnly || roofer.active))
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
  if (options.publicOnly) clauses.push('active = true');
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

export async function listPublicRoofers(filters: { region?: string; district?: string } = {}) {
  return listRoofers({ ...filters, publicOnly: true });
}

export async function archiveLead(id: string, actorEmail: string, reason = '') {
  await ensureSchema();
  const db = getPool();
  const archivedAt = now();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.id === id && !item.deletedAt);
    if (!lead) return null;
    lead.deletedAt = archivedAt;
    lead.updatedAt = archivedAt;
    await writeLocalDb(local);
    await addAuditLog('lead', id, 'lead_archived', actorEmail, { deletedAt: archivedAt, reason: reason.trim().slice(0, 500) });
    return lead;
  }
  const { rows } = await db.query(
    'UPDATE leads SET deleted_at = $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL RETURNING *',
    [archivedAt, id],
  );
  if (!rows[0]) return null;
  await addAuditLog('lead', id, 'lead_archived', actorEmail, { deletedAt: archivedAt, reason: reason.trim().slice(0, 500) });
  return toLead(rows[0]);
}

export async function restoreLead(id: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.id === id && item.deletedAt);
    if (!lead) return null;
    lead.deletedAt = undefined;
    lead.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('lead', id, 'lead_restored', actorEmail, {});
    return lead;
  }
  const { rows } = await db.query(
    'UPDATE leads SET deleted_at = NULL, updated_at = now() WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
    [id],
  );
  if (!rows[0]) return null;
  await addAuditLog('lead', id, 'lead_restored', actorEmail, {});
  return toLead(rows[0]);
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
    const local = await readLocalDb();
    local.leads = local.leads.filter((item) => item.id !== id);
    local.leadFiles = local.leadFiles.filter((file) => file.leadId !== id);
    local.quotes = local.quotes.filter((quote) => quote.leadId !== id);
    local.reviewRequests = local.reviewRequests.map((request) => request.leadId === id ? { ...request, leadId: undefined } : request);
    await writeLocalDb(local);
  } else {
    await db.query('BEGIN');
    try {
      await db.query('UPDATE review_requests SET lead_id = NULL WHERE lead_id = $1', [id]);
      await db.query('DELETE FROM quotes WHERE lead_id = $1', [id]);
      await db.query('DELETE FROM lead_files WHERE lead_id = $1', [id]);
      await db.query('DELETE FROM leads WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
  await addAuditLog('lead', id, 'lead_deleted', actorEmail, {
    reason: cleanReason,
    removedFiles: lead.files.length,
    removedQuotes: lead.quotes.length,
  });
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

export async function createRooferRegistration(input: Omit<RooferRegistration, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<RooferRegistrationCreateResult> {
  const existingWrite = rooferRegistrationWrites.get(input.submissionId);
  if (existingWrite) {
    return { registration: (await existingWrite).registration, duplicate: true };
  }

  const write = (async () => {
    await ensureSchema();
    const db = getPool();
    if (!db) {
      const local = await readLocalDb();
      const existing = local.rooferRegistrations.find((item) => item.submissionId === input.submissionId);
      if (existing) {
        return { registration: toRooferRegistration(existing as unknown as Record<string, unknown>), duplicate: true };
      }
      const timestamp = now();
      const registration: RooferRegistration = {
        ...input,
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
        status: 'new',
      };
      local.rooferRegistrations.unshift(registration);
      await writeLocalDb(local);
      await addAuditLog('roofer_registration', registration.id, 'roofer_registration_created', 'public', {
        businessType: registration.businessType,
        companyName: registration.companyName,
        serviceRegions: registration.serviceRegions,
      });
      return { registration, duplicate: false };
    }

    const timestamp = now();
    const { rows } = await db.query(
      `INSERT INTO roofer_registrations (
        id, submission_id, created_at, updated_at, business_type, company_name, company_id,
        contact_person, phone, email, website, service_regions, specializations,
        other_specialization, can_build_roof_truss, accept_customer_referrals,
        consent_public_profile, privacy_consent, note, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (submission_id) DO NOTHING
      RETURNING *`,
      [
        randomUUID(),
        input.submissionId,
        timestamp,
        timestamp,
        input.businessType,
        input.companyName,
        input.companyId,
        input.contactPerson,
        input.phone,
        input.email,
        input.website,
        JSON.stringify(input.serviceRegions),
        JSON.stringify(input.specializations),
        input.otherSpecialization,
        input.canBuildRoofTruss,
        input.acceptCustomerReferrals,
        input.consentPublicProfile,
        input.privacyConsent,
        input.note,
        'new',
      ],
    );
    if (rows[0]) {
      const registration = toRooferRegistration(rows[0]);
      await addAuditLog('roofer_registration', registration.id, 'roofer_registration_created', 'public', {
        businessType: registration.businessType,
        companyName: registration.companyName,
        serviceRegions: registration.serviceRegions,
      });
      return { registration, duplicate: false };
    }
    const duplicate = await db.query('SELECT * FROM roofer_registrations WHERE submission_id = $1 LIMIT 1', [input.submissionId]);
    if (!duplicate.rows[0]) throw new Error('Roofer registration was not persisted.');
    return { registration: toRooferRegistration(duplicate.rows[0]), duplicate: true };
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

export async function listCareerApplications(): Promise<CareerApplication[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.careerApplications
      .map((application) => toCareerApplication(application as unknown as Record<string, unknown>))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { rows } = await db.query('SELECT * FROM career_applications ORDER BY created_at DESC LIMIT 300');
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

export async function createCareerApplication(
  input: Omit<CareerApplication, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'cv'>,
): Promise<CareerApplicationCreateResult> {
  const existingWrite = careerApplicationWrites.get(input.submissionId);
  if (existingWrite) return { application: (await existingWrite).application, duplicate: true };

  const write = (async () => {
    await ensureSchema();
    const db = getPool();
    if (!db) {
      const local = await readLocalDb();
      const existing = local.careerApplications.find((item) => item.submissionId === input.submissionId);
      if (existing) return { application: toCareerApplication(existing as unknown as Record<string, unknown>), duplicate: true };
      const timestamp = now();
      const application: CareerApplication = { ...input, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp, status: 'new' };
      local.careerApplications.unshift(application);
      await writeLocalDb(local);
      await addAuditLog('career_application', application.id, 'career_application_created', 'public', { cooperationType: application.cooperationType });
      return { application, duplicate: false };
    }

    const timestamp = now();
    const { rows } = await db.query(
      `INSERT INTO career_applications (
        id, submission_id, created_at, updated_at, status, full_name, phone, email, city, cooperation_type,
        work_regions, has_trade_license, work_at_heights, has_asbestos_experience, asbestos_experience, experience, note, privacy_consent
      ) VALUES ($1,$2,$3,$4,'new',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (submission_id) DO NOTHING RETURNING *`,
      [randomUUID(), input.submissionId, timestamp, timestamp, input.fullName, input.phone, input.email, input.city, input.cooperationType,
        input.workRegions, input.hasTradeLicense, input.workAtHeights, input.hasAsbestosExperience, input.asbestosExperience,
        input.experience, input.note, input.privacyConsent],
    );
    if (rows[0]) {
      const application = toCareerApplication(rows[0]);
      await addAuditLog('career_application', application.id, 'career_application_created', 'public', { cooperationType: application.cooperationType });
      return { application, duplicate: false };
    }
    const duplicate = await db.query('SELECT * FROM career_applications WHERE submission_id = $1 LIMIT 1', [input.submissionId]);
    if (!duplicate.rows[0]) throw new Error('Career application was not persisted.');
    return { application: toCareerApplication(duplicate.rows[0]), duplicate: true };
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
  if (!db) {
    const local = await readLocalDb();
    const application = local.careerApplications.find((item) => item.id === id);
    if (!application) return null;
    application.cv = cv;
    application.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('career_application', id, 'career_cv_uploaded', 'public', { sizeBytes: cv.sizeBytes });
    return application;
  }
  const { rows } = await db.query(
    `UPDATE career_applications SET cv_original_name=$1, cv_storage_driver=$2, cv_storage_key=$3, cv_mime_type=$4, cv_size_bytes=$5, updated_at=now()
     WHERE id=$6 RETURNING *`,
    [cv.originalName, cv.storageDriver, cv.storageKey, cv.mimeType, cv.sizeBytes, id],
  );
  if (!rows[0]) return null;
  await addAuditLog('career_application', id, 'career_cv_uploaded', 'public', { sizeBytes: cv.sizeBytes });
  return toCareerApplication(rows[0]);
}

export async function listMatchingRoofers(lead: Pick<Lead, 'city' | 'district'>, limit = 5) {
  const district = lead.district?.trim() || '';
  const city = lead.city?.trim() || '';
  const all = await listPublicRoofers();
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

export async function createRoofer(input: RooferInput, actorEmail: string): Promise<Roofer> {
  await ensureSchema();
  const timestamp = now();
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
    await addAuditLog('roofer', roofer.id, 'roofer_created', actorEmail, { active: roofer.active, verifiedPartner: roofer.verifiedPartner });
    return roofer;
  }

  await db.query(
    `INSERT INTO roofers (
      id, created_at, updated_at, name, ico, contact_person, phone, email, web, region, districts,
      specialization, public_note, internal_note, active, verified_partner, in_verification, preferred_partner, rating,
      review_count, complaints_count, card_view_count, contact_reveal_count, quote_use_click_count,
      referral_count, recommended_jobs_count, confirmed_jobs_count, failed_jobs_count, internal_score,
      total_m2, revenue_without_vat, profit
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)`,
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
  await addAuditLog('roofer', roofer.id, 'roofer_created', actorEmail, { active: roofer.active, verifiedPartner: roofer.verifiedPartner });
  return roofer;
}

export async function updateRooferFlags(
  id: string,
  input: Pick<RooferInput, 'active' | 'verifiedPartner' | 'inVerification' | 'preferredPartner'>,
  actorEmail: string,
): Promise<Roofer | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const roofer = local.roofers.find((item) => item.id === id);
    if (!roofer) return null;
    const previous = { active: roofer.active, verifiedPartner: roofer.verifiedPartner, inVerification: roofer.inVerification, preferredPartner: roofer.preferredPartner };
    roofer.active = Boolean(input.active);
    roofer.verifiedPartner = Boolean(input.verifiedPartner);
    roofer.inVerification = Boolean(input.inVerification);
    roofer.preferredPartner = Boolean(input.preferredPartner);
    roofer.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('roofer', id, 'roofer_flags_changed', actorEmail, { previous, next: input });
    return roofer;
  }
  const previous = await getRoofer(id);
  const { rows } = await db.query(
    `UPDATE roofers
     SET active = $1, verified_partner = $2, in_verification = $3, preferred_partner = $4, updated_at = now()
     WHERE id = $5
     RETURNING *`,
    [Boolean(input.active), Boolean(input.verifiedPartner), Boolean(input.inVerification), Boolean(input.preferredPartner), id],
  );
  if (!rows[0]) return null;
  await addAuditLog('roofer', id, 'roofer_flags_changed', actorEmail, { previous, next: input });
  return toRoofer(rows[0]);
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
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.siteContent].sort((a, b) => a.key.localeCompare(b.key));
  }
  const { rows } = await db.query('SELECT * FROM site_content ORDER BY key ASC');
  return rows.map(toSiteContent);
}

export async function getSiteContentMap(
  defaults: Record<string, string> = {},
  options?: { versionKey?: string; version?: string },
) {
  const items = await listSiteContent();
  const stored = items.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  if (options?.versionKey && options.version && stored[options.versionKey] !== options.version) {
    await upsertSiteContentValues({ ...defaults, [options.versionKey]: options.version }, 'system-content-migration');
    return { ...defaults };
  }

  return items.reduce<Record<string, string>>(
    (acc, item) => {
      acc[item.key] = item.value;
      return acc;
    },
    { ...defaults },
  );
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
    const local = await readLocalDb();
    await ensureLocalBusinessDefaults(local);
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
    const local = await readLocalDb();
    await ensureLocalBusinessDefaults(local);
    const user = local.adminUsers.find((item) => item.email.toLowerCase() === normalized);
    return user ? toAdminUser(user as unknown as Record<string, unknown>) : null;
  }
  const { rows } = await db.query('SELECT * FROM admin_users WHERE lower(email) = lower($1) LIMIT 1', [normalized]);
  return rows[0] ? toAdminUser(rows[0]) : null;
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
    twoFactorBackupCodeHashes: input.twoFactorBackupCodeHashes ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const db = getPool();
  if (!db) {
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
        twoFactorBackupCodeHashes: input.twoFactorBackupCodeHashes ?? existing.twoFactorBackupCodeHashes ?? [],
        updatedAt: timestamp,
      };
      await writeLocalDb(local);
      await addAuditLog('admin_user', local.adminUsers[existingIndex].id, 'admin_user_updated', actorEmail, { email: user.email, role: user.role });
      return local.adminUsers[existingIndex];
    }
    local.adminUsers.push(user);
    await writeLocalDb(local);
    await addAuditLog('admin_user', user.id, 'admin_user_created', actorEmail, { email: user.email, role: user.role });
    return user;
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

export async function setAdminUserActive(id: string, active: boolean, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const user = local.adminUsers.find((item) => item.id === id);
    if (!user) return null;
    user.active = active;
    user.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('admin_user', id, 'admin_user_active_changed', actorEmail, { active });
    return user;
  }
  const { rows } = await db.query('UPDATE admin_users SET active = $1, updated_at = now() WHERE id = $2 RETURNING *', [active, id]);
  if (!rows[0]) return null;
  await addAuditLog('admin_user', id, 'admin_user_active_changed', actorEmail, { active });
  return toAdminUser(rows[0]);
}

export async function setAdminUserTwoFactorSecret(email: string, secret: string, actorEmail: string) {
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const user = local.adminUsers.find((item) => item.email.toLowerCase() === normalized);
    if (!user) return null;
    user.twoFactorSecret = secret;
    user.twoFactorEnabled = false;
    user.twoFactorBackupCodeHashes = [];
    user.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('admin_user', user.id, 'admin_user_2fa_secret_created', actorEmail, { email: user.email });
    return user;
  }
  const { rows } = await db.query(
    `UPDATE admin_users
     SET two_factor_secret = $1, two_factor_enabled = false, two_factor_backup_code_hashes = '[]'::jsonb, updated_at = now()
     WHERE lower(email) = lower($2)
     RETURNING *`,
    [secret, normalized],
  );
  if (!rows[0]) return null;
  const user = toAdminUser(rows[0]);
  await addAuditLog('admin_user', user.id, 'admin_user_2fa_secret_created', actorEmail, { email: user.email });
  return user;
}

export async function enableAdminUserTwoFactor(email: string, backupCodeHashes: string[], actorEmail: string) {
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const user = local.adminUsers.find((item) => item.email.toLowerCase() === normalized);
    if (!user) return null;
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodeHashes = backupCodeHashes;
    user.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('admin_user', user.id, 'admin_user_2fa_enabled', actorEmail, { email: user.email });
    return user;
  }
  const { rows } = await db.query(
    `UPDATE admin_users
     SET two_factor_enabled = true, two_factor_backup_code_hashes = $1::jsonb, updated_at = now()
     WHERE lower(email) = lower($2)
     RETURNING *`,
    [JSON.stringify(backupCodeHashes), normalized],
  );
  if (!rows[0]) return null;
  const user = toAdminUser(rows[0]);
  await addAuditLog('admin_user', user.id, 'admin_user_2fa_enabled', actorEmail, { email: user.email });
  return user;
}

export async function consumeAdminUserBackupCode(email: string, remainingBackupCodeHashes: string[], actorEmail: string) {
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const user = local.adminUsers.find((item) => item.email.toLowerCase() === normalized);
    if (!user) return null;
    user.twoFactorBackupCodeHashes = remainingBackupCodeHashes;
    user.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('admin_user', user.id, 'admin_user_2fa_backup_code_used', actorEmail, { email: user.email });
    return user;
  }
  const { rows } = await db.query(
    `UPDATE admin_users
     SET two_factor_backup_code_hashes = $1::jsonb, updated_at = now()
     WHERE lower(email) = lower($2)
     RETURNING *`,
    [JSON.stringify(remainingBackupCodeHashes), normalized],
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
    const local = await readLocalDb();
    const user = local.adminUsers.find((item) => item.id === id);
    if (!user) return null;
    user.twoFactorSecret = '';
    user.twoFactorEnabled = false;
    user.twoFactorBackupCodeHashes = [];
    user.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('admin_user', id, 'admin_user_2fa_reset', actorEmail, { email: user.email });
    return user;
  }
  const { rows } = await db.query(
    `UPDATE admin_users
     SET two_factor_secret = '', two_factor_enabled = false, two_factor_backup_code_hashes = '[]'::jsonb, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  if (!rows[0]) return null;
  const user = toAdminUser(rows[0]);
  await addAuditLog('admin_user', id, 'admin_user_2fa_reset', actorEmail, { email: user.email });
  return user;
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
    const local = await readLocalDb();
    local.adminSettings[normalizedKey] = value;
    await writeLocalDb(local);
    await addAuditLog('site_content', siteContentAuditId, 'admin_setting_updated', actorEmail, { key: normalizedKey });
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
  return new Date(value).toISOString().slice(0, 10);
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
  const event: AnalyticsEvent = {
    id: randomUUID(),
    createdAt: now(),
    sessionId: clampText(input.sessionId, 80),
    eventType: input.eventType,
    path: clampText(input.path || '/', 300),
    referrer: clampText(input.referrer, 500),
    device: input.device || 'desktop',
    viewportWidth: input.viewportWidth ? Math.max(0, Math.round(Number(input.viewportWidth))) : undefined,
    utmSource: clampText(input.utmSource, 120),
    utmMedium: clampText(input.utmMedium, 120),
    utmCampaign: clampText(input.utmCampaign, 160),
    metadata: input.metadata ?? {},
  };

  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    local.analyticsEvents.unshift(event);
    local.analyticsEvents = local.analyticsEvents.slice(0, 5000);
    await writeLocalDb(local);
    return event;
  }

  await db.query(
    `INSERT INTO analytics_events (
      id, created_at, session_id, event_type, path, referrer, device, viewport_width,
      utm_source, utm_medium, utm_campaign, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
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
  return event;
}

export async function listAnalyticsEvents(days = 30): Promise<AnalyticsEvent[]> {
  await ensureSchema();
  const rangeDays = Math.min(365, Math.max(1, Math.round(days)));
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return local.analyticsEvents
      .filter((event) => event.createdAt >= since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { rows } = await db.query('SELECT * FROM analytics_events WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 20000', [since]);
  return rows.map(toAnalyticsEvent);
}

export async function getAnalyticsReport(days = 30): Promise<AnalyticsReport> {
  const rangeDays = Math.min(365, Math.max(1, Math.round(days)));
  const sinceMs = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  const [events, leads, quotes] = await Promise.all([listAnalyticsEvents(rangeDays), listLeadSummaries(), listQuotes()]);
  const recentLeads = leads.filter((lead) => new Date(lead.createdAt).getTime() >= sinceMs);
  const recentQuotes = quotes.filter((quote) => new Date(quote.createdAt).getTime() >= sinceMs);
  const pageViews = events.filter((event) => event.eventType === 'page_view');
  const sessionIds = new Set(events.map((event) => event.sessionId).filter(Boolean));
  const leadSessions = new Set(events.filter((event) => event.eventType === 'form_submit_success').map((event) => event.sessionId).filter(Boolean));

  const byEvent = new Map<string, number>();
  for (const event of events) byEvent.set(event.eventType, (byEvent.get(event.eventType) ?? 0) + 1);

  const pageMap = new Map<string, { path: string; views: number; sessions: Set<string>; leads: number }>();
  for (const event of pageViews) {
    const item = pageMap.get(event.path) ?? { path: event.path, views: 0, sessions: new Set<string>(), leads: 0 };
    item.views += 1;
    if (event.sessionId) item.sessions.add(event.sessionId);
    pageMap.set(event.path, item);
  }
  for (const event of events.filter((item) => item.eventType === 'form_submit_success')) {
    const item = pageMap.get(event.path) ?? { path: event.path, views: 0, sessions: new Set<string>(), leads: 0 };
    item.leads += 1;
    if (event.sessionId) item.sessions.add(event.sessionId);
    pageMap.set(event.path, item);
  }

  const sourceMap = new Map<string, { source: string; sessions: Set<string>; leads: Set<string> }>();
  for (const event of pageViews) {
    const source = sourceFromEvent(event);
    const item = sourceMap.get(source) ?? { source, sessions: new Set<string>(), leads: new Set<string>() };
    if (event.sessionId) item.sessions.add(event.sessionId);
    sourceMap.set(source, item);
  }

  const campaignMap = new Map<string, { campaign: string; source: string; sessions: Set<string>; leads: Set<string> }>();
  for (const event of pageViews) {
    const source = sourceFromEvent(event);
    const campaign = event.utmCampaign?.trim() || 'Bez kampane';
    const key = `${source}\u0000${campaign}`;
    const item = campaignMap.get(key) ?? { campaign, source, sessions: new Set<string>(), leads: new Set<string>() };
    if (event.sessionId) item.sessions.add(event.sessionId);
    campaignMap.set(key, item);
  }
  for (const event of events.filter((item) => item.eventType === 'form_submit_success')) {
    const source = sourceFromEvent(event);
    const campaign = event.utmCampaign?.trim() || 'Bez kampane';
    const key = `${source}\u0000${campaign}`;
    const item = campaignMap.get(key) ?? { campaign, source, sessions: new Set<string>(), leads: new Set<string>() };
    if (event.sessionId) {
      item.sessions.add(event.sessionId);
      item.leads.add(event.sessionId);
    }
    campaignMap.set(key, item);
  }
  for (const event of events.filter((item) => item.eventType === 'form_submit_success')) {
    const source = sourceFromEvent(event);
    const item = sourceMap.get(source) ?? { source, sessions: new Set<string>(), leads: new Set<string>() };
    if (event.sessionId) {
      item.sessions.add(event.sessionId);
      item.leads.add(event.sessionId);
    }
    sourceMap.set(source, item);
  }

  const deviceMap = new Map<string, { device: string; sessions: Set<string>; pageViews: number; leads: Set<string> }>();
  for (const event of events) {
    const device = event.device || 'unknown';
    const item = deviceMap.get(device) ?? { device, sessions: new Set<string>(), pageViews: 0, leads: new Set<string>() };
    if (event.sessionId) item.sessions.add(event.sessionId);
    if (event.eventType === 'page_view') item.pageViews += 1;
    if (event.eventType === 'form_submit_success' && event.sessionId) item.leads.add(event.sessionId);
    deviceMap.set(device, item);
  }

  const dailyMap = new Map<string, { date: string; pageViews: number; sessions: Set<string>; leads: number; formStarts: number; quoteViews: number }>();
  for (let index = rangeDays - 1; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dailyMap.set(date, { date, pageViews: 0, sessions: new Set<string>(), leads: 0, formStarts: 0, quoteViews: 0 });
  }
  for (const event of events) {
    const date = eventDate(event.createdAt);
    const item = dailyMap.get(date);
    if (!item) continue;
    if (event.eventType === 'page_view') item.pageViews += 1;
    if (event.sessionId) item.sessions.add(event.sessionId);
    if (event.eventType === 'form_submit_success') item.leads += 1;
    if (event.eventType === 'form_start') item.formStarts += 1;
    if (event.eventType === 'quote_section_view') item.quoteViews += 1;
  }

  const quoteViews = byEvent.get('quote_section_view') ?? 0;
  const formStarts = byEvent.get('form_start') ?? 0;
  const leadCount = recentLeads.length || (byEvent.get('form_submit_success') ?? 0);
  const quoteCount = recentQuotes.length;
  const acceptedQuotes = recentQuotes.filter((quote) => quote.status === 'accepted').length;

  return {
    rangeDays,
    totals: {
      pageViews: pageViews.length,
      sessions: sessionIds.size,
      leads: leadCount,
      quotes: quoteCount,
      acceptedQuotes,
      leadConversionRate: percent(leadCount || leadSessions.size, sessionIds.size),
      quoteRate: percent(quoteCount, leadCount),
      acceptedQuoteRate: percent(acceptedQuotes, quoteCount),
    },
    events: [...byEvent.entries()].map(([eventType, count]) => ({ eventType, count })).sort((a, b) => b.count - a.count),
    topPages: [...pageMap.values()]
      .map((item) => ({ path: item.path, views: item.views, sessions: item.sessions.size, leads: item.leads, conversionRate: percent(item.leads, item.sessions.size) }))
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
      leads: item.leads,
      formStarts: item.formStarts,
      quoteViews: item.quoteViews,
    })),
    funnel: [
      { label: 'Návštevy', count: sessionIds.size, rateFromPrevious: 100 },
      { label: 'Videný dotazník', count: quoteViews, rateFromPrevious: percent(quoteViews, sessionIds.size) },
      { label: 'Začaté vypĺňanie', count: formStarts, rateFromPrevious: percent(formStarts, quoteViews) },
      { label: 'Odoslané dopyty', count: leadCount, rateFromPrevious: percent(leadCount, formStarts) },
      { label: 'Vytvorené ponuky', count: quoteCount, rateFromPrevious: percent(quoteCount, leadCount) },
      { label: 'Prijaté ponuky', count: acceptedQuotes, rateFromPrevious: percent(acceptedQuotes, quoteCount) },
    ],
  };
}

function analyticsTrafficSlice(events: AnalyticsEvent[], sinceMs?: number): AnalyticsTrafficSlice {
  const filtered = sinceMs === undefined ? events : events.filter((event) => new Date(event.createdAt).getTime() >= sinceMs);
  return {
    pageViews: filtered.filter((event) => event.eventType === 'page_view').length,
    sessions: new Set(filtered.map((event) => event.sessionId).filter(Boolean)).size,
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
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day);
  const localParts = slovakDateParts(new Date(guess));
  const localAsUtc = Date.UTC(localParts.year, localParts.month - 1, localParts.day);
  return new Date(guess - (localAsUtc - guess));
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
       COUNT(DISTINCT e.session_id) FILTER (WHERE e.created_at >= p.today_start AND e.session_id <> '')::int AS today_sessions,
       COUNT(*) FILTER (WHERE e.created_at >= p.today_start AND e.event_type = 'form_start')::int AS today_form_starts,
       COUNT(*) FILTER (WHERE e.created_at >= p.today_start AND e.event_type = 'form_submit_success')::int AS today_leads,
       COUNT(*) FILTER (WHERE e.created_at >= p.month_start AND e.event_type = 'page_view')::int AS month_page_views,
       COUNT(DISTINCT e.session_id) FILTER (WHERE e.created_at >= p.month_start AND e.session_id <> '')::int AS month_sessions,
       COUNT(*) FILTER (WHERE e.created_at >= p.month_start AND e.event_type = 'form_start')::int AS month_form_starts,
       COUNT(*) FILTER (WHERE e.created_at >= p.month_start AND e.event_type = 'form_submit_success')::int AS month_leads,
       COUNT(*) FILTER (WHERE e.created_at >= p.year_start AND e.event_type = 'page_view')::int AS year_page_views,
       COUNT(DISTINCT e.session_id) FILTER (WHERE e.created_at >= p.year_start AND e.session_id <> '')::int AS year_sessions,
       COUNT(*) FILTER (WHERE e.created_at >= p.year_start AND e.event_type = 'form_start')::int AS year_form_starts,
       COUNT(*) FILTER (WHERE e.created_at >= p.year_start AND e.event_type = 'form_submit_success')::int AS year_leads,
       COUNT(*) FILTER (WHERE e.event_type = 'page_view')::int AS all_page_views,
       COUNT(DISTINCT e.session_id) FILTER (WHERE e.session_id <> '')::int AS all_sessions,
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
    customerName: String(row.customer_name),
    location: row.location ? String(row.location) : '',
    rating: Number(row.rating ?? 5),
    text: String(row.text),
    status: String(row.status) as TestimonialStatus,
    customerEmail: row.customer_email ? String(row.customer_email) : '',
    consentPublication: Boolean(row.consent_publication),
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
      ok: Boolean(process.env.SMTP_HOST && (process.env.FROM_EMAIL || process.env.MAIL_FROM) && process.env.LEAD_TO_EMAIL),
      detail: process.env.SMTP_HOST ? 'SMTP host je nastavený.' : 'SMTP_HOST nie je nastavený, emaily sa preskočia.',
    },
    allowedOrigins: process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://likvidacia-eternitu.sk',
    buildCommit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'lokálne / nezistené',
    lastLead: null as null | LeadSummary,
    lastEmailSent: null as null | AuditLog,
    lastEmailError: null as null | AuditLog,
    pendingLeads: 0,
  };

  if (process.env.SMTP_HOST && (process.env.FROM_EMAIL || process.env.MAIL_FROM) && process.env.LEAD_TO_EMAIL) {
    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      });
      await transport.verify();
      base.smtp = { ok: true, detail: 'SMTP server je dostupný.' };
    } catch (error) {
      base.smtp = { ok: false, detail: error instanceof Error ? error.message : 'SMTP server je nedostupný.' };
    }
  }

  try {
    await ensureSchema();
    const db = getPool();
    if (db) {
      await db.query('SELECT 1');
      base.database = { ok: true, detail: 'PostgreSQL/Neon odpovedá.' };
      const [latestLeads, latestSent, latestError] = await Promise.all([
        listLeadSummaries(),
        db.query("SELECT * FROM audit_logs WHERE action = 'lead_email_sent' ORDER BY created_at DESC LIMIT 1"),
        db.query("SELECT * FROM audit_logs WHERE action IN ('lead_email_error', 'lead_email_skipped') ORDER BY created_at DESC LIMIT 1"),
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
    base.lastEmailSent = local.auditLogs.find((log) => log.action === 'lead_email_sent') ?? null;
    base.lastEmailError = local.auditLogs.find((log) => log.action === 'lead_email_error' || log.action === 'lead_email_skipped') ?? null;
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
