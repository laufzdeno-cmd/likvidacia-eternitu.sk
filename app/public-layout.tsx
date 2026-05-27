import LandingClient from './landing-client';
import PublicBaseClient from './public-base-client';
import PublicWidgets from './public-widgets';
import { BreadcrumbJsonLd } from './seo-json-ld';

export function PublicHeader() {
  return (
    <header className="site-header simple-header">
      <div className="header-main">
        <a className="brand" href="/" aria-label="ASTANA">
          <img className="brand-logo" src="/assets/astana-logo.png" alt="ASTANA" width="195" height="65" />
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
        <a href="/postup/">Ako to prebieha</a>
        <a href="/strechari/">Strechári</a>
        <a href="/realizacie/">Realizácie</a>
        <a href="/faq/">FAQ</a>
        <a href="/#kontakt">Kontakt</a>
        <a className="nav-mobile-phone" href="tel:+421905217946">
          <span className="meta-icon phone" aria-hidden="true"></span>0905 217 946
        </a>
        <a className="nav-mobile-cta" href="/#dopyt">Získať cenovú ponuku</a>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="site-footer" id="kontakt">
      <div>
        <a className="footer-brand" href="/" aria-label="ASTANA">
          <img className="brand-logo" src="/assets/astana-logo.png" alt="ASTANA" width="195" height="65" />
          <span><small>Likvidácia azbestu a eternitu</small></span>
        </a>
        <p>Bezpečná likvidácia azbestu, eternitu a nebezpečného odpadu po celom Slovensku.</p>
      </div>
      <div>
        <h2>Kontakt</h2>
        <a href="tel:+421905217946">0905 217 946</a>
        <a href="mailto:astana@astana.sk">astana@astana.sk</a>
        <span>Po-Pia 7:00-18:00</span>
      </div>
      <div>
        <h2>Služby</h2>
        <a href="/likvidacia-azbestu/">Likvidácia azbestu</a>
        <a href="/likvidacia-eternitu/">Likvidácia eternitu</a>
        <a href="/postup/">Ako to prebieha</a>
        <a href="/cena-likvidacie-azbestu/">Cena likvidácie</a>
      </div>
      <div>
        <h2>Užitočné linky</h2>
        <a href="/faq/">Časté otázky</a>
        <a href="/realizacie/">Realizácie</a>
        <a href="/recenzie/">Recenzie</a>
        <a href="/cookies/">Cookies</a>
      </div>
      <div>
        <h2>Firma</h2>
        <span>ASTANA, s.r.o.</span>
        <span>Scherffelova 1364/28</span>
        <span>058 01 Poprad</span>
        <a href="/ochrana-osobnych-udajov/">Ochrana osobných údajov</a>
      </div>
    </footer>
  );
}

export function PublicPageShell({
  children,
  breadcrumb,
  client = 'base',
}: {
  children: React.ReactNode;
  breadcrumb?: { name: string; path: string };
  client?: 'base' | 'full';
}) {
  return (
    <>
      {breadcrumb ? <BreadcrumbJsonLd name={breadcrumb.name} path={breadcrumb.path} /> : null}
      <PublicHeader />
      {children}
      <PublicFooter />
      {client === 'full' ? <LandingClient /> : <PublicBaseClient />}
      <PublicWidgets />
    </>
  );
}
