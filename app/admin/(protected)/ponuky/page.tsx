import { getPriceOfferStatusSummary, listPriceOffers } from '@/src/server/db';
import { dateInBratislava } from '@/src/server/analytics-metrics';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import type { PriceOfferStatus } from '@/src/server/types';
import { deletePriceOfferAction } from './actions';
import { euro, priceOfferStatusLabels, priceOfferStatuses } from './constants';

function displayDate(value: string, calendarDate = false) {
  if (!value || (calendarDate && !/^\d{4}-\d{2}-\d{2}$/.test(value))) return value || '—';
  const date = new Date(calendarDate ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('sk-SK', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: calendarDate ? 'UTC' : 'Europe/Bratislava',
  }).format(date);
}

export default async function PriceOffersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const adminUser = await requireAdminUser();
  const status = (params.status || '') as PriceOfferStatus | '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month || '') ? params.month! : '';
  const jobId = params.jobId || '';
  const includeArchived = adminUser.role === 'SUPER_ADMIN' && params.archived === '1';
  const monthKey = month || dateInBratislava(new Date()).slice(0, 7);
  const [offers, summary] = await Promise.all([
    listPriceOffers({ status, month, jobId, includeArchived }),
    getPriceOfferStatusSummary(monthKey),
  ]);
  const csrfToken = csrfTokenForEmail(adminUser.email);
  const conversion = summary.sent ? Math.round((summary.accepted / summary.sent) * 1000) / 10 : 0;

  return (
    <main className="admin-page price-offers-page">
      <div className="admin-heading price-offers-heading">
        <div><p>Obchodný prehľad</p><h1>Cenové ponuky</h1><span>Stav, odpoveď zákazníka a ďalší krok na jednom mieste.</span></div>
        <a className="admin-primary-link" href="/admin/ponuky/nova">Nová cenová ponuka</a>
      </div>
      <section className="admin-stat-grid">
        <article><span>Ponúk v mesiaci</span><strong>{summary.created}</strong></article>
        <article><span>Odoslaných</span><strong>{summary.sent}</strong></article>
        <article><span>Prijatých</span><strong>{summary.accepted}</strong><small>{conversion} %</small></article>
        <article><span>Hodnota prijatých</span><strong>{euro(summary.acceptedValue)}</strong></article>
      </section>
      <p className="admin-muted-note">Súhrn nezahŕňa označené testovacie záznamy ani archivované ponuky. Zoznam nižšie zostáva operatívny.</p>
      <section className="admin-card no-print">
        <form className="admin-filter-bar" action="/admin/ponuky" method="get">
          <label>Stav<select name="status" defaultValue={status}><option value="">Všetky</option>{priceOfferStatuses.map((item) => <option key={item} value={item}>{priceOfferStatusLabels[item]}</option>)}</select></label>
          <label>Obdobie<input name="month" type="month" defaultValue={month} /></label>
          {adminUser.role === 'SUPER_ADMIN' ? <label className="admin-check-label"><input name="archived" type="checkbox" value="1" defaultChecked={includeArchived} /><span>Zobraziť archivované</span></label> : null}
          <button type="submit">Filtrovať</button>
          <a href="/admin/ponuky">Vymazať filter</a>
        </form>
      </section>
      <section className="admin-card">
        <p className="price-offers-scroll-hint">Stav a akcie zobrazíte posunutím tabuľky doprava.</p>
        <div className="admin-table-wrap" role="region" aria-label="Zoznam cenových ponúk, posúvateľný do strán" tabIndex={0}>
          <table className="admin-table price-offers-table">
            <thead><tr><th>Číslo CP</th><th>Dátum</th><th>Zákazník</th><th>Lokalita</th><th>m²</th><th>Celkom €</th><th>Platná do</th><th>Stav</th><th>Akcie</th></tr></thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id} className={`price-offer-row is-${offer.status.toLowerCase()}`}>
                  <td><strong>{offer.number}</strong>{offer.deletedAt ? <small> Archivovaná</small> : null}</td>
                  <td>{displayDate(offer.createdAt)}</td>
                  <td>{offer.contactPerson}</td>
                  <td>{offer.municipality || offer.objectAddress}</td>
                  <td>{offer.areaM2}</td>
                  <td>{euro(offer.totalWithVat)}</td>
                  <td>{displayDate(offer.validUntil, true)}</td>
                  <td className="price-offer-status-cell"><span className={`status-pill status-${offer.status.toLowerCase()}`}>{priceOfferStatusLabels[offer.status]}</span>{offer.outcomeReason ? <small>{offer.outcomeReason}</small> : null}{offer.nextFollowUpAt ? <small>Ozvať sa {displayDate(offer.nextFollowUpAt, true)}</small> : null}</td>
                  <td className="price-offer-action-cell">
                    <div className="price-offer-action-controls">
                      <a className="admin-row-link price-offer-open" href={`/admin/ponuky/${offer.id}`}>Otvoriť</a>
                      <details className="price-offer-more">
                        <summary aria-label={`Ďalšie akcie k ponuke ${offer.number}`}>Ďalšie <span aria-hidden="true">⌄</span></summary>
                        <div className="price-offer-more-content">
                          <a href={`/api/admin/ponuka/${offer.id}/pdf`}>Zobraziť PDF</a>
                          {!offer.deletedAt && offer.status === 'ODOSLANA' ? <a href={`/admin/ponuky/${offer.id}/follow-up`}>Pripomenúť ponuku</a> : null}
                          {!offer.deletedAt && offer.status === 'ODOSLANA' ? <a href={`/admin/ponuky/${offer.id}#vysledok-ponuky`}>Zaevidovať výsledok</a> : null}
                          {adminUser.role === 'SUPER_ADMIN' && !offer.deletedAt ? (
                            <form action={deletePriceOfferAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={offer.id} /><button type="submit">Archivovať</button></form>
                          ) : null}
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
              {!offers.length ? <tr><td colSpan={9}>Zatiaľ nie je vytvorená žiadna cenová ponuka.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
