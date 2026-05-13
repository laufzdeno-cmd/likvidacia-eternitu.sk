import { notFound } from 'next/navigation';
import { getLeadWithFiles, nextQuoteNumber } from '@/src/server/db';
import { createQuoteAction } from './actions';

function defaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

export default async function CreateQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadWithFiles(id);
  if (!lead) notFound();
  const quoteNumber = await nextQuoteNumber();
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
            Výmera m²
            <input name="areaEstimate" type="number" step="0.01" defaultValue={lead.areaEstimate} />
          </label>
          <label>
            Cena za m² bez DPH
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
          <label className="admin-form-wide">
            Poznámka do ponuky
            <textarea name="note" rows={5} defaultValue={`Objekt / lokalita: ${lead.city}. Typ materiálu: ${lead.materialType}. Cenová ponuka je predbežná a upraví sa podľa skutočných m².`} />
          </label>
          <div className="admin-form-wide admin-calculation-hint">
            Výpočet: výmera × cena za m² + dokumentácia + doprava + príplatky - zľavy. DPH je editovateľná a nie je natvrdo v kóde.
          </div>
          <button className="admin-primary-button admin-form-wide" type="submit">Vytvoriť cenovú ponuku</button>
        </form>
      </section>
    </main>
  );
}
