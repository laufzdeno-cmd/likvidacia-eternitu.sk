import { listCareerApplications } from '@/src/server/db';

const cooperationLabels = { szco: 'živnostník / SZČO', crew: 'partia živnostníkov', other: 'iná forma' } as const;
const statusLabels = { new: 'nová', reviewed: 'skontrolovaná', archived: 'archivovaná' } as const;

export default async function CareerAdminPage() {
  const applications = await listCareerApplications();
  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div><p>Nábor živnostníkov a partii</p><h1>Kariéra</h1></div>
        <a className="admin-primary-link" href="/kariera/" target="_blank">Verejná stránka</a>
      </div>
      <section className="admin-stat-grid">
        <article><span>Všetky žiadosti</span><strong>{applications.length}</strong></article>
        <article><span>Nové</span><strong>{applications.filter((item) => item.status === 'new').length}</strong></article>
        <article><span>So životopisom</span><strong>{applications.filter((item) => item.cv).length}</strong></article>
      </section>
      <section className="admin-card">
        <h2>Uchádzači o spoluprácu</h2>
        <p className="admin-muted">Tieto údaje sú oddelené od zákazníckych dopytov. Životopisy sa otvárajú iba po prihlásení do administrácie.</p>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Meno a kontakt</th><th>Forma</th><th>Kde môže pracovať</th><th>Azbest</th><th>Ďalšie skúsenosti</th><th>Životopis</th></tr></thead><tbody>
          {applications.map((application) => <tr key={application.id}>
            <td><strong>{application.fullName}</strong><br /><small>{new Date(application.createdAt).toLocaleString('sk-SK')} · stav: {statusLabels[application.status]}</small><br /><a href={`tel:${application.phone}`}>{application.phone}</a><br /><a href={`mailto:${application.email}`}>{application.email}</a><br /><small>{application.city}</small></td>
            <td>{cooperationLabels[application.cooperationType]}<br /><small>živnosť: {application.hasTradeLicense ? 'áno' : 'nie'} · výšky: {application.workAtHeights ? 'áno' : 'nie'}</small></td>
            <td>{application.workRegions}</td>
            <td><strong>{application.hasAsbestosExperience ? 'áno' : 'nie'}</strong>{application.asbestosExperience ? <><br /><small>{application.asbestosExperience}</small></> : null}</td>
            <td>{application.experience || application.note || 'bez doplnenia'}</td>
            <td>{application.cv ? <a className="admin-row-link" href={`/admin/kariera/${application.id}/zivotopis`}>Otvoriť životopis</a> : 'nepriložený'}</td>
          </tr>)}
          {!applications.length ? <tr><td colSpan={6}>Zatiaľ neprišla žiadna žiadosť o spoluprácu.</td></tr> : null}
        </tbody></table></div>
      </section>
    </main>
  );
}
