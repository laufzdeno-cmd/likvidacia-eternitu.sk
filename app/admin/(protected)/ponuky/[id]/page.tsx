import { notFound } from 'next/navigation';
import { getPriceOffer, getPriceOfferSettings, listBusinessJobs } from '@/src/server/db';
import { savePriceOfferAction, sendPriceOfferAction } from '../actions';
import PriceOfferForm from '../offer-form';
import PendingOfferButton from '../pending-offer-button';
import { euro, priceOfferStatusLabels } from '../constants';

function dateSk(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(value));
}

function isExpired(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(value) < today;
}

export default async function PriceOfferDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const [offer, jobs, settings] = await Promise.all([getPriceOffer(id), listBusinessJobs(), getPriceOfferSettings()]);
  if (!offer) notFound();

  return (
    <main className="admin-page">
      <div className="admin-heading price-offer-heading">
        <div>
          <p className="admin-status-badge">{priceOfferStatusLabels[offer.status]}</p>
          <h1>Cenová ponuka č. {offer.number}</h1>
        </div>
        <div className="admin-action-row">
          <a className="admin-secondary-link" href={`/api/admin/ponuka/${offer.id}/pdf`} target="_blank">Náhľad PDF</a>
          <a className="admin-primary-link" href={`/admin/ponuky/${offer.id}?send=1`}>Odoslať zákazníkovi</a>
          <a className="admin-text-link" href="/admin/ponuky">Späť na ponuky</a>
        </div>
      </div>

      {query.sent ? (
        <section className="admin-card">
          <div className="admin-alert is-success">Cenová ponuka bola odoslaná zákazníkovi.</div>
        </section>
      ) : null}
      {query.sendError ? (
        <section className="admin-card">
          <div className="admin-alert">Cenovú ponuku sa nepodarilo odoslať. Detail: {query.sendError}</div>
        </section>
      ) : null}
      {query.send ? (
        <section className="admin-card">
          <h2>Odoslanie zákazníkovi</h2>
          <p>Skontrolujte údaje a odošlite zákazníkovi PDF prílohu emailom.</p>
          <form
            action={sendPriceOfferAction}
            className="admin-pending-form admin-send-offer-form"
          >
            <input type="hidden" name="id" value={offer.id} />
            <PendingOfferButton
              idleText="Odoslať zákazníkovi"
              pendingText="Generujem PDF a odosielam cenovú ponuku zákazníkovi. Môže to trvať niekoľko sekúnd..."
            />
          </form>
        </section>
      ) : null}

      <section className="admin-stat-grid">
        <article><span>m2</span><strong>{offer.areaM2}</strong></article>
        <article><span>Bez DPH</span><strong>{euro(offer.totalWithoutVat)}</strong></article>
        <article className="is-highlight"><span>S DPH</span><strong>{euro(offer.totalWithVat)}</strong></article>
        <article className={isExpired(offer.validUntil) ? 'is-expired' : ''}><span>Platná do</span><strong>{dateSk(offer.validUntil)}</strong></article>
      </section>

      <form
        action={savePriceOfferAction}
        className="admin-pending-form"
      >
        <PriceOfferForm jobs={jobs} settings={settings} offer={offer} />
      </form>
    </main>
  );
}
