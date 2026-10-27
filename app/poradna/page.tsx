import { articles } from '@/src/content/seo-content';
import { buildPageMetadata, QuoteCTA } from '../seo-components';
import { PublicPageShell } from '../public-layout';
import { EditorialHero, EditorialPhoto, ReadingLinks } from '../editorial-components';

export const metadata = buildPageMetadata({
  title: 'Poradňa k azbestu a eternitu | ASTANA',
  description:
    'Praktické články o eternite, azbeste, cene, dokladoch, meraní strechy, balení, odvoze a bezpečnom postupe.',
  path: '/poradna/',
});

export default function AdvicePage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Poradňa', path: '/poradna/' }} hideWhatsappOnMobile>
      <main className="seo-page">
        <EditorialHero eyebrow="Vysvetlené zrozumiteľne" title="Čo potrebujete vedieť pred odstránením eternitu"
          lead="Nemusíte poznať odborné názvy ani mať pripravený projekt. Tu nájdete odpovede, ktoré vám pomôžu opísať stavbu, porovnať ponuku a naplánovať ďalšie práce."
          photoId="azbest-118" photoAlt="Drevenica so staršou strechou odfotografovaná od prístupovej cesty"
          photoCaption="Začnite tým, čo o svojej stavbe viete. Fotografie pripravujte z bezpečného miesta.">
          <div className="hero-actions"><a className="button button-primary" href="#clanky">Vybrať tému</a></div>
        </EditorialHero>
        <ReadingLinks title="Kde začať podľa vašej situácie" links={[
          { href: '/poradna/co-je-eternit-a-kedy-obsahuje-azbest/', title: 'Neviem, čo je na streche', text: 'Čo napovie dokumentácia a čo sa z fotografie nedá potvrdiť.' },
          { href: '/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/', title: 'Neviem presnú výmeru', text: 'Bezpečný odhad a príklad výpočtu plochy sedlovej strechy.' },
          { href: '/poradna/odvoz-a-balenie-azbestoveho-odpadu/', title: 'Dosky sú už zložené', text: 'Ako opísať uloženie a prístup bez ďalšej manipulácie.' },
        ]} />
        <section className="seo-section">
          <h2 id="clanky">Praktické články k vašej stavbe</h2>
          <p className="editorial-faq-intro">Vyberte otázku, ktorú práve riešite. Články odlišujú všeobecné informácie od toho, čo si treba potvrdiť pri konkrétnej zákazke.</p>
          <div className="seo-card-grid">
            {articles.map((article) => (
              <article className="editorial-advice-card" key={article.slug}>
                <EditorialPhoto id={article.photoId} alt={article.photoAlt} caption="Fotodokumentácia ASTANA" />
                <div>
                <h3><a href={`/poradna/${article.slug}/`}>{article.title}</a></h3>
                <p>{article.description}</p>
                <a href={`/poradna/${article.slug}/`}>Prečítať praktický prehľad →</a>
                </div>
              </article>
            ))}
          </div>
        </section>
        <QuoteCTA title="Potrebujete konkrétnu ponuku?" />
      </main>
    </PublicPageShell>
  );
}
