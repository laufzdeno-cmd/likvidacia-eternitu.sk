import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { AuditLog, Lead, LeadFile, LeadInput, LeadStatus, Quote, QuoteInput } from './types';

type LocalDb = {
  leads: Lead[];
  leadFiles: LeadFile[];
  auditLogs: AuditLog[];
  quotes: Quote[];
};

type LeadWithFiles = Lead & { files: LeadFile[]; quotes: Quote[]; auditLogs: AuditLog[] };

const databaseUrl = process.env.DATABASE_URL;
const localDbPath = path.join(process.cwd(), '.data', 'local-db.json');

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
    internalNote: row.internal_note ? String(row.internal_note) : '',
    rawData: (row.raw_data as Record<string, unknown>) ?? {},
  };
}

function toLeadFile(row: Record<string, unknown>): LeadFile {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    originalName: String(row.original_name),
    storageDriver: String(row.storage_driver) as 'local' | 's3',
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
      internal_note text NOT NULL DEFAULT '',
      raw_data jsonb NOT NULL DEFAULT '{}'::jsonb
    );

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
  `);
  schemaReady = true;
}

async function readLocalDb(): Promise<LocalDb> {
  await mkdir(path.dirname(localDbPath), { recursive: true });
  try {
    return JSON.parse(await readFile(localDbPath, 'utf8')) as LocalDb;
  } catch {
    const empty: LocalDb = { leads: [], leadFiles: [], auditLogs: [], quotes: [] };
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
      internal_note, raw_data
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
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

export async function getDashboardStats() {
  const leads = await listLeads();
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalLeads: leads.length,
    newLeads: leads.filter((lead) => lead.status === 'novy').length,
    todayLeads: leads.filter((lead) => lead.createdAt.startsWith(today)).length,
    pricedLeads: leads.filter((lead) => lead.status === 'naceneny' || lead.status === 'cenova_ponuka_odoslana').length,
  };
}
