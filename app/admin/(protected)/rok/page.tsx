import { listBusinessJobs, listWorkers } from '@/src/server/db';
import { euro, numberSk } from '../zakazky/constants';
import YearWorkerChart from './year-worker-chart';
import { businessTodayKey } from '@/src/lib/business-period';
import { summarizeBusinessJobs } from '@/src/lib/business-dashboard-metrics';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

export default async function YearPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const currentYear = Number(businessTodayKey().slice(0, 4));
  const requestedYear = Number(params.rok || currentYear);
  const year = Number.isInteger(requestedYear) && requestedYear >= currentYear - 3 && requestedYear <= currentYear
    ? requestedYear
    : currentYear;
  const [jobs, workers] = await Promise.all([listBusinessJobs({ from: `${year}-01-01`, to: `${year}-12-31`, limit: null, excludeTestData: true }), listWorkers(true)]);
  const rows = monthNames.map((month, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    const monthJobs = jobs.filter((job) => job.demolitionDate.startsWith(key));
    const metrics = summarizeBusinessJobs(monthJobs);
    const workerRewards = Object.fromEntries(workers.map((worker) => [
      worker.name,
      metrics.activeJobs.reduce((sum, job) => sum + job.workers.filter((item) => item.workerId === worker.id).reduce((a, b) => a + b.reward, 0), 0),
    ]));
    return {
      month,
      key,
      count: metrics.activeJobs.length,
      m2: metrics.area,
      recordedValue: metrics.recordedOrderValue,
      invoiceTypeValue: metrics.invoiceTypeValue,
      cashTypeValue: metrics.cashTypeValue,
      costs: metrics.directCosts,
      rewards: metrics.rewards,
      remainder: metrics.preOverheadRemainder,
      cancelledCount: metrics.cancelledJobs.length,
      cancelledValue: metrics.cancelledValue,
      ...workerRewards,
    };
  });
  const total = rows.reduce((sum, row) => ({
    count: sum.count + row.count,
    m2: sum.m2 + row.m2,
    recordedValue: sum.recordedValue + row.recordedValue,
    invoiceTypeValue: sum.invoiceTypeValue + row.invoiceTypeValue,
    cashTypeValue: sum.cashTypeValue + row.cashTypeValue,
    costs: sum.costs + row.costs,
    rewards: sum.rewards + row.rewards,
    remainder: sum.remainder + row.remainder,
    cancelledCount: sum.cancelledCount + row.cancelledCount,
    cancelledValue: sum.cancelledValue + row.cancelledValue,
  }), { count: 0, m2: 0, recordedValue: 0, invoiceTypeValue: 0, cashTypeValue: 0, costs: 0, rewards: 0, remainder: 0, cancelledCount: 0, cancelledValue: 0 });

  return (
    <main className="admin-page year-report-page">
      <div className="print-report-heading"><img src="/assets/astana-logo.png" alt="ASTANA" /><p>ASTANA — Ročný prehľad {year}</p></div>
      <div className="admin-heading">
        <div><p>Ročný report</p><h1>Ročný prehľad</h1></div>
        <button className="admin-primary-link no-print" type="button" data-print>🖨 Tlačiť / PDF</button>
      </div>
      <section className="admin-card no-print">
        <form className="admin-filter-bar" action="/admin/rok">
          <label>Rok<select name="rok" defaultValue={String(year)}>{[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((item) => <option key={item}>{item}</option>)}</select></label>
          <button type="submit">Zobraziť</button>
        </form>
      </section>
      <section className="admin-card">
        <p className="admin-muted-note">Ide o evidované sumy pri dopytoch, odhadoch a zákazkách podľa dátumu demontáže, nie potvrdené tržby ani prijaté úhrady. Zadané priame náklady a odmeny nemusia byť úplné; orientačný rozdiel nie je zisk ani účtovná marža. Zrušené záznamy sú oddelené.</p>
        <div className="admin-table-wrap" role="region" aria-label="Mesačný ročný prehľad, posúvateľná tabuľka" tabIndex={0}>
        <table className="admin-table">
          <thead><tr><th>Mesiac</th><th>Aktívne záznamy</th><th>m²</th><th>Evidovaná suma</th><th>Typ: faktúra</th><th>Typ: hotovosť</th><th>Zadané náklady</th><th>Odmeny</th><th>Orientačný rozdiel</th><th>Podiel orientačného rozdielu</th><th>Zrušené</th><th>Evidovaná suma zrušených</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.month}><td><a href={`/admin/zakazky?month=${row.key}`}>{row.month}</a></td><td>{row.count}</td><td>{numberSk(row.m2)}</td><td>{euro(row.recordedValue)}</td><td>{euro(row.invoiceTypeValue)}</td><td>{euro(row.cashTypeValue)}</td><td>{euro(row.costs)}</td><td>{euro(row.rewards)}</td><td>{euro(row.remainder)}</td><td>{row.recordedValue ? `${((row.remainder / row.recordedValue) * 100).toFixed(1)} %` : '—'}</td><td>{row.cancelledCount}</td><td>{euro(row.cancelledValue)}</td></tr>)}</tbody>
          <tfoot><tr><th>SPOLU</th><th>{total.count}</th><th>{numberSk(total.m2)}</th><th>{euro(total.recordedValue)}</th><th>{euro(total.invoiceTypeValue)}</th><th>{euro(total.cashTypeValue)}</th><th>{euro(total.costs)}</th><th>{euro(total.rewards)}</th><th>{euro(total.remainder)}</th><th>{total.recordedValue ? `${((total.remainder / total.recordedValue) * 100).toFixed(1)} %` : '—'}</th><th>{total.cancelledCount}</th><th>{euro(total.cancelledValue)}</th></tr></tfoot>
        </table>
        </div>
      </section>
      <section className="admin-card">
        <h2>Odmeny pracovníkov po mesiacoch</h2>
        <YearWorkerChart data={rows} workers={workers.map((worker) => worker.name)} />
      </section>
      <section className="admin-card">
        <h2>Ročný prehľad pracovníkov</h2>
        <table className="admin-table"><thead><tr><th>Mesiac</th>{workers.map((worker) => <th key={worker.id}>{worker.name}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.month}><td>{row.month}</td>{workers.map((worker) => <td key={worker.id}>{euro(Number((row as Record<string, number | string>)[worker.name] || 0))}</td>)}</tr>)}</tbody></table>
      </section>
    </main>
  );
}
