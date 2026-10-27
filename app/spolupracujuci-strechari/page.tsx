import { buildPageMetadata, FaqSection, QuoteCTA } from '../seo-components';
import { PublicPageShell } from '../public-layout';
import { EditorialHero, ReadingLinks, UsefulChecklist } from '../editorial-components';
import { pagePhotoId } from '@/src/content/public-photo-assignments';
import { JsonLd, buildFaqJsonLd } from '../seo-json-ld';

export const metadata = buildPageMetadata({
  title: 'Strechár po odstránení eternitu: nadväznosť prác | ASTANA',
  description: 'Máte vlastného strechára alebo ho ešte hľadáte? Ako zladiť odstránenie eternitu s novou strechou, čo si dohodnúť a kto zodpovedá za jednotlivé práce.',
  path: '/spolupracujuci-strechari/',
});

const faqs = [
  { question: 'Zabezpečí ASTANA automaticky aj novú strechu?', answer: 'Rozsah služieb ASTANY určuje konkrétna cenová ponuka. Ak vám odporučíme samostatného strechára, jeho novú strechu, cenu, dohodu a zodpovednosť riešite priamo s ním. Odporučenie samo osebe nie je objednávkou.' },
  { question: 'Môžeme spolupracovať aj s mojím vlastným strechárom?', answer: 'Áno. Uveďte jeho plánovaný termín a požadovanú nadväznosť. Demontáž a pokračovanie strešných prác treba zosúladiť podľa stavby, počasia, potrebného postupu a kapacity.' },
  { question: 'Čo ak ešte nemám vybraného strechára?', answer: 'Napíšte obec, rozsah strechy a plánovaný termín. Podľa regiónu a dostupnej kapacity preveríme možnosť odporučenia samostatného partnera. Dostupnosť konkrétneho strechára nie je automaticky zaručená.' },
];

export default function PartnerRoofersPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Spolupracujúci strechári', path: '/spolupracujuci-strechari/' }} hideWhatsappOnMobile>
      <main className="seo-page">
        <JsonLd data={buildFaqJsonLd(faqs)} />
        <EditorialHero eyebrow="Výmena krytiny bez zbytočného čakania" title="Potrebujete strechára po odstránení eternitu?"
          lead="Ak strechára už máte, dohodneme nadväznosť demontáže na jeho prácu. Ak ho ešte hľadáte, napíšte nám obec a plánovaný termín. Podľa regiónu a kapacity preveríme možnosť odporučenia samostatného partnera."
          photoId={pagePhotoId('/spolupracujuci-strechari/')}
          photoCaption="Strešná konštrukcia po demontáži eternitu – ASTANA, s.r.o.">
          <div className="hero-actions"><a className="button button-primary" href="/#dopyt">Opísať moju strechu</a><a className="button button-outline" href="/strechari/">Som strechár a chcem spolupracovať</a></div>
        </EditorialHero>
        <section className="seo-section"><h2>Máte vlastného strechára? Začnime jeho termínom.</h2><p className="editorial-faq-intro">Pošlite požadovaný nástup a povedzte, či je potvrdený alebo predbežný. Dôležité je aj to, akú časť strechy má partia prevziať. Odstránenie azbestu, príprava podkladov a nová krytina majú vlastné kroky; nestačí objednať obe firmy na rovnaké ráno bez dohody.</p><p className="editorial-faq-intro">Vopred si vyjasnite, kto preberie pracovisko a kto zabezpečí prípadné dočasné zakrytie. Konkrétny deň a postup potvrdíme podľa rozsahu, kapacity, počasia a potrebnej prípravy.</p></section>
        <section className="seo-section"><h2>Keď novú strechu ešte nemáte s kým riešiť</h2><p className="editorial-faq-intro">Do dopytu napíšte, že strechára hľadáte. Pomôže obec, približná plocha a predstava, kedy chcete strechu meniť. Možnosť odporučenia preveríme podľa konkrétnej oblasti a dostupnosti. Nejde o automaticky rezervovanú kapacitu ani o jednu spoločnú cenu za všetky profesie.</p><p className="editorial-faq-intro">So samostatným partnerom si potvrďte rozsah novej strechy, použitý materiál, cenu, termín a zodpovednosť za jeho prácu. Rozsah služieb ASTANY vždy vyplýva z našej vlastnej ponuky. Ak niečo nie je jasné, pýtajte sa ešte pred potvrdením objednávok.</p></section>
        <UsefulChecklist title="Pri výbere a koordinácii strechára si overte" items={[
          'Ktoré práce a materiály jeho ponuka zahŕňa a čo sa rieši zvlášť.',
          'Či sú v rozsahu aj opravy konštrukcie zistené až po odkrytí.',
          'Nadväznosť termínov, prevzatie pracoviska a prípadné dočasné zakrytie.',
          'Komu hlásiť zmenu rozsahu alebo termínu a kto ju potvrdí.',
        ]} />
        <section className="seo-section"><h2>Vyberajte podľa porovnateľnej práce</h2><p className="editorial-faq-intro">Pri výbere strechára si pozrite podobné strechy, pýtajte sa na konkrétny rozsah a porovnávajte celé ponuky. Fotografia peknej krytiny sama neodpovie, či sú v cene aj súvisiace klampiarske práce, detaily či príprava podkladu. Ak niektorá položka chýba, nechajte si ju vysvetliť pred rozhodnutím.</p></section>
        <FaqSection faqs={faqs} title="Otázky k novej streche a partnerom" />
        <ReadingLinks links={[
          { href: '/postup/#nadvazujuca-strecha', title: 'Ako zladíme nadväznosť', text: 'Odstránenie krytiny a nová strecha krok za krokom.' },
          { href: '/cena-likvidacie-azbestu/', title: 'Cena odstránenia eternitu', text: 'Čo ovplyvňuje ponuku na azbestovú časť zákazky.' },
          { href: '/strechari/', title: 'Spolupráca pre strechárov', text: 'Podklady a kontakt pre samostatné strechárske firmy.' },
        ]} />
        <QuoteCTA title="Naplánujme odstránenie starej krytiny" />
      </main>
    </PublicPageShell>
  );
}
