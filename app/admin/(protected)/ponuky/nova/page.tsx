import { getLeadWithFiles, getPriceOfferSettings, listOperationalBusinessJobs } from '@/src/server/db';
import { toPriceOfferJobOption, type PriceOfferJobOption } from '@/src/lib/price-offer-job-option';
import { savePriceOfferAction } from '../actions';
import PriceOfferForm from '../offer-form';

export default async function NewPriceOfferPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [jobs, settings, lead] = await Promise.all([
    listOperationalBusinessJobs(),
    getPriceOfferSettings(),
    params.lead ? getLeadWithFiles(params.lead) : Promise.resolve(null),
  ]);
  const prefillJob: PriceOfferJobOption | null = lead ? {
    id: 'lead-prefill',
    customerName: lead.fullName,
    customerPhone: lead.phone,
    customerEmail: lead.email,
    location: lead.city,
    district: lead.district || '',
    materialType: lead.materialType,
    objectType: lead.objectType,
    term: lead.term || '',
    leadSource: `dopyt:${lead.id}`,
    m2: lead.areaEstimate,
  } : null;
  const formJobs = jobs.map(toPriceOfferJobOption);
  if (prefillJob) formJobs.unshift(prefillJob);
  return (
    <main className="admin-page">
      <div className="admin-heading price-offer-heading">
        <div>
          <p>Cenové ponuky</p>
          <h1>Nová cenová ponuka</h1>
        </div>
        <a className="admin-text-link" href="/admin/ponuky">Späť na ponuky</a>
      </div>
      <form
        action={savePriceOfferAction}
        className="admin-pending-form"
        data-pending-message="Ukladám cenovú ponuku..."
      >
        <PriceOfferForm jobs={formJobs} settings={settings} selectedJobId={prefillJob ? 'lead-prefill' : params.zakazka || ''} />
      </form>
    </main>
  );
}
