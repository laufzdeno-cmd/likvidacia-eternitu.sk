import { faqPageItems } from '@/src/content/seo-content';
import { buildPageMetadata, FaqSection, QuoteCTA } from '../seo-components';
import { JsonLd, buildFaqJsonLd } from '../seo-json-ld';
import { PublicPageShell } from '../public-layout';
import { EditorialHero, ReadingLinks } from '../editorial-components';
import { pagePhotoId } from '@/src/content/public-photo-assignments';

const groups = [
  { id: 'material', title: 'Materiál a bezpečnosť', indexes: [0, 1, 2, 16] },
  { id: 'ponuka', title: 'Cena, výmera a podklady', indexes: [3, 5, 9, 13, 14, 15] },
  { id: 'realizacia', title: 'Príprava, odvoz a doklady', indexes: [4, 6, 7, 8, 10, 11, 12] },
];

export const metadata = buildPageMetadata({
  title: 'Časté otázky o likvidácii azbestu a eternitu | ASTANA',
  description:
    'Odpovede na otázky o eternite, azbeste, svojpomocnom odstránení, cene, dokumentácii, odvoze, balení a cenovej ponuke.',
  path: '/faq/',
  image: '/og/faq.jpg',
});

export default function FaqPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Časté otázky', path: '/faq/' }} hideWhatsappOnMobile>
      <main className="seo-page">
        <JsonLd data={buildFaqJsonLd(faqPageItems)} />
        <EditorialHero eyebrow="Odpovede pred prvým dopytom" title="Časté otázky o azbeste a eternite"
          lead="Potrebujete vedieť, čo je na streche, ako sa počíta cena alebo čo dostanete po práci? Vyberte si tému nižšie. Ak svoju situáciu nenájdete, opíšte nám ju. Na prvý kontakt stačí odhad výmery. Fotky sú voliteľné."
          photoId={pagePhotoId('/faq/')}
          photoCaption="Ošetrenie eternitovej krytiny pred demontážou – ASTANA, s.r.o." />
        <nav className="editorial-toc" aria-label="Témy otázok"><p>Čo práve riešite?</p><ul>{groups.map(group => <li key={group.id}><a href={`#${group.id}`}>{group.title}</a></li>)}</ul></nav>
        {groups.map(group => <div id={group.id} key={group.id}><FaqSection title={group.title} faqs={group.indexes.map(index => faqPageItems[index]).filter(Boolean)} /></div>)}
        <ReadingLinks title="Keď potrebujete podrobnejšie vysvetlenie" links={[
          { href: '/poradna/', title: 'Praktická poradňa', text: 'Príklady výmery, porovnanie ponúk aj príprava podkladov.' },
          { href: '/postup/', title: 'Celý postup', text: 'Nadväznosť od prvého dopytu po odovzdanie zákazky.' },
          { href: '/kontakt/', title: 'Vaša vlastná otázka', text: 'Kontaktujte nás s opisom konkrétnej stavby.' },
        ]} />
        <QuoteCTA title="Máte inú otázku?" />
      </main>
    </PublicPageShell>
  );
}
