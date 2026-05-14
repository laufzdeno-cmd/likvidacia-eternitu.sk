export type LeadStatus =
  | 'novy'
  | 'caka_na_doplnenie'
  | 'naceneny'
  | 'cenova_ponuka_odoslana'
  | 'objednane'
  | 'nevyslo'
  | 'archivovane';

export type LeadInput = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  district?: string;
  objectType: string;
  materialType: string;
  areaEstimate: number;
  roofer?: string;
  term?: string;
  note?: string;
  gdpr: boolean;
  source?: string;
  rawData?: Record<string, unknown>;
};

export type Lead = LeadInput & {
  id: string;
  status: LeadStatus;
  internalNote: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadSummary = Lead & {
  fileCount: number;
  quoteCount: number;
};

export type LeadFile = {
  id: string;
  leadId: string;
  originalName: string;
  storageDriver: 'local' | 's3' | 'vercel_blob';
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  entityType: 'lead' | 'quote' | 'system';
  entityId: string;
  action: string;
  actorEmail: string;
  changes: Record<string, unknown>;
  createdAt: string;
};

export type QuoteStatus = 'draft' | 'ready' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export type QuoteInput = {
  leadId: string;
  quoteNumber: string;
  validUntil: string;
  areaEstimate: number;
  pricePerM2: number;
  documentationFee: number;
  transportFee: number;
  surcharge: number;
  discount: number;
  vatRate: number;
  note?: string;
  createdBy: string;
};

export type Quote = QuoteInput & {
  id: string;
  status: QuoteStatus;
  totalWithoutVat: number;
  totalWithVat: number;
  createdAt: string;
  updatedAt: string;
};
