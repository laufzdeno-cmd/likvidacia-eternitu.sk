import { coreFaqs } from '@/src/content/seo-content';
import Image from 'next/image';
import { buildPageMetadata, FaqSection, QuoteCTA, QuickAnswer, SummaryBox } from '../seo-components';
import { JsonLd, buildFaqJsonLd, buildServiceJsonLd } from '../seo-json-ld';
import { PublicPageShell } from '../public-layout';
import PricePageClient from '../price-page-client';
import { PublicFontPreload } from '@/src/components/public-font-preload';
import { transportPolicy } from '@/src/content/transport-policy.mjs';
import './price-route.css';
import { ReadingLinks, UsefulChecklist } from '../editorial-components';

export const metadata = buildPageMetadata({
  title: 'Cena likvidácie azbestu a eternitu | Faktory ceny | ASTANA',
  description:
    'Cena likvidácie azbestu podľa výmery, materiálu a lokality. Pri ploche od 100 m² dopravu po Slovensku neúčtujeme. Získajte nezáväznú ponuku.',
  path: '/cena-likvidacie-azbestu/',
  image: '/og/cena-strecha-realizacia.jpg',
});

const priceFactors = [
  ['Výmera v m2', 'Najdôležitejší údaj pre prvé nacenenie. Ak presnú výmeru neviete, uveďte odhad.'],
  ['Typ materiálu', 'Vlnitý eternit, šablóny, dosky alebo už zložený odpad môžu mať rozdielnu náročnosť.'],
  ['Výška a prístup', 'Cenu ovplyvňuje výška objektu, sklon strechy, lešenie, prístup techniky a miesto nakládky.'],
  ['Lokalita', `${transportPolicy.freeFromThreshold} ${transportPolicy.belowThreshold} Lokalita naďalej ovplyvňuje plánovanie výjazdu a odvozu.`],
  ['Dokumentácia', 'Rozsah potrebných podkladov závisí od typu zákazky a konkrétneho prípadu.'],
  ['Objem odpadu', 'Dôležitý je stav materiálu, balenie a množstvo odpadu pripraveného na odvoz.'],
] as const;

export default function AsbestosPricePage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Cena likvidácie azbestu', path: '/cena-likvidacie-azbestu/' }} hideWhatsappOnMobile>
      <PublicFontPreload />
      <main className="seo-page price-seo-page">
        <JsonLd data={[buildServiceJsonLd('Cena likvidácie azbestu a eternitu', `Cena závisí od výmery, typu materiálu, prístupu, lokality, dokumentácie a objemu odpadu. ${transportPolicy.full}`, '/cena-likvidacie-azbestu/'), buildFaqJsonLd(coreFaqs.slice(3, 7))]} />
        <section className="seo-hero price-media-hero">
          <div className="price-hero-copy">
            <p className="eyebrow">Cena</p>
            <h1>Cena likvidácie azbestu a eternitu</h1>
            <p>Cena je individuálna. Pošlite približnú výmeru a lokalitu. Fotky môžu ponuku spresniť, ale nie sú povinné.</p>
            <div className="price-hero-actions">
              <a className="button button-primary" href="/#dopyt">Získať nezáväznú ponuku</a>
              <a className="button button-outline" href="#orientacna-cena">Vypočítať orientačne</a>
            </div>
            <p className="price-hero-note">Fotky sú voliteľné. Bez záväzku.</p>
          </div>
          <figure className="price-hero-photo">
            <Image
              src="/og/cena-strecha-realizacia.jpg"
              alt="Pracovník ASTANA stabilizuje eternitovú strechu pred bezpečnou demontážou"
              width={1200}
              height={630}
              sizes="(max-width: 820px) calc(100vw - 28px), 44vw"
              preload
            />
            <figcaption>Reálna práca ASTANA na eternitovej streche pred demontážou.</figcaption>
          </figure>
        </section>
        <QuickAnswer>
          Cena likvidácie azbestu a eternitu sa nedá zodpovedne určiť jednou sumou bez údajov o zákazke. Závisí od m2,
          typu materiálu, výšky objektu, prístupu, lokality, dokumentácie a objemu odpadu. {transportPolicy.full}
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
            ['Čo poslať', 'približnú výmeru v m2, lokalitu, typ objektu a informáciu o prístupe; fotky, ak ich máte'],
            ['Ako čítať výpočet', 'ako prvú predstavu; rozsah a konečnú cenu potvrdzuje konkrétna ponuka'],
            ['Čo dostanete', 'konkrétnu cenovú ponuku a návrh ďalšieho postupu'],
            ['Prečo voliteľné fotky pomôžu', 'spresnia typ materiálu, výšku, prístup a náročnosť'],
          ]}
        />
        <section className="editorial-situation"><p className="eyebrow">Porovnávajte rovnaký rozsah</p><h2>Rovnaké m² ešte neznamenajú rovnakú zákazku</h2><p>Nízka garáž s voľným príjazdom a vysoký dom v tesnom dvore môžu mať rovnakú plochu krytiny, ale inú prípravu a manipuláciu. Rozdiel je aj medzi celými doskami na streche a poškodeným materiálom už uloženým na pozemku. Preto k výmere pridajte stručný opis prístupu a stavu.</p><p>Pri porovnaní ponúk sa pýtajte na konečnú sumu za dohodnuté práce. Samostatná sadzba za demontáž nevypovedá, či obsahuje balenie, nakládku, odvoz a dokumentáciu. Ak sa pri spresnení zmení rozsah, potvrďte si aj jeho vplyv na ponuku.</p></section>
        <UsefulChecklist title="Čo si v ponuke skontrolovať" items={['Výmeru a konkrétne časti objektu, z ktorých cena vychádza.', 'Rozsah demontáže, balenia, nakládky, odvozu a dokumentácie.', 'Dopravu, individuálne položky a režim DPH.', 'Požadovaný termín a nadväznosť novej strechy; odhad termínu nie je jeho potvrdenie.']} />
        <section className="seo-calculator" id="orientacna-cena">
          <div>
            <p className="eyebrow">Orientačný výpočet</p>
            <h2>Kalkulátor podľa výmery</h2>
            <p>
              Kalkulátor zobrazuje iba orientačný cenový rozsah podľa zadanej výmery v m2. Nejde o konečnú cenovú
              ponuku. {transportPolicy.freeFromThreshold} {transportPolicy.belowThreshold} Výsledok nezahŕňa
              dokumentáciu ani iné individuálne položky; konkrétny rozsah prác a DPH uvedieme až v cenovej ponuke.
            </p>
          </div>
          <div className="price-calculator">
            <label htmlFor="priceArea">Výmera v m2</label>
            <input id="priceArea" data-price-area type="range" min="30" max="500" step="10" defaultValue="120" />
            <output data-price-area-output htmlFor="priceArea">120 m2</output>
            <div className="price-result" aria-live="polite">
              <span>Orientačný cenový rozsah:</span>
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
        <ReadingLinks links={[
          { href: '/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/', title: 'Neviete plochu?', text: 'Bezpečný odhad a jednoduchý príklad sedlovej strechy.' },
          { href: '/poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/', title: 'Podklady k ponuke', text: 'Čo napísať, čo odfotiť a čo pokojne označiť ako neznáme.' },
          { href: '/spolupracujuci-strechari/', title: 'Meníte aj krytinu?', text: 'Ako si dohodnúť nadväznosť s vlastným alebo odporučeným strechárom.' },
        ]} />
        <QuoteCTA title="Chcem presnú cenovú ponuku" />
        <PricePageClient />
      </main>
    </PublicPageShell>
  );
}
