import type { Metadata } from 'next';
import LandingClient from '../landing-client';
import PublicWidgets from '../public-widgets';
import HeaderBrandLogo from '../header-brand-logo';
import { PublicFooter } from '../public-layout';
import { BreadcrumbJsonLd } from '../seo-json-ld';
import { buildPageMetadata } from '../seo-components';
import { UsefulChecklist } from '../editorial-components';

export const metadata: Metadata = buildPageMetadata({
  title: 'Spolupráca pre strechárov | ASTANA',
  description:
    'ASTANA rieši odstránenie azbestu a doklady, strechár novú strechu. Koordinujeme nadväzujúce práce podľa regiónu a kapacity.',
  path: '/strechari/',
  image: '/og/strechari.jpg',
});

const benefits = [
  {
    icon: 'handshake',
    title: 'Nadväzujúce zákazky',
    text: 'Keď má váš zákazník eternit, môžete ho poslať k nám. Keď náš zákazník potrebuje novú strechu, podľa regiónu a kapacity môžeme preveriť vhodného partnera.',
  },
  {
    icon: 'shield',
    title: 'Partner, ktorého môžete pokojne odporučiť',
    text: 'Zákazníkovi nemusíte povedať „nájdite si niekoho“. Dáte mu kontakt na firmu, ktorá rieši azbest odborne, legálne a s potrebnými dokladmi.',
  },
  {
    icon: 'clock',
    title: 'Nestrácate deň na stavbe',
    text: 'Termín zladíme s vašou partiou. Prídeme v dohodnutom čase, odstránime eternit a vy môžete pokračovať s novou strechou.',
  },
  {
    icon: 'document-check',
    title: 'Azbest necháte na nás',
    text: 'Demontáž, balenie, odvoz a potrebný postup rieši ASTANA. Vy sa venujete streche a svojej práci.',
  },
] as const;

const steps = [
  ['Zaregistrujete sa', 'Vyplníte krátky formulár — región, typ zákaziek, kontakt.'],
  ['Zladíme termín', 'Keď máte zákazníka s azbestom, napíšete nám. Dohodneme konkrétny čas príchodu v pracovnom čase.'],
  ['My zlikvidujeme, vy staviate', 'Prídeme, urobíme svoju prácu čisto a odídeme. Vy nastúpite na čerstvú strechu.'],
  ['Koordinujeme nadväzujúce práce', 'Ak zákazník nemá strechára, môžeme podľa regiónu a kapacity preveriť vhodného partnera.'],
] as const;

const regions = [
  'Bratislavský kraj',
  'Trnavský kraj',
  'Trenčiansky kraj',
  'Nitriansky kraj',
  'Žilinský kraj',
  'Banskobystrický kraj',
  'Prešovský kraj',
  'Košický kraj',
];

function OutlineIcon({ name }: { name: (typeof benefits)[number]['icon'] }) {
  const paths = {
    handshake:
      'M8.25 8.25 10.5 6.951a3 3 0 0 1 3 0l5.25 3.031a1.5 1.5 0 0 1 .55 2.049l-1.5 2.598a1.5 1.5 0 0 1-2.049.55L12 13.014m-3.75-4.764L6 6.951a3 3 0 0 0-3 0L1.5 7.817a1.5 1.5 0 0 0-.55 2.049l1.5 2.598a1.5 1.5 0 0 0 2.049.55l3.75-2.165m0-4.764 3 1.732m-3 0 2.25 1.299a3 3 0 0 0 3 0l2.25-1.299',
    clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    shield:
      'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75A11.959 11.959 0 0 1 12 2.714Z',
    'document-check':
      'M10.125 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm0 0c4.97 0 9 4.03 9 9m-9-9v5.625c0 .621.504 1.125 1.125 1.125H16.5m-6 7.5 2.25 2.25L16.5 15',
  } satisfies Record<(typeof benefits)[number]['icon'], string>;

  return (
    <svg className="roofer-b2b-icon" width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export default function RoofersPage() {
  return (
    <>
      <BreadcrumbJsonLd name="Spolupráca pre strechárov" path="/strechari/" />
      <header className="site-header roofer-b2b-site-header">
        <div className="header-main">
          <a className="brand" href="/" aria-label="ASTANA - likvidácia azbestu a eternitu">
            <HeaderBrandLogo />
            <span><small>Bezpečná likvidácia azbestu</small></span>
          </a>
          <div className="header-meta">
            <a className="header-phone" href="tel:+421905217946">
              <span className="meta-icon phone" aria-hidden="true"></span>
              <strong>0905 217 946</strong>
            </a>
            <a className="button button-primary header-button" href="#registracia">Stať sa partnerom</a>
          </div>
          <button className="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false">Menu</button>
        </div>
        <nav className="site-nav" id="site-nav" aria-label="Hlavná navigácia">
          <a href="/#orientacna-cena">Orientačná cena</a>
          <a href="/postup/">Ako to prebieha</a>
          <a className="is-active" href="/strechari/" aria-current="page">Strechári</a>
          <a href="/realizacie/">Realizácie</a>
          <a href="/recenzie/">Recenzie</a>
          <a href="/faq/">FAQ</a>
          <a href="/#kontakt">Kontakt</a>
          <a className="nav-mobile-phone" href="tel:+421905217946">
            <span className="meta-icon phone" aria-hidden="true"></span>0905 217 946
          </a>
          <a className="nav-mobile-cta" href="#registracia">Stať sa partnerom</a>
        </nav>
      </header>

      <main className="roofer-b2b-page">
        <section className="roofer-b2b-hero" aria-labelledby="roofer-title">
          <div className="roofer-b2b-inner">
            <div className="roofer-b2b-hero-copy">
              <p className="roofer-b2b-eyebrow">Partner pre strechárov po celom Slovensku</p>
              <h1 id="roofer-title">Vy robíte strechu. My vyriešime azbest.</h1>
              <p>
                Keď má váš zákazník eternit, môžete sa obrátiť na ASTANA. Keď má náš zákazník záujem o novú strechu,
                podľa regiónu a kapacity mu môžeme odporučiť vhodného partnera.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#registracia">Chcem byť medzi odporúčanými strechármi <span aria-hidden="true" style={{ marginInlineStart: '0.45em' }}>→</span></a>
                <a className="button button-outline" href="tel:+421905217946">Zavolať 0905 217 946</a>
              </div>
              <p className="roofer-b2b-hero-trust">Každý rieši svoju časť. ASTANA azbest a doklady, strechár novú strechu. Termín vieme zladiť tak, aby zákazník nezostal zbytočne s otvorenou strechou.</p>
              <div className="roofer-b2b-trust-row" aria-label="Výhody spolupráce s ASTANA">
                <span><strong>Nástup podľa dohody</strong><small>zladený s vašou partiou</small></span>
                <span><strong>Čistá strecha</strong><small>pripravená pre vašu partiu</small></span>
                <span><strong>Zákazky oboma smermi</strong><small>keď si sadneme regiónom</small></span>
              </div>
            </div>
            <div className="roofer-b2b-hero-media">
              <img
                src="/assets/roofers/roofer-installing-new-roof.webp"
                alt="Ilustračná fotografia strechára pri pokládke novej krytiny"
                width="1536"
                height="1024"
                fetchPriority="high"
              />
              <p>Ilustračná fotografia: strechárska partia nastupuje na pripravenú strechu.</p>
            </div>
          </div>
        </section>

        <section className="roofer-b2b-benefits" aria-labelledby="roofer-benefits-title">
          <div className="roofer-b2b-inner">
            <h2 id="roofer-benefits-title">Prečo sa spolupráca oplatí obom stranám</h2>
            <div className="roofer-b2b-card-grid">
              {benefits.map((benefit) => (
                <article className="roofer-b2b-card" key={benefit.title}>
                  <OutlineIcon name={benefit.icon} />
                  <h3>{benefit.title}</h3>
                  <p>{benefit.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="roofer-b2b-winwin" aria-labelledby="roofer-winwin-title">
          <div className="roofer-b2b-inner">
            <p className="roofer-b2b-section-eyebrow">Jednoduché partnerstvo</p>
            <h2 id="roofer-winwin-title">Ako si pomáhame</h2>
            <div className="roofer-b2b-winwin-grid">
              <article>
                <span className="roofer-b2b-winwin-kicker">Vy máte zákazníka s eternitom?</span>
                <p>Pošlete mu kontakt na ASTANA. My vyriešime azbest a termín zladíme tak, aby ste mohli pokračovať vy.</p>
              </article>
              <article>
                <span className="roofer-b2b-winwin-kicker">Máme zákazníka bez strechára?</span>
                <p>Podľa regiónu a kapacity môžeme preveriť vhodného spolupracujúceho strechára. Zákazník si partnera vyberá sám.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="roofer-b2b-inner">
          <UsefulChecklist title="Čo si odovzdať pred spoločnou zákazkou" items={[
            'Obec, konkrétny rozsah krytiny a prístup na stavbu.',
            'Požadovaný termín a informáciu, či ho už zákazník potvrdil.',
            'Kto po demontáži preberie pracovisko a rieši prípadné zakrytie.',
            'Kontaktnú osobu a postup pri zmene rozsahu alebo počasia.',
          ]} />
          <p>Samostatnú strechársku ponuku a zodpovednosť za novú strechu si dohadujete priamo so zákazníkom. <a href="/spolupracujuci-strechari/">Informácie o nadväznosti pre majiteľa strechy</a> môžete poslať spolu s kontaktom na ASTANA.</p>
        </section>
        <section className="roofer-b2b-partner-kit" aria-labelledby="partner-kit-title">
          <div className="roofer-b2b-inner">
            <div className="roofer-b2b-partner-kit-heading">
              <p className="roofer-b2b-section-eyebrow">Podklady pre váš web</p>
              <h2 id="partner-kit-title">SPOLUPRACUJETE S ASTANA? MÔŽETE TO UVIESŤ AJ NA SVOJOM WEBE.</h2>
              <p>Text, odznak aj logo môžete použiť dobrovoľne. Nejde o certifikát, členstvo ani podmienku spolupráce.</p>
            </div>
            <div className="roofer-b2b-partner-kit-grid">
              <article className="roofer-b2b-copy-card">
                <h3>Text na web</h3>
                <p>Pri zákazkách so starým eternitom spolupracujeme so spoločnosťou ASTANA, s.r.o., ktorá rieši odborné odstránenie azbestu, dokumentáciu, balenie a odvoz.</p>
              </article>
              <article className="roofer-b2b-copy-card">
                <h3>Krátka verzia</h3>
                <p>Likvidáciu eternitu pri našich zákazkách riešime v spolupráci s ASTANA, s.r.o.</p>
              </article>
              <article className="roofer-b2b-badge-card">
                <img src="/assets/astana-logo-dark.png" width="240" height="72" alt="Logo ASTANA, s.r.o." />
                <strong>SPOLUPRACUJEME S ASTANA</strong>
                <span>ODSTRAŇOVANIE AZBESTU</span>
                <small>Partner pre odborné odstránenie azbestu</small>
              </article>
            </div>
            <div className="roofer-b2b-downloads">
              <a className="button button-outline" href="/downloads/strechari/astana-partner-badge.svg" download>Stiahnuť SVG</a>
              <a className="button button-outline" href="/downloads/strechari/astana-partner-badge-transparent.png" download>PNG s priehľadným pozadím</a>
              <a className="button button-outline" href="/downloads/strechari/astana-partner-badge-white.png" download>PNG s bielym pozadím</a>
            </div>
            <details className="roofer-b2b-html-snippet">
              <summary>Voliteľný HTML text na vloženie</summary>
              <p>Odkaz je dobrovoľný; nejde o výmenu odkazov ani o podmienku spolupráce.</p>
              <pre><code>{`<p>Pri zákazkách so starým eternitom spolupracujeme so spoločnosťou <a href="https://www.astana.sk/">ASTANA, s.r.o.</a>, ktorá rieši odborné odstránenie azbestu, dokumentáciu, balenie a odvoz.</p>`}</code></pre>
            </details>
          </div>
        </section>

        <section className="roofer-b2b-how" aria-labelledby="roofer-how-title">
          <div className="roofer-b2b-inner">
            <h2 id="roofer-how-title">Ako to funguje</h2>
            <ol className="roofer-b2b-stepper">
              {steps.map(([title, text], index) => (
                <li key={title}>
                  <span className="step-num">{index + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="roofer-b2b-registration" id="registracia" aria-labelledby="registration-title">
          <div className="roofer-b2b-inner">
            <div className="roofer-registration-head">
              <h2 id="registration-title">Chcete, aby sme o vás vedeli, keď sa nám ozve zákazník bez strechára?</h2>
              <p>Nechajte nám kontakt a región, v ktorom pracujete. Keď budeme mať vhodnú zákazku pre váš región a typ strechy, ozveme sa.</p>
            </div>
            <form className="roofer-registration-form" action="/api/roofer-registration/" method="post" noValidate>
              <input className="hp-field" type="text" name="companyWebsite" tabIndex={-1} autoComplete="new-password" aria-hidden="true" data-submit-disabled="true" disabled />
              <input type="hidden" name="submissionId" value="" />
              <div className="roofer-form-section-heading" data-step="1">
                <span>1</span>
                <div><strong>Vaša firma</strong><small>Základné údaje o partnerovi</small></div>
              </div>
              <div className="roofer-form-grid">
                <label>
                  Forma podnikania *
                  <select name="businessType" defaultValue="" required>
                    <option value="">Vyberte možnosť</option>
                    <option value="sro">s.r.o.</option>
                    <option value="szco">Živnostník / SZČO</option>
                    <option value="other">Iné</option>
                  </select>
                </label>
                <label>
                  Názov firmy / obchodné meno *
                  <input name="companyName" type="text" autoComplete="organization" placeholder="Napr. Strechy Novák, s.r.o." required />
                </label>
                <label>
                  IČO
                  <input name="companyId" type="text" inputMode="numeric" autoComplete="off" placeholder="Nepovinné" />
                </label>
                <label>
                  Kto koná za firmu *
                  <input name="contactPerson" type="text" autoComplete="name" placeholder="Meno človeka, s ktorým budeme komunikovať" required />
                </label>
              </div>

              <div className="roofer-form-section-heading" data-step="2">
                <span>2</span>
                <div><strong>Ako sa s vami spojíme</strong><small>Kontakt pre zákazky a ďalší postup</small></div>
              </div>
              <div className="roofer-form-grid">
                <label>
                  Telefón *
                  <input name="phone" type="tel" autoComplete="tel" inputMode="tel" required />
                </label>
                <label>
                  Email *
                  <input name="email" type="email" autoComplete="email" required />
                </label>
                <label className="roofer-form-wide">
                  Webová stránka
                  <input name="website" type="url" autoComplete="url" placeholder="https://..." />
                </label>
              </div>

              <div className="roofer-form-section-heading" data-step="3">
                <span>3</span>
                <div><strong>Kde chcete prijímať zákazky</strong><small>Vyberte všetky kraje, v ktorých reálne viete zákazku zobrať</small></div>
              </div>
              <fieldset aria-describedby="roofer-regions-error">
                <legend>Regióny pôsobenia *</legend>
                <p className="roofer-field-error" id="roofer-regions-error" role="alert" hidden></p>
                <div className="roofer-checkbox-grid">
                  {regions.map((region) => (
                    <label key={region}>
                      <input type="checkbox" name="serviceRegions[]" value={region} aria-describedby="roofer-regions-error" />
                      <span>{region}</span>
                    </label>
                  ))}
                  <label className="roofer-checkbox-card-wide">
                    <input type="checkbox" name="serviceRegions[]" value="Celé Slovensko" data-all-regions aria-describedby="roofer-regions-error" />
                    <span>Celé Slovensko</span>
                  </label>
                </div>
              </fieldset>

              <div className="roofer-form-section-heading" data-step="4">
                <span>4</span>
                <div><strong>Na aké strechy a krytiny sa špecializujete</strong><small>Označte všetko, čo bežne realizujete</small></div>
              </div>
              <fieldset aria-describedby="roofer-specializations-error">
                <legend>Preferované krytiny a práce *</legend>
                <p className="roofer-field-error" id="roofer-specializations-error" role="alert" hidden></p>
                <div className="roofer-checkbox-grid roofer-checkbox-grid-specializations">
                  {['Betónová krytina', 'Pálená škridla', 'Plechová krytina', 'Plochá / rovná strecha', 'Iné'].map((specialization) => (
                    <label key={specialization}>
                      <input type="checkbox" name="specializations[]" value={specialization} data-specialization={specialization} aria-describedby="roofer-specializations-error" />
                      <span>{specialization}</span>
                    </label>
                  ))}
                </div>
                <label className="roofer-other-specialization" data-other-specialization hidden>
                  Doplňte inú špecializáciu
                  <input name="otherSpecialization" type="text" placeholder="Napr. zelené strechy, krovy..." />
                </label>
              </fieldset>
              <fieldset>
                <legend>Viete zrealizovať aj nový krov? *</legend>
                <div className="roofer-option-grid">
                  <label>
                    <input type="radio" name="canBuildRoofTruss" value="yes" required />
                    <span>Áno</span>
                  </label>
                  <label>
                    <input type="radio" name="canBuildRoofTruss" value="no" />
                    <span>Nie</span>
                  </label>
                  <label>
                    <input type="radio" name="canBuildRoofTruss" value="by_scope" />
                    <span>Podľa rozsahu zákazky</span>
                  </label>
                </div>
              </fieldset>

              <div className="roofer-form-section-heading" data-step="5">
                <span>5</span>
                <div><strong>Ako môžeme spolupracovať</strong><small>Vyberte, čo vám dáva zmysel</small></div>
              </div>
              <label className="roofer-consent roofer-consent--optional">
                <input type="checkbox" name="acceptCustomerReferrals" />
                <span><strong>Chcem, aby mi ASTANA posielala zákazníkov</strong><small>Ak budete vhodný partner pre región a typ strechy, môžeme vás kontaktovať alebo odporučiť. Nejde o garanciu počtu zákaziek.</small></span>
              </label>
              <label className="roofer-consent roofer-consent--optional">
                <input type="checkbox" name="consentPublicProfile" />
                <span><strong>Súhlasím so zverejnením firmy medzi odporúčanými strechármi</strong><small>Zverejnenie môže obsahovať názov firmy, región, špecializáciu, web a firemný kontakt v rozsahu, ktorý spolu odsúhlasíme.</small></span>
              </label>
              <label className="roofer-consent roofer-consent--required">
                <input type="checkbox" name="privacyConsent" required />
                <span>Súhlasím so spracovaním údajov na vybavenie registrácie a partnerskej spolupráce. <a href="/ochrana-osobnych-udajov/">Viac o ochrane údajov</a> *</span>
              </label>
              <label>
                Chcete nám ešte niečo povedať?
                <textarea name="note" rows={4} placeholder="Napr. aké zákazky preferujete, aký máte bežný dojazd alebo čo by sme o vás mali vedieť..."></textarea>
              </label>

              <button className="button button-primary" type="submit">Chcem byť medzi odporúčanými strechármi</button>
              <p className="roofer-form-microcopy">Registrácia vás k ničomu nezaväzuje. Najprv si údaje skontrolujeme a ozveme sa vám.</p>
              <p className="roofer-registration-status" role="status" aria-live="polite" tabIndex={-1}></p>
            </form>
          </div>
        </section>

        <section className="roofer-b2b-footer-cta" aria-labelledby="roofer-footer-title">
          <div className="roofer-b2b-inner">
            <h2 id="roofer-footer-title">Zaujíma vás spolupráca? Zavolajte.</h2>
            <a href="tel:+421905217946">0905 217 946</a>
            <p>Po–Pia 8:00 – 18:00</p>
          </div>
        </section>
      </main>

      <PublicFooter />
      <LandingClient />
      <PublicWidgets hideWhatsappOnMobile />
    </>
  );
}
