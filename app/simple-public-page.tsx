import LandingClient from './landing-client';

type SimplePublicPageProps = {
  eyebrow: string;
  title: string;
  lead: string;
  sections: Array<{ title: string; text: string }>;
};

export default function SimplePublicPage({ eyebrow, title, lead, sections }: SimplePublicPageProps) {
  return (
    <>
      <header className="site-header simple-header">
        <div className="header-main">
          <a className="brand" href="/" aria-label="ASTANA">
            <img className="brand-logo" src="/assets/astana-logo.svg" alt="ASTANA" width="195" height="65" />
            <span><small>Bezpečná likvidácia azbestu</small></span>
          </a>
          <div className="header-meta">
            <a className="header-phone" href="tel:+421905217946">
              <span className="meta-icon phone" aria-hidden="true"></span>
              <strong>0905 217 946</strong>
            </a>
            <a className="button button-primary header-button" href="/#dopyt">Získať cenovú ponuku</a>
          </div>
          <button className="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false">Menu</button>
        </div>
        <nav className="site-nav" id="site-nav" aria-label="Hlavná navigácia">
          <a href="/#orientacna-cena">Orientačná cena</a>
          <a href="/#ako-to-prebieha">Ako to prebieha</a>
          <a href="/strechari/">Strechári</a>
          <a href="/realizacie/">Realizácie</a>
          <a href="/#faq">FAQ</a>
          <a href="/#kontakt">Kontakt</a>
          <a className="nav-mobile-phone" href="tel:+421905217946">
            <span className="meta-icon phone" aria-hidden="true"></span>0905 217 946
          </a>
          <a className="nav-mobile-cta" href="/#dopyt">Získať cenovú ponuku</a>
        </nav>
      </header>
      <main className="section simple-page">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hero-text">{lead}</p>
        <div className="risk-grid">
          {sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.text}</p>
            </article>
          ))}
        </div>
        <div className="final-actions">
          <a className="button button-primary" href="/#dopyt">Chcem cenovú ponuku</a>
          <a className="button button-outline" href="/">Späť na úvod</a>
        </div>
      </main>
      <LandingClient />
    </>
  );
}
