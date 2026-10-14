import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildBusinessAssistantPriorities } from '../src/lib/business-assistant.ts';

const base = {
  queues: { total: 0, newLeads: 0, unassigned: 0, followups: 0, waiting: 0, quote: 0, active: 0 },
  mail: { overduePending: 0, staleSending: 0, failed: 0, unknown: 0, oldestAttentionLeadId: null },
  planner: { todayOpen: 0, tomorrowOpen: 0 },
};

test('operator never receives superadmin finance or system priorities', () => {
  const priorities = buildBusinessAssistantPriorities({
    ...base,
    role: 'OPERATOR',
    superadmin: {
      finance: { currentOverdueCents: 50000, currentOutstandingCents: 50000, currentUnallocatedCents: 10000, jobsWithEvidence: 1 },
      jobsWithoutRecordedDirectCosts: 2,
      health: { databaseOk: false, storageOk: false, leadMailLevel: 'error' },
      funnel: { leadsReceived: 4, offersCreated: 0, offersSent: 0, offersAccepted: 0 },
    },
  });
  assert.deepEqual(priorities.map((item) => item.id), ['all-clear']);
});

test('operational warnings are ordered and finance stays superadmin-only', () => {
  const operator = buildBusinessAssistantPriorities({
    ...base,
    role: 'OPERATOR',
    operations: { stalledJobs: 2, silentOffers: 3, referenceCandidates: 1, overdueInvoices: 4, overdueInvoicesCents: 90000, capacityCollisions: 1, dataQualityIssues: 5 },
  });
  const ids = operator.map((item) => item.id);
  assert.equal(ids.includes('stalled-jobs'), true);
  assert.equal(ids.includes('silent-offers'), true);
  assert.equal(ids.includes('capacity-collisions'), true);
  assert.equal(ids.includes('data-quality'), true);
  assert.equal(ids.includes('reference-candidates'), true);
  assert.equal(ids.includes('overdue-invoices'), false);
  assert.equal(ids.indexOf('stalled-jobs') < ids.indexOf('reference-candidates'), true);

  const superadmin = buildBusinessAssistantPriorities({
    ...base,
    role: 'SUPER_ADMIN',
    operations: { stalledJobs: 0, silentOffers: 0, referenceCandidates: 0, overdueInvoices: 2, overdueInvoicesCents: 120000, capacityCollisions: 0, dataQualityIssues: 0 },
    superadmin: {
      finance: { currentOverdueCents: 120000, currentOutstandingCents: 120000, currentUnallocatedCents: 0, jobsWithEvidence: 2 },
      jobsWithoutRecordedDirectCosts: 0,
      health: { databaseOk: true, storageOk: true, leadMailLevel: 'ok' },
      funnel: { leadsReceived: 0, offersCreated: 0, offersSent: 0, offersAccepted: 0 },
    },
  });
  assert.deepEqual(superadmin.filter((item) => item.id.includes('overdue')).map((item) => item.id), ['overdue-finance']);
});
test('delivery ambiguity and followups are ranked before ordinary lead work', () => {
  const priorities = buildBusinessAssistantPriorities({
    ...base,
    role: 'OPERATOR',
    queues: { ...base.queues, newLeads: 3, followups: 2, quote: 1 },
    mail: { ...base.mail, unknown: 1, oldestAttentionLeadId: 'lead-1' },
  });
  assert.deepEqual(priorities.slice(0, 3).map((item) => item.id), ['mail-attention', 'followups', 'new-leads']);
  assert.match(priorities[0].detail, /neznámy výsledok/);
  assert.equal(priorities[0].href, '/admin/dopyty/lead-1');
});

test('superadmin receives finance, data quality and system priorities', () => {
  const priorities = buildBusinessAssistantPriorities({
    ...base,
    role: 'SUPER_ADMIN',
    superadmin: {
      finance: { currentOverdueCents: 150000, currentOutstandingCents: 200000, currentUnallocatedCents: 25000, jobsWithEvidence: 3 },
      jobsWithoutRecordedDirectCosts: 2,
      health: { databaseOk: true, storageOk: false, leadMailLevel: 'warning' },
      funnel: { leadsReceived: 8, offersCreated: 0, offersSent: 0, offersAccepted: 0 },
    },
  });
  const ids = new Set(priorities.map((item) => item.id));
  for (const id of ['system-health', 'overdue-finance', 'unallocated-finance', 'missing-costs', 'funnel-gap']) assert.equal(ids.has(id), true, id);
});

test('automatic assistant stays read-only while manual task actions are isolated and authorized', async () => {
  const [serverSource, pageSource, actionSource] = await Promise.all([
    readFile(new URL('../src/server/business-assistant.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/asistent/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/asistent/actions.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(pageSource, /requireAdminUser\(\)/);
  assert.match(serverSource, /role === 'SUPER_ADMIN'/);
  assert.doesNotMatch(serverSource, /\b(save|update|delete|archive|send)[A-Z][A-Za-z]+\(/);
  assert.doesNotMatch(serverSource, /createAdminWorkItem|updateAdminWorkItem|transitionAdminWorkItem/);
  assert.match(actionSource, /verifyCsrf\(formData\)/);
  assert.match(actionSource, /requireAdminUser\(\)/);
  assert.match(actionSource, /createAdminWorkItem/);
  assert.match(actionSource, /updateAdminWorkItem/);
  assert.match(actionSource, /transitionAdminWorkItem/);
  assert.doesNotMatch(actionSource, /send[A-Z]|priceOffer|payment|publish|delete[A-Z]/i);
});
