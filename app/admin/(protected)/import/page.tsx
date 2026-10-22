import { requireSuperAdmin } from '@/src/server/auth';
import { listWorkers } from '@/src/server/db';
import ImportClient from './import-client';

export default async function ImportPage() {
  await requireSuperAdmin();
  const workers = await listWorkers(true);
  const template = 'id_zakazky,datum,meno,lokalita,m2,cena_za_m2,platba,typ_prace,vaha_kg,skladka,pracovnici,nafta,obleky,rukavice,penetrak,ine_naklady\r\nHIST-2025-0001,2025-03-15,"Ján; Novák",Košice,210,12,CASH,DEMONTAZ,0,INA,,45,0,12,0,0\r\n';
  return (
    <main className="admin-page">
      <div className="admin-heading"><div><p>Spätné zadávanie dát</p><h1>Import histórie</h1></div></div>
      <section className="admin-card">
        <p>Každá zákazka musí mať vlastné stále ID. Pri opakovanom importe použite rovnaké ID; zmenené údaje systém zastaví na ručnú kontrolu. Formát CSV: id_zakazky, datum, meno, lokalita, m2, cena_za_m2, platba (FAKTURA/CASH), typ_prace, vaha_kg, skladka, pracovnici (mená oddelené bodkočiarkou), nafta, obleky, rukavice, penetrak, ine_naklady.</p>
        <a
          className="admin-primary-link"
          download="astana-import-sablona.csv"
          href={`data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(template)}`}
        >
          Stiahnuť CSV šablónu
        </a>
        <ImportClient workerNames={workers.map((worker) => worker.name)} />
      </section>
    </main>
  );
}
