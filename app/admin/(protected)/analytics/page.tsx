import { getAnalyticsReport } from '@/src/server/db';

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
  const params = await searchParams;
  const days = Math.min(365, Math.max(7, Number(params?.dni || 30)));
  const report = await getAnalyticsReport(days);
  const maxDaily = Math.max(1, ...report.daily.map((item) => item.sessions));

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

      <section className="admin-stat-grid analytics-stat-grid">
        <article><span>Návštevy</span><strong>{formatNumber(report.totals.sessions)}</strong></article>
        <article><span>Zobrazenia stránok</span><strong>{formatNumber(report.totals.pageViews)}</strong></article>
        <article><span>Odoslané dopyty</span><strong>{formatNumber(report.totals.leads)}</strong></article>
        <article><span>Konverzia na dopyt</span><strong>{formatPercent(report.totals.leadConversionRate)}</strong></article>
        <article><span>Cenové ponuky</span><strong>{formatNumber(report.totals.quotes)}</strong></article>
        <article><span>Prijaté ponuky</span><strong>{formatNumber(report.totals.acceptedQuotes)}</strong></article>
      </section>

      <section className="admin-card analytics-card">
        <h2>Konverzný lievik</h2>
        <div className="analytics-funnel">
          {report.funnel.map((step, index) => (
            <article key={step.label}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{index === 0 ? 'Začiatok lievika' : `${formatPercent(step.rateFromPrevious)} z predchádzajúceho kroku`}</small>
              </div>
              <b>{formatNumber(step.count)}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-card analytics-card">
        <h2>Denný vývoj</h2>
        <div className="analytics-bars" aria-label="Denný vývoj návštev">
          {report.daily.map((day) => (
            <div className="analytics-day" key={day.date}>
              <span>{new Date(day.date).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit' })}</span>
              <div><i style={{ height: `${Math.max(6, (day.sessions / maxDaily) * 100)}%` }} /></div>
              <small>{day.sessions}</small>
            </div>
          ))}
        </div>
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
