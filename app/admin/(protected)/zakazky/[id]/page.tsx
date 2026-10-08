import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import { getBusinessJobFinance, getBusinessJobWithActivity, getBusinessSettings, isLeadTestData, listLandfillPrices, listWorkers } from '@/src/server/db';
import { addBusinessJobNoteAction, saveBusinessJobAction, setBusinessJobTestDataAction } from '../actions';
import JobForm from '../job-form';
import BillingPanel from './billing-panel';
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
    business_invoice_recorded: 'Faktúra zaevidovaná',
    business_invoice_cancelled: 'Faktúra stornovaná',
    business_payment_recorded: 'Úhrada zaevidovaná',
    business_payment_reversed: 'Úhrada stornovaná',
  };
  return labels[action] || action;
}

export default async function BusinessJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, adminUser, workers, landfillPrices, settings, finance] = await Promise.all([
    getBusinessJobWithActivity(id),
    requireAdminUser(),
    listWorkers(true),
    listLandfillPrices(),
    getBusinessSettings(),
    getBusinessJobFinance(id),
  ]);
  if (!job) notFound();
  if (job.deletedAt && adminUser.role !== 'SUPER_ADMIN') notFound();
  const linkedLeadIsTestData = job.leadId ? await isLeadTestData(job.leadId) : false;
  const isEffectivelyTestData = Boolean(job.isTestData || linkedLeadIsTestData);

  const activeStatus = normalizeWorkflowStatus(job.status);
  const activeIndex = workflowStatuses.indexOf(activeStatus);
  const phoneForWhatsApp = job.customerPhone.replace(/\D/g, '').replace(/^0/, '421');
  const reviewText = encodeURIComponent(`Dobrý deň ${job.customerName}, ďakujeme za dôveru pri likvidácii azbestu v ${job.location}. Ak ste boli spokojní, veľmi by nám pomohla krátka recenzia na Google — trvá 2 minúty: ${settings.googleReviewLink || '[DOPLNIŤ GOOGLE ODKAZ]'}. Ďakujeme, tím ASTANA`);
  const reviewRequestHref = `/admin/reviews/request?meno=${encodeURIComponent(job.customerName)}&lokalita=${encodeURIComponent(job.location)}`;
  const csrfToken = csrfTokenForEmail(adminUser.email);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dueDate = new Date(`${today}T12:00:00+02:00`);
  dueDate.setDate(dueDate.getDate() + 14);
  const dueOn = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dueDate);
  const operationIds = {
    invoice: randomUUID(),
    payment: randomUUID(),
    invoiceCancellation: Object.fromEntries(finance.invoices.map((invoice) => [invoice.id, randomUUID()])),
    paymentReversal: Object.fromEntries(finance.paymentEvents.filter((event) => event.eventType === 'RECEIPT').map((event) => [event.id, randomUUID()])),
  };

  return (
    <main className="admin-page">
      <div className="print-report-heading">
        <img src="/assets/astana-logo.png" alt="ASTANA" />
        <p>Detail zákazky · generované {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date())}</p>
      </div>
      <div className="admin-heading no-print">
        <div><p>{jobStatusLabels[job.status]}{job.deletedAt ? ' · ARCHÍV' : ''}{isEffectivelyTestData ? ' · TEST' : ''}</p><h1>{job.customerName}</h1></div>
        <div className="admin-action-row">
          <button type="button" className="admin-primary-link" data-print>Tlačiť / PDF</button>
          {!job.deletedAt ? <a className="admin-primary-link" href={`/admin/ponuky/nova?zakazka=${job.id}`}>+ Vytvoriť cenovú ponuku</a> : null}
          {!job.deletedAt ? <a className="admin-primary-link" href={reviewRequestHref}>Žiadosť o recenziu</a> : null}
        </div>
      </div>

      <section className="admin-stat-grid">
        <article><span>Evidovaná suma</span><strong>{euro(job.totalPrice)}</strong></article>
        <article><span>Zadané priame náklady</span><strong>{euro(job.costs.total)}</strong></article>
        <article><span>Odmeny</span><strong>{euro(job.rewardsTotal)}</strong></article>
        <article><span>Orientačný rozdiel po zadaných nákladoch a odmenách</span><strong>{euro(job.grossProfit)}</strong></article>
      </section>
      <p className="admin-muted-note">Evidovaná suma nie je doklad o fakturácii ani úhrade. Náklady môžu byť neúplné; orientačný rozdiel nie je účtovný zisk. Stav „zrušená“ sa v súhrnných aktívnych hodnotách nezapočítava.</p>

      <BillingPanel
        jobId={job.id}
        finance={finance}
        canWrite={adminUser.role === 'SUPER_ADMIN'}
        archived={Boolean(job.deletedAt)}
        csrfToken={csrfToken}
        today={today}
        dueOn={dueOn}
        operationIds={operationIds}
      />

      {adminUser.role === 'SUPER_ADMIN' ? <section className="admin-card no-print" aria-labelledby="job-test-classification-title">
        <h2 id="job-test-classification-title">Obchodné reporty</h2>
        <p>{isEffectivelyTestData ? 'Táto zákazka alebo jej dopyt je označený ako testovací. CRM záznam zostáva zachovaný a reporty ho nezapočítavajú.' : 'Zákazka sa započítava do obchodných reportov. Označenie testu ju nemaže ani nemení jej stav.'}</p>
        {linkedLeadIsTestData ? <p>Dôvodom vylúčenia je testovací dopyt <a href={`/admin/dopyty/${job.leadId}`}>otvoriť dopyt</a>.</p> : <form action={setBusinessJobTestDataAction} className="admin-form-stack">
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="isTestData" value={job.isTestData ? 'false' : 'true'} />
          <label>Dôvod zmeny
            <select name="reason" required defaultValue="">
              <option value="" disabled>Vyberte dôvod</option>
              <option>Lokálny test formulára</option>
              <option>Test doručovania emailov</option>
              <option>Testovacie CRM údaje</option>
              <option>Iný dôvod bez osobných údajov</option>
            </select>
          </label>
          <button className="admin-secondary-link" type="submit">{job.isTestData ? 'Vrátiť do obchodných reportov' : 'Označiť zákazku ako testovaciu'}</button>
        </form>}
      </section> : null}

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
        {!job.deletedAt ? <div className="admin-workflow-action">
          {activeStatus === 'PONUKA_POTVRDENA' ? <p>✅ Zákazník potvrdil ponuku. Doplňte dátum potvrdenia a pripravte oznámenie a podklady podľa zákazky.</p> : null}
          {activeStatus === 'URADY_PODANE' ? <p>Oznámenie plánovaných prác RÚVZ a súvisiace podklady sú odoslané. Zaznamenajte dátum oznámenia; pri ďalších konaniach sledujte stav príslušného úradu.</p> : null}
          {activeStatus === 'URADY_SCHVALENE' ? <p>Potrebný postup a prípadné rozhodnutia podľa konkrétnej zákazky sú vybavené. Ďalší krok je plánovanie demontáže v plánovači.</p> : null}
          {activeStatus === 'DEMONT_NAPLANOVANA' ? <p>Demontáž je naplánovaná. Skontrolujte tím, adresu a termín v plánovači.</p> : null}
          {activeStatus === 'DEMONT_DOKONCENA' ? <p>Demontáž je hotová. Prejdite na vyúčtovanie a doplňte presné m2, náklady a odmeny.</p> : null}
          {activeStatus === 'VYUCTOVANIE' ? <p>Vyúčtovanie zákazky je v editovateľnom formulári nižšie. Po uložení nastavte stav Dokončená.</p> : null}
          {activeStatus === 'DOKONCENA' ? <p>✅ Zákazka je dokončená. Požiadajte zákazníka o recenziu.</p> : null}
        </div> : null}
      </section>

      <section className="admin-card">
        <h2>{activeStatus === 'VYUCTOVANIE' || activeStatus === 'DOKONCENA' ? 'Vyúčtovanie zákazky' : 'Údaje zákazky'}</h2>
        {job.deletedAt ? <p className="admin-muted-note">Archivovaná zákazka je len na čítanie. Superadmin môže vyššie opraviť jej označenie pre obchodné súhrny.</p> : <form action={saveBusinessJobAction}>
          <JobForm workers={workers} landfillPrices={landfillPrices} defaultPricePerM2={settings.defaultPricePerM2} job={job} />
          <button className="admin-primary-button no-print" type="submit">Uložiť zmeny</button>
        </form>}
      </section>

      {!job.deletedAt && activeStatus === 'DOKONCENA' ? (
        <section className="admin-card no-print">
          <h2>Recenzia zákazníka</h2>
          <p>Po dokončení pošlite zákazníkovi krátku žiadosť o Google recenziu.</p>
          <a className="admin-primary-link" href={`https://wa.me/${phoneForWhatsApp}?text=${reviewText}`} target="_blank" rel="noopener">📱 Vygenerovať WhatsApp</a>
          <p className="admin-muted-note">Odoslanie a prijatie recenzie evidujte v samostatnom pracovnom toku, aby sa stav po obnovení stránky nestratil.</p>
          <a className="admin-secondary-link" href={reviewRequestHref}>Otvoriť žiadosť o recenziu</a>
        </section>
      ) : null}

      <section className="admin-card">
        <h2>História aktivít</h2>
        {!job.deletedAt ? <form className="admin-quote-form no-print" action={addBusinessJobNoteAction}>
          <input type="hidden" name="id" value={job.id} />
          <label className="admin-form-wide">Pridať poznámku<textarea name="activityNote" rows={3} /></label>
          <button className="admin-secondary-link admin-form-wide" type="submit">Uložiť poznámku</button>
        </form> : null}
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
