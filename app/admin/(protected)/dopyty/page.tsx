import { listLeads } from '@/src/server/db';

const statusLabels: Record<string, string> = {
  novy: 'nový',
  caka_na_doplnenie: 'čaká na doplnenie',
  naceneny: 'nacenený',
  cenova_ponuka_odoslana: 'cenová ponuka odoslaná',
  objednane: 'objednané',
  nevyslo: 'nevyšlo',
  archivovane: 'archivované',
};

export default async function LeadsPage() {
  const leads = await listLeads();

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Obchodný tok</p>
          <h1>Dopyty</h1>
        </div>
      </div>
      <section className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dátum</th>
                <th>Zákazník</th>
                <th>Lokalita</th>
                <th>Materiál</th>
                <th>Výmera</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lead.createdAt))}</td>
                  <td>
                    <strong>{lead.fullName}</strong>
                    <br />
                    <small>{lead.phone} · {lead.email}</small>
                  </td>
                  <td>{lead.city}{lead.district ? `, ${lead.district}` : ''}</td>
                  <td>{lead.materialType}</td>
                  <td>{lead.areaEstimate} m²</td>
                  <td><span className="status-pill">{statusLabels[lead.status] || lead.status}</span></td>
                  <td><a className="admin-row-link" href={`/admin/dopyty/${lead.id}`}>Otvoriť</a></td>
                </tr>
              ))}
              {!leads.length ? <tr><td colSpan={7}>Zatiaľ nie sú uložené žiadne dopyty.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
