import type { AnalyticsEvent } from './types';
import type { Lead, Quote } from './types';

export const ANALYTICS_EVENTS_LIMIT = 20_000;

export type AnalyticsEventCoverage = {
  limit: number;
  returned: number;
  truncated: boolean;
};

export type AnalyticsPeriod = { since: string; dates: string[] };

export function limitAnalyticsEventRows<T>(rows: T[]) {
  const truncated = rows.length > ANALYTICS_EVENTS_LIMIT;
  const retained = rows.slice(0, ANALYTICS_EVENTS_LIMIT);
  return {
    rows: retained,
    coverage: { limit: ANALYTICS_EVENTS_LIMIT, returned: retained.length, truncated },
  };
}

/**
 * A measured visit exists only when an analytics-consented page_view was
 * recorded. Server-side form events without such a visit stay out of web
 * conversion rates and cannot inflate the visit denominator.
 */
export function getMeasuredSessionSets(events: AnalyticsEvent[]) {
  const visitSessions = new Set(
    events.filter((event) => event.eventType === 'page_view').map((event) => event.sessionId).filter(Boolean),
  );
  const sessionsFor = (eventType: string) => new Set(
    events
      .filter((event) => event.eventType === eventType && visitSessions.has(event.sessionId))
      .map((event) => event.sessionId)
      .filter(Boolean),
  );

  return {
    visitSessions,
    quoteViewSessions: sessionsFor('quote_section_view'),
    formStartSessions: sessionsFor('form_start'),
    leadSessions: sessionsFor('form_submit_success'),
  };
}

export function dateInBratislava(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bratislava',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return `${String(part('year')).padStart(4, '0')}-${String(part('month')).padStart(2, '0')}-${String(part('day')).padStart(2, '0')}`;
}

export function bratislavaMidnightUtc(date: { year: number; month: number; day: number }) {
  const targetUtc = Date.UTC(date.year, date.month - 1, date.day);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bratislava',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date(targetUtc));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const representedUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return new Date(targetUtc - (representedUtc - targetUtc));
}

export function getAnalyticsPeriod(days: number, now = new Date()): AnalyticsPeriod {
  const today = dateInBratislava(now).split('-').map(Number);
  const startUtc = Date.UTC(today[0], today[1] - 1, today[2] - (days - 1));
  const dates = Array.from({ length: days }, (_, index) => new Date(startUtc + index * 86_400_000).toISOString().slice(0, 10));
  const [year, month, day] = dates[0].split('-').map(Number);
  return { since: bratislavaMidnightUtc({ year, month, day }).toISOString(), dates };
}

export function getSessionEntryEvents(events: AnalyticsEvent[]) {
  const entries = new Map<string, AnalyticsEvent>();
  for (const event of events
    .filter((item) => item.eventType === 'page_view' && item.sessionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!entries.has(event.sessionId)) entries.set(event.sessionId, event);
  }
  return entries;
}

export function getSessionEntryDevice(event: AnalyticsEvent, entries: Map<string, AnalyticsEvent>) {
  return entries.get(event.sessionId)?.device || event.device || 'unknown';
}

export function getSequentialMeasuredFunnel(sets: ReturnType<typeof getMeasuredSessionSets>) {
  const quoteViews = new Set([...sets.quoteViewSessions].filter((sessionId) => sets.visitSessions.has(sessionId)));
  const formStarts = new Set([...sets.formStartSessions].filter((sessionId) => quoteViews.has(sessionId)));
  const leads = new Set([...sets.leadSessions].filter((sessionId) => formStarts.has(sessionId)));
  return { quoteViews, formStarts, leads };
}

const issuedQuoteStatuses = new Set(['sent', 'accepted', 'rejected', 'expired']);

export function summarizeCrmCohort(leads: Lead[], quotes: Quote[], sinceMs: number) {
  const cohort = leads.filter((lead) => !lead.deletedAt && !lead.isTestData && new Date(lead.createdAt).getTime() >= sinceMs);
  const leadIds = new Set(cohort.map((lead) => lead.id));
  const issued = quotes.filter((quote) => leadIds.has(quote.leadId) && issuedQuoteStatuses.has(quote.status));
  const accepted = issued.filter((quote) => quote.status === 'accepted');
  return {
    leads: cohort.length,
    quotes: issued.length,
    acceptedQuotes: accepted.length,
    quotedLeads: new Set(issued.map((quote) => quote.leadId)).size,
    acceptedLeads: new Set(accepted.map((quote) => quote.leadId)).size,
  };
}
