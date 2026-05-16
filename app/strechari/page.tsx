import type { Metadata } from 'next';
import LandingClient from '../landing-client';

export const metadata: Metadata = {
  title: 'Strechári pre výmenu eternitovej strechy | ASTANA',
  description:
    'Ak pri likvidácii eternitu ešte nemáte strechára, uveďte kraj v dopyte. ASTANA preverí vhodný kontakt podľa regiónu a termínu.',
  alternates: {
    canonical: '/strechari/',
  },
  openGraph: {
    title: 'Strechári pre výmenu eternitovej strechy | ASTANA',
    description:
      'Zladenie likvidácie eternitu so strechárom. Partnerov pripravujeme podľa regiónov, aby strecha nezostala zbytočne otvorená.',
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

export default function RoofersPage() {
  return (
    <>
      <header className="site-header simple-header">
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
        </div>
        <nav className="site-nav" aria-label="Hlavná navigácia">
          <a href="/">Úvod</a>
          <a href="/#ako-to-prebieha">Ako to prebieha</a>
          <a href="/#cena">Čo vybavíme</a>
          <a href="/strechari/" aria-current="page">Strechári</a>
          <a href="/#faq">FAQ</a>
          <a href="/#kontakt">Kontakt</a>
        </nav>
      </header>

      <main className="roofer-page">
        <section className="roofer-hero" aria-labelledby="roofer-title">
          <div>
            <p className="eyebrow">Zladenie prác pri výmene strechy</p>
            <h1 id="roofer-title">Máte strechára? Zladíme sa. Nemáte? Pomôžeme nájsť.</h1>
            <p>
              Pri výmene eternitovej strechy rozhoduje načasovanie. Demontáž plánujeme tak, aby mohli strechári
              nadviazať čo najplynulejšie a strecha nezostala zbytočne otvorená.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="/#dopyt">Potrebujem strechára k dopytu</a>
              <a className="button button-outline" href="tel:+421905217946">Zavolať 0905 217 946</a>
            </div>
          </div>
          <div className="roofer-proof-card">
            <span className="line-icon calendar" aria-hidden="true"></span>
            <strong>Strecha bez zbytočného čakania</strong>
            <p>Termín demontáže riešime podľa počasia, lokality a možností strechára.</p>
          </div>
        </section>

        <section className="section roofer-directory" aria-labelledby="directory-title">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">Partneri podľa regiónu</p>
              <h2 id="directory-title">Zoznam spolupracujúcich strechárov</h2>
            </div>
            <p>
              Verejný zoznam partnerov pripravujeme tak, aby obsahoval len overené a aktuálne kontakty. Pri dopyte
              môžete už teraz uviesť kraj alebo okres a preveríme vhodný kontakt.
            </p>
          </div>

          <div className="roofer-filters" aria-label="Filtrovanie strechárov">
            <label>
              Kraj
              <select name="region" defaultValue="">
                <option value="">Vyberte kraj</option>
                {regions.map((region) => <option key={region}>{region}</option>)}
              </select>
            </label>
            <label>
              Okres
              <select name="district" defaultValue="">
                <option value="">Vyberte okres</option>
                {districts.map((district) => <option key={district}>{district}</option>)}
              </select>
            </label>
          </div>

          <div className="roofer-empty-state">
            <div>
              <p className="eyebrow">Pripravené pre admin</p>
              <h3>Zoznam partnerov pripravujeme.</h3>
              <p>
                Ak strechára ešte nemáte, uveďte to v cenovej ponuke a podľa regiónu preveríme vhodný kontakt.
                Verejne zobrazíme iba partnerov, ktorí budú schválení a pravidelne kontrolovaní.
              </p>
            </div>
            <a className="button button-primary" href="/#dopyt">Použiť pri cenovej ponuke</a>
          </div>

          <div className="partner-table" role="table" aria-label="Budúci zoznam strechárov">
            <div role="row" className="partner-table-head">
              <span role="columnheader">Firma</span>
              <span role="columnheader">Región</span>
              <span role="columnheader">Hodnotenie</span>
              <span role="columnheader">Akcia</span>
            </div>
            <div role="row" className="partner-table-empty">
              <span role="cell">Schválení partneri sa zobrazia po doplnení v adminovi.</span>
              <span role="cell">Kraj / okres</span>
              <span role="cell">Overené po realizáciách</span>
              <span role="cell"><a href="/#dopyt">Uveďte región v dopyte</a></span>
            </div>
          </div>
        </section>

        <section className="final-cta roofer-final" aria-labelledby="roofer-final-title">
          <div>
            <p className="eyebrow">Najrýchlejší ďalší krok</p>
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
