import type { Metadata } from 'next';
import {
  articleEditorial,
  articleEditorialBySlug,
  articles,
  commonProcessSteps,
  locationPages,
  type FaqItem,
  type ServicePageContent,
} from '@/src/content/seo-content';
import { companyAddressLine, emailLink, phoneLink, serviceOffer, site } from '@/src/content/site';
import { PublicPageShell } from './public-layout';
import { PublicFontPreload } from '@/src/components/public-font-preload';
import { JsonLd, buildArticleJsonLd, buildFaqJsonLd, buildServiceJsonLd } from './seo-json-ld';
import { EditorialHero, ReadingLinks, UsefulChecklist } from './editorial-components';
import { regionalGuides } from '@/src/content/regional-guides';
import { transportPolicy } from '@/src/content/transport-policy.mjs';
import { pagePhotoId } from '@/src/content/public-photo-assignments';

export function buildPageMetadata({
  title,
  description,
  path,
  image = '/og/homepage.jpg',
  pageType = 'website',
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  pageType?: 'website' | 'article';
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: `${site.brandName} - likvidácia azbestu a eternitu`,
      locale: 'sk_SK',
      type: pageType,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export function QuickAnswer({ children }: { children: React.ReactNode }) {
  return (
    <section className="seo-section">
      <p className="eyebrow">Rýchla odpoveď</p>
      <p className="seo-lead">{children}</p>
    </section>
  );
}

export function SummaryBox({ items }: { items: Array<readonly [string, string]> }) {
  return (
    <section className="seo-section">
      <h2>Zhrnutie pre zákazníka</h2>
      <div className="seo-card-grid">
        {items.map(([title, text]) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TrustBox() {
  const stats = [
    site.claimedStats.foundedOrActiveSince.confirmed ? ['Od roku', site.claimedStats.foundedOrActiveSince.value] : null,
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <section className="seo-section">
      <h2>Dôveryhodné údaje</h2>
      <div className="seo-card-grid">
        <article>
          <h3>{site.legalName}</h3>
          <p>IČO: {site.ico}</p>
          <p>{companyAddressLine}</p>
        </article>
        <article>
          <h3>Kontakt</h3>
          <p><a href={phoneLink}>{site.phone}</a></p>
          <p><a href={emailLink}>{site.email}</a></p>
        </article>
        <article>
          <h3>Pôsobnosť</h3>
          <p>{site.areaServed}</p>
          <p>{site.openingHours}</p>
        </article>
        {stats.map(([label, value]) => (
          <article key={label}>
            <h3>{label}</h3>
            <p>{value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TrustComplianceSection() {
  return (
    <section className="seo-section trust-compliance-section">
      <h2>Ako rozoznať legálnu likvidáciu azbestu</h2>
      <p className="seo-lead">
        Pri legálnej likvidácii azbestu nestačí, že firma príde, rozoberie strechu a odvezie dosky. Odborný postup začína ešte pred príchodom na stavbu.
      </p>
      <p>
        {site.documents.publicLookupHint}
      </p>
      <p>
        Pri plánovanom odstraňovaní azbestu zo stavby držiteľ oprávnenia písomne oznamuje práce príslušnému orgánu verejného zdravotníctva najmenej 30 dní vopred a predkladá požadované podklady. Ak ide o neodkladné odstraňovanie v súvislosti s mimoriadnou havarijnou alebo živelnou udalosťou, oznámenie s podkladmi sa predkladá najneskôr do 48 hodín od začatia odstraňovania.
      </p>
      <p>
        <a href="https://static.slov-lex.sk/static/SK/ZZ/2007/355/20260801.print.html" target="_blank" rel="noopener noreferrer">
          Pozrieť § 41 zákona č. 355/2007 Z. z. v znení účinnom od 1. augusta 2026
        </a>
      </p>
      <p>Konkrétny pracovný postup a podklady sa posudzujú podľa druhu stavby a rozsahu prác.</p>
      <p>Bez potrebného úradného postupu sa do demontáže nepúšťame.</p>
      <p>
        <a href={site.compliance.uvzAuthorizedCompaniesUrl} target="_blank" rel="noopener noreferrer">
          Otvoriť aktuálny register ÚVZ SR (IČO 46 157 701)
        </a>
      </p>
    </section>
  );
}

export function ProcessSteps({ title = 'Ako prebieha likvidácia' }: { title?: string }) {
  return (
    <section className="seo-section">
      <h2>{title}</h2>
      <div className="seo-step-list">
        {commonProcessSteps.map(([name, text], index) => (
          <article key={name} className="seo-step-card">
            <span>{index + 1}</span>
            <div className="seo-step-card-content">
              <h3>{name}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ExpertProcedure() {
  return (
    <section className="seo-section">
      <h2>Prečo je dôležitý odborný postup</h2>
      <p className="seo-lead">
        Azbestové vlákna sú problém najmä pri poškodení materiálu. Eternit sa nemá zbytočne lámať,
        rezať ani zhadzovať. Nebezpečný odpad treba baliť, odviezť a zdokladovať legálne, aby mal
        zákazník preukázateľné potvrdenie o likvidácii.
      </p>
    </section>
  );
}

export function FaqSection({ faqs, title = 'Časté otázky' }: { faqs: readonly FaqItem[]; title?: string }) {
  return (
    <section className="seo-section seo-faq">
      <h2>{title}</h2>
      {faqs.map((item) => (
        <details key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
          {item.relatedLink ? (
            <p className="seo-faq-related-link">
              <a href={item.relatedLink.href}>{item.relatedLink.label}</a>
            </p>
          ) : null}
        </details>
      ))}
    </section>
  );
}

export function QuoteCTA({ title = 'Pošlite výmeru a lokalitu' }: { title?: string }) {
  return (
    <section className="seo-cta">
      <h2>{title}</h2>
      <p>Pošlite približnú výmeru a lokalitu. Fotky sú voliteľné; ak ich máte, pomôžu nám ponuku spresniť. Pripravíme konkrétnu cenovú ponuku a navrhneme ďalší postup.</p>
      <div className="final-actions">
        <a className="button button-primary" href="/#dopyt">Získať cenovú ponuku</a>
        <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
      </div>
    </section>
  );
}

export function ContactStrip() {
  return (
    <section className="seo-section seo-grid-2">
      <article>
        <h2>Kontaktujte ASTANA</h2>
        <p>{site.legalName}</p>
        <p>{companyAddressLine}</p>
        <p><a href={phoneLink}>{site.phone}</a></p>
        <p><a href={emailLink}>{site.email}</a></p>
      </article>
      <article>
        <h2>Čo poslať pre rýchlu ponuku</h2>
        <ul>
          <li>lokalitu alebo okres,</li>
          <li>približnú výmeru v m2,</li>
          <li>fotky strechy alebo materiálu, ak ich máte – sú voliteľné,</li>
          <li>typ objektu a prístup,</li>
          <li>kontakt na vás.</li>
        </ul>
      </article>
    </section>
  );
}

export function InternalLinks({
  context = 'default',
}: {
  context?: 'default' | 'service' | 'location' | 'article';
}) {
  const links =
    context === 'article'
      ? [
          ['/likvidacia-azbestu/', 'Likvidácia azbestu'],
          ['/likvidacia-eternitu/', 'Likvidácia eternitu'],
          ['/cena-likvidacie-azbestu/', 'Cena likvidácie'],
          ['/kontakt/', 'Kontakt'],
        ]
      : context === 'location'
        ? [
            ['/likvidacia-azbestu/', 'Hlavná služba: azbest'],
            ['/likvidacia-eternitu/', 'Likvidácia eternitu'],
            ['/cena-likvidacie-azbestu/', 'Cena'],
            ['/postup/', 'Postup'],
            ['/realizacie/', 'Ukážky realizácií'],
            ['/kontakt/', 'Kontakt'],
          ]
        : [
            ['/cena-likvidacie-azbestu/', 'Cena'],
            ['/postup/', 'Postup'],
            ['/faq/', 'FAQ'],
            ['/realizacie/', 'Realizácie'],
            ['/kontakt/', 'Kontakt'],
          ];

  return (
    <section className="seo-section">
      <h2>Súvisiace informácie</h2>
      <div className="seo-included-list">
        {links.map(([href, label]) => (
          <a key={href} href={href}>{label}</a>
        ))}
      </div>
    </section>
  );
}

export function ServicePage({ page }: { page: ServicePageContent }) {
  const isRoof = page.slug === '/likvidacia-eternitu/';
  return (
    <PublicPageShell breadcrumb={{ name: page.h1, path: page.slug }} hideWhatsappOnMobile>
      <main className="seo-page">
        <JsonLd data={[buildServiceJsonLd(page.h1, page.quickAnswer, page.slug), buildFaqJsonLd(page.faqs)]} />
        <EditorialHero eyebrow={page.eyebrow} title={page.h1} lead={page.quickAnswer}
          photoId={pagePhotoId(page.slug)}
          photoCaption={isRoof ? 'Záber z prípravy strešnej krytiny pri realizácii ASTANA.' : 'Fotodokumentácia ASTANA: príprava a logistika pri väčšom objekte.'}>
          <div className="hero-actions">
            <a className="button button-primary" href="/#dopyt">Chcem cenovú ponuku</a>
            <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
          </div>
        </EditorialHero>
        <p className="editorial-faq-intro">{page.lead}</p>
        <section className="seo-section">
          <h2>Čo pre vás zabezpečíme</h2>
          <div className="seo-included-list">
            {serviceOffer.map((item) => <span key={item}>✓ {item}</span>)}
          </div>
        </section>
        {page.sections.map((section) => (
          <section className="seo-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.text.split('\n\n').map((paragraph) => <p className="editorial-faq-intro" key={paragraph}>{paragraph}</p>)}
            {section.items ? (
              <div className="seo-included-list">
                {section.items.map((item) => <span key={item}>{item}</span>)}
              </div>
            ) : null}
          </section>
        ))}
        <UsefulChecklist title={isRoof ? 'Než si potvrdíte výmenu strechy' : 'Než si objednáte odstránenie materiálu'} items={isRoof ? [
          'Rozlíšte plochu krytiny od pôdorysu domu. Na prvý dopyt stačí označený odhad.',
          'Uveďte strechára a požadovanú nadväznosť novej krytiny.',
          'Vyjasnite si, kto prevezme odkrytý objekt a zabezpečí prípadné zakrytie.',
        ] : [
          'Opíšte, kde materiál je a či sa doň už zasahovalo.',
          'Ak zloženie nepoznáte, nepokúšajte sa ho potvrdiť poškodením materiálu.',
          'Pri objekte v prevádzke uveďte režim vstupu a používané časti budovy.',
        ]} />
        <TrustComplianceSection />
        <ReadingLinks links={[
          { href: '/cena-likvidacie-azbestu/', title: 'Cena a rozsah ponuky', text: 'Čo ovplyvňuje cenu a ako funguje doprava od 100 m².' },
          { href: '/postup/', title: 'Od dopytu po odovzdanie', text: 'Príprava, demontáž, odvoz aj nadväznosť strechára.' },
          { href: '/realizacie/', title: 'Pozrite si našu prácu', text: 'Vlastné fotografie rôznych typov objektov a prác ASTANA.' },
        ]} />
        <FaqSection faqs={page.faqs} />
        <QuoteCTA />
      </main>
    </PublicPageShell>
  );
}

export function LocationPage({
  location,
}: {
  location: (typeof locationPages)[number];
}) {
  const path = `/likvidacia-azbestu-${location.slug}/`;
  const guide = regionalGuides[location.slug];
  const h1 = `Likvidácia azbestu a eternitu - ${location.name}`;
  const quickAnswer = `ASTANA, s.r.o. so sídlom v Poprade zabezpečuje po dohode odbornú likvidáciu azbestu a eternitu v ${location.area}. Výjazd a termín potvrdíme podľa obce, rozsahu prác a aktuálnej kapacity.`;
  const relatedLocations = location.relatedSlugs
    .map((slug) => locationPages.find((item) => item.slug === slug))
    .filter((item): item is (typeof locationPages)[number] => Boolean(item));
  const faqs: FaqItem[] = [
    guide.faq,
    { question: 'Ako účtujete dopravu pri tejto zákazke?', answer: transportPolicy.full },
    { question: 'Potrebujem pred dopytom presnú výmeru?', answer: 'Na prvé posúdenie stačí približná výmera. Uveďte obec, typ objektu, stav materiálu a prístup. Fotografie sú voliteľné; kvôli meraniu ani foteniu na starú krytinu nevstupujte.' },
  ];

  return (
    <PublicPageShell
      breadcrumb={{ name: h1, path }}
      breadcrumbParents={[{ name: 'Kde pôsobíme', path: '/kde-posobime/' }]}
      hideWhatsappOnMobile
    >
      <main className="seo-page">
        <JsonLd data={[buildServiceJsonLd(h1, quickAnswer, path), buildFaqJsonLd(faqs)]} />
        <EditorialHero eyebrow="Výjazd z Popradu po dohode" title={h1} lead={quickAnswer}
          photoId={pagePhotoId(path)}
          photoCaption="Vlastná fotodokumentácia z demontáží ASTANA, s.r.o.">
          <div className="hero-actions">
            <a className="button button-primary" href="/#dopyt">Pošlite výmeru a lokalitu</a>
            <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
          </div>
        </EditorialHero>
        <section className="editorial-situation">
          <p className="eyebrow">Podľa situácie na vašej stavbe</p><h2>{guide.heading}</h2>
          {guide.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          <ul>{guide.checklist.map(item => <li key={item}>{item}</li>)}</ul>
          <p><a href={`/poradna/${guide.articleSlug}/`}>{guide.articleLabel} →</a></p>
        </section>
        <section className="seo-section seo-grid-2" aria-label={`Praktické informácie pre ${location.coverageHeading}`}>
          <article>
            <h2>Dopyty z územia: {location.coverageHeading}</h2>
            <p>
              Dopyty posudzujeme aj z týchto okresov alebo blízkych miest: {location.coverageAreas.join(', ')}.
            </p>
          </article>
          <article>
            <h2>Čo uviesť pre realistickú ponuku</h2>
            <ul>
              {location.requestChecklist.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p>Ak niektorý údaj neviete, pošlite odhad. Fotografie sú voliteľné.</p>
          </article>
        </section>
        <section className="seo-section" aria-labelledby={`regional-planning-${location.slug}`}>
          <p className="eyebrow">Praktické plánovanie</p>
          <h2 id={`regional-planning-${location.slug}`}>Ako pripravíme výjazd k vašej stavbe</h2>
          <div className="seo-card-grid">
            {location.planningPoints.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="seo-section">
          <h2>Čo ovplyvňuje cenu v danej lokalite</h2>
          <p className="seo-lead">Cenu ovplyvňuje výmera, typ materiálu, prístup k objektu, výška strechy, objem odpadu a rozsah dokumentácie. {transportPolicy.full}</p>
        </section>
        <ReadingLinks title="Pripravte si ďalší krok" links={[
          { href: '/cena-likvidacie-azbestu/', title: 'Orientačná cena', text: 'Prepočet podľa výmery a vysvetlenie položiek ponuky.' },
          { href: '/postup/', title: 'Príprava a termín', text: 'Ako postupujeme pred prácou a pri koordinácii strechára.' },
          { href: '/spolupracujuci-strechari/', title: 'Nemáte strechára?', text: 'Čo si dohodnúť pri nadväzujúcej novej streche.' },
        ]} />
        <section className="seo-section" aria-labelledby={`related-regions-${location.slug}`}>
          <h2 id={`related-regions-${location.slug}`}>Ďalšie oblasti, ktoré obsluhujeme</h2>
          <p className="seo-lead">
            Každú zákazku posudzujeme podľa presnej obce, rozsahu a kapacity. Ak je objekt v inom kraji, vyberte
            jeho regionálnu stránku alebo si pozrite celú pôsobnosť ASTANY.
          </p>
          <div className="seo-included-list">
            {relatedLocations.map((item) => (
              <a key={item.slug} href={`/likvidacia-azbestu-${item.slug}/`}>
                Likvidácia azbestu – {item.name}
              </a>
            ))}
            <a href="/kde-posobime/">Všetky oblasti a plánovanie výjazdov</a>
          </div>
        </section>
        <FaqSection faqs={faqs} title="Otázky k zákazke a výjazdu" />
        <QuoteCTA />
      </main>
    </PublicPageShell>
  );
}

export function ArticleEditorialSection({ slug }: { slug: (typeof articles)[number]['slug'] }) {
  const editorial = articleEditorialBySlug[slug];

  return (
    <section className="seo-section seo-article-editorial" aria-labelledby="article-editorial-title">
      <p className="eyebrow">Z našej praxe</p>
      <h2 id="article-editorial-title">{editorial.sources.length ? 'Autor a odborné zdroje' : 'Odporúčania z praxe ASTANA'}</h2>
      <p className="seo-lead">
        Článok pripravila <strong>{site.legalName}</strong> Naposledy aktualizované{' '}
        <time dateTime={articleEditorial.contentUpdatedAt}>{articleEditorial.contentUpdatedLabel}</time>.
      </p>
      {editorial.sources.length ? (
        <>
          <h3>Použité oficiálne zdroje</h3>
          <ul className="seo-source-list">
            {editorial.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
                <span>{source.publisher}</span>
                <p>{source.supports}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Praktické odporúčania vychádzajú z našich skúseností pri príprave zákaziek. Rozsah a cenu si potvrdíme podľa vašej stavby.</p>
      )}
    </section>
  );
}

export function ArticlePage({ article }: { article: (typeof articles)[number] }) {
  const path = `/poradna/${article.slug}/`;
  const faqs = article.faqs;
  const editorial = articleEditorialBySlug[article.slug];

  return (
    <PublicPageShell
      breadcrumb={{ name: article.title, path }}
      breadcrumbParents={[{ name: 'Poradňa', path: '/poradna/' }]}
      hideWhatsappOnMobile
    >
      <PublicFontPreload />
      <main className="seo-page">
        <JsonLd data={[
          buildArticleJsonLd({
            headline: article.title,
            description: article.quickAnswer,
            path,
            articleBody: article.body.map(([, text]) => text).join('\n\n'),
            image: article.image,
            dateModified: articleEditorial.contentUpdatedAt,
            citations: editorial.sources.map((source) => source.url),
          }),
          buildFaqJsonLd(faqs),
        ]} />
        <EditorialHero eyebrow="Praktická poradňa ASTANA" title={article.title} lead={article.quickAnswer}
          photoId={article.photoId} photoAlt={article.photoAlt} photoCaption={article.photoCaption} />
        <nav className="editorial-toc" aria-label="Obsah článku"><p>V tomto článku nájdete</p><ul>
          {article.body.map(([title], index) => <li key={title}><a href={`#article-section-${index + 1}`}>{title}</a></li>)}
        </ul></nav>
        <div className="editorial-article-body">
          {article.body.map(([title, text], index) => (
            <section className="seo-section" key={title}>
              <h2 id={`article-section-${index + 1}`}>{title}</h2>
              {text.split('\n\n').map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
          <UsefulChecklist title={article.checklistTitle} items={article.checklist} />
        </div>
        <ArticleEditorialSection slug={article.slug} />
        <ReadingLinks links={[
          ...article.relatedSlugs.map(slug => articles.find(item => item.slug === slug)!).map(item => ({
            href: `/poradna/${item.slug}/`, title: item.title, text: item.description,
          })),
          { href: '/cena-likvidacie-azbestu/', title: 'Cena pre vašu zákazku', text: 'Pozrite si orientačný výpočet a pošlite nezáväzný dopyt.' },
        ]} />
        <FaqSection faqs={faqs} />
        <QuoteCTA title="Potrebujete naceniť likvidáciu?" />
      </main>
    </PublicPageShell>
  );
}
