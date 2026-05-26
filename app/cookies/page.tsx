import type { Metadata } from 'next';
import { PublicPageShell } from '../public-layout';

export const metadata: Metadata = {
  title: 'Zásady cookies | ASTANA likvidácia azbestu',
  description: 'Informácie o používaní cookies na likvidacia-eternitu.sk.',
  alternates: { canonical: '/cookies/' },
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <PublicPageShell breadcrumb={{ name: 'Zásady cookies', path: '/cookies/' }}>
      <main className="seo-page">
        <section className="seo-hero">
          <p className="eyebrow">Cookies</p>
          <h1>Zásady používania cookies</h1>
          <p>Prehľad toho, aké cookies používame a ako s nimi môžete pracovať.</p>
        </section>
        <section className="seo-section seo-grid-2">
          <article>
            <h2>Čo sú cookies</h2>
            <p>Cookies sú malé súbory ukladané v prehliadači. Pomáhajú stránke fungovať správne a zapamätať si základné nastavenia.</p>
          </article>
          <article>
            <h2>Aké cookies používame</h2>
            <p>Používame funkčné cookies potrebné pre bezpečné fungovanie stránky a formulára. Analytické údaje spracúvame first-party spôsobom bez IP adries.</p>
          </article>
          <article>
            <h2>Ako ich vypnúť</h2>
            <p>Cookies môžete obmedziť v nastaveniach svojho prehliadača. Niektoré funkcie stránky však potom nemusia fungovať pohodlne.</p>
          </article>
          <article>
            <h2>Kontakt</h2>
            <p>V otázkach ochrany údajov nás kontaktujte na astana@astana.sk.</p>
          </article>
        </section>
      </main>
    </PublicPageShell>
  );
}
