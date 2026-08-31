import { buildPageMetadata, ContactStrip, ExpertProcedure, QuoteCTA, QuickAnswer, TrustBox, TrustComplianceSection } from '../seo-components';
import { PublicPageShell } from '../public-layout';
import { serviceOffer, site } from '@/src/content/site';

export const metadata = buildPageMetadata({
  title: 'O firme ASTANA | Likvidácia azbestu (eternitu)',
  description:
    'ASTANA, s.r.o. zabezpečuje odbornú likvidáciu azbestu, eternitu a nebezpečného odpadu po celom Slovensku. Kontaktné a firemné údaje.',
  path: '/o-firme/',
});

export default function AboutPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'O firme ASTANA', path: '/o-firme/' }}>
      <main className="seo-page">
        <section className="seo-hero">
          <p className="eyebrow">O firme</p>
          <h1>O firme ASTANA</h1>
          <p>{site.legalName} zabezpečuje odbornú likvidáciu azbestu, eternitu a nebezpečného odpadu po celom Slovensku.</p>
        </section>
        <QuickAnswer>
          ASTANA, s.r.o. je firma so sídlom v Poprade, ktorá rieši likvidáciu azbestu a eternitu vrátane cenovej ponuky,
          dokumentácie, bezpečnej demontáže, balenia, odvozu a potvrdenia o legálnej likvidácii.
        </QuickAnswer>
        <TrustBox />
        <TrustComplianceSection />
        <section className="seo-section">
          <h2>Čo firma robí</h2>
          <div className="seo-included-list">
            {serviceOffer.map((item) => <span key={item}>✓ {item}</span>)}
          </div>
        </section>
        <ExpertProcedure />
        <section className="seo-section">
          <h2>Dokumenty a oprávnenia</h2>
          <p className="seo-lead">
            ASTANA uvádza oprávnenie na odstraňovanie azbestu v exteriéri aj interiéri. Historické správy RÚVZ z rokov
            2021 až 2023 dokumentujú činnosť firmy pri odstraňovaní azbestu. Archívne dokumenty samy osebe nie sú
            potvrdením aktuálneho stavu oprávnenia v roku 2026. Interné oprávnenia, PDF dokumenty ani čísla dokumentov
            nezverejňujeme na stiahnutie z bezpečnostných a obchodných dôvodov.
          </p>
          <p>
            <a href="/overene-informacie/">Pozrieť verejné zdroje a hranice overenia</a>
          </p>
        </section>
        <section className="seo-section">
          <h2>Overené informácie na jednom mieste</h2>
          <p className="seo-lead">
            Zverejnili sme aj samostatný prehľad firemných údajov, postupu, reálnych fotografií a hraníc tvrdení,
            ktoré nepoužívame bez dôkazu.
          </p>
          <p><a href="/overene-informacie/">Pozrieť overené informácie o ASTANA</a></p>
        </section>
        <ContactStrip />
        <QuoteCTA />
      </main>
    </PublicPageShell>
  );
}
