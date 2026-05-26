import LandingClient from '../landing-client';
import { listApprovedTestimonials } from '@/src/server/db';
import { PublicFooter } from '../public-layout';

export const metadata = {
  title: 'Hodnotenia zákazníkov ASTANA | Recenzie',
  description: 'Skutočné skúsenosti zákazníkov s odbornou likvidáciou azbestu a eternitu po celom Slovensku.',
};

const filters = [
  ['vsetky', 'Všetky'],
  ['Rodinný dom', 'Rodinný dom'],
  ['Hospodárska budova', 'Hospodárska budova'],
  ['Garáž', 'Garáž'],
  ['Priemyselný objekt', 'Priemyselný objekt'],
] as const;

function slug(value?: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat('sk-SK', { month: 'long', year: 'numeric' }).format(new Date(value)) : '';
}

export default async function ReviewsPage() {
  const reviews = await listApprovedTestimonials(200);
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

  return (
    <>
      <main className="public-reviews-page">
        <section className="public-reviews-hero">
          <p className="eyebrow">Recenzie</p>
          <h1>Hodnotenia zákazníkov ASTANA</h1>
          <p>Skutočné skúsenosti zákazníkov z celého Slovenska</p>
          <strong>{reviews.length ? `${average.toLocaleString('sk-SK', { maximumFractionDigits: 1 })} ★ — priemer z ${reviews.length} hodnotení` : 'Hodnotenia pripravujeme'}</strong>
        </section>

        <section className="section reviews-section public-reviews-list">
          <div className="realization-filter-pills" aria-label="Filtrovať recenzie">
            {filters.map(([value, label]) => (
              <button className="gallery-filter-pill" type="button" data-home-gallery-filter={value === 'vsetky' ? 'vsetky' : slug(value)} key={value}>
                {label}
              </button>
            ))}
          </div>
          <div className="reviews-grid home-gallery-grid">
            {reviews.map((review) => (
              <article className="review-card" data-category={slug(review.objectType)} key={review.id}>
                <div className="review-stars" aria-label={`${review.rating} z 5`}>{'★'.repeat(review.rating)}</div>
                <p className="review-text">{review.text}</p>
                <footer className="review-author">
                  <span className="review-avatar" aria-hidden="true">{review.customerName.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{review.customerName}</strong>
                    <span>{[review.location, formatDate(review.realizationDate)].filter(Boolean).join(' · ')}</span>
                  </div>
                </footer>
              </article>
            ))}
            {!reviews.length ? <p>Zatiaľ nie sú zverejnené žiadne schválené recenzie.</p> : null}
          </div>
        </section>
      </main>
      <PublicFooter />
      <LandingClient />
    </>
  );
}
