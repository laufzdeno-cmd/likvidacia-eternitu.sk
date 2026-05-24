import { importBusinessJobsAction } from './actions';
import ImportClient from './import-client';

export default function ImportPage() {
  return (
    <main className="admin-page">
      <div className="admin-heading"><div><p>Spätné zadávanie dát</p><h1>Import histórie</h1></div></div>
      <section className="admin-card">
        <p>Formát CSV: datum, meno, lokalita, m2, cena_za_m2, platba(FAKTURA/CASH), typ_prace, vaha_kg, skladka, pracovnici(Robo;Mato;Milos), nafta, obleky, rukavice, penetrak, ine_naklady.</p>
        <form action={importBusinessJobsAction} className="admin-quote-form">
          <ImportClient />
        </form>
      </section>
    </main>
  );
}
