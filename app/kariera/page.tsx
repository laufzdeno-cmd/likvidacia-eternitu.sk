import CareerFormClient from '../career-form-client';
import { PublicPageShell } from '../public-layout';
import { buildPageMetadata } from '../seo-components';
import { JsonLd, buildFaqJsonLd } from '../seo-json-ld';
import styles from './career.module.css';
import { PublicFontPreload } from '@/src/components/public-font-preload';
import { EditorialPhoto } from '../editorial-components';

export const metadata = buildPageMetadata({
  title: 'Kariéra: živnostníci a partie | ASTANA',
  description: 'Hľadáme spoľahlivých živnostníkov a partie na demontáž eternitu a azbestových materiálov. Pošlite krátku žiadosť, životopis nie je podmienkou.',
  path: '/kariera/',
});

const faqs = [
  { question: 'Potrebujem životopis?', answer: 'Nie. Stačí vyplniť krátky formulár a napísať pár viet o skúsenostiach. Životopis môžete priložiť dobrovoľne.' },
  { question: 'Môžem sa prihlásiť, aj keď nemám skúsenosť s azbestom?', answer: 'Áno. Vo formulári jednoducho uvediete, aké máte skúsenosti. Potrebné školenia a zdravotné prehliadky zabezpečíme pred začiatkom spolupráce.' },
  { question: 'Hľadáte jednotlivcov alebo celé partie?', answer: 'Radi sa ozveme jednotlivým živnostníkom aj zabehnutým partiám. Vo formulári si vyberiete, ako chcete spolupracovať.' },
  { question: 'Kedy sa mi ozvete?', answer: 'Po prijatí žiadosti vás kontaktujeme čo najskôr telefonicky alebo e-mailom.' },
];

export default function CareerPage() {
  return (
    <PublicPageShell
      breadcrumb={{ name: 'Kariéra', path: '/kariera/' }}
      headerCta={{ href: '#prihlasit-sa', label: 'Chcem sa prihlásiť' }}
    >
      <PublicFontPreload />
      <main className={`career-page ${styles.page}`}>
        <JsonLd data={buildFaqJsonLd(faqs)} />
        <section className={`career-hero ${styles.hero}`}>
          <div className={`career-intro ${styles.intro}`}>
            <p className="eyebrow">Kariéra v ASTANA</p>
            <h1>Hľadáme šikovných živnostníkov a partie</h1>
            <p className={`career-lead ${styles.lead}`}>Na demontáž eternitu a azbestových materiálov hľadáme spoľahlivých ľudí, ktorí berú bezpečnosť a poctivo urobenú prácu vážne.</p>
            <a className="button button-primary" href="#prihlasit-sa">Chcem sa prihlásiť</a>
            <p>Nemusíte písať dlhý životopis. Pošlite nám krátku žiadosť, ozveme sa vám a prejdeme si spolu skúsenosti, odmenu aj možný termín nástupu.</p>
            <ul className={`career-benefits ${styles.benefits}`}>
              <li>krátky formulár namiesto povinného životopisu</li>
              <li>živnostník aj zabehnutá partia</li>
              <li>práca po celom Slovensku</li>
              <li>jasná dohoda pred začiatkom spolupráce</li>
            </ul>
          </div>
          <aside className={`career-expectations ${styles.expectations}`} aria-label="Čo hľadáme">
            <p className="eyebrow">Čo je dôležité</p>
            <h2>Hľadáme ľudí, na ktorých je spoľah</h2>
            <ul>
              <li>platná živnosť alebo možnosť pracovať ako samostatná partia</li>
              <li>skúsenosť s manuálnou prácou a prácou vo výške</li>
              <li>zodpovedný prístup k bezpečnosti a pokynom na stavbe</li>
            </ul>
            <p>Potrebné školenia a zdravotné prehliadky zabezpečíme pred začiatkom spolupráce.</p>
          </aside>
        </section>
        <section className="section editorial-split" aria-labelledby="career-work-title">
          <div><p className="eyebrow">Práca na skutočných objektoch</p><h2 id="career-work-title">Dôležitá je spolupráca aj zodpovednosť na mieste</h2><p>Demontáž nie je len o rýchlom zložení dosiek. Na zákazke sa pripravuje pracovisko, postupuje podľa pokynov a nadväzuje na balenie a odvoz. Potrebujeme vedieť, s akým typom práce máte skúsenosť a ako môžete fungovať v partii.</p><p>V krátkej žiadosti opíšte prax, región a dostupnosť. Konkrétnu náplň práce, podmienky, odmenu a možný začiatok si prejdeme pred dohodou. Ak niečo ešte neviete alebo nemáte, napíšte to otvorene.</p><p><a href="/postup/">Pozrite si, ako prebieha zákazka ASTANA</a>.</p></div>
          <EditorialPhoto id="azbest-135" alt="Pracovníci v ochranných oblekoch pri práci na streche drevenice" caption="Záber z praxe ASTANA. Konkrétne pracovné podmienky sa dohadujú pred spoluprácou." />
        </section>
        <section className={`career-application-section ${styles.applicationSection}`} id="prihlasit-sa">
          <div className={`career-section-heading ${styles.sectionHeading}`}><p className="eyebrow">Krátka žiadosť</p><h2>Napíšte nám o sebe</h2><p>Vyplnenie zaberie približne dve minúty. Polia označené hviezdičkou potrebujeme, aby sme sa vám mohli ozvať.</p></div>
          <CareerFormClient />
        </section>
        <section className={`career-faq ${styles.faq}`} aria-labelledby="kariera-faq"><p className="eyebrow">Otázky a odpovede</p><h2 id="kariera-faq">Často sa pýtate</h2>{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</section>
      </main>
    </PublicPageShell>
  );
}
