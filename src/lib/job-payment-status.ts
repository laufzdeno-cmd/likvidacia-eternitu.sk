import type { BusinessJobFinance } from '../server/types';

/** The payment ledger is authoritative; a declared estimate cannot settle an invoice. */
export function jobPaymentStatus(totalCents: number | null, finance: Pick<BusinessJobFinance, 'netReceivedCents' | 'activeInvoicedCents' | 'requiresReview' | 'unallocatedReceivedCents' | 'outstandingCents'>) {
  const conflict = totalCents !== null && finance.activeInvoicedCents > 0 && finance.activeInvoicedCents !== totalCents;
  const review = finance.requiresReview || conflict || (finance.activeInvoicedCents > 0 && finance.unallocatedReceivedCents > 0);
  const balanceCents = finance.activeInvoicedCents > 0 ? finance.outstandingCents : totalCents === null ? null : totalCents - finance.netReceivedCents;
  const state = review ? 'REVIEW' : balanceCents === null ? 'UNKNOWN' : balanceCents < 0 ? 'OVERPAID' : balanceCents === 0 ? 'PAID' : finance.netReceivedCents > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
  const label = ({ REVIEW: 'Preveriť vyúčtovanie', UNKNOWN: 'Čaká na doplnenie celkovej ceny', OVERPAID: 'Preplatok · preveriť', PAID: 'Uhradená', PARTIALLY_PAID: 'Čiastočne uhradená', UNPAID: 'Neuhradená' })[state];
  return { state, label, balanceCents, review, conflict };
}
