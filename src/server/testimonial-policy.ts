import type { TestimonialStatus } from './types';
import { createHash } from 'node:crypto';
import {
  adminTestimonialConsentVersion,
  bindPublicTestimonialConsent,
  isValidAdminTestimonialConsentEvidence,
  publicTestimonialConsentVersion,
  // @ts-ignore Node's native TypeScript test runner requires this explicit extension.
} from '../lib/testimonial-consent.ts';

export function testimonialPublicContentHash(customerName: string, rating: number, text: string) {
  return createHash('sha256')
    .update(JSON.stringify([customerName.trim(), rating, text.trim()]), 'utf8')
    .digest('hex');
}

export function canUseTestimonialStatus(
  status: TestimonialStatus,
  consentPublication: boolean,
  consentEvidence = '',
  consentCapturedAt?: string,
  consentRevokedAt?: string,
  consentVersion = '',
  customerName?: string,
  rating?: number,
  text?: string,
) {
  if (status !== 'approved') return true;
  if (!consentPublication || !consentCapturedAt || !Number.isFinite(Date.parse(consentCapturedAt)) || consentRevokedAt) return false;
  if (!customerName || typeof rating !== 'number' || !Number.isInteger(rating) || !text) return false;
  const contentHash = testimonialPublicContentHash(customerName, rating, text);
  if (consentVersion === publicTestimonialConsentVersion) return consentEvidence === bindPublicTestimonialConsent(contentHash);
  return consentVersion === adminTestimonialConsentVersion && isValidAdminTestimonialConsentEvidence(consentEvidence, contentHash);
}
