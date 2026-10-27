'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { AdminRole } from '@/src/server/types';
import { searchAdminRecordsAction, type AdminSearchActionState } from './actions';
import { jobStatusLabels } from '../zakazky/constants';

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

export default function SearchWorkspace({ csrfToken, role, compact = false, enhanced = true }: { csrfToken: string; role: AdminRole; compact?: boolean; enhanced?: boolean }) {
  const [state, formAction] = useActionState(searchAdminRecordsAction, initialState);
  const [closed, setClosed] = useState(false);
  const [filters, setFilters] = useState({ year: '', archived: 'exclude', workType: '', status: '', responsibleEmail: '' });
  const updateFilter = (key: keyof typeof filters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const result = state.result;
  const total = result ? result.leads.length + result.jobs.length + result.offers.length + result.reviews.length + result.finance.length : 0;
  const pagination = result?.pagination;
  const found = pagination ? Object.values(pagination.totals).reduce((a, b) => a + b, 0) : total;

  return <div className={compact ? 'crm-top-search' : 'crm-search-page'}>
    <form className="intelligence-search" action={formAction} role="search" onSubmit={() => setClosed(false)}>
      <input type="hidden" name="_csrf" value={csrfToken} />
      <label htmlFor={compact ? 'top-crm-search' : 'global-search'}>{compact ? 'Nájsť zákazku alebo ponuku' : 'Hľadané slová'}</label>
      <div><input id={compact ? 'top-crm-search' : 'global-search'} name="q" defaultValue={state.query} minLength={2} maxLength={100} autoComplete="off" placeholder="Meno, obec, číslo CP, poznámka…" required /><SearchButton /></div>
      {!compact && enhanced ? <>
        <div className="crm-search-filters">
          <label>Rok<input name="year" type="number" min="1900" max="2200" placeholder="Všetky roky" value={filters.year} onChange={e => updateFilter('year', e.target.value)} /></label>
          <label>Evidencia<select name="archived" value={filters.archived} onChange={e => updateFilter('archived', e.target.value)}><option value="exclude">Aktívne záznamy</option><option value="include">Vrátane archívu</option><option value="only">Iba archív</option></select></label>
          <label>Druh práce<select name="workType" value={filters.workType} onChange={e => updateFilter('workType', e.target.value)}><option value="">Všetky</option><option value="DEMONTAZ">Demontáž</option><option value="ODVOZ">Samostatný odvoz</option><option value="DEMONTAZ_A_ODVOZ">Demontáž s odvozom</option></select></label>
          <label>Stav<select name="status" value={filters.status} onChange={e => updateFilter('status', e.target.value)}><option value="">Všetky</option><option value="PONUKA_POTVRDENA">Potvrdená ponuka</option><option value="URADY_PODANE">Podané na úrady</option><option value="DEMONT_NAPLANOVANA">Naplánovaná realizácia</option><option value="DEMONT_DOKONCENA">Realizácia dokončená</option><option value="DOKONCENA">Dokončená zákazka</option><option value="ODOSLANA">Odoslaná CP</option></select></label>
          <label>Zodpovedná osoba<input name="responsibleEmail" type="email" placeholder="Firemný email" value={filters.responsibleEmail} onChange={e => updateFilter('responsibleEmail', e.target.value)} /></label>
        </div>
        <small>Slová sa môžu nachádzať v rôznych častiach karty. Hľadáme aj pôvodné čísla PDF ponúk a poznámky. Citlivé výrazy sa neposielajú v adrese stránky.</small>
        <div className="crm-search-paging"><button name="page" value="1" type="submit">Hľadať od začiatku</button>{pagination && pagination.totalPages > 1 ? <><button name="page" value={Math.max(1, pagination.page - 1)} disabled={pagination.page <= 1}>Predchádzajúca</button><span>Strana {pagination.page} z {pagination.totalPages}</span><button name="page" value={pagination.page + 1} disabled={pagination.page >= pagination.totalPages}>Ďalšia</button></> : null}</div>
      </> : null}
    </form>
    <div className={compact && (state.error || result) && !closed ? 'crm-top-search-results' : undefined} hidden={compact && (closed || (!state.error && !result))}>
    {compact ? <div className="crm-search-close"><a href="/admin/vyhladavanie">Podrobné vyhľadávanie</a><button type="button" onClick={() => setClosed(true)} aria-label="Zavrieť výsledky">×</button></div> : null}
    {state.error ? <p className="work-notice is-warning" role="alert">{state.error}</p> : null}
    {result ? <div className="intelligence-result-summary" aria-live="polite"><strong>{found}</strong><span>nájdených záznamov pre „{state.query}“{pagination && pagination.totalPages > 1 ? ` · strana ${pagination.page}/${pagination.totalPages}` : ''}</span></div> : null}
    {result && total === 0 ? <section className="work-empty"><span aria-hidden="true">⌕</span><h2>Nič sme nenašli</h2><p>Skontrolujte preklep alebo skúste kratšiu časť mena, telefónu či čísla dokumentu.</p></section> : null}
    {result?.leads.length ? <ResultSection title="Dopyty" count={result.leads.length}>{result.leads.map((lead) => <a className="intelligence-result-row" href={`/admin/dopyty/${lead.id}`} key={lead.id}><span><strong>{lead.fullName}</strong><small>{lead.city || 'Bez lokality'} · {lead.phone} · {lead.email || 'bez emailu'}</small></span><em>{leadStatusLabels[lead.status] || lead.status}</em></a>)}</ResultSection> : null}
    {result?.jobs.length ? <ResultSection title="Zákazky" count={result.jobs.length}>{result.jobs.map((job) => <a className="intelligence-result-row" href={`/admin/zakazky/${job.id}`} key={job.id}><span><strong>{job.number ? `${job.number} · ` : ''}{job.customerName}</strong><small>{job.location} · {job.demolitionDate || 'Deň ešte nie je určený'}{job.archived ? ' · Archív' : ''}</small></span><em>{jobStatusLabels[job.status as keyof typeof jobStatusLabels] || job.status.replaceAll('_', ' ')}</em></a>)}</ResultSection> : null}
    {result?.offers.length ? <ResultSection title="Cenové ponuky" count={result.offers.length}>{result.offers.map((offer) => <a className="intelligence-result-row" href={offer.source === 'MANUAL_PDF' ? `/admin/ponuky/rucna/${offer.id}` : `/admin/ponuky/${offer.id}`} key={offer.id}><span><strong>{offer.number}{offer.source === 'MANUAL_PDF' ? ' · PDF' : ''}</strong><small>{offer.contactPerson} · {offer.objectAddress}</small></span><em>{offer.totalWithVat === null ? 'Suma na doplnenie' : euro(offer.totalWithVat)}</em></a>)}</ResultSection> : null}
    {result?.reviews.length ? <ResultSection title="Referencie a hodnotenia" count={result.reviews.length}>{result.reviews.map((request) => <a className="intelligence-result-row" href="/admin/referencie" key={request.id}><span><strong>{request.customerName}</strong><small>{request.location || 'Bez lokality'} · {request.phone || 'bez telefónu'} · {request.customerEmail || 'bez emailu'}</small></span><em>{['submitted', 'approved', 'published'].includes(request.status) ? 'Referencia prijatá' : 'Žiadosť rozpracovaná'}</em></a>)}</ResultSection> : null}
    {role === 'SUPER_ADMIN' && result?.finance.length ? <ResultSection title="Faktúry" count={result.finance.length}>{result.finance.map((invoice) => <a className="intelligence-result-row" href={`/admin/zakazky/${invoice.jobId}`} key={invoice.id}><span><strong>{invoice.invoiceNumber}</strong><small>Vystavená {invoice.issuedOn} · splatnosť {invoice.dueOn || 'neuvedená'}</small></span><em>{euro(invoice.amountWithVatCents / 100)}</em></a>)}</ResultSection> : null}
    </div>
  </div>;
}
