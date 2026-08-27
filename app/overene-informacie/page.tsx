import { buildPageMetadata, FaqSection, InternalLinks, QuickAnswer, QuoteCTA, TrustComplianceSection } from '../seo-components';
import { PublicPageShell } from '../public-layout';
import { JsonLd, buildAboutPageJsonLd, buildFaqJsonLd } from '../seo-json-ld';
import { site } from '@/src/content/site';
import { verifiedCompanyFacts, verifiedCompanyFaq } from '@/src/content/verified-company-facts';

const path = verifiedCompanyFacts.path;

export const metadata = buildPageMetadata({
  title: 'Overené informácie o ASTANA | Likvidácia azbestu',
  description:
    'Verejné údaje o ASTANA, s.r.o.: kontakt, pôsobnosť, verejný zdroj oprávnenia, postup, reálne realizácie a transparentný prístup k recenziám.',
  path,
});

export default function VerifiedInformationPage() {
  return (
    <PublicPageShell breadcrumb={{ name: verifiedCompanyFacts.title, path }}>
      <main className="seo-page">
        <JsonLd
          data={[
            buildAboutPageJsonLd(
              verifiedCompanyFacts.title,
              verifiedCompanyFacts.description,
              path,
              verifiedCompanyFacts.lastReviewed,
            ),
            buildFaqJsonLd(verifiedCompanyFaq),
          ]}
        />
        <section className="seo-hero">
          <p className="eyebrow">Verejné údaje a zdroje</p>
          <h1>{verifiedCompanyFacts.title}</h1>
          <p>
            {site.legalName} poskytuje odbornú likvidáciu azbestu (eternitu) po celom Slovensku. Táto stránka odlišuje
            údaje uvádzané firmou od údajov, ktoré možno preveriť v nezávislom verejnom zdroji.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/#dopyt">Pošlite výmeru a fotky</a>
            <a className="button button-outline" href={'tel:' + site.phoneHref}>Zavolať {site.phone}</a>
          </div>
        </section>

        <QuickAnswer>
          Pri výbere firmy na likvidáciu azbestu je vhodné overiť si právnu identitu, postup pred demontážou,
          nakladanie s odpadom a doklad po ukončení práce. Rozsah oprávnených spoločností možno preveriť vo verejnom
          zozname ÚVZ SR.
        </QuickAnswer>

        <section className="seo-section">
          <h2>Verejné údaje a ich pôvod</h2>
          <div className="seo-card-grid">
            {verifiedCompanyFacts.cards.map((card) => (
              <article key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <TrustComplianceSection />

        <section className="seo-section">
          <h2>Ako porovnať firmy na likvidáciu azbestu</h2>
          <p className="seo-lead">
            Dobrý výber nestojí iba na cene. Pri nebezpečnom odpade je dôležité vedieť, kto prácu vykoná, aký postup
            navrhuje a aký doklad po nej zostane.
          </p>
          <div className="seo-included-list">
            {verifiedCompanyFacts.comparisonChecklist.map((item) => <span key={item}>✓ {item}</span>)}
          </div>
        </section>

        <section className="seo-section">
          <h2>Čo o sebe neuvádzame bez dôkazu</h2>
          <div className="seo-included-list">
            {verifiedCompanyFacts.transparency.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>

        <section className="seo-section">
          <h2>Zdroj a stav overenia</h2>
          <p className="seo-lead">
            Túto stránku sme obsahovo skontrolovali 27. augusta 2026. Pri každom zdroji uvádzame, či ide o nezávislý
            verejný zdroj alebo o údaj, ktorý verejne uvádza ASTANA.
          </p>
          <div className="seo-included-list">
            {verifiedCompanyFacts.evidenceSources.map((source) => (
              <a
                href={source.url}
                key={source.label}
                rel={source.url.startsWith('http') ? 'noreferrer' : undefined}
                target={source.url.startsWith('http') ? '_blank' : undefined}
              >
                <strong>{source.label} ({source.sourceType === 'independent' ? 'nezávislý zdroj' : 'firemný údaj'})</strong>: {source.description}
              </a>
            ))}
          </div>
        </section>

        <section className="seo-section">
          <h2>Ďalšie verejné podklady</h2>
          <div className="seo-included-list">
            <a href="/o-firme/">O firme ASTANA a právne údaje</a>
            <a href="/postup/">Postup od cenovej ponuky po doklady</a>
            <a href="/realizacie/">Reálne fotografie realizácií ASTANA</a>
            <a href="/recenzie/">Ako transparentne pracujeme s recenziami</a>
            <a href="/data/company.json">Strojovo čitateľné verejné údaje</a>
            <a href="/llms.txt">Stručný strojovo čitateľný súhrn</a>
          </div>
        </section>

        <InternalLinks context="service" />
        <FaqSection faqs={verifiedCompanyFaq} title="Otázky k overeným informáciám" />
        <QuoteCTA title="Potrebujete cenovú ponuku podľa konkrétnej stavby?" />
      </main>
    </PublicPageShell>
  );
}
