import type { Metadata } from 'next';
import LandingClient from '../landing-client';
import PublicWidgets from '../public-widgets';
import { ResponsiveImage } from '@/src/components/responsive-image';
import { galleryCategories, galleryReferences, realizationHeroStripReferences } from '@/src/data/azbestReferences';

export const metadata: Metadata = {
  title: 'Realizácie likvidácie azbestu a eternitu | ASTANA',
  description:
    'Fotodokumentácia realizácií ASTANA: rodinné domy, hospodárske budovy, priemyselné objekty, interiér, balenie a odvoz azbestového odpadu.',
  alternates: {
    canonical: '/realizacie/',
  },
  openGraph: {
    title: 'Realizácie likvidácie azbestu a eternitu | ASTANA',
    description:
      'Pozrite si reálne zábery z praxe ASTANA: stabilizácia, demontáž, balenie, odvoz a strechy pripravené na ďalšie práce.',
    url: '/realizacie/',
    images: ['/assets/azbest/webp/azbest-087.webp'],
  },
};

const categoryCopy: Record<string, string> = {
  vsetko: 'Všetky schválené zábery z praxe ASTANA.',
  'rodinne-domy': 'Eternitové strechy na rodinných domoch, príprava pracoviska a kontrolovaná demontáž.',
  'hospodarske-budovy': 'Hospodárske budovy, dlhé objekty a väčšie strechy, kde je dôležitá logistika.',
  priemysel: 'Priemyselné objekty, dopravníky a väčšie prevádzky s náročnejšou koordináciou.',
  interier: 'Technické a interiérové priestory, kde sa postup prispôsobuje prístupu a bezpečnosti.',
  'balenie-odvoz': 'Balenie do určených obalov, príprava odpadu na odvoz a organizácia logistiky.',
  strechari: 'Strechy pripravené na nadväznú prácu strechárov po odstránení materiálu.',
};

const categoryBadgeCopy: Record<string, string> = {
  'rodinne-domy': 'rodinný dom',
  'hospodarske-budovy': 'hospodárska budova',
  priemysel: 'priemyselný objekt',
  interier: 'interiér',
  'balenie-odvoz': 'balenie a odvoz',
  strechari: 'strecha pripravená pre strechára',
};

const realizationsJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': 'https://likvidacia-eternitu.sk/realizacie/#page',
      name: 'Realizácie likvidácie azbestu a eternitu ASTANA',
      url: 'https://likvidacia-eternitu.sk/realizacie/',
      isPartOf: { '@id': 'https://likvidacia-eternitu.sk/#website' },
      about: { '@id': 'https://likvidacia-eternitu.sk/#service' },
    },
    {
      '@type': 'ImageGallery',
      '@id': 'https://likvidacia-eternitu.sk/realizacie/#gallery',
      name: 'Fotogaléria realizácií ASTANA',
      url: 'https://likvidacia-eternitu.sk/realizacie/',
      image: galleryReferences.slice(0, 12).map((photo) => ({
        '@type': 'ImageObject',
        url: `https://likvidacia-eternitu.sk${photo.webp}`,
        caption: photo.title,
        description: photo.alt,
      })),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://likvidacia-eternitu.sk/realizacie/#breadcrumbs',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Úvod', item: 'https://likvidacia-eternitu.sk/' },
        { '@type': 'ListItem', position: 2, name: 'Realizácie', item: 'https://likvidacia-eternitu.sk/realizacie/' },
      ],
    },
  ],
};

export default function RealizationsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(realizationsJsonLd) }} />
      <header className="site-header">
        <div className="header-main">
          <a className="brand" href="/" aria-label="ASTANA - likvidácia azbestu a eternitu">
            <img className="brand-logo" src="/assets/astana-logo.png" alt="ASTANA" width="195" height="65" />
            <span><small>Bezpečná likvidácia azbestu</small></span>
          </a>
          <div className="header-meta">
            <a className="header-phone" href="tel:+421905217946">
              <span className="meta-icon phone" aria-hidden="true"></span>
              <strong>0905 217 946</strong>
            </a>
            <a className="button button-primary header-button" href="/#dopyt">Získať cenovú ponuku</a>
          </div>
          <button className="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false">Menu</button>
        </div>
        <nav className="site-nav" id="site-nav" aria-label="Hlavná navigácia">
          <a href="/#orientacna-cena">Orientačná cena</a>
          <a href="/postup/">Ako to prebieha</a>
          <a href="/strechari/">Strechári</a>
          <a href="/realizacie/" aria-current="page">Realizácie</a>
          <a href="/faq/">FAQ</a>
          <a href="/#kontakt">Kontakt</a>
          <a className="nav-mobile-phone" href="tel:+421905217946">
            <span className="meta-icon phone" aria-hidden="true"></span>0905 217 946
          </a>
          <a className="nav-mobile-cta" href="/#dopyt">Získať cenovú ponuku</a>
        </nav>
      </header>

      <main className="realizations-page">
        <section className="realizations-hero" aria-labelledby="realizations-page-title">
          <div>
            <p className="eyebrow">Fotodokumentácia z realizácií</p>
            <h1 id="realizations-page-title">Reálne realizácie ASTANA</h1>
            <p>
              Fotky používame ako dôkaz práce, nie ako dekoráciu. Všetky zábery v galérii sú reálne práce ASTANA. Pri starších
              fotkách neuvádzame lokality ani výmery, ak si ich nevieme spoľahlivo potvrdiť.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="/#dopyt">Naceniť podobnú realizáciu</a>
              <a className="button button-outline" href="#realizacie-galeria">Pozrieť galériu</a>
            </div>
          </div>
          <div className="realizations-hero-strip" aria-label="Ukážky realizácií ASTANA">
            {realizationHeroStripReferences.map((photo) => (
              <figure key={photo.id}>
                <ResponsiveImage image={photo} width={460} height={360} sizes="(max-width: 760px) 50vw, 16vw" />
                <figcaption>{photo.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="section gallery-section realizations-gallery-section" id="realizacie-galeria" aria-labelledby="gallery-title">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">Filtrovaná galéria</p>
              <h2 id="gallery-title">Fotogaléria realizácií ASTANA</h2>
            </div>
            <p>
              Vyberte typ objektu alebo fázu procesu. Na stránke nezobrazujeme súkromné údaje zákazníkov ani citlivé
              detaily, ktoré by nemali byť verejné. Lokality a m2 pri fotkách nevymýšľame.
            </p>
          </div>
          <div className="gallery-filters" aria-label="Filtrovanie galérie">
            {galleryCategories.map((category) => (
              <button key={category.key} type="button" data-gallery-filter={category.key} title={categoryCopy[category.key]}>
                {category.label}
              </button>
            ))}
          </div>
          <div className="real-gallery-grid">
            {galleryReferences.map((photo, index) => (
              <button
                className="real-gallery-card"
                type="button"
                key={photo.id}
                data-gallery-card
                data-gallery-index={index}
                data-gallery-category={photo.category}
                data-gallery-webp={photo.webp}
                data-gallery-jpg={photo.jpg}
                data-gallery-title={photo.title}
                data-gallery-alt={photo.alt}
                hidden={index >= 12}
              >
                <ResponsiveImage
                  image={photo}
                  width={520}
                  height={420}
                  sizes="(max-width: 760px) 100vw, 25vw"
                  loading="lazy"
                  fetchPriority="low"
                />
                <span>
                  <strong>{photo.title}</strong>
                  <small>{categoryBadgeCopy[photo.category] || 'realizácia ASTANA'}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="gallery-actions">
            <button className="button button-outline" type="button" data-gallery-load-more>
              Zobraziť ďalšie realizácie
            </button>
            <a className="button button-primary" href="/#dopyt">Naceniť podobnú realizáciu</a>
          </div>
          <div className="gallery-lightbox" data-gallery-lightbox hidden aria-modal="true" role="dialog" aria-label="Fotografia realizácie">
            <button type="button" className="gallery-lightbox-close" data-lightbox-close aria-label="Zatvoriť galériu">×</button>
            <button type="button" className="gallery-lightbox-prev" data-lightbox-prev aria-label="Predchádzajúca fotka">‹</button>
            <figure>
              <img data-lightbox-image src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="" width="960" height="720" />
              <figcaption data-lightbox-caption></figcaption>
            </figure>
            <button type="button" className="gallery-lightbox-next" data-lightbox-next aria-label="Ďalšia fotka">›</button>
          </div>
        </section>

        <section className="final-cta realizations-final" aria-labelledby="realizations-final-title">
          <div>
            <p className="eyebrow">Máte podobnú strechu?</p>
            <h2 id="realizations-final-title">Zadajte m2 a pripravíme cenovú ponuku.</h2>
            <p>Fotky sú pomocné. Základ ceny tvorí približná výmera, lokalita a typ materiálu.</p>
          </div>
          <div className="final-actions">
            <a className="button button-primary" href="/#dopyt">Získať cenovú ponuku</a>
            <a className="button button-outline" href="tel:+421905217946">Zavolať 0905 217 946</a>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="kontakt">
        <div>
          <a className="brand footer-brand" href="/" aria-label="ASTANA">
            <img className="brand-logo" src="/assets/astana-logo.png" alt="ASTANA" width="195" height="65" />
            <span><small>Bezpečná likvidácia azbestu</small></span>
          </a>
          <p>Likvidácia azbestu a eternitu po celom Slovensku. Cenová ponuka, dokumentácia, demontáž, balenie, odvoz a potvrdenie.</p>
        </div>
        <div>
          <h2>Kontakt</h2>
          <span>ASTANA, s.r.o.</span>
          <span>Scherffelova 1364/28</span>
          <span>058 01 Poprad</span>
          <a href="tel:+421905217946">0905 217 946</a>
          <a href="mailto:astana@astana.sk">astana@astana.sk</a>
        </div>
        <div>
          <h2>Firma</h2>
          <span>IČO: 46 157 701</span>
          <span>DIČ: 2023253771</span>
          <span>IČ DPH: SK2023253771</span>
        </div>
        <div>
          <h2>Užitočné</h2>
          <a href="/">Úvod</a>
          <a href="/realizacie/">Realizácie</a>
          <a href="/strechari/">Strechári</a>
          <a href="/ochrana-osobnych-udajov/">GDPR</a>
          <a href="/cookies/">Cookies</a>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
      </footer>
      <div className="mobile-sticky-cta" aria-label="Rýchle kontakty">
        <a href="tel:+421905217946">Zavolať</a>
        <a href="/#dopyt">Cenová ponuka</a>
      </div>
      <LandingClient />
      <PublicWidgets />
    </>
  );
}
