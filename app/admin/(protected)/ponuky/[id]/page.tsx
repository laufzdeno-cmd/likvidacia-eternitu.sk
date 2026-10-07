import { notFound } from 'next/navigation';
import { getPriceOffer, getPriceOfferSettings, listBusinessJobs } from '@/src/server/db';
import { resetUncertainPriceOfferSendAction, savePriceOfferAction, sendPriceOfferAction } from '../actions';
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

function canResetUncertainSend(offer: { status: string; sendStartedAt?: string }) {
  if ((offer.status !== 'NEISTY_STAV' && offer.status !== 'ODOSIELA') || !offer.sendStartedAt) return false;
  return Date.now() - new Date(offer.sendStartedAt).getTime() >= 15 * 60_000;
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
          {offer.status === 'PRIPRAVENA' ? <a className="admin-primary-link" href={`/admin/ponuky/${offer.id}?send=1`}>Odoslať zákazníkovi</a> : null}
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
      {query.sendReset ? <section className="admin-card"><div className="admin-alert is-success">Stav bol po potvrdenej kontrole vrátený na „Pripravená“. E-mail odošlite až po overení, že pôvodný pokus nebol doručený.</div></section> : null}
      {offer.status === 'ODOSIELA' ? <section className="admin-card"><div className="admin-alert">Odoslanie ponuky prebieha alebo sa jeho výsledok ešte spracúva. Zatiaľ ju neupravujte ani neodosielajte znova.</div></section> : null}
      {offer.status === 'NEISTY_STAV' ? <section className="admin-card"><div className="admin-alert">Server nepotvrdil výsledok odoslania. Pred ďalším pokusom skontrolujte schránku ASTANA aj odoslanú poštu.</div></section> : null}
      {canResetUncertainSend(offer) ? (
        <section className="admin-card">
          <h2>Overený opakovaný pokus</h2>
          <p>Možnosť sa zobrazí až 15 minút po pokuse. Stav obnovte iba vtedy, ak ste skontrolovali odoslanú poštu aj schránku ASTANA a pôvodná ponuka neodišla.</p>
          <form action={resetUncertainPriceOfferSendAction} className="admin-pending-form">
            <input type="hidden" name="id" value={offer.id} />
            <label className="admin-check-label"><input type="checkbox" name="confirmedNotSent" value="yes" required /> Potvrdzujem, že som overil schránku a pôvodný e-mail nebol odoslaný.</label>
            <button className="admin-secondary-button" type="submit">Obnoviť na pripravenú</button>
          </form>
        </section>
      ) : null}
      {query.send && offer.status === 'PRIPRAVENA' ? (
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

      {offer.status === 'PRIPRAVENA' ? <form
        action={savePriceOfferAction}
        className="admin-pending-form"
      >
        <PriceOfferForm jobs={jobs} settings={settings} offer={offer} />
      </form> : <section className="admin-card">
        <h2>Odoslaná verzia je uzamknutá</h2>
        <p>Obsah odoslanej alebo prijatej ponuky sa už nemení, aby PDF, email a obchodná história zostali zhodné. Ak treba cenu alebo rozsah upraviť, vytvorte novú cenovú ponuku.</p>
      </section>}
    </main>
  );
}
