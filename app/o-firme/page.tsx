import { buildPageMetadata, ContactStrip, ExpertProcedure, QuoteCTA, QuickAnswer, TrustBox, TrustComplianceSection } from '../seo-components';
import { PublicPageShell } from '../public-layout';
import { serviceOffer, site } from '@/src/content/site';

export const metadata = buildPageMetadata({
  title: 'O firme ASTANA | Likvidácia azbestu a eternitu',
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
            ASTANA, s.r.o. má oprávnenie na odstraňovanie azbestu v exteriéri aj interiéri a je verejne overiteľná v zozname
            ÚVZ SR. Interné oprávnenia, PDF dokumenty ani čísla dokumentov nezverejňujeme na stiahnutie z bezpečnostných
            a obchodných dôvodov.
          </p>
          <p>
            <a href={site.compliance.uvzAuthorizedCompaniesUrl} target="_blank" rel="noopener noreferrer">
              Overiť zoznam oprávnených spoločností na ÚVZ SR
            </a>
          </p>
        </section>
        <ContactStrip />
        <QuoteCTA />
      </main>
    </PublicPageShell>
  );
}
