import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

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

const benefits = [
  'Zladenie so strechármi',
  'Priame balenie do určených obalov',
  'Bez zhadzovania zo strechy',
  'Dodržiavame termíny',
  'Doklady a odvoz',
  'Rýchla orientačná ponuka',
];

function App() {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Likvidácia Eternitu">
          <span className="brand-mark">LE</span>
          <span>
            <strong>Likvidácia Eternitu</strong>
            <small>ASTANA odborné zázemie</small>
          </span>
        </a>
        <nav aria-label="Hlavná navigácia">
          <a href="#proces">Ako to funguje</a>
          <a href="#cena">Cena</a>
          <a href="#strechari">Strechári</a>
          <a href="#kontakt">Kontakt</a>
        </nav>
        <a className="header-phone" href="tel:+421905217946">0905 217 946</a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">Likvidácia eternitu / materiálov obsahujúcich azbest</p>
            <h1>Likvidácia eternitu zladená so strechármi</h1>
            <p className="lead">
              Od roku 2011 zabezpečujeme odborné odstránenie materiálov obsahujúcich azbest.
              Demontáž vieme zladiť s vaším strechárom alebo odporučiť spolupracujúceho
              strechára vo vašom kraji.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#dopyt">Chcem rýchly dopyt</a>
              <a className="button secondary" href="mailto:astana@astana.sk?subject=Dopyt%20-%20likvidácia%20eternitu">
                Poslať fotky strechy
              </a>
            </div>
            <div className="trust-grid" aria-label="Výhody služby">
              {['Od roku 2011', 'Celá SR', 'Zladenie so strechármi', 'Doklady a odvoz'].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="hero-visual" aria-label="Ilustrácia koordinácie demontáže a strechárov">
            <div className="roof-scene">
              <div className="sun" />
              <div className="roof old-roof" />
              <div className="roof new-roof" />
              <div className="worker worker-one" />
              <div className="worker worker-two" />
              <div className="bag">azbest</div>
            </div>
          </div>
        </section>

        <section id="proces" className="process">
          {[
            ['1. Pošlete fotky', 'Stačí obec, kontakt, typ materiálu a pár fotiek strechy.'],
            ['2. Zladíme termín', 'Nemusíte riešiť chaos medzi dvoma firmami.'],
            ['3. Bezpečne demontujeme', 'Šablóny po stabilizácii ukladáme priamo do určených obalov.'],
          ].map(([title, text]) => (
            <article key={title} className="process-card">
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className="section">
          <div className="section-heading">
            <p className="eyebrow">Prečo nás ľudia volajú</p>
            <h2>Strecha musí byť vyriešená plynulo, nie chaoticky</h2>
          </div>
          <div className="benefit-grid">
            {benefits.map((benefit) => (
              <article key={benefit} className="benefit-card">
                <span className="icon-check">✓</span>
                <h3>{benefit}</h3>
                <p>
                  Postup držíme praktický, čitateľný a koordinovaný s ďalšou prácou na streche.
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="cena" className="split-section">
          <div>
            <p className="eyebrow">Čo je v cene</p>
            <h2>Odborná demontáž, balenie, odvoz a doklady</h2>
            <p>
              Cena závisí od výmery, typu materiálu, prístupu, výšky objektu a vzdialenosti.
              Finálnu ponuku posielame až po kontrole údajov.
            </p>
          </div>
          <ul className="price-list">
            {[
              'posúdenie podľa fotiek a údajov',
              'stabilizácia materiálu',
              'odborná demontáž',
              'balenie do určených obalov',
              'odvoz na schválené miesto',
              'doklady podľa typu zákazky',
              'koordinácia so strechárom',
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section id="strechari" className="section blue-section">
          <div className="section-heading">
            <p className="eyebrow light">Spolupracujúci strechári</p>
            <h2>Vieme sa zladiť s vaším strechárom alebo odporučiť partnera v kraji</h2>
          </div>
          <div className="region-grid">
            {regions.map((region) => (
              <div className="region-card" key={region}>
                <strong>{region} kraj</strong>
                <span>Koordinácia termínu a odporúčanie partnera podľa dostupnosti.</span>
              </div>
            ))}
          </div>
        </section>

        <section id="dopyt" className="inquiry">
          <div>
            <p className="eyebrow">Rýchly dopyt</p>
            <h2>Pošlite základné údaje a fotky strechy</h2>
            <p>
              Najrýchlejšie je poslať fotky emailom. Do správy napíšte obec, približnú výmeru
              a či už máte svojho strechára.
            </p>
          </div>
          <div className="contact-card" id="kontakt">
            <a className="button primary full" href="mailto:astana@astana.sk?subject=Dopyt%20-%20likvidácia%20eternitu">
              Poslať dopyt emailom
            </a>
            <a className="button secondary full" href="tel:+421905217946">Zavolať 0905 217 946</a>
            <p>
              ASTANA, s.r.o.<br />
              Scherffelová 28, 058 01 Poprad<br />
              IČO: 46157701
            </p>
          </div>
        </section>
      </main>

      <footer>
        <p>© 2011 - 2026 ASTANA, s.r.o. | Likvidácia Eternitu</p>
        <p>Legálna likvidácia eternitu a azbestu po celom Slovensku.</p>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
