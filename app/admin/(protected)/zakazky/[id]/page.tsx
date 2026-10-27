import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import {
  getBusinessJobFinance,
  getBusinessJobCompletion,
  getBusinessJobPhotoEvidence,
  getBusinessJobWithActivity,
  getOperationalBusinessJobWithActivity,
  getOperationalBusinessJobCompletion,
  getBusinessSettings,
  isLeadTestData,
  listLandfillPrices,
  listBusinessJobOfferEvidence,
  listLeadEmailOutbox,
  listPlannerActions,
  listPriceOffers,
  listPriceOfferFollowUps,
  listReviewRequests,
  listWorkers,
} from '@/src/server/db';
import { buildJobClosureChecklist, buildOperationalJobChecklist, buildOperationalTimeline, buildOperationsTimeline, getJobAttention } from '@/src/lib/admin-operations';
import type { AdminUser } from '@/src/server/types';
import { addBusinessJobNoteAction, saveBusinessJobAction, saveOperationalBusinessJobAction, setBusinessJobTestDataAction } from '../actions';
import JobForm from '../job-form';
import OperationalJobForm from '../operational-job-form';
import BillingPanel from './billing-panel';
import CompletionWizard from './completion-wizard';
import JobWorkspaceSection from './workspace-section';
import { euro, jobStatusLabels, normalizeWorkflowStatus, numberSk, workflowStatuses } from '../constants';

type AdminSessionUser = Pick<AdminUser, 'email' | 'role'>;

export default async function BusinessJobDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ completion?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const adminUser = await requireAdminUser();
  const completionNotice = query.completion === 'saved' || query.completion === 'finalized' ? query.completion : undefined;
  if (adminUser.role !== 'SUPER_ADMIN') return <OperationalBusinessJobDetailPage id={id} adminUser={adminUser} completionNotice={completionNotice} />;
  return <SuperAdminBusinessJobDetailPage id={id} adminUser={adminUser} completionNotice={completionNotice} />;
}

async function OperationalBusinessJobDetailPage({ id, adminUser, completionNotice }: { id: string; adminUser: AdminSessionUser; completionNotice?: string }) {
  const job = await getOperationalBusinessJobWithActivity(id);
  if (!job) notFound();
  const timelineEnd = new Date(`${job.demolitionDate || job.createdAt.slice(0, 10)}T12:00:00Z`);
  timelineEnd.setUTCDate(timelineEnd.getUTCDate() + 365);
  const [linkedLeadIsTestData, offers, plannerActions, reviewRequests, emailDeliveries, photoEvidenceCounts, completion] = await Promise.all([
    job.leadId ? isLeadTestData(job.leadId) : false,
    listBusinessJobOfferEvidence(job.id),
    listPlannerActions({ from: job.createdAt.slice(0, 10), to: timelineEnd.toISOString().slice(0, 10) }),
    listReviewRequests(),
    job.leadId ? listLeadEmailOutbox(job.leadId) : [],
    getBusinessJobPhotoEvidence(job.id).catch(() => null),
    getOperationalBusinessJobCompletion(job.id),
  ]);
  const jobPlannerActions = plannerActions.filter((action) => action.jobId === job.id);
  const reviewRequest = reviewRequests.find((request) => request.jobId === job.id || Boolean(job.leadId && request.leadId === job.leadId));
  const photoEvidence = photoEvidenceCounts
    ? {
        status: 'available' as const,
        approvedCount: photoEvidenceCounts.approvedCount,
        pendingCount: photoEvidenceCounts.pendingCount,
      }
    : { status: 'unknown' as const };
  const followUps = (await Promise.all(offers.map(async (offer) =>
    (await listPriceOfferFollowUps(offer.id)).map((followUp) => ({ ...followUp, offerNumber: offer.number })),
  ))).flat();
  const checklist = buildOperationalJobChecklist({ job, offers, plannerActions: jobPlannerActions, photoEvidence, reviewRequest, completion });
  const timeline = buildOperationalTimeline({ auditLogs: job.activityLogs, offers, plannerActions: jobPlannerActions, followUps, emailDeliveries, reviewRequest });
  const attention = getJobAttention(job, undefined, {
    hasActivePlannerAction: jobPlannerActions.some((action) => !['ZRUSENA', 'PRESUNUTA'].includes(action.status)),
    hasRecordedFollowUp: followUps.length > 0,
  });
  const activeStatus = normalizeWorkflowStatus(job.status);
  const activeIndex = workflowStatuses.indexOf(activeStatus);
  const closureDone = checklist.filter((item) => item.state === 'done').length;
  const csrfToken = csrfTokenForEmail(adminUser.email);
  const isEffectivelyTestData = Boolean(job.isTestData || linkedLeadIsTestData);

  return (
    <main className="admin-page">
      <div className="print-report-heading">
        <img src="/assets/astana-logo.png" alt="ASTANA" />
        <p>Operatívny detail zákazky · generované {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date())}</p>
      </div>
      <div className="admin-heading no-print">
        <div><p>{jobStatusLabels[job.status]}{isEffectivelyTestData ? ' · TEST' : ''}</p><h1>{job.customerName}</h1></div>
        <div className="admin-action-row">
          <button type="button" className="admin-primary-link" data-print>Tlačiť / PDF</button>
          <a className="admin-primary-link" href={`/admin/ponuky/nova?zakazka=${job.id}`}>+ Vytvoriť cenovú ponuku</a>
          <a className="admin-secondary-link" href={`/admin/planovac?zakazka=${job.id}${job.demolitionDate ? `&mesiac=${job.demolitionDate.slice(0, 7)}` : ''}`}>Naplánovať akciu</a>
          <a className="admin-secondary-link" href={`/admin/zakazky/${job.id}/podklady`}>Balík podkladov</a>
          <a className="admin-primary-link" href="/admin/referencie">Referencie a hodnotenia</a>
        </div>
      </div>

      <JobWorkspaceSection jobId={job.id} actor={adminUser} csrfToken={csrfToken} archived={Boolean(job.deletedAt)} customerName={job.customerName} location={job.location} />

      <section className="admin-stat-grid">
        <article><span>Termín demontáže</span><strong>{job.demolitionDate || 'Zatiaľ neurčený'}</strong></article>
        <article><span>Rozsah</span><strong>{numberSk(job.m2, ' m²')}</strong></article>
        <article><span>Pracovný tím</span><strong>{job.workers.map((worker) => worker.workerName).join(', ') || 'Bez tímu'}</strong></article>
        <article><span>Aktuálny stav</span><strong>{jobStatusLabels[job.status]}</strong></article>
      </section>
      <p className="admin-muted-note">Finančné údaje zákazky sú oddelené a dostupné iba superadminovi.</p>

      {attention ? <section className={`ops-alert ${attention.severity === 'critical' ? 'ops-alert-danger' : 'ops-alert-warning'} no-print`}>
        <div><span>Zaseknutá zákazka · {attention.ageDays} dní bez posunu</span><h2>{attention.title}</h2></div><p>{attention.detail}</p>
      </section> : null}

      <section className="admin-card ops-panel" aria-labelledby="closure-title">
        <div className="ops-section-heading"><div><span>Dokončenie zákazky</span><h2 id="closure-title">Operatívny kontrolný zoznam · {closureDone}/{checklist.length}</h2></div><p>Kontrola zobrazuje iba nefinančné pracovné kroky.</p></div>
        <div className="ops-checklist">{checklist.map((item) => <a key={item.id} className={`ops-check-item is-${item.state}`} href={item.href || '#'}><span aria-hidden="true">{item.state === 'done' ? '✓' : item.state === 'attention' ? '!' : item.state === 'unknown' ? '?' : '○'}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></a>)}</div>
      </section>

      <CompletionWizard completion={completion} jobId={job.id} jobStatus={job.status} role="OPERATOR"
        csrfToken={csrfToken} isArchived={Boolean(job.deletedAt)} isTestData={isEffectivelyTestData} notice={completionNotice} />

      <section className="admin-card no-print">
        <h2>Workflow zákazky</h2>
        <div className="admin-workflow-stepper">{workflowStatuses.map((status, index) => <div key={status} className={index <= activeIndex ? 'is-active' : ''}><span>{index + 1}</span><strong>{jobStatusLabels[status]}</strong></div>)}</div>
        <div className="admin-workflow-action">
          {activeStatus === 'PONUKA_POTVRDENA' ? <p>✅ Zákazník potvrdil ponuku. Pripravte oznámenie a podklady podľa zákazky.</p> : null}
          {activeStatus === 'URADY_PODANE' ? <p>Oznámenie plánovaných prác RÚVZ a súvisiace podklady sú odoslané. Sledujte stav príslušného úradu.</p> : null}
          {activeStatus === 'URADY_SCHVALENE' ? <p>Potrebný postup a prípadné rozhodnutia podľa konkrétnej zákazky sú vybavené. Naplánujte demontáž.</p> : null}
          {activeStatus === 'DEMONT_DOKONCENA' ? <p>Demontáž je hotová. Superadmin uzavrie finančnú časť zákazky.</p> : null}
          {activeStatus === 'DOKONCENA' ? <p>✅ Zákazka je dokončená. Žiadosť o referenciu spravujte v pracovisku Referencie a hodnotenia.</p> : null}
        </div>
      </section>

      <section className="admin-card" id="udaje-zakazky">
        <h2>Operatívne údaje zákazky</h2>
        <form action={saveOperationalBusinessJobAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <OperationalJobForm job={job} />
          <button className="admin-primary-button no-print" type="submit">Uložiť operatívne zmeny</button>
        </form>
      </section>

      <section className="admin-card">
        <div className="ops-section-heading"><div><span>Komunikácia a udalosti</span><h2>Operatívna časová os</h2></div><p>Finančné udalosti sa v operátorskom pohľade nenačítavajú.</p></div>
        <form className="admin-quote-form no-print" action={addBusinessJobNoteAction}>
          <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={job.id} />
          <label className="admin-form-wide">Pridať poznámku<textarea name="activityNote" rows={3} maxLength={1200} /></label>
          <button className="admin-secondary-link admin-form-wide" type="submit">Uložiť poznámku</button>
        </form>
        <div className="admin-timeline ops-timeline">
          {timeline.map((item) => <article key={item.id} className={`is-${item.tone}`}><span>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(item.at))} · {item.category}</span><strong>{item.title}</strong><p>{item.detail}</p></article>)}
          {!timeline.length ? <p>Zatiaľ bez aktivity.</p> : null}
        </div>
      </section>
    </main>
  );
}

async function SuperAdminBusinessJobDetailPage({ id, adminUser, completionNotice }: { id: string; adminUser: AdminSessionUser; completionNotice?: string }) {
  const [job, workers, landfillPrices, settings, finance, completion] = await Promise.all([
    getBusinessJobWithActivity(id),
    listWorkers(true),
    listLandfillPrices(),
    getBusinessSettings(),
    getBusinessJobFinance(id),
    getBusinessJobCompletion(id),
  ]);
  if (!job) notFound();
  if (job.deletedAt && adminUser.role !== 'SUPER_ADMIN') notFound();
  const timelineEnd = new Date(`${job.demolitionDate || job.createdAt.slice(0, 10)}T12:00:00Z`);
  timelineEnd.setUTCDate(timelineEnd.getUTCDate() + 365);
  const [linkedLeadIsTestData, offers, plannerActions, reviewRequests, emailDeliveries, photoEvidenceCounts] = await Promise.all([
    job.leadId ? isLeadTestData(job.leadId) : false,
    listPriceOffers({ jobId: job.id, includeArchived: adminUser.role === 'SUPER_ADMIN' }),
    listPlannerActions({ from: job.createdAt.slice(0, 10), to: timelineEnd.toISOString().slice(0, 10) }),
    listReviewRequests(),
    job.leadId ? listLeadEmailOutbox(job.leadId) : [],
    getBusinessJobPhotoEvidence(job.id).catch(() => null),
  ]);
  const isEffectivelyTestData = Boolean(job.isTestData || linkedLeadIsTestData);
  const jobPlannerActions = plannerActions.filter((action) => action.jobId === job.id);
  const reviewRequest = reviewRequests.find((request) => request.jobId === job.id || Boolean(job.leadId && request.leadId === job.leadId));
  const photoEvidence = photoEvidenceCounts
    ? {
        status: 'available' as const,
        approvedCount: photoEvidenceCounts.approvedCount,
        pendingCount: photoEvidenceCounts.pendingCount,
      }
    : { status: 'unknown' as const };
  const followUps = (await Promise.all(offers.map(async (offer) =>
    (await listPriceOfferFollowUps(offer.id)).map((followUp) => ({ ...followUp, offerNumber: offer.number })),
  ))).flat();
  const checklist = buildJobClosureChecklist({ job, offers, finance, plannerActions: jobPlannerActions, photoEvidence, reviewRequest, completion });
  const timeline = buildOperationsTimeline({ auditLogs: job.activityLogs, offers, finance, plannerActions: jobPlannerActions, followUps, emailDeliveries, reviewRequest });
  const attention = getJobAttention(job, undefined, {
    hasActivePlannerAction: jobPlannerActions.some((action) => !['ZRUSENA', 'PRESUNUTA'].includes(action.status)),
    hasRecordedFollowUp: followUps.length > 0,
  });
  const closureDone = checklist.filter((item) => item.state === 'done').length;

  const activeStatus = normalizeWorkflowStatus(job.status);
  const activeIndex = workflowStatuses.indexOf(activeStatus);
  const reviewRequestHref = '/admin/referencie';
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
          {!job.deletedAt ? <a className="admin-secondary-link" href={`/admin/planovac?zakazka=${job.id}${job.demolitionDate ? `&mesiac=${job.demolitionDate.slice(0, 7)}` : ''}`}>Naplánovať akciu</a> : null}
          <a className="admin-secondary-link" href={`/admin/zakazky/${job.id}/podklady`}>Balík podkladov</a>
          {!job.deletedAt ? <a className="admin-primary-link" href={reviewRequestHref}>Referencie a hodnotenia</a> : null}
        </div>
      </div>

      <JobWorkspaceSection jobId={job.id} actor={adminUser} csrfToken={csrfToken} archived={Boolean(job.deletedAt)} customerName={job.customerName} location={job.location} />

      <section className="admin-stat-grid">
        <article><span>Evidovaná suma</span><strong>{job.totalPriceKnown === false ? 'Cena zatiaľ nie je doplnená' : euro(job.totalPrice)}</strong></article>
        <article><span>Zadané priame náklady</span><strong>{euro(job.costs.total)}</strong></article>
        <article><span>Odmeny</span><strong>{euro(job.rewardsTotal)}</strong></article>
        <article><span>Orientačný rozdiel po zadaných nákladoch a odmenách</span><strong>{job.totalPriceKnown === false ? 'Čaká na cenu' : euro(job.grossProfit)}</strong></article>
      </section>
      <p className="admin-muted-note">Evidovaná suma nie je doklad o fakturácii ani úhrade. Náklady môžu byť neúplné; orientačný rozdiel nie je účtovný zisk. Stav „zrušená“ sa v súhrnných aktívnych hodnotách nezapočítava.</p>

      {attention ? <section className={`ops-alert ${attention.severity === 'critical' ? 'ops-alert-danger' : 'ops-alert-warning'} no-print`}>
        <div><span>Zaseknutá zákazka · {attention.ageDays} dní bez posunu</span><h2>{attention.title}</h2></div>
        <p>{attention.detail}</p>
      </section> : null}

      <section className="admin-card ops-panel" aria-labelledby="closure-title">
        <div className="ops-section-heading">
          <div><span>Dokončenie zákazky</span><h2 id="closure-title">Kontrolný zoznam · {closureDone}/{checklist.length}</h2></div>
          <p>Stav vychádza iba z evidovaných údajov. Chýbajúci dôkaz sa nepovažuje za splnený.</p>
        </div>
        <div className="ops-checklist">
          {checklist.map((item) => <a key={item.id} className={`ops-check-item is-${item.state}`} href={item.href || '#'}>
            <span aria-hidden="true">{item.state === 'done' ? '✓' : item.state === 'attention' ? '!' : item.state === 'unknown' ? '?' : '○'}</span>
            <div><strong>{item.label}</strong><small>{item.detail}</small></div>
          </a>)}
        </div>
      </section>

      <CompletionWizard completion={completion} jobId={job.id} jobStatus={job.status} role={adminUser.role}
        csrfToken={csrfToken} isArchived={Boolean(job.deletedAt)} isTestData={isEffectivelyTestData} notice={completionNotice} />

      <div id="fakturacia">
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
      </div>

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
          {activeStatus === 'VYUCTOVANIE' ? <p>Vyúčtovanie doplňte vo formulári nižšie a zákazku uzavrite cez riadený sprievodca vyššie.</p> : null}
          {activeStatus === 'DOKONCENA' ? <p>✅ Zákazka je dokončená. Prípadnú žiadosť o referenciu skontrolujte a odošlite v samostatnom pracovisku.</p> : null}
        </div> : null}
      </section>

      <section className="admin-card" id="udaje-zakazky">
        <h2>{activeStatus === 'VYUCTOVANIE' || activeStatus === 'DOKONCENA' ? 'Vyúčtovanie zákazky' : 'Údaje zákazky'}</h2>
        {job.deletedAt ? <p className="admin-muted-note">Archivovaná zákazka je len na čítanie. Superadmin môže vyššie opraviť jej označenie pre obchodné súhrny.</p> : <form action={saveBusinessJobAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <JobForm workers={workers} landfillPrices={landfillPrices} defaultPricePerM2={settings.defaultPricePerM2} job={job} />
          <button className="admin-primary-button no-print" type="submit">Uložiť zmeny</button>
        </form>}
      </section>

      {!job.deletedAt && activeStatus === 'DOKONCENA' ? (
        <section className="admin-card no-print">
          <h2>Referencia zákazníka</h2>
          <p>Koncept, odoslanie, prijatie aj publikovanie sú evidované v jednom kontrolovanom pracovnom toku.</p>
          <p className="admin-muted-note">Nič sa neodošle ani nezverejní bez samostatného ľudského schválenia.</p>
          <a className="admin-secondary-link" href={reviewRequestHref}>Otvoriť referencie a hodnotenia</a>
        </section>
      ) : null}

      <section className="admin-card">
        <div className="ops-section-heading"><div><span>Komunikácia a udalosti</span><h2>Jednotná časová os</h2></div><p>Email, ponuky, plánovanie, financie aj interné poznámky na jednom mieste.</p></div>
        {!job.deletedAt ? <form className="admin-quote-form no-print" action={addBusinessJobNoteAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="hidden" name="id" value={job.id} />
          <label className="admin-form-wide">Pridať poznámku<textarea name="activityNote" rows={3} maxLength={1200} /></label>
          <button className="admin-secondary-link admin-form-wide" type="submit">Uložiť poznámku</button>
        </form> : null}
        <div className="admin-timeline ops-timeline">
          {timeline.map((item) => (
            <article key={item.id} className={`is-${item.tone}`}>
              <span>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(item.at))} · {item.category}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
          {!timeline.length ? <p>Zatiaľ bez aktivity.</p> : null}
        </div>
      </section>
    </main>
  );
}
