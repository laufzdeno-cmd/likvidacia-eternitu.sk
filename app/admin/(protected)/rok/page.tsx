import { listBusinessJobs, listWorkers } from '@/src/server/db';
import { euro, numberSk } from '../zakazky/constants';
import YearWorkerChart from './year-worker-chart';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

export default async function YearPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Number(params.rok || currentYear);
  const [jobs, workers] = await Promise.all([listBusinessJobs({ from: `${year}-01-01`, to: `${year}-12-31` }), listWorkers(true)]);
  const rows = monthNames.map((month, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    const monthJobs = jobs.filter((job) => job.demolitionDate.startsWith(key));
    const rewards = monthJobs.reduce((sum, job) => sum + job.rewardsTotal, 0);
    const costs = monthJobs.reduce((sum, job) => sum + job.costs.total, 0);
    const revenue = monthJobs.reduce((sum, job) => sum + job.totalPrice, 0);
    const workerRewards = Object.fromEntries(workers.map((worker) => [
      worker.name,
      monthJobs.reduce((sum, job) => sum + job.workers.filter((item) => item.workerId === worker.id).reduce((a, b) => a + b.reward, 0), 0),
    ]));
    return {
      month,
      key,
      count: monthJobs.length,
      m2: monthJobs.reduce((sum, job) => sum + job.m2, 0),
      revenue,
      invoice: monthJobs.filter((job) => job.paymentType === 'FAKTURA').reduce((sum, job) => sum + job.totalPrice, 0),
      cash: monthJobs.filter((job) => job.paymentType === 'CASH').reduce((sum, job) => sum + job.totalPrice, 0),
      costs,
      rewards,
      profit: revenue - costs - rewards,
      ...workerRewards,
    };
  });
  const total = rows.reduce((sum, row) => ({
    count: sum.count + row.count,
    m2: sum.m2 + row.m2,
    revenue: sum.revenue + row.revenue,
    invoice: sum.invoice + row.invoice,
    cash: sum.cash + row.cash,
    costs: sum.costs + row.costs,
    rewards: sum.rewards + row.rewards,
    profit: sum.profit + row.profit,
  }), { count: 0, m2: 0, revenue: 0, invoice: 0, cash: 0, costs: 0, rewards: 0, profit: 0 });

  return (
    <main className="admin-page year-report-page">
      <div className="print-report-heading"><img src="/assets/astana-logo.svg" alt="ASTANA" /><p>ASTANA — Ročný prehľad {year}</p></div>
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
        <table className="admin-table">
          <thead><tr><th>Mesiac</th><th>Zákaziek</th><th>m²</th><th>Tržby €</th><th>Faktúry €</th><th>Cash €</th><th>Náklady</th><th>Odmeny</th><th>Zisk €</th><th>Marža %</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.month}><td><a href={`/admin/zakazky?month=${row.key}`}>{row.month}</a></td><td>{row.count}</td><td>{numberSk(row.m2)}</td><td>{euro(row.revenue)}</td><td>{euro(row.invoice)}</td><td>{euro(row.cash)}</td><td>{euro(row.costs)}</td><td>{euro(row.rewards)}</td><td>{euro(row.profit)}</td><td>{row.revenue ? ((row.profit / row.revenue) * 100).toFixed(1) : '0'} %</td></tr>)}</tbody>
          <tfoot><tr><th>SPOLU</th><th>{total.count}</th><th>{numberSk(total.m2)}</th><th>{euro(total.revenue)}</th><th>{euro(total.invoice)}</th><th>{euro(total.cash)}</th><th>{euro(total.costs)}</th><th>{euro(total.rewards)}</th><th>{euro(total.profit)}</th><th>{total.revenue ? ((total.profit / total.revenue) * 100).toFixed(1) : '0'} %</th></tr></tfoot>
        </table>
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
