import { getLeadWithFiles, getPriceOfferSettings, listBusinessJobs } from '@/src/server/db';
import type { BusinessJob } from '@/src/server/types';
import { savePriceOfferAction } from '../actions';
import PriceOfferForm from '../offer-form';

export default async function NewPriceOfferPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [jobs, settings, lead] = await Promise.all([
    listBusinessJobs(),
    getPriceOfferSettings(),
    params.lead ? getLeadWithFiles(params.lead) : Promise.resolve(null),
  ]);
  const prefillJob: BusinessJob | null = lead ? {
    id: 'lead-prefill',
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    demolitionDate: new Date().toISOString().slice(0, 10),
    customerName: lead.fullName,
    customerPhone: lead.phone,
    customerEmail: lead.email,
    location: lead.city,
    district: lead.district || '',
    materialType: lead.materialType,
    objectType: lead.objectType,
    term: lead.term || '',
    leadSource: `dopyt:${lead.id}`,
    preferredContact: lead.preferredContact || '',
    m2: lead.areaEstimate,
    pricePerM2: 0,
    totalPrice: 0,
    paymentType: 'FAKTURA',
    workType: 'DEMONTAZ_A_ODVOZ',
    wasteKg: 0,
    landfill: 'INA',
    status: 'DOPYT',
    note: lead.note || '',
    workers: [],
    costs: { jobId: 'lead-prefill', fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0, total: 0 },
    rewardsTotal: 0,
    grossProfit: 0,
    marginPercent: 0,
  } : null;
  const formJobs = prefillJob ? [prefillJob, ...jobs] : jobs;
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
