import type {
  BusinessJobFinance,
  BusinessJobInvoice,
  BusinessJobPaymentEvent,
} from '../server/types';

export const MAX_BUSINESS_FINANCE_CENTS = 200_000_000;

export function projectBusinessJobFinance(
  invoices: BusinessJobInvoice[],
  paymentEvents: BusinessJobPaymentEvent[],
  today: string,
): BusinessJobFinance {
  const isCancellationEffective = (invoice: BusinessJobInvoice) => (
    Boolean(invoice.cancelledAt) && (!invoice.cancelledOn || invoice.cancelledOn <= today)
  );
  const effectiveInvoices = invoices.filter((invoice) => invoice.issuedOn <= today);
  const activeInvoices = effectiveInvoices.filter((invoice) => !isCancellationEffective(invoice));
  const cancelledInvoices = effectiveInvoices.filter(isCancellationEffective);
  const activeInvoiceIds = new Set(activeInvoices.map((invoice) => invoice.id));
  const effectivePaymentEvents = paymentEvents.filter((event) => event.occurredOn <= today);
  const receipts = effectivePaymentEvents.filter((event) => event.eventType === 'RECEIPT');
  const reversals = effectivePaymentEvents.filter((event) => event.eventType === 'REVERSAL');
  const reversedReceiptIds = new Set(reversals.map((event) => event.reversalOf).filter(Boolean));
  const effectiveReceipts = receipts.filter((event) => !reversedReceiptIds.has(event.id));

  const activeInvoicedCents = activeInvoices.reduce((sum, invoice) => sum + invoice.amountWithVatCents, 0);
  const receivedCents = receipts.reduce((sum, event) => sum + event.amountCents, 0);
  const reversedCents = reversals.reduce((sum, event) => sum + event.amountCents, 0);
  const netReceivedCents = receivedCents - reversedCents;
  const allocatedReceivedCents = effectiveReceipts.reduce((sum, event) => (
    event.invoiceId && activeInvoiceIds.has(event.invoiceId) ? sum + event.amountCents : sum
  ), 0);
  const unallocatedReceivedCents = effectiveReceipts.reduce((sum, event) => (
    !event.invoiceId || !activeInvoiceIds.has(event.invoiceId) ? sum + event.amountCents : sum
  ), 0);

  const receivedByInvoice = new Map<string, number>();
  for (const event of effectiveReceipts) {
    if (!event.invoiceId || !activeInvoiceIds.has(event.invoiceId)) continue;
    receivedByInvoice.set(event.invoiceId, (receivedByInvoice.get(event.invoiceId) ?? 0) + event.amountCents);
  }

  let overdueCents = 0;
  let outstandingCents = 0;
  let overpaidCents = 0;
  let oldestDueOn: string | undefined;
  const invoiceBalances: BusinessJobFinance['invoiceBalances'] = [];
  for (const invoice of cancelledInvoices) {
    invoiceBalances.push({
      invoiceId: invoice.id,
      receivedCents: 0,
      outstandingCents: 0,
      overpaidCents: 0,
      overdue: false,
      status: 'CANCELLED',
    });
  }
  for (const invoice of activeInvoices) {
    const invoiceReceived = receivedByInvoice.get(invoice.id) ?? 0;
    const remaining = Math.max(invoice.amountWithVatCents - invoiceReceived, 0);
    const overpaid = Math.max(invoiceReceived - invoice.amountWithVatCents, 0);
    const overdue = Boolean(remaining && invoice.dueOn && invoice.dueOn < today);
    outstandingCents += remaining;
    overpaidCents += overpaid;
    invoiceBalances.push({
      invoiceId: invoice.id,
      receivedCents: invoiceReceived,
      outstandingCents: remaining,
      overpaidCents: overpaid,
      overdue,
      status: overpaid ? 'OVERPAID' : overdue ? 'OVERDUE' : remaining === 0 ? 'PAID' : invoiceReceived > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
    });
    if (overdue) {
      overdueCents += remaining;
      if (!oldestDueOn || invoice.dueOn! < oldestDueOn) oldestDueOn = invoice.dueOn;
    }
  }

  const malformedReversal = reversals.some((event) => {
    const receipt = receipts.find((candidate) => candidate.id === event.reversalOf);
    return !receipt || receipt.jobId !== event.jobId || receipt.amountCents !== event.amountCents;
  });
  const paymentOnInactiveInvoice = effectiveReceipts.some((event) => (
    Boolean(event.invoiceId) && !activeInvoiceIds.has(event.invoiceId as string)
  ));

  return {
    invoices: [...invoices].sort((left, right) => right.issuedOn.localeCompare(left.issuedOn)),
    paymentEvents: [...paymentEvents].sort((left, right) => (
      right.occurredOn.localeCompare(left.occurredOn) || right.createdAt.localeCompare(left.createdAt)
    )),
    invoiceBalances,
    activeInvoicedCents,
    netReceivedCents,
    allocatedReceivedCents,
    outstandingCents,
    overdueCents,
    unallocatedReceivedCents,
    overpaidCents,
    requiresReview: malformedReversal || paymentOnInactiveInvoice || netReceivedCents < 0
      || invoices.some((invoice) => invoice.issuedOn > today)
      || paymentEvents.some((event) => event.occurredOn > today)
      || invoices.some((invoice) => Boolean(invoice.cancelledAt && invoice.cancelledOn && invoice.cancelledOn > today)),
    oldestDueOn,
  };
}
