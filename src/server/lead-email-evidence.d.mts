export type LeadEmailResolutionOutcome = 'sent' | 'failed';
export type LeadEmailEvidenceCode = 'inbox_message_found' | 'provider_accepted' | 'inbox_no_message' | 'provider_rejected';
export function isLeadEmailEvidenceValid(outcome: LeadEmailResolutionOutcome, evidence: string): evidence is LeadEmailEvidenceCode;
