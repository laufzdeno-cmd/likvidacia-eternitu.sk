import LandingClient from './landing-client';

const includedItems = [
  'Vypracovanie a podanie dokumentácie na RÚVZ',
  'Vypracovanie a podanie dokumentácie na OÚŽP',
  'Úradné poplatky, ak sa vzťahujú',
  'Identifikačné listy nebezpečného odpadu',
  'Protokol / dokumentácia k stabilizácii',
  'Stabilizácia azbestového materiálu',
  'Odborná demontáž azbestu / eternitu',
  'Balenie do označených hermetických vriec',
  'Dekontaminácia pracovného priestoru',
  'Odvoz na skládku nebezpečného odpadu',
  'Potvrdenie o legálnej likvidácii po úhrade faktúry',
];

const faq = [
  ['Ako rýchlo dostanem cenovú ponuku?', 'Po zadaní približnej výmery v m² a základných údajov pripravujeme nezáväznú cenovú ponuku spravidla do 24 hodín počas pracovných dní. Fotky nám pomôžu spresniť prístup, typ materiálu a náročnosť.'],
  ['Čo potrebujete na nacenenie?', 'Najmä kontakt, lokalitu, typ objektu, typ materiálu a približnú výmeru v m². Fotky sú voliteľné, ale pomáhajú spresniť nacenenie.'],
  ['Musím mať presnú výmeru?', 'Nie. Stačí približná výmera. Finálna cena sa môže upraviť podľa skutočného rozsahu po doplnení údajov alebo obhliadke.'],
  ['Je potrebné riešiť úrady?', 'Pri azbeste treba počítať s úradným postupom a zákonnými lehotami. Po potvrdení objednávky pripravíme potrebné podania a dokumentáciu.'],
  ['Dostanem potvrdenie o likvidácii?', 'Po dokončení a úhrade zákazky odovzdávame potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu a typu zákazky.'],
  ['Čo ak ešte nemám strechára?', 'Uveďte to v dopyte. Podľa kraja a termínu preveríme vhodného spolupracujúceho partnera.'],
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://likvidacia-eternitu.sk/#organization',
      name: 'ASTANA',
      legalName: 'ASTANA, s.r.o.',
      url: 'https://likvidacia-eternitu.sk/',
      telephone: '+421905217946',
      email: 'astana@astana.sk',
      foundingDate: '2011',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Scherffelova 1364/28',
        postalCode: '058 01',
        addressLocality: 'Poprad',
        addressCountry: 'SK',
      },
      sameAs: ['https://astana.sk'],
    },
    {
      '@type': 'ProfessionalService',
      '@id': 'https://likvidacia-eternitu.sk/#business',
      name: 'ASTANA - likvidácia azbestu a eternitu',
      url: 'https://likvidacia-eternitu.sk/',
      telephone: '+421905217946',
      email: 'astana@astana.sk',
      areaServed: { '@type': 'Country', name: 'Slovensko' },
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Scherffelova 1364/28',
        postalCode: '058 01',
        addressLocality: 'Poprad',
        addressCountry: 'SK',
      },
    },
    {
      '@type': 'Service',
      '@id': 'https://likvidacia-eternitu.sk/#service',
      name: 'Likvidácia azbestu a eternitu',
      serviceType: 'Odborná demontáž, stabilizácia, balenie, odvoz a dokumentácia',
      provider: { '@id': 'https://likvidacia-eternitu.sk/#organization' },
      areaServed: 'Slovensko',
      description:
        'Odborné odstránenie materiálov obsahujúcich azbest vrátane dokumentácie, stabilizácie materiálu, balenia, odvozu a potvrdenia o legálnej likvidácii.',
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://likvidacia-eternitu.sk/#faq',
      mainEntity: faq.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://likvidacia-eternitu.sk/#breadcrumbs',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Úvod', item: 'https://likvidacia-eternitu.sk/' }],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://likvidacia-eternitu.sk/#website',
      name: 'Likvidácia azbestu a eternitu ASTANA',
      url: 'https://likvidacia-eternitu.sk/',
      publisher: { '@id': 'https://likvidacia-eternitu.sk/#organization' },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="site-header" id="top">
        <div className="header-main">
          <a className="brand" href="/" aria-label="ASTANA - likvidácia azbestu a eternitu">
            <img className="brand-logo" src="/assets/astana-logo.svg" alt="ASTANA" width="195" height="65" />
            <span>
              <small>Bezpečná likvidácia azbestu</small>
            </span>
          </a>
          <div className="header-meta" aria-label="Kontaktné údaje">
            <span className="meta-item">
              <span className="meta-icon pin" aria-hidden="true"></span>Pôsobíme po celej SR
            </span>
            <a className="meta-item" href="mailto:astana@astana.sk">
              <span className="meta-icon mail" aria-hidden="true"></span>astana@astana.sk
            </a>
            <a className="header-phone" href="tel:+421905217946">
              <span className="meta-icon phone" aria-hidden="true"></span>
              <strong>0905 217 946</strong>
              <small>Po-Pia 7:00 - 18:00</small>
            </a>
            <a className="button button-primary header-button" href="#dopyt">
              Chcem cenovú ponuku
            </a>
          </div>
          <button className="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false">
            Menu
          </button>
        </div>
        <nav className="site-nav" id="site-nav" aria-label="Hlavná navigácia">
          <a href="#top" aria-current="page">
            Úvod
          </a>
          <a href="#ako-to-prebieha">Ako to prebieha</a>
          <a href="#cena">Čo je v cene</a>
          <a href="#preco">Prečo ASTANA</a>
          <a href="#faq">FAQ</a>
          <a href="#kontakt">Kontakt</a>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Dokumentácia, demontáž, balenie, odvoz aj potvrdenie</p>
            <h1 id="hero-title">Bezpečná likvidácia azbestu a eternitu po celom Slovensku</h1>
            <p className="hero-claim">Bezpečne. Legálne. S dokladmi.</p>
            <p className="hero-text">
              Zadajte približnú výmeru v m² a priložte fotky. Pripravíme cenovú ponuku, vybavíme dokumentáciu,
              demontáž, balenie, odvoz aj potvrdenie o legálnej likvidácii.
            </p>
            <ul className="hero-points" aria-label="Ako pripravujeme cenovú ponuku">
              <li>Cenu počítame hlavne podľa m²</li>
              <li>Fotky pomôžu spresniť prístup a typ materiálu</li>
              <li>Cenová ponuka do 24 hodín</li>
              <li>Doprava nad 100 m² zdarma</li>
            </ul>
            <div className="hero-actions">
              <a className="button button-primary" href="#dopyt">
                Chcem cenovú ponuku
              </a>
              <a className="button button-outline" href="tel:+421905217946">
                <span className="button-phone" aria-hidden="true"></span>Zavolať 0905 217 946
              </a>
            </div>
          </div>

          <div className="hero-photo" role="img" aria-label="Pracovníci pri odbornej demontáži eternitovej strechy"></div>

          <aside className="quote-card" id="dopyt" aria-labelledby="quote-title">
            <h2 id="quote-title">
              Vyplňte výmeru v m² a získajte <span>cenovú ponuku</span>
            </h2>
            <p>Uveďte približnú výmeru, lokalitu a typ materiálu. Fotky pomôžu spresniť prístup a náročnosť.</p>
            <form className="lead-form" action="/api/lead/" method="post" encType="multipart/form-data" noValidate>
              <input className="hp-field" type="text" name="companyWebsite" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="field">
                <label htmlFor="fullName">Meno a priezvisko *</label>
                <input id="fullName" name="fullName" type="text" autoComplete="name" placeholder="Meno a priezvisko *" required />
              </div>
              <div className="field">
                <label htmlFor="phone">Telefón *</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="Telefón *" required />
              </div>
              <div className="field">
                <label htmlFor="email">Email *</label>
                <input id="email" name="email" type="email" autoComplete="email" placeholder="Email *" required />
              </div>
              <div className="field">
                <label htmlFor="city">Obec / mesto *</label>
                <input id="city" name="city" type="text" autoComplete="address-level2" placeholder="Obec / mesto *" required />
              </div>
              <div className="field area-field">
                <label htmlFor="areaEstimate">Približná výmera v m² *</label>
                <input id="areaEstimate" name="areaEstimate" type="number" inputMode="numeric" min="1" placeholder="napr. 120" required />
                <p className="field-help">Ak neviete presne, uveďte odhad. Presné m² sa overia podľa skutočnosti.</p>
              </div>
              <div className="field">
                <label htmlFor="district">Okres</label>
                <input id="district" name="district" type="text" autoComplete="address-level1" placeholder="Okres" />
              </div>
              <div className="field">
                <label htmlFor="objectType">Typ objektu *</label>
                <select id="objectType" name="objectType" required defaultValue="">
                  <option value="">Typ objektu *</option>
                  <option>Rodinný dom</option>
                  <option>Hospodárska budova</option>
                  <option>Garáž / prístrešok</option>
                  <option>Bytový dom / panelák</option>
                  <option>Administratívna budova</option>
                  <option>Priemyselný objekt</option>
                  <option>Iné</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="materialType">Typ azbestového materiálu *</label>
                <select id="materialType" name="materialType" required defaultValue="">
                  <option value="">Aký materiál chcete odstrániť? *</option>
                  <option>Vlnitý eternit</option>
                  <option>Hladký / štvorcový eternit</option>
                  <option>Azbestocementové rúry</option>
                  <option>Boletické panely</option>
                  <option>Azbestové obloženie / fasáda</option>
                  <option>Azbest v interiéri</option>
                  <option>Neviem posúdiť</option>
                  <option>Iné</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="roofer">Máte už strechára?</label>
                <select id="roofer" name="roofer" defaultValue="Nemám strechára">
                  <option>Nemám strechára</option>
                  <option>Mám strechára</option>
                  <option>Potrebujem odporučiť strechára</option>
                  <option>Riešim iba likvidáciu bez novej strechy</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="term">Kedy to chcete riešiť?</label>
                <select id="term" name="term" defaultValue="Čo najskôr">
                  <option>Čo najskôr</option>
                  <option>Do 1 mesiaca</option>
                  <option>Do 3 mesiacov</option>
                  <option>Mám konkrétny termín</option>
                  <option>Len zisťujem cenu</option>
                </select>
              </div>
              <div className="field file-field field-full">
                <label htmlFor="photos">Nahrajte fotky</label>
                <label className="file-drop" htmlFor="photos">
                  <span className="file-drop-icon" aria-hidden="true"></span>
                  <strong>Vybrať fotky zo zariadenia</strong>
                  <span>Fotky sú voliteľné, ale pomôžu nám spresniť typ materiálu, prístup a náročnosť.</span>
                </label>
                <input className="file-input" id="photos" name="photos" type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" multiple />
                <p className="field-help">Podporované sú JPG, PNG, WEBP, HEIC alebo PDF. Fotky z mobilu úplne stačia.</p>
                <div className="file-preview" aria-live="polite"></div>
              </div>
              <div className="field field-full">
                <label htmlFor="note">Poznámka</label>
                <textarea id="note" name="note" rows={2} placeholder="Prístup, konkrétny termín, kontakt na strechára..."></textarea>
              </div>
              <label className="consent">
                <input type="checkbox" name="gdpr" required /> Súhlasím so spracovaním údajov na vybavenie cenovej ponuky.
              </label>
              <button className="button button-primary form-submit" type="submit">
                Odoslať dopyt
              </button>
              <p className="form-security">Vaše údaje sú u nás v bezpečí. Použijeme ich iba na spracovanie cenovej ponuky.</p>
              <p className="form-status" role="status" aria-live="polite"></p>
            </form>
          </aside>
        </section>

        <section className="trust-bar" aria-label="Dôveryhodné prvky služby">
          <div className="trust-item"><span className="line-icon shield" aria-hidden="true"></span><strong>Od roku 2011</strong></div>
          <div className="trust-item"><span className="line-icon map" aria-hidden="true"></span><strong>Pôsobíme po celej SR</strong></div>
          <div className="trust-item"><span className="line-icon truck" aria-hidden="true"></span><strong>Doprava nad 100 m² zdarma</strong></div>
          <div className="trust-item"><span className="line-icon document" aria-hidden="true"></span><strong>Vybavíme RÚVZ a OÚŽP</strong></div>
          <div className="trust-item"><span className="line-icon certificate" aria-hidden="true"></span><strong>Potvrdenie o legálnej likvidácii</strong></div>
        </section>

        <section className="section included-section" id="cena" aria-labelledby="included-title">
          <div className="section-heading">
            <p className="eyebrow">Čo je v cene</p>
            <h2 id="included-title">V cene máte <span>všetko potrebné</span></h2>
          </div>
          <div className="included-grid">
            {includedItems.map((item) => (
              <article key={item}>
                <span className="line-icon document" aria-hidden="true"></span>
                <strong>{item}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="transport-banner" aria-label="Doprava zdarma nad 100 metrov štvorcových">
          <span className="line-icon truck" aria-hidden="true"></span>
          <strong>Dopravu pri zákazkách nad 100 m² neúčtujeme!</strong>
        </section>

        <section className="section process-section" id="ako-to-prebieha" aria-labelledby="process-title">
          <div className="section-heading">
            <p className="eyebrow">Ako to prebieha</p>
            <h2 id="process-title">Päť jasných krokov bez zbytočného chaosu</h2>
          </div>
          <ol className="process-list">
            <li><span>1</span><strong>Zadáte výmeru a údaje</strong><p>Uveďte približné m², lokalitu a typ materiálu. Fotky pomôžu nacenenie spresniť.</p></li>
            <li><span>2</span><strong>Pripravíme cenu</strong><p>Do 24 hodín pripravíme nezáväznú cenovú ponuku na mieru.</p></li>
            <li><span>3</span><strong>Vybavíme dokumentáciu</strong><p>Po potvrdení objednávky pripravíme potrebné podania a doklady.</p></li>
            <li><span>4</span><strong>Demontáž a odvoz</strong><p>Materiál stabilizujeme, zabalíme do obalov a odvezieme.</p></li>
            <li><span>5</span><strong>Odovzdáme doklady</strong><p>Po ukončení a úhrade odovzdáme dokumentáciu k likvidácii.</p></li>
          </ol>
        </section>

        <section className="section risk-section" aria-labelledby="risk-title">
          <div className="section-heading">
            <p className="eyebrow">Prečo to neriešiť svojpomocne</p>
            <h2 id="risk-title">Azbest potrebuje odborný postup</h2>
          </div>
          <div className="risk-grid">
            <article><h3>Riziko pri manipulácii</h3><p>Nebezpečný prach a vlákna môžu ohroziť zdravie pri nesprávnom postupe.</p></article>
            <article><h3>Úradné povinnosti</h3><p>Pri azbeste treba riešiť zákonný postup a dokumentáciu.</p></article>
            <article><h3>Odvoz odpadu</h3><p>Azbest nepatrí do bežného odpadu. Musí ísť na určené miesto.</p></article>
            <article><h3>Zodpovednosť</h3><p>Nesprávny postup môže vytvoriť problém s úradmi, susedmi alebo škodou.</p></article>
          </div>
        </section>

        <section className="section why-section" id="preco" aria-labelledby="why-title">
          <div className="why-card">
            <div>
              <p className="eyebrow">Prečo ASTANA</p>
              <h2 id="why-title">Prečo si vybrať ASTANA?</h2>
            </div>
            <ul className="why-list">
              <li>Špecializujeme sa na likvidáciu azbestu a eternitu.</li>
              <li>Fungujeme od roku 2011.</li>
              <li>Pôsobíme po celom Slovensku.</li>
              <li>Vybavíme dokumentáciu, demontáž, balenie, odvoz aj potvrdenie.</li>
              <li>Pomôžeme aj so zladením so strechárom.</li>
            </ul>
          </div>
        </section>

        <section className="section faq-section" id="faq" aria-labelledby="faq-title">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">FAQ</p>
              <h2 id="faq-title">Najčastejšie otázky</h2>
            </div>
            <p>Krátke odpovede na veci, ktoré ľudia riešia pred cenovou ponukou.</p>
          </div>
          <div className="faq-grid">
            {faq.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta" aria-labelledby="final-title">
          <div>
            <p className="eyebrow">Rýchla odpoveď</p>
            <h2 id="final-title">
              Zadajte m² a získajte cenovú ponuku <span>do 24 hodín</span>
            </h2>
            <p>Ozvite sa nám a postaráme sa o bezpečnú a legálnu likvidáciu azbestu bez zbytočných komplikácií.</p>
          </div>
          <div className="final-actions">
            <a className="button button-primary" href="#dopyt">Chcem cenovú ponuku</a>
            <a className="button button-outline" href="tel:+421905217946">Zavolať 0905 217 946</a>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="kontakt">
        <div>
          <a className="brand footer-brand" href="/" aria-label="ASTANA">
            <img className="brand-logo" src="/assets/astana-logo.svg" alt="ASTANA" width="195" height="65" />
            <span><small>Bezpečná likvidácia azbestu</small></span>
          </a>
          <p>Likvidácia azbestu a eternitu po celom Slovensku. Cenová ponuka, dokumentácia, demontáž, balenie, odvoz a potvrdenie.</p>
        </div>
        <div>
          <h2>Kontakt</h2>
          <span>ASTANA, s.r.o.</span>
          <span>Scherffelova 1364/28</span>
          <span>058 01 Poprad</span>
          <a href="tel:+421905217946">0905 217 946</a>
          <a href="mailto:astana@astana.sk">astana@astana.sk</a>
        </div>
        <div>
          <h2>Firma</h2>
          <span>IČO: 46 157 701</span>
          <span>DIČ: 2023253771</span>
          <span>IČ DPH: SK2023253771</span>
        </div>
        <div>
          <h2>Užitočné</h2>
          <a href="/ochrana-osobnych-udajov/">GDPR</a>
          <a href="/cookies/">Cookies</a>
          <a href="/podmienky-pouzivania/">Podmienky používania</a>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
      </footer>

      <div className="mobile-sticky-cta" aria-label="Rýchle kontakty">
        <a href="tel:+421905217946">Zavolať</a>
        <a href="#dopyt">Cenová ponuka</a>
      </div>
      <LandingClient />
    </>
  );
}
