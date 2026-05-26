import { PublicPageShell } from './public-layout';

export default function NotFoundPage() {
  return (
    <PublicPageShell>
      <main className="seo-page" id="main-content">
        <section className="seo-hero">
          <p className="eyebrow">404</p>
          <h1>Stránka sa nenašla</h1>
          <p>
            Odkaz môže byť neaktuálny alebo stránka už neexistuje. Pokračujte na hlavnú stránku,
            alebo nám pošlite dopyt a ozveme sa vám s ďalším postupom.
          </p>
        </section>
        <section className="seo-cta">
          <h2>Potrebujete likvidáciu azbestu?</h2>
          <p>Pošlite výmeru, lokalitu a fotky. Cenovú ponuku pripravíme do 24 hodín.</p>
          <a className="button button-primary" href="/#dopyt">Prejsť na dopytový formulár</a>
        </section>
      </main>
    </PublicPageShell>
  );
}
