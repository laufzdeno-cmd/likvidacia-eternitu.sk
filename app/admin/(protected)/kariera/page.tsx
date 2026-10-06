import { countCareerApplications, listApplicationNotificationStatuses, listCareerApplications } from '@/src/server/db';
import NotificationStatuses from '../notifications/notification-statuses';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import type { ApplicationNotification } from '@/src/server/types';

const cooperationLabels = { szco: 'živnostník / SZČO', crew: 'partia živnostníkov', other: 'iná forma' } as const;
const statusLabels = { new: 'nová', reviewed: 'skontrolovaná', archived: 'archivovaná' } as const;
export default async function CareerAdminPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await requireAdminUser();
  const csrfToken = csrfTokenForEmail(admin.email);
  const requestedPage = (await searchParams).page || '1';
  const counts = await countCareerApplications();
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(counts.total / pageSize));
  const parsedPage = /^\d{1,6}$/.test(requestedPage) ? Number(requestedPage) : 1;
  const page = Math.max(1, Math.min(parsedPage, totalPages));
  const applications = await listCareerApplications(page, pageSize);
  const notifications = await listApplicationNotificationStatuses('career_application', applications.map((application) => application.id));
  const notificationsByApplication = new Map<string, ApplicationNotification[]>();
  for (const notification of notifications) {
    const current = notificationsByApplication.get(notification.entityId) ?? [];
    current.push(notification);
    notificationsByApplication.set(notification.entityId, current);
  }
  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div><p>Nábor živnostníkov a partii</p><h1>Kariéra</h1></div>
        <a className="admin-primary-link" href="/kariera/" target="_blank">Verejná stránka</a>
      </div>
      <section className="admin-stat-grid">
        <article><span>Zobrazené žiadosti</span><strong>{applications.length}</strong></article>
        <article><span>Nové na tejto strane</span><strong>{applications.filter((item) => item.status === 'new').length}</strong></article>
        <article><span>So životopisom na tejto strane</span><strong>{applications.filter((item) => item.cv).length}</strong></article>
        <article><span>Nedokončené životopisy celkom</span><strong>{counts.incompleteCv}</strong></article>
      </section>
      <section className="admin-card">
        <h2>Uchádzači o spoluprácu</h2>
        <p className="admin-muted">Tieto údaje sú oddelené od zákazníckych dopytov. Životopisy sa otvárajú iba po prihlásení do administrácie.</p>
        {counts.incompleteCv > 0 ? (
          <p role="status">Pri {counts.incompleteCv} prijatých žiadostiach sa životopis ešte nepripojil. Stav jednotlivých e-mailov je v stĺpci Notifikácie; skontrolujte tieto žiadosti a podľa potreby kontaktujte uchádzača.</p>
        ) : null}
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Meno a kontakt</th><th>Forma</th><th>Kde môže pracovať</th><th>Azbest</th><th>Ďalšie skúsenosti</th><th>Životopis</th><th>Notifikácie</th></tr></thead><tbody>
          {applications.map((application) => <tr key={application.id}>
            <td><strong>{application.fullName}</strong><br /><small>{new Date(application.createdAt).toLocaleString('sk-SK')} · stav: {statusLabels[application.status]}</small><br /><a href={`tel:${application.phone}`}>{application.phone}</a><br /><a href={`mailto:${application.email}`}>{application.email}</a><br /><small>{application.city}</small></td>
            <td>{cooperationLabels[application.cooperationType]}<br /><small>živnosť: {application.hasTradeLicense ? 'áno' : 'nie'} · výšky: {application.workAtHeights ? 'áno' : 'nie'}</small></td>
            <td>{application.workRegions}</td>
            <td><strong>{application.hasAsbestosExperience ? 'áno' : 'nie'}</strong>{application.asbestosExperience ? <><br /><small>{application.asbestosExperience}</small></> : null}</td>
            <td>{application.experience || application.note || 'bez doplnenia'}</td>
            <td>{application.cv ? <a className="admin-row-link" href={`/admin/kariera/${application.id}/zivotopis`}>Otvoriť životopis</a> : application.cvExpected ? 'Nahrávanie nedokončené — overte stav notifikácií' : 'nepriložený'}</td>
            <td><NotificationStatuses entityType="career_application" csrfToken={csrfToken} notifications={notificationsByApplication.get(application.id) ?? []} /></td>
          </tr>)}
          {!applications.length ? <tr><td colSpan={7}>Zatiaľ neprišla žiadna žiadosť o spoluprácu.</td></tr> : null}
        </tbody></table></div>
        <nav aria-label="Stránkovanie kariérnych žiadostí" className="admin-pagination">
          {page > 1 ? <a href={`/admin/kariera?page=${page - 1}`}>Predchádzajúca strana</a> : null}
          <span>Strana {page} z {totalPages} · celkom {counts.total} žiadostí</span>
          {page < totalPages ? <a href={`/admin/kariera?page=${page + 1}`}>Nasledujúca strana</a> : null}
        </nav>
      </section>
    </main>
  );
}
