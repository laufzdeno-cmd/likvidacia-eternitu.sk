import type { Metadata } from 'next';
import LandingClient from '../landing-client';
import { ResponsiveImage } from '@/src/components/responsive-image';
import { rooferProofPhotos } from '@/src/data/azbestReferences';
import { listPublicRoofers } from '@/src/server/db';

export const metadata: Metadata = {
  title: 'Strechári podľa regiónu | ASTANA',
  description:
    'Máte strechára? Zladíme sa. Nemáte? Pomôžeme nájsť partnera podľa regiónu a zladiť demontáž eternitu s výmenou strechy.',
  alternates: {
    canonical: '/strechari/',
  },
  openGraph: {
    title: 'Strechári podľa regiónu | ASTANA',
    description:
      'Zladenie likvidácie eternitu so strechárom. Verejný zoznam partnerov sa zobrazuje len po schválení v adminovi.',
    url: '/strechari/',
  },
};

const regions = [
  'Bratislavský',
  'Trnavský',
  'Trenčiansky',
  'Nitriansky',
  'Žilinský',
  'Banskobystrický',
  'Prešovský',
  'Košický',
];

const districts = [
  'Poprad',
  'Kežmarok',
  'Prešov',
  'Košice-okolie',
  'Žilina',
  'Banská Bystrica',
  'Nitra',
  'Trnava',
  'Bratislava',
];

const regionChoices = [
  {
    region: 'Bratislavský',
    label: 'Bratislavský kraj',
  },
  {
    region: 'Trnavský',
    label: 'Trnavský kraj',
  },
  {
    region: 'Trenčiansky',
    label: 'Trenčiansky kraj',
  },
  {
    region: 'Nitriansky',
    label: 'Nitriansky kraj',
  },
  {
    region: 'Žilinský',
    label: 'Žilinský kraj',
  },
  {
    region: 'Banskobystrický',
    label: 'Banskobystrický kraj',
  },
  {
    region: 'Prešovský',
    label: 'Prešovský kraj',
  },
  {
    region: 'Košický',
    label: 'Košický kraj',
  },
];

export default async function RoofersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const region = (params.kraj || '').trim();
  const district = (params.okres || '').trim();
  const verifiedOnly = params.overeny === 'ano';
  const minRating = Number(params.hodnotenie || 0);
  const allRoofers = await listPublicRoofers({ region, district });
  const roofers = allRoofers.filter((roofer) => (!verifiedOnly || roofer.verifiedPartner)).filter((roofer) => !minRating || roofer.rating >= minRating);
  const selectedRegion = regionChoices.find((item) => item.region === region);
  const emptyStateText = region
    ? 'Ak strechára ešte nemáte, uveďte kraj a okres v cenovej ponuke. Odporúčanie potvrdíme ručne podľa regiónu, dostupnosti a vhodnosti partnera.'
    : 'Ak strechára ešte nemáte, uveďte kraj a okres v cenovej ponuke. Odporúčanie potvrdíme ručne podľa regiónu, dostupnosti a vhodnosti partnera.';

  return (
    <>
      <header className="site-header">
        <div className="header-main">
          <a className="brand" href="/" aria-label="ASTANA - likvidácia azbestu a eternitu">
            <img className="brand-logo" src="/assets/astana-logo.svg" alt="ASTANA" width="195" height="65" />
            <span><small>Bezpečná likvidácia azbestu</small></span>
          </a>
          <div className="header-meta">
            <a className="header-phone" href="tel:+421905217946">
              <span className="meta-icon phone" aria-hidden="true"></span>
              <strong>0905 217 946</strong>
              <small>Po-Pia 7:00 - 18:00</small>
            </a>
            <a className="button button-primary header-button" href="/#dopyt">Chcem cenovú ponuku</a>
          </div>
          <button className="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false">Menu</button>
        </div>
        <nav className="site-nav" id="site-nav" aria-label="Hlavná navigácia">
          <a href="/">Úvod</a>
          <a href="/#azbest">Prečo odborný postup</a>
          <a href="/#cena">Čo vybavíme</a>
          <a href="/#ako-to-prebieha">Ako to prebieha</a>
          <a href="/strechari/" aria-current="page">Strechári</a>
          <a href="/#referencie">Prax</a>
          <a href="/#faq">FAQ</a>
          <a href="/#kontakt">Kontakt</a>
        </nav>
      </header>

      <main className="roofer-page">
        <section className="roofer-hero" aria-labelledby="roofer-title">
          <div>
            <p className="eyebrow">Strechári podľa regiónu</p>
            <h1 id="roofer-title">Máte strechára? Zladíme sa. Nemáte? Pomôžeme nájsť.</h1>
            <p>
              Pri výmene strechy rozhoduje načasovanie. Demontáž plánujeme tak, aby mohli strechári nadviazať čo
              najplynulejšie a strecha nezostala zbytočne otvorená.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#filter-region">Vybrať región</a>
              <a className="button button-outline" href="tel:+421905217946">Zavolať 0905 217 946</a>
            </div>
          </div>
          <div className="region-map-card region-grid-card">
            <div className="region-map-copy">
              <p className="eyebrow">Výber regiónu</p>
              <strong>Nájdeme strechára podľa regiónu</strong>
              <p>
                Vyberte kraj alebo okres. Ak nemáte vlastného strechára, odporučíme vám partnera a zladíme termín
                demontáže s výmenou strechy.
              </p>
            </div>
            <a className="button button-primary region-picker-cta" href="#filter-region">Vybrať región</a>
            <div className="region-choice-grid" aria-label="Vyberte kraj">
              {regionChoices.map((item) => (
                <a
                  key={item.region}
                  className={`region-choice-card${item.region === region ? ' is-selected' : ''}`}
                  href={`/strechari/?kraj=${encodeURIComponent(item.region)}#filter-region`}
                  aria-label={`Vybrať ${item.label}`}
                >
                  <span className="line-icon map" aria-hidden="true"></span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>Preveríme partnera v regióne</small>
                  </span>
                </a>
              ))}
            </div>
            <p className="region-map-selected">
              {selectedRegion ? (
                <>Vybraný región: <strong>{selectedRegion.label}</strong></>
              ) : (
                'Vyberte kraj kliknutím na kartu alebo použite filter nižšie.'
              )}
            </p>
          </div>
        </section>

        <section className="section roofer-proof-section" aria-labelledby="roofer-proof-title">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">Zladenie prác v praxi</p>
              <h2 id="roofer-proof-title">Najprv bezpečne odstránime eternit. Potom môžu strechári nadviazať.</h2>
            </div>
            <p>
              Pri výmene strechy je dôležité, aby demontáž, balenie a odvoz nebrzdili ďalšie práce. Partnerov verejne
              zobrazujeme až po overení.
            </p>
          </div>
          <div className="roofer-proof-grid">
            {rooferProofPhotos.map((photo) => (
              <figure key={photo.id}>
                <ResponsiveImage
                  image={photo}
                  loading="eager"
                  width={560}
                  height={400}
                  sizes="(max-width: 760px) 100vw, 24vw"
                />
                <figcaption>{photo.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="section roofer-directory" aria-labelledby="directory-title">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">Kontrolovaný zoznam partnerov</p>
              <h2 id="directory-title">Zoznam spolupracujúcich strechárov</h2>
            </div>
            <p>
              Vyberte kraj alebo okres. Ak partner vo vašom regióne zatiaľ nie je verejne zobrazený, uveďte región
              v cenovej ponuke a preveríme vhodný kontakt.
            </p>
          </div>

          <form className="roofer-filters" id="filter-region" aria-label="Filtrovanie strechárov" method="get" action="/strechari/">
            <label>
              Kraj
              <select name="kraj" defaultValue={region}>
                <option value="">Všetky kraje</option>
                {regions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Okres
              <select name="okres" defaultValue={district}>
                <option value="">Všetky okresy</option>
                {districts.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Overený partner
              <select name="overeny" defaultValue={verifiedOnly ? 'ano' : ''}>
                <option value="">Všetci aktívni</option>
                <option value="ano">Iba overení</option>
              </select>
            </label>
            <label>
              Hodnotenie
              <select name="hodnotenie" defaultValue={minRating ? String(minRating) : ''}>
                <option value="">Bez obmedzenia</option>
                <option value="4">4+ hviezdičky</option>
                <option value="4.5">4,5+ hviezdičky</option>
              </select>
            </label>
            <button className="button button-outline" type="submit">Filtrovať</button>
          </form>

          {roofers.length ? (
            <div className="roofer-card-grid">
              {roofers.map((roofer) => (
                <article className="public-roofer-card" key={roofer.id} data-roofer-card={roofer.id} data-roofer-region={roofer.region}>
                  <div className="roofer-card-top">
                    <div>
                      <h3>{roofer.name}</h3>
                      <p>{roofer.region}{roofer.districts.length ? ` · ${roofer.districts.join(', ')}` : ''}</p>
                    </div>
                    {roofer.verifiedPartner ? <span>Overený partner ASTANA</span> : <span>Partner v overovaní</span>}
                  </div>
                  <dl>
                    <dt>Hodnotenie</dt>
                    <dd>{roofer.rating ? `${roofer.rating.toFixed(1)} / 5` : 'zatiaľ bez hodnotení'}{roofer.reviewCount ? ` · ${roofer.reviewCount} hodnotení` : ''}</dd>
                    <dt>Špecializácia</dt>
                    <dd>{roofer.specialization || 'strechárske práce podľa dohody'}</dd>
                  </dl>
                  {roofer.publicNote ? <p>{roofer.publicNote}</p> : null}
                  <div className="roofer-card-actions">
                    <button
                      className="button button-outline"
                      type="button"
                      data-roofer-contact={roofer.id}
                      data-roofer-region={roofer.region}
                      aria-controls={`roofer-contact-${roofer.id}`}
                      aria-expanded="false"
                    >
                      Zobraziť kontakt
                    </button>
                    <a
                      className="button button-primary"
                      data-roofer-quote={roofer.id}
                      data-roofer-region={roofer.region}
                      href={`/?wantsRooferRecommendation=true&selectedRooferId=${encodeURIComponent(roofer.id)}#dopyt`}
                    >
                      Použiť pri cenovej ponuke
                    </a>
                  </div>
                  <div className="roofer-contact-panel" id={`roofer-contact-${roofer.id}`} hidden>
                    {roofer.phone ? <a href={`tel:${roofer.phone}`}>{roofer.phone}</a> : <span>Telefón cez ASTANA</span>}
                    {roofer.email ? <a href={`mailto:${roofer.email}`}>{roofer.email}</a> : null}
                    {roofer.web ? <a href={roofer.web} target="_blank" rel="noreferrer">Web partnera</a> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="roofer-empty-state">
              <div className="roofer-empty-copy">
                <p className="eyebrow">Partneri podľa regiónu</p>
                <h3>Partnerov nezobrazujeme automaticky. Najprv ich overujeme.</h3>
                <p>{emptyStateText}</p>
                <div className="roofer-empty-steps" aria-label="Ako odporúčanie strechára prebieha">
                  <span>Zadáte kraj a okres</span>
                  <span>Preveríme vhodný kontakt</span>
                  <span>Odporúčanie potvrdí admin</span>
                </div>
              </div>
              <div className="roofer-empty-action">
                <span className="line-icon map" aria-hidden="true"></span>
                <strong>Nemáte strechára?</strong>
                <p>V dopyte zaškrtnite odporúčanie podľa regiónu.</p>
                <a className="button button-primary" href="/#dopyt">Vyplniť cenovú ponuku</a>
              </div>
            </div>
          )}
        </section>

        <section className="final-cta roofer-final" aria-labelledby="roofer-final-title">
          <div>
            <p className="eyebrow">Nemáte strechára?</p>
            <h2 id="roofer-final-title">Zadajte výmeru, lokalitu a či už máte strechára.</h2>
            <p>My preveríme postup, cenu a podľa regiónu aj možnosti zladenia so strechárskou prácou.</p>
          </div>
          <div className="final-actions">
            <a className="button button-primary" href="/#dopyt">Získať cenovú ponuku</a>
            <a className="button button-outline" href="/">Späť na úvod</a>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="kontakt">
        <div>
          <a className="brand footer-brand" href="/" aria-label="ASTANA">
            <img className="brand-logo" src="/assets/astana-logo.svg" alt="ASTANA" width="195" height="65" />
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
          <a href="/#referencie">Prax</a>
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
    </>
  );
}
