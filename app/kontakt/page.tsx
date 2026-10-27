import { buildPageMetadata, QuoteCTA } from '../seo-components';
import { PublicPageShell } from '../public-layout';
import { companyAddressLine, emailLink, phoneLink, site } from '@/src/content/site';
import { EditorialHero, ReadingLinks } from '../editorial-components';

export const metadata = buildPageMetadata({
  title: 'Kontakt | ASTANA likvidácia azbestu a eternitu',
  description:
    'Kontakt na ASTANA, s.r.o. Telefón, email, adresa, prevádzkové hodiny a čo poslať pre rýchlu cenovú ponuku na likvidáciu azbestu.',
  path: '/kontakt/',
});

export default function ContactPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Kontakt', path: '/kontakt/' }} hideWhatsappOnMobile>
      <main className="seo-page">
        <EditorialHero eyebrow="Dohodnime prvý krok" title="Kontaktujte ASTANA"
          lead="Riešite starú krytinu alebo odvoz eternitu? Zavolajte nám alebo pošlite obec a odhad výmery. Ak si materiálom či rozsahom nie ste istí, pomôžeme vám vyjasniť, čo potrebujeme vedieť."
          photoId="azbest-065" photoAlt="Pracovné vozidlo ASTANA pred objektom počas realizácie"
          photoCaption="ASTANA sídli v Poprade. Výjazdy po Slovensku plánujeme podľa konkrétnej zákazky.">
          <div className="hero-actions">
            <a className="button button-primary" href="/#dopyt">Odoslať dopyt</a>
            <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
          </div>
        </EditorialHero>
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
        <section className="seo-section">
          <h2>Vyberte spôsob, ktorý vám vyhovuje</h2>
          <div className="seo-card-grid">
            <article><h3>Chcete cenovú ponuku</h3><p>Najprehľadnejší je <a href="/#dopyt">krátky dopytový formulár</a>. Uveďte obec, odhad plochy a typ objektu. Fotky sú voliteľné a odoslanie nie je automatickou objednávkou.</p></article>
            <article><h3>Máte konkrétnu otázku</h3><p>Zavolajte v pracovných dňoch od 8:00 do 18:00 alebo napíšte na <a href={emailLink}>{site.email}</a>. Povedzte, či ide o materiál na objekte alebo už zložené dosky.</p></article>
            <article><h3>Už s nami riešite zákazku</h3><p>Pri doplnení informácií odpovedzte v existujúcej komunikácii. Pridajte číslo ponuky, ak ho máte, alebo obec a meno z objednávky. Ľahšie tak priradíme nové podklady.</p></article>
          </div>
        </section>
        <section className="seo-section"><h2>Čo nasleduje po vašej správe</h2><p className="editorial-faq-intro">Podklady posúdime a pri nejasnostiach sa ozveme s doplňujúcou otázkou. Konkrétny rozsah, cenu a možný termín si potvrdíme individuálne. Ak máte strechára, napíšte jeho plánovaný nástup už pri prvom kontakte.</p></section>
        <ReadingLinks links={[
          { href: '/poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/', title: 'Čo napísať do dopytu', text: 'Jednoduchý prehľad údajov bez technickej správy.' },
          { href: '/kde-posobime/', title: 'Pôsobnosť a výjazdy', text: 'Ako plánujeme práce v jednotlivých oblastiach Slovenska.' },
          { href: '/o-firme/', title: 'Overte si našu firmu', text: 'Firemné údaje a odkazy na verejné zdroje.' },
        ]} />
        <QuoteCTA title="Chcem cenovú ponuku" />
      </main>
    </PublicPageShell>
  );
}
