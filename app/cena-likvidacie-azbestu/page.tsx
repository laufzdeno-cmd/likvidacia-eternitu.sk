import { coreFaqs } from '@/src/content/seo-content';
import { buildPageMetadata, FaqSection, QuoteCTA, QuickAnswer, SummaryBox } from '../seo-components';
import { JsonLd, buildFaqJsonLd, buildServiceJsonLd } from '../seo-json-ld';
import { PublicPageShell } from '../public-layout';

export const metadata = buildPageMetadata({
  title: 'Cena likvidácie azbestu a eternitu | Čo ovplyvňuje cenu | ASTANA',
  description:
    'Cena likvidácie azbestu a eternitu závisí od výmery, prístupu, typu materiálu, lokality, dokumentácie a objemu odpadu. Pošlite m2 a fotky, pripravíme ponuku.',
  path: '/cena-likvidacie-azbestu/',
  image: '/og/cena.jpg',
});

const priceFactors = [
  ['Výmera v m2', 'Najdôležitejší údaj pre prvé nacenenie. Ak presnú výmeru neviete, uveďte odhad.'],
  ['Typ materiálu', 'Vlnitý eternit, šablóny, dosky alebo už zložený odpad môžu mať rozdielnu náročnosť.'],
  ['Výška a prístup', 'Cenu ovplyvňuje výška objektu, sklon strechy, lešenie, prístup techniky a miesto nakládky.'],
  ['Lokalita', 'Pri väčšej vzdialenosti alebo horšej dostupnosti sa mení logistika a plánovanie odvozu.'],
  ['Dokumentácia', 'Rozsah potrebných podkladov závisí od typu zákazky a konkrétneho prípadu.'],
  ['Objem odpadu', 'Dôležitý je stav materiálu, balenie a množstvo odpadu pripraveného na odvoz.'],
] as const;

export default function AsbestosPricePage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Cena likvidácie azbestu', path: '/cena-likvidacie-azbestu/' }} client="full">
      <main className="seo-page">
        <JsonLd data={[buildServiceJsonLd('Cena likvidácie azbestu a eternitu', 'Cena závisí od výmery, typu materiálu, prístupu, lokality, dokumentácie a objemu odpadu.', '/cena-likvidacie-azbestu/'), buildFaqJsonLd(coreFaqs.slice(3, 7))]} />
        <section className="seo-hero">
          <p className="eyebrow">Cena</p>
          <h1>Cena likvidácie azbestu a eternitu</h1>
          <p>Cena je individuálna. Pošlite približnú výmeru, lokalitu a fotky, aby ponuka vychádzala z reálnej situácie a nie z vymysleného cenníka.</p>
        </section>
        <QuickAnswer>
          Cena likvidácie azbestu a eternitu sa nedá zodpovedne určiť jednou sumou bez údajov o zákazke. Závisí od m2,
          typu materiálu, výšky objektu, prístupu, lokality, dokumentácie a objemu odpadu.
        </QuickAnswer>
        <section className="seo-section">
          <h2>Čo ovplyvňuje cenu</h2>
          <div className="seo-card-grid">
            {priceFactors.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <SummaryBox
          items={[
            ['Čo poslať', 'm2, lokalitu, fotky, typ objektu a informáciu o prístupe'],
            ['Čo nerobíme', 'neuvádzame vymyslený univerzálny cenník bez znalosti zákazky'],
            ['Čo dostanete', 'konkrétnu cenovú ponuku a návrh ďalšieho postupu'],
            ['Prečo fotky pomôžu', 'spresnia typ materiálu, výšku, prístup a náročnosť'],
          ]}
        />
        <section className="seo-calculator" id="orientacna-cena">
          <div>
            <p className="eyebrow">Orientačný výpočet</p>
            <h2>Kalkulátor podľa výmery</h2>
            <p>Výsledok je orientačný. Presnú ponuku pripravíme po kontrole údajov, fotiek a lokality.</p>
          </div>
          <div className="price-calculator">
            <label htmlFor="priceArea">Výmera v m2</label>
            <input id="priceArea" data-price-area type="range" min="30" max="500" step="10" defaultValue="120" />
            <output data-price-area-output htmlFor="priceArea">120 m2</output>
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
        <FaqSection faqs={coreFaqs.slice(3, 7)} title="Otázky k cene" />
        <QuoteCTA title="Chcem presnú cenovú ponuku" />
      </main>
    </PublicPageShell>
  );
}
