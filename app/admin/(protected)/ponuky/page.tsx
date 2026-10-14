import { getPriceOfferStatusSummary, listPriceOffers } from '@/src/server/db';
import { dateInBratislava } from '@/src/server/analytics-metrics';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import type { PriceOfferStatus } from '@/src/server/types';
import { deletePriceOfferAction, updatePriceOfferStatusAction } from './actions';
import { euro, priceOfferStatusLabels, priceOfferStatuses } from './constants';

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
    <main className="admin-page">
      <div className="admin-heading">
        <div><p>PDF a email workflow</p><h1>Cenové ponuky</h1></div>
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
          {adminUser.role === 'SUPER_ADMIN' ? <label className="admin-check-label"><input name="archived" type="checkbox" value="1" defaultChecked={includeArchived} /> Zobraziť archivované</label> : null}
          <button type="submit">Filtrovať</button>
          <a href="/admin/ponuky">Reset</a>
        </form>
      </section>
      <section className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Číslo CP</th><th>Dátum</th><th>Zákazník</th><th>Lokalita</th><th>m2</th><th>Celkom €</th><th>Platná do</th><th>Stav</th><th>Akcie</th></tr></thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td>{offer.number}{offer.deletedAt ? <small> Archivovaná</small> : null}</td>
                  <td>{new Intl.DateTimeFormat('sk-SK').format(new Date(offer.createdAt))}</td>
                  <td>{offer.contactPerson}</td>
                  <td>{offer.municipality || offer.objectAddress}</td>
                  <td>{offer.areaM2}</td>
                  <td>{euro(offer.totalWithVat)}</td>
                  <td>{offer.validUntil}</td>
                  <td><span className={`status-pill status-${offer.status.toLowerCase()}`}>{priceOfferStatusLabels[offer.status]}</span></td>
                  <td className="admin-action-row">
                    <a className="admin-row-link" href={`/admin/ponuky/${offer.id}`}>Otvoriť CP</a>
                    <a className="admin-row-link" href={`/api/admin/ponuka/${offer.id}/pdf`}>PDF</a>
                    {!offer.deletedAt && offer.status === 'ODOSLANA' ? <a className="admin-row-link" href={`/admin/ponuky/${offer.id}/follow-up`}>Follow-up</a> : null}
                    {!offer.deletedAt && offer.status === 'ODOSLANA' ? <form action={updatePriceOfferStatusAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={offer.id} /><input type="hidden" name="status" value="PRIJATA" /><button type="submit">Označiť ako prijatú</button></form> : null}
                    {adminUser.role === 'SUPER_ADMIN' && !offer.deletedAt ? (
                      <form action={deletePriceOfferAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={offer.id} /><button type="submit">Archivovať</button></form>
                    ) : null}
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
