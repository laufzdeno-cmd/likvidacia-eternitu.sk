import { listQuotes } from '@/src/server/db';

export default async function QuotesPage() {
  const quotes = await listQuotes();
  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Kalkulácie a návrhy</p>
          <h1>Cenové ponuky</h1>
        </div>
      </div>
      <section className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Číslo</th><th>Platnosť</th><th>Výmera</th><th>Cena bez DPH</th><th>Cena s DPH</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id}>
                  <td>{quote.quoteNumber}</td>
                  <td>{quote.validUntil}</td>
                  <td>{quote.areaEstimate} m²</td>
                  <td>{quote.totalWithoutVat.toLocaleString('sk-SK')} €</td>
                  <td>{quote.totalWithVat.toLocaleString('sk-SK')} €</td>
                  <td><span className="status-pill">{quote.status}</span></td>
                  <td><a className="admin-row-link" href={`/admin/cenove-ponuky/${quote.id}`}>Otvoriť</a></td>
                </tr>
              ))}
              {!quotes.length ? <tr><td colSpan={7}>Zatiaľ nebola vytvorená žiadna cenová ponuka.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
