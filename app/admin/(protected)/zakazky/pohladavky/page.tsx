import { requireSuperAdmin } from '@/src/server/auth';
import { listBusinessFinanceEvidence, listBusinessJobs } from '@/src/server/db';
import { buildReceivableQueue } from '@/src/lib/admin-operations';
import { euro } from '../constants';

const views = ['all', 'overdue', 'unpaid', 'review'] as const;
type View = (typeof views)[number];

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSuperAdmin();
  const params = await searchParams;
  const view: View = views.includes(params.view as View) ? params.view as View : 'all';
  const q = (params.q || '').trim().slice(0, 120).toLocaleLowerCase('sk');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [jobs, evidence] = await Promise.all([
    listBusinessJobs({ includeArchived: false, excludeTestData: true, limit: null }),
    listBusinessFinanceEvidence(),
  ]);
  const queue = buildReceivableQueue(jobs, evidence.invoices, evidence.paymentEvents, today);
  const filtered = queue.filter((item) => {
    if (view === 'overdue' && item.finance.overdueCents <= 0) return false;
    if (view === 'unpaid' && (item.finance.outstandingCents <= 0 || item.finance.overdueCents > 0)) return false;
    if (view === 'review' && !item.finance.requiresReview && !item.finance.unallocatedReceivedCents && !item.finance.overpaidCents) return false;
    return !q || `${item.job.customerName} ${item.job.location} ${item.job.customerEmail}`.toLocaleLowerCase('sk').includes(q);
  });
  const outstanding = queue.reduce((sum, item) => sum + item.finance.outstandingCents, 0);
  const overdue = queue.reduce((sum, item) => sum + item.finance.overdueCents, 0);
  const needsReview = queue.filter((item) => item.finance.requiresReview || item.finance.unallocatedReceivedCents || item.finance.overpaidCents).length;

  return (
    <main className="admin-page ops-page">
      <div className="admin-heading ops-heading">
        <div><p>Financie · iba superadmin</p><h1>Pohľadávky a platby</h1><span>Jednotná fronta vystavených faktúr, neuhradených súm a nezrovnalostí.</span></div>
        <div className="admin-action-row no-print"><a className="admin-secondary-link" href="/admin/zakazky">Zákazky</a><a className="admin-row-link" href="/admin/zakazky/export-financie?type=invoices">Export faktúr</a><a className="admin-row-link" href="/admin/zakazky/export-financie?type=payments">Export úhrad</a></div>
      </div>
      <section className="admin-stat-grid ops-stat-grid">
        <article><span>Neuhradené spolu</span><strong>{euro(outstanding / 100)}</strong><small>{queue.length} zákaziek vo fronte</small></article>
        <article className={overdue ? 'is-critical' : 'is-positive'}><span>Po splatnosti</span><strong>{euro(overdue / 100)}</strong><small>k dnešnému dňu {today}</small></article>
        <article><span>Vyžaduje kontrolu</span><strong>{needsReview}</strong><small>nepriradené, preplatky alebo nekonzistentné udalosti</small></article>
      </section>

      <section className="admin-card no-print ops-filter-panel">
        <nav className="ops-tabs" aria-label="Filter pohľadávok">
          <a className={view === 'all' ? 'is-active' : ''} href="/admin/zakazky/pohladavky">Všetko</a>
          <a className={view === 'overdue' ? 'is-active' : ''} href="/admin/zakazky/pohladavky?view=overdue">Po splatnosti</a>
          <a className={view === 'unpaid' ? 'is-active' : ''} href="/admin/zakazky/pohladavky?view=unpaid">Pred splatnosťou</a>
          <a className={view === 'review' ? 'is-active' : ''} href="/admin/zakazky/pohladavky?view=review">Preveriť</a>
        </nav>
        <form className="admin-filter-bar" action="/admin/zakazky/pohladavky" method="get">
          <input type="hidden" name="view" value={view} />
          <label>Hľadať zákazníka<input name="q" defaultValue={params.q || ''} placeholder="meno, lokalita alebo email" /></label>
          <button type="submit">Hľadať</button><a href="/admin/zakazky/pohladavky">Reset</a>
        </form>
      </section>

      <section className="ops-receivables" aria-label="Fronta pohľadávok">
        {filtered.map((item) => <article key={item.job.id} className={`admin-card ops-receivable is-${item.tone}`}>
          <div className="ops-receivable-main">
            <span>{item.finance.overdueCents ? 'PO SPLATNOSTI' : item.finance.requiresReview ? 'PREVERIŤ' : 'NEUHRADENÉ'}</span>
            <h2><a href={`/admin/zakazky/${item.job.id}#fakturacia`}>{item.job.customerName}</a></h2>
            <p>{item.job.location} · {item.invoiceCount} aktívnych faktúr{item.finance.oldestDueOn ? ` · najstaršia splatnosť ${item.finance.oldestDueOn}` : ''}</p>
          </div>
          <dl>
            <div><dt>Fakturované</dt><dd>{euro(item.finance.activeInvoicedCents / 100)}</dd></div>
            <div><dt>Neuhradené</dt><dd>{euro(item.finance.outstandingCents / 100)}</dd></div>
            <div><dt>Po splatnosti</dt><dd>{euro(item.finance.overdueCents / 100)}</dd></div>
            <div><dt>Nepriradené</dt><dd>{euro(item.finance.unallocatedReceivedCents / 100)}</dd></div>
          </dl>
          <a className="admin-primary-link" href={`/admin/zakazky/${item.job.id}#fakturacia`}>Otvoriť evidenciu</a>
        </article>)}
        {!filtered.length ? <div className="admin-card ops-empty"><strong>V tomto filtri nie je nič na riešenie.</strong><p>Fronta sa prepočíta z evidovaných faktúr a platieb.</p></div> : null}
      </section>
      <p className="admin-muted-note">Fronta pracuje iba s reálnymi, nearchivovanými zákazkami. Budúce finančné udalosti nemenia dnešné zostatky. Evidencia nie je účtovný systém.</p>
    </main>
  );
}
