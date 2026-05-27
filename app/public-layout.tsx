import LandingClient from './landing-client';
import PublicBaseClient from './public-base-client';
import PublicWidgets from './public-widgets';
import { companyAddressLine, emailLink, phoneLink, site } from '@/src/content/site';
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
          <a className="header-phone" href={phoneLink}>
            <span className="meta-icon phone" aria-hidden="true"></span>
            <strong>{site.phone}</strong>
          </a>
          <a className="button button-primary header-button" href="/#dopyt">Získať cenovú ponuku</a>
        </div>
        <button className="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false">Menu</button>
      </div>
      <nav className="site-nav" id="site-nav" aria-label="Hlavná navigácia">
        <a href="/#orientacna-cena">Orientačná cena</a>
        <a href="/likvidacia-azbestu/">Azbest</a>
        <a href="/likvidacia-eternitu/">Eternit</a>
        <a href="/postup/">Postup</a>
        <a href="/realizacie/">Realizácie</a>
        <a href="/faq/">FAQ</a>
        <a href="/kontakt/">Kontakt</a>
        <a className="nav-mobile-phone" href={phoneLink}>
          <span className="meta-icon phone" aria-hidden="true"></span>{site.phone}
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
        <p>Odborná likvidácia azbestu, eternitu a nebezpečného odpadu po celom Slovensku.</p>
      </div>
      <div>
        <h2>Kontakt</h2>
        <span>{site.legalName}</span>
        <span>{companyAddressLine}</span>
        <a href={phoneLink}>{site.phone}</a>
        <a href={emailLink}>{site.email}</a>
        <span>{site.openingHours}</span>
      </div>
      <div>
        <h2>Služby</h2>
        <a href="/likvidacia-azbestu/">Likvidácia azbestu</a>
        <a href="/likvidacia-eternitu/">Likvidácia eternitu</a>
        <a href="/cena-likvidacie-azbestu/">Cena likvidácie</a>
        <a href="/postup/">Ako to prebieha</a>
        <a href="/faq/">Časté otázky</a>
      </div>
      <div>
        <h2>Firma</h2>
        <a href="/o-firme/">O firme</a>
        <a href="/kontakt/">Kontakt</a>
        <a href="/realizacie/">Realizácie</a>
        <a href="/recenzie/">Recenzie</a>
        <a href="/strechari/">Pre strechárov</a>
        <a href="/spolupracujuci-strechari/">Spolupracujúci strechári</a>
        <a href="/poradna/">Poradňa</a>
        <span>IČO: {site.ico}</span>
      </div>
      <div>
        <h2>Lokality</h2>
        <a href="/likvidacia-azbestu-poprad/">Poprad</a>
        <a href="/likvidacia-azbestu-kosice/">Košice</a>
        <a href="/likvidacia-azbestu-presov/">Prešov</a>
        <a href="/likvidacia-azbestu-zilina/">Žilina</a>
        <a href="/likvidacia-azbestu-bratislava/">Bratislava</a>
      </div>
      <div>
        <h2>Právne</h2>
        <a href="/ochrana-osobnych-udajov/">Ochrana osobných údajov</a>
        <a href="/cookies/">Cookies</a>
        <a href="/podmienky-pouzivania/">Podmienky používania</a>
        <a href="/sitemap.xml">Sitemap</a>
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
