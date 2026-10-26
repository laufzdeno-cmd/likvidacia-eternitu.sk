import { requireAdminUser } from '@/src/server/auth';
import { getAdminOperationsOverview } from '@/src/server/admin-intelligence';

function euroCents(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value / 100);
}
function dateSk(value: string) {
  return value ? new Intl.DateTimeFormat('sk-SK').format(new Date(`${value}T12:00:00`)) : '—';
}

export default async function DataControlPage() {
  const user = await requireAdminUser();
  const data = await getAdminOperationsOverview(user.role);
  const rewardOverview = 'rewardOverview' in data.capacity ? data.capacity.rewardOverview : undefined;
  const qualityCards = [
    ['Dopyty bez vlastníka', data.qualityIssues.leadsWithoutOwner.length, '/admin/dopyty?queue=unassigned'],
    ['Dopyty bez ďalšieho kroku', data.qualityIssues.leadsWithoutNextStep.length, '/admin/dopyty'],
    ['Zákazky bez kontaktu', data.qualityIssues.jobsWithoutContact.length, '/admin/zakazky'],
    ['Realizácie bez pracovníkov', data.qualityIssues.jobsWithoutWorkers.length, '/admin/planovac'],
    ['Dokončené zákazky bez evidovaného kroku Dokumentácia', data.qualityIssues.jobsWithoutDocuments.length, '/admin/zakazky'],
    ...(user.role === 'SUPER_ADMIN' ? [
      ['Zákazky bez nákladov', data.qualityIssues.jobsWithoutCosts.length, '/admin/zakazky'],
      ['Neobvyklá cena za m²', data.qualityIssues.unusualPriceJobs.length, '/admin/zakazky'],
    ] as const : []),
    ['Ponuky na preverenie', data.qualityIssues.uncertainOffers.length, '/admin/ponuky'],
    ['Plán bez času', data.qualityIssues.plannerWithoutTime.length, '/admin/planovac'],
  ] as const;

  return <main className="admin-page intelligence-page">
    <header className="intelligence-hero"><div><p>Kontrolné centrum</p><h1>Prevádzka, dáta a výkon</h1><span>Jednoznačné kontroly nad existujúcimi záznamami. Systém nič neopravuje automaticky — každú zmenu potvrdí človek v zdrojovom module.</span></div><a href="/admin/asistent">Otvoriť dnešnú frontu</a></header>

    <section className="intelligence-kpi-grid" aria-label="Obchodný výkon tento mesiac">
      <article><span>Prijaté dopyty</span><strong>{data.performance.leads}</strong><small>Nové dnes {data.performance.newToday}</small></article>
      <article><span>Prvý kontakt</span><strong>{data.performance.contactedLeads}</strong><small>Unikátne dopyty s evidovaným prechodom do kontaktovaného alebo neskoršieho stavu</small></article>
      <article><span>Vytvorené ponuky</span><strong>{data.performance.offersCreated}</strong><small>Udalosti vytvorenia v tomto mesiaci</small></article>
      <article><span>Odoslané ponuky</span><strong>{data.performance.offersSent}</strong><small>Udalosti odoslania v tomto mesiaci</small></article>
      <article><span>Prijaté ponuky</span><strong>{data.performance.offersAccepted}</strong><small>Udalosti prijatia v tomto mesiaci</small></article>
      <article><span>Dokončené realizácie</span><strong>{data.performance.completedJobs}</strong><small>Unikátne zákazky s evidovanou zmenou stavu na Dokončená v tomto mesiaci</small></article>
      {user.role === 'SUPER_ADMIN' && 'paidJobs' in data.performance ? <article><span>Zákazky s účinnou úhradou</span><strong>{data.performance.paidJobs ?? 0}</strong><small>Aktívne prijaté úhrady v mesiaci · {euroCents(data.performance.netReceivedCents ?? 0)}</small></article> : null}
      <article><span>Prijaté referencie</span><strong>{data.performance.reviewsReceived}</strong><small>Pripravené žiadosti v mesiaci {data.performance.reviewRequests}</small></article>
    </section>

    <section className="admin-card intelligence-checks" id="kvalita-dat"><header><div><p>Spoľahlivosť prehľadov</p><h2>Kontrola kvality dát</h2></div><span>Aktuálny stav</span></header><div className="intelligence-check-grid">{qualityCards.map(([label, count, href]) => <a className={count ? 'has-issue' : 'is-ok'} href={href} key={label}><span>{label}</span><strong>{count}</strong><small>{count ? 'Otvoriť a skontrolovať' : 'Bez nálezu'}</small></a>)}</div></section>

    <IssueList id="zaseknute-zakazky" eyebrow="Obchod a realizácia" title="Zaseknuté zákazky" note="Otvorené záznamy bez úpravy dlhšie ako 7 dní." empty="Žiadna zákazka nie je podľa tohto pravidla zaseknutá.">
      {data.stalledJobs.slice(0, 30).map((job) => <a className="intelligence-result-row" href={`/admin/zakazky/${job.id}`} key={job.id}><span><strong>{job.customerName}</strong><small>{job.location} · naposledy upravené {new Intl.DateTimeFormat('sk-SK').format(new Date(job.updatedAt))}</small></span><em>{job.status.replaceAll('_', ' ')}</em></a>)}
    </IssueList>

    <IssueList id="ponuky-bez-reakcie" eyebrow="Následný kontakt" title="Ponuky bez reakcie" note="Odoslané najmenej 5 dní bez prijatia alebo zrušenia." empty="Žiadna odoslaná ponuka nečaká dlhšie ako päť dní.">
      {data.silentOffers.slice(0, 30).map((offer) => <a className="intelligence-result-row" href={`/admin/ponuky/${offer.id}`} key={offer.id}><span><strong>{offer.number} · {offer.contactPerson}</strong><small>{offer.municipality} · odoslaná {offer.sentAt ? new Intl.DateTimeFormat('sk-SK').format(new Date(offer.sentAt)) : 'dátum neuvedený'}</small></span><em>Pripomenúť ponuku</em></a>)}
    </IssueList>

    <section className="admin-card intelligence-capacity" id="kapacita"><header><div><p>Nasledujúcich 14 dní</p><h2>Kapacita tímu</h2></div><a href="/admin/planovac">Otvoriť plánovač</a></header><div className="intelligence-capacity-grid"><article><span>Otvorené akcie</span><strong>{data.capacity.openActions.length}</strong></article><article className={data.capacity.unassignedActions.length ? 'has-issue' : ''}><span>Bez pracovníka</span><strong>{data.capacity.unassignedActions.length}</strong></article><article className={data.capacity.collisions.length ? 'has-issue' : ''}><span>Časové kolízie</span><strong>{data.capacity.collisions.length}</strong></article><article><span>Pracovné dni bez naplánovanej akcie</span><strong>{data.capacity.freeWorkdays.length}</strong><small>{data.capacity.freeWorkdays.slice(0, 4).map(dateSk).join(', ') || 'žiadny'}</small></article></div>{data.capacity.collisions.length ? <ul className="intelligence-alert-list">{data.capacity.collisions.slice(0, 10).map((collision) => <li key={`${collision.first.id}-${collision.second.id}`}><strong>{dateSk(collision.first.date)} · {collision.first.timeFrom || 'bez času'}</strong><span>{collision.first.customerName || collision.first.address} × {collision.second.customerName || collision.second.address}</span><small>{collision.reason}</small></li>)}</ul> : <p className="admin-muted-note">Nenašli sa prekrývajúce sa akcie rovnakej zákazky ani rovnakého pracovníka.</p>}<div className="intelligence-workload">{data.capacity.workload.map((worker) => <div key={worker.id}><span>{worker.name}</span><meter min={0} max={Math.max(1, ...data.capacity.workload.map((item) => item.actions))} value={worker.actions}>{worker.actions}</meter><strong>{worker.actions}</strong></div>)}</div>{user.role === 'SUPER_ADMIN' && rewardOverview ? <div><p className="admin-muted-note">Evidované odmeny zákaziek s dátumom realizácie v aktuálnom mesiaci:</p><div className="intelligence-workload">{rewardOverview.map((worker) => <div key={worker.id}><span>{worker.name}</span><strong>{new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(worker.amount)}</strong></div>)}</div></div> : null}</section>

    {user.role === 'SUPER_ADMIN' ? <IssueList id="pohladavky" eyebrow="Iba superadmin" title="Faktúry po splatnosti" note="Iba skutočne zaevidované faktúry po odpočítaní účinných úhrad." empty="Nie je evidovaná žiadna neuhradená faktúra po splatnosti.">
      {data.overdueInvoices.slice(0, 30).map((row) => <a className="intelligence-result-row" href={`/admin/zakazky/${row.job.id}`} key={`${row.job.id}-${row.invoiceNumber}`}><span><strong>{row.invoiceNumber} · {row.job.customerName}</strong><small>Splatnosť {dateSk(row.dueOn)} · {row.job.location}</small></span><em>{euroCents(row.outstandingCents)}</em></a>)}
    </IssueList> : null}

    <IssueList eyebrow="Integračné miesto" title="Kandidáti na referenciu" note="Dokončené zákazky bez evidovanej žiadosti. Odoslanie zostáva manuálne." empty="Všetky dokončené zákazky s väzbou na dopyt už majú evidovanú žiadosť.">
      {data.referenceCandidates.slice(0, 30).map((job) => <a className="intelligence-result-row" href="/admin/referencie" key={job.id}><span><strong>{job.customerName}</strong><small>{job.location} · realizácia {dateSk(job.realizationDate)}</small></span><em>Otvoriť referencie</em></a>)}
    </IssueList>
  </main>;
}

function IssueList({ id, eyebrow, title, note, empty, children }: { id?: string; eyebrow: string; title: string; note: string; empty: string; children: React.ReactNode }) {
  const count = Array.isArray(children) ? children.length : 0;
  return <section className="admin-card intelligence-issue-list" id={id}><header><div><p>{eyebrow}</p><h2>{title}</h2><span>{note}</span></div><strong>{count}</strong></header><div>{count ? children : <p className="intelligence-inline-empty">✓ {empty}</p>}</div></section>;
}
