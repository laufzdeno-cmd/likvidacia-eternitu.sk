import type { BusinessJob, Lead, LeadAttributionReportRow, PriceOffer, Quote } from './types';

type OfferStage = { issued: boolean; accepted: boolean };

/** Counts lead outcomes, never documents. Archived jobs/offers retain their historical link. */
export function getLeadOfferStages(
  leads: Lead[], quotes: Quote[], jobs: BusinessJob[], priceOffers: PriceOffer[], sinceMs: number,
): Map<string, OfferStage> {
  const stages = new Map<string, OfferStage>();
  for (const lead of leads) {
    if (!lead.deletedAt && !lead.isTestData && new Date(lead.createdAt).getTime() >= sinceMs) {
      stages.set(lead.id, { issued: false, accepted: false });
    }
  }

  for (const quote of quotes) {
    const stage = stages.get(quote.leadId);
    if (!stage) continue;
    if (['sent', 'accepted', 'rejected', 'expired'].includes(quote.status)) stage.issued = true;
    if (quote.status === 'accepted') stage.accepted = true;
  }

  const leadByJob = new Map(jobs
    .filter((job) => job.leadId)
    .map((job) => [job.id, job.leadId!]));
  const testLeadIds = new Set(leads.filter((lead) => lead.isTestData).map((lead) => lead.id));
  const testJobIds = new Set(jobs.filter((job) => job.isTestData || (job.leadId && testLeadIds.has(job.leadId))).map((job) => job.id));
  for (const offer of priceOffers) {
    const directLeadId = /^dopyt:([0-9a-f-]{36})$/i.exec(offer.sourceInquiry || '')?.[1]?.toLowerCase();
    if (offer.isTestData || testJobIds.has(offer.jobId || '') || (offer.sourceJobIds ?? []).some((id) => testJobIds.has(id))
      || testLeadIds.has(offer.leadId || '') || testLeadIds.has(directLeadId || '')) continue;
    const linkedLeadIds = new Set([offer.jobId, ...(offer.sourceJobIds ?? [])].map((id) => leadByJob.get(id || '')).filter(Boolean));
    const historicalLeadId = linkedLeadIds.size === 1 ? [...linkedLeadIds][0] : undefined;
    // An actively linked job owns a legacy offer before its stale source-inquiry hint.
    const ownerId = offer.leadId || (offer.jobId ? leadByJob.get(offer.jobId) : undefined)
      || (directLeadId && leads.some((lead) => lead.id === directLeadId) ? directLeadId : undefined)
      || (offer.jobId ? undefined : historicalLeadId);
    const stage = stages.get(ownerId || '');
    if (!stage) continue;
    if (offer.status === 'ODOSLANA' || offer.status === 'PRIJATA') stage.issued = true;
    if (offer.status === 'PRIJATA') stage.accepted = true;
  }
  return stages;
}

function field(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 160) : '';
}

function compareCodePoints(left: string, right: string) {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0) ?? 0);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0) ?? 0);
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
}

export function summarizeLeadAttribution(
  leads: Lead[],
  quotes: Quote[],
  jobs: BusinessJob[],
  priceOffers: PriceOffer[],
  sinceMs: number,
  maxRows: number | null = 50,
): LeadAttributionReportRow[] {
  const recentLeads = leads.filter((lead) => !lead.deletedAt && !lead.isTestData && new Date(lead.createdAt).getTime() >= sinceMs);
  const stages = getLeadOfferStages(leads, quotes, jobs, priceOffers, sinceMs);

  const groups = new Map<string, LeadAttributionReportRow>();
  for (const lead of recentLeads) {
    const rawAttribution = lead.rawData?.attribution;
    const attribution = rawAttribution && typeof rawAttribution === 'object' && !Array.isArray(rawAttribution)
      ? rawAttribution as Record<string, unknown>
      : {};
    const utmSource = field(attribution.utmSource);
    const source = utmSource || (attribution.gclid || attribution.gbraid || attribution.wbraid ? 'Google Ads' : attribution.fbclid ? 'Meta' : 'Nezachytený zdroj');
    const medium = field(attribution.utmMedium) || 'Neuvedené';
    const campaign = field(attribution.utmCampaign) || 'Bez označenia';
    const key = `${source}\u0000${medium}\u0000${campaign}`;
    const row = groups.get(key) ?? { source, medium, campaign, leads: 0, leadsWithIssuedOffer: 0, leadsWithAcceptedOffer: 0, progressedLeads: 0 };
    const stage = stages.get(lead.id);
    row.leads += 1;
    if (stage?.issued) row.leadsWithIssuedOffer += 1;
    if (stage?.accepted) row.leadsWithAcceptedOffer += 1;
    if (['objednane', 'v_realizacii', 'dokoncena'].includes(lead.status)) row.progressedLeads += 1;
    groups.set(key, row);
  }

  return [...groups.values()]
    .sort((left, right) => right.leads - left.leads
      || compareCodePoints(left.source, right.source)
      || compareCodePoints(left.medium, right.medium)
      || compareCodePoints(left.campaign, right.campaign))
    .slice(0, maxRows === null ? undefined : Math.max(1, Math.min(10000, Math.round(maxRows))));
}
