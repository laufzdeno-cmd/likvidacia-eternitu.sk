import type { AdminRole, BusinessJobStatus, BusinessWorkType } from './types';
export type JobWorkspaceActor = {
    email: string;
    role: AdminRole;
};
export type JobMaterialKind = 'VLNITY_ETERNIT' | 'HLADKY_ETERNIT' | 'INTERIER' | 'AZBESTOVE_RURY' | 'VZDUCHOTECHNIKA' | 'INE';
export type JobMaterialUnit = 'M2' | 'M' | 'KS' | 'KG';
export type JobMaterialItem = {
    id: string;
    kind: JobMaterialKind;
    label: string;
    unit: JobMaterialUnit;
    plannedQuantity: number | null;
    actualQuantity: number | null;
    plannedKg: number | null;
    actualKg: number | null;
};
export type JobAuthorityKind = 'OU_ZP' | 'RUVZ';
export type JobAuthorityRecord = {
    required: 'UNKNOWN' | 'YES' | 'NO';
    submittedOn: string | null;
    submissionMethod: string;
    reference: string;
    documentId: string | null;
    decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_APPLICABLE';
    decisionOn: string | null;
    note: string;
};
export type JobWorkPlan = {
    tentativeOn: string | null;
    agreedOn: string | null;
    actualOn: string | null;
    timeFrom: string;
    timeTo: string;
    crewIds: string[];
    plannedCrewCount: number | null;
    actualCrewCount: number | null;
    vehicleIds: string[];
    plannedVehicleCount: number | null;
    actualVehicleCount: number | null;
    confirmedCapacityKg: number | null;
    plannedKm: number | null;
    actualKm: number | null;
    distanceBasis: 'UNKNOWN' | 'ONE_WAY_FROM_POPRAD' | 'ROUND_TRIP_FROM_POPRAD';
    scaffolding: 'UNKNOWN' | 'YES' | 'NO';
    platform: 'UNKNOWN' | 'YES' | 'NO';
    accessNote: string;
    promotionNote: string;
    rescheduleReason: string;
};
export type JobWorkspaceOperations = {
    responsibleEmail: string;
    workType: BusinessWorkType;
    status: BusinessJobStatus;
    materials: JobMaterialItem[];
    authorities: Record<JobAuthorityKind, JobAuthorityRecord>;
    plan: JobWorkPlan;
    note: string;
};
export type JobWorkspaceSettlement = {
    documentType: 'UNDECIDED' | 'INVOICE' | 'OTHER_DOCUMENT';
    agreedAmountWithVatCents: number | null;
    actualAmountWithVatCents: number | null;
    plannedCostCents: number | null;
    actualCostCents: number | null;
    note: string;
};
export type JobWorkspaceAudit = {
    id: string;
    jobId: string;
    revision: number;
    actorEmail: string;
    recordedAt: string;
    action: string;
    visibility: 'OPERATIONS' | 'FINANCE';
    changes: Record<string, unknown>;
};
export type JobWorkspaceCard = {
    actualDateOverride?: boolean;
    jobId: string;
    number: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
    updatedBy: string;
    operations: JobWorkspaceOperations;
    timeline: JobWorkspaceAudit[];
};
export type FinancialJobWorkspaceCard = JobWorkspaceCard & {
    settlement: JobWorkspaceSettlement;
    priceOverride?: boolean;
};
export type JobWorkspacePatch = {
    expectedRevision: number;
    operations: JobWorkspaceOperations;
    settlement?: JobWorkspaceSettlement;
};
/** Private storage identifier only; never a public/download URL. Bytes are owned by the private-document adapter. */
export type ManualOfferPdfReference = {
    documentId: string;
    sha256: string;
    originalName: string;
};
export type ManualPriceOfferItem = {
    id: string;
    description: string;
    unit: string;
    quantity: number | null;
    unitPriceWithoutVatCents: number | null;
    totalWithoutVatCents: number | null;
    vatRate: number | null;
};
export type ManualPriceOfferInput = {
    originalNumber: string;
    issuedOn: string | null;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    jobId?: string | null;
    leadId?: string | null;
    items: ManualPriceOfferItem[];
    totalWithoutVatCents: number | null;
    totalWithVatCents: number | null;
    currency: 'EUR';
    note: string;
    pdf: ManualOfferPdfReference;
    sourceMessageId?: string | null;
};
export type ManualPriceOffer = ManualPriceOfferInput & {
    id: string;
    revision: number;
    source: 'MANUAL_PDF';
    status: 'DRAFT' | 'SENT_VERIFIED' | 'ACCEPTED' | 'DEFERRED' | 'REJECTED';
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    sentOn: string | null;
    sentEvidence: string;
    acceptedOn: string | null;
    acceptedBy: string | null;
    archivedAt: string | null;
    outcomeReason?: string;
    history?: Array<{
        at: string;
        actor: string;
        action: string;
        before: Record<string, unknown>;
    }>;
};
export type ManualOfferImportResult = {
    offer: ManualPriceOffer;
    duplicate: boolean;
};
export type AuthorityNotice = {
    id: string;
    jobId: string;
    operationId: string;
    workspaceRevision: number;
    recipient: string;
    snapshot: Array<{
        authority: JobAuthorityKind;
        submittedOn: string;
        reference: string;
    }>;
    subject: string;
    text: string;
    state: 'PREPARED' | 'SENDING' | 'SENT' | 'UNCERTAIN' | 'FAILED';
    createdAt: string;
    createdBy: string;
    attemptId: string | null;
    sentAt: string | null;
};
export type JobPrivateDocument = {
    id: string;
    jobId: string | null;
    offerDraftId: string | null;
    storageKey: string;
    fileName: string;
    mime: string;
    size: number;
    sha256: string;
    thumbnailStorageKey: string | null;
    createdAt: string;
    createdBy: string;
    kind: 'PDF' | 'PHOTO' | 'AUTHORITY';
};
export type JobCommunicationInput = {
    jobId: string;
    source: 'MANUAL' | 'GMAIL';
    sourceMessageId: string | null;
    occurredAt: string;
    subject: string;
    text: string;
    sender: string;
    recipient: string;
    direction: 'INBOUND' | 'OUTBOUND' | 'NOTE';
    documentIds: string[];
};
export type JobCommunication = JobCommunicationInput & {
    id: string;
    createdAt: string;
    createdBy: string;
};
export type JobWorkspaceStore = {
    cards: FinancialJobWorkspaceCard[];
    manualOffers: ManualPriceOffer[];
    notices: AuthorityNotice[];
    documents: JobPrivateDocument[];
    communications: JobCommunication[];
};
export type JobWorkspaceSearchOptions = {
    page?: number;
    pageSize?: number;
    year?: number;
    status?: string;
    archived?: 'exclude' | 'include' | 'only';
    responsibleEmail?: string;
    workType?: BusinessWorkType;
};
