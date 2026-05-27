import type { Metadata } from 'next';
import LandingClient from '../landing-client';
import PublicWidgets from '../public-widgets';
import { PublicFooter } from '../public-layout';
import { BreadcrumbJsonLd } from '../seo-json-ld';

export const metadata: Metadata = {
  title: 'Spolupráca pre strechárov | ASTANA',
  description:
    'Spolupráca pre strechárov pri výmene eternitových striech. ASTANA pomáha zladiť demontáž, odvoz a nadväzujúce strechárske práce.',
  alternates: {
    canonical: '/strechari/',
  },
  openGraph: {
    title: 'Spolupráca pre strechárov | ASTANA',
    description: 'B2B spolupráca pre strechárov: skorá likvidácia azbestu, čisté pracovisko a odporúčanie zákaziek.',
    url: '/strechari/',
  },
};

const benefits = [
  {
    icon: 'clock',
    title: 'Príchod o 6:00 – 7:00',
    text: 'Na stavbu prichádzame skoro ráno. Vy môžete začať klásť novú krytinu ešte dopoludnia. Strecha nezostáva zbytočne otvorená.',
  },
  {
    icon: 'shield',
    title: 'Čistá práca, žiadny chaos',
    text: 'Strechu stabilizujeme penetračným roztokom, azbest vrecujeme priamo na streche alebo opatrne zlaňujeme dolu. Po skončení robíme vyhmlievanie. Pracovisko odovzdávame čisté.',
  },
  {
    icon: 'document-check',
    title: 'Doklady v poriadku',
    text: 'Pri zákazke riešime potrebný postup, dokumentáciu a odvoz podľa konkrétneho prípadu. Strechár sa tak nemusí púšťať do manipulácie s azbestom.',
  },
] as const;

const steps = [
  ['Zaregistrujete sa', 'Vyplníte krátky formulár — región, typ zákaziek, kontakt.'],
  ['Zladíme termín', 'Keď máte zákazníka s azbestom, napíšete nám. Dohodneme príchod na skoro ráno.'],
  ['My zlikvidujeme, vy staviate', 'Prídeme, urobíme svoju prácu čisto a odídeme. Vy nastúpite na čerstvú strechu.'],
  ['Dohadzujeme si zákazky navzájom', 'Ak zákazník nemá strechára, odporučíme vás. Funguje to oboma smermi.'],
] as const;

const regions = [
  'Bratislavský kraj',
  'Trnavský kraj',
  'Trenčiansky kraj',
  'Nitriansky kraj',
  'Žilinský kraj',
  'Banskobystrický kraj',
  'Prešovský kraj',
  'Košický kraj',
  'Celé Slovensko',
];

const jobTypes = ['Šikmé strechy', 'Ploché strechy', 'Priemyselné objekty', 'Hospodárske budovy'];

function OutlineIcon({ name }: { name: (typeof benefits)[number]['icon'] }) {
  const paths = {
    clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    shield:
      'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75A11.959 11.959 0 0 1 12 2.714Z',
    'document-check':
      'M10.125 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm0 0c4.97 0 9 4.03 9 9m-9-9v5.625c0 .621.504 1.125 1.125 1.125H16.5m-6 7.5 2.25 2.25L16.5 15',
  } satisfies Record<(typeof benefits)[number]['icon'], string>;

  return (
    <svg className="roofer-b2b-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export default function RoofersPage() {
  return (
    <>
      <BreadcrumbJsonLd name="Spolupráca pre strechárov" path="/strechari/" />
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
          <a className="is-active" href="/strechari/" aria-current="page">Strechári</a>
          <a href="/realizacie/">Realizácie</a>
          <a href="/faq/">FAQ</a>
          <a href="/#kontakt">Kontakt</a>
          <a className="nav-mobile-phone" href="tel:+421905217946">
            <span className="meta-icon phone" aria-hidden="true"></span>0905 217 946
          </a>
          <a className="nav-mobile-cta" href="/#dopyt">Získať cenovú ponuku</a>
        </nav>
      </header>

      <main className="roofer-b2b-page">
        <section className="roofer-b2b-hero" aria-labelledby="roofer-title">
          <div className="roofer-b2b-inner">
            <h1 id="roofer-title">Ste strechár?<br />Spolupracujte s ASTANA.</h1>
            <p>
              Likvidujeme azbest skoro ráno — tak aby ste mohli začať pracovať ešte dopoludnia.
              Zaregistrujte sa a začneme si dohadzovať zákazky.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#registracia">Chcem spolupracovať →</a>
              <a className="button button-outline" href="tel:+421905217946">Zavolať 0905 217 946</a>
            </div>
          </div>
        </section>

        <section className="roofer-b2b-benefits" aria-labelledby="roofer-benefits-title">
          <div className="roofer-b2b-inner">
            <h2 id="roofer-benefits-title">Čo pre vás robíme my</h2>
            <div className="roofer-b2b-card-grid">
              {benefits.map((benefit) => (
                <article className="roofer-b2b-card" key={benefit.title}>
                  <OutlineIcon name={benefit.icon} />
                  <h3>{benefit.title}</h3>
                  <p>{benefit.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="roofer-b2b-how" aria-labelledby="roofer-how-title">
          <div className="roofer-b2b-inner">
            <h2 id="roofer-how-title">Ako to funguje</h2>
            <ol className="roofer-b2b-stepper">
              {steps.map(([title, text], index) => (
                <li key={title}>
                  <span className="step-num">{index + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="roofer-b2b-registration" id="registracia" aria-labelledby="registration-title">
          <div className="roofer-b2b-inner">
            <div className="roofer-registration-head">
              <h2 id="registration-title">Zaregistrujte sa do siete ASTANA</h2>
              <p>Vyplňte krátky formulár. Ozveme sa do 48 hodín.</p>
            </div>
            <form className="roofer-registration-form" action="/api/roofer-registration/" method="post" noValidate>
              <input className="hp-field" type="text" name="companyWebsite" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="roofer-form-grid">
                <label>
                  Meno a priezvisko *
                  <input name="fullName" type="text" autoComplete="name" required />
                </label>
                <label>
                  Názov firmy / živnosť
                  <input name="companyName" type="text" autoComplete="organization" />
                </label>
                <label>
                  Telefón *
                  <input name="phone" type="tel" autoComplete="tel" required />
                </label>
                <label>
                  Email *
                  <input name="email" type="email" autoComplete="email" required />
                </label>
              </div>

              <fieldset>
                <legend>Región pôsobenia *</legend>
                <div className="roofer-checkbox-grid">
                  {regions.map((region) => (
                    <label key={region}>
                      <input type="checkbox" name="regions" value={region} />
                      <span>{region}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>Typ zákaziek</legend>
                <div className="roofer-checkbox-grid roofer-checkbox-grid-compact">
                  {jobTypes.map((type) => (
                    <label key={type}>
                      <input type="checkbox" name="jobTypes" value={type} />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label>
                Správa / poznámka
                <textarea
                  name="message"
                  rows={4}
                  placeholder="Napr. koľko zákaziek ročne riešite, s čím potrebujete pomôcť..."
                ></textarea>
              </label>

              <label className="roofer-consent">
                <input type="checkbox" name="gdpr" required />
                <span>Súhlasím so spracovaním údajov na vybavenie registrácie.</span>
              </label>

              <button className="button button-primary" type="submit">Odoslať registráciu</button>
              <p className="roofer-registration-status" role="status" aria-live="polite"></p>
            </form>
          </div>
        </section>

        <section className="roofer-b2b-footer-cta" aria-labelledby="roofer-footer-title">
          <div className="roofer-b2b-inner">
            <h2 id="roofer-footer-title">Zaujíma vás spolupráca? Zavolajte.</h2>
            <a href="tel:+421905217946">0905 217 946</a>
            <p>Po–Pia 7:00 – 18:00</p>
          </div>
        </section>
      </main>

      <PublicFooter />
      <LandingClient />
      <PublicWidgets />
    </>
  );
}
