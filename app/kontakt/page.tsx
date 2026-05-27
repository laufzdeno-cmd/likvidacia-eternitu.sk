import { buildPageMetadata, ContactStrip, QuoteCTA, QuickAnswer, TrustBox } from '../seo-components';
import { PublicPageShell } from '../public-layout';
import { companyAddressLine, emailLink, phoneLink, site } from '@/src/content/site';

export const metadata = buildPageMetadata({
  title: 'Kontakt | ASTANA likvidácia azbestu a eternitu',
  description:
    'Kontakt na ASTANA, s.r.o. Telefón, email, adresa, prevádzkové hodiny a čo poslať pre rýchlu cenovú ponuku na likvidáciu azbestu.',
  path: '/kontakt/',
});

export default function ContactPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Kontakt', path: '/kontakt/' }}>
      <main className="seo-page">
        <section className="seo-hero">
          <p className="eyebrow">Kontakt</p>
          <h1>Kontaktujte ASTANA</h1>
          <p>Pošlite približnú výmeru, lokalitu a fotky. Ozveme sa s cenovou ponukou a ďalším postupom.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/#dopyt">Odoslať dopyt</a>
            <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
          </div>
        </section>
        <QuickAnswer>
          Pre rýchlu cenovú ponuku pošlite lokalitu, približnú výmeru v m2, fotky strechy alebo materiálu, typ objektu
          a kontakt. ASTANA pôsobí po celom Slovensku.
        </QuickAnswer>
        <section className="seo-section seo-grid-2">
          <article>
            <h2>Kontaktné údaje</h2>
            <p>{site.legalName}</p>
            <p>{companyAddressLine}</p>
            <p>IČO: {site.ico}</p>
            <p>DIČ: {site.dic}</p>
            <p>IČ DPH: {site.icDph}</p>
          </article>
          <article>
            <h2>Telefón a email</h2>
            <p><a href={phoneLink}>{site.phone}</a></p>
            <p><a href={emailLink}>{site.email}</a></p>
            <p>{site.openingHours}</p>
          </article>
        </section>
        <ContactStrip />
        <TrustBox />
        <QuoteCTA title="Chcem cenovú ponuku" />
      </main>
    </PublicPageShell>
  );
}
