import { notFound } from 'next/navigation';
import { getLeadWithFiles, getRoofer, listMatchingRoofers, nextQuoteNumber } from '@/src/server/db';
import { createQuoteAction } from './actions';
import QuoteLivePreview from './quote-live-preview';

function defaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

export default async function CreateQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadWithFiles(id);
  if (!lead) notFound();
  const [quoteNumber, matchingRoofers, selectedRoofer] = await Promise.all([
    nextQuoteNumber(),
    listMatchingRoofers(lead),
    lead.selectedRooferId ? getRoofer(lead.selectedRooferId) : Promise.resolve(null),
  ]);
  const roofersForSelect = selectedRoofer && !matchingRoofers.some((roofer) => roofer.id === selectedRoofer.id)
    ? [selectedRoofer, ...matchingRoofers]
    : matchingRoofers;
  const transport = lead.areaEstimate >= 100 ? 0 : 80;

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Dopyt → cenová ponuka</p>
          <h1>Nová cenová ponuka</h1>
        </div>
        <a className="admin-secondary-link" href={`/admin/dopyty/${lead.id}`}>Späť na dopyt</a>
      </div>
      <section className="admin-card">
        <form action={createQuoteAction} className="admin-quote-form">
          <input type="hidden" name="leadId" value={lead.id} />
          <label>
            Číslo cenovej ponuky
            <input name="quoteNumber" defaultValue={quoteNumber} />
          </label>
          <label>
            Platnosť do
            <input name="validUntil" type="date" defaultValue={defaultValidUntil()} />
          </label>
          <label>
            Výmera m2
            <input name="areaEstimate" type="number" step="0.01" defaultValue={lead.areaEstimate} />
          </label>
          <label>
            Cena za m2 bez DPH
            <input name="pricePerM2" type="number" step="0.01" defaultValue="10.50" />
          </label>
          <label>
            Dokumentácia bez DPH
            <input name="documentationFee" type="number" step="0.01" defaultValue="161" />
          </label>
          <label>
            Doprava bez DPH
            <input name="transportFee" type="number" step="0.01" defaultValue={transport} />
          </label>
          <label>
            Príplatok bez DPH
            <input name="surcharge" type="number" step="0.01" defaultValue="0" />
          </label>
          <label>
            Zľava bez DPH
            <input name="discount" type="number" step="0.01" defaultValue="0" />
          </label>
          <label>
            DPH %
            <input name="vatRate" type="number" step="0.01" defaultValue="23" />
          </label>
          <label>
            Odporúčaný strechár
            <select name="recommendedRooferId" defaultValue={selectedRoofer?.id || ''}>
              <option value="">Bez odporúčania v ponuke</option>
              {roofersForSelect.map((roofer) => (
                <option key={roofer.id} value={roofer.id}>{roofer.name} · {roofer.region}</option>
              ))}
            </select>
          </label>
          <label>
            Odhad nákladov bez DPH
            <input name="estimatedCosts" type="number" step="0.01" defaultValue="0" />
          </label>
          <QuoteLivePreview />
          <label className="admin-form-wide">
            Poznámka do ponuky
            <textarea name="note" rows={5} defaultValue={`Objekt / lokalita: ${lead.city}. Typ materiálu: ${lead.materialType}. Cenová ponuka je predbežná a upraví sa podľa skutočných m2.`} />
          </label>
          <div className="admin-form-wide admin-calculation-hint">
            Výpočet: výmera × cena za m2 + dokumentácia + doprava + príplatky - zľavy. DPH je editovateľná a nie je natvrdo v kóde.
          </div>
          <button className="admin-primary-button admin-form-wide" type="submit">Vytvoriť cenovú ponuku</button>
        </form>
      </section>
    </main>
  );
}
