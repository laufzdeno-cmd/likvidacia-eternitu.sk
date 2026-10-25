import { notFound } from 'next/navigation';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import { getCareerApplication, listAdminUsers, listApplicationNotificationStatuses } from '@/src/server/db';
import NotificationStatuses from '../../notifications/notification-statuses';
import {
  archiveCareerApplicationAction,
  restoreCareerApplicationAction,
  updateCareerApplicationWorkflowAction,
} from './actions';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cooperationLabels = { szco: 'živnostník / SZČO', crew: 'partia živnostníkov', other: 'iná forma spolupráce' } as const;
const statusLabels = { new: 'Nová', reviewed: 'Skontrolovaná', archived: 'Archivovaná' } as const;

function yesNo(value: boolean) {
  return value ? 'áno' : 'nie';
}

export default async function CareerApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const admin = await requireAdminUser();
  const [application, adminUsers, notifications] = await Promise.all([
    getCareerApplication(id),
    listAdminUsers(),
    listApplicationNotificationStatuses('career_application', [id]),
  ]);
  if (!application) notFound();

  const csrfToken = csrfTokenForEmail(admin.email);
  const createdAt = new Intl.DateTimeFormat('sk-SK', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(application.createdAt));
  const activeAdminUsers = adminUsers.filter((user) => user.active && user.role !== 'META_REVIEWER');
  const currentOwnerIsActive = !application.ownerEmail
    || activeAdminUsers.some((user) => user.email === application.ownerEmail);

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>{statusLabels[application.status]} · prijaté {createdAt}</p>
          <h1>{application.fullName}</h1>
        </div>
        <a className="admin-secondary-link" href="/admin/kariera">Späť na kariérne žiadosti</a>
      </div>

      <section className="admin-detail-grid">
        <article className="admin-card">
          <h2>Kontakt</h2>
          <dl className="admin-dl">
            <div><dt>Meno a priezvisko</dt><dd>{application.fullName}</dd></div>
            <div><dt>Telefón</dt><dd><a href={`tel:${application.phone}`}>{application.phone}</a></dd></div>
            <div><dt>Email</dt><dd><a href={`mailto:${application.email}`}>{application.email}</a></dd></div>
            <div><dt>Mesto / okres</dt><dd>{application.city || 'neuvedené'}</dd></div>
          </dl>
        </article>

        <article className="admin-card">
          <h2>Pracovný profil</h2>
          <dl className="admin-dl">
            <div><dt>Forma spolupráce</dt><dd>{cooperationLabels[application.cooperationType]}</dd></div>
            <div><dt>Kde môže pracovať</dt><dd>{application.workRegions || 'neuvedené'}</dd></div>
            <div><dt>Živnosť</dt><dd>{yesNo(application.hasTradeLicense)}</dd></div>
            <div><dt>Skúsenosť s prácou vo výške</dt><dd>{yesNo(application.workAtHeights)}</dd></div>
            <div><dt>Skúsenosť s azbestom</dt><dd>{yesNo(application.hasAsbestosExperience)}</dd></div>
            <div><dt>Aké skúsenosti s azbestom</dt><dd>{application.asbestosExperience || 'bez doplnenia'}</dd></div>
            <div><dt>Ďalšie skúsenosti</dt><dd>{application.experience || 'bez doplnenia'}</dd></div>
            <div><dt>Poznámka</dt><dd>{application.note || 'bez poznámky'}</dd></div>
            <div><dt>Súhlas so spracovaním údajov</dt><dd>{yesNo(application.privacyConsent)}</dd></div>
          </dl>
        </article>
      </section>

      <section className="admin-detail-grid">
        <article className="admin-card">
          <h2>Životopis</h2>
          {application.cv ? (
            <p><a className="admin-row-link" href={`/admin/kariera/${application.id}/zivotopis`}>Stiahnuť životopis ({application.cv.originalName})</a></p>
          ) : application.cvExpected ? (
            <p className="admin-alert">Uchádzač označil životopis, ale nahrávanie sa nedokončilo.</p>
          ) : (
            <p>Životopis nebol priložený.</p>
          )}
        </article>

        <article className="admin-card">
          <h2>Notifikácie</h2>
          <NotificationStatuses entityType="career_application" csrfToken={csrfToken} canManage={admin.role === 'SUPER_ADMIN'} notifications={notifications} />
        </article>
      </section>

      <section className="admin-card">
        <h2>Spracovanie žiadosti</h2>
        {application.status === 'archived' ? (
          <>
            <p>Žiadosť je archivovaná a jej pracovný postup sa nedá upravovať.</p>
            {admin.role === 'SUPER_ADMIN' ? (
              <form action={restoreCareerApplicationAction}>
                <input type="hidden" name="_csrf" value={csrfToken} />
                <input type="hidden" name="id" value={application.id} />
                <button className="admin-secondary-link" type="submit">Obnoviť žiadosť</button>
              </form>
            ) : null}
          </>
        ) : (
          <form action={updateCareerApplicationWorkflowAction} className="admin-quote-form">
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="id" value={application.id} />
            <input type="hidden" name="expectedUpdatedAt" value={application.updatedAt} />
            <label>
              Stav
              <select name="status" defaultValue={application.status} required>
                <option value="new">Nová</option>
                <option value="reviewed">Skontrolovaná</option>
              </select>
            </label>
            <label>
              Vlastník
              <select name="ownerEmail" defaultValue={currentOwnerIsActive ? application.ownerEmail : ''}>
                <option value="">Bez vlastníka</option>
                {activeAdminUsers.map((user) => (
                  <option key={user.id} value={user.email}>{user.name || user.email}</option>
                ))}
              </select>
            </label>
            {!currentOwnerIsActive ? (
              <p className="admin-alert admin-form-wide" role="status">Pôvodný vlastník už nie je aktívny. Vyberte nového vlastníka alebo možnosť Bez vlastníka.</p>
            ) : null}
            <label>
              Termín ďalšieho kroku
              <input type="date" name="followupDate" defaultValue={application.followupDate || ''} />
            </label>
            <label className="admin-form-wide">
              Ďalší krok
              <textarea name="nextAction" rows={4} maxLength={300} defaultValue={application.nextAction || ''} placeholder="Napríklad: zavolať uchádzačovi a overiť dostupnosť." />
            </label>
            <button className="admin-primary-button admin-form-wide" type="submit">Uložiť pracovný postup</button>
          </form>
        )}
      </section>

      {application.status !== 'archived' ? (
        <section className="admin-card">
          <h2>Archivácia</h2>
          <p className="admin-muted">Archivácia skryje žiadosť z predvoleného zoznamu. Záznam ani osobné údaje týmto krokom nemažete.</p>
          <form action={archiveCareerApplicationAction}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="id" value={application.id} />
            <label className="admin-checkbox">
              <input type="checkbox" name="confirm" value="archive" required />
              Rozumiem, že žiadosť zmizne z aktívnej pracovnej fronty.
            </label>
            <button className="admin-danger-outline" type="submit">Archivovať žiadosť</button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
