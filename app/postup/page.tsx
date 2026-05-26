import type { Metadata } from 'next';
import { PublicPageShell } from '../public-layout';

export const metadata: Metadata = {
  title: 'Ako prebieha likvidácia azbestu | 5 krokov | ASTANA',
  description:
    'Kompletný postup likvidácie azbestu: dokumentácia RÚVZ a OÚ ŽP, stabilizácia penetračným postrekom, demontáž, balenie ADR, odvoz na skládku, záverečné doklady.',
  keywords: 'postup likvidácia azbestu, ako odstrániť azbest, demontáž eternitu, RÚVZ povolenie azbest',
  alternates: { canonical: '/postup/' },
  openGraph: {
    title: 'Ako prebieha likvidácia azbestu | ASTANA',
    description: 'Bezpečný postup likvidácie azbestu v 5 krokoch vrátane dokumentácie, demontáže, odvozu a dokladov.',
    images: ['/og/postup.jpg'],
  },
};

const steps = [
  {
    name: 'Zadáte výmeru a základné údaje',
    text: 'Na začiatku nám pošlete približnú výmeru v m², lokalitu a typ materiálu. Ak máte fotky strechy alebo odpadu, priložíte ich k dopytu. Podľa týchto údajov vieme rýchlo posúdiť rozsah a pripraviť ďalší postup.',
  },
  {
    name: 'Pripravíme cenovú ponuku',
    text: 'Každú zákazku naceníme individuálne podľa konkrétnej situácie. Zohľadňujeme typ materiálu, prístupnosť, výšku objektu, lokalitu a potrebnú dokumentáciu. Ponuku vám pošleme na email a v prípade potreby si detaily telefonicky potvrdíme.',
  },
  {
    name: 'Vybavíme dokumentáciu',
    text: 'Pri azbeste nejde iba o demontáž. Pripravujú sa podklady pre RÚVZ a OÚ ŽP a postup nakladania s nebezpečným odpadom. Dokumentácia chráni zákazníka aj realizáciu pred problémami pri kontrole.',
  },
  {
    name: 'Bezpečne demontujeme a zabalíme materiál',
    text: 'Materiál sa pred manipuláciou stabilizuje vhodným postupom, aby sa minimalizovalo riziko prachu. Demontáž robí odborný personál a odpad sa balí do označených vriec alebo na palety podľa situácie. Na stavbe udržiavame poriadok a postupujeme kontrolovane.',
  },
  {
    name: 'Odvezieme odpad a odovzdáme doklady',
    text: 'Azbestový odpad odvážame na určené miesto pre nebezpečný odpad. Po ukončení zákazky pripravíme záverečnú správu, potvrdenia a súvisiace doklady podľa rozsahu prác. Zákazník tak má preukázateľný doklad o legálnej likvidácii.',
  },
];

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Ako prebieha bezpečná likvidácia azbestu',
  description: 'Postup likvidácie azbestu od prvého dopytu až po odovzdanie dokladov.',
  step: steps.map((step, index) => ({
    '@type': 'HowToStep',
    position: index + 1,
    name: step.name,
    text: step.text,
  })),
};

export default function ProcessPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Ako prebieha likvidácia azbestu', path: '/postup/' }}>
      <main className="seo-page">
        <section className="seo-hero">
          <p className="eyebrow">Postup</p>
          <h1>Ako prebieha bezpečná likvidácia azbestu</h1>
          <p>
            Od prvého dopytu až po doklady. Proces držíme pod kontrolou, aby bola demontáž legálna,
            bezpečná a zladená s ďalšími prácami na streche.
          </p>
        </section>

        <section className="seo-section">
          <div className="seo-step-list">
            {steps.map((step, index) => (
              <article key={step.name} className="seo-step-card">
                <span>{index + 1}</span>
                <h2>{step.name}</h2>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="seo-section seo-grid-2">
          <article>
            <h2>Čo potrebujete pripraviť</h2>
            <p>Pomôže približná výmera, fotky strechy alebo odpadu a základný popis prístupu na pozemok. Ak je to možné, uvoľnite priestor okolo objektu a pod strechou, aby sa dalo bezpečne manipulovať s materiálom.</p>
          </article>
          <article>
            <h2>Dokumentácia po ukončení</h2>
            <p>Po legálnej likvidácii dostanete súvisiace doklady podľa rozsahu zákazky: záverečnú správu, potvrdenie o zneškodnení odpadu a dokumentáciu potrebnú pre prípadnú kontrolu.</p>
          </article>
        </section>

        <section className="seo-cta">
          <h2>Chcete vedieť, čo bude treba pri vašej streche?</h2>
          <p>Pošlite výmeru a fotky. Ozveme sa s ďalším postupom a cenovou ponukou.</p>
          <a className="button button-primary" href="/#dopyt">Získať cenovú ponuku</a>
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
    </PublicPageShell>
  );
}
