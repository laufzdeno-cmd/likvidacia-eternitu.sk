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
              <small>Po-Pia 7:00 - 18:00</small>
            </a>
            <a className="button button-primary header-button" href="/#dopyt">Chcem cenovú ponuku</a>
          </div>
        </div>
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
    </>
  );
}
