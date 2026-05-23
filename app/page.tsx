import LandingClient from './landing-client';
import { ResponsiveImage } from '@/src/components/responsive-image';
import {
  heroPhoto,
  processPhotoReferences,
  realizationHighlights,
} from '@/src/data/azbestReferences';
import { getSiteContentMap, listApprovedTestimonials } from '@/src/server/db';
import { homeContentDefaults, homeContentVersion } from '@/src/server/site-content';

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

const defaultHeroFlowItems = ['m²', 'Ponuka', 'Dokumentácia', 'Demontáž', 'Odvoz', 'Potvrdenie'];

const defaultHeroBulletItems = [
  'Cenu počítame hlavne podľa m²',
  'Fotky pomôžu spresniť prístup a typ materiálu',
  'Dokumentácia RÚVZ / OÚŽP v procese',
  'Odvoz a doklady po likvidácii',
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
  const [testimonials, content] = await Promise.all([
    getHomepageTestimonials(),
    getSiteContentMap(homeContentDefaults, { versionKey: 'homepageContentVersion', version: homeContentVersion }),
  ]);
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
  const heroFlowItems = parseLines(content.heroFlowItems, defaultHeroFlowItems);
  const heroBulletItems = parseLines(content.heroBulletItems, defaultHeroBulletItems);
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
            <span className="meta-item">
              <span className="meta-icon pin" aria-hidden="true"></span>Pôsobíme po celej SR
            </span>
            <a className="meta-item" href="mailto:astana@astana.sk">
              <span className="meta-icon mail" aria-hidden="true"></span>astana@astana.sk
            </a>
            <a className="header-phone" href="tel:+421905217946">
              <span className="meta-icon phone" aria-hidden="true"></span>
              <strong>0905 217 946</strong>
              <small>Po-Pia 7:00 - 18:00</small>
            </a>
            <a className="button button-primary header-button" href="#dopyt">
              {content.ctaPrimary}
            </a>
          </div>
          <button className="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false">
            Menu
          </button>
        </div>
        <nav className="site-nav" id="site-nav" aria-label="Hlavná navigácia">
          <a href="#top" aria-current="page">
            Úvod
          </a>
          <a href="#azbest">Prečo odborný postup</a>
          <a href="#cena">Čo vybavíme</a>
          <a href="#ako-to-prebieha">Ako to prebieha</a>
          <a href="/strechari/">Strechári</a>
          <a href="#preco">Prečo ASTANA</a>
          <a href="/realizacie/">Realizácie</a>
          <a href={testimonials.length ? '#referencie' : '#realizacie-astana'}>{testimonials.length ? 'Referencie' : 'Prax'}</a>
          <a href="#faq">FAQ</a>
          <a href="#kontakt">Kontakt</a>
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
            <p className="hero-real-note">Ukážky reálnych striech ASTANA.</p>
            <div className="hero-proof-flow" aria-label="Od výmery po potvrdenie">
              {heroFlowItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <ul className="hero-points" aria-label="Ako pripravujeme cenovú ponuku">
              {heroBulletItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
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
            <div className="hero-real-caption">
              <strong>Reálne realizácie ASTANA</strong>
              <span>Stabilizácia, demontáž, balenie a odvoz.</span>
            </div>
          </div>

          <aside className="quote-card" id="dopyt" aria-labelledby="quote-title">
            <p className="quote-kicker">{content.quoteKicker}</p>
            <h2 id="quote-title">{content.quoteTitle}</h2>
            <p>{content.quoteIntro}</p>
            <div className="quote-handled">{content.quoteHandled}</div>
            <div className="quote-priority">
              <strong>{content.quotePriorityTitle}</strong>
              <span>{content.quotePriorityText}</span>
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

        <section className="section risk-section asbestos-section" id="azbest" aria-labelledby="risk-title">
          <div className="section-heading">
            <p className="eyebrow">{content.riskEyebrow}</p>
            <h2 id="risk-title">{content.riskTitle}</h2>
            <p className="section-intro">{content.riskText}</p>
          </div>
          <div className="risk-notice">
            <span className="line-icon certificate" aria-hidden="true"></span>
            <div>
              <h3>{content.riskNoticeTitle}</h3>
              <p>{content.riskNoticeText}</p>
            </div>
          </div>
          <div className="risk-grid">
            {riskItems.map(([title, text]) => (
              <article key={title}>
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
                <span className={`line-icon ${['certificate', 'shield', 'document'][index] || 'document'}`} aria-hidden="true"></span>
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
                  <span className={`line-icon ${group.icon}`} aria-hidden="true"></span>
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
          <span className="line-icon truck" aria-hidden="true"></span>
          <strong>Dopravu pri zákazkách nad 100 m² neúčtujeme!</strong>
        </section>

        <section className="section process-section" id="ako-to-prebieha" aria-labelledby="process-title">
          <div className="section-heading">
            <p className="eyebrow">{content.processEyebrow}</p>
            <h2 id="process-title">{content.processTitle}</h2>
            <p className="section-intro">Od prvého odhadu po odvoz a doklady. Kroky držíme jednoduché, aby zákazník vedel, čo sa bude diať a čo má pripraviť.</p>
          </div>
          <ol className="process-list">
            {processSteps.map(([title, text], index) => (
              <li key={title}>
                <span>{index + 1}</span>
                {processPhotoReferences[index] ? (
                  <ResponsiveImage
                    image={processPhotoReferences[index]!}
                    className="process-photo"
                    width={420}
                    height={300}
                    sizes="(max-width: 760px) 100vw, 18vw"
                  />
                ) : (
                  <div className="process-document-proof" aria-hidden="true">
                    <span className="quote-proof-mark">m²</span>
                    <span className="quote-proof-arrow">→</span>
                    <span className="quote-proof-mark">€</span>
                  </div>
                )}
                <strong>{title}</strong>
                <p>{text}</p>
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
          <div className="real-work-grid">
            {realizationHighlights.map((item) => (
              <article className="real-work-card" key={item.title}>
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
                  <ul>
                    {item.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
          <div className="real-work-actions">
            <a className="button button-primary" href="#dopyt">Chcem naceniť podobnú realizáciu</a>
            <a className="button button-outline" href="/realizacie/">Zobraziť všetky realizácie</a>
          </div>
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
            <a className="button button-outline" href="/strechari/">{content.roofersCtaPrimary}</a>
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
            <ul className="why-list">
              {whyItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
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
