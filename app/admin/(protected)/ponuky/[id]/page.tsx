import { notFound } from 'next/navigation';
import { getPriceOffer, getPriceOfferSettings, listBusinessJobs } from '@/src/server/db';
import { savePriceOfferAction, sendPriceOfferAction } from '../actions';
import PriceOfferForm from '../offer-form';
import { euro, priceOfferStatusLabels } from '../constants';

export default async function PriceOfferDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const [offer, jobs, settings] = await Promise.all([getPriceOffer(id), listBusinessJobs(), getPriceOfferSettings()]);
  if (!offer) notFound();
  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>{priceOfferStatusLabels[offer.status]}</p>
          <h1>Cenová ponuka č. {offer.number}</h1>
        </div>
        <div className="admin-action-row">
          <a className="admin-primary-link" href={`/api/admin/ponuka/${offer.id}/pdf`} target="_blank">Náhľad PDF</a>
          <a className="admin-secondary-link" href="/admin/ponuky">Späť na ponuky</a>
        </div>
      </div>
      {query.send ? (
        <section className="admin-card">
          <h2>Odoslanie zákazníkovi</h2>
          <p>Skontrolujte údaje a odošlite zákazníkovi PDF prílohu emailom.</p>
          <form action={sendPriceOfferAction}>
            <input type="hidden" name="id" value={offer.id} />
            <button className="admin-primary-button" type="submit">Odoslať zákazníkovi</button>
          </form>
        </section>
      ) : null}
      <section className="admin-stat-grid">
        <article><span>m²</span><strong>{offer.areaM2}</strong></article>
        <article><span>Bez DPH</span><strong>{euro(offer.totalWithoutVat)}</strong></article>
        <article><span>S DPH</span><strong>{euro(offer.totalWithVat)}</strong></article>
        <article><span>Platná do</span><strong>{offer.validUntil}</strong></article>
      </section>
      <form action={savePriceOfferAction}>
        <PriceOfferForm jobs={jobs} settings={settings} offer={offer} />
        <div className="admin-action-row no-print">
          <button className="admin-primary-button" type="submit">Uložiť zmeny</button>
          <button className="admin-secondary-link" type="submit" name="next" value="send">Uložiť a odoslať zákazníkovi</button>
        </div>
      </form>
    </main>
  );
}
