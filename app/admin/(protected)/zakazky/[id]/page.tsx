import { notFound } from 'next/navigation';
import { getBusinessJobWithActivity, getBusinessSettings, listLandfillPrices, listWorkers } from '@/src/server/db';
import { addBusinessJobNoteAction, saveBusinessJobAction, sendBusinessQuoteAction } from '../actions';
import JobForm from '../job-form';
import { euro, jobStatusLabels } from '../constants';

function activityTitle(action: string) {
  const labels: Record<string, string> = {
    business_job_lead_received: 'Dopyt prijatý z webstránky',
    business_job_created: 'Zákazka vytvorená',
    business_job_updated: 'Zákazka upravená',
    business_job_status_changed: 'Stav zmenený',
    business_job_quote_sent: 'Cenová ponuka odoslaná',
    business_job_note_added: 'Poznámka pridaná',
    business_job_deleted: 'Zákazka zmazaná',
  };
  return labels[action] || action;
}

export default async function BusinessJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, workers, landfillPrices, settings] = await Promise.all([
    getBusinessJobWithActivity(id),
    listWorkers(true),
    listLandfillPrices(),
    getBusinessSettings(),
  ]);
  if (!job) notFound();

  const defaultValidUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const quoteTotal = job.m2 * job.pricePerM2;

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
          <a className="admin-primary-link" href={`/admin/ponuky/nova?zakazka=${job.id}`}>+ Vytvoriť cenovú ponuku</a>
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
      <section className="admin-card no-print">
        <h2>Cenová ponuka</h2>
        <form className="admin-quote-form" action={sendBusinessQuoteAction}>
          <input type="hidden" name="id" value={job.id} />
          <label>Platná do<input name="validUntil" type="date" defaultValue={defaultValidUntil} required /></label>
          <label>Cena za m²<input name="quotePricePerM2" type="number" step="0.01" defaultValue={job.pricePerM2} required /></label>
          <label>Celková cena<input readOnly value={euro(quoteTotal)} /></label>
          <label className="admin-form-wide">Poznámka k ponuke<textarea name="quoteNote" rows={4} /></label>
          {!job.customerEmail ? <p className="admin-alert">Zákazka nemá email zákazníka. Doplňte ho v základných údajoch.</p> : null}
          <button className="admin-primary-button admin-form-wide" type="submit" disabled={!job.customerEmail}>Odoslať cenovú ponuku zákazníkovi</button>
        </form>
      </section>
      <section className="admin-card">
        <h2>História aktivít</h2>
        <form className="admin-quote-form no-print" action={addBusinessJobNoteAction}>
          <input type="hidden" name="id" value={job.id} />
          <label className="admin-form-wide">Pridať poznámku<textarea name="activityNote" rows={3} /></label>
          <button className="admin-secondary-link admin-form-wide" type="submit">Uložiť poznámku</button>
        </form>
        <div className="admin-timeline">
          {job.activityLogs.map((log) => (
            <article key={log.id}>
              <span>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.createdAt))} · {log.actorEmail}</span>
              <strong>{activityTitle(log.action)}</strong>
              {log.changes?.note ? <p>{String(log.changes.note)}</p> : null}
              {log.action === 'business_job_status_changed' ? <p>{String(log.changes.previous || '')} → {String(log.changes.next || '')}</p> : null}
              {log.action === 'business_job_quote_sent' ? <p>Cena: {euro(Number(log.changes.totalPrice || 0))}</p> : null}
            </article>
          ))}
          {!job.activityLogs.length ? <p>Zatiaľ bez aktivity.</p> : null}
        </div>
      </section>
    </main>
  );
}
