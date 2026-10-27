import { locationPages, type FaqItem } from '@/src/content/seo-content';
import { site, phoneLink } from '@/src/content/site';
import { buildPageMetadata } from '../seo-components';
import { JsonLd, buildFaqJsonLd, buildServiceJsonLd } from '../seo-json-ld';
import { PublicPageShell } from '../public-layout';
import { EditorialHero } from '../editorial-components';
import { transportPolicy } from '@/src/content/transport-policy.mjs';

const areaFaqs: FaqItem[] = [
  {
    question: 'Prichádza ASTANA aj do nášho okresu?',
    answer: 'Áno. Zákazky riešime po celom Slovensku; miesto výjazdu, rozsah a termín posúdime podľa konkrétnej obce, prístupu a kapacity.',
  },
  {
    question: 'Kedy môžete prísť, ak na nás nadväzuje strechár?',
    answer: 'Práce plánujeme v pracovných dňoch od 8:00 do 18:00. Pri výmene strechy konkrétny čas nástupu dohodneme podľa lokality, počasia, rozsahu a nadväznosti so strechárom.',
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
    <PublicPageShell breadcrumb={{ name: 'Kde pôsobíme', path: '/kde-posobime/' }} hideWhatsappOnMobile>
      <main className="seo-page" id="main-content">
        <JsonLd data={[buildServiceJsonLd('Likvidáciu azbestu riešime po celom Slovensku', quickAnswer, '/kde-posobime/'), buildFaqJsonLd(areaFaqs)]} />
        <EditorialHero eyebrow="Výjazdy po Slovensku" title="Likvidáciu azbestu riešime po celom Slovensku"
          lead="ASTANA, s.r.o. sídli v Poprade. Zákazky plánujeme podľa konkrétnej obce, rozsahu a dostupnej kapacity. Vyberte oblasť vašej stavby; nájdete v nej podklady dôležité pre výjazd a ponuku."
          photoId="azbest-065" photoAlt="Vozidlo ASTANA pri objekte počas realizácie"
          photoCaption="Výjazd sa pripravuje podľa konkrétnej stavby. Regionálne stránky označujú pôsobnosť, nie sieť pobočiek.">
          <div className="seo-hero-actions">
            <a className="button button-primary" href="/#dopyt">Požiadať o nezáväznú ponuku</a>
            <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
          </div>
        </EditorialHero>
        <section className="editorial-situation"><h2>Doprava, dostupnosť a termín sú tri rôzne otázky</h2><p>{transportPolicy.full} Obec potrebujeme aj pri väčšej ploche, pretože plánujeme trasu, príjazd a nadväznosť ďalších prác. Voľný deň nástupu potvrdíme až po posúdení zákazky.</p><p>Ak sa miesto realizácie líši od vašej kontaktnej adresy, uveďte obec stavby. Pri väčšom areáli alebo neprístupnejšom objekte doplňte aj osobu, ktorá vie vysvetliť vstup a prevádzkové podmienky.</p></section>

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
            Práce plánujeme v pracovných dňoch od 8:00 do 18:00. Pri výmene strechy konkrétny čas nástupu dohodneme
            podľa lokality, počasia, rozsahu a nadväznosti so strechárom.
          </p>
          <p>
              Presný čas nástupu nie je automatický sľub pre každú lokalitu; dohodneme ho pri konkrétnej zákazke
              v rámci pracovných dní od 8:00 do 18:00.
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
