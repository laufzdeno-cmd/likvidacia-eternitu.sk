import { getAzbestReference } from '@/src/data/azbestReferences';
import { site, phoneLink } from '@/src/content/site';
import type { FaqItem } from '@/src/content/seo-content';
import { buildPageMetadata, InternalLinks } from '../seo-components';
import { JsonLd, buildFaqJsonLd, buildServiceJsonLd } from '../seo-json-ld';
import { PublicPageShell } from '../public-layout';

const heroPhoto = getAzbestReference('azbest-164');
const roofPhoto = getAzbestReference('azbest-051');
const packingPhoto = getAzbestReference('azbest-121');
const sitePhoto = getAzbestReference('azbest-068');

const processFaqs: FaqItem[] = [
  {
    question: 'Je eternit nebezpečný?',
    answer:
      'Eternit môže byť problém najmä vtedy, ak obsahuje azbest a pri manipulácii sa láme, reže alebo inak poškodzuje. Preto je dôležitá stabilizácia, kontrolovaná demontáž, správne balenie a legálne odovzdanie odpadu.',
  },
  {
    question: 'Obsahuje každý eternit azbest?',
    answer:
      'Nie každý výrobok označovaný ako eternit musí obsahovať azbest. Pri starších strešných a obkladových materiáloch však treba s možným obsahom azbestu počítať a postupovať opatrne.',
  },
  {
    question: 'Môžem eternit odstrániť svojpomocne?',
    answer:
      'Pri materiáloch s možným obsahom azbestu nejde iba o zloženie krytiny. Treba vyriešiť bezpečnú manipuláciu, balenie, odvoz ako nebezpečný odpad a súvisiacu dokumentáciu, preto je vhodné najprv sa poradiť s oprávnenou firmou.',
  },
  {
    question: 'Čo potrebujete pre cenovú ponuku?',
    answer:
      'Stačí približná výmera v m2, obec alebo okres, typ objektu a fotky materiálu, ak ich máte. Presné meranie ani odborné určenie typu krytiny nie sú podmienkou prvého posúdenia.',
  },
  {
    question: 'Koľko trvá likvidácia?',
    answer:
      'Čas závisí od rozsahu, prístupu, počasia, lokality a potrebného postupu. Samotná práca môže byť pri menšej streche krátka, príprava a dokumentácia sa však nastavujú podľa konkrétnej zákazky.',
  },
  {
    question: 'Potrebujem povolenie?',
    answer:
      'Konkrétny postup a potrebné podklady sa odvíjajú od stavby, rozsahu prác a príslušných úradov. Pred demontážou preto posúdime zákazku a pripravíme postup podľa konkrétneho prípadu.',
  },
  {
    question: 'Čo ak už mám strechára?',
    answer:
      'Je to v poriadku. Strechár môže riešiť novú strechu a ASTANA samostatne odbornú demontáž, balenie a odvoz materiálu s možným obsahom azbestu. Termín a nadväznosť prác si dohodneme podľa stavby.',
  },
  {
    question: 'Čo dostanem po ukončení?',
    answer:
      'Po ukončení zákazky dostanete potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu a typu práce. Cieľom je, aby bol postup a legálne odovzdanie odpadu preukázateľné.',
  },
];

const processSteps = [
  {
    number: '01',
    label: 'VY',
    title: 'Pošlete nám základné údaje',
    text: 'Do formulára stačí uviesť približnú výmeru, obec alebo okres a typ objektu. Fotky pomôžu, ale ak ich ešte nemáte, dopyt môžete poslať aj bez nich.',
    proof: 'Stačí odhad. Presné meranie vyriešime podľa potreby.',
    cta: true,
  },
  {
    number: '02',
    label: 'ASTANA',
    title: 'Pripravíme konkrétnu cenovú ponuku',
    text: 'Pozrieme sa na výmeru, materiál, prístup a lokalitu. Dostanete zrozumiteľný návrh ceny a ďalšieho postupu bez toho, aby ste museli hádať, čo všetko treba zariadiť.',
    proof: 'Výmera · materiál · prístup · lokalita',
  },
  {
    number: '03',
    label: 'PRED PRÁCOU',
    title: 'Potrebné podklady a úrady riešime my',
    text: 'Po potvrdení zákazky nastavíme potrebný postup a dokumentáciu podľa konkrétnej stavby. To, čo treba vybaviť voči úradom, závisí od rozsahu a prípadu, preto nič nesľubujeme naslepo.',
    proof: 'Postup sa nastavuje ku konkrétnej stavbe.',
  },
  {
    number: '04',
    label: 'NA STAVBE',
    title: 'Prídeme a azbest bezpečne odstránime',
    text: 'Materiál najprv stabilizujeme a potom ho demontujeme kontrolovane, bez zbytočného lámania a zhadzovania. Pracovisko udržiavame organizované aj pre ďalšie profesie.',
    image: roofPhoto,
  },
  {
    number: '05',
    label: 'VÝSLEDOK',
    title: 'Odvezieme odpad a dostanete doklad',
    text: 'Materiál pripravíme na odvoz ako nebezpečný odpad a odovzdáme ho podľa dohodnutého postupu. Po ukončení dostanete potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu zákazky.',
    image: packingPhoto,
  },
] as const;

const workStages = [
  ['Príchod', 'Skontrolujeme prístup a dohodnutý rozsah práce.'],
  ['Príprava pracoviska', 'Vymedzíme priestor a pripravíme bezpečný postup.'],
  ['Stabilizácia', 'Materiál pripravíme na kontrolovanú manipuláciu.'],
  ['Demontáž', 'Krytinu odoberáme postupne, bez zbytočného lámania.'],
  ['Balenie', 'Odpad uložíme do obalov vhodných na ďalšiu manipuláciu.'],
  ['Odvoz', 'Materiál odvezieme na určené miesto podľa zákazky.'],
  ['Čisté odovzdanie', 'Po práci zostane jasné, čo bolo urobené a aký doklad dostanete.'],
] as const;

export const metadata = buildPageMetadata({
  title: 'Ako prebieha likvidácia azbestu a eternitu | Postup ASTANA',
  description:
    'Pozrite si ľudsky vysvetlený postup likvidácie azbestu a eternitu: od výmery a ponuky cez dokumentáciu, demontáž a balenie až po odvoz a doklad.',
  path: '/postup/',
  image: '/og/postup.jpg',
});

export default function ProcessPage() {
  const quickAnswer =
    'Likvidácia azbestu a eternitu začína približnou výmerou, lokalitou a fotkami. ASTANA potom pripraví ponuku, potrebný postup, bezpečnú demontáž, balenie, odvoz a dokumentáciu podľa konkrétnej zákazky.';

  return (
    <PublicPageShell breadcrumb={{ name: 'Postup likvidácie', path: '/postup/' }}>
      <main className="seo-page postup-process-page" id="main-content">
        <JsonLd data={[buildServiceJsonLd('Postup likvidácie azbestu a eternitu', quickAnswer, '/postup/'), buildFaqJsonLd(processFaqs)]} />

        <section className="postup-process-hero" aria-labelledby="postup-page-title">
          <div className="postup-process-hero-copy">
            <p className="eyebrow">Ako to prebieha</p>
            <h1 id="postup-page-title">Vy pošlete pár údajov. My vybavíme zvyšok.</h1>
            <p className="postup-process-hero-context">
              Takto prebieha odborná likvidácia azbestu a eternitu od cenovej ponuky až po odvoz a doklady.
            </p>
            <p className="postup-process-hero-body">
              Vy nám pošlete približnú výmeru, obec a podľa možnosti pár fotiek. ASTANA rieši ponuku, potrebný postup,
              bezpečnú demontáž, balenie, odvoz a súvisiacu dokumentáciu.
            </p>
            <div className="postup-process-actions">
              <a className="button button-primary" href="/#dopyt">Chcem cenovú ponuku</a>
              <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
            </div>
            <p className="postup-process-micro">Stačí približná výmera <span aria-hidden="true">·</span> Fotky sú voliteľné</p>
            <div className="postup-process-trust-row" aria-label="Základné údaje o ASTANA">
              <span><strong>{site.areaServed}</strong><small>Pôsobnosť</small></span>
              <span><strong>ÚVZ SR</strong><small>Verejný register</small></span>
              <span><strong>{site.claimedStats.foundedOrActiveSince.value}</strong><small>Na trhu od</small></span>
            </div>
          </div>
          <figure className="postup-process-hero-media">
            <img src={heroPhoto.jpg} alt={heroPhoto.alt} width="1600" height="1200" fetchPriority="high" decoding="async" />
            <figcaption>Reálna fotografia práce ASTANA na streche</figcaption>
          </figure>
        </section>

        <section className="postup-process-answer" aria-labelledby="postup-answer-title">
          <p className="postup-process-kicker">Rýchla odpoveď</p>
          <h2 id="postup-answer-title">Čo robíte vy a čo preberieme my?</h2>
          <p>{quickAnswer}</p>
        </section>

        <section className="postup-process-section" aria-labelledby="postup-steps-title">
          <div className="postup-process-section-heading">
            <p className="postup-process-kicker">Od prvého dopytu po hotovú zákazku</p>
            <h2 id="postup-steps-title">Vy riešite minimum. My si postrážime odborný postup.</h2>
          </div>
          <div className="postup-process-step-grid">
            {processSteps.map((step) => (
              <article className="postup-process-step" key={step.number}>
                <div className="postup-process-step-top">
                  <span className="postup-process-step-number">{step.number}</span>
                  <span className="postup-process-step-label">{step.label}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {'proof' in step ? <p className="postup-process-proof">{step.proof}</p> : null}
                {'image' in step ? (
                  <figure className="postup-process-step-media">
                    <img src={step.image.jpg} alt={step.image.alt} width="1600" height="1200" loading="lazy" decoding="async" />
                  </figure>
                ) : null}
                {'cta' in step ? <a className="postup-process-inline-cta" href="/#dopyt">Vyplniť cenový dopyt</a> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="postup-process-section postup-process-responsibilities" aria-labelledby="postup-responsibilities-title">
          <div className="postup-process-section-heading">
            <p className="postup-process-kicker">Jasné rozdelenie</p>
            <h2 id="postup-responsibilities-title">Čo zostáva na vás? Prekvapivo málo.</h2>
          </div>
          <div className="postup-process-columns">
            <article>
              <p className="postup-process-column-label">Vy</p>
              <ul>
                <li>približná výmera a obec alebo okres,</li>
                <li>fotky, ak ich máte k dispozícii,</li>
                <li>schválenie cenovej ponuky,</li>
                <li>dohoda o prístupe a termíne.</li>
              </ul>
            </article>
            <article>
              <p className="postup-process-column-label">ASTANA</p>
              <ul>
                <li>konkrétna cenová ponuka a ďalší postup,</li>
                <li>podklady podľa konkrétnej stavby,</li>
                <li>stabilizácia a kontrolovaná demontáž,</li>
                <li>balenie, odvoz a súvisiaca dokumentácia.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="postup-process-section postup-process-timeline-section" aria-labelledby="postup-timeline-title">
          <div className="postup-process-section-heading">
            <p className="postup-process-kicker">Na stavbe</p>
            <h2 id="postup-timeline-title">Čo sa bude diať priamo u vás</h2>
            <p>Konkrétne kroky prispôsobíme stavbe a rozsahu. Základný sled vyzerá takto:</p>
          </div>
          <div className="postup-process-timeline">
            {workStages.map(([title, text], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <figure className="postup-process-wide-proof">
            <img src={sitePhoto.jpg} alt={sitePhoto.alt} width="1600" height="1200" loading="lazy" decoding="async" />
            <figcaption>Kontrolované pracovisko a pripravený postup na streche</figcaption>
          </figure>
        </section>

        <section className="postup-process-roofer" aria-labelledby="postup-roofer-title">
          <div>
            <p className="postup-process-kicker">Nadväzujúca práca</p>
            <h2 id="postup-roofer-title">Meníte zároveň aj strechu?</h2>
            <p>
              Ak máte strechára, povedzte nám to už v dopyte. ASTANA vyrieši odbornú demontáž, balenie a odvoz materiálu
              s možným obsahom azbestu, aby mohol strechár nadviazať svojou prácou.
            </p>
            <p>Pri výmenách striech vyrážame z Popradu skoro ráno, aby sme boli na stavbe spravidla medzi 6:00 a 6:30. Strechár, ktorý prichádza okolo 8:00, sa tak môže pripraviť na nadväzujúcu prácu.</p>
            <p>Ak strechára ešte nemáte, uveďte to vo formulári. ASTANA sa tým nestáva strechárskou firmou.</p>
          </div>
          <a className="button button-primary" href="/#dopyt">Chcem cenovú ponuku</a>
        </section>

        <section className="postup-process-section postup-process-trust" aria-labelledby="postup-trust-title">
          <div className="postup-process-trust-copy">
            <p className="postup-process-kicker">Bezpečnosť a dokumentácia</p>
            <h2 id="postup-trust-title">Na azbest sa nejde len s páčidlom a dodávkou.</h2>
            <p>
              Legálna likvidácia nie je iba rozobratie strechy a odvoz dosiek. Odborný postup začína ešte pred príchodom
              na stavbu a pokračuje správnym zabalením, odvozom a dokladmi.
            </p>
            <ul className="postup-process-checklist">
              <li>oprávnenie firmy na odstraňovanie materiálov s obsahom azbestu,</li>
              <li>postup a podklady ku konkrétnej stavbe,</li>
              <li>bezpečná stabilizácia a kontrolovaná demontáž,</li>
              <li>správne balenie a odvoz nebezpečného odpadu,</li>
              <li>potvrdenie alebo súvisiaca dokumentácia po práci.</li>
            </ul>
            <p className="postup-process-note">
              Konkrétny rozsah podkladov sa určuje podľa stavby, rozsahu prác a rozhodnutia príslušných úradov.{' '}
              <a href={site.compliance.uvzAuthorizedCompaniesUrl} target="_blank" rel="noopener noreferrer">
                Overiť zoznam oprávnených spoločností na ÚVZ SR
              </a>
            </p>
          </div>
          <div className="postup-process-trust-badge" aria-label="Overiteľné údaje ASTANA">
            <strong>ASTANA, s.r.o.</strong>
            <span>IČO: {site.ico}</span>
            <span>Pôsobnosť: {site.areaServed}</span>
            <span>{site.openingHours}</span>
          </div>
        </section>

        <section className="postup-process-duo" aria-label="Doklady a odborný postup">
          <article>
            <p className="postup-process-kicker">Po ukončení</p>
            <h2>Čo dostanete po ukončení</h2>
            <p>
              Dostanete potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu a typu práce. Budete mať jasne zachytené,
              čo sa riešilo a že materiál bol odovzdaný podľa dohodnutého postupu.
            </p>
          </article>
          <article>
            <p className="postup-process-kicker">Prečo opatrne</p>
            <h2>Prečo sa eternit nemá lámať, rezať ani zhadzovať</h2>
            <p>
              Pri poškodení materiálu sa môžu uvoľniť vlákna, ktoré nechceme dostať do vzduchu ani do okolia. Preto materiál
              stabilizujeme, odoberáme kontrolovane a pripravujeme na bezpečné zabalenie a odvoz.
            </p>
          </article>
        </section>

        <section className="postup-process-section postup-process-faq" aria-labelledby="postup-faq-title">
          <div className="postup-process-section-heading">
            <p className="postup-process-kicker">Bez zbytočných omáčok</p>
            <h2 id="postup-faq-title">Časté otázky k postupu</h2>
          </div>
          {processFaqs.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>

        <InternalLinks context="service" />

        <section className="postup-process-final-cta" aria-labelledby="postup-final-cta-title">
          <p className="postup-process-kicker">Prvý krok je jednoduchý</p>
          <h2 id="postup-final-cta-title">Chcete vedieť, koľko bude likvidácia stáť?</h2>
          <p>Pošlite približnú výmeru, obec alebo okres a fotky, ak ich máte. Ozveme sa s konkrétnou ponukou a ďalším postupom.</p>
          <div className="postup-process-actions">
            <a className="button button-primary" href="/#dopyt">Získať cenovú ponuku</a>
            <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}
