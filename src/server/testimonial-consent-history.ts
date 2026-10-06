export type TestimonialConsentSnapshot = {
  consentPublication: boolean;
  consentEvidence: string;
  consentCapturedAt?: string | Date | null;
  consentVersion: string;
  consentRevokedAt?: string | Date | null;
  customerName: string;
  rating: number;
  text: string;
};

export type TestimonialConsentHistoryEntry = {
  event: 'superseded' | 'granted' | 'revoked' | 'updated_without_consent';
  snapshot: TestimonialConsentSnapshot;
};

export function testimonialConsentHistoryEntries(
  previous: TestimonialConsentSnapshot,
  next: TestimonialConsentSnapshot,
): TestimonialConsentHistoryEntry[] {
  const entries: TestimonialConsentHistoryEntry[] = [];
  const hasPreviousEvidence = Boolean(previous.consentEvidence || previous.consentCapturedAt || previous.consentPublication);
  const hasNextEvidence = Boolean(next.consentEvidence || next.consentCapturedAt || next.consentPublication);

  if (hasPreviousEvidence) entries.push({ event: 'superseded', snapshot: previous });
  if (hasNextEvidence) {
    const event = next.consentPublication
      ? 'granted'
      : previous.consentPublication && !previous.consentRevokedAt
        ? 'revoked'
        : 'updated_without_consent';
    entries.push({ event, snapshot: next });
  }
  return entries;
}
