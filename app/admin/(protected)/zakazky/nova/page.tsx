import { getBusinessSettings, listLandfillPrices, listWorkers } from '@/src/server/db';
import { saveBusinessJobAction } from '../actions';
import JobForm from '../job-form';

export default async function NewBusinessJobPage() {
  const [workers, landfillPrices, settings] = await Promise.all([listWorkers(), listLandfillPrices(), getBusinessSettings()]);

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div><p>Business CRM</p><h1>Nová zákazka</h1></div>
        <a className="admin-row-link" href="/admin/zakazky">Späť na zoznam</a>
      </div>
      <form action={saveBusinessJobAction}>
        <JobForm workers={workers} landfillPrices={landfillPrices} defaultPricePerM2={settings.defaultPricePerM2} />
        <div className="admin-action-row">
          <button className="admin-primary-button" type="submit">Uložiť</button>
          <button className="admin-primary-button" type="submit" name="next" value="new">Uložiť a pridať ďalšiu</button>
        </div>
      </form>
    </main>
  );
}
