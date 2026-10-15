import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PrivateActionShell from '../../private-action-shell';
import { slovakCalendarDateAfterDays } from '@/src/lib/date-only';
import { openPublicPriceOfferResponse } from '@/src/server/db';
import PriceOfferResponseForm from './price-offer-response-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Súkromná odpoveď na cenovú ponuku | ASTANA',
  description: 'Súkromné vyjadrenie zákazníka k cenovej ponuke ASTANA.',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};

function euro(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value);
}

function dateSk(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00Z`));
}

export default async function PublicPriceOfferResponsePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await openPublicPriceOfferResponse(token);
  if (!offer) notFound();
  const today = slovakCalendarDateAfterDays(0);
  const maxDate = slovakCalendarDateAfterDays(365);

  return <PrivateActionShell>
    <main className="private-action-main">
      <article className="private-action-card">
        <header className="private-action-card-header">
          <p>Súkromná odpoveď · cenová ponuka {offer.offerNumber}</p>
          <h1>Vyjadrite sa k ponuke</h1>
        </header>
        <div className="private-action-card-body">
          <p className="private-action-note">Tu môžete jedným krokom oznámiť svoje rozhodnutie. Odpoveď ešte overí pracovník ASTANA; sama automaticky nespustí zákazku.</p>
          <dl className="private-action-summary">
            <div><dt>Služba</dt><dd>{offer.objectType || 'Likvidácia azbestu'}</dd></div>
            <div><dt>Lokalita</dt><dd>{offer.municipality || 'podľa cenovej ponuky'}</dd></div>
            <div><dt>Cena s DPH</dt><dd>{euro(offer.totalWithVat)}</dd></div>
            <div><dt>Platnosť ponuky</dt><dd>{dateSk(offer.validUntil)}</dd></div>
          </dl>
          {offer.alreadyResponded ? <div className="private-action-success" role="status">
            <h2>Vyjadrenie sme už prijali</h2>
            <p>Ďakujeme. Odpoveď čaká na internú kontrolu alebo už bola spracovaná. Cez tento odkaz ju nemožno meniť.</p>
          </div> : <PriceOfferResponseForm token={token} today={today} maxDate={maxDate} />}
        </div>
      </article>
    </main>
  </PrivateActionShell>;
}
