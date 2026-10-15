import 'server-only';

import type {
  AdminAutopilotRun,
  AdminAutopilotRunItem,
  AdminRole,
  Lead,
  OperationalBusinessJob,
  PriceOffer,
} from './types';

const DAY_MS = 86_400_000;
const ROLLING_PERIOD_DAYS = 30;

export type AdminAssistantMetricPeriod = {
  fromInclusive: string;
  toExclusive: string;
};

export type AdminAssistantAutopilotMetric = {
  prepared: number;
  blocked: number;
  failed: number;
  humanApprovedAndSentOffers: number;
  sampleSize: number;
};

export type AdminAssistantSuggestionMetric = {
  accepted: number;
  modified: number;
  dismissed: number;
  stale: number;
  sampleSize: number;
};

export type AdminAssistantDurationMetric = {
  medianMinutes: number | null;
  p90Minutes: number | null;
  sampleSize: number;
  cohortSize: number;
};

export type AdminAssistantPeriodMetrics = {
  period: AdminAssistantMetricPeriod;
  autopilot: AdminAssistantAutopilotMetric;
  suggestions: AdminAssistantSuggestionMetric;
  leadToFirstPriceOffer: AdminAssistantDurationMetric;
  sentPriceOfferToOutcome: AdminAssistantDurationMetric;
};

export type AdminAssistantMetrics = {
  generatedAt: string;
  title: 'Prevádzkové ukazovatele asistenta';
  evidenceKind: 'operational_indicators_not_proven_savings';
  disclaimer: string;
  current: AdminAssistantPeriodMetrics;
  previous: AdminAssistantPeriodMetrics;
  coverage: {
    complete: boolean;
    autopilotRunLimitReached: boolean;
    priceOfferLimitReached: boolean;
    suggestionAuditLimitReached: boolean;
  };
};

type MetricsLead = Pick<Lead, 'id' | 'createdAt' | 'deletedAt' | 'isTestData'>;
type MetricsJob = Pick<OperationalBusinessJob, 'id' | 'leadId' | 'deletedAt' | 'isTestData'>;
type MetricsOffer = Pick<PriceOffer,
  'id' | 'jobId' | 'leadId' | 'sourceJobIds' | 'sourceInquiry' | 'createdAt' | 'sentAt' | 'outcomeUpdatedAt' | 'deletedAt' | 'isTestData'
>;
type MetricsRun = Pick<AdminAutopilotRun, 'id' | 'trigger'>;
type MetricsRunItem = Pick<AdminAutopilotRunItem, 'runId' | 'module' | 'entityId' | 'outcome' | 'createdAt'>;
type MetricsSuggestionDecision = { createdAt: string; outcome: 'accepted' | 'modified' | 'dismissed' | 'stale' };

export type AdminAssistantMetricInputs = {
  now: Date;
  runs: MetricsRun[];
  runItems: MetricsRunItem[];
  leads: MetricsLead[];
  jobs: MetricsJob[];
  offers: MetricsOffer[];
  eligiblePhotoEntityIds?: string[];
  suggestionDecisions?: MetricsSuggestionDecision[];
  coverage?: Partial<AdminAssistantMetrics['coverage']>;
};

function timestamp(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inPeriod(value: string | undefined, period: AdminAssistantMetricPeriod) {
  const time = timestamp(value);
  const from = timestamp(period.fromInclusive);
  const to = timestamp(period.toExclusive);
  return time !== null && from !== null && to !== null && time >= from && time < to;
}

function periodBefore(toExclusive: Date): AdminAssistantMetricPeriod {
  return {
    fromInclusive: new Date(toExclusive.getTime() - ROLLING_PERIOD_DAYS * DAY_MS).toISOString(),
    toExclusive: toExclusive.toISOString(),
  };
}

function roundMinute(value: number) {
  return Math.round(value * 10) / 10;
}

/** Nearest-rank percentile: deterministic even for small operational samples. */
export function nearestRankPercentile(values: number[], percentile: number) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!finite.length) return null;
  const boundedPercentile = Math.max(0, Math.min(1, percentile));
  const rank = Math.max(1, Math.ceil(boundedPercentile * finite.length));
  return finite[rank - 1];
}

export function summarizeDurationsMinutes(values: number[], cohortSize: number): AdminAssistantDurationMetric {
  const finite = values.filter((value) => Number.isFinite(value) && value >= 0).sort((left, right) => left - right);
  if (!finite.length) return { medianMinutes: null, p90Minutes: null, sampleSize: 0, cohortSize };
  const middle = Math.floor(finite.length / 2);
  const median = finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
  const p90 = nearestRankPercentile(finite, 0.9);
  return {
    medianMinutes: roundMinute(median),
    p90Minutes: p90 === null ? null : roundMinute(p90),
    sampleSize: finite.length,
    cohortSize,
  };
}

function directLeadId(offer: MetricsOffer) {
  if (offer.leadId) return offer.leadId;
  return /^dopyt:([0-9a-f-]{36})$/i.exec(offer.sourceInquiry?.trim() || '')?.[1];
}

function isEligibleOffer(
  offer: MetricsOffer,
  eligibleLeadIds: Set<string>,
  eligibleJobIds: Set<string>,
) {
  if (offer.deletedAt || offer.isTestData) return false;
  const relatedJobIds = [...new Set([offer.jobId, ...(offer.sourceJobIds ?? [])].filter(Boolean) as string[])];
  if (relatedJobIds.some((jobId) => !eligibleJobIds.has(jobId))) return false;
  const linkedLeadId = directLeadId(offer);
  return !linkedLeadId || eligibleLeadIds.has(linkedLeadId);
}

function linkedLeadId(offer: MetricsOffer, jobLeadIds: Map<string, string>) {
  const direct = directLeadId(offer);
  if (direct) return direct;
  const relatedLeadIds = new Set([offer.jobId, ...(offer.sourceJobIds ?? [])]
    .flatMap((jobId) => jobId && jobLeadIds.has(jobId) ? [jobLeadIds.get(jobId)!] : []));
  return relatedLeadIds.size === 1 ? [...relatedLeadIds][0] : undefined;
}

function summarizeAutopilot(
  period: AdminAssistantMetricPeriod,
  runs: MetricsRun[],
  items: MetricsRunItem[],
  eligibleLeadIds: Set<string>,
  eligibleJobIds: Set<string>,
  eligiblePhotoEntityIds: Set<string>,
  offers: MetricsOffer[],
): AdminAssistantAutopilotMetric {
  const productionRunIds = new Set(runs.filter((run) => run.trigger !== 'test').map((run) => run.id));
  const eligibleOffersById = new Map(offers
    .filter((offer) => isEligibleOffer(offer, eligibleLeadIds, eligibleJobIds))
    .map((offer) => [offer.id, offer] as const));
  const eligible = items.filter((item) => productionRunIds.has(item.runId)
    && inPeriod(item.createdAt, period)
    && (item.module === 'photo_intake'
      ? eligiblePhotoEntityIds.has(item.entityId)
      : item.module === 'offers' && item.outcome === 'created'
        // New rows identify the exact offer; the job fallback keeps historical
        // prepared counts readable but is never enough for the approval metric.
        ? eligibleOffersById.has(item.entityId) || eligibleJobIds.has(item.entityId)
        : eligibleJobIds.has(item.entityId)));
  const prepared = eligible.filter((item) => item.outcome === 'created').length;
  const blocked = eligible.filter((item) => item.outcome === 'blocked').length;
  const failed = eligible.filter((item) => item.outcome === 'failed').length;
  const humanApprovedAndSentOffers = eligible.filter((item) => item.module === 'offers' && item.outcome === 'created')
    .filter((item) => {
      const offer = eligibleOffersById.get(item.entityId);
      return offer && timestamp(offer.sentAt) !== null
        && (timestamp(offer.sentAt) as number) >= (timestamp(item.createdAt) ?? Number.POSITIVE_INFINITY);
    }).length;
  return { prepared, blocked, failed, humanApprovedAndSentOffers, sampleSize: prepared + blocked + failed };
}

function summarizeSuggestions(period: AdminAssistantMetricPeriod, decisions: MetricsSuggestionDecision[]): AdminAssistantSuggestionMetric {
  const eligible = decisions.filter((decision) => inPeriod(decision.createdAt, period));
  const count = (outcome: MetricsSuggestionDecision['outcome']) => eligible.filter((decision) => decision.outcome === outcome).length;
  return { accepted: count('accepted'), modified: count('modified'), dismissed: count('dismissed'), stale: count('stale'), sampleSize: eligible.length };
}

function summarizeLeadToFirstOffer(
  period: AdminAssistantMetricPeriod,
  leads: MetricsLead[],
  offers: MetricsOffer[],
  eligibleLeadIds: Set<string>,
  eligibleJobIds: Set<string>,
  jobLeadIds: Map<string, string>,
) {
  const cohort = leads.filter((lead) => !lead.deletedAt && !lead.isTestData && inPeriod(lead.createdAt, period));
  const firstOfferByLead = new Map<string, number>();
  for (const offer of offers) {
    if (!isEligibleOffer(offer, eligibleLeadIds, eligibleJobIds)) continue;
    const leadId = linkedLeadId(offer, jobLeadIds);
    const offerCreatedAt = timestamp(offer.createdAt);
    if (!leadId || offerCreatedAt === null) continue;
    const existing = firstOfferByLead.get(leadId);
    if (existing === undefined || offerCreatedAt < existing) firstOfferByLead.set(leadId, offerCreatedAt);
  }
  const durations = cohort.flatMap((lead) => {
    const leadCreatedAt = timestamp(lead.createdAt);
    const firstOfferAt = firstOfferByLead.get(lead.id);
    return leadCreatedAt !== null && firstOfferAt !== undefined && firstOfferAt >= leadCreatedAt
      ? [(firstOfferAt - leadCreatedAt) / 60_000]
      : [];
  });
  return summarizeDurationsMinutes(durations, cohort.length);
}

function summarizeSentOfferToOutcome(
  period: AdminAssistantMetricPeriod,
  offers: MetricsOffer[],
  eligibleLeadIds: Set<string>,
  eligibleJobIds: Set<string>,
) {
  const cohort = offers.filter((offer) => isEligibleOffer(offer, eligibleLeadIds, eligibleJobIds)
    && inPeriod(offer.sentAt, period));
  const durations = cohort.flatMap((offer) => {
    const sentAt = timestamp(offer.sentAt);
    const outcomeAt = timestamp(offer.outcomeUpdatedAt);
    return sentAt !== null && outcomeAt !== null && outcomeAt > sentAt
      ? [(outcomeAt - sentAt) / 60_000]
      : [];
  });
  return summarizeDurationsMinutes(durations, cohort.length);
}

export function buildAdminAssistantMetrics(input: AdminAssistantMetricInputs): AdminAssistantMetrics {
  if (!Number.isFinite(input.now.getTime())) throw new Error('Neplatný dátum výpočtu ukazovateľov asistenta.');
  const current = periodBefore(input.now);
  const previous = periodBefore(new Date(timestamp(current.fromInclusive) as number));
  const eligibleLeads = input.leads.filter((lead) => !lead.deletedAt && !lead.isTestData);
  const eligibleLeadIds = new Set(eligibleLeads.map((lead) => lead.id));
  const eligibleJobs = input.jobs.filter((job) => !job.deletedAt && !job.isTestData
    && (!job.leadId || eligibleLeadIds.has(job.leadId)));
  const eligibleJobIds = new Set(eligibleJobs.map((job) => job.id));
  const eligiblePhotoEntityIds = new Set(input.eligiblePhotoEntityIds ?? []);
  const jobLeadIds = new Map(eligibleJobs.flatMap((job) => job.leadId ? [[job.id, job.leadId] as const] : []));
  const summarizePeriod = (period: AdminAssistantMetricPeriod): AdminAssistantPeriodMetrics => ({
    period,
    autopilot: summarizeAutopilot(
      period, input.runs, input.runItems, eligibleLeadIds, eligibleJobIds, eligiblePhotoEntityIds, input.offers,
    ),
    suggestions: summarizeSuggestions(period, input.suggestionDecisions ?? []),
    leadToFirstPriceOffer: summarizeLeadToFirstOffer(
      period, eligibleLeads, input.offers, eligibleLeadIds, eligibleJobIds, jobLeadIds,
    ),
    sentPriceOfferToOutcome: summarizeSentOfferToOutcome(period, input.offers, eligibleLeadIds, eligibleJobIds),
  });
  const coverage = {
    autopilotRunLimitReached: Boolean(input.coverage?.autopilotRunLimitReached),
    priceOfferLimitReached: Boolean(input.coverage?.priceOfferLimitReached),
    suggestionAuditLimitReached: Boolean(input.coverage?.suggestionAuditLimitReached),
    complete: input.coverage?.complete !== false
      && !input.coverage?.autopilotRunLimitReached
      && !input.coverage?.priceOfferLimitReached
      && !input.coverage?.suggestionAuditLimitReached,
  };
  return {
    generatedAt: input.now.toISOString(),
    title: 'Prevádzkové ukazovatele asistenta',
    evidenceKind: 'operational_indicators_not_proven_savings',
    disclaimer: 'Ide o prevádzkové ukazovatele z evidovaných udalostí, nie o dokázanú úsporu času ani príčinný vplyv asistenta.',
    current: summarizePeriod(current),
    previous: summarizePeriod(previous),
    coverage,
  };
}

async function listAllEligibleLeads(
  listLeadSummaryPage: typeof import('./db').listLeadSummaryPage,
): Promise<MetricsLead[]> {
  const first = await listLeadSummaryPage({ page: 1, pageSize: 100, excludeTestData: true });
  const remaining = first.totalPages > 1
    ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) =>
      listLeadSummaryPage({ page: index + 2, pageSize: 100, excludeTestData: true })))
    : [];
  return [first, ...remaining].flatMap((page) => page.items.map((lead) => ({
    id: lead.id,
    createdAt: lead.createdAt,
    deletedAt: lead.deletedAt,
    isTestData: lead.isTestData,
  })));
}

/**
 * Server-only, read-only DTO pre superadmin rozhranie. Nevracia mená, kontakty,
 * poznámky ani identifikátory jednotlivých zákazníkov.
 */
export async function getAdminAssistantMetrics(
  role: AdminRole,
  now = new Date(),
): Promise<AdminAssistantMetrics> {
  if (role !== 'SUPER_ADMIN') throw new Error('Prevádzkové ukazovatele asistenta sú dostupné iba superadminovi.');
  const db = await import('./db');
  const runsPromise = db.listAdminAutopilotRuns(100);
  const [runs, leads, jobs, offers, auditLogs] = await Promise.all([
    runsPromise,
    listAllEligibleLeads(db.listLeadSummaryPage),
    db.listOperationalBusinessJobs({ limit: null, excludeTestData: true }),
    db.listPriceOffers(),
    db.listAuditLogs(1000),
  ]);
  const itemGroups = await Promise.all(runs.filter((run) => run.trigger !== 'test')
    .map((run) => db.listAdminAutopilotRunItems(run.id)));
  const runItems = itemGroups.flat();
  const eligiblePhotoEntityIds = await db.listEligibleAdminAssistantPhotoIds(runItems
    .filter((item) => item.module === 'photo_intake')
    .map((item) => item.entityId));
  return buildAdminAssistantMetrics({
    now,
    runs,
    runItems,
    leads,
    jobs,
    offers,
    eligiblePhotoEntityIds,
    suggestionDecisions: auditLogs.filter((log) => log.action === 'admin_assistant_suggestion_decision').flatMap((log) => {
      const outcome = String(log.changes.outcome || '');
      return ['accepted', 'modified', 'dismissed', 'stale'].includes(outcome)
        ? [{ createdAt: log.createdAt, outcome: outcome as MetricsSuggestionDecision['outcome'] }]
        : [];
    }),
    coverage: {
      autopilotRunLimitReached: runs.length === 100,
      priceOfferLimitReached: offers.length === 1000,
      suggestionAuditLimitReached: auditLogs.length === 1000,
    },
  });
}
