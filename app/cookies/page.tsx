import type { Metadata } from 'next';
import { PublicPageShell } from '../public-layout';
import { CookieSettingsTrigger } from '../public-widgets';
import { buildPageMetadata } from '../seo-components';

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: 'Zásady cookies | ASTANA likvidácia azbestu',
    description: 'Informácie o používaní cookies na likvidacia-eternitu.sk.',
    path: '/cookies/',
  }),
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
            <h2>Nevyhnutné úložisko</h2>
            <p>Bezpečnostné a technické úložisko môže byť potrebné na fungovanie webu, formulárov a ochranu pred zneužitím. Toto úložisko nemožno vypnúť cez tento panel.</p>
          </article>
          <article>
            <h2>Analytika a marketingové meranie</h2>
            <p>Analytika sa zapne iba po vašom súhlase. Používa pseudonymné ID relácie a môže zaznamenať navštívenú cestu, šírku obrazovky, doménu odkazujúcej stránky a UTM zdroj kampane. Pri súhlase s marketingovým meraním sa reklamné značky OpenAI Ads, Google Ads alebo Meta načítajú počas návštevy stránky. Poskytovatelia môžu pri načítaní spracovať technické údaje prehliadača a pripojenia. Samotnú konverznú udalosť odošleme až po potvrdenom odoslaní dopytu. OpenAI Ads dostane názov udalosti, stabilné pseudonymné ID udalosti, zdrojovú stránku a reklamný identifikátor z odkazu; neposielame mu meno, telefón, email, poznámku ani fotografie. Meta dostane stabilné ID udalosti, všeobecnú kategóriu materiálu, zdrojovú stránku, obmedzený údaj o prehliadači a zahashovaný email a telefón na priradenie konverzie. Hashovanie nie je anonymizácia. Pri odmietnutí marketingového merania sa nové udalosti nevytvoria a čakajúce udalosti z daného prehliadača zrušíme.</p>
          </article>
          <article>
            <h2 id="nastavenia">Zmena voľby</h2>
            <p>Voľbu analytiky a marketingového merania môžete kedykoľvek zmeniť. Odmietnutie nemá vplyv na odoslanie dopytu.</p>
            <CookieSettingsTrigger />
          </article>
          <article>
            <h2>Uloženie voľby</h2>
            <p>Vaša voľba sa uloží v prehliadači na najviac 12 mesiacov. Pri povolenom meraní môže OpenAI Ads uložiť cookies <code>__oppref</code> na 30 dní a <code>__obref</code> na 365 dní. Pri odmietnutí alebo odvolaní súhlasu sa odstránia analytické identifikátory a údaje o kampani uložené v tomto prehliadači vrátane týchto OpenAI cookies. Ak ste už odoslali dopyt so súhlasom, povolené údaje o jeho zdroji sú pripojené k dopytu v administrácii a spracúvajú sa spolu s ním; zmena cookies ich spätne z dopytu nevymaže. Identifikátory reklamných kliknutí sa v administrácii nezobrazujú.</p>
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
