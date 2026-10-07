import { createHmac } from 'node:crypto';
import type { PendingMetaLead } from '@/src/lib/marketing-consent';
import { isValidLeadSubmissionId } from '../lib/lead-submission-id.mjs';

export function createAcceptedLeadConversion(
  submissionId: string,
  materialType: string,
  secret = process.env.CONVERSION_EVENT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-dev-conversion-event-secret-change-me'),
): PendingMetaLead | null {
  if (!isValidLeadSubmissionId(submissionId)) return null;
  if (!secret) return null;

  const material = materialType.normalize('NFC').trim().toLowerCase();
  const category: PendingMetaLead['material'] = material === 'vlnitý eternit'
    ? 'vlnity'
    : material === 'hladký / štvorcový eternit'
      ? 'plocha'
      : material === 'neviem posúdiť'
        ? 'neviem'
        : 'iny';

  const eventId = createHmac('sha256', secret).update(`accepted-lead:${submissionId.toLowerCase()}`).digest('hex');
  return { eventId: `lead:${eventId}`, material: category };
}
