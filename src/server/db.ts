import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type {
  AuditLog,
  AnalyticsEvent,
  AnalyticsEventInput,
  AnalyticsReport,
  BusinessJob,
  BusinessJobCosts,
  BusinessJobInput,
  BusinessJobStatus,
  BusinessLandfill,
  BusinessPaymentType,
  BusinessSettings,
  BusinessWorkType,
  LandfillPrice,
  Lead,
  LeadFile,
  LeadInput,
  LeadStatus,
  LeadSummary,
  PriceOffer,
  PriceOfferInput,
  PriceOfferMaterialType,
  PriceOfferSettings,
  PriceOfferStatus,
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
  SiteContentItem,
  Testimonial,
  TestimonialInput,
  TestimonialStatus,
  Worker,
} from './types';

type LocalDb = {
  leads: Lead[];
  leadFiles: LeadFile[];
  auditLogs: AuditLog[];
  quotes: Quote[];
  testimonials: Testimonial[];
  reviewRequests: ReviewRequest[];
  workers: Worker[];
  businessJobs: BusinessJob[];
  priceOffers: PriceOffer[];
  landfillPrices: LandfillPrice[];
  realizations: Realization[];
  roofers: Roofer[];
  siteContent: SiteContentItem[];
  analyticsEvents: AnalyticsEvent[];
};

type LeadWithFiles = Lead & { files: LeadFile[]; quotes: Quote[]; auditLogs: AuditLog[] };
type BusinessJobWithActivity = BusinessJob & { activityLogs: AuditLog[] };

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
const localDbPath = path.join(process.cwd(), '.data', 'local-db.json');
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

function toLead(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    status: String(row.status) as LeadStatus,
    fullName: String(row.full_name),
    phone: String(row.phone),
    email: String(row.email),
    city: String(row.city),
    district: row.district ? String(row.district) : '',
    objectType: String(row.object_type),
    materialType: String(row.material_type),
    areaEstimate: Number(row.area_estimate),
    roofer: row.roofer ? String(row.roofer) : '',
    term: row.term ? String(row.term) : '',
    note: row.note ? String(row.note) : '',
    gdpr: Boolean(row.gdpr),
    source: row.source ? String(row.source) : 'web',
    wantsRooferRecommendation: Boolean(row.wants_roofer_recommendation ?? row.wantsRooferRecommendation),
    selectedRooferId: row.selected_roofer_id ? String(row.selected_roofer_id) : row.selectedRooferId ? String(row.selectedRooferId) : '',
    internalNote: row.internal_note ? String(row.internal_note) : '',
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
    validUntil: String(row.valid_until),
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
      roofer text,
      term text,
      note text,
      gdpr boolean NOT NULL DEFAULT true,
      source text NOT NULL DEFAULT 'web',
      wants_roofer_recommendation boolean NOT NULL DEFAULT false,
      selected_roofer_id text NOT NULL DEFAULT '',
      internal_note text NOT NULL DEFAULT '',
      raw_data jsonb NOT NULL DEFAULT '{}'::jsonb
    );

    ALTER TABLE leads ADD COLUMN IF NOT EXISTS wants_roofer_recommendation boolean NOT NULL DEFAULT false;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS selected_roofer_id text NOT NULL DEFAULT '';

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
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
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
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS customer_phone text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS customer_email text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS material_type text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS object_type text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS term text NOT NULL DEFAULT '';
    ALTER TABLE business_jobs ADD COLUMN IF NOT EXISTS lead_source text NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS price_offers (
      id uuid PRIMARY KEY,
      number text NOT NULL UNIQUE,
      job_id uuid REFERENCES business_jobs(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
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

    CREATE INDEX IF NOT EXISTS leads_status_created_at_idx ON leads (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS lead_files_lead_id_idx ON lead_files (lead_id);
    CREATE INDEX IF NOT EXISTS audit_logs_entity_created_at_idx ON audit_logs (entity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_logs_action_created_at_idx ON audit_logs (action, created_at DESC);
    CREATE INDEX IF NOT EXISTS quotes_lead_id_idx ON quotes (lead_id);
    CREATE INDEX IF NOT EXISTS testimonials_status_created_at_idx ON testimonials (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS review_requests_status_created_at_idx ON review_requests (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS realizations_status_created_at_idx ON realizations (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS roofers_active_region_idx ON roofers (active, region, updated_at DESC);
    CREATE INDEX IF NOT EXISTS roofer_events_roofer_created_idx ON roofer_events (roofer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS analytics_events_created_type_idx ON analytics_events (created_at DESC, event_type);
    CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON analytics_events (session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS business_jobs_date_status_idx ON business_jobs (demolition_date DESC, status);
    CREATE INDEX IF NOT EXISTS business_job_workers_worker_idx ON business_job_workers (worker_id);
    CREATE INDEX IF NOT EXISTS price_offers_created_status_idx ON price_offers (created_at DESC, status);
    CREATE INDEX IF NOT EXISTS price_offers_job_idx ON price_offers (job_id);
  `);
  await seedDefaultWorkers();
  schemaReady = true;
}

function toPriceOffer(row: Record<string, unknown>): PriceOffer {
  return {
    id: String(row.id),
    number: String(row.number ?? row.cislo ?? ''),
    jobId: row.job_id || row.jobId ? String(row.job_id ?? row.jobId) : '',
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
    validUntil: String(row.valid_until ?? row.validUntil ?? '').slice(0, 10),
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
    businessJobs: data.businessJobs ?? [],
    priceOffers: data.priceOffers ?? [],
    landfillPrices: data.landfillPrices ?? [],
    realizations: data.realizations ?? [],
    roofers: data.roofers ?? [],
    siteContent: data.siteContent ?? [],
    analyticsEvents: data.analyticsEvents ?? [],
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
    customerName: String(row.customer_name ?? row.customerName ?? ''),
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
    createdAt: new Date(String(row.created_at ?? row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.updatedAt)).toISOString(),
    demolitionDate: String(row.demolition_date ?? row.demolitionDate ?? '').slice(0, 10),
    customerName: String(row.customer_name ?? row.customerName ?? ''),
    customerPhone: String(row.customer_phone ?? row.customerPhone ?? ''),
    customerEmail: String(row.customer_email ?? row.customerEmail ?? ''),
    location: String(row.location ?? ''),
    district: String(row.district ?? ''),
    materialType: String(row.material_type ?? row.materialType ?? ''),
    objectType: String(row.object_type ?? row.objectType ?? ''),
    term: String(row.term ?? ''),
    leadSource: String(row.lead_source ?? row.leadSource ?? ''),
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
      businessJobs: [],
      priceOffers: [],
      landfillPrices: [],
      realizations: [],
      roofers: [],
      siteContent: [],
      analyticsEvents: [],
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
    wantsRooferRecommendation: Boolean(input.wantsRooferRecommendation),
    selectedRooferId: input.selectedRooferId ?? '',
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
      object_type, material_type, area_estimate, roofer, term, note, gdpr, source,
      internal_note, raw_data, wants_roofer_recommendation, selected_roofer_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
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
    return [...local.leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { rows } = await db.query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 300');
  return rows.map(toLead);
}

export async function listLeadSummaries(): Promise<LeadSummary[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.leads]
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
    ORDER BY l.created_at DESC
    LIMIT 300
  `);
  return rows.map(toLeadSummary);
}

export async function getLeadWithFiles(id: string): Promise<LeadWithFiles | null> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.id === id);
    if (!lead) return null;
    return {
      ...lead,
      files: local.leadFiles.filter((file) => file.leadId === id),
      quotes: local.quotes.filter((quote) => quote.leadId === id),
      auditLogs: local.auditLogs.filter((log) => log.entityId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }
  const leadResult = await db.query('SELECT * FROM leads WHERE id = $1 LIMIT 1', [id]);
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
    const lead = local.leads.find((item) => item.id === id);
    if (!lead) return null;
    const previous = lead.status;
    lead.status = status;
    lead.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('lead', id, 'status_changed', actorEmail, { previous, next: status });
    return lead;
  }
  const previous = await getLeadWithFiles(id);
  const { rows } = await db.query('UPDATE leads SET status = $1, updated_at = now() WHERE id = $2 RETURNING *', [status, id]);
  if (!rows[0]) return null;
  await addAuditLog('lead', id, 'status_changed', actorEmail, { previous: previous?.status, next: status });
  return toLead(rows[0]);
}

export async function updateLeadInternalNote(id: string, internalNote: string, actorEmail: string) {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    const lead = local.leads.find((item) => item.id === id);
    if (!lead) return null;
    const previous = lead.internalNote;
    lead.internalNote = internalNote;
    lead.updatedAt = now();
    await writeLocalDb(local);
    await addAuditLog('lead', id, 'internal_note_changed', actorEmail, { previous, next: internalNote });
    return lead;
  }
  const previous = await getLeadWithFiles(id);
  const { rows } = await db.query('UPDATE leads SET internal_note = $1, updated_at = now() WHERE id = $2 RETURNING *', [internalNote, id]);
  if (!rows[0]) return null;
  await addAuditLog('lead', id, 'internal_note_changed', actorEmail, { previous: previous?.internalNote, next: internalNote });
  return toLead(rows[0]);
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

async function ensureLocalBusinessDefaults(local: LocalDb) {
  if (!local.workers.length) {
    local.workers = defaultWorkers.map((worker) => ({
      id: randomUUID(),
      name: worker.name,
      ratePerM2: worker.ratePerM2,
      active: true,
      createdAt: now(),
      updatedAt: now(),
    }));
    await writeLocalDb(local);
  }
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

export async function listBusinessJobs(filters: { from?: string; to?: string } = {}): Promise<BusinessJob[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.businessJobs]
      .filter((job) => (!filters.from || job.demolitionDate >= filters.from) && (!filters.to || job.demolitionDate <= filters.to))
      .sort((a, b) => b.demolitionDate.localeCompare(a.demolitionDate));
  }
  const conditions: string[] = [];
  const values: unknown[] = [];
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
    return local.businessJobs.find((job) => job.id === id) ?? null;
  }
  const { rows } = await db.query('SELECT * FROM business_jobs WHERE id = $1 LIMIT 1', [id]);
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
    local.businessJobs = local.businessJobs.filter((job) => job.id !== id);
    await writeLocalDb(local);
    await addAuditLog('business_job', id, 'business_job_deleted', actorEmail, {});
    return;
  }
  await db.query('DELETE FROM business_jobs WHERE id = $1', [id]);
  await addAuditLog('business_job', id, 'business_job_deleted', actorEmail, {});
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

  await db.query('BEGIN');
  try {
    await db.query(
      `INSERT INTO business_jobs (
        id, created_at, updated_at, demolition_date, customer_name, customer_phone, customer_email, location, district,
        material_type, object_type, term, lead_source, m2, price_per_m2, total_price, payment_type, work_type, waste_kg, landfill, status, note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      ON CONFLICT (id) DO UPDATE SET
        updated_at = $3, demolition_date = $4, customer_name = $5, customer_phone = $6, customer_email = $7,
        location = $8, district = $9, material_type = $10, object_type = $11, term = $12, lead_source = $13, m2 = $14,
        price_per_m2 = $15, total_price = $16, payment_type = $17, work_type = $18, waste_kg = $19,
        landfill = $20, status = $21, note = $22`,
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
    await db.query('DELETE FROM business_job_workers WHERE job_id = $1', [jobId]);
    for (const worker of jobWorkers) {
      await db.query(
        `INSERT INTO business_job_workers (id, job_id, worker_id, worker_name, m2_share, rate, reward, manually_edited)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [worker.id, jobId, worker.workerId, worker.workerName, worker.m2Share, worker.rate, worker.reward, worker.manuallyEdited],
      );
    }
    await db.query(
      `INSERT INTO business_job_costs (job_id, fuel, suits, gloves, penetrant, landfill_cost, other_name, other_amount, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (job_id) DO UPDATE SET fuel = $2, suits = $3, gloves = $4, penetrant = $5,
       landfill_cost = $6, other_name = $7, other_amount = $8, total = $9`,
      [jobId, costs.fuel, costs.suits, costs.gloves, costs.penetrant, costs.landfillCost, costs.otherName, costs.otherAmount, costs.total],
    );
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
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

export async function listPriceOffers(filters: { status?: PriceOfferStatus | ''; month?: string; jobId?: string } = {}): Promise<PriceOffer[]> {
  await ensureSchema();
  const db = getPool();
  if (!db) {
    const local = await readLocalDb();
    return [...local.priceOffers]
      .filter((offer) => (!filters.status || offer.status === filters.status) && (!filters.jobId || offer.jobId === filters.jobId) && (!filters.month || offer.createdAt.startsWith(filters.month)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const conditions: string[] = [];
  const values: unknown[] = [];
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
    return local.priceOffers.find((offer) => offer.id === id) ?? null;
  }
  const { rows } = await db.query('SELECT * FROM price_offers WHERE id = $1 LIMIT 1', [id]);
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
    local.priceOffers = local.priceOffers.filter((item) => item.id !== id);
    await writeLocalDb(local);
  } else {
    await db.query('DELETE FROM price_offers WHERE id = $1', [id]);
  }
  await addAuditLog('business_job', offer?.jobId || id, 'price_offer_deleted', actorEmail, { number: offer?.number });
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
      ok: Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.LEAD_TO_EMAIL),
      detail: process.env.SMTP_HOST ? 'SMTP host je nastavený.' : 'SMTP_HOST nie je nastavený, emaily sa preskočia.',
    },
    allowedOrigins: process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk,http://localhost:3000,http://localhost:5173',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://likvidacia-eternitu.sk',
    buildCommit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'lokálne / nezistené',
    lastLead: null as null | LeadSummary,
    lastEmailSent: null as null | AuditLog,
    lastEmailError: null as null | AuditLog,
  };

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
      return base;
    }

    base.database = { ok: true, detail: 'Lokálny vývojový JSON storage odpovedá.' };
    const local = await readLocalDb();
    const latestLeads = await listLeadSummaries();
    base.lastLead = latestLeads[0] ?? null;
    base.lastEmailSent = local.auditLogs.find((log) => log.action === 'lead_email_sent') ?? null;
    base.lastEmailError = local.auditLogs.find((log) => log.action === 'lead_email_error' || log.action === 'lead_email_skipped') ?? null;
    return base;
  } catch (error) {
    base.database = {
      ok: false,
      detail: error instanceof Error ? error.message : 'Neznáma chyba databázy.',
    };
    return base;
  }
}
