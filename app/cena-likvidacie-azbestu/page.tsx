import type { Metadata } from 'next';
import { PublicPageShell } from '../public-layout';

export const metadata: Metadata = {
  title: 'Cena likvidácie azbestu | Individuálna ponuka do 24h | ASTANA',
  description:
    'Cena likvidácie azbestu závisí od typu materiálu a rozsahu prác. Pošlite nám výmeru a dostanete záväznú ponuku do 24 hodín. Cena zahŕňa všetko.',
  keywords: 'cena likvidácia azbestu, koľko stojí odstránenie eternitu, likvidácia eternitu cena Slovensko',
  alternates: { canonical: '/cena-likvidacie-azbestu/' },
  openGraph: {
    title: 'Cena likvidácie azbestu | ASTANA',
    description: 'Cena závisí od rozsahu, materiálu a prístupnosti. Pošlite výmeru a dostanete individuálnu ponuku do 24 hodín.',
    images: ['/og/cena.jpg'],
  },
};

const included = [
  'Dokumentácia pre RÚVZ a OÚ ŽP',
  'Správne poplatky na úradoch',
  'Vytvorenie ochranného pásma',
  'Stabilizácia materiálu penetračným postrekom',
  'Odborná demontáž vyškoleným personálom',
  'Balenie do PE vriec s označením ADR 9',
  'Dekontaminácia pracoviska',
  'Preprava na skládku nebezpečného odpadu',
  'Poplatok za skládkovanie',
  'Záverečná správa a doklady po likvidácii',
  'Potvrdenie o legálnom zneškodnení odpadu',
];

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Likvidácia azbestu a eternitu',
  description: 'Individuálna cenová ponuka na legálnu likvidáciu azbestu a eternitu vrátane dokumentácie, demontáže, balenia, odvozu a dokladov.',
  provider: {
    '@type': 'LocalBusiness',
    name: 'ASTANA, s.r.o.',
    url: 'https://likvidacia-eternitu.sk',
  },
  areaServed: { '@type': 'Country', name: 'Slovakia' },
  serviceType: 'Likvidácia azbestu',
};

export default function AsbestosPricePage() {
  return (
    <PublicPageShell>
      <main className="seo-page">
        <section className="seo-hero">
          <p className="eyebrow">Cena</p>
          <h1>Koľko stojí likvidácia azbestu?</h1>
          <p>
            Každá zákazka je iná. Pošlite nám výmeru, lokalitu a pár fotiek. Pripravíme vám
            konkrétnu cenovú ponuku do 24 hodín.
          </p>
        </section>

        <section className="seo-calculator" id="orientacna-cena">
          <div>
            <p className="eyebrow">Orientačný výpočet</p>
            <h2>Kalkulátor podľa výmery</h2>
            <p>Zadajte približnú výmeru strechy alebo odpadu. Výsledok je orientačný rozsah, presnú ponuku pripravíme po kontrole údajov.</p>
          </div>
          <div className="price-calculator">
            <label htmlFor="priceArea">Výmera v m²</label>
            <input id="priceArea" data-price-area type="range" min="30" max="500" step="10" defaultValue="120" />
            <output data-price-area-output htmlFor="priceArea">120 m²</output>
            <div className="price-result">
              <span>Orientačná cena:</span>
              <strong><span data-price-min>960 €</span> - <span data-price-max>1 680 €</span></strong>
            </div>
            <div className="price-materials" aria-label="Typ materiálu">
              <button type="button" data-price-material="vlnity" className="is-active">Vlnitý eternit</button>
              <button type="button" data-price-material="hladky">Hladký eternit</button>
              <button type="button" data-price-material="boleticky">Panely</button>
              <button type="button" data-price-material="neviem">Neviem</button>
            </div>
          </div>
        </section>

        <section className="seo-section">
          <h2>Cena závisí od viacerých faktorov</h2>
          <p className="seo-lead">
            Každá zákazka je iná. Cenu ovplyvňuje typ materiálu, výmera, prístupnosť strechy,
            výška objektu a rozsah dokumentácie. Preto cenovú ponuku pripravujeme vždy
            individuálne - na základe vašej konkrétnej situácie.
          </p>
          <div className="seo-card-grid">
            <article>
              <h3>Čo cena vždy zahŕňa</h3>
              <ul>
                <li>Všetka dokumentácia pre RÚVZ a OÚ ŽP</li>
                <li>Demontáž odborným personálom</li>
                <li>Balenie, odvoz, skládkovanie</li>
                <li>Záverečná správa a doklady</li>
              </ul>
            </article>
            <article>
              <h3>Čo cenu ovplyvňuje</h3>
              <ul>
                <li>Typ a stav materiálu</li>
                <li>Prístupnosť a výška strechy</li>
                <li>Výmera v m²</li>
                <li>Lokalita a termín</li>
              </ul>
            </article>
            <article>
              <h3>Prečo sa neoplatí šetriť</h3>
              <ul>
                <li>Firma bez dokladov znamená riziko pre vlastníka</li>
                <li>Za odpad na čiernej skládke môžete niesť zodpovednosť</li>
                <li>Dokumentácia RÚVZ chráni vás, nie firmu</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="seo-section">
          <h2>Čo je v cene zahrnuté</h2>
          <div className="seo-included-list">
            {included.map((item) => <span key={item}>✓ {item}</span>)}
          </div>
        </section>

        <section className="seo-section seo-faq">
          <h2>Časté otázky o cene</h2>
          <details>
            <summary>Prečo nerátate každú strechu rovnako?</summary>
            <p>Rozdiel je v materiáli, prístupe, výške objektu, potrebe dokumentácie a organizácii odvozu.</p>
          </details>
          <details>
            <summary>Stačí približná výmera?</summary>
            <p>Áno. Na prvú ponuku stačí odhad v m², presný rozsah sa potvrdí podľa skutočnosti.</p>
          </details>
          <details>
            <summary>Je v cene aj odvoz?</summary>
            <p>Áno, ponuku pripravujeme ako kompletné riešenie vrátane balenia, odvozu, skládkovania a dokladov.</p>
          </details>
          <details>
            <summary>Kedy dostanem ponuku?</summary>
            <p>Po odoslaní údajov vám cenovú ponuku pošleme spravidla do 24 hodín.</p>
          </details>
        </section>

        <section className="seo-cta">
          <h2>Pošlite výmeru a dostanete konkrétnu ponuku</h2>
          <p>Bez záväzkov. Ozveme sa s cenou a ďalším postupom.</p>
          <a className="button button-primary" href="/#dopyt">Chcem cenovú ponuku</a>
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
    </PublicPageShell>
  );
}
