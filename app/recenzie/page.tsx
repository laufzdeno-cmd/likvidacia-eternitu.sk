import { buildPageMetadata, QuickAnswer } from '../seo-components';
import { PublicPageShell } from '../public-layout';

export const metadata = buildPageMetadata({
  title: 'Recenzie zákazníkov | ASTANA',
  description: 'Transparentný stav recenzií ASTANA. Nezverejňujeme anonymné ani dodatočne vytvorené hodnotenia.',
  path: '/recenzie/',
  image: '/og/recenzie.jpg',
});

export default function ReviewsPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Recenzie', path: '/recenzie/' }}>
      <main className="seo-page">
        <section className="seo-hero">
          <p className="eyebrow">Recenzie</p>
          <h1>Recenzie zákazníkov ASTANA</h1>
          <p>Nezverejňujeme anonymné ani dodatočne vytvorené hodnotenia.</p>
        </section>
        <QuickAnswer>
          Recenzie sme doteraz systematicky nezbierali. Preto nezverejňujeme anonymné ani dodatočne vytvorené hodnotenia.
          Namiesto toho ukazujeme reálne fotky našich prác a vysvetľujeme úradný postup, ktorý musí legálna likvidácia azbestu spĺňať.
        </QuickAnswer>
        <section className="seo-section">
          <h2>Ako pracujeme s dôveryhodnosťou</h2>
          <p className="seo-lead">
            Recenzie sme doteraz systematicky nezbierali. Preto nezverejňujeme anonymné ani dodatočne vytvorené hodnotenia. Namiesto toho ukazujeme reálne fotky našich prác a vysvetľujeme úradný postup, ktorý musí legálna likvidácia azbestu spĺňať.
          </p>
          <div className="seo-included-list">
            <a href="/realizacie/">Pozrieť reálne fotky prác ASTANA</a>
            <a href="/postup/">Pozrieť úradný postup likvidácie</a>
            <a href="/o-firme/">Overiť firemné údaje</a>
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}
