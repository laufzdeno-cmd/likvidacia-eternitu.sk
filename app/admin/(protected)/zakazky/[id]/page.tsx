import { notFound } from 'next/navigation';
import { getBusinessJob, getBusinessSettings, listLandfillPrices, listWorkers } from '@/src/server/db';
import { saveBusinessJobAction } from '../actions';
import JobForm from '../job-form';
import { euro, jobStatusLabels } from '../constants';

export default async function BusinessJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, workers, landfillPrices, settings] = await Promise.all([
    getBusinessJob(id),
    listWorkers(true),
    listLandfillPrices(),
    getBusinessSettings(),
  ]);
  if (!job) notFound();

  return (
    <main className="admin-page">
      <div className="print-report-heading">
        <img src="/assets/astana-logo.svg" alt="ASTANA" />
        <p>Detail zákazky · generované {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date())}</p>
      </div>
      <div className="admin-heading no-print">
        <div><p>{jobStatusLabels[job.status]}</p><h1>{job.customerName}</h1></div>
        <div className="admin-action-row">
          <button type="button" className="admin-primary-link" data-print>🖨 Tlačiť / PDF</button>
          <a className="admin-primary-link" href={`/admin/reviews/request?meno=${encodeURIComponent(job.customerName)}&lokalita=${encodeURIComponent(job.location)}`}>Generovať žiadosť o recenziu</a>
        </div>
      </div>
      <section className="admin-stat-grid">
        <article><span>Tržba</span><strong>{euro(job.totalPrice)}</strong></article>
        <article><span>Náklady</span><strong>{euro(job.costs.total)}</strong></article>
        <article><span>Odmeny</span><strong>{euro(job.rewardsTotal)}</strong></article>
        <article><span>Zisk</span><strong>{euro(job.grossProfit)}</strong></article>
      </section>
      <form action={saveBusinessJobAction}>
        <JobForm workers={workers} landfillPrices={landfillPrices} defaultPricePerM2={settings.defaultPricePerM2} job={job} />
        <button className="admin-primary-button no-print" type="submit">Uložiť zmeny</button>
      </form>
    </main>
  );
}
