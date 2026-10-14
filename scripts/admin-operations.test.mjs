import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildJobClosureChecklist,
  buildOfferFollowUpDraft,
  buildOperationalTimeline,
  buildOperationsTimeline,
  buildReceivableQueue,
  findPlannerCollisions,
  getJobAttention,
} from '../src/lib/admin-operations.ts';

const job = {
  id: '11111111-1111-4111-8111-111111111111', leadId: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-20T08:00:00.000Z', demolitionDate: '2026-10-10',
  customerName: 'Ján Test', customerPhone: '0900000000', customerEmail: 'jan@example.sk', location: 'Poprad', district: 'Poprad',
  materialType: 'Vlnitý eternit', objectType: 'Rodinný dom', term: '', leadSource: 'web', preferredContact: 'email',
  m2: 100, pricePerM2: 12, totalPrice: 1200, paymentType: 'FAKTURA', workType: 'DEMONTAZ_A_ODVOZ', wasteKg: 1200,
  landfill: 'INA', status: 'VYUCTOVANIE', note: '', workers: [],
  costs: { jobId: '11111111-1111-4111-8111-111111111111', fuel: 100, suits: 40, gloves: 20, penetrant: 10, landfillCost: 100, otherName: '', otherAmount: 0, total: 270 },
  rewardsTotal: 200, grossProfit: 730, marginPercent: 60.8,
};

const invoice = {
  id: '33333333-3333-4333-8333-333333333333', jobId: job.id, operationId: '44444444-4444-4444-8444-444444444444', requestHash: 'x',
  invoiceNumber: '2026-001', issuedOn: '2026-10-01', dueOn: '2026-10-08', amountWithoutVatCents: 100000, vatRateBasisPoints: 2300,
  amountWithVatCents: 123000, createdAt: '2026-10-01T08:00:00.000Z', createdBy: 'admin@example.sk',
};

const finance = {
  invoices: [invoice], paymentEvents: [], invoiceBalances: [{ invoiceId: invoice.id, receivedCents: 0, outstandingCents: 123000, overpaidCents: 0, overdue: true, status: 'OVERDUE' }],
  activeInvoicedCents: 123000, netReceivedCents: 0, allocatedReceivedCents: 0, outstandingCents: 123000, overdueCents: 123000,
  unallocatedReceivedCents: 0, overpaidCents: 0, requiresReview: false, oldestDueOn: '2026-10-08',
};

test('closure checklist exposes missing operational evidence instead of guessing completion', () => {
  const checklist = buildJobClosureChecklist({ job, offers: [], finance, plannerActions: [], photoEvidence: { status: 'available', approvedCount: 0, pendingCount: 2 } });
  assert.equal(checklist.length, 8);
  assert.equal(checklist.find((item) => item.id === 'invoice')?.state, 'done');
  assert.equal(checklist.find((item) => item.id === 'payment')?.state, 'attention');
  assert.equal(checklist.find((item) => item.id === 'photos')?.state, 'attention');
  assert.equal(checklist.find((item) => item.id === 'review')?.state, 'missing');
});

test('closure checklist keeps unavailable photo evidence unknown and surfaces failed review delivery', () => {
  const checklist = buildJobClosureChecklist({
    job,
    offers: [],
    finance,
    plannerActions: [],
    photoEvidence: { status: 'unknown' },
    reviewRequest: {
      id: '55555555-5555-4555-8555-555555555555', jobId: job.id, customerName: job.customerName,
      customerEmail: job.customerEmail, subject: 'Referencia', message: 'Prosba o referenciu',
      status: 'delivery_failed', createdBy: 'admin@example.sk', revision: 2,
      createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-02T08:00:00.000Z',
    },
  });
  assert.equal(checklist.find((item) => item.id === 'photos')?.state, 'unknown');
  assert.match(checklist.find((item) => item.id === 'photos')?.detail || '', /nepodarilo overiť/i);
  assert.equal(checklist.find((item) => item.id === 'review')?.state, 'missing');
  assert.match(checklist.find((item) => item.id === 'review')?.detail || '', /zlyhalo/i);
});

test('timeline combines channels, sorts newest first and removes duplicate audit projections', () => {
  const timeline = buildOperationsTimeline({
    auditLogs: [{ id: 'a', entityType: 'business_job', entityId: job.id, action: 'business_job_note_added', actorEmail: 'admin@example.sk', changes: { note: 'Volané zákazníkovi' }, createdAt: '2026-10-02T08:00:00.000Z' }],
    offers: [], finance, plannerActions: [],
    emailDeliveries: [{ recipientRole: 'customer', status: 'sent', attempts: 1, updatedAt: '2026-10-03T08:00:00.000Z' }],
  });
  assert.equal(timeline[0].title, 'Email zákazníkovi');
  assert.ok(timeline.some((item) => item.detail === 'Volané zákazníkovi'));
});

test('operator timeline explains offer follow-up and excludes finance and actor identity', () => {
  const timeline = buildOperationalTimeline({
    auditLogs: [
      { id: 'finance', entityType: 'business_job', entityId: job.id, action: 'business_payment_recorded', actorEmail: 'owner@example.sk', changes: {}, createdAt: '2026-10-04T08:00:00.000Z' },
      { id: 'generic', entityType: 'business_job', entityId: job.id, action: 'business_job_updated', actorEmail: 'owner@example.sk', changes: {}, createdAt: '2026-10-02T08:00:00.000Z' },
      { id: 'follow-up-audit', entityType: 'business_job', entityId: job.id, action: 'price_offer_follow_up_sent', actorEmail: 'owner@example.sk', changes: {}, createdAt: '2026-10-03T08:00:00.000Z' },
    ],
    offers: [],
    plannerActions: [],
    followUps: [{ id: 'follow-up', offerNumber: 'CP-2026-1', subject: 'Doplnenie k ponuke', status: 'sent', createdAt: '2026-10-03T08:00:00.000Z', updatedAt: '2026-10-03T08:01:00.000Z' }],
  });
  assert.ok(timeline.some((item) => item.title === 'Follow-up ponuky CP-2026-1'));
  assert.ok(timeline.some((item) => /Predmet: Doplnenie k ponuke/.test(item.detail) && /Email bol odoslaný/.test(item.detail)));
  assert.ok(!timeline.some((item) => item.category === 'finance' || item.title.includes('úhrada')));
  assert.ok(!timeline.some((item) => item.detail.includes('owner@example.sk')));
  assert.equal(timeline.filter((item) => item.title.startsWith('Follow-up ponuky')).length, 1);
});

test('stalled job rules are status aware and completed jobs never alert', () => {
  const stuck = getJobAttention({ ...job, status: 'PONUKA_ODOSLANA' }, '2026-10-10T08:00:00.000Z');
  assert.equal(stuck?.severity, 'critical');
  assert.match(stuck?.detail || '', /overte históriu/i);
  assert.equal(getJobAttention({ ...job, status: 'PONUKA_ODOSLANA' }, '2026-10-10T08:00:00.000Z', { hasRecordedFollowUp: true }), null);
  assert.equal(getJobAttention({ ...job, status: 'URADY_SCHVALENE' }, '2026-10-10T08:00:00.000Z', { hasActivePlannerAction: true }), null);
  assert.equal(getJobAttention({ ...job, status: 'DOKONCENA' }, '2026-10-10T08:00:00.000Z'), null);
});

test('planner collision detects only active overlapping actions sharing a worker', () => {
  const base = { date: '2026-10-20', type: 'DEMONTAZ', address: 'Poprad', status: 'NAPLANOVANA', notify2Days: false, notify1Day: false, notifyCustomer: false, createdAt: '2026-10-01T00:00:00.000Z', notify2DaysSent: false, notify1DaySent: false, notifyCustomerSent: false };
  const collisions = findPlannerCollisions([
    { ...base, id: 'a', timeFrom: '08:00', timeTo: '12:00', workers: 'Robo, Maťo' },
    { ...base, id: 'b', timeFrom: '11:30', timeTo: '15:00', workers: 'Robo' },
    { ...base, id: 'c', timeFrom: '11:30', timeTo: '15:00', workers: 'Jano' },
    { ...base, id: 'd', timeFrom: '10:00', timeTo: '11:00', workers: 'Maťo', status: 'ZRUSENA' },
  ]);
  assert.deepEqual(collisions.map((item) => item.worker), ['Robo']);
});

test('receivable queue excludes paid cases and puts overdue first', () => {
  const queue = buildReceivableQueue([job], [invoice], [], '2026-10-14');
  assert.equal(queue.length, 1);
  assert.equal(queue[0].tone, 'danger');
  assert.equal(queue[0].finance.overdueCents, 123000);
});

test('follow-up stays a draft with concrete offer facts', () => {
  const draft = buildOfferFollowUpDraft({
    id: 'offer', number: 'CP-2026-1', createdAt: '2026-10-01T00:00:00.000Z', status: 'ODOSLANA', contactPerson: 'Ján Test', municipality: 'Poprad', objectAddress: 'Poprad', district: 'Poprad', phone: '0900', email: 'jan@example.sk', objectType: 'Dom', realizationTerm: '', materialType: 'VLNITY_ETERNIT', areaM2: 100, pricePerM2WithoutVat: 10, documentationFeeWithoutVat: 0, includeDocumentation: false, documentationPromotion: false, includeTransport: false, transportFrom: '', transportTo: '', transportRoundTripKm: 0, transportPricePerKm: 0.7, validUntil: '2026-10-20', materialPriceWithoutVat: 1000, totalWithoutVat: 1000, totalWithVat: 1230, vatRate: 23,
  }, '2026-10-14');
  assert.match(draft.subject, /CP-2026-1/);
  assert.match(draft.body, /platná do 2026-10-20/);
});
