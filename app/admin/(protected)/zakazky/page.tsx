import { listBusinessJobs, listPriceOffers, listWorkers } from '@/src/server/db';
import { requireAdminUser } from '@/src/server/auth';
import type { BusinessJobStatus, BusinessLandfill, BusinessPaymentType } from '@/src/server/types';
import { euro, jobStatusLabels, jobStatuses, landfillLabels, landfills, numberSk, paymentLabels, paymentTypes } from './constants';
import { deleteBusinessJobAction, destroyBusinessJobAction } from './actions';

function monthBounds(month?: string) {
  if (!month) return {};
  const from = `${month}-01`;
  const date = new Date(from);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return { from, to: date.toISOString().slice(0, 10) };
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export default async function BusinessJobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const adminUser = await requireAdminUser();
  const q = (params.q || '').trim();
  const status = (params.status || '') as BusinessJobStatus | '';
  const workerId = params.worker || '';
  const payment = (params.payment || '') as BusinessPaymentType | '';
  const landfill = (params.landfill || '') as BusinessLandfill | '';
  const month = params.month || '';
  const includeArchived = adminUser.role === 'SUPER_ADMIN' && params.archived === '1';
  const [jobs, workers, offers] = await Promise.all([
    listBusinessJobs({ ...monthBounds(month), includeArchived }),
    listWorkers(true),
    listPriceOffers({ includeArchived }),
  ]);
  const offersByJob = new Map<string, number>();
  for (const offer of offers) {
    if (offer.jobId) offersByJob.set(offer.jobId, (offersByJob.get(offer.jobId) ?? 0) + 1);
  }

  const qn = normalize(q);
  const filtered = jobs.filter((job) => {
    const haystack = normalize([job.customerName, job.location, job.district].join(' '));
    return (
      (!q || haystack.includes(qn)) &&
      (!status || job.status === status) &&
      (!workerId || job.workers.some((worker) => worker.workerId === workerId)) &&
      (!payment || job.paymentType === payment) &&
      (!landfill || job.landfill === landfill)
    );
  });
  const totals = filtered.reduce(
    (sum, job) => ({ count: sum.count + 1, m2: sum.m2 + job.m2, revenue: sum.revenue + job.totalPrice, profit: sum.profit + job.grossProfit }),
    { count: 0, m2: 0, revenue: 0, profit: 0 },
  );
  const exportQuery = new URLSearchParams({ q, status, worker: workerId, payment, landfill, month, archived: includeArchived ? '1' : '' }).toString();

  return (
    <main className="admin-page">
      <div className="print-report-heading">
        <img src="/assets/astana-logo.svg" alt="ASTANA" />
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
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dátum</th>
                <th>Zákazník</th>
                <th>Lokalita</th>
                <th>m²</th>
                <th>Tržba €</th>
                <th>Platba</th>
                <th>Tím</th>
                <th>Stav</th>
                <th>CP</th>
                <th>Zisk €</th>
                <th className="no-print">Akcie</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id}>
                  <td>{new Intl.DateTimeFormat('sk-SK').format(new Date(job.demolitionDate))}</td>
                  <td><a href={`/admin/zakazky/${job.id}`}>{job.customerName}</a>{job.deletedAt ? <small> Archivované</small> : null}</td>
                  <td>{job.location}</td>
                  <td>{numberSk(job.m2)}</td>
                  <td>{euro(job.totalPrice)}</td>
                  <td>{paymentLabels[job.paymentType]}</td>
                  <td>{job.workers.map((worker) => worker.workerName).join(', ') || 'bez tímu'}</td>
                  <td><span className={`status-pill status-${job.status.toLowerCase()}`}>{jobStatusLabels[job.status]}</span></td>
                  <td><a href={`/admin/ponuky?jobId=${job.id}`}>{offersByJob.get(job.id) ?? 0}</a></td>
                  <td>{euro(job.grossProfit)}</td>
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
              {!filtered.length ? <tr><td colSpan={11}>Nenašli sa žiadne zákazky.</td></tr> : null}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3}>Súčet</th>
                <th>{numberSk(totals.m2)}</th>
                <th>{euro(totals.revenue)}</th>
                <th colSpan={4}>Zákaziek: {totals.count}</th>
                <th>{euro(totals.profit)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}
