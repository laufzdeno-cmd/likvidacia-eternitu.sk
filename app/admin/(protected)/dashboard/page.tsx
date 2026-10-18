import { getBusinessFinanceSummary, getLeadDashboardMetrics, getLeadEmailOutboxAttention, getLeadQueueCounts, getPriceOfferEventMetrics, getSystemHealth, listBusinessJobDashboardRows, listBusinessJobs, listLeadSummaryPage, listPlannerActions, listWorkers } from '@/src/server/db';
import { requireAdminUser } from '@/src/server/auth';
import { statusLabels } from '@/src/server/lead-insights';
import { businessPeriodBounds, businessTodayKey } from '@/src/lib/business-period';
import { summarizeBusinessJobs } from '@/src/lib/business-dashboard-metrics';
import { euro, jobStatusLabels, landfillLabels, numberSk } from '../zakazky/constants';
import BusinessChart from './business-chart';
import { formatLeadAreaCompact } from '@/src/server/lead-area';

function pct(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 1000) / 10} %` : '—';
}

function WorkQueues({ counts }: { counts: { newLeads: number; unassigned: number; followups: number; waiting: number; quote: number; active: number } }) {
  const items = [
    { href: '/admin/dopyty?queue=new', label: 'Nové dopyty', count: counts.newLeads, note: 'Ešte bez prvého kontaktu', tone: 'sky', icon: '✦', urgency: 'attention' },
    { href: '/admin/dopyty?queue=unassigned', label: 'Bez vlastníka', count: counts.unassigned, note: 'Treba priradiť zodpovednosť', tone: 'amber', icon: '◌', urgency: 'high' },
    { href: '/admin/dopyty?queue=followup', label: 'Follow-up', count: counts.followups, note: 'Dnes alebo po termíne', tone: 'rose', icon: '↻', urgency: 'high' },
    { href: '/admin/dopyty?queue=waiting', label: 'Čaká na doplnenie', count: counts.waiting, note: 'Chýbajúce údaje', tone: 'teal', icon: '◷', urgency: 'attention' },
    { href: '/admin/dopyty?queue=quote', label: 'Na nacenenie', count: counts.quote, note: 'Pripravené na ponuku', tone: 'violet', icon: '€', urgency: 'attention' },
    { href: '/admin/dopyty?queue=active', label: 'V spracovaní', count: counts.active, note: 'Kontaktované a rozpracované', tone: 'indigo', icon: '→', urgency: 'normal' },
  ] as const;
  return (
    <section className="admin-card admin-work-queues">
      <div className="admin-section-heading">
        <div><p>Operatívna práca</p><h2>Pracovné fronty</h2></div>
        <a href="/admin/dopyty">Všetky dopyty</a>
      </div>
      <div className="admin-queue-grid">
        {items.map((item) => {
          const urgency = item.count === 0 ? 'clear' : item.urgency;
          return <a
            aria-label={`${item.label}: ${item.count}. ${item.note}`}
            className={`admin-queue-link tone-${item.tone} ${item.count === 0 ? 'is-empty' : 'has-items'} urgency-${urgency}`}
            href={item.href}
            key={item.href}
          >
            <span className="admin-queue-icon" aria-hidden="true">{item.icon}</span>
            <span className="admin-queue-content">
              <span>{item.label}</span>
              <strong className="admin-queue-count">{item.count}</strong>
              <small>{item.note}</small>
            </span>
            <span className="admin-queue-indicator" aria-hidden="true">{item.count === 0 ? '✓' : urgency === 'high' ? '!' : '→'}</span>
          </a>;
        })}
      </div>
    </section>
  );
}

function MailQueueStatus({ queue }: { queue: Awaited<ReturnType<typeof getLeadEmailOutboxAttention>> }) {
  const attentionCount = queue.overduePending + queue.staleSending + queue.failed + queue.unknown;
  const unresolvedCount = queue.pending + queue.sending + queue.failed + queue.unknown;
  const oldest = queue.oldestUnresolvedAt
    ? new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(queue.oldestUnresolvedAt))
    : null;
  return <section className="admin-card admin-mail-queue" aria-labelledby="mail-queue-title">
    <div className="admin-section-heading">
      <div><p>Doručovanie dopytov</p><h2 id="mail-queue-title">Stav emailov</h2></div>
      <a href={queue.oldestAttentionLeadId ? `/admin/dopyty/${queue.oldestAttentionLeadId}` : '/admin/dopyty'}>
        {queue.oldestAttentionLeadId ? 'Otvoriť najstarší problémový dopyt' : 'Otvoriť dopyty'}
      </a>
    </div>
    {attentionCount > 0
      ? <p><span className="admin-warning-badge">Vyžaduje kontrolu: {attentionCount} emailov</span></p>
      : <p>{unresolvedCount ? 'Zatiaľ bez oneskorenia alebo potvrdenej chyby.' : 'Žiadny email nečaká na odoslanie.'}</p>}
    <p>Čaká: {queue.pending} · Odosiela sa: {queue.sending} · Zlyhalo: {queue.failed} · Výsledok neznámy: {queue.unknown}</p>
    {oldest ? <small>Najstarší nevyriešený záznam: {oldest}. Kontrolu vyžaduje čakanie nad 30 minút alebo odosielanie nad 15 minút.</small> : null}
    {queue.unknown > 0 ? <p><small>Neznámy výsledok neposielajte znova bez overenia schránky a záznamu poskytovateľa.</small></p> : null}
  </section>;
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const adminUser = await requireAdminUser();
  const period = params.period || 'month';
  const bounds = businessPeriodBounds(period, params.from, params.to);
  const today = businessTodayKey();
  const currentMonth = today.slice(0, 7).split('-').map(Number);
  const currentYear = String(currentMonth[0]);
  const trailingStart = new Date(Date.UTC(currentMonth[0], currentMonth[1] - 12, 1)).toISOString().slice(0, 10);
  const allJobsFrom = trailingStart < `${currentYear}-01-01` ? trailingStart : `${currentYear}-01-01`;

  if (adminUser.role === 'OPERATOR') {
    const [leadMetrics, recentLeadPage, lostLeadPage, todayActions, queueCounts, mailQueue] = await Promise.all([
      bounds.valid ? getLeadDashboardMetrics(bounds.from, bounds.to, today) : Promise.resolve({ receivedInPeriod: 0, newToday: 0, waitingForOffer: 0, followupsDue: 0 }),
      listLeadSummaryPage({ page: 1, pageSize: 10, excludeTestData: true }),
      listLeadSummaryPage({ page: 1, pageSize: 10, status: 'nevyslo', excludeTestData: true }),
      listPlannerActions({ from: today, to: today }),
      getLeadQueueCounts(today, true),
      getLeadEmailOutboxAttention(),
    ]);
    return (
      <main className="admin-page">
        <div className="admin-heading">
          <div><p>Operátorský panel</p><h1>Prehľad práce</h1></div>
        </div>
        <section className="admin-stat-grid">
          <article><span>Nové dopyty dnes</span><strong>{leadMetrics.newToday}</strong><a href="/admin/dopyty">Otvoriť dopyty</a></article>
          <article><span>Otvorené dopyty</span><strong>{leadMetrics.waitingForOffer}</strong><a href="/admin/dopyty">Spracovať</a></article>
          <article><span>Follow-up na vybavenie</span><strong>{leadMetrics.followupsDue}</strong><a href="/admin/dopyty?queue=followup">Zavolať</a></article>
          <article><span>Naplánované akcie dnes</span><strong>{todayActions.length}</strong><a href="/admin/planovac">Plánovač</a></article>
        </section>
        <MailQueueStatus queue={mailQueue} />
        <WorkQueues counts={queueCounts} />
        <section className="admin-card">
          <h2>Rýchly prehľad</h2>
          <div className="admin-table-wrap" role="region" aria-label="Rýchly prehľad dopytov" tabIndex={0}><table className="admin-table">
            <thead><tr><th>Meno</th><th>Lokalita</th><th>m2</th><th>Tel.</th><th>Stav</th></tr></thead>
            <tbody>
              {recentLeadPage.items.map((lead) => (
                <tr key={lead.id}>
                  <td><a href={`/admin/dopyty/${lead.id}`}>{lead.fullName}</a></td>
                  <td>{lead.city}</td>
                  <td>{formatLeadAreaCompact(lead)}</td>
                  <td><a href={`tel:${lead.phone}`}>{lead.phone}</a></td>
                  <td>{statusLabels[lead.status] || lead.status}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
        <section className="admin-card">
          <h2>Dopyty ktoré nevyšli</h2>
          <div className="admin-table-wrap" role="region" aria-label="Dopyty ktoré nevyšli" tabIndex={0}><table className="admin-table">
            <thead><tr><th>Meno</th><th>Lokalita</th><th>Dôvod / follow-up</th><th></th></tr></thead>
            <tbody>
              {lostLeadPage.items.map((lead) => (
                <tr key={lead.id}><td>{lead.fullName}</td><td>{lead.city}</td><td>{lead.followupNote || 'Bez poznámky'}</td><td><a className="admin-row-link is-orange" href={`/admin/dopyty/${lead.id}`}>Otvoriť</a></td></tr>
              ))}
            </tbody>
          </table></div>
        </section>
      </main>
    );
  }

  const [jobs, chartJobs, leadMetrics, recentLeadPage, lostLeadPage, workers, offerEvents, health, todayActions, queueCounts, mailQueue, financeSummary] = await Promise.all([
    bounds.valid ? listBusinessJobs({ ...bounds, limit: null, excludeTestData: true }) : Promise.resolve([]),
    listBusinessJobDashboardRows(allJobsFrom, `${currentYear}-12-31`),
    bounds.valid ? getLeadDashboardMetrics(bounds.from, bounds.to, today) : Promise.resolve({ receivedInPeriod: 0, newToday: 0, waitingForOffer: 0, followupsDue: 0 }),
    listLeadSummaryPage({ page: 1, pageSize: 10, excludeTestData: true }),
    listLeadSummaryPage({ page: 1, pageSize: 10, status: 'nevyslo', excludeTestData: true }),
    listWorkers(true),
    bounds.valid ? getPriceOfferEventMetrics(bounds.from, bounds.to) : Promise.resolve({ created: 0, sent: 0, accepted: 0 }),
    getSystemHealth(),
    listPlannerActions({ from: today, to: today }),
    getLeadQueueCounts(today, true),
    getLeadEmailOutboxAttention(),
    bounds.valid ? getBusinessFinanceSummary(bounds.from, bounds.to) : Promise.resolve(null),
  ]);
  const businessMetrics = summarizeBusinessJobs(jobs);
  const { activeJobs, cancelledJobs, recordedOrderValue, cancelledValue, area: m2, wasteKg, rewards, directCosts: costs, preOverheadRemainder, jobsWithoutRecordedDirectCosts, averageRecordedPricePerM2: averageM2 } = businessMetrics;
  const wasteTons = wasteKg / 1000;
  const last12 = Array.from({ length: 12 }, (_, index) => {
    const monthStart = new Date(Date.UTC(currentMonth[0], currentMonth[1] - 1 - (11 - index), 1));
    const key = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthJobs = chartJobs.filter((job) => job.status !== 'ZRUSENA' && job.demolitionDate.startsWith(key));
    return {
      month: monthStart.toLocaleDateString('sk-SK', { month: 'short', year: '2-digit', timeZone: 'Europe/Bratislava' }),
      orderValue: monthJobs.reduce((sum, job) => sum + job.totalPrice, 0),
      costs: monthJobs.reduce((sum, job) => sum + job.costsTotal + job.rewardsTotal, 0),
    };
  });
  const workerRows = workers.map((worker) => {
    const periodJobs = activeJobs.filter((job) => job.workers.some((item) => item.workerId === worker.id));
    const yearJobs = chartJobs.filter((job) => job.status !== 'ZRUSENA' && job.demolitionDate.startsWith(currentYear) && job.workers.some((item) => item.workerId === worker.id));
    const periodReward = periodJobs.reduce((sum, job) => sum + job.workers.filter((item) => item.workerId === worker.id).reduce((a, b) => a + b.reward, 0), 0);
    const yearReward = yearJobs.reduce((sum, job) => sum + job.workers.filter((item) => item.workerId === worker.id).reduce((a, b) => a + b.reward, 0), 0);
    return { worker, periodJobs, yearJobs, periodReward, yearReward };
  });
  const landfillRows = Object.entries(landfillLabels).map(([landfill, label]) => {
    const rows = activeJobs.filter((job) => job.landfill === landfill);
    return { label, count: rows.length, tons: rows.reduce((sum, job) => sum + job.wasteKg, 0) / 1000, cost: rows.reduce((sum, job) => sum + job.costs.landfillCost, 0) };
  });
  const leadsReceivedInPeriod = leadMetrics.receivedInPeriod;
  const offersCreatedInPeriod = offerEvents.created;
  const offersSentInPeriod = offerEvents.sent;
  const offersAcceptedInPeriod = offerEvents.accepted;
  const done = activeJobs.filter((job) => job.status === 'DOKONCENA' || job.status === 'DEMONT_DOKONCENA').length;
  return (
    <main className="admin-page">
      <div className="print-report-heading"><img src="/assets/astana-logo.png" alt="ASTANA" /><p>ASTANA — Mesačný report · {bounds.label}</p></div>
      <div className="admin-heading">
        <div><p>Business dashboard</p><h1>Dashboard</h1></div>
        <button className="admin-primary-link no-print" type="button" data-print>🖨 Tlačiť / PDF</button>
      </div>
      <section className="admin-card no-print">
        <form className="admin-filter-bar dashboard-period-pills" action="/admin/dashboard">
          <button className={period === 'month' ? 'is-active' : ''} name="period" value="month">Tento mesiac</button>
          <button className={period === 'last-month' ? 'is-active' : ''} name="period" value="last-month">Minulý mesiac</button>
          <button className={period === 'year' ? 'is-active' : ''} name="period" value="year">Tento rok</button>
          <label>Od<input type="date" name="from" defaultValue={params.from} /></label>
          <label>Do<input type="date" name="to" defaultValue={params.to} /></label>
          <button className={period === 'custom' ? 'is-active' : ''} name="period" value="custom" type="submit">Vlastné</button>
        </form>
      </section>

      {adminUser.role === 'SUPER_ADMIN' && health ? (
        <section className="admin-card no-print">
          <h2>Stav systému</h2>
          <div className="admin-system-health">
            <article className={`is-${health.leadMail.level}`}><span>{health.leadMail.level === 'ok' ? '✅' : health.leadMail.level === 'warning' ? '⚠️' : '❌'} Dopytové emaily</span><strong>{health.leadMail.label}</strong><small>{health.leadMail.detail}</small></article>
            <article className={health.database.ok ? 'is-ok' : 'is-error'}><span>{health.database.ok ? '✅' : '❌'} Databáza</span><strong>{health.database.ok ? 'Online' : 'Offline'}</strong><small>{health.database.detail}</small></article>
            <article className={health.storage.ok ? 'is-warning' : 'is-error'}><span>{health.storage.ok ? '⚠️' : '❌'} Storage</span><strong>{health.storage.ok ? 'Nastavené' : 'Nenastavené'}</strong><small>{health.storage.detail} Dostupnosť objektov táto kontrola neoveruje.</small></article>
            <article><span>📨 Posledný dopyt</span><strong>{health.lastLead ? new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(health.lastLead.createdAt)) : '—'}</strong><small>{health.lastLead ? `${health.lastLead.fullName} · ${health.lastLead.city}` : 'Zatiaľ bez dopytu'}</small></article>
            <article><span>📧 Posledný úspešne odoslaný email</span><strong>{health.lastEmailSent ? new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(health.lastEmailSent.createdAt)) : '—'}</strong><small>{health.lastEmailError ? `Posledná zaznamenaná chyba: ${new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(health.lastEmailError.createdAt))}` : 'Bez evidovanej chyby'}</small></article>
            <article className={health.pendingLeads > 0 ? 'is-warning' : 'is-ok'}><span>⚠️ Nevybavené dopyty</span><strong>{health.pendingLeads}</strong><small>{health.pendingLeads ? 'Čakajú na spracovanie' : 'Všetko spracované'}</small></article>
          </div>
        </section>
      ) : null}

      <MailQueueStatus queue={mailQueue} />
      <WorkQueues counts={queueCounts} />

      {!bounds.valid ? <p className="admin-warning-badge" role="alert">Vlastné obdobie nie je platné. Zadajte oba dátumy a skontrolujte, že dátum „Od“ nie je po dátume „Do“. Pre toto obdobie sa nezobrazujú súhrnné údaje.</p> : null}
      {bounds.valid ? <>
      <section className="admin-card" aria-labelledby="finance-summary-title">
        <div className="admin-section-heading"><div><p>Podľa skutočne zaevidovaných dokladov</p><h2 id="finance-summary-title">Financie</h2></div><a href="/admin/zakazky">Otvoriť zákazky</a></div>
        <p className="admin-muted-note">Faktúry sa rátajú podľa dátumu vystavenia, úhrady podľa dátumu prijatia. Neuhradené a po splatnosti sú aktuálny stav ku dnešku. Údaje sa nevytvárajú z ceny ani stavu zákazky.</p>
        {financeSummary?.jobsWithEvidence ? <div className="admin-stat-grid admin-finance-stats">
          <article><span>Faktúry vystavené v období</span><strong>{euro(financeSummary.invoicedInPeriodCents / 100)}</strong><small>Storno faktúr v období {euro(financeSummary.cancelledInPeriodCents / 100)}</small></article>
          <article><span>Prijaté úhrady netto v období</span><strong>{euro(financeSummary.netReceivedInPeriodCents / 100)}</strong><small>Prijaté {euro(financeSummary.receivedInPeriodCents / 100)} · storno {euro(financeSummary.reversedInPeriodCents / 100)}</small></article>
          <article><span>Aktuálne neuhradené</span><strong>{euro(financeSummary.currentOutstandingCents / 100)}</strong></article>
          <article><span>Aktuálne po splatnosti</span><strong>{euro(financeSummary.currentOverdueCents / 100)}</strong></article>
          <article><span>Nepriradené úhrady</span><strong>{euro(financeSummary.currentUnallocatedCents / 100)}</strong></article>
          <article><span>Preplatky na faktúrach</span><strong>{euro(financeSummary.currentOverpaidCents / 100)}</strong></article>
        </div> : <div className="admin-empty-state"><strong>Finančné údaje: neevidované</strong><p>Zatiaľ nie je uložená žiadna skutočne vystavená faktúra ani prijatá úhrada.</p></div>}
      </section>

      <h2>Operatívne odhady podľa dátumu demontáže</h2>
      <p className="admin-muted-note">Súhrn sa riadi evidovaným dátumom demontáže. Zahrnuté sú aj nezáväzné dopyty a rozpracované práce; zrušené zákazky sú oddelené. Evidovaná cena nie je doklad o fakturácii ani prijatej platbe.</p>
      <section className="admin-stat-grid">
        <article><span>Evidované ceny (vrátane dopytov a odhadov)</span><strong>{euro(recordedOrderValue)}</strong></article>
        <article><span>Priemerná evidovaná suma / m²</span><strong>{averageM2 === null ? '—' : euro(averageM2)}</strong></article>
        <article><span>Aktívne a rozpracované záznamy</span><strong>{activeJobs.length}</strong></article>
        <article><span>Zrušené záznamy, oddelene</span><strong>{cancelledJobs.length}</strong><small>{euro(cancelledValue)}</small></article>
        <article><span>m2 spolu</span><strong>{numberSk(m2, ' m2')}</strong></article>
        <article><span>Váha odpadu</span><strong>{numberSk(wasteTons, ' t')}</strong></article>
      </section>

      <section className="admin-card"><h2>Posledných 12 mesiacov: evidované sumy a zadané náklady podľa mesiaca demontáže</h2><p className="admin-muted-note">Tento graf zobrazuje samostatne posledných 12 mesiacov bez ohľadu na zvolené obdobie vyššie. Sumy zahŕňajú aj dopyty a odhady.</p><BusinessChart data={last12} /></section>

      <section className="admin-card">
        <h2>Zadané priame náklady a odmeny</h2>
        <p className="admin-muted-note">Rozdiel oproti evidovaným sumám je len orientačný: sumy môžu byť odhadmi alebo dopytmi a zadané náklady nemusia byť úplné. Prijaté úhrady evidujeme osobitne v sekcii Financie, nie v tomto odhade. Nejde o zisk ani účtovný údaj. Záznamy s nulovými evidovanými priamymi nákladmi aj odmenami: {jobsWithoutRecordedDirectCosts}.</p>
        <div className="admin-table-wrap" role="region" aria-label="Zadané priame náklady a odmeny" tabIndex={0}><table className="admin-table"><tbody>
          {[
            ['Odmeny spolu', rewards],
            ['Nafta', activeJobs.reduce((s, j) => s + j.costs.fuel, 0)],
            ['Obleky', activeJobs.reduce((s, j) => s + j.costs.suits, 0)],
            ['Rukavice', activeJobs.reduce((s, j) => s + j.costs.gloves, 0)],
            ['Penetrák', activeJobs.reduce((s, j) => s + j.costs.penetrant, 0)],
            ['Skládky', activeJobs.reduce((s, j) => s + j.costs.landfillCost, 0)],
            ['Ostatné', activeJobs.reduce((s, j) => s + j.costs.otherAmount, 0)],
            ['NÁKLADY SPOLU', costs + rewards],
            ['ROZDIEL PO ZADANÝCH NÁKLADOCH A ODMENÁCH (ORIENTAČNE)', preOverheadRemainder],
          ].map(([label, value]) => <tr key={label}><td>{label}</td><td>{euro(Number(value))}</td><td>{pct(Number(value), recordedOrderValue)}</td></tr>)}
          <tr><th>POMER ROZDIELU K EVIDOVANEJ SUME (ORIENTAČNE)</th><th colSpan={2}>{pct(preOverheadRemainder, recordedOrderValue)}</th></tr>
        </tbody></table></div>
      </section>

      <section className="admin-stat-grid">
        {workerRows.map(({ worker, periodJobs, periodReward, yearReward }) => (
          <article key={worker.id}><span>{worker.name.toUpperCase()}</span><strong>{euro(periodReward)}</strong><small>Zákaziek: {periodJobs.length} · Tento rok: {euro(yearReward)}</small></article>
        ))}
      </section>

      <section className="admin-card">
        <h2>Obchodné počty v období</h2>
        <p className="admin-muted-note">Tieto počty majú samostatné dátumové základy; nejde o kohortný konverzný lievik. Dopyty sa rátajú podľa prijatia, zákazky podľa dátumu demontáže a ponuky podľa vytvorenia, odoslania alebo prijatia.</p>
        <div className="analytics-funnel">
          {[
            ['Dopyty prijaté', leadsReceivedInPeriod],
            ['Aktívne a rozpracované záznamy', activeJobs.length],
            ['Zrušené záznamy', cancelledJobs.length],
            ['Dokončené zákazky', done],
            ['Cenové ponuky vytvorené', offersCreatedInPeriod],
          ['Cenové ponuky odoslané v období', offersSentInPeriod],
            ['Cenové ponuky prijaté', offersAcceptedInPeriod],
          ].map(([label, count], index) => <article key={String(label)}><span>{index + 1}</span><strong>{label}</strong><b>{Number(count)}</b></article>)}
        </div>
      </section>

      <section className="admin-card">
        <h2>Skládky</h2>
        <div className="admin-table-wrap" role="region" aria-label="Prehľad skládok" tabIndex={0}><table className="admin-table"><thead><tr><th>Skládka</th><th>Zákaziek</th><th>Ton</th><th>Náklad €</th></tr></thead><tbody>{landfillRows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td>{numberSk(row.tons)}</td><td>{euro(row.cost)}</td></tr>)}</tbody></table></div>
      </section>

      <section className="admin-card">
        <h2>Najvyššie evidované zákazky</h2>
        <div className="admin-table-wrap" role="region" aria-label="Najvyššie evidované zákazky" tabIndex={0}><table className="admin-table"><thead><tr><th>Dátum demontáže</th><th>Zákazník</th><th>Lokalita</th><th>Stav</th><th>m2</th><th>Evidovaná suma €</th></tr></thead><tbody>{activeJobs.sort((a, b) => b.totalPrice - a.totalPrice).slice(0, 5).map((job) => <tr key={job.id}><td>{job.demolitionDate}</td><td>{job.customerName}</td><td>{job.location}</td><td>{jobStatusLabels[job.status] || job.status}</td><td>{numberSk(job.m2)}</td><td>{euro(job.totalPrice)}</td></tr>)}</tbody></table></div>
      </section>
      </> : null}
    </main>
  );
}
