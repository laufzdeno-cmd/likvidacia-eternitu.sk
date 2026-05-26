export type LeadStatus =
  | 'novy'
  | 'kontaktovany'
  | 'caka_na_doplnenie'
  | 'naceneny'
  | 'cenova_ponuka_odoslana'
  | 'objednane'
  | 'v_realizacii'
  | 'dokoncena'
  | 'zrusena'
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
  preferredContact?: string;
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
  followupDate?: string;
  followupNote?: string;
  followupNotificationSent?: boolean;
  deletedAt?: string;
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
  entityType:
    | 'lead'
    | 'quote'
    | 'system'
    | 'testimonial'
    | 'realization'
    | 'site_content'
    | 'roofer'
    | 'review_request'
    | 'business_job'
    | 'admin_user'
    | 'planner_action';
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
  objectType?: string;
  realizationDate?: string;
  rating: number;
  text: string;
  status: TestimonialStatus;
  customerEmail?: string;
  consentPublication?: boolean;
  source?: 'admin' | 'public' | 'google' | 'phone' | 'whatsapp' | 'email' | 'personal';
  internalNote?: string;
  photoUrl?: string;
};

export type Testimonial = TestimonialInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
};

export type ReviewRequestStatus = 'sent' | 'review_received';

export type ReviewRequestInput = {
  customerName: string;
  phone: string;
  location?: string;
  objectType?: string;
  realizationDate?: string;
  googleReviewLink: string;
  message: string;
  status?: ReviewRequestStatus;
  createdBy: string;
  leadId?: string;
};

export type ReviewRequest = ReviewRequestInput & {
  id: string;
  status: ReviewRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type BusinessPaymentType = 'FAKTURA' | 'CASH';
export type BusinessWorkType = 'DEMONTAZ' | 'ODVOZ' | 'DEMONTAZ_A_ODVOZ';
export type BusinessLandfill = 'MOCHOVCE' | 'LIVINKE_OPATOVCE' | 'KOSICE' | 'INA';
export type BusinessJobStatus =
  | 'DOPYT'
  | 'DOPYT_PRIJATY'
  | 'PONUKA_ODOSLANA'
  | 'PRIJATA'
  | 'PONUKA_POTVRDENA'
  | 'URADY_PODANE'
  | 'URADY_SCHVALENE'
  | 'V_REALIZACII'
  | 'DEMONT_NAPLANOVANA'
  | 'DEMONT_DOKONCENA'
  | 'VYUCTOVANIE'
  | 'DOKONCENA'
  | 'ZRUSENA';
export type PriceOfferMaterialType = 'VLNITY_ETERNIT' | 'HLADKY_ETERNIT' | 'AZBESTOVE_RURY' | 'PODHLADOVE_DOSKY' | 'BOLETICKY' | 'INE';
export type PriceOfferStatus = 'PRIPRAVENA' | 'ODOSLANA' | 'PRIJATA' | 'ZRUSENA';
export type AdminRole = 'SUPER_ADMIN' | 'OPERATOR';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserInput = {
  id?: string;
  email: string;
  name?: string;
  role: AdminRole;
  active?: boolean;
  passwordHash?: string;
};

export type PlannerActionType = 'DEMONTAZ' | 'ODVOZ' | 'DOKUMENTACIA' | 'INE';
export type PlannerActionStatus = 'NAPLANOVANA' | 'DOKONCENA' | 'ZRUSENA' | 'PRESUNUTA';

export type PlannerActionInput = {
  date: string;
  timeFrom: string;
  timeTo: string;
  type: PlannerActionType;
  address: string;
  jobId?: string;
  workers: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  note?: string;
  status: PlannerActionStatus;
  notify2Days: boolean;
  notify1Day: boolean;
  notifyCustomer: boolean;
};

export type PlannerAction = PlannerActionInput & {
  id: string;
  createdAt: string;
  notify2DaysSent: boolean;
  notify1DaySent: boolean;
  notifyCustomerSent: boolean;
};

export type Worker = {
  id: string;
  name: string;
  ratePerM2: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LandfillPrice = {
  id: string;
  year: number;
  landfill: BusinessLandfill;
  pricePerTon: number;
  createdAt: string;
  updatedAt: string;
};

export type BusinessJobWorker = {
  id: string;
  jobId: string;
  workerId: string;
  workerName: string;
  m2Share: number;
  rate: number;
  reward: number;
  manuallyEdited: boolean;
};

export type BusinessJobCosts = {
  jobId: string;
  fuel: number;
  suits: number;
  gloves: number;
  penetrant: number;
  landfillCost: number;
  otherName: string;
  otherAmount: number;
  total: number;
};

export type BusinessJobInput = {
  demolitionDate: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  location: string;
  district?: string;
  materialType?: string;
  objectType?: string;
  term?: string;
  leadSource?: string;
  preferredContact?: string;
  m2: number;
  pricePerM2: number;
  paymentType: BusinessPaymentType;
  workType: BusinessWorkType;
  wasteKg?: number;
  landfill: BusinessLandfill;
  status: BusinessJobStatus;
  note?: string;
  workers: Array<{ workerId: string; rate?: number; reward?: number; manuallyEdited?: boolean }>;
  costs: Omit<BusinessJobCosts, 'jobId' | 'total'>;
};

export type BusinessJob = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  demolitionDate: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  location: string;
  district: string;
  materialType: string;
  objectType: string;
  term: string;
  leadSource: string;
  preferredContact: string;
  m2: number;
  pricePerM2: number;
  totalPrice: number;
  paymentType: BusinessPaymentType;
  workType: BusinessWorkType;
  wasteKg: number;
  landfill: BusinessLandfill;
  status: BusinessJobStatus;
  note: string;
  workers: BusinessJobWorker[];
  costs: BusinessJobCosts;
  rewardsTotal: number;
  grossProfit: number;
  marginPercent: number;
};

export type BusinessSettings = {
  defaultPricePerM2: number;
  googleReviewLink: string;
};

export type CompanyAddressSettings = {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  mainWeb: string;
  asbestosWeb: string;
  ico: string;
  dic: string;
  icDph: string;
  authorization: string;
  preparedByName: string;
  preparedByPhone: string;
  vatRate: number;
};

export type PriceOfferSettings = {
  materialPrices: Record<PriceOfferMaterialType, number>;
  documentationFee: number;
  vatRate: number;
  preparedByName: string;
  preparedByPhone: string;
  company: CompanyAddressSettings;
};

export type PriceOfferInput = {
  jobId?: string;
  objectType: string;
  objectAddress: string;
  municipality: string;
  district: string;
  contactPerson: string;
  phone: string;
  email: string;
  realizationTerm: string;
  materialType: PriceOfferMaterialType;
  areaM2: number;
  pricePerM2WithoutVat: number;
  documentationFeeWithoutVat: number;
  includeDocumentation: boolean;
  validUntil: string;
  offerNote?: string;
  internalNote?: string;
  sourceInquiry?: string;
};

export type PriceOffer = PriceOfferInput & {
  id: string;
  number: string;
  createdAt: string;
  deletedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  materialPriceWithoutVat: number;
  totalWithoutVat: number;
  totalWithVat: number;
  status: PriceOfferStatus;
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

export type AnalyticsEventType =
  | 'page_view'
  | 'quote_section_view'
  | 'form_start'
  | 'form_submit_success'
  | 'form_submit_error'
  | 'cta_click'
  | 'phone_click'
  | 'price_calculator_change'
  | 'gallery_filter'
  | 'reviews_expand'
  | 'roofer_registration_success';

export type AnalyticsEventInput = {
  sessionId: string;
  eventType: AnalyticsEventType;
  path: string;
  referrer?: string;
  device?: 'desktop' | 'tablet' | 'mobile';
  viewportWidth?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  metadata?: Record<string, unknown>;
};

export type AnalyticsEvent = AnalyticsEventInput & {
  id: string;
  createdAt: string;
};

export type AnalyticsReport = {
  rangeDays: number;
  totals: {
    pageViews: number;
    sessions: number;
    leads: number;
    quotes: number;
    acceptedQuotes: number;
    leadConversionRate: number;
    quoteRate: number;
    acceptedQuoteRate: number;
  };
  events: Array<{ eventType: string; count: number }>;
  topPages: Array<{ path: string; views: number; sessions: number; leads: number; conversionRate: number }>;
  sources: Array<{ source: string; sessions: number; leads: number; conversionRate: number }>;
  devices: Array<{ device: string; sessions: number; pageViews: number; leads: number; conversionRate: number }>;
  daily: Array<{ date: string; pageViews: number; sessions: number; leads: number; formStarts: number; quoteViews: number }>;
  funnel: Array<{ label: string; count: number; rateFromPrevious: number }>;
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
