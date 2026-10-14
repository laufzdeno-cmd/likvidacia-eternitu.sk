import { getSiteContentMap } from './db';
import {
  defaultReviewBatchLimit,
  defaultReviewReminderBody,
  defaultReviewReminderDays,
  defaultReviewRequestBody,
  defaultReviewRequestSubject,
  normalizeReviewBatchLimit,
  normalizeReviewReminderDays,
} from './review-request-policy';

export type ReviewRequestSettings = {
  subject: string;
  body: string;
  reminderBody: string;
  reminderEnabled: boolean;
  reminderDays: number;
  batchLimit: number;
  googleReviewLink: string;
};

export async function getReviewRequestSettings(): Promise<ReviewRequestSettings> {
  const content = await getSiteContentMap();
  return {
    subject: content.reviewRequestSubject?.trim() || defaultReviewRequestSubject,
    body: content.reviewRequestBody?.trim() || defaultReviewRequestBody,
    reminderBody: content.reviewRequestReminderBody?.trim() || defaultReviewReminderBody,
    reminderEnabled: content.reviewRequestReminderEnabled === 'true',
    reminderDays: normalizeReviewReminderDays(content.reviewRequestReminderDays || defaultReviewReminderDays),
    batchLimit: normalizeReviewBatchLimit(content.reviewRequestBatchLimit || defaultReviewBatchLimit),
    googleReviewLink: content.googleReviewLink?.trim() || '',
  };
}
