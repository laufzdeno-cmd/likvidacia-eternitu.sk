import LandingClient from './landing-client';
import { ResponsiveImage } from '@/src/components/responsive-image';
import {
  heroPhoto,
  realizationHighlights,
} from '@/src/data/azbestReferences';
import reviews from '@/data/reviews.json';
import { getSiteContentMap, listApprovedTestimonials } from '@/src/server/db';
import { homeContentDefaults, homeContentVersion } from '@/src/server/site-content';


const heroCounters = [
  { value: 80000, suffix: '+', label: 'm² zlikvidovaných', start: 0, format: 'locale' },
  { value: 500, suffix: '+', label: 'zákazníkov', start: 0, format: 'locale' },
  { value: 2011, suffix: '', label: 'pôsobíme od roku', start: 1990, format: 'plain' },
] as const;

const realizationFilters = [
  { value: 'vsetky', label: 'Všetky' },
  { value: 'rodinny-dom', label: 'Rodinný dom' },
  { value: 'hospodarska-budova', label: 'Hospodárska budova' },
  { value: 'garaz', label: 'Garáž' },
  { value: 'priemyselny-objekt', label: 'Priemyselný objekt' },
] as const;

const getReviewInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const formatHeroCounterValue = (counter: (typeof heroCounters)[number]) =>
  `${counter.value === 2011 ? counter.value.toString() : counter.value.toLocaleString('sk-SK')}${counter.suffix}`;

const whyCardMeta = [
  { icon: 'shield', title: 'Bezpečný postup' },
  { icon: 'document', title: 'Dokumentácia' },
  { icon: 'truck', title: 'Demontáž aj odvoz' },
  { icon: 'clock', title: 'Skúsenosti od roku 2011' },
  { icon: 'euro', title: 'Jasné nacenenie' },
  { icon: 'map', title: 'Celé Slovensko' },
] as const;

type VisualIconName =
  | (typeof whyCardMeta)[number]['icon']
  | 'warning'
  | 'check'
  | 'home'
  | 'waste'
  | 'tools'
  | 'calendar'
  | 'lock'
  | 'spray'
  | 'alert'
  | 'certificate';

function VisualIcon({ name, className = 'visual-icon' }: { name: VisualIconName; className?: string }) {
  const paths = {
    shield: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75A11.959 11.959 0 0 1 12 2.714Z',
    document: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm-3.75 9h7.5m-7.5 3h7.5m-7.5 3h4.5',
    truck: 'M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V13.5a3.375 3.375 0 0 0-.879-2.277l-1.99-2.211A3.375 3.375 0 0 0 16.5 7.875H14.25V6.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v7.875m12 4.5V7.875m0 10.875h2.25',
    clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    euro: 'M14.25 7.756a4.5 4.5 0 1 0 0 8.488M7.5 10.5h6m-6 3h6',
    map: 'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z',
    warning: 'M12 9v4.5m0 3.75h.008v.008H12v-.008ZM10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z',
    check: 'm4.5 12.75 4.5 4.5 10.5-10.5',
    home: 'm3 10.5 9-7.5 9 7.5M5.25 9.25v10.5h13.5V9.25M9.75 19.75v-6h4.5v6',
    waste: 'M8.25 6.75V5.25A2.25 2.25 0 0 1 10.5 3h3A2.25 2.25 0 0 1 15.75 5.25v1.5m-10.5 0h13.5m-12 0 .75 13.5h9l.75-13.5M10.5 10.5v6m3-6v6',
    tools: 'M14.25 6.087c0 1.242-.504 2.367-1.318 3.182L4.875 17.326a2.121 2.121 0 0 0 3 3l8.057-8.057A4.5 4.5 0 0 0 21.913 6.75l-3.182 3.182-2.121-2.121 3.182-3.182a4.5 4.5 0 0 0-5.542 1.458Z',
    calendar: 'M6.75 3v3m10.5-3v3M3.75 8.25h16.5M5.25 5.25h13.5c.828 0 1.5.672 1.5 1.5v12c0 .828-.672 1.5-1.5 1.5H5.25c-.828 0-1.5-.672-1.5-1.5v-12c0-.828.672-1.5 1.5-1.5Z',
    lock: 'M8.25 10.5V8.25a3.75 3.75 0 1 1 7.5 0v2.25m-9 0h10.5c.828 0 1.5.672 1.5 1.5v7.5c0 .828-.672 1.5-1.5 1.5H6.75c-.828 0-1.5-.672-1.5-1.5V12c0-.828.672-1.5 1.5-1.5Z',
    spray: 'M9.75 6.75h4.5m-3.75 0V3.75h3v3m-6 0h9v4.5h-9v-4.5Zm1.5 4.5-3 8.25h10.5l-3-8.25M6 15.75H3.75m16.5 0H18M5.25 12.75 3 11.25m15.75 1.5L21 11.25',
    alert: 'M12 8.25v5.25m0 3h.008v.008H12V16.5Zm8.25-4.5a8.25 8.25 0 1 1-16.5 0 8.25 8.25 0 0 1 16.5 0Z',
    certificate: 'M7.5 3.75h9A2.25 2.25 0 0 1 18.75 6v12A2.25 2.25 0 0 1 16.5 20.25h-9A2.25 2.25 0 0 1 5.25 18V6A2.25 2.25 0 0 1 7.5 3.75Zm2.25 5.25h4.5m-4.5 3h4.5m-4.5 3h2.25',
  } satisfies Record<VisualIconName, string>;

  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

const defaultIncludedItems = [
  'Podklady pre RÚVZ ku konkrétnej stavbe',
  'Podklady pre OÚŽP / životné prostredie',
  'Dokumentácia k nakladaniu s nebezpečným odpadom',
  'Stabilizácia materiálu',
  'Odborná demontáž',
  'Dekontaminácia pracovného priestoru',
  'Balenie do označených vriec',
  'Odvoz na skládku nebezpečného odpadu',
  'Potvrdenie / dokumentácia po legálnej likvidácii',
];

const defaultTrustItems = [
  ['Od roku 2011', 'Skúsenosti s azbestom a eternitom'],
  ['Pôsobíme po celej SR', 'Zákazky riešime podľa lokality a kapacity'],
  ['RÚVZ / OÚŽP ku konkrétnej stavbe', 'Postup riešime legálne, nie iba všeobecným sľubom'],
  ['Doprava nad 100 m² zdarma', 'Pri väčších zákazkách dopravu neúčtujeme'],
  ['Doklady po likvidácii', 'Potvrdenie / dokumentácia po úhrade'],
] satisfies [string, string][];

const defaultProcessSteps = [
  ['Zadáte m² a údaje', 'Uveďte približnú výmeru, lokalitu a typ materiálu.'],
  ['Priložíte fotky, ak ich máte', 'Fotky pomôžu spresniť prístup, výšku, stav strechy a náročnosť.'],
  ['Pripravíme cenovú ponuku', 'Na základe m² a údajov pripravíme nezáväznú cenovú ponuku.'],
  ['Po objednávke vybavíme dokumentáciu a termín', 'Pripravíme potrebný postup, doklady a dohodneme realizáciu.'],
  ['Zrealizujeme demontáž, odvoz a odovzdáme doklady', 'Materiál stabilizujeme, zabalíme, odvezieme a po ukončení odovzdáme dokumentáciu.'],
] satisfies [string, string][];

const defaultRiskItems = [
  ['Zdravotné riziko', 'Pri neodbornej manipulácii môžu vznikať nebezpečné vlákna a prach.'],
  ['Úradný postup', 'Pri azbeste sa rieši postup a dokumentácia podľa konkrétnej zákazky.'],
  ['Nebezpečný odpad', 'Azbest nepatrí do bežného odpadu. Musí byť správne zabalený a odovzdaný.'],
  ['Doklady', 'Po legálnej likvidácii získate potrebné potvrdenie alebo dokumentáciu.'],
] satisfies [string, string][];

const defaultCautionItems = [
  [
    'Pýtajte si doklady ku konkrétnej stavbe',
    'Nestačí počuť „máme povolenie“. Seriózna firma vie ukázať, že pre vašu stavbu rieši potrebný postup a doklady podľa konkrétneho prípadu.',
  ],
  [
    'Pozor na odpad ponechaný na dvore',
    'Likvidácia nekončí demontážou. Azbestový odpad musí byť zabalený a odvezený na určené miesto.',
  ],
  [
    'Pozor na zhadzovanie eternitu',
    'Materiál sa má demontovať kontrolovane. Zhadzovanie môže zhoršiť riziko prachu, poškodenia a chaosu na stavbe.',
  ],
  [
    'Pozor na cenu bez dokladov',
    'Nízka cena môže znamenať, že v nej nie je zahrnutá dokumentácia, skládka, balenie alebo odvoz.',
  ],
  [
    'Pozor na meškanie termínu',
    'Ak demontáž mešká, strechári čakajú a strecha môže zostať otvorená. Preto termíny plánujeme vopred a sledujeme počasie.',
  ],
  [
    'Pozor na zálohu bez istoty',
    'Pri bežných zákazkách neplatíte vopred za samotnú realizáciu. Platba prebieha po dokončení podľa dohodnutého rozsahu.',
  ],
] satisfies [string, string][];

const defaultRooferItems = [
  ['Zladenie termínu', 'Na stavbu chodíme skoro ráno podľa dohody, aby mohli strechári nadviazať prácou v ten istý deň.'],
  ['Sledujeme počasie', 'Termín plánujeme s ohľadom na počasie, rozsah prác a nadväznosť strechárskych prác.'],
  ['Bez zhadzovania eternitu', 'Materiál demontujeme kontrolovane. Nezhadzujeme eternit zo strechy a nevytvárame zbytočný chaos na stavbe.'],
  ['Stabilizácia materiálu', 'Pred manipuláciou sa materiál stabilizuje, aby sa znížilo riziko uvoľňovania prachu.'],
  ['Pomoc so strechárom', 'Ak nemáte svojho strechára, môžete si vybrať partnera podľa regiónu alebo o odporúčanie požiadať v cenovej ponuke.'],
  ['Platba po dokončení', 'Pri bežných zákazkách nevyžadujeme platbu vopred za samotnú realizáciu. Platba prebieha po dokončení podľa dohodnutého rozsahu.'],
] satisfies [string, string][];

const defaultWhyItems = [
  'Skúsenosti od roku 2011.',
  'Špecializácia na azbest a eternit.',
  'Pôsobíme po celom Slovensku.',
  'Vybavíme dokumentáciu, demontáž, balenie, odvoz aj doklady.',
  'Pomôžeme zladiť termín so strechárom.',
  'Doprava nad 100 m² zdarma.',
];

const defaultFaq = [
  [
    'Je azbest nebezpečný?',
    'Materiály s obsahom azbestu môžu byť problém najmä pri poškodení, lámaní alebo neodbornej manipulácii. Preto je dôležitý odborný postup, stabilizácia, balenie a správne odovzdanie odpadu.',
  ],
  [
    'Môžem eternit odstrániť svojpomocne?',
    'Pri azbeste nejde iba o fyzické odstránenie krytiny. Treba riešiť bezpečnú manipuláciu, balenie, odvoz na určené miesto a doklady.',
  ],
  [
    'Aké doklady si mám vypýtať pred začiatkom prác?',
    'Pýtajte si doklady k vašej konkrétnej stavbe. Podľa typu zákazky môže ísť najmä o podklady alebo posúdenie RÚVZ a dokumentáciu k nakladaniu s nebezpečným odpadom cez OÚŽP / životné prostredie.',
  ],
  [
    'Stačí, že firma má všeobecné oprávnenie na azbest?',
    'Všeobecné oprávnenie je základ. Pri konkrétnej stavbe je však dôležité aj to, či má firma pripravený vhodný postup a dokumentáciu k vašej zákazke.',
  ],
  [
    'Čo ak neviem presnú výmeru?',
    'Stačí približná výmera v m². Ak neviete presne, uveďte odhad. Presné m² sa overia podľa skutočnosti a rozsahu prác.',
  ],
  [
    'Potrebujete fotky?',
    'Fotky sú voliteľné, ale veľmi pomôžu. Podľa nich vieme lepšie posúdiť typ materiálu, prístup, výšku objektu, stav strechy a náročnosť.',
  ],
  [
    'Čo dostanem po likvidácii?',
    'Po riadnom ukončení a úhrade zákazky odovzdávame potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu a typu zákazky.',
  ],
  [
    'Kedy môže začať realizácia?',
    'Termín závisí od rozsahu, lokality, počasia a potrebného úradného postupu. Po potvrdení objednávky dohodneme ďalší postup a časový plán.',
  ],
  [
    'Pomôžete zladiť likvidáciu so strechárom?',
    'Áno. Termín plánujeme tak, aby mohli strechári čo najplynulejšie pokračovať. Sledujeme počasie a pri výmenách striech sa snažíme prísť skoro ráno podľa dohody.',
  ],
] satisfies [string, string][];

function parseLines(value: string | undefined, fallback: string[]) {
  const lines = (value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length ? lines : fallback;
}

function parsePairs(value: string | undefined, fallback: [string, string][]) {
  const pairs = (value || '')
    .split('\n')
    .map((line) => {
      const [title, ...rest] = line.split('|');
      return [title?.trim(), rest.join('|').trim()] as [string, string];
    })
    .filter(([title, text]) => title && text);

  return pairs.length ? pairs : fallback;
}

function buildJsonLd(faq: [string, string][]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://likvidacia-eternitu.sk/#organization',
        name: 'ASTANA',
        legalName: 'ASTANA, s.r.o.',
        url: 'https://likvidacia-eternitu.sk/',
        telephone: '+421905217946',
        email: 'astana@astana.sk',
        foundingDate: '2011',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Scherffelova 1364/28',
          postalCode: '058 01',
          addressLocality: 'Poprad',
          addressCountry: 'SK',
        },
        sameAs: ['https://astana.sk'],
      },
      {
        '@type': 'ProfessionalService',
        '@id': 'https://likvidacia-eternitu.sk/#business',
        name: 'ASTANA - likvidácia azbestu a eternitu',
        url: 'https://likvidacia-eternitu.sk/',
        telephone: '+421905217946',
        email: 'astana@astana.sk',
        areaServed: { '@type': 'Country', name: 'Slovensko' },
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Scherffelova 1364/28',
          postalCode: '058 01',
          addressLocality: 'Poprad',
          addressCountry: 'SK',
        },
      },
      {
        '@type': 'Service',
        '@id': 'https://likvidacia-eternitu.sk/#service',
        name: 'Likvidácia azbestu a eternitu',
        serviceType: 'Odborná demontáž, stabilizácia, balenie, odvoz a dokumentácia',
        provider: { '@id': 'https://likvidacia-eternitu.sk/#organization' },
        areaServed: 'Slovensko',
        description:
          'Odborné odstránenie materiálov obsahujúcich azbest vrátane dokumentácie, stabilizácie materiálu, balenia, odvozu a potvrdenia o legálnej likvidácii.',
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://likvidacia-eternitu.sk/#faq',
        mainEntity: faq.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': 'https://likvidacia-eternitu.sk/#breadcrumbs',
        itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Úvod', item: 'https://likvidacia-eternitu.sk/' }],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://likvidacia-eternitu.sk/#website',
        name: 'Likvidácia azbestu a eternitu ASTANA',
        url: 'https://likvidacia-eternitu.sk/',
        publisher: { '@id': 'https://likvidacia-eternitu.sk/#organization' },
      },
    ],
  };
}

export const revalidate = 300;

async function getHomepageTestimonials() {
  try {
    return await listApprovedTestimonials(6);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [testimonials, rawContent] = await Promise.all([
    getHomepageTestimonials(),
    getSiteContentMap(homeContentDefaults, { versionKey: 'homepageContentVersion', version: homeContentVersion }),
  ]);
  const content: typeof homeContentDefaults = {
    ...homeContentDefaults,
    ...rawContent,
    riskEyebrow: rawContent.riskEyebrow === 'Prečo odborný postup' ? 'Bezpečný postup' : rawContent.riskEyebrow,
  };
  const includedItems = parseLines(content.includedItems, defaultIncludedItems);
  const includedGroups = [
    {
      title: 'Úrady a dokumentácia',
      text: 'Pripravíme potrebné podklady podľa typu zákazky, aby bol postup riešený ku konkrétnej stavbe.',
      icon: 'document',
      items: includedItems.slice(0, 3),
    },
    {
      title: 'Bezpečná práca na stavbe',
      text: 'Materiál stabilizujeme, demontujeme kontrolovane a po práci riešime čistý pracovný priestor.',
      icon: 'shield',
      items: includedItems.slice(3, 6),
    },
    {
      title: 'Odvoz a doklady',
      text: 'Odpad neostáva na dvore. Po zabalení riešime odvoz a súvisiace potvrdenia podľa rozsahu zákazky.',
      icon: 'truck',
      items: includedItems.slice(6),
    },
  ].filter((group) => group.items.length > 0);
  const trustItems = parsePairs(content.trustItems, defaultTrustItems);
  const processSteps = parsePairs(content.processSteps, defaultProcessSteps);
  const riskItems = parsePairs(content.riskItems, defaultRiskItems);
  const cautionItems = parsePairs(content.cautionItems, defaultCautionItems);
  const rooferItems = parsePairs(content.rooferItems, defaultRooferItems);
  const whyItems = parseLines(content.whyItems, defaultWhyItems);
  const faq = parsePairs(content.faqItems, defaultFaq);
  const jsonLd = buildJsonLd(faq);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="site-header" id="top">
        <div className="header-main">
          <a className="brand" href="/" aria-label="ASTANA - likvidácia azbestu a eternitu">
            <img className="brand-logo" src="/assets/astana-logo.svg" alt="ASTANA" width="195" height="65" />
            <span>
              <small>Bezpečná likvidácia azbestu</small>
            </span>
          </a>
          <div className="header-meta" aria-label="Kontaktné údaje">
            <a className="header-phone" href="tel:+421905217946">
              <span className="meta-icon phone" aria-hidden="true"></span>
              <strong>0905 217 946</strong>
            </a>
            <a className="button button-primary header-button" href="#dopyt">
              Získať cenovú ponuku
            </a>
          </div>
          <button className="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false">
            Menu
          </button>
        </div>
        <nav className="site-nav" id="site-nav" aria-label="Hlavná navigácia">
          <a href="#orientacna-cena">Orientačná cena</a>
          <a href="#ako-to-prebieha">Ako to prebieha</a>
          <a href="/strechari/">Strechári</a>
          <a href="/realizacie/">Realizácie</a>
          <a href="#faq">FAQ</a>
          <a href="#kontakt">Kontakt</a>
          <a className="nav-mobile-phone" href="tel:+421905217946">
            <span className="meta-icon phone" aria-hidden="true"></span>0905 217 946
          </a>
          <a className="nav-mobile-cta" href="#dopyt">Získať cenovú ponuku</a>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">{content.heroEyebrow}</p>
            <h1 id="hero-title">{content.heroTitle}</h1>
            <p className="hero-claim">{content.heroClaim}</p>
            <p className="hero-text">{content.heroText}</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#dopyt">
                {content.ctaPrimary}
              </a>
              <a className="button button-outline" href="tel:+421905217946">
                <span className="button-phone" aria-hidden="true"></span>{content.ctaPhone}
              </a>
            </div>
            <div className="hero-counters" data-hero-counters aria-label="Výsledky ASTANA v číslach">
              {heroCounters.map((counter) => (
                <div className="hero-counter-item" key={counter.label}>
                  <strong
                    data-hero-counter
                    data-counter-target={counter.value}
                    data-counter-start={counter.start}
                    data-counter-suffix={counter.suffix}
                    data-counter-format={counter.format}
                  >
                    {formatHeroCounterValue(counter)}
                  </strong>
                  <span>{counter.label}</span>
                </div>
              ))}
            </div>
            <p className="hero-real-note">Ukážky reálnych striech ASTANA.</p>
          </div>

          <div className="hero-photo real-hero-photo" aria-label="Reálna realizácia ASTANA pri stabilizácii eternitovej strechy">
            <ResponsiveImage
              image={heroPhoto}
              loading="eager"
              fetchPriority="high"
              width={1600}
              height={1120}
              sizes="(max-width: 760px) 100vw, 34vw"
            />
            <div className="hero-trust-card">
              <div>
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75A11.959 11.959 0 0 1 12 2.714Z" />
                </svg>
                <strong>Legálna likvidácia</strong>
              </div>
              <span>RÚVZ · OÚŽP · Doklady</span>
            </div>
            <div className="hero-real-caption">
              <strong>Reálne realizácie ASTANA</strong>
              <span>Stabilizácia, demontáž, balenie a odvoz.</span>
            </div>
          </div>

        </section>

        <section className="quote-section" id="dopyt" aria-labelledby="quote-title">
          <div className="quote-section-inner">
            <div className="quote-info-panel">
              <p className="eyebrow">Rýchle nacenenie</p>
              <h2>Pošlite nám výmeru a fotky. Ozveme sa s ďalším postupom.</h2>
              <p>
                Formulár zostáva krátky. Najdôležitejšia je približná výmera v m², lokalita a kontakt, aby sme vedeli pripraviť reálnu ponuku.
              </p>
              <ul>
                <li><VisualIcon name="check" className="quote-panel-icon" />Bez záväzku a bez automatickej objednávky</li>
                <li><VisualIcon name="check" className="quote-panel-icon" />Fotky sú voliteľné, ale výrazne pomôžu</li>
                <li><VisualIcon name="check" className="quote-panel-icon" />Cenová ponuka odíde až po kontrole</li>
              </ul>
              <a className="quote-panel-phone" href="tel:+421905217946">0905 217 946</a>
              <div className="quote-panel-testimonial" aria-label="Hodnotenie zákazníka">
                <img src="/assets/azbest/jpg/azbest-087.jpg" alt="" loading="lazy" />
                <div className="quote-panel-testimonial-overlay" aria-hidden="true"></div>
                <div className="quote-panel-testimonial-content">
                  <span className="quote-panel-testimonial-stars">★★★★★</span>
                  <p>"Prišli o šiestej ráno, strecha bola hotová do obeda. Odporúčam."</p>
                  <span className="quote-panel-testimonial-author">— M. Fojtík, Košice · Rodinný dom</span>
                </div>
              </div>
            </div>

          <aside className="quote-card" aria-labelledby="quote-title">
            <p className="quote-kicker">{content.quoteKicker}</p>
            <h2 id="quote-title">{content.quoteTitle}</h2>
            <p>{content.quoteIntro}</p>
            <div className="quote-handled">{content.quoteHandled}</div>
            <div className="quote-priority">
              <strong>{content.quotePriorityTitle}</strong>
              <span>{content.quotePriorityText}</span>
            </div>
            <div className="quote-form-progress" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <form className="lead-form" action="/api/lead/" method="post" encType="multipart/form-data" noValidate>
              <input className="hp-field" type="text" name="companyWebsite" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <input id="selectedRooferId" type="hidden" name="selectedRooferId" value="" />
              <div className="form-stage form-stage-priority">
                <p className="form-stage-title">1. Výmera a lokalita</p>
                <div className="field area-field">
                  <label htmlFor="areaEstimate">Približná výmera v m² *</label>
                  <input id="areaEstimate" name="areaEstimate" type="number" inputMode="numeric" min="1" placeholder="napr. 120" required />
                  <p className="field-help">Ak neviete presne, uveďte odhad. Presné m² sa overia podľa skutočnosti.</p>
                </div>
                <div className="field">
                  <label htmlFor="city">Obec / mesto *</label>
                  <input id="city" name="city" type="text" autoComplete="address-level2" placeholder="Obec / mesto *" required />
                </div>
                <div className="field">
                  <label htmlFor="district">Okres</label>
                  <input id="district" name="district" type="text" autoComplete="address-level1" placeholder="Okres" />
                </div>
              </div>

              <div className="form-stage">
                <p className="form-stage-title">2. Typ materiálu a termín</p>
                <div className="field">
                  <label htmlFor="materialType">Typ azbestového materiálu *</label>
                  <select id="materialType" name="materialType" required defaultValue="">
                    <option value="">Vyberte materiál *</option>
                    <option>Vlnitý eternit</option>
                    <option>Hladký / štvorcový eternit</option>
                    <option>Azbestocementové rúry</option>
                    <option>Boletické panely</option>
                    <option>Azbestové obloženie / fasáda</option>
                    <option>Azbest v interiéri</option>
                    <option>Neviem posúdiť</option>
                    <option>Iné</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="objectType">Typ objektu *</label>
                  <select id="objectType" name="objectType" required defaultValue="">
                    <option value="">Typ objektu *</option>
                    <option>Rodinný dom</option>
                    <option>Hospodárska budova</option>
                    <option>Garáž / prístrešok</option>
                    <option>Bytový dom / panelák</option>
                    <option>Administratívna budova</option>
                    <option>Priemyselný objekt</option>
                    <option>Iné</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="roofer">Máte už strechára?</label>
                  <select id="roofer" name="roofer" defaultValue="Nemám strechára">
                    <option>Mám vlastného strechára</option>
                    <option>Nemám strechára</option>
                    <option>Chcem odporučiť strechára podľa regiónu</option>
                    <option>Riešim iba likvidáciu bez novej strechy</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="term">Kedy to chcete riešiť?</label>
                  <select id="term" name="term" defaultValue="Čo najskôr">
                    <option>Čo najskôr</option>
                    <option>Do 1 mesiaca</option>
                    <option>Do 3 mesiacov</option>
                    <option>Mám konkrétny termín</option>
                    <option>Len zisťujem cenu</option>
                  </select>
                </div>
              </div>

              <div className="form-stage">
                <p className="form-stage-title">3. Kontakt</p>
                <div className="field">
                  <label htmlFor="phone">Telefón *</label>
                  <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="Telefón *" required />
                </div>
                <div className="field">
                  <label htmlFor="fullName">Meno a priezvisko *</label>
                  <input id="fullName" name="fullName" type="text" autoComplete="name" placeholder="Meno a priezvisko *" required />
                </div>
                <div className="field field-full">
                  <label htmlFor="email">Email *</label>
                  <input id="email" name="email" type="email" autoComplete="email" placeholder="Email *" required />
                </div>
              </div>

              <div className="form-stage form-stage-files">
                <p className="form-stage-title">4. Fotky voliteľne</p>
                <div className="field file-field field-full">
                  <label htmlFor="photos">Nahrajte fotky</label>
                  <label className="file-drop" htmlFor="photos">
                    <span className="file-drop-icon" aria-hidden="true"></span>
                    <strong>Vybrať fotky zo zariadenia</strong>
                    <span>Fotky sú voliteľné, ale pomôžu nám spresniť typ materiálu, prístup a náročnosť.</span>
                  </label>
                  <input
                    className="file-input"
                    id="photos"
                    name="photos"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.heic,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                    multiple
                  />
                  <p className="field-help">Podporované sú JPG, PNG, WEBP, HEIC alebo PDF. Fotky z mobilu úplne stačia.</p>
                  <div className="file-preview" aria-live="polite"></div>
                </div>
                <div className="field field-full">
                  <label htmlFor="note">Poznámka</label>
                  <textarea id="note" name="note" rows={2} placeholder="Prístup, konkrétny termín, kontakt na strechára..."></textarea>
                </div>
              </div>
              <label className="consent">
                <input type="checkbox" name="gdpr" required /> Súhlasím so spracovaním údajov na vybavenie cenovej ponuky.
              </label>
              <button className="button button-primary form-submit" type="submit">
                {content.formSubmitText}
              </button>
              <p className="form-security">Vaše údaje sú u nás v bezpečí. Použijeme ich iba na spracovanie cenovej ponuky.</p>
              <p className="form-status" role="status" aria-live="polite"></p>
            </form>
          </aside>
          </div>
        </section>

        <section className="trust-bar" aria-label="Dôveryhodné prvky služby">
          {trustItems.map(([title, text], index) => (
            <div className="trust-item" key={title}>
              <span className={`line-icon ${['shield', 'map', 'document', 'truck', 'certificate'][index] || 'shield'}`} aria-hidden="true"></span>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          ))}
        </section>

        <section className="price-calculator-section" id="orientacna-cena" aria-labelledby="price-calculator-title">
          <div className="price-calculator-copy">
            <p className="eyebrow">Orientačná cena</p>
            <h2 id="price-calculator-title">Koľko môže stáť likvidácia?</h2>
            <p>
              Najrýchlejšie sa orientujeme podľa približnej výmery v m². Zadajte plochu a typ materiálu, uvidíte pracovný
              rozsah ceny. Záväznú ponuku pripravíme po overení detailov.
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '12px' }}>
              ✓ Bez záväzkov &nbsp;·&nbsp; ✓ Odpovieme do 24h
              &nbsp;·&nbsp; ✓ Platíte po dokončení
            </p>
          </div>
          <div className="price-calculator-card" data-price-calculator>
            <div className="price-area-row">
              <label htmlFor="price-area">Približná výmera</label>
              <output htmlFor="price-area" data-price-area-output>120 m²</output>
            </div>
            <input
              id="price-area"
              data-price-area
              type="range"
              min="10"
              max="500"
              step="10"
              defaultValue="120"
              aria-label="Približná výmera v metroch štvorcových"
            />
            <div className="price-materials" role="group" aria-label="Typ materiálu">
              <button type="button" className="is-active" data-price-material="vlnity">Vlnitý eternit</button>
              <button type="button" data-price-material="hladky">Hladký eternit</button>
              <button type="button" data-price-material="boleticky">Boletické panely</button>
              <button type="button" data-price-material="neviem">Neviem posúdiť</button>
            </div>
            <div className="price-result" aria-live="polite">
              <span>Orientačná cena</span>
              <strong><span data-price-min>960 €</span> – <span data-price-max>1 680 €</span></strong>
              <small>Presná cena závisí od prístupu, výšky objektu, typu materiálu a rozsahu dokumentácie.</small>
            </div>
            <a className="button button-primary" href="#dopyt">Získať presnú cenovú ponuku</a>
          </div>
        </section>

        <section className="section risk-section asbestos-section" id="azbest" aria-labelledby="risk-title">
          <div className="section-heading">
            <p className="eyebrow">{content.riskEyebrow}</p>
            <h2 id="risk-title">{content.riskTitle}</h2>
            <p className="section-intro">{content.riskText}</p>
          </div>
          <div className="risk-notice">
            <span className="risk-notice-icon"><span style={{ fontSize: 28 }}>🛡️</span></span>
            <div>
              <h3>{content.riskNoticeTitle}</h3>
              <p>{content.riskNoticeText}</p>
            </div>
          </div>
          <div className="risk-grid">
            {riskItems.map(([title, text], index) => (
              <article key={title}>
                <span className="risk-card-icon">
                  <span style={{ fontSize: 28 }}>{(['⚠️', '📋', '🗑️', '✅'] as const)[index] || '⚠️'}</span>
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section caution-section" id="doklady-ku-stavbe" aria-labelledby="caution-title">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">{content.cautionEyebrow}</p>
              <h2 id="caution-title">{content.cautionTitle}</h2>
            </div>
            <p>{content.cautionText}</p>
          </div>
          <div className="caution-grid">
            {cautionItems.map(([title, text], index) => (
              <article key={title}>
                <span className="caution-card-icon">
                  <VisualIcon name={(['certificate', 'waste', 'tools', 'euro', 'calendar', 'lock'] as const)[index] || 'alert'} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section included-section" id="cena" aria-labelledby="included-title">
          <div className="section-heading">
            <p className="eyebrow">{content.includedEyebrow}</p>
            <h2 id="included-title">{content.includedTitle}</h2>
            <p className="section-intro">{content.includedText}</p>
          </div>
          <div className="included-group-grid">
            {includedGroups.map((group) => (
              <article className="included-group-card" key={group.title}>
                <div className="included-group-head">
                  <span className="included-group-icon"><VisualIcon name={group.icon as VisualIconName} /></span>
                  <div>
                    <h3>{group.title}</h3>
                    <p>{group.text}</p>
                  </div>
                </div>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="transport-banner" aria-label="Doprava zdarma nad 100 metrov štvorcových">
          <span className="transport-icon"><VisualIcon name="truck" /></span>
          <strong>Dopravu pri zákazkách nad 100 m² neúčtujeme!</strong>
        </section>

        <section className="section process-section" id="ako-to-prebieha" aria-labelledby="process-title">
          <div className="section-heading">
            <p className="eyebrow">{content.processEyebrow}</p>
            <h2 id="process-title">{content.processTitle}</h2>
            <p className="section-intro">Od prvého odhadu po odvoz a doklady. Kroky držíme jednoduché, aby zákazník vedel, čo sa bude diať a čo má pripraviť.</p>
          </div>
          <ol className="process-list process-stepper">
            {processSteps.map(([title, text], index) => (
              <li key={title}>
                <span className="step-num">{index + 1}</span>
                <div className="process-step-copy">
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="section real-work-section" id="realizacie-astana" aria-labelledby="real-work-title">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">Vybrané realizácie</p>
              <h2 id="real-work-title">Naša práca v praxi</h2>
            </div>
            <p>
              Kurátorovaný výber šiestich záberov: rodinné domy, väčší rozsah, technika, dopravníky, hospodárske objekty aj interiér.
              Plná filtrovaná galéria je na samostatnej stránke realizácií.
            </p>
          </div>
          <div className="realization-filter-pills" data-home-gallery-filters aria-label="Filtrovať realizácie podľa typu objektu">
            {realizationFilters.map((filter, index) => (
              <button
                className={index === 0 ? 'is-active' : undefined}
                type="button"
                data-home-gallery-filter={filter.value}
                aria-pressed={index === 0}
                key={filter.value}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="real-work-grid">
            {realizationHighlights.map((item) => (
              <article className="real-work-card" data-home-gallery-card data-category={item.category} key={item.title}>
                <ResponsiveImage
                  image={item.image}
                  className="real-work-picture"
                  loading="lazy"
                  width={720}
                  height={520}
                  sizes="(max-width: 760px) 100vw, 33vw"
                />
                <div className="real-work-content">
                  <span>Reálna realizácia · {item.type}</span>
                  <h3>{item.title}</h3>
                </div>
              </article>
            ))}
          </div>
          <div className="real-work-actions">
            <a className="button button-primary" href="#dopyt">Chcem naceniť podobnú realizáciu</a>
            <a className="button button-outline" href="/realizacie/">Zobraziť všetky realizácie</a>
          </div>
        </section>

        <section className="section reviews-section" id="recenzie" aria-labelledby="reviews-title">
          <div className="reviews-heading">
            <h2 id="reviews-title">Čo hovoria naši zákazníci</h2>
            <p>Hodnotenia zákazníkov</p>
          </div>
          <div className="reviews-grid">
            {/* TODO: nahradiť reálnymi recenziami z Google Business Profile */}
            {reviews.map((review, index) => (
              <article className="review-card" data-review-extra={index >= 3 ? 'true' : undefined} hidden={index >= 3} key={review.id}>
                <div className="review-stars" aria-label={`${review.stars} z 5`}>{'★'.repeat(review.stars)}</div>
                <p className="review-text">{review.text}</p>
                <footer className="review-author">
                  <span className="review-avatar" aria-hidden="true">{getReviewInitials(review.name)}</span>
                  <div>
                    <strong>{review.name}</strong>
                    <span>{review.location} · {review.object} · {review.date}</span>
                  </div>
                </footer>
              </article>
            ))}
          </div>
          {reviews.length > 3 ? (
            <button className="reviews-toggle" type="button" data-reviews-toggle>
              Zobraziť všetky
            </button>
          ) : null}
          <a className="reviews-google-link" href="https://maps.google.com" target="_blank" rel="noopener">
            Zobraziť recenzie na Google →
          </a>
        </section>

        <section className="section roofers-section" id="strechari" aria-labelledby="roofers-title">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">{content.roofersEyebrow}</p>
              <h2 id="roofers-title">{content.roofersTitle}</h2>
            </div>
            <p>{content.roofersText}</p>
          </div>
          <div className="roofers-grid">
            {rooferItems.map(([title, text], index) => (
              <article key={title}>
                <span className={`line-icon ${['calendar', 'shield', 'truck', 'document', 'certificate', 'map'][index] || 'shield'}`} aria-hidden="true"></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="roofers-actions">
            <a className="button button-outline" href="/strechari/#registracia">Ste strechár? Zaregistrujte sa →</a>
            <a className="button button-primary" href="#dopyt">{content.roofersCtaSecondary}</a>
          </div>
        </section>

        <section className="section why-section" id="preco" aria-labelledby="why-title">
          <div className="why-card">
            <div>
              <p className="eyebrow">{content.whyEyebrow}</p>
              <h2 id="why-title">{content.whyTitle}</h2>
              <p className="why-lead">{content.whyText}</p>
            </div>
            <div className="why-card-grid">
              {whyCardMeta.map((card, index) => (
                <article className="why-feature-card" key={card.title}>
                  <VisualIcon name={card.icon} className="why-card-icon" />
                  <h3>{card.title}</h3>
                  <p>{whyItems[index] || defaultWhyItems[index]}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {testimonials.length ? (
          <section className="section testimonial-section" id="referencie" aria-labelledby="testimonial-title">
            <div className="section-heading split">
              <div>
                <p className="eyebrow">{content.testimonialsEyebrow}</p>
                <h2 id="testimonial-title">{content.testimonialsTitle}</h2>
              </div>
              <p>{content.testimonialsText}</p>
            </div>
            <div className="testimonial-layout">
              <div className="testimonial-grid">
                {testimonials.map((testimonial) => (
                  <article key={testimonial.id} className="testimonial-card">
                    <div className="testimonial-stars" aria-label={`${testimonial.rating} z 5`}>
                      {'★'.repeat(testimonial.rating)}
                    </div>
                    <p>{testimonial.text}</p>
                    <strong>{testimonial.customerName}</strong>
                    {testimonial.location ? <span>{testimonial.location}</span> : null}
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        <section className="section faq-section" id="faq" aria-labelledby="faq-title">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">{content.faqEyebrow}</p>
              <h2 id="faq-title">{content.faqTitle}</h2>
            </div>
            <p>{content.faqText}</p>
          </div>
          <div className="faq-grid">
            {faq.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta" aria-labelledby="final-title">
          <div>
            <p className="eyebrow">{content.finalEyebrow}</p>
            <h2 id="final-title">{content.finalTitle}</h2>
            <p>{content.finalText}</p>
          </div>
          <div className="final-actions">
            <a className="button button-primary" href="#dopyt">{content.finalCtaPrimary}</a>
            <a className="button button-outline" href="tel:+421905217946">{content.ctaPhone}</a>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="kontakt">
        <div>
          <a className="brand footer-brand" href="/" aria-label="ASTANA">
            <img className="brand-logo" src="/assets/astana-logo.svg" alt="ASTANA" width="195" height="65" />
            <span><small>Bezpečná likvidácia azbestu</small></span>
          </a>
          <p>{content.footerText}</p>
        </div>
        <div>
          <h2>Kontakt</h2>
          <span>ASTANA, s.r.o.</span>
          <span>Scherffelova 1364/28</span>
          <span>058 01 Poprad</span>
          <a href="tel:+421905217946">0905 217 946</a>
          <a href="mailto:astana@astana.sk">astana@astana.sk</a>
        </div>
        <div>
          <h2>Firma</h2>
          <span>IČO: 46 157 701</span>
          <span>DIČ: 2023253771</span>
          <span>IČ DPH: SK2023253771</span>
        </div>
        <div>
          <h2>Užitočné</h2>
          <a href="/realizacie/">Realizácie</a>
          <a href={testimonials.length ? '#referencie' : '#realizacie-astana'}>{testimonials.length ? 'Referencie' : 'Prax'}</a>
          <a href="/strechari/">Strechári</a>
          <a href="/ochrana-osobnych-udajov/">GDPR</a>
          <a href="/cookies/">Cookies</a>
          <a href="/podmienky-pouzivania/">Podmienky používania</a>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
      </footer>

      <div className="mobile-sticky-cta" aria-label="Rýchle kontakty">
        <a href="tel:+421905217946">Zavolať</a>
        <a href="#dopyt">Cenová ponuka</a>
      </div>
      <LandingClient />
    </>
  );
}
