'use client';

import { useActionState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { AdminRole } from '@/src/server/types';
import { searchAdminRecordsAction, type AdminSearchActionState } from './actions';

const initialState: AdminSearchActionState = { query: '', error: '', result: null };
const leadStatusLabels: Record<string, string> = {
  novy: 'Nový', kontaktovany: 'Kontaktovaný', caka_na_doplnenie: 'Čaká na doplnenie', naceneny: 'Nacenený',
  cenova_ponuka_odoslana: 'Ponuka odoslaná', objednane: 'Objednané', v_realizacii: 'V realizácii',
  dokoncena: 'Dokončená', zrusena: 'Zrušená', nevyslo: 'Nevyšlo', archivovane: 'Archivované',
};

function euro(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value);
}

function SearchButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? 'Hľadám…' : 'Hľadať'}</button>;
}

function ResultSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return <section className="admin-card intelligence-results"><header><div><p>Výsledky</p><h2>{title}</h2></div><strong>{count}</strong></header><div>{children}</div></section>;
}

export default function SearchWorkspace({ csrfToken, role }: { csrfToken: string; role: AdminRole }) {
  const [state, formAction] = useActionState(searchAdminRecordsAction, initialState);
  const result = state.result;
  const total = result ? result.leads.length + result.jobs.length + result.offers.length + result.reviews.length + result.finance.length : 0;

  return <>
    <form className="intelligence-search" action={formAction} role="search">
      <input type="hidden" name="_csrf" value={csrfToken} />
      <label htmlFor="global-search">Hľadaný výraz</label>
      <div><input id="global-search" name="q" defaultValue={state.query} minLength={2} maxLength={100} autoComplete="off" placeholder="Napr. Novák, 0905…, Poprad, CP-2026…" required /><SearchButton /></div>
      <small>Hľadanie sa odošle bezpečne bez mena, telefónu či emailu v adrese stránky. Finančné doklady sú dostupné iba superadminovi.</small>
    </form>
    {state.error ? <p className="work-notice is-warning" role="alert">{state.error}</p> : null}
    {result ? <div className="intelligence-result-summary" aria-live="polite"><strong>{total}</strong><span>nájdených záznamov pre „{state.query}“</span></div> : null}
    {result && total === 0 ? <section className="work-empty"><span aria-hidden="true">⌕</span><h2>Nič sme nenašli</h2><p>Skontrolujte preklep alebo skúste kratšiu časť mena, telefónu či čísla dokumentu.</p></section> : null}
    {result?.leads.length ? <ResultSection title="Dopyty" count={result.leads.length}>{result.leads.map((lead) => <a className="intelligence-result-row" href={`/admin/dopyty/${lead.id}`} key={lead.id}><span><strong>{lead.fullName}</strong><small>{lead.city || 'Bez lokality'} · {lead.phone} · {lead.email || 'bez emailu'}</small></span><em>{leadStatusLabels[lead.status] || lead.status}</em></a>)}</ResultSection> : null}
    {result?.jobs.length ? <ResultSection title="Zákazky" count={result.jobs.length}>{result.jobs.map((job) => <a className="intelligence-result-row" href={`/admin/zakazky/${job.id}`} key={job.id}><span><strong>{job.customerName}</strong><small>{job.location} · {job.demolitionDate}</small></span><em>{job.status.replaceAll('_', ' ')}</em></a>)}</ResultSection> : null}
    {result?.offers.length ? <ResultSection title="Cenové ponuky" count={result.offers.length}>{result.offers.map((offer) => <a className="intelligence-result-row" href={`/admin/ponuky/${offer.id}`} key={offer.id}><span><strong>{offer.number}</strong><small>{offer.contactPerson} · {offer.objectAddress}</small></span><em>{euro(offer.totalWithVat)}</em></a>)}</ResultSection> : null}
    {result?.reviews.length ? <ResultSection title="Referencie a hodnotenia" count={result.reviews.length}>{result.reviews.map((request) => <a className="intelligence-result-row" href="/admin/referencie" key={request.id}><span><strong>{request.customerName}</strong><small>{request.location || 'Bez lokality'} · {request.phone || 'bez telefónu'} · {request.customerEmail || 'bez emailu'}</small></span><em>{['submitted', 'approved', 'published'].includes(request.status) ? 'Referencia prijatá' : 'Žiadosť rozpracovaná'}</em></a>)}</ResultSection> : null}
    {role === 'SUPER_ADMIN' && result?.finance.length ? <ResultSection title="Faktúry" count={result.finance.length}>{result.finance.map((invoice) => <a className="intelligence-result-row" href={`/admin/zakazky/${invoice.jobId}`} key={invoice.id}><span><strong>{invoice.invoiceNumber}</strong><small>Vystavená {invoice.issuedOn} · splatnosť {invoice.dueOn || 'neuvedená'}</small></span><em>{euro(invoice.amountWithVatCents / 100)}</em></a>)}</ResultSection> : null}
  </>;
}
