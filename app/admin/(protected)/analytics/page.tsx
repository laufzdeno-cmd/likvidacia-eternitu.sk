import { requireSuperAdmin } from '@/src/server/auth';
import { getAnalyticsPeriod } from '@/src/server/analytics-metrics';
import { getAnalyticsReport, getAnalyticsTrafficSummary, getLeadAttributionReport } from '@/src/server/db';

function formatPercent(value: number) {
  return `${value.toLocaleString('sk-SK', { maximumFractionDigits: 1 })} %`;
}

function formatNumber(value: number) {
  return value.toLocaleString('sk-SK');
}

function deviceLabel(device: string) {
  if (device === 'mobile') return 'Mobil';
  if (device === 'tablet') return 'Tablet';
  if (device === 'desktop') return 'Desktop';
  return 'Neznáme';
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    page_view: 'Zobrazenie stránky',
    quote_section_view: 'Videný dotazník',
    form_start: 'Začaté vypĺňanie',
    form_submit_success: 'Odoslaný dopyt',
    form_submit_error: 'Chyba pri odoslaní',
    cta_click: 'Klik na CTA',
    phone_click: 'Klik na telefón',
    price_calculator_change: 'Zmena kalkulačky',
    gallery_filter: 'Filter galérie',
    reviews_expand: 'Rozbalené recenzie',
    roofer_registration_success: 'Registrácia strechára',
  };
  return labels[eventType] ?? eventType;
}

export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<{ dni?: string }> }) {
  await requireSuperAdmin();
  const params = await searchParams;
  const selectedDays = Number(params?.dni || 30);
  const days = [7, 30, 90, 365].includes(selectedDays) ? selectedDays : 30;
  const period = getAnalyticsPeriod(days);
  const [report, traffic, leadAttribution] = await Promise.all([
    getAnalyticsReport(days, period),
    getAnalyticsTrafficSummary(),
    getLeadAttributionReport(days, period.since),
  ]);
  const maxDaily = Math.max(1, ...report.daily.map((item) => item.sessions));
  const trafficPeriods: Array<[string, typeof traffic.today]> = [
    ['Dnes', traffic.today],
    ['Tento mesiac', traffic.month],
    ['Tento rok', traffic.year],
    ['Posledných 12 mesiacov', traffic.allTime],
  ];

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Analytika návštevnosti a konverzií</p>
          <h1>Reporting</h1>
        </div>
        <form className="admin-inline-filter" action="/admin/analytics">
          <label>
            Obdobie
            <select name="dni" defaultValue={String(report.rangeDays)}>
              <option value="7">7 dní</option>
              <option value="30">30 dní</option>
              <option value="90">90 dní</option>
              <option value="365">365 dní</option>
            </select>
          </label>
          <button type="submit">Zobraziť</button>
          <a href={`/admin/analytics/export?dni=${report.rangeDays}`}>Exportovať</a>
        </form>
      </div>

      <section className="admin-card analytics-traffic-overview">
        <div className="admin-section-heading">
          <div><p>Rýchly prehľad</p><h2>Návštevnosť</h2></div>
          <span className="admin-muted">Merané údaje zo stránok a formulárov pri udelenom analytickom súhlase</span>
        </div>
        <div className="analytics-overview-grid">
          {trafficPeriods.map(([label, slice]) => (
            <article key={String(label)}>
              <h3>{label}</h3>
              <dl>
                <div><dt>Návštevy</dt><dd>{formatNumber(slice.sessions)}</dd></div>
                <div><dt>Zobrazenia</dt><dd>{formatNumber(slice.pageViews)}</dd></div>
                <div><dt>Merané začatia formulára</dt><dd>{formatNumber(slice.formStarts)}</dd></div>
                <div><dt>Merané odoslania</dt><dd>{formatNumber(slice.leads)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-stat-grid analytics-stat-grid">
        <article><span>Návštevy</span><strong>{formatNumber(report.totals.sessions)}</strong></article>
        <article><span>Zobrazenia stránok</span><strong>{formatNumber(report.totals.pageViews)}</strong></article>
        <article><span>Dopyty v CRM</span><strong>{formatNumber(report.totals.leads)}</strong></article>
        <article><span>Konverzia meraných relácií</span><strong>{formatPercent(report.totals.leadConversionRate)}</strong></article>
        <article><span>Vydané dokumenty – starší modul ponúk</span><strong>{formatNumber(report.totals.quotes)}</strong></article>
        <article><span>Prijaté dokumenty – starší modul ponúk</span><strong>{formatNumber(report.totals.acceptedQuotes)}</strong></article>
      </section>

      {report.eventCoverage.truncated ? (
        <section className="admin-card" role="status">
          <h2>Analytické údaje sú skrátené</h2>
          <p>Pre toto obdobie sa načítalo najviac {formatNumber(report.eventCoverage.limit)} udalostí. Návštevy, grafy a percentá odvodené z analytiky preto nie sú úplné. Skráťte obdobie alebo exportujte menší rozsah.</p>
        </section>
      ) : null}

      <section className="admin-card analytics-card">
        <h2>Merané relácie a výsledky v CRM</h2>
        <p className="admin-muted">Prvé kroky sú unikátne relácie so súhlasom na analytiku. CRM časť zahŕňa všetky dopyty vytvorené vo zvolenom období, aj keď návštevník analytiku odmietol; tieto dve skupiny sa preto nespájajú do jedného konverzného percenta.</p>
        <div className="analytics-funnel">
          {report.funnel.map((step, index) => (
            <article key={step.label}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
              <small>{index === 0 ? 'Začiatok meranej návštevnosti' : step.rateFromPrevious === null ? 'Samostatný CRM prehľad' : `${formatPercent(step.rateFromPrevious)} z predchádzajúceho kroku`}</small>
              </div>
              <b>{formatNumber(step.count)}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-card analytics-card">
        <h2>Denný vývoj</h2>
        <div className="analytics-bars" aria-hidden="true">
          {report.daily.map((day) => (
            <div className="analytics-day" key={day.date}>
              <span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit' })}</span>
              <div><i style={{ height: `${Math.max(6, (day.sessions / maxDaily) * 100)}%` }} /></div>
              <small>{day.sessions}</small>
            </div>
          ))}
        </div>
        <details>
          <summary>Otvoriť tabuľku denných údajov</summary>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption>Denné údaje merané pri udelenom analytickom súhlase</caption>
              <thead><tr><th scope="col">Dátum</th><th scope="col">Návštevy</th><th scope="col">Zobrazenia</th><th scope="col">Zobrazený dotazník</th><th scope="col">Začaté formuláre</th><th scope="col">Merané dopyty</th></tr></thead>
              <tbody>{report.daily.map((day) => (
                <tr key={`table-${day.date}`}><th scope="row">{day.date}</th><td>{formatNumber(day.sessions)}</td><td>{formatNumber(day.pageViews)}</td><td>{formatNumber(day.quoteViews)}</td><td>{formatNumber(day.formStarts)}</td><td>{formatNumber(day.leads)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="admin-two-col">
        <section className="admin-card">
          <h2>Najvýkonnejšie stránky</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Stránka</th><th>Návštevy</th><th>Dopyty</th><th>Konverzia</th></tr></thead>
              <tbody>
                {report.topPages.map((page) => (
                  <tr key={page.path}>
                    <td>{page.path}</td>
                    <td>{formatNumber(page.sessions)}</td>
                    <td>{formatNumber(page.leads)}</td>
                    <td>{formatPercent(page.conversionRate)}</td>
                  </tr>
                ))}
                {!report.topPages.length ? <tr><td colSpan={4}>Zatiaľ nie sú uložené návštevy.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <h2>Zdroje návštev</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Zdroj</th><th>Návštevy</th><th>Dopyty</th><th>Konverzia</th></tr></thead>
              <tbody>
                {report.sources.map((source) => (
                  <tr key={source.source}>
                    <td>{source.source}</td>
                    <td>{formatNumber(source.sessions)}</td>
                    <td>{formatNumber(source.leads)}</td>
                    <td>{formatPercent(source.conversionRate)}</td>
                  </tr>
                ))}
                {!report.sources.length ? <tr><td colSpan={4}>Zatiaľ nie sú uložené zdroje návštev.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="admin-card analytics-card">
        <h2>Kampane a zdroje návštev</h2>
        <p className="admin-muted">Odhad z analytických udalostí a iba z návštev, pri ktorých bol udelený analytický súhlas. Nie je to počet všetkých CRM dopytov.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Kampaň</th><th>Zdroj</th><th>Návštevy</th><th>Dopyty</th><th>Konverzia</th></tr></thead>
            <tbody>
              {report.campaigns.map((campaign) => (
                <tr key={`${campaign.source}-${campaign.campaign}`}>
                  <td>{campaign.campaign}</td>
                  <td>{campaign.source}</td>
                  <td>{formatNumber(campaign.sessions)}</td>
                  <td>{formatNumber(campaign.leads)}</td>
                  <td>{formatPercent(campaign.conversionRate)}</td>
                </tr>
              ))}
              {!report.campaigns.length ? <tr><td colSpan={5}>Zatiaľ nie sú uložené údaje o kampaniach.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card analytics-card">
        <h2>Dopyty podľa kampane</h2>
        <p className="admin-muted">Kohorta obsahuje nearchivované CRM dopyty prijaté vo zvolenom období okrem výslovne označených testovacích záznamov. Neoznačené skúšky nemožno spoľahlivo odlíšiť. Každý dopyt sa v každom stĺpci započíta najviac raz, ak má vydanú alebo prijatú ponuku v ktoromkoľvek z dvoch modelov CRM. Archivovaná ponuka či zákazka zostáva historickým výsledkom, ak má zachovanú väzbu na dopyt. Nepriradené ponuky sa neodhadujú. Nezachytený zdroj môže znamenať priamu návštevu, chýbajúce označenie alebo chýbajúci súhlas. Ide o stav ponúk pre kohortu dopytov, nie o počet dokumentov, tržby ani náklady na reklamu.</p>
        <p className="admin-muted">Tabuľka ukazuje najviac 50 kombinácií s najväčším počtom dopytov. CSV export obsahuje všetky kombinácie za zvolené obdobie.</p>
        <p><a href={`/admin/analytics/export?dni=${report.rangeDays}&typ=crm-attribution`}>Exportovať dopyty podľa kampane (CSV)</a></p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Zdroj</th><th>Typ</th><th>Kampaň</th><th>Dopyty</th><th>Dopyty s vydanou ponukou</th><th>Dopyty s prijatou ponukou</th><th>Objednané/realizované/ukončené</th></tr></thead>
            <tbody>
              {leadAttribution.map((row) => (
                <tr key={`${row.source}-${row.medium}-${row.campaign}`}>
                  <td>{row.source}</td>
                  <td>{row.medium}</td>
                  <td>{row.campaign}</td>
                  <td>{formatNumber(row.leads)}</td>
                  <td>{formatNumber(row.leadsWithIssuedOffer)}</td>
                  <td>{formatNumber(row.leadsWithAcceptedOffer)}</td>
                  <td>{formatNumber(row.progressedLeads)}</td>
                </tr>
              ))}
              {!leadAttribution.length ? <tr><td colSpan={7}>V tomto období zatiaľ nie sú uložené dopyty.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="admin-two-col">
        <section className="admin-card">
          <h2>Zariadenia</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Zariadenie</th><th>Návštevy</th><th>Zobrazenia</th><th>Dopyty</th><th>Konverzia</th></tr></thead>
              <tbody>
                {report.devices.map((device) => (
                  <tr key={device.device}>
                    <td>{deviceLabel(device.device)}</td>
                    <td>{formatNumber(device.sessions)}</td>
                    <td>{formatNumber(device.pageViews)}</td>
                    <td>{formatNumber(device.leads)}</td>
                    <td>{formatPercent(device.conversionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <h2>Udalosti</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Udalosť</th><th>Počet</th></tr></thead>
              <tbody>
                {report.events.map((event) => (
                  <tr key={event.eventType}>
                    <td>{eventLabel(event.eventType)}</td>
                    <td>{formatNumber(event.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
