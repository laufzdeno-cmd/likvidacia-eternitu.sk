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
            <p>Používame nevyhnutné uloženie voľby cookie súhlasu. Po voľbe „Prijať všetky“ sa môže zapnúť first-party analytika a marketingové meranie; po voľbe „Len nevyhnutné“ zostáva vypnuté. Analytické záznamy neobsahujú uloženú IP adresu.</p>
            <p>Po marketingovom súhlase načítame Google tag na meranie úspešných dopytov z Google Ads. Konverziu zaznamenáme až po prijatí dopytu serverom, nie pri kliknutí na tlačidlo. Odovzdávame technický identifikátor odoslania; meno, email ani telefón do tejto konverznej udalosti nepridávame. Google pri načítaní tagu spracúva aj technické údaje spojenia. Bez súhlasu tag nenačítame. Rozšírené konverzie nezapíname.</p>
          </article>
          <article>
            <h2>Vaša voľba</h2>
            <p>Voľbu môžete zmeniť vymazaním uloženia stránky v prehliadači a opätovným načítaním webu. Pri zmene na „Len nevyhnutné“ sa voliteľné meranie ďalej nespúšťa. Nové marketingové alebo analytické nástroje dopĺňame iba s aktualizovanou informáciou.</p>
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
