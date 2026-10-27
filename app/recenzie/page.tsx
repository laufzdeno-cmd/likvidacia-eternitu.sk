import { buildPageMetadata } from '../seo-components';
import { PublicPageShell } from '../public-layout';
import TestimonialForm from './testimonial-form';
import { listApprovedTestimonials } from '@/src/server/db';
import { randomUUID } from 'node:crypto';
import { testimonialReceiptSecret, verifyTestimonialReceiptToken } from '@/src/server/testimonial-receipt';
import { EditorialPhoto } from '../editorial-components';
import { pagePhotoId } from '@/src/content/public-photo-assignments';

export const metadata = buildPageMetadata({
  title: 'Recenzie zákazníkov | ASTANA',
  description: 'Skúsenosti zákazníkov ASTANA zverejňujeme iba po kontrole a zaznamenanom súhlase. Pošlite nám svoju skúsenosť.',
  path: '/recenzie/',
  image: '/og/recenzie.jpg',
});
export const dynamic = 'force-dynamic';

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const receipt = typeof params.referencia_receipt === 'string'
    ? verifyTestimonialReceiptToken(params.referencia_receipt, testimonialReceiptSecret())
    : false;
  const approved = await listApprovedTestimonials(24).catch(() => []);
  const publicTestimonials = approved.map(({ id, customerName, rating, text, createdAt }) => ({ id, customerName, rating, text, createdAt }));
  return (
    <PublicPageShell breadcrumb={{ name: 'Recenzie', path: '/recenzie/' }} hideWhatsappOnMobile>
      <main className="seo-page reviews-page">
        {receipt ? (
          <p
            id="referencia-potvrdenie"
            className="seo-lead"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            tabIndex={-1}
            autoFocus
          >
            Ďakujeme. Referenciu sme prijali na kontrolu a zobrazí sa až po schválení.
          </p>
        ) : null}
        <header className="reviews-intro">
          <p className="eyebrow">Vaša spätná väzba</p>
          <h1>Recenzie zákazníkov ASTANA</h1>
          <p>Riešili sme spolu odstránenie eternitu alebo inú zákazku? Podeľte sa o svoju skúsenosť.</p>
          <a href="#schvalene-recenzie">Prejsť na skúsenosti zákazníkov <span aria-hidden="true">↓</span></a>
        </header>
        <section id="napisat-recenziu" className="review-form-panel" aria-labelledby="review-form-title">
          <header className="review-form-panel-header">
            <span className="review-form-kicker">Krátky formulár</span>
            <h2 id="review-form-title">Ako sa vám s nami spolupracovalo?</h2>
            <p>Napíšte, čo sa podarilo aj čo môžeme zlepšiť. Vaše hodnotenie najprv skontrolujeme.</p>
          </header>
          <TestimonialForm initialSubmissionId={randomUUID()} />
        </section>
        <section id="schvalene-recenzie" className="seo-section testimonial-public-list" aria-labelledby="published-testimonials-title">
          <h2 id="published-testimonials-title">Skúsenosti zákazníkov</h2>
          {publicTestimonials.length ? <div className="testimonial-public-grid">{publicTestimonials.map((item) => (
            <article className="testimonial-public-card" key={item.id}>
              <p className="testimonial-public-rating" aria-label={`Hodnotenie ${item.rating} z 5`}>{item.rating} / 5</p>
              <blockquote>{item.text}</blockquote>
              <p><strong>{item.customerName}</strong></p>
              <small><time dateTime={item.createdAt}>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(item.createdAt))}</time></small>
            </article>
          ))}</div> : <p className="seo-lead">Tu postupne nájdete schválené skúsenosti našich zákazníkov. Ak sme už u vás pracovali, budeme radi, keď nám napíšete cez formulár vyššie.</p>}
        </section>
        <section className="seo-section editorial-split reviews-context" aria-labelledby="review-process-title">
          <div>
            <h2 id="review-process-title">Čo sa stane po odoslaní?</h2>
            <p>Referenciu uložíme na kontrolu. Na webe sa zobrazí až po schválení a s vaším súhlasom. E-mail ani presnú adresu nezverejňujeme.</p>
            <p>Stačí opísať druh práce, komunikáciu a priebeh spolupráce. Do textu neuvádzajte súkromné údaje.</p>
            <div className="seo-included-list">
              <a href="/realizacie/">Pozrieť fotky prác ASTANA</a>
              <a href="/o-firme/">Overiť firemné údaje</a>
            </div>
          </div>
          <EditorialPhoto id={pagePhotoId('/recenzie/')}
            caption="Demontáž eternitu na rodinnom dome – ASTANA, s.r.o." />
        </section>
      </main>
    </PublicPageShell>
  );
}
