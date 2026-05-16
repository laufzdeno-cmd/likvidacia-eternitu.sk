import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type {
  AuditLog,
  Lead,
  LeadFile,
  LeadInput,
  LeadStatus,
  LeadSummary,
  Quote,
  QuoteInput,
  Realization,
  RealizationInput,
  RealizationStatus,
  Roofer,
  RooferInput,
  SiteContentItem,
  Testimonial,
  TestimonialInput,
  TestimonialStatus,
} from './types';

type LocalDb = {
  leads: Lead[];
  leadFiles: LeadFile[];
  auditLogs: AuditLog[];
  quotes: Quote[];
  testimonials: Testimonial[];
  realizations: Realization[];
  roofers: Roofer[];
  siteContent: SiteContentItem[];
};

type LeadWithFiles = Lead & { files: LeadFile[]; quotes: Quote[]; auditLogs: AuditLog[] };

const databaseUrl = process.env.DATABASE_URL;
const localDbPath = path.join(process.cwd(), '.data', 'local-db.json');
const siteContentAuditId = '00000000-0000-0000-0000-000000000001';

let pool: Pool | undefined;
let schemaReady = false;

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

    CREATE INDEX IF NOT EXISTS leads_status_created_at_idx ON leads (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS lead_files_lead_id_idx ON lead_files (lead_id);
    CREATE INDEX IF NOT EXISTS audit_logs_entity_created_at_idx ON audit_logs (entity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_logs_action_created_at_idx ON audit_logs (action, created_at DESC);
    CREATE INDEX IF NOT EXISTS quotes_lead_id_idx ON quotes (lead_id);
    CREATE INDEX IF NOT EXISTS testimonials_status_created_at_idx ON testimonials (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS realizations_status_created_at_idx ON realizations (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS roofers_active_region_idx ON roofers (active, region, updated_at DESC);
    CREATE INDEX IF NOT EXISTS roofer_events_roofer_created_idx ON roofer_events (roofer_id, created_at DESC);
  `);
  schemaReady = true;
}

function normalizeLocalDb(data: Partial<LocalDb>): LocalDb {
  return {
    leads: data.leads ?? [],
    leadFiles: data.leadFiles ?? [],
    auditLogs: data.auditLogs ?? [],
    quotes: data.quotes ?? [],
    testimonials: data.testimonials ?? [],
    realizations: data.realizations ?? [],
    roofers: data.roofers ?? [],
    siteContent: data.siteContent ?? [],
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

async function readLocalDb(): Promise<LocalDb> {
  await mkdir(path.dirname(localDbPath), { recursive: true });
  try {
    return normalizeLocalDb(JSON.parse(await readFile(localDbPath, 'utf8')) as Partial<LocalDb>);
  } catch {
    const empty: LocalDb = { leads: [], leadFiles: [], auditLogs: [], quotes: [], testimonials: [], realizations: [], roofers: [], siteContent: [] };
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
    rating: Math.min(5, Math.max(1, Math.round(input.rating || 5))),
    text: input.text.trim(),
    status: input.status,
    customerEmail: input.customerEmail?.trim() ?? '',
    consentPublication: Boolean(input.consentPublication),
    source: input.source ?? 'admin',
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
      customer_email, consent_publication, source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
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
    source: row.source === 'public' ? 'public' : 'admin',
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
