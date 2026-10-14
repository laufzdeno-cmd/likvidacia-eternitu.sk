import type { AdminRole, ReviewRequest } from './types';

export const defaultReviewRequestSubject = 'Ako ste boli spokojní so službou ASTANA?';
export const defaultReviewRequestBody = `Dobrý deň {{meno}},

ďakujeme za dôveru pri likvidácii azbestu{{lokalita}}. Prosíme, podeľte sa s nami o svoju skúsenosť. Formulár je krátky a referencia sa na webe zobrazí až po našej kontrole.

{{odkaz}}

Ďakujeme, tím ASTANA`;

export const defaultReviewReminderBody = `Dobrý deň {{meno}},

pripomíname náš krátky formulár spätnej väzby k realizácii{{lokalita}}. Toto je jediná pripomienka, ktorú vám k tejto žiadosti pošleme.

{{odkaz}}

Ďakujeme, tím ASTANA`;

export const reviewRequestTokenDays = 30;
export const minReviewReminderDays = 5;
export const maxReviewReminderDays = 7;
export const defaultReviewReminderDays = 6;
export const defaultReviewBatchLimit = 20;
export const maxReviewBatchLimit = 50;

function replaceTemplate(template: string, values: { customerName: string; location: string; link: string }) {
  const locality = values.location ? ` v lokalite ${values.location}` : '';
  return template
    .replaceAll('{{meno}}', values.customerName)
    .replaceAll('{{lokalita}}', locality)
    .replaceAll('{{odkaz}}', values.link)
    .trim();
}

export function reviewRequestPreview(job: { customerName: string; location?: string }, body = defaultReviewRequestBody) {
  return replaceTemplate(body, { customerName: job.customerName, location: job.location || '', link: '[BEZPEČNÝ 30-DŇOVÝ ODKAZ]' });
}

export function renderReviewRequestMessage(
  request: Pick<ReviewRequest, 'customerName' | 'location'>,
  link: string,
  template: string,
) {
  const rendered = replaceTemplate(template, { customerName: request.customerName, location: request.location || '', link });
  return rendered.includes(link) ? rendered : `${rendered}\n\n${link}`;
}

export function normalizeReviewBatchLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return defaultReviewBatchLimit;
  return Math.max(1, Math.min(maxReviewBatchLimit, parsed));
}

export function normalizeReviewReminderDays(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return defaultReviewReminderDays;
  return Math.max(minReviewReminderDays, Math.min(maxReviewReminderDays, parsed));
}

export function canProcessReviewRequestSelection(role: AdminRole, count: number, configuredLimit: number) {
  if (!Number.isInteger(count) || count < 1 || count > normalizeReviewBatchLimit(configuredLimit)) return false;
  return role === 'SUPER_ADMIN' || count === 1;
}

export function canPublishRequestedTestimonial(role: AdminRole) {
  return role === 'SUPER_ADMIN';
}
