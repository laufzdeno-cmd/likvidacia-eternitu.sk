import { coreFaqs } from '@/src/content/seo-content';
import { buildPageMetadata, FaqSection, QuoteCTA, QuickAnswer, SummaryBox } from '../seo-components';
import { JsonLd, buildFaqJsonLd, buildServiceJsonLd } from '../seo-json-ld';
import { PublicPageShell } from '../public-layout';
import PricePageClient from '../price-page-client';

export const metadata = buildPageMetadata({
  title: 'Cena likvidácie azbestu a eternitu | Faktory ceny | ASTANA',
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
    <PublicPageShell breadcrumb={{ name: 'Cena likvidácie azbestu', path: '/cena-likvidacie-azbestu/' }} hideWhatsappOnMobile>
      <main className="seo-page price-seo-page">
        <JsonLd data={[buildServiceJsonLd('Cena likvidácie azbestu a eternitu', 'Cena závisí od výmery, typu materiálu, prístupu, lokality, dokumentácie a objemu odpadu.', '/cena-likvidacie-azbestu/'), buildFaqJsonLd(coreFaqs.slice(3, 7))]} />
        <section className="seo-hero">
          <p className="eyebrow">Cena</p>
          <h1>Cena likvidácie azbestu a eternitu</h1>
          <p>Cena je individuálna. Pošlite približnú výmeru a lokalitu. Fotky môžu ponuku spresniť, ale nie sú povinné.</p>
          <div className="price-hero-actions">
            <a className="button button-primary" href="/#dopyt">Získať nezáväznú ponuku</a>
            <a className="button button-outline" href="#orientacna-cena">Vypočítať orientačne</a>
          </div>
          <p className="price-hero-note">Fotky sú voliteľné. Bez záväzku.</p>
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
            <div className="price-city-field">
              <label htmlFor="priceCity">Obec alebo mesto pre dopyt</label>
              <input id="priceCity" data-price-city type="text" maxLength={120} autoComplete="address-level2" placeholder="Napr. Poprad" />
              <small>Nepovinné pri orientačnom výpočte.</small>
            </div>
            <label htmlFor="priceArea">Výmera v m2</label>
            <input id="priceArea" data-price-area type="range" min="30" max="500" step="10" defaultValue="120" />
            <output data-price-area-output htmlFor="priceArea">120 m2</output>
            <div className="price-result" aria-live="polite">
              <span>Orientačná cena:</span>
              <strong><span data-price-min>960 €</span> - <span data-price-max>1 680 €</span></strong>
            </div>
            <div className="price-materials" role="group" aria-label="Typ materiálu">
              <button type="button" data-price-material="vlnity" className="is-active" aria-pressed="true">Vlnitý eternit</button>
              <button type="button" data-price-material="hladky" aria-pressed="false">Hladký eternit</button>
              <button type="button" data-price-material="boleticky" aria-pressed="false">Panely</button>
              <button type="button" data-price-material="neviem" aria-pressed="false">Neviem</button>
            </div>
            <a className="button button-primary" data-price-quote href="/#dopyt">Preniesť údaje do dopytu</a>
            <p className="price-transfer-fallback" data-price-transfer-status role="alert" hidden>
              Prehliadač neumožňuje preniesť údaje. <a href="/#dopyt">Prejdite na dopyt a zadajte ich ručne.</a>
            </p>
          </div>
        </section>
        <FaqSection faqs={coreFaqs.slice(3, 7)} title="Otázky k cene" />
        <QuoteCTA title="Chcem presnú cenovú ponuku" />
        <PricePageClient />
      </main>
    </PublicPageShell>
  );
}
