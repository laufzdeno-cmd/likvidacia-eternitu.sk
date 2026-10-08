import assert from 'node:assert/strict';
import test from 'node:test';

const baseInvoice = {
  jobId: 'job-1', operationId: 'op-1', requestHash: 'a'.repeat(64),
  issuedOn: '2026-09-01', dueOn: '2026-09-15', amountWithoutVatCents: 10_000,
  vatRateBasisPoints: 0, amountWithVatCents: 10_000, createdAt: '2026-09-01T08:00:00.000Z', createdBy: 'admin@example.invalid',
};

const receipt = (overrides = {}) => ({
  id: 'payment-1', jobId: 'job-1', invoiceId: 'invoice-1', operationId: 'op-payment-1', requestHash: 'b'.repeat(64),
  eventType: 'RECEIPT', occurredOn: '2026-09-10', amountCents: 10_000, method: 'BANK_TRANSFER', reference: '',
  createdAt: '2026-09-10T08:00:00.000Z', createdBy: 'admin@example.invalid', ...overrides,
});

test('projector never lets an overpayment on one invoice hide another invoice debt', async () => {
  const { projectBusinessJobFinance } = await import('../src/lib/business-billing.ts');
  const invoices = [
    { ...baseInvoice, id: 'invoice-1' },
    { ...baseInvoice, id: 'invoice-2', operationId: 'op-2', invoiceNumber: 'F-2', amountWithVatCents: 5_000, amountWithoutVatCents: 5_000 },
  ];
  const result = projectBusinessJobFinance(invoices, [receipt({ amountCents: 12_000 })], '2026-10-01');
  assert.equal(result.activeInvoicedCents, 15_000);
  assert.equal(result.outstandingCents, 5_000);
  assert.equal(result.overpaidCents, 2_000);
  assert.equal(result.overdueCents, 5_000);
  assert.deepEqual(result.invoiceBalances.find((item) => item.invoiceId === 'invoice-1'), {
    invoiceId: 'invoice-1', receivedCents: 12_000, outstandingCents: 0, overpaidCents: 2_000, overdue: false, status: 'OVERPAID',
  });
  assert.deepEqual(result.invoiceBalances.find((item) => item.invoiceId === 'invoice-2'), {
    invoiceId: 'invoice-2', receivedCents: 0, outstandingCents: 5_000, overpaidCents: 0, overdue: true, status: 'OVERDUE',
  });
});

test('reversal preserves history and removes the receipt from net and allocated totals', async () => {
  const { projectBusinessJobFinance } = await import('../src/lib/business-billing.ts');
  const payment = receipt();
  const reversal = receipt({
    id: 'reversal-1', operationId: 'op-reversal-1', eventType: 'REVERSAL', occurredOn: '2026-09-11',
    reversalOf: payment.id, reasonCode: 'DATA_ERROR',
  });
  const result = projectBusinessJobFinance([{ ...baseInvoice, id: 'invoice-1', invoiceNumber: 'F-1' }], [payment, reversal], '2026-10-01');
  assert.equal(result.paymentEvents.length, 2);
  assert.equal(result.netReceivedCents, 0);
  assert.equal(result.allocatedReceivedCents, 0);
  assert.equal(result.outstandingCents, 10_000);
  assert.equal(result.overdueCents, 10_000);
  assert.equal(result.invoiceBalances[0].status, 'OVERDUE');
});

test('unallocated and payments on cancelled invoices stay visible and require review', async () => {
  const { projectBusinessJobFinance } = await import('../src/lib/business-billing.ts');
  const cancelled = { ...baseInvoice, id: 'invoice-1', invoiceNumber: 'F-1', cancelledAt: '2026-09-12T08:00:00.000Z' };
  const result = projectBusinessJobFinance([cancelled], [receipt()], '2026-10-01');
  assert.equal(result.activeInvoicedCents, 0);
  assert.equal(result.unallocatedReceivedCents, 10_000);
  assert.equal(result.requiresReview, true);
  assert.deepEqual(result.invoiceBalances[0], {
    invoiceId: 'invoice-1', receivedCents: 0, outstandingCents: 0, overpaidCents: 0, overdue: false, status: 'CANCELLED',
  });
});

test('invoice balance distinguishes unpaid, partial and paid evidence', async () => {
  const { projectBusinessJobFinance } = await import('../src/lib/business-billing.ts');
  const invoice = { ...baseInvoice, id: 'invoice-1', invoiceNumber: 'F-1', dueOn: '2026-12-15' };
  assert.equal(projectBusinessJobFinance([invoice], [], '2026-10-01').invoiceBalances[0].status, 'UNPAID');
  const partial = projectBusinessJobFinance([invoice], [receipt({ amountCents: 2_500 })], '2026-10-01').invoiceBalances[0];
  assert.deepEqual({ status: partial.status, received: partial.receivedCents, outstanding: partial.outstandingCents }, { status: 'PARTIALLY_PAID', received: 2_500, outstanding: 7_500 });
  assert.equal(projectBusinessJobFinance([invoice], [receipt()], '2026-10-01').invoiceBalances[0].status, 'PAID');
});

test('future-dated finance events do not change current balances', async () => {
  const { projectBusinessJobFinance } = await import('../src/lib/business-billing.ts');
  const invoice = { ...baseInvoice, id: 'invoice-1', invoiceNumber: 'F-1' };
  const futureReceipt = receipt({ occurredOn: '2026-10-02' });
  const futureCancellation = {
    ...invoice,
    cancelledOn: '2026-10-02',
    cancelledAt: '2026-10-01T08:00:00.000Z',
  };
  const result = projectBusinessJobFinance([futureCancellation], [futureReceipt], '2026-10-01');
  assert.equal(result.activeInvoicedCents, 10_000);
  assert.equal(result.netReceivedCents, 0);
  assert.equal(result.outstandingCents, 10_000);
  assert.equal(result.invoiceBalances[0].status, 'OVERDUE');
  assert.equal(result.requiresReview, true);
});

test('future-dated invoices do not create current receivables', async () => {
  const { projectBusinessJobFinance } = await import('../src/lib/business-billing.ts');
  const futureInvoice = {
    ...baseInvoice,
    id: 'invoice-future',
    invoiceNumber: 'F-FUTURE',
    issuedOn: '2026-10-02',
    dueOn: '2026-10-16',
  };
  const result = projectBusinessJobFinance([futureInvoice], [], '2026-10-01');
  assert.equal(result.activeInvoicedCents, 0);
  assert.equal(result.outstandingCents, 0);
  assert.equal(result.invoiceBalances.length, 0);
  assert.equal(result.requiresReview, true);
});
