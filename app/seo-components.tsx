import type { Metadata } from 'next';
import {
  articleEditorial,
  articleEditorialBySlug,
  articles,
  commonProcessSteps,
  type FaqItem,
  type ServicePageContent,
} from '@/src/content/seo-content';
import { companyAddressLine, emailLink, phoneLink, serviceOffer, site } from '@/src/content/site';
import { PublicPageShell } from './public-layout';
import { PublicFontPreload } from '@/src/components/public-font-preload';
import { JsonLd, buildArticleJsonLd, buildFaqJsonLd, buildServiceJsonLd } from './seo-json-ld';

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
        {site.compliance.asbestosRemovalAuthorization.publicVerification}
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
          Overiť zoznam oprávnených spoločností na ÚVZ SR
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
  return (
    <PublicPageShell breadcrumb={{ name: page.h1, path: page.slug }}>
      <main className="seo-page">
        <JsonLd data={[buildServiceJsonLd(page.h1, page.quickAnswer, page.slug), buildFaqJsonLd(page.faqs)]} />
        <section className="seo-hero">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1>{page.h1}</h1>
          <p>{page.lead}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/#dopyt">Chcem cenovú ponuku</a>
            <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
          </div>
        </section>
        <QuickAnswer>{page.quickAnswer}</QuickAnswer>
        <SummaryBox items={page.summary} />
        <section className="seo-section">
          <h2>Čo pre vás zabezpečíme</h2>
          <div className="seo-included-list">
            {serviceOffer.map((item) => <span key={item}>✓ {item}</span>)}
          </div>
        </section>
        {page.sections.map((section) => (
          <section className="seo-section" key={section.title}>
            <h2>{section.title}</h2>
            <p className="seo-lead">{section.text}</p>
            {section.items ? (
              <div className="seo-included-list">
                {section.items.map((item) => <span key={item}>{item}</span>)}
              </div>
            ) : null}
          </section>
        ))}
        <ProcessSteps />
        <ExpertProcedure />
        <TrustComplianceSection />
        <TrustBox />
        <InternalLinks context="service" />
        <FaqSection faqs={page.faqs} />
        <QuoteCTA />
      </main>
    </PublicPageShell>
  );
}

export function LocationPage({
  location,
}: {
  location: {
    slug: string;
    name: string;
    area: string;
    title: string;
    description: string;
    localNote: string;
    coverageHeading: string;
    coverageAreas: readonly string[];
    requestChecklist: readonly string[];
  };
}) {
  const path = `/likvidacia-azbestu-${location.slug}/`;
  const h1 = `Likvidácia azbestu a eternitu - ${location.name}`;
  const quickAnswer = `ASTANA, s.r.o. so sídlom v Poprade zabezpečuje po dohode odbornú likvidáciu azbestu a eternitu v ${location.area}. Výjazd a termín potvrdíme podľa obce, rozsahu prác a aktuálnej kapacity; v tejto lokalite nemáme pobočku.`;
  const faqs: FaqItem[] = [
    { question: `Riešite likvidáciu azbestu v ${location.area}?`, answer: `Áno, ${site.legalName} pôsobí po celom Slovensku a zákazky prijíma aj v ${location.area}.` },
    { question: 'Čo poslať v dopyte na cenovú ponuku?', answer: 'Pošlite približnú výmeru v m2, obec alebo okres, typ objektu a informáciu o prístupe. Fotky materiálu sú voliteľné; ak ich máte, pomôžu ponuku spresniť.' },
    { question: 'Od čoho závisí cena v tejto lokalite?', answer: 'Od výmery, typu materiálu, výšky objektu, prístupu, objemu odpadu, termínu a potrebnej dokumentácie.' },
  ];

  return (
    <PublicPageShell breadcrumb={{ name: h1, path }} hideWhatsappOnMobile>
      <main className="seo-page">
        <JsonLd data={[buildServiceJsonLd(h1, quickAnswer, path), buildFaqJsonLd(faqs)]} />
        <section className="seo-hero">
          <p className="eyebrow">Výjazd z Popradu po dohode</p>
          <h1>{h1}</h1>
          <p>{quickAnswer}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/#dopyt">Pošlite výmeru a lokalitu</a>
            <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
          </div>
        </section>
        <section className="seo-section">
          <h2>Ako plánujeme výjazd do tejto oblasti</h2>
          <p className="seo-lead">{location.localNote}</p>
          <p>
            Pôsobnosť po celom Slovensku neznamená miestnu pobočku ani automaticky dostupný termín. Pred potvrdením
            výjazdu preveríme údaje o stavbe a dohodneme s vami logistiku.
          </p>
          <p><a href="/kde-posobime/">Ako plánujeme výjazdy po Slovensku</a></p>
        </section>
        <section className="seo-section seo-grid-2" aria-label={`Praktické informácie pre ${location.coverageHeading}`}>
          <article>
            <h2>Dopyty z územia: {location.coverageHeading}</h2>
            <p>
              Dopyty posudzujeme aj z týchto okresov alebo blízkych miest: {location.coverageAreas.join(', ')}.
              Zoznam vyjadruje územie pôsobnosti, nie miestne pobočky ani potvrdené realizácie.
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
        <ProcessSteps title="Ako prebieha objednávka" />
        <section className="seo-section">
          <h2>Čo ovplyvňuje cenu v danej lokalite</h2>
          <p className="seo-lead">Cenu ovplyvňuje výmera, typ materiálu, prístup k objektu, výška strechy, objem odpadu, logistika v regióne a rozsah dokumentácie.</p>
        </section>
        <ContactStrip />
        <InternalLinks context="location" />
        <FaqSection faqs={faqs} title="FAQ pre lokalitu" />
        <QuoteCTA />
      </main>
    </PublicPageShell>
  );
}

export function ArticleEditorialSection({ slug }: { slug: (typeof articles)[number]['slug'] }) {
  const editorial = articleEditorialBySlug[slug];

  return (
    <section className="seo-section seo-article-editorial" aria-labelledby="article-editorial-title">
      <p className="eyebrow">Zodpovednosť a zdroje</p>
      <h2 id="article-editorial-title">Kto zodpovedá za obsah</h2>
      <p className="seo-lead">
        Za obsah zodpovedá <strong>{site.legalName}</strong> Posledná vecná a redakčná kontrola:{' '}
        <time dateTime={articleEditorial.reviewedAt}>{articleEditorial.reviewedLabel}</time>.
      </p>
      <p>{articleEditorial.scopeNote}</p>
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
        <div className="seo-methodology-note">
          <h3>Praktická metodika ASTANA</h3>
          <p>{articleEditorial.methodologyNote}</p>
        </div>
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
            dateModified: articleEditorial.reviewedAt,
            citations: editorial.sources.map((source) => source.url),
          }),
          buildFaqJsonLd(faqs),
        ]} />
        <section className="seo-hero">
          <p className="eyebrow">Poradňa</p>
          <h1>{article.title}</h1>
        </section>
        <QuickAnswer>{article.quickAnswer}</QuickAnswer>
        {article.body.map(([title, text]) => (
          <section className="seo-section" key={title}>
            <h2>{title}</h2>
            <p className="seo-lead">{text}</p>
          </section>
        ))}
        <ArticleEditorialSection slug={article.slug} />
        <InternalLinks context="article" />
        <FaqSection faqs={faqs} />
        <QuoteCTA title="Potrebujete naceniť likvidáciu?" />
      </main>
    </PublicPageShell>
  );
}
