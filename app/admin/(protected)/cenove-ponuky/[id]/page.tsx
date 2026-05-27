import { notFound } from 'next/navigation';
import { getLeadWithFiles, getQuote } from '@/src/server/db';

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();
  const lead = await getLeadWithFiles(quote.leadId);

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Cenová ponuka</p>
          <h1>{quote.quoteNumber}</h1>
        </div>
        {lead ? <a className="admin-secondary-link" href={`/admin/dopyty/${lead.id}`}>Späť na dopyt</a> : null}
      </div>
      <section className="admin-card quote-preview">
        <div className="quote-preview-header">
          <img src="/assets/astana-logo.png" alt="ASTANA" width="180" height="60" />
          <div>
            <strong>ASTANA, s.r.o.</strong>
            <span>Scherffelova 1364/28, 058 01 Poprad</span>
            <span>IČO: 46 157 701 · IČ DPH: SK2023253771</span>
          </div>
        </div>
        <h2>Cenová ponuka na ekologickú likvidáciu azbestu / eternitu</h2>
        <dl className="admin-dl">
          <dt>Zákazník</dt><dd>{lead?.fullName || 'neuvedené'}</dd>
          <dt>Lokalita</dt><dd>{lead?.city || 'neuvedené'}</dd>
          <dt>Materiál</dt><dd>{lead?.materialType || 'neuvedené'}</dd>
          <dt>Výmera</dt><dd>{quote.areaEstimate} m2</dd>
          <dt>Cena za m2 bez DPH</dt><dd>{quote.pricePerM2.toLocaleString('sk-SK')} €</dd>
          <dt>Dokumentácia</dt><dd>{quote.documentationFee.toLocaleString('sk-SK')} € bez DPH</dd>
          <dt>Doprava</dt><dd>{quote.transportFee.toLocaleString('sk-SK')} € bez DPH</dd>
          <dt>DPH</dt><dd>{quote.vatRate} %</dd>
          <dt>Spolu bez DPH</dt><dd><strong>{quote.totalWithoutVat.toLocaleString('sk-SK')} €</strong></dd>
          <dt>Spolu s DPH</dt><dd><strong>{quote.totalWithVat.toLocaleString('sk-SK')} €</strong></dd>
        </dl>
        <p>{quote.note}</p>
        <p className="quote-warning">Cena je predbežná. Finálna cena sa môže upraviť podľa skutočných m2 alebo doplnených informácií.</p>
      </section>
    </main>
  );
}
