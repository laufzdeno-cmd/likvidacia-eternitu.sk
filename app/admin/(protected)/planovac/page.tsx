import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import { listBusinessJobs, listOperationalBusinessJobs, listOperationalWorkers, listPlannerActions, listWorkers } from '@/src/server/db';
import { findPlannerCollisions } from '@/src/lib/admin-operations';
import PlannerForm, { type PlannerJobOption } from './planner-form';
import PrintButton from './print-button';
import { getJobWorkspace, listJobWorkspaceOperationalSummaries } from '@/src/server/job-workspace-db';
import workspaceStyles from './planner-workspace.module.css';
import { findWorkspaceCapacityWarnings } from '@/src/lib/job-workspace-planner';
import { jobWorkspaceEnabled } from '@/src/server/job-workspace-feature';

const typeLabels = {
  DEMONTAZ: 'Demontáž', ODVOZ: 'Odvoz', DOKUMENTACIA: 'Dokumentácia', INE: 'Iné',
} as const;
const statusLabels = {
  NAPLANOVANA: 'Naplánovaná', DOKONCENA: 'Dokončená', ZRUSENA: 'Zrušená', PRESUNUTA: 'Presunutá',
} as const;

function monthMeta(month?: string) {
  const safeMonth = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit' }).format(new Date());
  const [year, numericMonth] = safeMonth.split('-').map(Number);
  const index = numericMonth - 1;
  const first = new Date(Date.UTC(year, index, 1));
  const last = new Date(Date.UTC(year, index + 1, 0));
  const from = new Date(first);
  from.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const to = new Date(last);
  to.setUTCDate(last.getUTCDate() + (6 - ((last.getUTCDay() + 6) % 7)));
  const prev = new Date(Date.UTC(year, index - 1, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(year, index + 1, 1)).toISOString().slice(0, 7);
  return { index, key: safeMonth, from, to, prev, next, title: first.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function weatherFor(district: string, date: string) {
  if (!district) return { missingDistrict: true as const };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 15);
  if (date < today || date > horizon.toISOString().slice(0, 10)) return { unavailable: true as const };
  try {
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`okres ${district}, Slovensko`)}`, {
      headers: { 'User-Agent': 'ASTANA admin planner' }, next: { revalidate: 60 * 60 * 12 }, signal: AbortSignal.timeout(6000),
    });
    if (!geoRes.ok) return null;
    const geo = (await geoRes.json()) as Array<{ lat: string; lon: string }>;
    if (!geo[0]) return null;
    const forecastRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo[0].lat}&longitude=${geo[0].lon}&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max&timezone=Europe%2FBratislava&start_date=${date}&end_date=${date}`,
      { next: { revalidate: 60 * 60 * 6 }, signal: AbortSignal.timeout(6000) },
    );
    if (!forecastRes.ok) return null;
    const data = await forecastRes.json() as { daily?: { temperature_2m_max?: number[]; precipitation_sum?: number[]; wind_speed_10m_max?: number[] } };
    const temp = data.daily?.temperature_2m_max?.[0];
    const rain = data.daily?.precipitation_sum?.[0] ?? 0;
    const wind = data.daily?.wind_speed_10m_max?.[0] ?? 0;
    return { temp, rain, wind, warning: rain > 2 || wind > 35, unavailable: false as const };
  } catch {
    return null;
  }
}

function weatherText(weather: Awaited<ReturnType<typeof weatherFor>>) {
  if (weather?.missingDistrict) return 'Predpoveď sa načíta iba podľa okresu zákazky. Presnú adresu neposielame externej službe.';
  if (weather?.unavailable) return 'Predpoveď je dostupná najviac približne 15 dní dopredu.';
  if (!weather) return 'Predpoveď sa nepodarilo načítať. Termín môžete uložiť aj ručne.';
  return `${weather.warning ? '⚠ Podmienky treba preveriť' : '✓ Bez výrazného upozornenia'} · ${weather.temp ?? '—'} °C · dážď ${weather.rain} mm · vietor ${weather.wind} km/h`;
}

export default async function PlannerPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const selectedJobId = /^[0-9a-f-]{36}$/i.test(params?.zakazka || '') ? params!.zakazka! : '';
  const editId = /^[0-9a-f-]{36}$/i.test(params?.upravit || '') ? params!.upravit! : '';
  const adminUser = await requireAdminUser();
  const workspaceEnabled = jobWorkspaceEnabled();
  const [workers, jobs] = await Promise.all([
    adminUser.role === 'SUPER_ADMIN' ? listWorkers(true) : listOperationalWorkers(true),
    adminUser.role === 'SUPER_ADMIN'
      ? listBusinessJobs({ includeArchived: false, limit: 500 })
      : listOperationalBusinessJobs({ includeArchived: false, limit: 500 }),
  ]);
  const preselectedJob = jobs.find((job) => job.id === selectedJobId);
  const preselectedMonth = /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(preselectedJob?.demolitionDate || '')
    ? preselectedJob!.demolitionDate.slice(0, 7)
    : undefined;
  const meta = monthMeta(params?.mesiac || preselectedMonth);
  const [actions, workspacePlans, selectedWorkspace] = await Promise.all([
    listPlannerActions({ from: dateKey(meta.from), to: dateKey(meta.to) }),
    workspaceEnabled ? listJobWorkspaceOperationalSummaries(adminUser, { from: dateKey(meta.from), to: dateKey(meta.to) }) : [],
    workspaceEnabled && preselectedJob ? getJobWorkspace(preselectedJob.id, adminUser) : null,
  ]);
  const workspaceEvents = workspacePlans.flatMap((workspace) => {
    const plan = workspace.operations.plan;
    const date = plan.actualOn || plan.agreedOn || plan.tentativeOn;
    if (!date || date < dateKey(meta.from) || date > dateKey(meta.to)) return [];
    if (actions.some((action) => action.jobId === workspace.jobId && action.date === date && !['ZRUSENA', 'PRESUNUTA'].includes(action.status))) return [];
    return [{ ...workspace, date, state: plan.actualOn ? 'actual' : plan.agreedOn ? 'agreed' : 'tentative' }];
  });
  const editAction = actions.find((action) => action.id === editId);
  const selectedJob = editAction?.jobId ? jobs.find((job) => job.id === editAction.jobId) : preselectedJob;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const weather = await weatherFor(selectedJob?.district || '', editAction?.date || selectedJob?.demolitionDate || today);
  const collisions = findPlannerCollisions(actions);
  const capacityWarnings = findWorkspaceCapacityWarnings(workspacePlans);
  const collisionActionIds = new Set(collisions.flatMap((collision) => [collision.actionId, collision.conflictingActionId]));
  const days = Array.from({ length: Math.round((meta.to.getTime() - meta.from.getTime()) / 86_400_000) + 1 }, (_, index) => {
    const date = new Date(meta.from);
    date.setUTCDate(meta.from.getUTCDate() + index);
    return date;
  });
  const jobOptions: PlannerJobOption[] = jobs.map((job) => ({
    id: job.id, customerName: job.customerName, customerEmail: job.customerEmail, customerPhone: job.customerPhone,
    location: job.location, district: job.district, demolitionDate: job.demolitionDate, workerNames: job.workers.map((worker) => worker.workerName),
    plannedDate: (job.id === selectedJobId ? selectedWorkspace : workspacePlans.find((workspace) => workspace.jobId === job.id))?.operations.plan.agreedOn
      || (job.id === selectedJobId ? selectedWorkspace : workspacePlans.find((workspace) => workspace.jobId === job.id))?.operations.plan.tentativeOn || '',
  }));
  const baseQuery = selectedJobId ? `&zakazka=${selectedJobId}` : '';

  return (
    <main className="admin-page planner-page ops-page">
      <div className="print-report-heading"><img src="/assets/astana-logo.png" alt="ASTANA" /><p>ASTANA — Plán akcií {meta.title}</p></div>
      <div className="admin-heading ops-heading">
        <div><p>Termíny, tím a terén</p><h1>Plánovač</h1><span>Jedna obrazovka na plánovanie, kontrolu kolízií a manuálne úpravy.</span></div>
        <div className="admin-action-row no-print">
          <a className="admin-secondary-link" href={`/admin/planovac?mesiac=${meta.prev}${baseQuery}`}>‹ Predchádzajúci</a>
          <a className="admin-secondary-link" href={`/admin/planovac?mesiac=${meta.next}${baseQuery}`}>Ďalší ›</a>
          <PrintButton />
        </div>
      </div>

      {params?.notice ? <p className="ops-notice" role="status">{params.notice.slice(0, 160)}</p> : null}
      {collisions.length ? <section className="ops-alert ops-alert-danger no-print" aria-labelledby="planner-collisions">
        <div><span>Kolízie tímu</span><h2 id="planner-collisions">{collisions.length} prekrývajúcich sa priradení</h2></div>
        <ul>{collisions.slice(0, 6).map((collision) => <li key={`${collision.actionId}-${collision.conflictingActionId}-${collision.worker}`}><strong>{collision.worker}</strong> · {collision.date} · {collision.detail}</li>)}</ul>
      </section> : <p className="ops-alert ops-alert-success no-print"><strong>Bez kolízie pracovníkov.</strong> Aktívne termíny v zobrazenom mesiaci sa neprekrývajú.</p>}
      {capacityWarnings.length ? <section className={`ops-alert ${capacityWarnings.some((warning) => warning.certainty === 'OVERLAP') ? 'ops-alert-danger' : 'ops-alert-warning'} no-print`} aria-labelledby="workspace-capacity-title"><div><span>Kapacity v pracovných kartách</span><h2 id="workspace-capacity-title">Preverte autá a posádku · {capacityWarnings.length}</h2></div><ul>{capacityWarnings.slice(0, 12).map((warning, index) => <li key={`${warning.firstJobId}-${warning.secondJobId}-${warning.resourceId}-${index}`}><strong>{warning.resource === 'VEHICLE' ? `Vozidlo ${warning.resourceId}` : workers.find((worker) => worker.id === warning.resourceId)?.name || 'Pracovník'}</strong> · {warning.date} · <a href={`/admin/zakazky/${warning.firstJobId}#karta-planovanie`}>{warning.firstNumber}</a> a <a href={`/admin/zakazky/${warning.secondJobId}#karta-planovanie`}>{warning.secondNumber}</a> · {warning.certainty === 'OVERLAP' ? 'zadané časy sa prekrývajú' : 'dve zákazky v deň; presné časy ešte treba porovnať'}</li>)}</ul><p>Upozornenie používa ručne pridelené vozidlá a posádku. Neurčuje dojazd ani trasu medzi zákazkami.</p></section> : null}

      <section className="admin-card no-print ops-panel">
        <div className="ops-section-heading">
          <div><span>{editAction ? 'Úprava' : 'Nový termín'}</span><h2>{editAction ? `${typeLabels[editAction.type]} · ${editAction.date}` : 'Naplánovať akciu'}</h2></div>
          <p>Výber zákazky automaticky doplní adresu, kontakt, dátum a tím. Počasie sa vyhľadáva iba podľa okresu; presná adresa neopustí admin.</p>
        </div>
        {selectedWorkspace ? <div className={workspaceStyles.summary}>
          <h3>{selectedWorkspace.number} · Príprava posádky</h3>
          <p>{selectedWorkspace.operations.workType === 'ODVOZ' ? 'Samostatný odvoz z pozemku' : selectedWorkspace.operations.workType === 'DEMONTAZ' ? 'Demontáž' : 'Demontáž s odvozom'} · ľudia {selectedWorkspace.operations.plan.plannedCrewCount ?? '?'} · autá {selectedWorkspace.operations.plan.plannedVehicleCount ?? '?'}{selectedWorkspace.operations.plan.confirmedCapacityKg !== null ? ` · potvrdená nosnosť ${selectedWorkspace.operations.plan.confirmedCapacityKg} kg` : ''}</p>
          {selectedWorkspace.operations.materials.length ? <ul>{selectedWorkspace.operations.materials.map((material) => <li key={material.id}>{material.label || ({ VLNITY_ETERNIT:'Vlnitý eternit', HLADKY_ETERNIT:'Hladký eternit', INTERIER:'Interiér', AZBESTOVE_RURY:'Azbestové rúry', VZDUCHOTECHNIKA:'Vzduchotechnika', INE:'Iný materiál' }[material.kind])} · {material.plannedQuantity ?? '?'} {({ M2:'m²', M:'m', KS:'ks', KG:'kg' }[material.unit])} · hmotnosť {material.plannedKg === null ? 'neurčená' : `${material.plannedKg} kg`}</li>)}</ul> : <p>Materiály a hmotnosť ešte treba doplniť.</p>}
          {selectedWorkspace.operations.plan.accessNote ? <p>Prístup: {selectedWorkspace.operations.plan.accessNote}</p> : null}
          <a href={`/admin/zakazky/${selectedWorkspace.jobId}#karta-planovanie`}>Upraviť pracovnú kartu a pokyny</a>
        </div> : null}
        <PlannerForm csrfToken={csrfTokenForEmail(adminUser.email)} jobs={jobOptions} workerNames={workers.map((worker) => worker.name)} selectedJobId={selectedJobId} editAction={editAction} month={meta.key} today={today} weatherSummary={weatherText(weather)} />
      </section>

      <section className="admin-card planner-calendar no-print ops-panel">
        <div className="ops-section-heading"><div><span>Kalendár</span><h2>{meta.title}</h2></div><p>Kliknutím na akciu otvoríte jej úpravu. Červený lem znamená kolíziu pracovníka.</p></div>
        {workspaceEnabled ? <><div className={workspaceStyles.legend}><span>Predbežný termín karty</span><span>Dohodnutý termín karty</span><span>Skutočný deň</span></div>
        <p className="admin-muted-note">Termíny z kariet bez samostatnej akcie majú prerušovaný lem. Posádku a presný čas rezervujte cez konkrétnu akciu; viac zákaziek v jeden deň je podporovaných.</p></> : null}
        <div className="planner-grid planner-weekdays">{['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map((day) => <strong key={day}>{day}</strong>)}</div>
        <div className="planner-grid">
          {days.map((day) => {
            const key = dateKey(day);
            const dayActions = actions.filter((action) => action.date === key);
            return (
              <article className={`${day.getUTCMonth() === meta.index ? '' : 'is-muted'}${key === today ? ' is-today' : ''}`} key={key}>
                <span>{day.getUTCDate()}</span>
                {dayActions.map((action) => (
                  <a className={`planner-event is-${action.type.toLowerCase()}${collisionActionIds.has(action.id) ? ' has-collision' : ''}`} key={action.id} href={`/admin/planovac?mesiac=${meta.key}&upravit=${action.id}${action.jobId ? `&zakazka=${action.jobId}` : ''}`}>
                    <b>{action.timeFrom}</b> {typeLabels[action.type]}<br /><small>{action.address}</small>
                  </a>
                ))}
                {workspaceEvents.filter((event) => event.date === key).map((event) => <a key={event.jobId} className={workspaceStyles.event} data-state={event.state} href={`/admin/zakazky/${event.jobId}#karta-planovanie`}><strong>{event.state === 'tentative' ? 'Predbežne' : event.state === 'actual' ? 'Realizované' : 'Dohodnuté'} · {event.operations.workType === 'ODVOZ' ? 'Odvoz' : 'Demontáž'}</strong>{event.customerName}<small>{event.location} · {event.operations.plan.plannedVehicleCount ?? '?'} áut</small></a>)}
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-card planner-print-list ops-panel">
        <div className="ops-section-heading"><div><span>Operatíva</span><h2>Zoznam akcií</h2></div><p>Stav aj termín zostávajú vždy ručne upraviteľné.</p></div>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Dátum</th><th>Čas</th><th>Adresa</th><th>Tím</th><th>Typ</th><th>Stav</th><th className="no-print">Akcia</th></tr></thead>
          <tbody>
            {actions.map((action) => <tr className={collisionActionIds.has(action.id) ? 'ops-row-danger' : ''} key={action.id}><td>{action.date}</td><td>{action.timeFrom} – {action.timeTo}</td><td>{action.address}</td><td>{action.workers || '—'}</td><td>{typeLabels[action.type]}</td><td>{statusLabels[action.status]}</td><td className="no-print"><a className="admin-row-link" href={`/admin/planovac?mesiac=${meta.key}&upravit=${action.id}${action.jobId ? `&zakazka=${action.jobId}` : ''}`}>Upraviť</a>{action.jobId ? <a className="admin-row-link" href={`/admin/zakazky/${action.jobId}`}>Zákazka</a> : null}</td></tr>)}
            {!actions.length ? <tr><td colSpan={7}>V tomto mesiaci nie sú naplánované žiadne akcie.</td></tr> : null}
          </tbody>
        </table></div>
      </section>
    </main>
  );
}
