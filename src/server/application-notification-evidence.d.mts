export type ApplicationNotificationResolution = 'delivered' | 'not_delivered';
export type ApplicationNotificationEvidence = 'inbox_message_found' | 'provider_rejected';

export function isApplicationNotificationEvidenceValid(
  resolution: string,
  evidence: unknown,
): evidence is ApplicationNotificationEvidence;
