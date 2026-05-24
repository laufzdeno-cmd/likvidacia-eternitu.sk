import { importBusinessJobsAction } from './actions';
import ImportClient from './import-client';

export default function ImportPage() {
  return (
    <main className="admin-page">
      <div className="admin-heading"><div><p>Spätné zadávanie dát</p><h1>Import histórie</h1></div></div>
      <section className="admin-card">
        <p>Formát CSV: datum, meno, lokalita, m2, cena_za_m2, platba(FAKTURA/CASH), typ_prace, vaha_kg, skladka, pracovnici(Robo;Mato;Milos), nafta, obleky, rukavice, penetrak, ine_naklady.</p>
        <a
          className="admin-primary-link"
          download="astana-import-sablona.csv"
          href={'data:text/csv;charset=utf-8,datum%2Cmeno%2Clokalita%2Cm2%2Ccena_za_m2%2Cplatba%2Ctyp_prace%2Cvaha_kg%2Cskladka%2Cpracovnici%2Cnafta%2Cableky%2Crukavice%2Cpenetrak%2Cine_naklady%0A2025-03-15%2CJan%20Novak%2CKosice%2C210%2C12%2CCASH%2CDEMONTAZ%2C0%2CINA%2CRobo%3BMato%3BMilos%2C45%2C0%2C12%2C0%2C0'}
        >
          Stiahnuť CSV šablónu
        </a>
        <form action={importBusinessJobsAction} className="admin-quote-form">
          <ImportClient />
        </form>
      </section>
    </main>
  );
}
