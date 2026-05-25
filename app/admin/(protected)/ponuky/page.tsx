import { listPriceOffers } from '@/src/server/db';
import { requireAdminUser } from '@/src/server/auth';
import type { PriceOfferStatus } from '@/src/server/types';
import { deletePriceOfferAction, sendPriceOfferAction, updatePriceOfferStatusAction } from './actions';
import { euro, priceOfferStatusLabels, priceOfferStatuses } from './constants';

export default async function PriceOffersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const adminUser = await requireAdminUser();
  const status = (params.status || '') as PriceOfferStatus | '';
  const month = params.month || '';
  const jobId = params.jobId || '';
  const offers = await listPriceOffers({ status, month, jobId });
  const monthKey = month || new Date().toISOString().slice(0, 7);
  const monthOffers = offers.filter((offer) => offer.createdAt.startsWith(monthKey));
  const sent = monthOffers.filter((offer) => ['ODOSLANA', 'PRIJATA'].includes(offer.status)).length;
  const accepted = monthOffers.filter((offer) => offer.status === 'PRIJATA');
  const conversion = sent ? Math.round((accepted.length / sent) * 1000) / 10 : 0;

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div><p>PDF a email workflow</p><h1>Cenové ponuky</h1></div>
        <a className="admin-primary-link" href="/admin/ponuky/nova">Nová cenová ponuka</a>
      </div>
      <section className="admin-stat-grid">
        <article><span>Ponúk tento mesiac</span><strong>{monthOffers.length}</strong></article>
        <article><span>Odoslaných</span><strong>{sent}</strong></article>
        <article><span>Prijatých</span><strong>{accepted.length}</strong><small>{conversion} %</small></article>
        <article><span>Hodnota prijatých</span><strong>{euro(accepted.reduce((sum, offer) => sum + offer.totalWithVat, 0))}</strong></article>
      </section>
      <section className="admin-card no-print">
        <form className="admin-filter-bar" action="/admin/ponuky" method="get">
          <label>Stav<select name="status" defaultValue={status}><option value="">Všetky</option>{priceOfferStatuses.map((item) => <option key={item} value={item}>{priceOfferStatusLabels[item]}</option>)}</select></label>
          <label>Obdobie<input name="month" type="month" defaultValue={month} /></label>
          <button type="submit">Filtrovať</button>
          <a href="/admin/ponuky">Reset</a>
        </form>
      </section>
      <section className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Číslo CP</th><th>Dátum</th><th>Zákazník</th><th>Lokalita</th><th>m²</th><th>Celkom €</th><th>Platná do</th><th>Stav</th><th>Akcie</th></tr></thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td>{offer.number}</td>
                  <td>{new Intl.DateTimeFormat('sk-SK').format(new Date(offer.createdAt))}</td>
                  <td>{offer.contactPerson}</td>
                  <td>{offer.municipality || offer.objectAddress}</td>
                  <td>{offer.areaM2}</td>
                  <td>{euro(offer.totalWithVat)}</td>
                  <td>{offer.validUntil}</td>
                  <td><span className={`status-pill status-${offer.status.toLowerCase()}`}>{priceOfferStatusLabels[offer.status]}</span></td>
                  <td className="admin-action-row">
                    <a className="admin-row-link" href={`/admin/ponuky/${offer.id}`}>Náhľad</a>
                    <a className="admin-row-link" href={`/api/admin/ponuka/${offer.id}/pdf`}>PDF</a>
                    <form action={sendPriceOfferAction}><input type="hidden" name="id" value={offer.id} /><button type="submit">Odoslať</button></form>
                    <form action={updatePriceOfferStatusAction}><input type="hidden" name="id" value={offer.id} /><input type="hidden" name="status" value="PRIJATA" /><button type="submit">Prijatá</button></form>
                    {adminUser.role === 'SUPER_ADMIN' ? (
                      <form action={deletePriceOfferAction}><input type="hidden" name="id" value={offer.id} /><button type="submit">Zmazať</button></form>
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
