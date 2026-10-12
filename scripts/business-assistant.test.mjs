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

test('assistant integration stays read-only and server-authorized', async () => {
  const [serverSource, pageSource] = await Promise.all([
    readFile(new URL('../src/server/business-assistant.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/asistent/page.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(pageSource, /requireAdminUser\(\)/);
  assert.match(serverSource, /role === 'SUPER_ADMIN'/);
  assert.doesNotMatch(serverSource, /\b(save|update|delete|archive|send)[A-Z][A-Za-z]+\(/);
  assert.doesNotMatch(pageSource, /<form|action=|use client/);
});
