import { requireSuperAdmin } from '@/src/server/auth';
import { getAnalyticsReport, getAnalyticsTrafficSummary } from '@/src/server/db';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

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

function optionValues(values: string[], selected: string) {
  return [...new Set([...(selected ? [selected] : []), ...values])];
}

function formatChange(current: number, previous: number, isRate = false) {
  const delta = current - previous;
  if (isRate) {
    return `${delta > 0 ? '+' : ''}${delta.toLocaleString('sk-SK', { maximumFractionDigits: 1 })} p. b.`;
  }
  if (!previous) return current ? 'Nové' : '0 %';
  const relative = (delta / previous) * 100;
  return `${relative > 0 ? '+' : ''}${relative.toLocaleString('sk-SK', { maximumFractionDigits: 1 })} %`;
}

function changeClass(current: number, previous: number) {
  if (current === previous) return 'is-neutral';
  return current > previous ? 'is-positive' : 'is-negative';
}

export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  await requireSuperAdmin();
  const params = await searchParams;
  const requestedDays = Number(readParam(params?.dni));
  const days = [7, 30, 90, 365].includes(requestedDays) ? requestedDays : 30;
  const attributionMode = readParam(params?.atribucia) === 'first' ? 'first' : 'last';
  const device = ['desktop', 'tablet', 'mobile'].includes(readParam(params?.zariadenie))
    ? (readParam(params?.zariadenie) as 'desktop' | 'tablet' | 'mobile')
    : undefined;
  const filters = {
    source: readParam(params?.zdroj) || undefined,
    campaign: readParam(params?.kampan) || undefined,
    device,
    attribution: attributionMode,
  } as const;
  const nowMs = Date.now();
  const [report, previousReport, traffic] = await Promise.all([
    getAnalyticsReport(days, { filters, endMs: nowMs }),
    getAnalyticsReport(days, { filters, endMs: nowMs - days * 24 * 60 * 60 * 1000 }),
    getAnalyticsTrafficSummary(),
  ]);
  const maxDaily = Math.max(1, ...report.daily.map((item) => item.sessions));
  const trafficPeriods: Array<[string, typeof traffic.today]> = [
    ['Dnes', traffic.today],
    ['Tento mesiac', traffic.month],
    ['Tento rok', traffic.year],
    ['Celkom', traffic.allTime],
  ];
  const query = new URLSearchParams({ dni: String(days), atribucia: attributionMode });
  if (filters.source) query.set('zdroj', filters.source);
  if (filters.campaign) query.set('kampan', filters.campaign);
  if (filters.device) query.set('zariadenie', filters.device);
  const exportHref = `/admin/analytics/export?${query.toString()}`;
  const comparison = [
    { label: 'Relácie', current: report.totals.sessions, previous: previousReport.totals.sessions, rate: false },
    { label: 'Zobrazenia stránok', current: report.totals.pageViews, previous: previousReport.totals.pageViews, rate: false },
    { label: 'Začaté formuláre', current: report.funnel[2]?.eventCount ?? 0, previous: previousReport.funnel[2]?.eventCount ?? 0, rate: false },
    { label: 'Odoslané dopyty', current: report.totals.leads, previous: previousReport.totals.leads, rate: false },
    { label: 'Konverzia na dopyt', current: report.totals.leadConversionRate, previous: previousReport.totals.leadConversionRate, rate: true },
  ];

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Analytika návštevnosti a konverzií</p>
          <h1>Reporting</h1>
        </div>
        <form className="admin-inline-filter analytics-filter-form" action="/admin/analytics">
          <label>
            Obdobie
            <select name="dni" defaultValue={String(days)}>
              <option value="7">7 dní</option><option value="30">30 dní</option><option value="90">90 dní</option><option value="365">365 dní</option>
            </select>
          </label>
          <label>
            Zdroj
            <select name="zdroj" defaultValue={filters.source || ''}>
              <option value="">Všetky zdroje</option>
              {optionValues(report.availableFilters.sources, filters.source || '').map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Kampaň
            <select name="kampan" defaultValue={filters.campaign || ''}>
              <option value="">Všetky kampane</option>
              {optionValues(report.availableFilters.campaigns, filters.campaign || '').map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Zariadenie
            <select name="zariadenie" defaultValue={filters.device || ''}>
              <option value="">Všetky zariadenia</option>
              {optionValues(report.availableFilters.devices, filters.device || '').map((value) => <option key={value} value={value}>{deviceLabel(value)}</option>)}
            </select>
          </label>
          <label>
            Atribúcia
            <select name="atribucia" defaultValue={attributionMode}>
              <option value="last">Posledný kontakt</option><option value="first">Prvý kontakt</option>
            </select>
          </label>
          <div className="analytics-filter-actions"><button type="submit">Použiť filter</button><a href={exportHref}>Exportovať</a><a className="admin-secondary-link" href="/admin/analytics">Zrušiť filtre</a></div>
        </form>
      </div>

      <section className="admin-card analytics-traffic-overview">
        <div className="admin-section-heading"><div><p>Rýchly prehľad</p><h2>Návštevnosť celkovo</h2></div><span className="admin-muted">Dnes, mesiac, rok a celá história. Filtre nižšie sa týkajú reportu.</span></div>
        <div className="analytics-overview-grid">
          {trafficPeriods.map(([label, slice]) => <article key={label}><h3>{label}</h3><dl><div><dt>Relácie</dt><dd>{formatNumber(slice.sessions)}</dd></div><div><dt>Zobrazenia</dt><dd>{formatNumber(slice.pageViews)}</dd></div><div><dt>Začaté formuláre</dt><dd>{formatNumber(slice.formStarts)}</dd></div><div><dt>Odoslané dopyty</dt><dd>{formatNumber(slice.leads)}</dd></div></dl></article>)}
        </div>
      </section>

      <section className="admin-stat-grid analytics-stat-grid">
        <article><span>Relácie</span><strong>{formatNumber(report.totals.sessions)}</strong></article><article><span>Zobrazenia stránok</span><strong>{formatNumber(report.totals.pageViews)}</strong></article><article><span>Odoslané dopyty</span><strong>{formatNumber(report.totals.leads)}</strong></article><article><span>Konverzia na dopyt</span><strong>{formatPercent(report.totals.leadConversionRate)}</strong></article><article><span>Cenové ponuky (CRM celkom)</span><strong>{formatNumber(report.totals.quotes)}</strong></article><article><span>Prijaté ponuky (CRM celkom)</span><strong>{formatNumber(report.totals.acceptedQuotes)}</strong></article>
      </section>

      <section className="admin-card analytics-card analytics-comparison">
        <div className="admin-section-heading"><div><p>Trend</p><h2>Porovnanie s predchádzajúcim obdobím</h2></div><span className="admin-muted">Aktuálnych {days} dní oproti predchádzajúcim {days} dňom</span></div>
        <div className="analytics-comparison-grid">{comparison.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.rate ? formatPercent(item.current) : formatNumber(item.current)}</strong><small>Predtým: {item.rate ? formatPercent(item.previous) : formatNumber(item.previous)}</small><b className={changeClass(item.current, item.previous)}>{formatChange(item.current, item.previous, item.rate)}</b></article>)}</div>
      </section>

      <section className="admin-card analytics-card">
        <div className="admin-section-heading"><div><p>Relácie verzus udalosti</p><h2>Konverzný lievik</h2></div><div className="analytics-legend" aria-label="Legenda analytiky"><span><i className="analytics-swatch analytics-swatch-blue" /> Relácie = unikátne návštevy</span><span><i className="analytics-swatch analytics-swatch-orange" /> Udalosti = všetky zaznamenané akcie</span><span><i className="analytics-swatch analytics-swatch-green" /> CRM = ponuky z administrácie</span></div></div>
        <div className="analytics-funnel">{report.funnel.map((step, index) => <article key={step.label}><span>{index + 1}</span><div><strong>{step.label}</strong><small>{index === 0 ? 'Začiatok lievika' : `${formatPercent(step.rateFromPrevious)} z predchádzajúceho kroku`}</small></div><div className="analytics-funnel-metrics"><div><b>{formatNumber(step.count)}</b><small>{step.countLabel}</small></div><div><b>{formatNumber(step.eventCount)}</b><small>Udalosti</small></div></div></article>)}</div>
      </section>

      <section className="admin-card analytics-card"><h2>Denný vývoj</h2><div className="analytics-bars" aria-label="Denný vývoj relácií">{report.daily.map((day) => <div className="analytics-day" key={day.date}><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit' })}</span><div><i style={{ height: `${Math.max(6, (day.sessions / maxDaily) * 100)}%` }} /></div><small>{day.sessions}</small></div>)}</div></section>

      <div className="admin-two-col">
        <section className="admin-card"><h2>Najvýkonnejšie stránky</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Stránka</th><th>Relácie</th><th>Dopyty</th><th>Konverzia</th></tr></thead><tbody>{report.topPages.map((page) => <tr key={page.path}><td>{page.path}</td><td>{formatNumber(page.sessions)}</td><td>{formatNumber(page.leads)}</td><td>{formatPercent(page.conversionRate)}</td></tr>)}{!report.topPages.length ? <tr><td colSpan={4}>Zatiaľ nie sú uložené návštevy.</td></tr> : null}</tbody></table></div></section>
        <section className="admin-card"><h2>Zdroje návštev <small className="analytics-attribution-label">{attributionMode === 'first' ? 'prvý kontakt' : 'posledný kontakt'}</small></h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Zdroj</th><th>Relácie</th><th>Dopyty</th><th>Konverzia</th></tr></thead><tbody>{report.sources.map((source) => <tr key={source.source}><td>{source.source}</td><td>{formatNumber(source.sessions)}</td><td>{formatNumber(source.leads)}</td><td>{formatPercent(source.conversionRate)}</td></tr>)}{!report.sources.length ? <tr><td colSpan={4}>Zatiaľ nie sú uložené zdroje návštev.</td></tr> : null}</tbody></table></div></section>
      </div>

      <section className="admin-card analytics-card"><h2>Kampane a zdroje <small className="analytics-attribution-label">{attributionMode === 'first' ? 'prvý kontakt' : 'posledný kontakt'}</small></h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Kampaň</th><th>Zdroj</th><th>Relácie</th><th>Dopyty</th><th>Konverzia</th></tr></thead><tbody>{report.campaigns.map((campaign) => <tr key={`${campaign.source}-${campaign.campaign}`}><td>{campaign.campaign}</td><td>{campaign.source}</td><td>{formatNumber(campaign.sessions)}</td><td>{formatNumber(campaign.leads)}</td><td>{formatPercent(campaign.conversionRate)}</td></tr>)}{!report.campaigns.length ? <tr><td colSpan={5}>Zatiaľ nie sú uložené údaje o kampaniach.</td></tr> : null}</tbody></table></div></section>

      <div className="admin-two-col">
        <section className="admin-card"><h2>Zariadenia</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Zariadenie</th><th>Relácie</th><th>Zobrazenia</th><th>Dopyty</th><th>Konverzia</th></tr></thead><tbody>{report.devices.map((item) => <tr key={item.device}><td>{deviceLabel(item.device)}</td><td>{formatNumber(item.sessions)}</td><td>{formatNumber(item.pageViews)}</td><td>{formatNumber(item.leads)}</td><td>{formatPercent(item.conversionRate)}</td></tr>)}{!report.devices.length ? <tr><td colSpan={5}>Zatiaľ nie sú uložené údaje o zariadeniach.</td></tr> : null}</tbody></table></div></section>
        <section className="admin-card"><h2>Udalosti</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Udalosť</th><th>Počet udalostí</th></tr></thead><tbody>{report.events.map((event) => <tr key={event.eventType}><td>{eventLabel(event.eventType)}</td><td>{formatNumber(event.count)}</td></tr>)}{!report.events.length ? <tr><td colSpan={2}>Zatiaľ nie sú uložené udalosti.</td></tr> : null}</tbody></table></div></section>
      </div>
    </main>
  );
}
