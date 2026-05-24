import { listBusinessJobs, listLeadSummaries, listWorkers } from '@/src/server/db';
import { euro, jobStatusLabels, landfillLabels, numberSk } from '../zakazky/constants';
import BusinessChart from './business-chart';

function periodBounds(period: string, from?: string, to?: string) {
  const now = new Date();
  if (period === 'custom' && from && to) return { from, to, label: `${from} – ${to}` };
  if (period === 'last-month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), label: 'Minulý mesiac' };
  }
  if (period === 'year') return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31`, label: 'Tento rok' };
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), label: 'Tento mesiac' };
}

function pct(part: number, total: number) {
  return total ? `${Math.round((part / total) * 1000) / 10} %` : '0 %';
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const period = params.period || 'month';
  const bounds = periodBounds(period, params.from, params.to);
  const [jobs, allJobs, leads, workers] = await Promise.all([listBusinessJobs(bounds), listBusinessJobs(), listLeadSummaries(), listWorkers(true)]);
  const revenue = jobs.reduce((sum, job) => sum + job.totalPrice, 0);
  const invoice = jobs.filter((job) => job.paymentType === 'FAKTURA').reduce((sum, job) => sum + job.totalPrice, 0);
  const cash = jobs.filter((job) => job.paymentType === 'CASH').reduce((sum, job) => sum + job.totalPrice, 0);
  const m2 = jobs.reduce((sum, job) => sum + job.m2, 0);
  const wasteTons = jobs.reduce((sum, job) => sum + job.wasteKg, 0) / 1000;
  const rewards = jobs.reduce((sum, job) => sum + job.rewardsTotal, 0);
  const costs = jobs.reduce((sum, job) => sum + job.costs.total, 0);
  const profit = jobs.reduce((sum, job) => sum + job.grossProfit, 0);
  const averageM2 = m2 ? revenue / m2 : 0;
  const last12 = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - index), 1);
    const key = date.toISOString().slice(0, 7);
    const monthJobs = allJobs.filter((job) => job.demolitionDate.startsWith(key));
    return {
      month: date.toLocaleDateString('sk-SK', { month: 'short' }),
      revenue: Math.round(monthJobs.reduce((sum, job) => sum + job.totalPrice, 0)),
      costs: Math.round(monthJobs.reduce((sum, job) => sum + job.costs.total + job.rewardsTotal, 0)),
      profit: Math.round(monthJobs.reduce((sum, job) => sum + job.grossProfit, 0)),
    };
  });
  const workerRows = workers.map((worker) => {
    const periodJobs = jobs.filter((job) => job.workers.some((item) => item.workerId === worker.id));
    const yearJobs = allJobs.filter((job) => job.demolitionDate.startsWith(String(new Date().getFullYear())) && job.workers.some((item) => item.workerId === worker.id));
    const periodReward = periodJobs.reduce((sum, job) => sum + job.workers.filter((item) => item.workerId === worker.id).reduce((a, b) => a + b.reward, 0), 0);
    const yearReward = yearJobs.reduce((sum, job) => sum + job.workers.filter((item) => item.workerId === worker.id).reduce((a, b) => a + b.reward, 0), 0);
    return { worker, periodJobs, yearJobs, periodReward, yearReward };
  });
  const landfillRows = Object.entries(landfillLabels).map(([landfill, label]) => {
    const rows = jobs.filter((job) => job.landfill === landfill);
    return { label, count: rows.length, tons: rows.reduce((sum, job) => sum + job.wasteKg, 0) / 1000, cost: rows.reduce((sum, job) => sum + job.costs.landfillCost, 0) };
  });
  const sent = jobs.filter((job) => ['PONUKA_ODOSLANA', 'PRIJATA', 'V_REALIZACII', 'DOKONCENA'].includes(job.status)).length;
  const accepted = jobs.filter((job) => ['PRIJATA', 'V_REALIZACII', 'DOKONCENA'].includes(job.status)).length;
  const done = jobs.filter((job) => job.status === 'DOKONCENA').length;

  return (
    <main className="admin-page">
      <div className="print-report-heading"><img src="/assets/astana-logo.svg" alt="ASTANA" /><p>ASTANA — Mesačný report · {bounds.label}</p></div>
      <div className="admin-heading">
        <div><p>Business dashboard</p><h1>Dashboard</h1></div>
        <button className="admin-primary-link no-print" type="button" data-print>🖨 Tlačiť / PDF</button>
      </div>
      <section className="admin-card no-print">
        <form className="admin-filter-bar" action="/admin/dashboard">
          <button name="period" value="month">Tento mesiac</button>
          <button name="period" value="last-month">Minulý mesiac</button>
          <button name="period" value="year">Tento rok</button>
          <input type="hidden" name="period" value="custom" />
          <label>Od<input type="date" name="from" defaultValue={params.from} /></label>
          <label>Do<input type="date" name="to" defaultValue={params.to} /></label>
          <button type="submit">Vlastné</button>
        </form>
      </section>

      <section className="admin-stat-grid">
        <article><span>Tržby spolu</span><strong>{euro(revenue)}</strong></article>
        <article><span>Faktúry</span><strong>{euro(invoice)}</strong><small>{pct(invoice, revenue)}</small></article>
        <article><span>Cash</span><strong>{euro(cash)}</strong><small>{pct(cash, revenue)}</small></article>
        <article><span>Priem. €/m²</span><strong>{euro(averageM2)}</strong></article>
        <article><span>Zákaziek</span><strong>{jobs.length}</strong></article>
        <article><span>m² spolu</span><strong>{numberSk(m2, ' m²')}</strong></article>
        <article><span>Váha odpadu</span><strong>{numberSk(wasteTons, ' t')}</strong></article>
      </section>

      <section className="admin-card"><h2>Porovnanie mesiacov</h2><BusinessChart data={last12} /></section>

      <section className="admin-card">
        <h2>Náklady a zisk</h2>
        <table className="admin-table"><tbody>
          {[
            ['Odmeny spolu', rewards],
            ['Nafta', jobs.reduce((s, j) => s + j.costs.fuel, 0)],
            ['Obleky', jobs.reduce((s, j) => s + j.costs.suits, 0)],
            ['Rukavice', jobs.reduce((s, j) => s + j.costs.gloves, 0)],
            ['Penetrák', jobs.reduce((s, j) => s + j.costs.penetrant, 0)],
            ['Skládky', jobs.reduce((s, j) => s + j.costs.landfillCost, 0)],
            ['Ostatné', jobs.reduce((s, j) => s + j.costs.otherAmount, 0)],
            ['NÁKLADY SPOLU', costs + rewards],
            ['HRUBÝ ZISK', profit],
          ].map(([label, value]) => <tr key={label}><td>{label}</td><td>{euro(Number(value))}</td><td>{pct(Number(value), revenue)}</td></tr>)}
          <tr><th>MARŽA %</th><th colSpan={2}>{pct(profit, revenue)}</th></tr>
        </tbody></table>
      </section>

      <section className="admin-stat-grid">
        {workerRows.map(({ worker, periodJobs, periodReward, yearReward }) => (
          <article key={worker.id}><span>{worker.name.toUpperCase()}</span><strong>{euro(periodReward)}</strong><small>Zákaziek: {periodJobs.length} · Tento rok: {euro(yearReward)}</small></article>
        ))}
      </section>

      <section className="admin-card">
        <h2>Konverzie</h2>
        <div className="analytics-funnel">
          {[
            ['Dopytov', leads.length, 100],
            ['Ponuka odoslaná', sent, jobs.length ? (sent / jobs.length) * 100 : 0],
            ['Ponuka prijatá', accepted, jobs.length ? (accepted / jobs.length) * 100 : 0],
            ['Dokončených', done, jobs.length ? (done / jobs.length) * 100 : 0],
          ].map(([label, count, rate], index) => <article key={String(label)}><span>{index + 1}</span><strong>{label}</strong><b>{count} · {Number(rate).toFixed(1)} %</b></article>)}
        </div>
      </section>

      <section className="admin-card">
        <h2>Skládky</h2>
        <table className="admin-table"><thead><tr><th>Skládka</th><th>Zákaziek</th><th>Ton</th><th>Náklad €</th></tr></thead><tbody>{landfillRows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td>{numberSk(row.tons)}</td><td>{euro(row.cost)}</td></tr>)}</tbody></table>
      </section>

      <section className="admin-card">
        <h2>Top zákazky</h2>
        <table className="admin-table"><thead><tr><th>Dátum</th><th>Zákazník</th><th>Lokalita</th><th>m²</th><th>Suma €</th><th>Zisk €</th></tr></thead><tbody>{jobs.sort((a, b) => b.totalPrice - a.totalPrice).slice(0, 5).map((job) => <tr key={job.id}><td>{job.demolitionDate}</td><td>{job.customerName}</td><td>{job.location}</td><td>{numberSk(job.m2)}</td><td>{euro(job.totalPrice)}</td><td>{euro(job.grossProfit)}</td></tr>)}</tbody></table>
      </section>
    </main>
  );
}
