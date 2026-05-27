import { coreFaqs } from '@/src/content/seo-content';
import { buildPageMetadata, ExpertProcedure, FaqSection, ProcessSteps, QuoteCTA, QuickAnswer, SummaryBox, TrustComplianceSection } from '../seo-components';
import { JsonLd, buildFaqJsonLd } from '../seo-json-ld';
import { PublicPageShell } from '../public-layout';

export const metadata = buildPageMetadata({
  title: 'Ako prebieha likvidácia azbestu a eternitu | Postup ASTANA',
  description:
    'Postup likvidácie azbestu krok za krokom: výmera, cenová ponuka, dokumentácia, stabilizácia, demontáž, balenie, odvoz a potvrdenie.',
  path: '/postup/',
  image: '/og/postup.jpg',
});

export default function ProcessPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Postup likvidácie', path: '/postup/' }}>
      <main className="seo-page">
        <JsonLd data={buildFaqJsonLd(coreFaqs.slice(0, 5))} />
        <section className="seo-hero">
          <p className="eyebrow">Postup</p>
          <h1>Ako prebieha likvidácia azbestu a eternitu</h1>
          <p>Proces držíme jednoduchý pre zákazníka a kontrolovaný pre stavbu: od prvého odhadu po odvoz a doklady.</p>
        </section>
        <QuickAnswer>
          Likvidácia azbestu prebieha od odoslania výmery a fotiek cez cenovú ponuku, prípravu podkladov, stabilizáciu,
          kontrolovanú demontáž, balenie odpadu, odvoz a odovzdanie potvrdenia alebo dokumentácie po legálnej likvidácii.
        </QuickAnswer>
        <ProcessSteps title="Postup krok za krokom" />
        <section className="seo-section">
          <h2>Čo má mať seriózna firma vyriešené pred demontážou</h2>
          <ul className="seo-check-list">
            <li>oprávnenie na odstraňovanie azbestu,</li>
            <li>rozhodnutie príslušného RÚVZ ku konkrétnej stavbe,</li>
            <li>postup bezpečnej demontáže a stabilizácie materiálu,</li>
            <li>zákonný spôsob balenia, odvozu a nakladania s nebezpečným odpadom,</li>
            <li>potvrdenie alebo doklad o legálnej likvidácii.</li>
          </ul>
          <p>
            Tento prehľad je vecná orientácia pre zákazníka, nie právne poradenstvo. Konkrétny postup sa nastavuje podľa stavby,
            rozsahu prác a rozhodnutia príslušných úradov.
          </p>
        </section>
        <section className="seo-section">
          <h2>Aké doklady dostanete</h2>
          <p className="seo-lead">
            Po ukončení zákazky dostanete potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu prác. Doklad je dôležitý,
            aby bolo preukázateľné, že materiál bol riešený legálne a neskončil ako bežný odpad.
          </p>
        </section>
        <SummaryBox
          items={[
            ['Čo robí zákazník', 'pošle m2, lokalitu, fotky a potvrdí rozsah objednávky'],
            ['Čo robí ASTANA', 'navrhne cenu, postup, dokumentáciu, termín a realizáciu'],
            ['Čo sa deje na stavbe', 'stabilizácia, demontáž, balenie a odvoz odpadu'],
            ['Výsledok', 'čistý preukázateľný postup a doklad po likvidácii'],
          ]}
        />
        <ExpertProcedure />
        <TrustComplianceSection />
        <FaqSection faqs={coreFaqs.slice(0, 5)} />
        <QuoteCTA />
      </main>
    </PublicPageShell>
  );
}
