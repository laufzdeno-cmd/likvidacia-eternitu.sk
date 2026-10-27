import { buildPageMetadata, QuickAnswer } from '../seo-components';
import { PublicPageShell } from '../public-layout';
import TestimonialForm from './testimonial-form';
import { listApprovedTestimonials } from '@/src/server/db';
import { randomUUID } from 'node:crypto';
import { testimonialReceiptSecret, verifyTestimonialReceiptToken } from '@/src/server/testimonial-receipt';
import { EditorialHero, UsefulChecklist } from '../editorial-components';

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
      <main className="seo-page">
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
        <EditorialHero eyebrow="Skúsenosti z konkrétnej spolupráce" title="Recenzie zákazníkov ASTANA"
          lead="Riešili sme spolu odstránenie eternitu alebo inú zákazku? Napíšte, ako prebehla komunikácia, dohoda a práca na mieste. Zverejňujeme skúsenosti po kontrole a so zaznamenaným súhlasom."
          photoId="azbest-068" photoAlt="Rodinný dom a pracovisko ASTANA pri prácach na streche"
          photoCaption="Vlastná fotodokumentácia ASTANA. Fotografia nepredstavuje autora konkrétnej recenzie." />
        <QuickAnswer>
          Referenciu môže poslať každý zákazník. Pred zverejnením ju skontrolujeme a uverejníme iba po zaznamenanom súhlase; e-mail ani presnú lokalitu na stránke nezobrazujeme.
        </QuickAnswer>
        <section className="seo-section testimonial-public-list" aria-labelledby="published-testimonials-title">
          <h2 id="published-testimonials-title">Skúsenosti zákazníkov</h2>
          {publicTestimonials.length ? <div className="testimonial-public-grid">{publicTestimonials.map((item) => (
            <article className="testimonial-public-card" key={item.id}>
              <p className="testimonial-public-rating" aria-label={`Hodnotenie ${item.rating} z 5`}>{item.rating} / 5</p>
              <blockquote>{item.text}</blockquote>
              <p><strong>{item.customerName}</strong></p>
              <small><time dateTime={item.createdAt}>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(item.createdAt))}</time></small>
            </article>
          ))}</div> : <p className="seo-lead">Zatiaľ tu nie sú zverejnené referencie. Nechceme uvádzať neoverené alebo vymyslené hodnotenia.</p>}
        </section>
        <section className="seo-section">
          <h2>Pošlite nám svoju skúsenosť</h2>
          <p className="seo-lead">
            Referenciu najprv skontrolujeme. Samotné odoslanie neznamená automatické zverejnenie.
          </p>
          <UsefulChecklist title="Čo pomôže ďalšiemu zákazníkovi" items={['Aký druh práce ste riešili, bez presnej adresy a osobných údajov.', 'Ako prebehla dohoda o rozsahu a komunikácia pred prácou.', 'Čo fungovalo dobre a čo by sme mohli zlepšiť.']} />
          <TestimonialForm initialSubmissionId={randomUUID()} />
          <div className="seo-included-list">
            <a href="/realizacie/">Pozrieť reálne fotky prác ASTANA</a>
            <a href="/postup/">Pozrieť úradný postup likvidácie</a>
            <a href="/o-firme/">Overiť firemné údaje</a>
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}
