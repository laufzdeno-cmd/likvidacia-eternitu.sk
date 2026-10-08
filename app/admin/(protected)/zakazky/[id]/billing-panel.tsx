'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { BusinessJobFinance, BusinessJobInvoice, BusinessJobPaymentEvent } from '@/src/server/types';
import {
  cancelBusinessInvoiceAction,
  recordBusinessInvoiceAction,
  recordBusinessPaymentAction,
  reverseBusinessPaymentAction,
  type FinanceActionState,
} from '../actions';

const initialState: FinanceActionState = { ok: false, message: '', revision: 0 };
const money = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' });
const date = new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' });
const paymentMethodLabels = { BANK_TRANSFER: 'Bankový prevod', CASH: 'Hotovosť', CARD: 'Karta', OTHER: 'Iné' } as const;
const invoiceStatusLabels = { CANCELLED: 'Stornovaná', UNPAID: 'Neuhradená', PARTIALLY_PAID: 'Čiastočne uhradená', PAID: 'Uhradená', OVERPAID: 'Preplatok', OVERDUE: 'Po splatnosti' } as const;
const reasonOptions = [
  ['DATA_ERROR', 'Chybne zaevidované údaje'],
  ['DUPLICATE', 'Duplicitný záznam'],
  ['CUSTOMER_CANCELLED', 'Zrušenie zákazníkom'],
  ['REFUNDED', 'Vrátenie platby'],
  ['OTHER', 'Iný interný dôvod'],
] as const;
const reasonLabels = Object.fromEntries(reasonOptions) as Record<string, string>;

function localDate(value?: string) {
  return value ? date.format(new Date(`${value}T12:00:00`)) : '—';
}

function retainedValue(state: FinanceActionState, name: string, fallback = '') {
  return state.values?.[name] ?? fallback;
}

function SubmitButton({ children, destructive = false }: { children: React.ReactNode; destructive?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={destructive ? 'admin-danger-button' : 'admin-primary-button'} type="submit" disabled={pending}>{pending ? 'Ukladám…' : children}</button>;
}

function ActionMessage({ state }: { state: FinanceActionState }) {
  if (!state.message) return null;
  return <p className={state.ok ? 'admin-success' : 'admin-alert'} role={state.ok ? 'status' : 'alert'} aria-live={state.ok ? 'polite' : 'assertive'}>{state.message}</p>;
}

function InvoiceCancellationForm({ jobId, invoice, csrfToken, operationId, today, blockedByPayment }: {
  jobId: string; invoice: BusinessJobInvoice; csrfToken: string; operationId: string; today: string; blockedByPayment: boolean;
}) {
  const [state, action] = useActionState(cancelBusinessInvoiceAction, initialState);
  if (blockedByPayment) return <p className="admin-muted-note">Najprv stornujte všetky aktívne úhrady priradené k tejto faktúre.</p>;
  return <form action={action} className="admin-finance-correction-form no-print" key={state.revision}>
    <input type="hidden" name="_csrf" value={csrfToken} />
    <input type="hidden" name="jobId" value={jobId} />
    <input type="hidden" name="invoiceId" value={invoice.id} />
    <input type="hidden" name="operationId" value={operationId} />
    <label>Dátum storna<input name="cancelledOn" type="date" defaultValue={retainedValue(state, 'cancelledOn', today)} min={invoice.issuedOn} max={today} required /></label>
    <label>Dôvod<select name="reasonCode" required defaultValue={retainedValue(state, 'reasonCode')}><option value="" disabled>Vyberte dôvod</option>{reasonOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="admin-checkbox"><input type="checkbox" name="confirm" value="yes" defaultChecked={retainedValue(state, 'confirm') === 'yes'} required /> Potvrdzujem storno faktúry bez vymazania histórie.</label>
    <SubmitButton destructive>Stornovať faktúru</SubmitButton>
    <ActionMessage state={state} />
  </form>;
}

function PaymentReversalForm({ jobId, receipt, csrfToken, operationId, today }: {
  jobId: string; receipt: BusinessJobPaymentEvent; csrfToken: string; operationId: string; today: string;
}) {
  const [state, action] = useActionState(reverseBusinessPaymentAction, initialState);
  return <form action={action} className="admin-finance-correction-form no-print" key={state.revision}>
    <input type="hidden" name="_csrf" value={csrfToken} />
    <input type="hidden" name="jobId" value={jobId} />
    <input type="hidden" name="receiptId" value={receipt.id} />
    <input type="hidden" name="operationId" value={operationId} />
    <label>Dátum storna<input name="occurredOn" type="date" defaultValue={retainedValue(state, 'occurredOn', today)} min={receipt.occurredOn} max={today} required /></label>
    <label>Dôvod<select name="reasonCode" required defaultValue={retainedValue(state, 'reasonCode')}><option value="" disabled>Vyberte dôvod</option>{reasonOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="admin-checkbox"><input type="checkbox" name="confirm" value="yes" defaultChecked={retainedValue(state, 'confirm') === 'yes'} required /> Potvrdzujem storno úhrady novou opravnou udalosťou.</label>
    <SubmitButton destructive>Stornovať úhradu</SubmitButton>
    <ActionMessage state={state} />
  </form>;
}

export default function BillingPanel({ jobId, finance, canWrite, archived, csrfToken, today, dueOn, operationIds }: {
  jobId: string; finance: BusinessJobFinance; canWrite: boolean; archived: boolean; csrfToken: string; today: string; dueOn: string;
  operationIds: { invoice: string; payment: string; invoiceCancellation: Record<string, string>; paymentReversal: Record<string, string> };
}) {
  const [invoiceState, invoiceAction] = useActionState(recordBusinessInvoiceAction, initialState);
  const [paymentState, paymentAction] = useActionState(recordBusinessPaymentAction, initialState);
  const hasEvidence = finance.invoices.length > 0 || finance.paymentEvents.length > 0;
  const balancesByInvoice = new Map(finance.invoiceBalances.map((balance) => [balance.invoiceId, balance]));
  const activeInvoices = finance.invoices.filter((invoice) => !invoice.cancelledAt && invoice.issuedOn <= today && balancesByInvoice.has(invoice.id));
  const invoicesById = new Map(finance.invoices.map((invoice) => [invoice.id, invoice]));
  const reversedReceiptIds = new Set(finance.paymentEvents.filter((event) => event.eventType === 'REVERSAL').map((event) => event.reversalOf));
  const activeReceipts = finance.paymentEvents.filter((event) => event.eventType === 'RECEIPT' && event.occurredOn <= today && !reversedReceiptIds.has(event.id));

  const invoiceCorrection = (invoice: BusinessJobInvoice) => {
    const blockedByPayment = activeReceipts.some((event) => event.invoiceId === invoice.id);
    return canWrite && !invoice.cancelledAt && invoice.issuedOn <= today
      ? <details className="admin-finance-correction"><summary>Opraviť záznam</summary><InvoiceCancellationForm jobId={jobId} invoice={invoice} csrfToken={csrfToken} operationId={operationIds.invoiceCancellation[invoice.id]} today={today} blockedByPayment={blockedByPayment} /></details>
      : '—';
  };
  const paymentCorrection = (event: BusinessJobPaymentEvent) => {
    const isActiveReceipt = event.eventType === 'RECEIPT' && !reversedReceiptIds.has(event.id);
    return canWrite && isActiveReceipt
      ? <details className="admin-finance-correction"><summary>Opraviť záznam</summary><PaymentReversalForm jobId={jobId} receipt={event} csrfToken={csrfToken} operationId={operationIds.paymentReversal[event.id]} today={today} /></details>
      : '—';
  };

  return <section className="admin-card admin-finance-card" aria-labelledby="finance-title">
    <div className="admin-section-heading">
      <div><p>Interná evidencia skutočných dokladov</p><h2 id="finance-title">Faktúry a prijaté úhrady</h2></div>
      {finance.requiresReview || finance.unallocatedReceivedCents > 0 || finance.overpaidCents > 0 ? <span className="admin-status-warning">Vyžaduje kontrolu</span> : null}
    </div>
    <p className="admin-muted-note">Faktúru najprv vystavte v účtovnom systéme. Tu evidujte iba skutočne vystavený doklad a skutočne prijatú úhradu. Evidovaná cena zákazky ani jej stav platbu nepotvrdzujú.</p>

    {!hasEvidence ? <div className="admin-empty-state"><strong>Finančné údaje: neevidované</strong><p>Pre túto zákazku zatiaľ nie je uložený doklad o fakturácii ani prijatej úhrade.</p></div> : <div className="admin-stat-grid admin-finance-stats">
      <article><span>Aktívne fakturované</span><strong>{money.format(finance.activeInvoicedCents / 100)}</strong></article>
      <article><span>Prijaté úhrady netto</span><strong>{money.format(finance.netReceivedCents / 100)}</strong></article>
      <article><span>Zostáva uhradiť</span><strong>{money.format(finance.outstandingCents / 100)}</strong></article>
      <article><span>Po splatnosti</span><strong>{money.format(finance.overdueCents / 100)}</strong>{finance.oldestDueOn ? <small>Najstaršia splatnosť {localDate(finance.oldestDueOn)}</small> : null}</article>
    </div>}

    {finance.unallocatedReceivedCents > 0 || finance.overpaidCents > 0 ? <div className="admin-alert" role="status">
      {finance.unallocatedReceivedCents > 0 ? <p>Nepriradené úhrady: <strong>{money.format(finance.unallocatedReceivedCents / 100)}</strong></p> : null}
      {finance.overpaidCents > 0 ? <p>Preplatky na faktúrach: <strong>{money.format(finance.overpaidCents / 100)}</strong></p> : null}
    </div> : null}

    {canWrite && !archived ? <div className="admin-finance-entry-grid no-print">
      <form action={invoiceAction} className="admin-finance-form" key={`invoice-${invoiceState.revision}`}>
        <h3>Zaevidovať vystavenú faktúru</h3>
        <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="operationId" value={operationIds.invoice} />
        <label>Číslo faktúry<input name="invoiceNumber" maxLength={80} defaultValue={retainedValue(invoiceState, 'invoiceNumber')} required /></label>
        <div className="admin-form-inline"><label>Dátum vystavenia<input name="issuedOn" type="date" defaultValue={retainedValue(invoiceState, 'issuedOn', today)} max={today} required /></label><label>Dátum splatnosti<input name="dueOn" type="date" defaultValue={retainedValue(invoiceState, 'dueOn', dueOn)} /></label></div>
        <div className="admin-form-inline"><label>Suma bez DPH<input name="amountWithoutVat" type="text" inputMode="decimal" placeholder="0,00" defaultValue={retainedValue(invoiceState, 'amountWithoutVat')} required /></label><label>DPH %<input name="vatRate" type="text" inputMode="decimal" defaultValue={retainedValue(invoiceState, 'vatRate', '23')} required /></label></div>
        <SubmitButton>Zaevidovať vystavenú faktúru</SubmitButton><ActionMessage state={invoiceState} />
      </form>

      <form action={paymentAction} className="admin-finance-form" key={`payment-${paymentState.revision}`}>
        <h3>Zaevidovať prijatú úhradu</h3>
        <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="operationId" value={operationIds.payment} />
        <label>Priradiť k faktúre<select name="invoiceId" defaultValue={retainedValue(paymentState, 'invoiceId')}><option value="">Nepriradená úhrada</option>{activeInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {money.format(invoice.amountWithVatCents / 100)}</option>)}</select></label>
        <div className="admin-form-inline"><label>Dátum prijatia<input name="occurredOn" type="date" defaultValue={retainedValue(paymentState, 'occurredOn', today)} max={today} required /></label><label>Prijatá suma<input name="amount" type="text" inputMode="decimal" placeholder="0,00" defaultValue={retainedValue(paymentState, 'amount')} required /></label></div>
        <label>Spôsob úhrady<select name="method" defaultValue={retainedValue(paymentState, 'method', 'BANK_TRANSFER')}>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Referencia / variabilný symbol<input name="reference" maxLength={80} autoComplete="off" defaultValue={retainedValue(paymentState, 'reference')} /><small>Nezadávajte prihlasovacie ani bankové bezpečnostné údaje.</small></label>
        <SubmitButton>Zaevidovať prijatú úhradu</SubmitButton><ActionMessage state={paymentState} />
      </form>
    </div> : null}

    {finance.invoices.length ? <section className="admin-finance-history" aria-labelledby="invoice-history-title">
      <h3 id="invoice-history-title">História faktúr</h3>
      <div className="admin-finance-history-table admin-table-wrap" role="region" aria-label="História faktúr" tabIndex={0}>
        <table className="admin-table"><thead><tr><th>Faktúra</th><th>Vystavená</th><th>Splatnosť</th><th>Suma s DPH</th><th>Prijaté</th><th>Zostáva</th><th>Stav</th><th className="no-print">Oprava</th></tr></thead><tbody>
          {finance.invoices.map((invoice) => {
            const balance = balancesByInvoice.get(invoice.id);
            return <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong></td><td>{localDate(invoice.issuedOn)}</td><td>{localDate(invoice.dueOn)}</td><td>{money.format(invoice.amountWithVatCents / 100)}</td><td>{money.format((balance?.receivedCents ?? 0) / 100)}</td><td>{money.format((balance?.outstandingCents ?? 0) / 100)}</td><td><strong>{balance ? invoiceStatusLabels[balance.status] : 'Na kontrolu'}</strong>{invoice.cancelledAt ? <small className="admin-finance-state-detail">{localDate(invoice.cancelledOn)} · {reasonLabels[invoice.cancelReasonCode || ''] || 'Dôvod neuvedený'}</small> : null}</td><td className="no-print">{invoiceCorrection(invoice)}</td></tr>;
          })}
        </tbody></table>
      </div>
      <div className="admin-finance-history-cards">
        {finance.invoices.map((invoice) => {
          const balance = balancesByInvoice.get(invoice.id);
          return <article className="admin-finance-history-card" key={invoice.id}><h4>{invoice.invoiceNumber}</h4><dl>
            <div><dt>Vystavená</dt><dd>{localDate(invoice.issuedOn)}</dd></div><div><dt>Splatnosť</dt><dd>{localDate(invoice.dueOn)}</dd></div><div><dt>Suma s DPH</dt><dd>{money.format(invoice.amountWithVatCents / 100)}</dd></div><div><dt>Prijaté</dt><dd>{money.format((balance?.receivedCents ?? 0) / 100)}</dd></div><div><dt>Zostáva</dt><dd>{money.format((balance?.outstandingCents ?? 0) / 100)}</dd></div><div><dt>Stav</dt><dd>{balance ? invoiceStatusLabels[balance.status] : 'Na kontrolu'}{invoice.cancelledAt ? <small className="admin-finance-state-detail">{localDate(invoice.cancelledOn)} · {reasonLabels[invoice.cancelReasonCode || ''] || 'Dôvod neuvedený'}</small> : null}</dd></div>
          </dl><div className="admin-finance-card-action no-print">{invoiceCorrection(invoice)}</div></article>;
        })}
      </div>
    </section> : null}

    {finance.paymentEvents.length ? <section className="admin-finance-history" aria-labelledby="payment-history-title">
      <h3 id="payment-history-title">História úhrad a opráv</h3>
      <div className="admin-finance-history-table admin-table-wrap" role="region" aria-label="História úhrad a storien" tabIndex={0}>
        <table className="admin-table"><thead><tr><th>Dátum</th><th>Udalosť</th><th>Faktúra</th><th>Suma</th><th>Spôsob</th><th>Referencia</th><th className="no-print">Oprava</th></tr></thead><tbody>
          {finance.paymentEvents.map((event) => {
            const invoice = invoicesById.get(event.invoiceId || '');
            const isActiveReceipt = event.eventType === 'RECEIPT' && !reversedReceiptIds.has(event.id);
            return <tr key={event.id}><td>{localDate(event.occurredOn)}</td><td>{event.eventType === 'RECEIPT' ? (isActiveReceipt ? 'Prijatá úhrada' : 'Stornovaná úhrada') : 'Storno úhrady'}</td><td>{invoice?.invoiceNumber ?? 'Nepriradená'}</td><td>{event.eventType === 'REVERSAL' ? '−' : ''}{money.format(event.amountCents / 100)}</td><td>{paymentMethodLabels[event.method]}</td><td>{event.reference || '—'}</td><td className="no-print">{paymentCorrection(event)}</td></tr>;
          })}
        </tbody></table>
      </div>
      <div className="admin-finance-history-cards">
        {finance.paymentEvents.map((event) => {
          const invoice = invoicesById.get(event.invoiceId || '');
          const isActiveReceipt = event.eventType === 'RECEIPT' && !reversedReceiptIds.has(event.id);
          const eventLabel = event.eventType === 'RECEIPT' ? (isActiveReceipt ? 'Prijatá úhrada' : 'Stornovaná úhrada') : 'Storno úhrady';
          return <article className="admin-finance-history-card" key={event.id}><h4>{eventLabel}</h4><dl>
            <div><dt>Dátum</dt><dd>{localDate(event.occurredOn)}</dd></div><div><dt>Faktúra</dt><dd>{invoice?.invoiceNumber ?? 'Nepriradená'}</dd></div><div><dt>Suma</dt><dd>{event.eventType === 'REVERSAL' ? '−' : ''}{money.format(event.amountCents / 100)}</dd></div><div><dt>Spôsob</dt><dd>{paymentMethodLabels[event.method]}</dd></div><div><dt>Referencia</dt><dd>{event.reference || '—'}</dd></div>{event.reasonCode ? <div><dt>Dôvod opravy</dt><dd>{reasonLabels[event.reasonCode] || event.reasonCode}</dd></div> : null}
          </dl><div className="admin-finance-card-action no-print">{paymentCorrection(event)}</div></article>;
        })}
      </div>
    </section> : null}
  </section>;
}
