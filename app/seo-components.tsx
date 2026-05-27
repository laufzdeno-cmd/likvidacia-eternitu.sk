import type { Metadata } from 'next';
import { articles, commonProcessSteps, type FaqItem, type ServicePageContent } from '@/src/content/seo-content';
import { companyAddressLine, emailLink, phoneLink, serviceOffer, site } from '@/src/content/site';
import { PublicPageShell } from './public-layout';
import { JsonLd, buildBreadcrumbJsonLd, buildFaqJsonLd, buildServiceJsonLd } from './seo-json-ld';

export function buildPageMetadata({
  title,
  description,
  path,
  image = '/og/homepage.jpg',
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
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
      type: 'website',
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
    site.claimedStats.disposedArea.confirmed ? ['Zlikvidovaných', site.claimedStats.disposedArea.value] : null,
    site.claimedStats.customers.confirmed ? ['Zákazníkov', site.claimedStats.customers.value] : null,
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
        ASTANA, s.r.o. je vedená v zozname ÚVZ SR medzi oprávnenými spoločnosťami na odstraňovanie azbestu a materiálov obsahujúcich azbest zo stavieb pre exteriér aj interiér. Pri konkrétnej zákazke sa rieši rozhodnutie príslušného RÚVZ k danej stavbe a zákonný postup nakladania s odpadom s obsahom azbestu.
      </p>
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
            <h3>{name}</h3>
            <p>{text}</p>
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

export function FaqSection({ faqs, title = 'Časté otázky' }: { faqs: FaqItem[]; title?: string }) {
  return (
    <section className="seo-section seo-faq">
      <h2>{title}</h2>
      {faqs.map((item) => (
        <details key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

export function QuoteCTA({ title = 'Pošlite výmeru a fotky' }: { title?: string }) {
  return (
    <section className="seo-cta">
      <h2>{title}</h2>
      <p>Pošlite približnú výmeru, lokalitu a fotky materiálu. Pripravíme konkrétnu cenovú ponuku a navrhneme ďalší postup.</p>
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
          <li>fotky strechy alebo materiálu,</li>
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
        <JsonLd data={[buildBreadcrumbJsonLd([{ name: 'Úvod', path: '/' }, { name: page.h1, path: page.slug }]), buildServiceJsonLd(page.h1, page.quickAnswer, page.slug), buildFaqJsonLd(page.faqs)]} />
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
  };
}) {
  const path = `/likvidacia-azbestu-${location.slug}/`;
  const h1 = `Likvidácia azbestu a eternitu - ${location.name}`;
  const quickAnswer = `ASTANA zabezpečuje odbornú likvidáciu azbestu a eternitu v lokalite ${location.area} vrátane cenovej ponuky, dokumentácie, bezpečnej demontáže, balenia, odvozu a potvrdenia o likvidácii.`;
  const faqs: FaqItem[] = [
    { question: `Riešite likvidáciu azbestu v lokalite ${location.name}?`, answer: `Áno, ${site.legalName} pôsobí po celom Slovensku vrátane lokality ${location.area}.` },
    { question: `Čo poslať pre cenovú ponuku v lokalite ${location.name}?`, answer: 'Pošlite približnú výmeru v m2, obec alebo okres, fotky materiálu, typ objektu a informáciu o prístupe.' },
    { question: 'Od čoho závisí cena v tejto lokalite?', answer: 'Od výmery, typu materiálu, výšky objektu, prístupu, objemu odpadu, termínu a potrebnej dokumentácie.' },
  ];

  return (
    <PublicPageShell breadcrumb={{ name: h1, path }}>
      <main className="seo-page">
        <JsonLd data={[buildBreadcrumbJsonLd([{ name: 'Úvod', path: '/' }, { name: h1, path }]), buildServiceJsonLd(h1, quickAnswer, path), buildFaqJsonLd(faqs)]} />
        <section className="seo-hero">
          <p className="eyebrow">Lokálna služba</p>
          <h1>{h1}</h1>
          <p>{quickAnswer}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/#dopyt">Pošlite <span className="unit-m2">m2</span> a fotky</a>
            <a className="button button-outline" href={phoneLink}>Zavolať {site.phone}</a>
          </div>
        </section>
        <QuickAnswer>{quickAnswer}</QuickAnswer>
        <section className="seo-section">
          <h2>Služby v lokalite</h2>
          <p className="seo-lead">{location.localNote}</p>
          <div className="seo-included-list">
            {serviceOffer.map((item) => <span key={item}>✓ {item}</span>)}
          </div>
        </section>
        <section className="seo-section">
          <h2>Typické objekty</h2>
          <div className="seo-card-grid">
            {['rodinné domy', 'garáže', 'hospodárske budovy', 'haly a firemné objekty'].map((item) => (
              <article key={item}><h3>{item}</h3><p>Nacenenie závisí od výmery, prístupu, typu materiálu a stavu objektu.</p></article>
            ))}
          </div>
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

export function ArticlePage({ article }: { article: (typeof articles)[number] }) {
  const path = `/poradna/${article.slug}/`;
  const faqs: FaqItem[] = [
    { question: 'Kedy kontaktovať odbornú firmu?', answer: 'Keď ide o starší eternit, podozrenie na azbest, demontáž, odvoz alebo už zložený materiál, pri ktorom potrebujete bezpečný a preukázateľný postup.' },
    { question: 'Čo poslať na prvé posúdenie?', answer: 'Pošlite lokalitu, približnú výmeru v m2, fotky materiálu, typ objektu a kontakt.' },
  ];

  return (
    <PublicPageShell breadcrumb={{ name: article.title, path }}>
      <main className="seo-page">
        <JsonLd data={[buildBreadcrumbJsonLd([{ name: 'Úvod', path: '/' }, { name: 'Poradňa', path: '/poradna/' }, { name: article.title, path }]), buildFaqJsonLd(faqs)]} />
        <section className="seo-hero">
          <p className="eyebrow">Poradňa</p>
          <h1>{article.title}</h1>
          <p>Aktualizované: 27. mája 2026</p>
        </section>
        <QuickAnswer>{article.quickAnswer}</QuickAnswer>
        {article.body.map(([title, text]) => (
          <section className="seo-section" key={title}>
            <h2>{title}</h2>
            <p className="seo-lead">{text}</p>
          </section>
        ))}
        <InternalLinks context="article" />
        <FaqSection faqs={faqs} />
        <QuoteCTA title="Potrebujete naceniť likvidáciu?" />
      </main>
    </PublicPageShell>
  );
}
