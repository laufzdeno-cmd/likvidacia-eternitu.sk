import { buildPageMetadata, QuoteCTA, TrustBox } from '../seo-components';
import { PublicPageShell } from '../public-layout';
import { astanaWebsites, serviceOffer, site } from '@/src/content/site';
import { EditorialHero, ReadingLinks } from '../editorial-components';

export const metadata = buildPageMetadata({
  title: 'O firme ASTANA | Likvidácia azbestu a eternitu',
  description:
    'ASTANA, s.r.o. zabezpečuje odbornú likvidáciu azbestu, eternitu a nebezpečného odpadu po celom Slovensku. Kontaktné a firemné údaje.',
  path: '/o-firme/',
});

export default function AboutPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'O firme ASTANA', path: '/o-firme/' }} hideWhatsappOnMobile>
      <main className="seo-page">
        <EditorialHero eyebrow="O firme · Poprad" title="ASTANA: likvidácia azbestu a eternitu"
          lead="Sme ASTANA, s.r.o., firma so sídlom v Poprade. Zabezpečujeme odstránenie azbestových materiálov v dohodnutom rozsahu: od posúdenia podkladov cez demontáž a odvoz až po súvisiacu dokumentáciu. Zákazky riešime po celom Slovensku."
          photoId="azbest-111" photoAlt="Vozidlá ASTANA pri rozsiahlom objekte počas prác"
          photoCaption="Vlastná fotodokumentácia ASTANA. Konkrétny rozsah každej zákazky určuje potvrdená cenová ponuka.">
          <div className="hero-actions"><a className="button button-primary" href="/realizacie/">Pozrieť našu prácu</a><a className="button button-outline" href="/kontakt/">Kontaktovať firmu</a></div>
        </EditorialHero>
        <section className="seo-section"><h2>Čo od spolupráce môžete očakávať</h2><div className="seo-card-grid">
          <article><h3>Začneme vašou stavbou</h3><p>Nepotrebujete poznať odborný názov krytiny. Vyjasníme si stav materiálu, plochu, prístup a to, čo má po odstránení nasledovať. Neistý údaj môžete označiť ako odhad.</p></article>
          <article><h3>Potvrdíme si rozsah</h3><p>Pred realizáciou má byť jasné, čo zahŕňa ponuka, aké podklady treba pripraviť a aký termín je možný. Odoslanie formulára samo osebe nezačína realizáciu.</p></article>
          <article><h3>Zladíme nadväzujúce práce</h3><p>Ak máte strechára, riešime s vami nadväznosť. Pri samostatne odporučenom partnerovi jeho novú strechu objednávate a dohadujete priamo s ním.</p></article>
        </div></section>
        <TrustBox />
        <section className="seo-section">
          <h2>Firemné údaje</h2>
          <p>
            ASTANA, s.r.o. vznikla 27. apríla 2011. Verejný údaj o dátume vzniku je možné overiť v Registri účtovných závierok.
          </p>
          <p>
            <a href={site.claimedStats.foundedOrActiveSince.sourceUrl} target="_blank" rel="noopener noreferrer">
              Overiť firemný záznam ASTANA, s.r.o.
            </a>
          </p>
        </section>
        <section className="seo-section" id="oficialne-weby" aria-labelledby="official-websites-title">
          <p className="eyebrow">Jedna firma, tri úlohy</p>
          <h2 id="official-websites-title">Oficiálne weby ASTANA sa dopĺňajú</h2>
          <p className="seo-lead">
            Všetky tri weby patria k službám spoločnosti ASTANA, s.r.o. Každý vysvetľuje inú časť ponuky; nejde o tri rozdielne firmy ani miestne pobočky.
          </p>
          <div className="seo-card-grid">
            {astanaWebsites.map((website) => <article key={website.url}>
              <h3><a href={website.url}>{website.name}</a></h3>
              <p>{website.role}</p>
            </article>)}
          </div>
        </section>
        <section className="seo-section">
          <h2>Čo firma robí</h2>
          <div className="seo-included-list">
            {serviceOffer.map((item) => <span key={item}>✓ {item}</span>)}
          </div>
        </section>
        <section className="seo-section">
          <h2>Dokumenty a oprávnenia</h2>
          <p className="seo-lead">
            {site.compliance.asbestosRemovalAuthorization.publicVerification} Pri konkrétnej stavbe sa potrebný postup a dokumentácia riešia podľa jej podmienok.
          </p>
          <p>
            <a href={site.compliance.uvzAuthorizedCompaniesUrl} target="_blank" rel="noopener noreferrer">
              Otvoriť aktuálny register ÚVZ SR (IČO 46 157 701)
            </a>
          </p>
        </section>
        <ReadingLinks links={[
          { href: '/realizacie/', title: 'Fotografie z praxe', text: 'Pozrite si rôzne objekty a etapy práce bez vymyslených lokalít či výmer.' },
          { href: '/postup/', title: 'Ako prebieha zákazka', text: 'Čo sa rieši pred začatím, počas realizácie a po práci.' },
          { href: '/kontakt/', title: 'Priamy kontakt', text: 'Telefón, e-mail a údaje potrebné na prvé posúdenie.' },
        ]} />
        <QuoteCTA />
      </main>
    </PublicPageShell>
  );
}
