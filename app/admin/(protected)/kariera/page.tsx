import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import {
  countCareerApplications,
  listAdminUsers,
  listApplicationNotificationStatuses,
  listCareerApplications,
} from '@/src/server/db';
import type { ApplicationNotification, CareerApplicationFilters } from '@/src/server/types';
import NotificationStatuses from '../notifications/notification-statuses';

const PAGE_SIZE = 25;
const statusLabels = {
  new: 'Nová',
  reviewed: 'Skontrolovaná',
  archived: 'Archivovaná',
} as const;

type CareerSearchParams = {
  page?: string;
  status?: string;
  owner?: string;
  due?: string;
};

function parsePositivePage(value: string | undefined) {
  return value && /^\d{1,6}$/.test(value) ? Math.max(1, Number(value)) : 1;
}

function parseFilters(params: CareerSearchParams): CareerApplicationFilters {
  const status = params.status;
  const ownerEmail = typeof params.owner === 'string' ? params.owner.trim().slice(0, 254) : '';
  return {
    status: status === 'new' || status === 'reviewed' || status === 'archived' ? status : undefined,
    ownerEmail: ownerEmail && ownerEmail !== '__unassigned__' ? ownerEmail : undefined,
    unassignedOnly: ownerEmail === '__unassigned__' || undefined,
    dueOnly: params.due === '1' || undefined,
  };
}

function pageHref(page: number, params: CareerSearchParams) {
  const query = new URLSearchParams();
  query.set('page', String(page));
  if (params.status === 'new' || params.status === 'reviewed' || params.status === 'archived') query.set('status', params.status);
  if (params.owner) query.set('owner', params.owner);
  if (params.due === '1') query.set('due', '1');
  return `/admin/kariera?${query.toString()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default async function CareerAdminPage({ searchParams }: { searchParams: Promise<CareerSearchParams> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const requestedPage = parsePositivePage(params.page);
  const admin = await requireAdminUser();
  const [counts, adminUsers] = await Promise.all([
    countCareerApplications(filters),
    listAdminUsers(),
  ]);
  const totalPages = Math.max(1, Math.ceil(counts.total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const applications = await listCareerApplications(page, PAGE_SIZE, filters);
  const notifications = await listApplicationNotificationStatuses(
    'career_application',
    applications.map((application) => application.id),
  );
  const notificationsByApplication = new Map<string, ApplicationNotification[]>();
  for (const notification of notifications) {
    const current = notificationsByApplication.get(notification.entityId) ?? [];
    current.push(notification);
    notificationsByApplication.set(notification.entityId, current);
  }
  const csrfToken = csrfTokenForEmail(admin.email);

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Nábor živnostníkov a partií</p>
          <h1>Kariérne žiadosti</h1>
        </div>
        <a className="admin-primary-link" href="/kariera/" target="_blank" rel="noreferrer">Verejná stránka</a>
      </div>

      <section className="admin-stat-grid" aria-label="Súhrn kariérnych žiadostí">
        <article><span>Výsledky filtra</span><strong>{counts.total}</strong></article>
        <article><span>Na tejto strane</span><strong>{applications.length}</strong></article>
        <article><span>So životopisom na strane</span><strong>{applications.filter((item) => item.cv).length}</strong></article>
        <article><span>Nedokončené vo filtri</span><strong>{counts.incompleteCv}</strong></article>
      </section>

      <section className="admin-card">
        <h2>Filtre pracovnej fronty</h2>
        <form className="admin-filter-bar" method="get">
          <label>
            Stav
            <select name="status" defaultValue={filters.status ?? ''}>
              <option value="">Aktívne žiadosti</option>
              <option value="new">Nové</option>
              <option value="reviewed">Skontrolované</option>
              <option value="archived">Archivované</option>
            </select>
          </label>
          <label>
            Vlastník
            <select name="owner" defaultValue={filters.unassignedOnly ? '__unassigned__' : filters.ownerEmail ?? ''}>
              <option value="">Všetci vlastníci</option>
              <option value="__unassigned__">Bez vlastníka</option>
              {adminUsers.map((user) => (
                <option key={user.id} value={user.email}>{user.name || user.email}{user.active ? '' : ' (neaktívny)'}</option>
              ))}
            </select>
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" name="due" value="1" defaultChecked={filters.dueOnly} />
            Termín dnes alebo skôr
          </label>
          <button type="submit">Filtrovať</button>
          <a href="/admin/kariera">Zrušiť filtre</a>
        </form>
      </section>

      <section className="admin-card">
        <h2>Uchádzači o spoluprácu</h2>
        <p className="admin-muted">Zoznam zámerne zobrazuje iba údaje potrebné na triedenie. Telefón, email a celý pracovný profil sú dostupné až v detaile žiadosti.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Uchádzač</th>
                <th>Prijaté</th>
                <th>Stav</th>
                <th>Vlastník</th>
                <th>Ďalší krok</th>
                <th>CV</th>
                <th>Notifikácie</th>
                <th>Akcia</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td><strong>{application.fullName}</strong><br /><small>{application.city || 'mesto neuvedené'}</small></td>
                  <td>{formatDate(application.createdAt)}</td>
                  <td><span className="admin-status-badge">{statusLabels[application.status]}</span></td>
                  <td>{application.ownerEmail || 'bez vlastníka'}</td>
                  <td>
                    {application.nextAction || 'neurčený'}
                    {application.followupDate ? <><br /><small>termín: {application.followupDate}</small></> : null}
                  </td>
                  <td>{application.cv ? 'priložený' : application.cvExpected ? 'nahrávanie nedokončené' : 'nepriložený'}</td>
                  <td>
                    <NotificationStatuses
                      entityType="career_application"
                      csrfToken={csrfToken}
                      canManage={admin.role === 'SUPER_ADMIN'}
                      notifications={notificationsByApplication.get(application.id) ?? []}
                    />
                  </td>
                  <td><a className="admin-row-link" href={`/admin/kariera/${application.id}`}>Otvoriť detail</a></td>
                </tr>
              ))}
              {!applications.length ? <tr><td colSpan={8}>Tomuto filtru nezodpovedá žiadna kariérna žiadosť.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <nav aria-label="Stránkovanie kariérnych žiadostí" className="admin-pagination">
          {page > 1 ? <a href={pageHref(page - 1, params)}>Predchádzajúca strana</a> : null}
          <span>Strana {page} z {totalPages} · celkom {counts.total} žiadostí</span>
          {page < totalPages ? <a href={pageHref(page + 1, params)}>Nasledujúca strana</a> : null}
        </nav>
      </section>
    </main>
  );
}
