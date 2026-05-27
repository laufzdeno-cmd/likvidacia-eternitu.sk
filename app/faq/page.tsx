import { faqPageItems } from '@/src/content/seo-content';
import { buildPageMetadata, FaqSection, QuoteCTA, QuickAnswer } from '../seo-components';
import { JsonLd, buildFaqJsonLd } from '../seo-json-ld';
import { PublicPageShell } from '../public-layout';

export const metadata = buildPageMetadata({
  title: 'Časté otázky o likvidácii azbestu a eternitu | ASTANA',
  description:
    'Odpovede na otázky o eternite, azbeste, svojpomocnom odstránení, cene, dokumentácii, odvoze, balení a cenovej ponuke.',
  path: '/faq/',
  image: '/og/faq.jpg',
});

export default function FaqPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Časté otázky', path: '/faq/' }}>
      <main className="seo-page">
        <JsonLd data={buildFaqJsonLd(faqPageItems)} />
        <section className="seo-hero">
          <p className="eyebrow">FAQ</p>
          <h1>Časté otázky o likvidácii azbestu a eternitu</h1>
          <p>Vecné odpovede k bezpečnému postupu, dokumentácii, cene, odvozu a tomu, čo poslať pre cenovú ponuku.</p>
        </section>
        <QuickAnswer>
          Pri likvidácii azbestu a eternitu je najdôležitejší bezpečný a preukázateľný postup. Zákazník pošle lokalitu,
          približné m2 a fotky, odborná firma navrhne cenu, dokumentáciu, demontáž, balenie, odvoz a doklad o likvidácii.
        </QuickAnswer>
        <FaqSection faqs={faqPageItems} title="Otázky a odpovede" />
        <QuoteCTA title="Máte inú otázku?" />
      </main>
    </PublicPageShell>
  );
}
