import 'server-only';

import { businessPeriodBounds, businessTodayKey } from '@/src/lib/business-period';
import { summarizeBusinessJobs } from '@/src/lib/business-dashboard-metrics';
import { buildBusinessAssistantPriorities } from '@/src/lib/business-assistant';
import type { AdminRole, LeadSummary, PlannerAction } from './types';
import {
  getBusinessFinanceSummary,
  getLeadDashboardMetrics,
  getLeadEmailOutboxAttention,
  getLeadQueueCounts,
  getPriceOfferEventMetrics,
  getSystemHealth,
  listBusinessJobs,
  listLeadSummaryPage,
  listPlannerActions,
} from './db';

function nextDateKey(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function isOpenPlannerAction(action: PlannerAction) {
  return action.status !== 'DOKONCENA' && action.status !== 'ZRUSENA';
}

function leadPreview(lead: LeadSummary) {
  return {
    id: lead.id,
    fullName: lead.fullName,
    city: lead.city,
    areaEstimate: lead.areaEstimate,
    status: lead.status,
    fileCount: lead.fileCount,
    ownerEmail: lead.ownerEmail || '',
    followupDate: lead.followupDate || '',
    nextAction: lead.nextAction || '',
  };
}

export async function getBusinessAssistantBriefing(role: AdminRole, now = new Date()) {
  const today = businessTodayKey(now);
  const tomorrow = nextDateKey(today);
  const month = businessPeriodBounds('month', undefined, undefined, now);

  const superadminData = role === 'SUPER_ADMIN'
    ? Promise.all([
        listBusinessJobs({ from: month.from, to: month.to, limit: null, excludeTestData: true }),
        getBusinessFinanceSummary(month.from, month.to),
        getSystemHealth(),
        getLeadDashboardMetrics(month.from, month.to, today),
        getPriceOfferEventMetrics(month.from, month.to),
      ])
    : Promise.resolve(null);

  const [queues, mail, todayActions, tomorrowActions, newLeads, followups, quoteLeads, superData] = await Promise.all([
    getLeadQueueCounts(today, true),
    getLeadEmailOutboxAttention(),
    listPlannerActions({ from: today, to: today }),
    listPlannerActions({ from: tomorrow, to: tomorrow }),
    listLeadSummaryPage({ queue: 'new', today, page: 1, pageSize: 10, excludeTestData: true }),
    listLeadSummaryPage({ queue: 'followup', today, page: 1, pageSize: 10, excludeTestData: true }),
    listLeadSummaryPage({ queue: 'quote', today, page: 1, pageSize: 10, excludeTestData: true }),
    superadminData,
  ]);

  const openTodayActions = todayActions.filter(isOpenPlannerAction);
  const openTomorrowActions = tomorrowActions.filter(isOpenPlannerAction);
  const superadmin = superData
    ? (() => {
        const [jobs, finance, health, leadMetrics, offerEvents] = superData;
        const business = summarizeBusinessJobs(jobs);
        return {
          finance,
          jobsWithoutRecordedDirectCosts: business.jobsWithoutRecordedDirectCosts,
          business: {
            activeJobs: business.activeJobs.length,
            recordedOrderValue: business.recordedOrderValue,
            recordedDirectCosts: business.directCosts + business.rewards,
          },
          health,
          funnel: {
            leadsReceived: leadMetrics.receivedInPeriod,
            offersCreated: offerEvents.created,
            offersSent: offerEvents.sent,
            offersAccepted: offerEvents.accepted,
          },
        };
      })()
    : null;

  const priorities = buildBusinessAssistantPriorities({
    role,
    queues,
    mail,
    planner: { todayOpen: openTodayActions.length, tomorrowOpen: openTomorrowActions.length },
    superadmin: superadmin
      ? {
          finance: superadmin.finance,
          jobsWithoutRecordedDirectCosts: superadmin.jobsWithoutRecordedDirectCosts,
          health: {
            databaseOk: superadmin.health.database.ok,
            storageOk: superadmin.health.storage.ok,
            leadMailLevel: superadmin.health.leadMail.level,
          },
          funnel: superadmin.funnel,
        }
      : undefined,
  });

  return {
    role,
    generatedAt: now.toISOString(),
    today,
    tomorrow,
    priorities,
    queues,
    mail,
    planner: {
      today: openTodayActions,
      tomorrow: openTomorrowActions,
    },
    leads: {
      new: newLeads.items.map(leadPreview),
      followups: followups.items.map(leadPreview),
      quote: quoteLeads.items.map(leadPreview),
    },
    superadmin,
  };
}
