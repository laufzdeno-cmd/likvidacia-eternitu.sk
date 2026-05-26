import { notFound } from 'next/navigation';
import { getBusinessJobWithActivity, getBusinessSettings, listLandfillPrices, listWorkers } from '@/src/server/db';
import { addBusinessJobNoteAction, saveBusinessJobAction, sendBusinessQuoteAction } from '../actions';
import JobForm from '../job-form';
import { euro, jobStatusLabels, normalizeWorkflowStatus, workflowStatuses } from '../constants';

function activityTitle(action: string) {
  const labels: Record<string, string> = {
    business_job_lead_received: 'Dopyt prijatý z webstránky',
    business_job_created: 'Zákazka vytvorená',
    business_job_updated: 'Zákazka upravená',
    business_job_status_changed: 'Stav zmenený',
    business_job_quote_sent: 'Cenová ponuka odoslaná',
    business_job_note_added: 'Poznámka pridaná',
    business_job_archived: 'Zákazka archivovaná',
    business_job_deleted: 'Zákazka archivovaná',
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
  const activeStatus = normalizeWorkflowStatus(job.status);
  const activeIndex = workflowStatuses.indexOf(activeStatus);
  const phoneForWhatsApp = job.customerPhone.replace(/\D/g, '').replace(/^0/, '421');
  const reviewText = encodeURIComponent(`Dobrý deň ${job.customerName}, ďakujeme za dôveru pri likvidácii azbestu v ${job.location}. Ak ste boli spokojní, veľmi by nám pomohla krátka recenzia na Google — trvá 2 minúty: ${settings.googleReviewLink || '[DOPLNIŤ GOOGLE ODKAZ]'}. Ďakujeme, tím ASTANA`);

  return (
    <main className="admin-page">
      <div className="print-report-heading">
        <img src="/assets/astana-logo.svg" alt="ASTANA" />
        <p>Detail zákazky · generované {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date())}</p>
      </div>
      <div className="admin-heading no-print">
        <div><p>{jobStatusLabels[job.status]}</p><h1>{job.customerName}</h1></div>
        <div className="admin-action-row">
          <button type="button" className="admin-primary-link" data-print>Tlačiť / PDF</button>
          <a className="admin-primary-link" href={`/admin/ponuky/nova?zakazka=${job.id}`}>+ Vytvoriť cenovú ponuku</a>
          <a className="admin-primary-link" href={`/admin/reviews/request?meno=${encodeURIComponent(job.customerName)}&lokalita=${encodeURIComponent(job.location)}`}>Žiadosť o recenziu</a>
        </div>
      </div>

      <section className="admin-stat-grid">
        <article><span>Tržba</span><strong>{euro(job.totalPrice)}</strong></article>
        <article><span>Náklady</span><strong>{euro(job.costs.total)}</strong></article>
        <article><span>Odmeny</span><strong>{euro(job.rewardsTotal)}</strong></article>
        <article><span>Zisk</span><strong>{euro(job.grossProfit)}</strong></article>
      </section>

      <section className="admin-card no-print">
        <h2>Workflow zákazky</h2>
        <div className="admin-workflow-stepper">
          {workflowStatuses.map((status, index) => (
            <div key={status} className={index <= activeIndex ? 'is-active' : ''}>
              <span>{index + 1}</span>
              <strong>{jobStatusLabels[status]}</strong>
            </div>
          ))}
        </div>
        <div className="admin-workflow-action">
          {activeStatus === 'PONUKA_POTVRDENA' ? <p>✅ Zákazník potvrdil ponuku. Doplňte dátum potvrdenia a prejdite na úrady.</p> : null}
          {activeStatus === 'URADY_PODANE' ? <p>Žiadosť RÚVZ a OÚ ŽP je podaná. Sledujte rozhodnutia a dátumy zapisujte do poznámky.</p> : null}
          {activeStatus === 'URADY_SCHVALENE' ? <p>Úrady sú schválené. Ďalší krok je plánovanie demontáže v plánovači.</p> : null}
          {activeStatus === 'DEMONT_NAPLANOVANA' ? <p>Demontáž je naplánovaná. Skontrolujte tím, adresu a termín v plánovači.</p> : null}
          {activeStatus === 'DEMONT_DOKONCENA' ? <p>Demontáž je hotová. Prejdite na vyúčtovanie a doplňte presné m², náklady a odmeny.</p> : null}
          {activeStatus === 'VYUCTOVANIE' ? <p>Vyúčtovanie zákazky je v editovateľnom formulári nižšie. Po uložení nastavte stav Dokončená.</p> : null}
          {activeStatus === 'DOKONCENA' ? <p>✅ Zákazka je dokončená. Požiadajte zákazníka o recenziu.</p> : null}
        </div>
      </section>

      <section className="admin-card">
        <h2>{activeStatus === 'VYUCTOVANIE' || activeStatus === 'DOKONCENA' ? 'Vyúčtovanie zákazky' : 'Údaje zákazky'}</h2>
        <form action={saveBusinessJobAction}>
          <JobForm workers={workers} landfillPrices={landfillPrices} defaultPricePerM2={settings.defaultPricePerM2} job={job} />
          <button className="admin-primary-button no-print" type="submit">Uložiť zmeny</button>
        </form>
      </section>

      {activeStatus === 'DOKONCENA' ? (
        <section className="admin-card no-print">
          <h2>Recenzia zákazníka</h2>
          <p>Po dokončení pošlite zákazníkovi krátku žiadosť o Google recenziu.</p>
          <a className="admin-primary-link" href={`https://wa.me/${phoneForWhatsApp}?text=${reviewText}`} target="_blank" rel="noopener">📱 Vygenerovať WhatsApp</a>
          <div className="admin-form-inline">
            <label>Stav recenzie<select defaultValue="caka"><option value="caka">Čaká</option><option value="odoslana">Odoslaná</option><option value="prijata">Prijatá</option></select></label>
          </div>
        </section>
      ) : null}

      <section className="admin-card no-print">
        <h2>Cenová ponuka</h2>
        <form className="admin-quote-form admin-pending-form admin-send-offer-form" action={sendBusinessQuoteAction}>
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
