import { locationPages, type FaqItem } from '@/src/content/seo-content';
import { site, phoneLink } from '@/src/content/site';
import { buildPageMetadata, QuickAnswer } from '../seo-components';
import { JsonLd, buildFaqJsonLd, buildServiceJsonLd } from '../seo-json-ld';
import { PublicPageShell } from '../public-layout';

const areaFaqs: FaqItem[] = [
  {
    question: 'Prichádza ASTANA aj do nášho okresu?',
    answer: 'Áno. Zákazky riešime po celom Slovensku; miesto výjazdu, rozsah a termín posúdime podľa konkrétnej obce, prístupu a kapacity.',
  },
  {
    question: 'Kedy môžete prísť, ak na nás nadväzuje strechár?',
    answer: 'Pri výmene strechy plánujeme skorý výjazd z Popradu. Po dohode sa vieme dostať na stavbu približne medzi 6:00 a 6:30, aby sa strechár prichádzajúci okolo 8:00 mohol pripraviť na svoju prácu. Presný čas potvrdíme podľa lokality, počasia a rozsahu.',
  },
  {
    question: 'Čo potrebujete vedieť pred potvrdením výjazdu?',
    answer: 'Pomôže obec alebo okres, približná výmera, typ objektu a materiálu, prístup na strechu a informácia, či na demontáž nadväzuje strechár. Fotografie sú užitočné, ale pri prvom dopyte nie sú povinné.',
  },
];

const quickAnswer = 'ASTANA, s.r.o. zabezpečuje likvidáciu azbestu a eternitu po celom Slovensku. Výjazdy plánuje zo sídla v Poprade podľa lokality, rozsahu práce a nadväzujúcich profesií.';

export const metadata = buildPageMetadata({
  title: 'Kde pôsobíme: likvidácia azbestu na Slovensku | ASTANA',
  description: 'Likvidácia azbestu a eternitu po celom Slovensku. Výjazdy z Popradu plánujeme podľa obce a nadväzujúcich prác. Pošlite lokalitu a výmeru na nezáväznú ponuku.',
  path: '/kde-posobime/',
});

export default function ServiceAreaPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Kde pôsobíme', path: '/kde-posobime/' }}>
      <main className="seo-page" id="main-content">
        <JsonLd data={[buildServiceJsonLd('Likvidáciu azbestu riešime po celom Slovensku', quickAnswer, '/kde-posobime/'), buildFaqJsonLd(areaFaqs)]} />
        <section className="seo-hero">
          <p className="eyebrow">Výjazdy po Slovensku</p>
          <h1>Likvidáciu azbestu riešime po celom Slovensku</h1>
          <p>
            ASTANA, s.r.o. má sídlo v Poprade a zákazky plánuje podľa konkrétnej obce, rozsahu práce a kapacity.
            Napíšte nám, kde sa stavba nachádza; termín a logistiku s vami dohodneme vopred.
          </p>
          <div className="seo-hero-actions">
            <a className="button button-primary" href="/#dopyt">Požiadať o nezáväznú ponuku</a>
            <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
          </div>
        </section>

        <QuickAnswer>{quickAnswer}</QuickAnswer>

        <section className="seo-section" aria-labelledby="regional-pages-title">
          <p className="eyebrow">Regionálne informácie</p>
          <h2 id="regional-pages-title">Vyberte oblasť, kde sa nachádza objekt</h2>
          <p className="seo-lead">
            Na každej regionálnej stránke nájdete územný rozsah, údaje potrebné pre ponuku a praktické podmienky
            výjazdu. Uvedené mestá a okresy označujú pôsobnosť, nie pobočky ani potvrdené realizácie.
          </p>
          <div className="seo-card-grid">
            {locationPages.map((location) => (
              <article key={location.slug}>
                <h3>{location.name}</h3>
                <p>{location.coverageHeading}: {location.coverageAreas.join(', ')}.</p>
                <a href={`/likvidacia-azbestu-${location.slug}/`}>
                  Praktické informácie pre oblasť {location.name}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="seo-section" aria-labelledby="area-planning-title">
          <p className="eyebrow">Nadväznosť prác</p>
          <h2 id="area-planning-title">Pri streche plánujeme aj čas strechárov</h2>
          <p className="seo-lead">
            Pri výmene strechy vyrážame z Popradu skoro ráno. Po dohode plánujeme príchod na stavbu približne medzi
            6:00 a 6:30, aby sa strechár, ktorý prichádza okolo 8:00, mohol pripraviť na nadväzujúcu prácu.
          </p>
          <p>
            Presný čas potvrdíme podľa obce, prístupu, rozsahu demontáže a počasia. Skorý príchod preto nie je
            automatický sľub pre každú lokalitu; dohodneme ho pri konkrétnej zákazke.
          </p>
          <p><a href="/postup/#nadvazujuca-strecha">Pozrite si, ako koordinujeme prácu so strechárom</a>.</p>
        </section>

        <section className="seo-section" aria-labelledby="area-request-title">
          <p className="eyebrow">Rýchle posúdenie</p>
          <h2 id="area-request-title">Čo nám poslať, aby sme vedeli naplánovať výjazd</h2>
          <div className="seo-card-grid">
            <article>
              <h3>Miesto a rozsah</h3>
              <p>Stačí obec alebo okres a približná výmera. Presnú adresu neposielajte do verejných recenzií ani fotografií.</p>
            </article>
            <article>
              <h3>Stavba a materiál</h3>
              <p>Uveďte typ objektu a materiál, ak ho poznáte. Fotografie strechy alebo odpadu pomôžu spresniť prvé posúdenie.</p>
            </article>
            <article>
              <h3>Nadväzujúce práce</h3>
              <p>Ak máte strechára alebo dohodnutý termín ďalšej profesie, napíšte nám to už v dopyte.</p>
            </article>
          </div>
          <p className="seo-lead">
            Pôsobnosť po celom Slovensku znamená, že výjazdy organizujeme z Popradu; neznamená to miestne pobočky
            v každom kraji. Dostupnosť a podmienky potvrdíme po posúdení vašej stavby.
          </p>
        </section>

        <section className="seo-section" aria-labelledby="area-faq-title">
          <h2 id="area-faq-title">Otázky k výjazdu a lokalite</h2>
          <div className="seo-card-grid">
            {areaFaqs.map((item) => (
              <article key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="seo-section" aria-label="Nezáväzný dopyt">
          <h2>Naplánujme postup podľa vašej obce</h2>
          <p className="seo-lead">Pošlite lokalitu, približnú výmeru a informáciu o strechárovi. Cenovú ponuku pripravíme nezáväzne.</p>
          <a className="button button-primary" href="/#dopyt">Získať cenovú ponuku</a>
        </section>
      </main>
    </PublicPageShell>
  );
}
