import { articles } from '@/src/content/seo-content';
import { buildPageMetadata, QuickAnswer, QuoteCTA } from '../seo-components';
import { PublicPageShell } from '../public-layout';

export const metadata = buildPageMetadata({
  title: 'Poradňa k azbestu a eternitu | ASTANA',
  description:
    'Praktické články o eternite, azbeste, cene, dokladoch, meraní strechy, balení, odvoze a bezpečnom postupe.',
  path: '/poradna/',
});

export default function AdvicePage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Poradňa', path: '/poradna/' }}>
      <main className="seo-page">
        <section className="seo-hero">
          <p className="eyebrow">Poradňa</p>
          <h1>Poradňa k azbestu a eternitu</h1>
          <p>Praktické odpovede pre majiteľov domov, firmy, správcov objektov a strechárov.</p>
        </section>
        <QuickAnswer>
          Poradňa vysvetľuje, čo je eternit, kedy môže obsahovať azbest, prečo je dôležitý odborný postup,
          čo ovplyvňuje cenu a aké údaje poslať pre cenovú ponuku.
        </QuickAnswer>
        <section className="seo-section">
          <h2>Články</h2>
          <div className="seo-card-grid">
            {articles.map((article) => (
              <article key={article.slug}>
                <h3><a href={`/poradna/${article.slug}/`}>{article.title}</a></h3>
                <p>{article.description}</p>
              </article>
            ))}
          </div>
        </section>
        <QuoteCTA title="Potrebujete konkrétnu ponuku?" />
      </main>
    </PublicPageShell>
  );
}
