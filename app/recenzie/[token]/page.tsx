import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { PublicPageShell } from '../../public-layout';
import TestimonialForm from '../testimonial-form';
import { openPublicReviewRequest } from '@/src/server/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Súkromná žiadosť o referenciu | ASTANA',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};

export default async function RequestedReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await openPublicReviewRequest(token);
  if (!request) notFound();

  return (
    <PublicPageShell breadcrumb={{ name: 'Referencia', path: '/recenzie/' }}>
      <main className="seo-page">
        <section className="seo-hero">
          <p className="eyebrow">Vaša skúsenosť</p>
          <h1>Ďakujeme za dôveru</h1>
          <p>Krátka spätná väzba nám pomôže zlepšovať služby. Na web ju zverejníme až po samostatnej kontrole.</p>
        </section>
        <section className="seo-section" aria-labelledby="requested-review-title">
          <h2 id="requested-review-title">Referencia k vašej realizácii</h2>
          <p className="seo-lead">
            {request.location ? `${request.location} · ` : ''}{request.objectType || 'Likvidácia azbestu'}
            {request.realizationDate ? ` · ${new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(`${request.realizationDate}T12:00:00Z`))}` : ''}
          </p>
          {request.alreadySubmitted ? (
            <div role="status" className="testimonial-public-success">
              <h3>Referenciu sme už prijali</h3>
              <p>Ďakujeme. Je uložená ako koncept a čaká na internú kontrolu.</p>
              {request.googleReviewLink ? <p><a className="button button-primary" href={request.googleReviewLink} target="_blank" rel="noopener noreferrer">Pridať aj Google hodnotenie</a></p> : null}
            </div>
          ) : (
            <TestimonialForm
              initialSubmissionId={randomUUID()}
              requestToken={token}
              initialCustomerName={request.customerName}
              googleReviewLink={request.googleReviewLink}
            />
          )}
        </section>
      </main>
    </PublicPageShell>
  );
}
