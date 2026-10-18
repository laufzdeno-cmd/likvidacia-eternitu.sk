import type { Metadata } from 'next';
import HomepageClientBoundary from './homepage-client-boundary';
import HomepageDeferredClient from './homepage-deferred-client';
import HomepageDeferredWidgets from './homepage-deferred-widgets';
import HeaderBrandLogo from './header-brand-logo';
import { ResponsiveImage } from '@/src/components/responsive-image';
import {
  heroPhoto,
  getAzbestReference,
  realizationHighlights,
} from '@/src/data/azbestReferences';
import { getSiteContentMap } from '@/src/server/db';
import { cleanSlovakText } from '@/src/server/slovak-text';
import { homeContentDefaults } from '@/src/server/site-content';
import { site } from '@/src/content/site';
import { transportPolicy } from '@/src/content/transport-policy.mjs';
import { serializeJsonLd } from '@/src/lib/json-ld-serialize.mjs';
import { filterHomepageTrustItems, normalizeHomepageCoverageText } from '@/src/lib/homepage-trust-items.mjs';
import './home-critical.css';
import HomeDeferredStyles from './home-deferred-styles';
import styles from './homepage-conversion-layout.module.css';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const heroImage = {
  mobileAvif: '/assets/azbest/hero/azbest-087-mobile-432.avif',
  mobileAvifSrcSet:
    '/assets/azbest/hero/azbest-087-mobile-432.avif 432w, /assets/azbest/hero/azbest-087-mobile-824.avif 824w',
  mobileWebp: '/assets/azbest/hero/azbest-087-mobile-480.webp',
  mobileWebpSrcSet: '/assets/azbest/hero/azbest-087-mobile-480.webp 480w',
  mobileJpgSrcSet: '/assets/azbest/hero/azbest-087-mobile-480.jpg 480w',
  desktopWebp: '/assets/azbest/hero/azbest-087-desktop-900.webp',
  desktopWebpSrcSet:
    '/assets/azbest/hero/azbest-087-desktop-900.webp 900w, /assets/azbest/hero/azbest-087-desktop.webp 1100w',
  desktopJpg: '/assets/azbest/hero/azbest-087-desktop-900.jpg',
  desktopJpgSrcSet:
    '/assets/azbest/hero/azbest-087-desktop-900.jpg 900w, /assets/azbest/hero/azbest-087-desktop.jpg 1100w',
} as const;

const homepageHighlights = realizationHighlights
  .filter((item) => ['azbest-164', 'azbest-120', 'azbest-110'].includes(item.image.id))
  .slice(0, 3)
  .map((item) => item.image.id === 'azbest-120' ? {
    ...item,
    title: 'Práce na hospodárskej budove',
    image: {
      ...getAzbestReference('azbest-057'),
      title: 'Práce na streche hospodárskej budovy',
      alt: 'Dlhá hospodárska budova s vlnitou strešnou krytinou a pracovníkmi v ochranných oblekoch.',
    },
  } : item);

type VisualIconName =
  | 'shield' | 'document' | 'truck' | 'clock' | 'euro' | 'map'
  | 'warning' | 'check' | 'home' | 'waste' | 'tools'
  | 'calendar' | 'lock' | 'spray' | 'alert' | 'certificate';

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
  'Oznámenie prác a podklady pre RÚVZ',
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
  ['Firma ASTANA pôsobí od roku 2011', 'Pôsobíme na trhu od roku 2011.'],
  ['Pôsobíme po celej SR', 'Zákazky riešime podľa lokality a kapacity'],
  [transportPolicy.title, transportPolicy.full],
  ['RÚVZ / OÚŽP ku konkrétnej stavbe', 'Postup riešime legálne, nie iba všeobecným sľubom'],
  ['Doklady po likvidácii', 'Potvrdenie / dokumentácia po úhrade'],
] satisfies [string, string][];

const transportPolicyDisclosure = [
  transportPolicy.title,
  transportPolicy.full,
] satisfies [string, string];

function containsTransportPolicyClaim(value: string) {
  return /doprava/i.test(value)
    && /(?:100\s*m|zadarmo|zdarma|neúčtujeme|bezplatn|podľa zákazky|samostatne uvedená)/i.test(value);
}

function normalizeTransportDisclosureText(value: string) {
  return containsTransportPolicyClaim(value) ? transportPolicy.full : value;
}

function normalizeTransportTrustItems(items: Array<[string, string]>) {
  return items.map(([title, text]) => (
    containsTransportPolicyClaim(`${title} ${text}`)
      ? transportPolicyDisclosure
      : [title, text] satisfies [string, string]
  ));
}

const defaultProcessSteps = [
  ['Zadáte m2 a údaje', 'Uveďte približnú výmeru, lokalitu a typ materiálu.'],
  ['Priložíte fotky, ak ich máte', 'Fotky pomôžu spresniť prístup, výšku, stav strechy a náročnosť.'],
  ['Pripravíme cenovú ponuku', 'Na základe m2 a údajov pripravíme nezáväznú cenovú ponuku.'],
  ['Po objednávke vybavíme dokumentáciu a termín', 'Pripravíme potrebný postup, doklady a dohodneme realizáciu.'],
  ['Zrealizujeme demontáž, odvoz a odovzdáme doklady', 'Materiál stabilizujeme, zabalíme, odvezieme a po ukončení odovzdáme dokumentáciu.'],
] satisfies [string, string][];

const defaultRooferItems = [
  ['Zladenie termínu', 'Práce plánujeme v pracovných dňoch od 8:00 do 18:00. Konkrétny čas nástupu dohodneme podľa lokality, počasia a nadväznosti so strechármi.'],
  ['Sledujeme počasie', 'Termín plánujeme s ohľadom na počasie, rozsah prác a nadväznosť strechárskych prác.'],
  ['Bez zhadzovania eternitu', 'Materiál demontujeme kontrolovane. Nezhadzujeme eternit zo strechy a nevytvárame zbytočný chaos na stavbe.'],
  ['Stabilizácia materiálu', 'Pred manipuláciou sa materiál stabilizuje, aby sa znížilo riziko uvoľňovania prachu.'],
  ['Pomoc so strechárom', 'Ak nemáte svojho strechára, môžete si vybrať partnera podľa regiónu alebo o odporúčanie požiadať v cenovej ponuke.'],
  ['Platba po dokončení', 'Pri bežných zákazkách nevyžadujeme platbu vopred za samotnú realizáciu. Platba prebieha po dokončení podľa dohodnutého rozsahu.'],
] satisfies [string, string][];

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
    'Treba na práce povolenie od RÚVZ?',
    'Pri plánovanom odstraňovaní azbestu držiteľ oprávnenia písomne oznamuje práce príslušnému RÚVZ najmenej 30 dní vopred a predkladá požadované podklady. Ide o oznámenie, nie o žiadosť o povolenie. ASTANA pripraví postup ku konkrétnej stavbe a po dokončení odovzdá dohodnuté doklady vrátane potvrdenia o likvidácii.',
  ],
  [
    'Stačí, že firma má oprávnenie na odstraňovanie azbestu?',
    'Je potrebné overiť, či rozsah oprávnenia zodpovedá konkrétnemu typu prác a či firma pripraví oznámenie a podklady ku konkrétnej stavbe.',
  ],
  [
    'Čo ak neviem presnú výmeru?',
    'Stačí približná výmera v m2. Ak neviete presne, uveďte odhad. Presné m2 sa overia podľa skutočnosti a rozsahu prác.',
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
    'Áno. Práce plánujeme v pracovných dňoch od 8:00 do 18:00 a konkrétny čas nástupu dohodneme podľa lokality, počasia a nadväznosti so strechárom.',
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
    ],
  };
}

export const revalidate = 300;

export default async function HomePage() {
  const rawContent = await getSiteContentMap(homeContentDefaults);
  const normalizedContent = Object.fromEntries(
    Object.entries(rawContent).map(([key, value]) => [key, cleanSlovakText(value)]),
  ) as Record<keyof typeof homeContentDefaults, string>;
  const content: typeof homeContentDefaults = {
    ...homeContentDefaults,
    ...normalizedContent,
    whyCoverageText: normalizeTransportDisclosureText(
      normalizeHomepageCoverageText(normalizedContent.whyCoverageText ?? homeContentDefaults.whyCoverageText),
    ),
    riskEyebrow: rawContent.riskEyebrow === 'Prečo odborný postup' ? 'Bezpečný postup' : rawContent.riskEyebrow,
  };
  const includedItems = parseLines(content.includedItems, defaultIncludedItems);
  const includedGroups = [
    {
      title: 'Úrady a dokumentácia',
      items: includedItems.slice(0, 3),
    },
    {
      title: 'Bezpečná práca na stavbe',
      items: includedItems.slice(3, 6),
    },
    {
      title: 'Odvoz a doklady',
      items: includedItems.slice(6),
    },
  ].filter((group) => group.items.length > 0);
  const trustItems = normalizeTransportTrustItems(
    filterHomepageTrustItems(parsePairs(content.trustItems, defaultTrustItems)),
  );
  const processSteps = parsePairs(content.processSteps, defaultProcessSteps);
  const rooferItems = parsePairs(content.rooferItems, defaultRooferItems);
  const faq = parsePairs(content.faqItems, defaultFaq);
  const jsonLd = buildJsonLd(faq);

  return (
    <>
      <HomeDeferredStyles />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <link
        rel="preload"
        as="image"
        href={heroImage.mobileAvif}
        imageSrcSet={heroImage.mobileAvifSrcSet}
        imageSizes="100vw"
        type="image/avif"
        media="(max-width: 767px)"
        fetchPriority="high"
      />
      <link rel="preload" as="image" href={heroImage.desktopWebp} type="image/webp" media="(min-width: 768px)" fetchPriority="high" />
      <header className="site-header" id="top">
        <div className="header-main">
          <a className="brand" href="/" aria-label="ASTANA - likvidácia azbestu a eternitu">
            <HeaderBrandLogo />
            <span>
              <small>Bezpečná likvidácia azbestu</small>
            </span>
          </a>
          <div className="header-meta" role="group" aria-label="Kontaktné údaje">
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
          <a href="/postup/">Ako to prebieha</a>
          <a href="/strechari/">Strechári</a>
          <a href="/realizacie/">Realizácie</a>
          <a href="/recenzie/">Recenzie</a>
          <a href="/faq/">FAQ</a>
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
                <span className="button-phone" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 2.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L6.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 20 16.92z" />
                  </svg>
                </span>
                {content.ctaPhone}
              </a>
            </div>
            <p className="hero-microcopy">Fotky sú voliteľné · Bez záväzku</p>
            <div className="hero-counters" role="group" aria-label="Základné údaje o ASTANA">
              <div className="hero-counter-item">
                <strong>Od 2011</strong>
                <span>pôsobíme na trhu</span>
              </div>
              <div className="hero-counter-item">
                <strong>Celé Slovensko</strong>
                <span>pôsobnosť</span>
              </div>
              <div className="hero-counter-item">
                <strong>Doklady</strong>
                <span>po likvidácii</span>
              </div>
            </div>
            <a className="hero-real-note" href="/realizacie/">Ukážky reálnych striech ASTANA.</a>
            <a className="hero-review-note" href="/recenzie/">Prečítajte si, ako overujeme referencie zákazníkov.</a>
          </div>

          <div className="hero-photo real-hero-photo" role="group" aria-label="Reálna realizácia ASTANA pri stabilizácii eternitovej strechy">
            <picture>
              <source media="(max-width: 767px)" srcSet={heroImage.mobileAvifSrcSet} sizes="100vw" type="image/avif" />
              <source media="(max-width: 767px)" srcSet={heroImage.mobileWebpSrcSet} sizes="100vw" type="image/webp" />
              <source media="(max-width: 767px)" srcSet={heroImage.mobileJpgSrcSet} sizes="100vw" type="image/jpeg" />
              <source srcSet={heroImage.desktopWebpSrcSet} sizes="34vw" type="image/webp" />
              <source srcSet={heroImage.desktopJpgSrcSet} sizes="34vw" type="image/jpeg" />
              <img
                src={heroImage.desktopJpg}
                alt={heroPhoto.alt}
                title={heroPhoto.title}
                width={720}
                height={525}
                loading="eager"
                decoding="sync"
                fetchPriority="high"
              />
            </picture>
            <div className="mobile-hero-overlay" aria-hidden="true">
              <p className="mobile-hero-eyebrow">{content.heroEyebrow}</p>
              <p className="mobile-hero-title">{content.heroTitle}</p>
            </div>
            <div className="hero-real-caption">
              <div className="hero-trust-card">
                <div>
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75A11.959 11.959 0 0 1 12 2.714Z" />
                  </svg>
                  <strong>Legálna likvidácia</strong>
                </div>
                <span>RÚVZ informujeme · OÚŽP · Doklady</span>
              </div>
              <strong>Reálne realizácie ASTANA</strong>
              <span>Stabilizácia, demontáž, balenie a odvoz.</span>
            </div>
          </div>

        </section>

        <section className={`trust-bar ${styles.trustSection}`} id="preco" aria-labelledby="why-title">
          <h2 id="why-title" className={styles.trustTitle}>{content.whyTitle}</h2>
          {trustItems.map(([title, text], index) => (
            <div className="trust-item" key={title}>
              <span className={`line-icon ${['shield', 'map', 'document', 'truck', 'certificate'][index] || 'shield'}`} aria-hidden="true"></span>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          ))}
        </section>

        <section className={`price-calculator-section ${styles.calculator}`} id="orientacna-cena" aria-labelledby="price-calculator-title">
          <div className="price-calculator-copy">
            <p className="eyebrow">Orientačný cenový rozsah</p>
            <h2 id="price-calculator-title">Koľko môže stáť likvidácia?</h2>
            <p>
              Vyberte výmeru a materiál. Presnú cenu vám potvrdíme v nezáväznej ponuke.
            </p>
            <p className={styles.calculatorNote}>
              Bez záväzkov · Ponuka do 24 hodín
            </p>
          </div>
          <div className="price-calculator-card" data-price-calculator>
            <div className="price-area-row">
              <label htmlFor="price-area">Približná výmera</label>
              <output htmlFor="price-area" data-price-area-output>120 m2</output>
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
              <button type="button" className="is-active" data-price-material="vlnity" aria-pressed="true">Vlnitý eternit</button>
              <button type="button" data-price-material="hladky" aria-pressed="false">Hladký eternit</button>
              <button type="button" data-price-material="boleticky" aria-pressed="false">Boletické panely</button>
              <button type="button" data-price-material="neviem" aria-pressed="false">Neviem posúdiť</button>
            </div>
            <div className="price-result" aria-live="polite">
              <span>Orientačný cenový rozsah</span>
              <strong><span data-price-min>960 €</span> – <span data-price-max>1 680 €</span></strong>
              <small>
                Nejde o konečnú cenu. {transportPolicy.freeFromThreshold} {transportPolicy.belowThreshold}{' '}
                Dokumentáciu, individuálne položky a režim DPH určí až konkrétna cenová ponuka.
              </small>
            </div>
            <a className="button button-primary" data-price-quote href="#dopyt">Preniesť údaje do dopytu</a>
          </div>
        </section>

        <section className="quote-section" id="dopyt" aria-labelledby="quote-title">
          <div className="quote-section-inner">
            <div className="quote-info-panel">
              <div className="quote-panel-main">
              <p className="eyebrow">Rýchla cenová ponuka</p>
              <h2>Nezáväznú ponuku pošleme do 24 hodín</h2>
              <p>
                Nezáväznú cenovú ponuku vám pošleme čo najskôr, najneskôr do 24 hodín.
              </p>
              <ul>
                <li><VisualIcon name="check" className="quote-panel-icon" />Bez záväzku a bez automatickej objednávky</li>
                <li><VisualIcon name="check" className="quote-panel-icon" />Fotky sú voliteľné, ale výrazne pomôžu</li>
                <li><VisualIcon name="check" className="quote-panel-icon" />Ponuku pošleme na váš email</li>
              </ul>
              <a className="quote-panel-phone" href="tel:+421905217946">0905 217 946</a>
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
            <p className="quote-form-summary">Jeden formulár · 7 povinných údajov · približne 1 minúta</p>
            <form className="lead-form" action="/api/dopyt/" method="post" encType="multipart/form-data">
              <input
                className="hp-field"
                type="text"
                name="companyWebsite"
                tabIndex={-1}
                autoComplete="new-password"
                aria-hidden="true"
                data-submit-disabled="true"
                disabled
              />
              <input id="submissionId" type="hidden" name="submissionId" value="" />
              <input id="selectedRooferId" type="hidden" name="selectedRooferId" value="" />
              <div className="form-stage form-stage-priority" aria-labelledby="lead-step-1-title">
                <h3 id="lead-step-1-title" className="form-stage-title">O streche a lokalite</h3>
                <p className="form-step-assurance">Všetko je v jednom formulári. Povinné sú len polia s hviezdičkou.</p>
                <div className="field area-field">
                  <label htmlFor="areaEstimate">Približná výmera v m2 *</label>
                  <input id="areaEstimate" name="areaEstimate" type="number" inputMode="numeric" min="1" placeholder="napr. 120" required />
                  <p className="field-help">Ak neviete presne, uveďte odhad. Presné m2 sa overia podľa skutočnosti.</p>
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

              <div className="form-stage" aria-labelledby="lead-step-2-title">
                <h3 id="lead-step-2-title" className="form-stage-title">Doplňujúce údaje</h3>
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
                <div className={`${styles.rooferRecommendation} field field-full`} id="roofer-recommendation-field" hidden>
                  <label htmlFor="roofer-recommendation-opt-in">
                    <input id="roofer-recommendation-opt-in" type="checkbox" />
                    <span>
                      <strong>Chcem, aby mi ASTANA pomohla nájsť strechára v mojom regióne.</strong>
                      <small>Odporúčanie preveríme podľa regiónu a kapacity. Vaše údaje neposielame strechárovi automaticky.</small>
                    </span>
                  </label>
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

              <div className="form-stage" aria-labelledby="lead-step-3-title">
                <h3 id="lead-step-3-title" className="form-stage-title">Kontakt na vás</h3>
                <fieldset className="field field-full contact-preference">
                  <legend>Ako vás máme prednostne kontaktovať?</legend>
                  <label><input type="radio" name="preferredContact" value="Zavolajte mi" defaultChecked /><span>Zavolať mi</span></label>
                  <label><input type="radio" name="preferredContact" value="Napíšte mi email" /><span>Napísať mi email</span></label>
                  <p className="field-help">Vyberte, či vám máme prednostne zavolať alebo napísať. Cenovú ponuku vám pošleme na uvedený email.</p>
                </fieldset>
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

              <div className="form-stage form-stage-files" aria-labelledby="lead-step-4-title">
                <h3 id="lead-step-4-title" className="form-stage-title">Fotky a poznámka (voliteľné)</h3>
                <div className="field file-field field-full">
                  <label htmlFor="photos">Fotky (voliteľné)</label>
                  <label className="file-drop" htmlFor="photos">
                    <span className="file-drop-icon" aria-hidden="true"></span>
                    <strong>Nahrať fotky</strong>
                    <span>Voliteľné, pomôžu spresniť ponuku.</span>
                  </label>
                  <input
                    className="file-input"
                    id="photos"
                    name="photos"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    multiple
                  />
                  <p className="field-help">Najviac 10 fotiek po 10 MB. JPG, JPEG, PNG alebo WEBP do 50 megapixelov. Fotku z iPhonu uložte ako JPG.</p>
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

        <section className={styles.rooferHelp} aria-labelledby="roofer-help-title">
          <div>
            <p className={styles.rooferHelpEyebrow}>Nadväzujúce práce</p>
            <h2 id="roofer-help-title">Potrebujete po eternite aj novú strechu?</h2>
          </div>
          <div className={styles.rooferHelpGrid}>
            <article>
              <h3>Mám strechára</h3>
              <p>Termín demontáže vieme zladiť s vašou strechárskou partiou, aby mohla plynulo pokračovať novou strechou.</p>
            </article>
            <article>
              <h3>Nemám strechára</h3>
              <p>Podľa regiónu a kapacity môžeme preveriť spolupracujúceho strechára. Výber aj dohoda zostávajú vždy na vás.</p>
              <a className="button button-outline" href="/?wantsRooferRecommendation=true#dopyt">Chcem pomôcť so strechárom</a>
            </article>
          </div>
        </section>

        <section className="section real-work-section" id="realizacie-astana" aria-labelledby="real-work-title">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">{content.realizationsEyebrow}</p>
              <h2 id="real-work-title">{content.realizationsTitle}</h2>
            </div>
            <p>{content.realizationsText}</p>
          </div>
          <div className={`real-work-grid ${styles.gallery}`}>
            {homepageHighlights.map((item) => (
              <article className="real-work-card" data-home-gallery-card data-category={item.category} key={item.title}>
                <ResponsiveImage
                  image={item.image}
                  className="real-work-picture"
                  loading="lazy"
                  width={720}
                  height={520}
                  sizes="(max-width: 1023px) 100vw, 33vw"
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

        <section className={`section ${styles.section}`} id="cena" aria-labelledby="included-title">
          <div className="section-heading">
            <p className="eyebrow">{content.includedEyebrow}</p>
            <h2 id="included-title">{content.includedTitle}</h2>
            <p className="section-intro">{content.includedText}</p>
          </div>
          <div className={styles.serviceGroups}>
            {includedGroups.map((group) => (
              <div key={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className={styles.subsection} id="ako-to-prebieha">
            <h3 id="process-title">{content.processTitle}</h3>
            <ol className={styles.steps}>
              {processSteps.map(([title, text]) => (
                <li key={title}>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.subsection} id="strechari">
            <h3 id="roofers-title">{content.roofersTitle}</h3>
            <p>{content.roofersText}</p>
            <dl className={styles.notes}>
              {rooferItems.filter((_, index) => index === 0 || index === 1 || index === 4).map(([title, text]) => (
                <div key={title}>
                  <dt>{title}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
            <div className="real-work-actions">
              <a className="button button-outline" href="/strechari/#registracia">Ste strechár? Zaregistrujte sa →</a>
              <a className="button button-primary" href="#dopyt">{content.roofersCtaSecondary}</a>
            </div>
          </div>
        </section>

        <section className={`section ${styles.section}`} id="azbest" aria-labelledby="risk-title">
          <div className="section-heading">
            <p className="eyebrow">{content.riskEyebrow}</p>
            <h2 id="risk-title">{content.riskTitle}</h2>
            <p className="section-intro">{content.riskText}</p>
          </div>
          <div id="doklady-ku-stavbe" className={styles.subsection}>
            <h3 id="caution-title">{content.cautionTitle}</h3>
            <p>{content.riskNoticeText}</p>
            <p>{site.compliance.asbestosRemovalAuthorization.publicVerification}</p>
            <p>
              <a href={site.compliance.uvzAuthorizedCompaniesUrl} target="_blank" rel="noopener noreferrer">Otvoriť aktuálny register ÚVZ SR (IČO 46 157 701)</a>
            </p>
            <p><a href="/postup/">Ako rozoznať legálnu likvidáciu azbestu</a></p>
          </div>
        </section>

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
            <img className="brand-logo" src="/assets/astana-logo.png?surface=header" alt="ASTANA" width="195" height="65" loading="lazy" decoding="async" fetchPriority="low" />
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
          <a href="/likvidacia-azbestu/">Likvidácia azbestu</a>
          <a href="/likvidacia-eternitu/">Likvidácia eternitu</a>
          <a href="/cena-likvidacie-azbestu/">Cena likvidácie</a>
          <a href="/postup/">Postup</a>
          <a href="/faq/">FAQ</a>
          <a href="/realizacie/">Realizácie</a>
          <a href="/recenzie/">Recenzie</a>
          <a href="/o-firme/">O firme</a>
          <a href="/kontakt/">Kontakt</a>
          <a href="/poradna/">Poradňa</a>
          <a href="/strechari/">Pre strechárov</a>
          <a href="/kariera/">Kariéra</a>
        </div>
        <div>
          <h2>Lokality</h2>
          <a href="/likvidacia-azbestu-poprad/">Poprad</a>
          <a href="/likvidacia-azbestu-kosice/">Košice</a>
          <a href="/likvidacia-azbestu-presov/">Prešov</a>
          <a href="/likvidacia-azbestu-zilina/">Žilina</a>
          <a href="/likvidacia-azbestu-bratislava/">Bratislava</a>
          <a href="/likvidacia-azbestu-banska-bystrica/">Banská Bystrica</a>
          <a href="/likvidacia-azbestu-nitra/">Nitra</a>
          <a href="/likvidacia-azbestu-trnava/">Trnava</a>
          <a href="/likvidacia-azbestu-trencin/">Trenčín</a>
        </div>
        <div>
          <h2>Právne</h2>
          <a href="/ochrana-osobnych-udajov/">GDPR</a>
          <a href="/cookies/">Cookies</a>
          <a href="/podmienky-pouzivania/">Podmienky používania</a>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
      </footer>

      <nav className="mobile-sticky-cta" aria-label="Rýchle kontakty" inert>
        <a href="tel:+421905217946">Zavolať</a>
        <a href="#dopyt">Cenová ponuka</a>
      </nav>
      <HomepageClientBoundary />
      <HomepageDeferredClient />
      <HomepageDeferredWidgets />
    </>
  );
}
