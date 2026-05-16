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
  wantsRooferRecommendation?: boolean;
  selectedRooferId?: string;
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
  entityType: 'lead' | 'quote' | 'system' | 'testimonial' | 'realization' | 'site_content' | 'roofer';
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

export type TestimonialStatus = 'draft' | 'approved' | 'hidden';

export type TestimonialInput = {
  customerName: string;
  location?: string;
  rating: number;
  text: string;
  status: TestimonialStatus;
  customerEmail?: string;
  consentPublication?: boolean;
  source?: 'admin' | 'public';
};

export type Testimonial = TestimonialInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
};

export type RealizationStatus = 'draft' | 'published' | 'hidden';

export type RealizationInput = {
  title: string;
  location: string;
  materialType: string;
  areaEstimate?: number;
  description: string;
  imageUrls: string[];
  status: RealizationStatus;
  featured?: boolean;
  createdBy: string;
};

export type Realization = RealizationInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type SiteContentItem = {
  key: string;
  value: string;
  updatedAt: string;
  updatedBy?: string;
};

export type Roofer = {
  id: string;
  name: string;
  ico?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  web?: string;
  region: string;
  districts: string[];
  specialization?: string;
  publicNote?: string;
  internalNote?: string;
  active: boolean;
  verifiedPartner: boolean;
  inVerification: boolean;
  preferredPartner: boolean;
  rating: number;
  reviewCount: number;
  complaintsCount: number;
  cardViewCount: number;
  contactRevealCount: number;
  quoteUseClickCount: number;
  referralCount: number;
  recommendedJobsCount: number;
  confirmedJobsCount: number;
  failedJobsCount: number;
  internalScore: number;
  totalM2: number;
  revenueWithoutVat: number;
  profit: number;
  createdAt: string;
  updatedAt: string;
};

export type RooferInput = {
  name: string;
  ico?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  web?: string;
  region: string;
  districts: string[];
  specialization?: string;
  publicNote?: string;
  internalNote?: string;
  active?: boolean;
  verifiedPartner?: boolean;
  inVerification?: boolean;
  preferredPartner?: boolean;
  rating?: number;
  reviewCount?: number;
  complaintsCount?: number;
  internalScore?: number;
};
