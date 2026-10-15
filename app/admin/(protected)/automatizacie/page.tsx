import { csrfTokenForEmail, requireSuperAdmin } from '@/src/server/auth';
import { getAdminApprovalQueue, getAdminOperationsOverview, type AdminApprovalQueueItem } from '@/src/server/admin-intelligence';
import { getAdminAssistantMetrics } from '@/src/server/admin-assistant-metrics';
import { listAdminAutopilotRunItems, listAdminAutopilotRuns } from '@/src/server/db';
import { runAdminAutopilotAction } from './actions';

const approvalCategoryLabels: Record<AdminApprovalQueueItem['category'], string> = {
  offer_approval: 'Schválenie CP',
  offer_outcome: 'Výsledok CP',
  review_send: 'Odoslanie žiadosti',
  review_reminder: 'Pripomienka',
  review_moderation: 'Referencia',
  delivery_resolution: 'Neznáme doručenie',
  photo_review: 'Fotografia',
  case_draft: 'Koncept realizácie',
  case_approval: 'Schválenie prípadu',
  case_publication: 'Publikovanie prípadu',
  realization_publication: 'Publikovanie realizácie',
};

function eventStatus(result: string, at?: string) {
  if (!at) return `${result} · bez evidovaného vykonania v aktuálnom mesiaci`;
  return `${result} · ${new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(at))}`;
}

function eventTime(at: string) {
  return new Intl.DateTimeFormat('sk-SK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Bratislava',
  }).format(new Date(at));
}

function durationLabel(minutes: number | null) {
  if (minutes === null) return 'bez vzorky';
  if (minutes >= 1_440) return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(minutes / 1_440)} dňa`;
  if (minutes >= 60) return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(minutes / 60)} h`;
  return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 }).format(minutes)} min`;
}

function metricPeriodLabel(from: string, to: string) {
  const format = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'short', timeZone: 'Europe/Bratislava' });
  return `${format.format(new Date(from))} – ${format.format(new Date(Date.parse(to) - 1))}`;
}

const runStatusLabels = {
  running: 'Práve prebieha',
  succeeded: 'Úspešný',
  degraded: 'Vyžaduje kontrolu',
  failed: 'Zlyhal',
} as const;

const moduleLabels = {
  offers: 'cenové ponuky',
  review_requests: 'žiadosti o referenciu',
  photo_intake: 'fotografie a koncepty realizácií',
} as const;

const blockerLabels: Record<string, string> = {
  missing_customer_name: 'chýba meno zákazníka',
  missing_customer_email: 'chýba použiteľný email',
  missing_customer_phone: 'chýba použiteľný telefón',
  missing_location: 'chýba lokalita',
  missing_object_type: 'chýba typ objektu',
  missing_material_type: 'chýba typ materiálu',
  missing_area: 'chýba výmera',
  missing_price_rule: 'chýba cenové pravidlo',
  offer_prepare_failed: 'koncept CP sa nepodarilo pripraviť',
  review_prepare_failed: 'žiadosť o referenciu sa nepodarilo pripraviť',
  photo_attach_failed: 'fotografiu sa nepodarilo pripojiť ku konceptu',
};

export default async function AutomationsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const user = await requireSuperAdmin();
  const csrfToken = csrfTokenForEmail(user.email);
  const [data, approvals, autopilotRuns, assistantMetrics] = await Promise.all([
    getAdminOperationsOverview(user.role),
    getAdminApprovalQueue(user.role),
    listAdminAutopilotRuns(12),
    getAdminAssistantMetrics(user.role),
  ]);
  const latestRunItems = autopilotRuns[0] ? await listAdminAutopilotRunItems(autopilotRuns[0].id) : [];
  const latestCollisionAt = data.capacity.collisions
    .flatMap((collision) => [collision.first.createdAt, collision.second.createdAt])
    .sort((a, b) => b.localeCompare(a))[0];
  const latestStalledAt = data.stalledJobs.map((job) => job.updatedAt).sort((a, b) => b.localeCompare(a))[0];
  const latestReferenceAt = data.referenceCandidates.map((job) => `${job.realizationDate}T12:00:00.000Z`).sort((a, b) => b.localeCompare(a))[0];
  const executionHistory = [
    { name: 'Dopyt prijatý', result: 'Platný dopyt bol uložený do evidencie.', at: data.automationEvents.leadReceived },
    { name: 'Prvý kontakt zaznamenaný', result: 'Stav dopytu bol zmenený na kontaktovaný alebo neskoršiu fázu.', at: data.automationEvents.leadContacted },
    { name: 'Cenová ponuka odoslaná', result: 'V evidencii ponuky bol uložený čas odoslania.', at: data.automationEvents.offerSent },
    { name: 'Cenová ponuka prijatá', result: 'V evidencii ponuky bol uložený čas prijatia.', at: data.automationEvents.offerAccepted },
    { name: 'Realizácia dokončená', result: 'Zákazka prešla uloženou udalosťou dokončenia.', at: data.automationEvents.jobCompleted },
    ...(user.role === 'SUPER_ADMIN'
      ? [{ name: 'Úhrada zaevidovaná', result: 'Bola uložená účinná prijatá platba bez evidovaného storna.', at: data.automationEvents.paymentReceived }]
      : []),
  ].filter((event): event is { name: string; result: string; at: string } => Boolean(event.at))
    .sort((left, right) => right.at.localeCompare(left.at));
  const rules = [
    { name: 'Nový dopyt', trigger: 'Prijatý platný webový dopyt', prepares: 'Záznam, zákazku, emaily a koncept CP, ak sú podklady úplné', approval: 'Admin skontroluje cenu, sprievodný list a odoslanie', status: eventStatus(`${data.performance.leads} prijatých dopytov tento mesiac`, data.automationEvents.leadReceived), tone: 'active' },
    { name: 'Follow-up dopytu', trigger: 'Termín kontaktovania je dnes alebo po termíne', prepares: 'Upozornenie a odkaz na dopyt', approval: 'Operátor vykoná kontakt a zapíše výsledok', status: eventStatus(`${data.performance.contactedLeads} dopytov s evidovaným prvým kontaktom`, data.automationEvents.leadContacted), tone: 'active' },
    { name: 'Ponuka bez reakcie', trigger: 'Odoslaná ponuka čaká najmenej 5 dní', prepares: 'Follow-up vo fronte Dnes', approval: 'Text aj odoslanie schvaľuje človek', status: eventStatus(`${data.silentOffers.length} ponúk čaká`, data.automationEvents.offerSent), tone: data.silentOffers.length ? 'attention' : 'ok' },
    { name: 'Zaseknutá zákazka', trigger: 'Otvorená zákazka bez zmeny dlhšie ako 7 dní', prepares: 'Kontrolný bod s odkazom na zákazku', approval: 'Zodpovedná osoba určí ďalší krok', status: eventStatus(`${data.stalledJobs.length} nálezov`, latestStalledAt), tone: data.stalledJobs.length ? 'attention' : 'ok' },
    { name: 'Kolízia kapacity', trigger: 'Prekrývajúci sa čas rovnakej zákazky alebo pracovníka', prepares: 'Varovanie v kontrole prevádzky', approval: 'Plán upraví človek', status: eventStatus(`${data.capacity.collisions.length} kolízií`, latestCollisionAt), tone: data.capacity.collisions.length ? 'attention' : 'ok' },
    { name: 'Referencia po realizácii', trigger: 'Dokončená zákazka bez evidovanej žiadosti', prepares: 'Čakajúcu žiadosť s adresátom, textom a súkromným odkazom', approval: 'Človek skontroluje text a odošle prvú žiadosť', status: eventStatus(`${data.referenceCandidates.length} kandidátov ešte čaká na prípravu`, latestReferenceAt), tone: 'ready' },
    { name: 'Fotky hotovej zákazky', trigger: 'Interne schválená súkromná fotografia', prepares: 'Súkromný koncept s pripojenými fotkami, lokalitou a typom objektu', approval: 'Superadmin doplní text a overí práva, presnosť lokality, obsah aj publikovanie', status: `${approvals.counts.case_draft} konceptov čaká na redakciu`, tone: approvals.counts.case_draft ? 'attention' : 'ok' },
    { name: 'Pripomienka referencie', trigger: 'Odoslaná žiadosť dosiahne termín pripomienky', prepares: 'Najviac jednu pripomienku iba pri vopred uloženom povolení', approval: 'Človek ju musí povoliť už pri príprave žiadosti; následné odoslanie spracuje chránená úloha', status: 'Bez uloženého povolenia a termínu sa nič nevykoná', tone: 'active' },
    { name: 'Faktúra po splatnosti', trigger: 'Účinná faktúra má zostatok po dátume splatnosti', prepares: 'Upozornenie iba pre superadmina', approval: 'Superadmin preverí platbu a rozhodne o kontakte', status: eventStatus(`${data.overdueInvoices.length} faktúr po splatnosti`, data.automationEvents.paymentReceived), tone: data.overdueInvoices.length ? 'attention' : 'ok' },
    { name: 'Návrh správy', trigger: 'Ručné otvorenie asistenta', prepares: 'Textovú šablónu lokálne v prehliadači', approval: 'Človek text skontroluje, skopíruje a odošle mimo asistenta', status: 'Manuálny nástroj · automatické vykonanie neexistuje', tone: 'manual' },
  ];

  return <main className="admin-page intelligence-page">
    <header className="intelligence-hero"><div><p>Firemný autopilot</p><h1>Centrum asistenta</h1><span>Asistent pripravuje cenové ponuky, ďalšie kroky, koncepty realizácií a žiadosti o referenciu. Človek kontroluje a schvaľuje všetko, čo odchádza zákazníkovi alebo na verejný web.</span></div><form action={runAdminAutopilotAction}><input type="hidden" name="_csrf" value={csrfToken} /><button className="admin-primary-button" type="submit">Spustiť asistenta teraz</button></form></header>
    {query.run && /^\d+-\d+-\d+-\d+-\d+-\d+-(succeeded|degraded|failed)$/.test(query.run) ? (() => { const [offers, reviews, cases, photos, blocked, unavailable, status] = query.run!.split('-'); return <p className={`work-notice is-${status === 'succeeded' ? 'success' : status === 'failed' ? 'error' : 'warning'}`} role="status">Asistent pripravil {offers} CP, {reviews} žiadostí o referenciu, {cases} konceptov realizácií a pripojil {photos} fotiek. Blokované podklady: {blocked}. Nedostupné moduly: {unavailable}.{status === 'failed' ? ' Beh zlyhal; najprv skontrolujte zdravie a dôvod posledného behu nižšie.' : status === 'degraded' ? ' Skontrolujte zdravie posledného behu nižšie.' : ''}</p>; })() : null}
    <section className="admin-card autopilot-health" aria-labelledby="autopilot-health-title">
      <header><div><p>Skutočné behy automatizácie</p><h2 id="autopilot-health-title">Zdravie asistenta</h2><span>Každý ručný aj plánovaný beh má trvalý výsledok. História neukladá osobné údaje zákazníkov.</span></div><strong className={`is-${autopilotRuns[0]?.status || 'empty'}`}>{autopilotRuns[0] ? runStatusLabels[autopilotRuns[0].status] : 'Bez behov'}</strong></header>
      {autopilotRuns[0]?.unavailableModules.length ? <p className="work-notice is-warning" role="status">Posledný beh nedokončil tieto moduly: {autopilotRuns[0].unavailableModules.map((module) => moduleLabels[module]).join(', ')}.</p> : null}
      {autopilotRuns.length ? <div className="autopilot-run-list">{autopilotRuns.map((run) => <article className={`is-${run.status}`} key={run.id}>
        <div><span>{run.trigger === 'cron' ? 'Plánovaný beh' : run.trigger === 'test' ? 'Testovací beh' : 'Ručný beh'}</span><strong>{runStatusLabels[run.status]}</strong><small>{eventTime(run.startedAt)}{run.finishedAt ? ` · ${Math.max(0, Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000))} s` : ''}</small></div>
        <dl><div><dt>CP</dt><dd>{run.counts.priceOffersCreated}</dd></div><div><dt>Referencie</dt><dd>{run.counts.reviewRequestsPrepared}</dd></div><div><dt>Koncepty</dt><dd>{run.counts.realizationDraftsCreated}</dd></div><div><dt>Fotky</dt><dd>{run.counts.photosAttached}</dd></div><div><dt>Blokované</dt><dd>{run.counts.blockedOffers}</dd></div></dl>
      </article>)}</div> : <p className="intelligence-inline-empty">História sa začne zapisovať pri najbližšom ručnom alebo plánovanom behu asistenta.</p>}
      {latestRunItems.some((item) => item.outcome !== 'created') ? <details className="autopilot-run-details"><summary>Prečo posledný beh niečo nepripravil</summary><ul>{latestRunItems.filter((item) => item.outcome !== 'created').map((item) => <li key={item.id}><span>{moduleLabels[item.module]}</span><strong>{blockerLabels[item.reasonCode] || item.reasonCode || 'neznámy dôvod'}</strong>{item.module === 'offers' ? <a href={`/admin/zakazky/${item.entityId}`}>Otvoriť zákazku</a> : null}</li>)}</ul></details> : null}
    </section>
    <section className="admin-card assistant-metrics" aria-labelledby="assistant-metrics-title">
      <header><div><p>Posledných 30 dní oproti predchádzajúcim 30 dňom</p><h2 id="assistant-metrics-title">{assistantMetrics.title}</h2><span>{assistantMetrics.disclaimer}</span></div><strong>{metricPeriodLabel(assistantMetrics.current.period.fromInclusive, assistantMetrics.current.period.toExclusive)}</strong></header>
      {!assistantMetrics.coverage.complete ? <p className="work-notice is-warning" role="status">Zdroj dosiahol bezpečný limit záznamov. Ukazovatele sú čiastočné a nemajú sa používať ako úplný firemný report.</p> : null}
      <div className="assistant-metric-grid">
        <article><span>Asistent pripravil</span><strong>{assistantMetrics.current.autopilot.prepared}</strong><small>Predtým {assistantMetrics.previous.autopilot.prepared} · blokované {assistantMetrics.current.autopilot.blocked} · zlyhané {assistantMetrics.current.autopilot.failed}</small></article>
        <article><span>CP skontrolované a odoslané</span><strong>{assistantMetrics.current.autopilot.humanApprovedAndSentOffers}</strong><small>Po príprave asistenta · predtým {assistantMetrics.previous.autopilot.humanApprovedAndSentOffers}</small></article>
        <article><span>Návrhy použité bez zmeny</span><strong>{assistantMetrics.current.suggestions.accepted}</strong><small>Upravené {assistantMetrics.current.suggestions.modified} · odmietnuté {assistantMetrics.current.suggestions.dismissed} · zastarané {assistantMetrics.current.suggestions.stale}</small></article>
        <article><span>Dopyt → prvá CP</span><strong>{durationLabel(assistantMetrics.current.leadToFirstPriceOffer.medianMinutes)}</strong><small>p90 {durationLabel(assistantMetrics.current.leadToFirstPriceOffer.p90Minutes)} · vzorka {assistantMetrics.current.leadToFirstPriceOffer.sampleSize}/{assistantMetrics.current.leadToFirstPriceOffer.cohortSize}</small></article>
        <article><span>Odoslaná CP → výsledok</span><strong>{durationLabel(assistantMetrics.current.sentPriceOfferToOutcome.medianMinutes)}</strong><small>p90 {durationLabel(assistantMetrics.current.sentPriceOfferToOutcome.p90Minutes)} · vzorka {assistantMetrics.current.sentPriceOfferToOutcome.sampleSize}/{assistantMetrics.current.sentPriceOfferToOutcome.cohortSize}</small></article>
        <article><span>Predchádzajúce obdobie</span><strong>{metricPeriodLabel(assistantMetrics.previous.period.fromInclusive, assistantMetrics.previous.period.toExclusive)}</strong><small>Dopyt → CP {durationLabel(assistantMetrics.previous.leadToFirstPriceOffer.medianMinutes)} · CP → výsledok {durationLabel(assistantMetrics.previous.sentPriceOfferToOutcome.medianMinutes)}</small></article>
      </div>
    </section>
    <section className="admin-card approval-queue" aria-labelledby="approval-queue-title">
      <header><div><p>Iba superadmin</p><h2 id="approval-queue-title">Čaká na schválenie</h2><span>Autoritatívna fronta odoslaní, pripomienok, neznámych doručení, referencií, fotografií a publikovania.</span></div><strong>{approvals.items.length}</strong></header>
      {approvals.unavailableSources.length ? <p className="work-notice is-warning" role="status">Niektoré zdroje sa nepodarilo načítať: {approvals.unavailableSources.join(', ')}. Frontu nepovažujte za úplnú.</p> : null}
      <div className="approval-summary" aria-label="Súhrn čakajúcich schválení"><span>Cenové ponuky <strong>{approvals.counts.offer_approval}</strong></span><span>Výsledky CP <strong>{approvals.counts.offer_outcome}</strong></span><span>Odoslanie žiadostí <strong>{approvals.counts.review_send}</strong></span><span>Referencie <strong>{approvals.counts.review_moderation}</strong></span><span>Fotografie <strong>{approvals.counts.photo_review}</strong></span><span>Koncepty realizácií <strong>{approvals.counts.case_draft}</strong></span><span>Publikovanie <strong>{approvals.counts.case_approval + approvals.counts.case_publication + approvals.counts.realization_publication}</strong></span></div>
      {approvals.items.length ? <ol className="approval-list">{approvals.items.map((item) => <li className={`is-${item.urgency}`} key={item.id}><span className="approval-kind">{approvalCategoryLabels[item.category]}</span><div><strong>{item.title}</strong><p>{item.detail}</p><small>Čaká od {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(item.createdAt))}</small></div><a href={item.href}>Otvoriť pracovný priestor</a></li>)}</ol> : approvals.unavailableSources.length ? null : <p className="intelligence-inline-empty">✓ Momentálne nič nečaká na superadmin schválenie.</p>}
    </section>
    <section className="automation-legend"><span><i className="is-active" />Aktívne pravidlo</span><span><i className="is-attention" />Čaká zásah</span><span><i className="is-manual" />Iba manuálny nástroj</span></section>
    <section className="admin-card automation-matrix" aria-labelledby="automation-title"><header><div><p>Aktuálna konfigurácia</p><h2 id="automation-title">Matica automatizácií</h2></div><strong>{rules.length} pravidiel</strong></header><div className="admin-table-wrap" role="region" aria-label="Matica automatizácií" tabIndex={0}><table className="admin-table"><thead><tr><th>Pravidlo</th><th>Spúšťač</th><th>Čo systém pripraví</th><th>Kto schvaľuje</th><th>Posledný stav</th></tr></thead><tbody>{rules.map((rule) => <tr key={rule.name}><th scope="row"><span className={`automation-dot is-${rule.tone}`} />{rule.name}</th><td>{rule.trigger}</td><td>{rule.prepares}</td><td>{rule.approval}</td><td><strong>{rule.status}</strong></td></tr>)}</tbody></table></div></section>
    <section className="admin-card intelligence-results" aria-labelledby="automation-history-title">
      <header><div><p>Audit udalostí</p><h2 id="automation-history-title">Naposledy vykonané zdrojové udalosti</h2></div><strong>{executionHistory.length}</strong></header>
      <p className="admin-muted-note">Ide o skutočne uložené udalosti, z ktorých pravidlá čerpajú. Nejde o dôkaz, že systém automaticky odoslal správu alebo vykonal obchodné rozhodnutie. História neobsahuje osobné údaje zákazníkov.</p>
      <div>
        {executionHistory.length ? executionHistory.map((event) => <div className="intelligence-result-row" key={`${event.name}-${event.at}`}>
          <span><strong>{event.name}</strong><small>{event.result}</small></span>
          <em>{eventTime(event.at)}</em>
        </div>) : <p className="admin-muted-note">V aktuálnom mesiaci zatiaľ nie je uložená žiadna podporovaná zdrojová udalosť.</p>}
      </div>
    </section>
    <section className="assistant-guardrail admin-card"><div><span aria-hidden="true">✓</span></div><div><p>Povinná ľudská kontrola</p><h2>Asistent pripravuje, človek rozhoduje</h2><span>Obchodné kroky zostávajú pod kontrolou človeka. Asistent nikdy sám neodošle cenovú ponuku ani prvú žiadosť o referenciu a nevykoná platbu, reklamu, publikovanie fotografie či vymazanie záznamu. Automaticky môže odoslať najviac jednu pripomienku referencie iba vtedy, keď ju človek výslovne povolil. Transakčné potvrdenia z verejných formulárov majú samostatný bezpečný proces.</span></div></section>
  </main>;
}
