export const maxLeadUploadDrafts = 10;

type ReservationInput = {
  contentType: string;
  sizeBytes: number;
};

type ExistingReservation = ReservationInput & {
  status: string;
};

type AttachmentInput = ReservationInput & {
  submissionId: string;
  leadId: string;
};

type DraftForAttachment = ReservationInput & {
  submissionId: string;
  status: string;
  leadId?: string | null;
};

export function assertLeadUploadCapacity(activeCount: number) {
  if (!Number.isInteger(activeCount) || activeCount < 0) {
    throw new Error('Počet rezervovaných fotiek nie je platný.');
  }
  if (activeCount >= maxLeadUploadDrafts) {
    throw new Error(`K jednému dopytu môžete priložiť najviac ${maxLeadUploadDrafts} fotiek.`);
  }
}

export function assertReusableLeadUploadDraft(existing: ExistingReservation, input: ReservationInput) {
  if (existing.contentType !== input.contentType || existing.sizeBytes !== input.sizeBytes) {
    throw new Error('Vybraná fotka sa zmenila. Odstráňte ju z formulára a vyberte znova.');
  }
  if (!['uploading', 'uploaded'].includes(existing.status)) {
    throw new Error('Táto fotka už bola uzavretá. Odstráňte ju z formulára a vyberte znova.');
  }
}

export function assertAttachableLeadUploadDraft(draft: DraftForAttachment, input: AttachmentInput) {
  if (draft.submissionId !== input.submissionId
    || draft.contentType !== input.contentType
    || draft.sizeBytes !== input.sizeBytes
    || !['uploaded', 'attached'].includes(draft.status)) {
    throw new Error('Niektorú fotografiu sa nepodarilo bezpečne priradiť k dopytu.');
  }
  if (draft.status === 'attached' && draft.leadId !== input.leadId) {
    throw new Error('Fotka už patrí k inému dopytu.');
  }
}
