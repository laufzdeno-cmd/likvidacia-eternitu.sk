import { countBusinessJobs, getBusinessJobsSummary, listBusinessJobs, listPriceOffers, listWorkers } from '@/src/server/db';
import { requireAdminUser } from '@/src/server/auth';
import type { BusinessJobStatus, BusinessLandfill, BusinessPaymentType } from '@/src/server/types';
import { euro, jobStatusLabels, jobStatuses, landfillLabels, landfills, numberSk, paymentLabels, paymentTypes } from './constants';
import { deleteBusinessJobAction, destroyBusinessJobAction } from './actions';

function monthBounds(month?: string) {
  if (!month) return {};
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    from: `${month}-01`,
    to: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10),
  };
}

export default async function BusinessJobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const adminUser = await requireAdminUser();
  const q = (params.q || '').trim().slice(0, 120);
  const status = jobStatuses.includes(params.status as BusinessJobStatus) ? params.status as BusinessJobStatus : '';
  const workerId = (params.worker || '').slice(0, 80);
  const payment = paymentTypes.includes(params.payment as BusinessPaymentType) ? params.payment as BusinessPaymentType : '';
  const landfill = landfills.includes(params.landfill as BusinessLandfill) ? params.landfill as BusinessLandfill : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month || '') ? params.month! : '';
  const requestedPage = Number(params.page || 1);
  const pageSize = 50;
  const requestedOffset = Number.isInteger(requestedPage) && requestedPage > 0 ? (requestedPage - 1) * pageSize : 0;
  const includeArchived = adminUser.role === 'SUPER_ADMIN' && params.archived === '1';
  const filters = {
    ...monthBounds(month), includeArchived,
    status: status || undefined,
    workerId: workerId || undefined,
    paymentType: payment || undefined,
    landfill: landfill || undefined,
    q: q || undefined,
  };
  const [totalCount, workers, offers] = await Promise.all([
    countBusinessJobs(filters),
    listWorkers(true),
    listPriceOffers({ includeArchived }),
  ]);
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedOffset / pageSize + 1, pageCount);
  const [jobs, totals] = await Promise.all([
    listBusinessJobs({ ...filters, limit: pageSize, offset: (page - 1) * pageSize }),
    getBusinessJobsSummary({ ...filters, excludeTestData: true }),
  ]);
  const offersByJob = new Map<string, number>();
  for (const offer of offers) {
    if (offer.jobId) offersByJob.set(offer.jobId, (offersByJob.get(offer.jobId) ?? 0) + 1);
  }

  const exportQuery = new URLSearchParams({ q, status, worker: workerId, payment, landfill, month, archived: includeArchived ? '1' : '' }).toString();
  const pageHref = (targetPage: number) => {
    const search = new URLSearchParams({ q, status, worker: workerId, payment, landfill, month, archived: includeArchived ? '1' : '', page: String(targetPage) });
    return `/admin/zakazky?${search.toString()}`;
  };

  return (
    <main className="admin-page">
      <div className="print-report-heading">
        <img src="/assets/astana-logo.png" alt="ASTANA" />
        <p>Zoznam zákaziek · generované {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date())}</p>
      </div>
      <div className="admin-heading">
        <div>
          <p>Business CRM</p>
          <h1>Zákazky</h1>
        </div>
        <div className="admin-action-row no-print">
          <a className="admin-primary-link" href="/admin/zakazky/nova">Nová zákazka</a>
          <a className="admin-row-link" href={`/admin/zakazky/export?${exportQuery}`}>Export CSV</a>
          <button className="admin-row-link" type="button" data-print>Tlačiť / PDF</button>
        </div>
      </div>

      <section className="admin-card no-print">
        <form className="admin-filter-bar" action="/admin/zakazky" method="get">
          <label>Obdobie<input name="month" type="month" defaultValue={month} /></label>
          <label>Stav<select name="status" defaultValue={status}><option value="">Všetky</option>{jobStatuses.map((item) => <option key={item} value={item}>{jobStatusLabels[item]}</option>)}</select></label>
          <label>Pracovník<select name="worker" defaultValue={workerId}><option value="">Všetci</option>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>
          <label>Platba<select name="payment" defaultValue={payment}><option value="">Všetky</option>{paymentTypes.map((item) => <option key={item} value={item}>{paymentLabels[item]}</option>)}</select></label>
          <label>Skládka<select name="landfill" defaultValue={landfill}><option value="">Všetky</option>{landfills.map((item) => <option key={item} value={item}>{landfillLabels[item]}</option>)}</select></label>
          <label>Vyhľadávanie<input name="q" defaultValue={q} placeholder="meno, lokalita" /></label>
          {adminUser.role === 'SUPER_ADMIN' ? <label className="admin-check-label"><input name="archived" type="checkbox" value="1" defaultChecked={includeArchived} /> Zobraziť archivované</label> : null}
          <button type="submit">Filtrovať</button>
          <a href="/admin/zakazky">Reset</a>
        </form>
      </section>

      <section className="admin-card">
        <p className="admin-muted-note">Operatívny zoznam zobrazuje aj testovacie zákazky; súhrny v päte tabuľky ich vylučujú. Evidované sumy môžu zahŕňať aj dopyty a odhady; typ platby nie je potvrdením úhrady. Orientačný rozdiel odpočítava len aktuálne zadané priame náklady a odmeny, nejde o účtovný zisk. Súčet nezahŕňa zrušené záznamy; tie uvádzame osobitne.</p>
        <p className="admin-muted-note" aria-live="polite">Zobrazené {totalCount ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, totalCount)} z {totalCount} záznamov · strana {page} z {pageCount}</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dátum</th>
                <th>Zákazník</th>
                <th>Lokalita</th>
                <th>m2</th>
                <th>Evidovaná suma €</th>
                <th>Platba</th>
                <th>Tím</th>
                <th>Stav</th>
                <th>CP</th>
                <th>Orientačný rozdiel €</th>
                <th className="no-print">Akcie</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{new Intl.DateTimeFormat('sk-SK').format(new Date(job.demolitionDate))}</td>
                  <td><a href={`/admin/zakazky/${job.id}`}>{job.customerName}</a>{job.isTestData ? <small> · TEST – mimo obchodných súhrnov</small> : null}{job.deletedAt ? <small> Archivované</small> : null}</td>
                  <td>{job.location}</td>
                  <td>{numberSk(job.m2)}</td>
                  <td>{euro(job.totalPrice)}</td>
                  <td>{paymentLabels[job.paymentType]}</td>
                  <td>{job.workers.map((worker) => worker.workerName).join(', ') || 'bez tímu'}</td>
                  <td><span className={`status-pill status-${job.status.toLowerCase()}`}>{jobStatusLabels[job.status]}</span></td>
                  <td><a href={`/admin/ponuky?jobId=${job.id}`}>{offersByJob.get(job.id) ?? 0}</a></td>
                <td>{euro(job.totalPrice - job.rewardsTotal - job.costs.total)}</td>
                  <td className="no-print">
                    {adminUser.role === 'SUPER_ADMIN' ? (
                      <div className="admin-row-actions">
                        {!job.deletedAt ? (
                          <form action={deleteBusinessJobAction} data-confirm-submit={`Archivovať zákazku ${job.customerName}?`}>
                            <input type="hidden" name="id" value={job.id} />
                            <button className="admin-danger-outline" type="submit">Archivovať</button>
                          </form>
                        ) : null}
                        <form action={destroyBusinessJobAction} data-confirm-submit={`Naozaj natrvalo zmazať zákazku ${job.customerName}? Táto akcia sa nedá vrátiť späť.`}>
                          <input type="hidden" name="id" value={job.id} />
                          <button className="admin-danger-outline" type="submit">Zmazať</button>
                        </form>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!jobs.length ? <tr><td colSpan={11}>Nenašli sa žiadne zákazky.</td></tr> : null}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4}>Aktívne bez testov: {totals.activeCount}</th>
                <th>{euro(totals.recordedValue)}</th>
                <th colSpan={4}>Súhrn podľa filtrov, bez testov</th>
                <th>{euro(totals.remainder)}</th>
                <th className="no-print"></th>
              </tr>
              <tr><th colSpan={11}>Zrušené: {totals.canceledCount} · Evidovaná suma zrušených záznamov: {euro(totals.canceledValue)}</th></tr>
              <tr><th colSpan={11}>Archivované: {totals.archivedCount} · Evidovaná suma archívu: {euro(totals.archivedValue)}{includeArchived ? ' · oddelene od aktívnych súčtov' : ''}</th></tr>
            </tfoot>
          </table>
        </div>
        <nav className="admin-action-row" aria-label="Stránkovanie zákaziek">
          <a className="admin-row-link" aria-disabled={page <= 1} href={page > 1 ? pageHref(page - 1) : undefined}>Predchádzajúca</a>
          <a className="admin-row-link" aria-disabled={page >= pageCount} href={page < pageCount ? pageHref(page + 1) : undefined}>Ďalšia</a>
        </nav>
      </section>
    </main>
  );
}
