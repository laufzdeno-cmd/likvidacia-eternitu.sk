import { getDashboardStats, listLeads } from '@/src/server/db';

export default async function AdminDashboardPage() {
  const [stats, leads] = await Promise.all([getDashboardStats(), listLeads()]);
  const lastLeads = leads.slice(0, 5);

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Riadiaci prehľad</p>
          <h1>Dashboard</h1>
        </div>
        <a className="admin-primary-link" href="/admin/dopyty">Otvoriť dopyty</a>
      </div>
      <section className="admin-stat-grid">
        <article><span>Nové dnes</span><strong>{stats.todayLeads}</strong></article>
        <article><span>Nové dopyty</span><strong>{stats.newLeads}</strong></article>
        <article><span>Všetky dopyty</span><strong>{stats.totalLeads}</strong></article>
        <article><span>Nacenené / CP</span><strong>{stats.pricedLeads}</strong></article>
      </section>
      <section className="admin-card">
        <h2>Posledné dopyty</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Zákazník</th><th>Lokalita</th><th>Materiál</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {lastLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.fullName}<br /><small>{lead.phone}</small></td>
                  <td>{lead.city}</td>
                  <td>{lead.materialType}</td>
                  <td><span className="status-pill">{lead.status}</span></td>
                  <td><a href={`/admin/dopyty/${lead.id}`}>Detail</a></td>
                </tr>
              ))}
              {!lastLeads.length ? <tr><td colSpan={5}>Zatiaľ nie sú uložené žiadne dopyty.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
