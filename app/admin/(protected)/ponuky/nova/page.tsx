import { getPriceOfferSettings, listBusinessJobs } from '@/src/server/db';
import { savePriceOfferAction } from '../actions';
import PriceOfferForm from '../offer-form';

export default async function NewPriceOfferPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [jobs, settings] = await Promise.all([listBusinessJobs(), getPriceOfferSettings()]);
  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div><p>Cenové ponuky</p><h1>Nová cenová ponuka</h1></div>
        <a className="admin-secondary-link" href="/admin/ponuky">Späť na ponuky</a>
      </div>
      <form action={savePriceOfferAction}>
        <PriceOfferForm jobs={jobs} settings={settings} selectedJobId={params.zakazka || ''} />
        <div className="admin-action-row no-print">
          <button className="admin-primary-button" type="submit">Uložiť ako koncept</button>
          <button className="admin-secondary-link" type="submit" name="next" value="send">Uložiť a odoslať zákazníkovi</button>
        </div>
      </form>
    </main>
  );
}
