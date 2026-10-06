import { csrfTokenForEmail, requireSuperAdmin } from '@/src/server/auth';
import { listPhotoIntakeJobOptions, listPhotoIntakeRecords, listPhotoUploadInvites, listRevokedPendingPhotoCleanupInvites } from '@/src/server/db';
import { privatePhotoIntakeEnabled } from '@/src/server/photo-intake-config';
import { isApproximateLocality, photoIntakeRetentionDays } from '@/src/server/photo-intake-policy';
import { cleanupRevokedPendingPhotoInviteAction, createCaseDraftFromPhotoAction, reviewPhotoAction, revokePhotoInviteAction, updatePhotoIntakeMetadataAction, withdrawApprovedPhotoAction } from './actions';
import InviteTool from './invite-tool';

const statusLabels: Record<string, string> = {
  pending_upload: 'Nedokončené nahrávanie',
  pending_review: 'Čaká na kontrolu',
  approved_private: 'Skontrolované – stále súkromné',
  rejected: 'Neschválené',
  deletion_pending: 'Čaká na bezpečné odstránenie',
};

const categoryLabels: Record<string, string> = {
  family_house: 'Rodinný dom', outbuilding: 'Hospodárska budova', garage: 'Garáž', illegal_dump: 'Nelegálna skládka', interior: 'Interiér',
};

function photoAdminPageHref(page: number, invitePage: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (invitePage > 1) params.set('invitePage', String(invitePage));
  return params.size ? `?${params}` : '/admin/realizacie/fotky';
}

export default async function PhotoIntakeAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireSuperAdmin();
  const params = await searchParams;
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedInvitePage = Number(params.invitePage);
  const invitePage = Number.isInteger(requestedInvitePage) && requestedInvitePage > 0 ? requestedInvitePage : 1;
  const [invitesResult, photosResult, cleanupResult, jobResult] = await Promise.all([
    listPhotoUploadInvites({ page: invitePage, pageSize: 50 }).then((data) => ({ data, error: false })).catch(() => ({ data: null, error: true })),
    listPhotoIntakeRecords({ page, pageSize: 50 }).then((data) => ({ data, error: false })).catch(() => ({ data: null, error: true })),
    listRevokedPendingPhotoCleanupInvites().then((data) => ({ data, error: false })).catch(() => ({ data: [], error: true })),
    listPhotoIntakeJobOptions().then((data) => ({ data, error: false })).catch(() => ({ data: [], error: true })),
  ]);
  const invites = invitesResult.data?.invites ?? [];
  const photos = photosResult.data?.records ?? [];
  const cleanupInvites = cleanupResult.data;
  const csrfToken = csrfTokenForEmail(admin.email);
  const enabled = privatePhotoIntakeEnabled();
  const reviewNotice = params.review === 'stale';

  return <main className="admin-page photo-admin-page">
    <div className="admin-heading"><div><p>Príjem súkromných podkladov</p><h1>Fotky z terénu</h1></div><a className="admin-secondary-link" href="/admin/realizacie">Späť na realizácie</a></div>
    <section className="admin-card">
      <h2>Prístup pracovníkov</h2>
      <p>Každý kód sa uloží iba ako hash a dá sa použiť len raz. Nový kód vyžaduje priradenie k dokončenej zákazke. Kód zdieľajte súkromným kanálom. Pracovník neuvidí CRM ani administráciu; prístup možno okamžite odvolať.</p>
      <p><strong>Návrh technických lehôt – pred zapnutím ich musí potvrdiť majiteľ:</strong> nedokončené nahratie {photoIntakeRetentionDays.pendingUpload} deň, čakajúce na kontrolu {photoIntakeRetentionDays.pendingReview} dní, zamietnuté {photoIntakeRetentionDays.rejected} dní a interne schválené {photoIntakeRetentionDays.approvedPrivate} dní. Automatické odstránenie začne fungovať až po samostatnom zapnutí a overení retenčného jobu; pri chybe musí záznam zostať v bezpečnej fronte na opakovanie. Schválenú fotku môžeš kedykoľvek odobrať; okamžite prestane byť dostupná v konceptoch a systém ju zaradí na bezpečné odstránenie.</p>
      <p>Fotky pripojené k súkromnému konceptu realizácie sa kvôli zachovaniu konceptu automaticky neodstránia. Pred zapnutím portálu treba potvrdiť aj ich retenčnú lehotu a spôsob uzavretia starých konceptov.</p>
      {!enabled ? <div className="photo-intake-notice"><strong>Portál je vypnutý.</strong><p>Pred zapnutím treba v nastaveniach Vercel potvrdiť samostatné úložisko v režime Private, jeho samostatný token a podpisový kľúč, správnu väzbu na projekt a databázu, potom úspešne vyskúšať nahratie aj odmietnutie neoprávneného čítania v Preview. Samotný konfiguračný príznak režim úložiska nedokazuje. Majiteľ musí osobitne potvrdiť retenčné lehoty a až potom možno v Preview otestovať denný mazací job. Kódy pracovníkom nevytvárajte, kým tieto kontroly nie sú hotové.</p></div> : null}
      {jobResult.error ? <p role="alert">Dokončené zákazky sa nepodarilo načítať. Pozvánku zatiaľ nemožno bezpečne vytvoriť.</p> : null}
      <InviteTool csrfToken={csrfToken} enabled={enabled && !jobResult.error} jobs={jobResult.data} />
      {invitesResult.error ? <p role="alert">Pozvánky sa nepodarilo načítať. Skontrolujte pripojenie databázy a obnovte stránku.</p> : null}
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Vytvorená</th><th>Určené pre</th><th>Priradená zákazka</th><th>Platnosť</th><th>Stav</th><th>Akcia</th></tr></thead><tbody>
        {invites.map((invite) => <tr key={invite.id}>
          <td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(invite.createdAt))}</td>
          <td>{invite.workerLabel || 'Neoznačená staršia pozvánka'}</td>
          <td>{invite.businessJob ? `${invite.businessJob.demolitionDate}${invite.businessJob.district ? ` · ${invite.businessJob.district}` : ''} · ${invite.businessJob.status}` : 'Staršia pozvánka bez priradenia'}</td>
          <td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(invite.expiresAt))}</td>
          <td>{invite.revokedAt ? 'Odvolaná' : invite.consumedAt ? 'Použitá – relácia môže byť aktívna' : new Date(invite.expiresAt) <= new Date() ? 'Expirovaná' : 'Nevyužitá'}</td>
          <td>{!invite.revokedAt && new Date(invite.expiresAt) > new Date() ? <form action={revokePhotoInviteAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={invite.id} /><button type="submit">Odvolať</button></form> : '—'}</td>
        </tr>)}
        {!invites.length ? <tr><td colSpan={6}>Zatiaľ nebol vytvorený žiadny kód.</td></tr> : null}
      </tbody></table></div>
      {invitesResult.data && invitesResult.data.totalPages > 1 ? <nav className="admin-pagination" aria-label="Stránkovanie pozvánok pracovníkov">
        <span>Zobrazené {((invitesResult.data.page - 1) * invitesResult.data.pageSize) + 1}–{Math.min(invitesResult.data.page * invitesResult.data.pageSize, invitesResult.data.total)} z {invitesResult.data.total}</span>
        {invitesResult.data.page > 1 ? <a href={photoAdminPageHref(page, invitesResult.data.page - 1)}>Novšie pozvánky</a> : null}
        <span>Strana {invitesResult.data.page} z {invitesResult.data.totalPages}</span>
        {invitesResult.data.page < invitesResult.data.totalPages ? <a href={photoAdminPageHref(page, invitesResult.data.page + 1)}>Staršie pozvánky</a> : null}
      </nav> : null}
    </section>
    {cleanupInvites.length ? <section className="admin-card">
      <h2>Nedokončené súbory na upratanie</h2>
      <p>Súbory s klientskym tokenom z posledného dňa nechávame pre prípad, že upload ešte prebieha. Ostatné môžeš bezpečne znovu skontrolovať; systém ich odstráni až po bezpečnom prevzatí záznamu.</p>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pozvánka</th><th>Stav</th><th>Počet čakajúcich</th><th>Akcia</th></tr></thead><tbody>
      {cleanupInvites.map((invite) => <tr key={invite.inviteId}>
          <td>{invite.inviteId}</td>
          <td>{invite.revokedAt ? 'Odvolaná' : 'Expirovaná'}</td>
          <td>{invite.pendingCount}</td>
          <td><form action={cleanupRevokedPendingPhotoInviteAction}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="inviteId" value={invite.inviteId} />
            <button type="submit">Skontrolovať bezpečné odstránenie</button>
          </form></td>
        </tr>)}
      </tbody></table></div>
    </section> : null}
    {cleanupResult.error ? <p role="alert">Zoznam čakajúcich odstránení sa nepodarilo načítať.</p> : null}
    <section className="admin-card">
      <h2>Kontrola fotografií</h2>
      {reviewNotice ? <p role="status">Fotografia alebo jej popis sa medzitým zmenili. Skontrolujte aktuálny záznam a potvrďte rozhodnutie znova.</p> : null}
      <p>Schválenie tu znamená iba interné schválenie podkladu. Nezverejňuje fotografiu ani ju nepridáva do realizácií.</p>
      {photosResult.error ? <p role="alert">Záznamy fotografií sa nepodarilo načítať. Nejde o prázdny zoznam — skontrolujte databázu a obnovte stránku.</p> : null}
      <div className="photo-admin-grid">{photos.map((photo) => <article key={photo.id}>
        {photo.status !== 'pending_upload' && photo.status !== 'deletion_pending' ? <img src={`/api/photo-intake/media/${photo.id}`} alt="Súkromná fotografia na kontrolu" loading="lazy" /> : <div className="photo-intake-pending">{photo.status === 'deletion_pending' ? 'Čaká na odstránenie zo súkromného úložiska' : 'Náhľad sa objaví po potvrdení nahratia'}</div>}
        <strong>{photo.originalName}</strong>
        <small>{photo.locality || 'Lokalita neuvedená'}{photo.categories.length ? ` · ${photo.categories.map((item) => categoryLabels[item] || 'Iné').join(', ')}` : ''}</small>
        <span>{statusLabels[photo.status] || photo.status} · {(photo.sizeBytes / 1024 / 1024).toLocaleString('sk-SK', { maximumFractionDigits: 1 })} MB</span>
        {photo.deletionError ? <small role="alert">{photo.deletionError} Počet neúspešných pokusov: {photo.deletionAttempts}.</small> : null}
        {photo.status === 'pending_review' || photo.status === 'approved_private' ? <form className="photo-intake-metadata-form" action={updatePhotoIntakeMetadataAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="metadataVersion" value={photo.metadataVersion} />
          <label>Lokalita (iba obec alebo približná oblasť)
            <input name="locality" defaultValue={photo.locality} maxLength={120} placeholder="Napríklad Poprad alebo okolie" />
          </label>
          <fieldset><legend>Typ objektu alebo prostredia</legend>
            {Object.entries(categoryLabels).map(([key, label]) => <label key={key}>
              <input type="checkbox" name="categories" value={key} defaultChecked={photo.categories.includes(key)} /> {label}
            </label>)}
          </fieldset>
          <button type="submit">Uložiť popis fotky</button>
        </form> : null}
        {photo.status === 'pending_review' ? <div className="photo-intake-actions">
          {!isApproximateLocality(photo.locality) || !photo.categories.length ? <p role="note">Pred interným schválením doplňte a overte približnú lokalitu a aspoň jeden typ objektu.</p> : null}
          <form action={reviewPhotoAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={photo.id} /><input type="hidden" name="metadataVersion" value={photo.metadataVersion} /><input type="hidden" name="decision" value="approve" /><button type="submit" disabled={!isApproximateLocality(photo.locality) || !photo.categories.length}>Schváliť interne</button></form>
          <form action={reviewPhotoAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={photo.id} /><input type="hidden" name="metadataVersion" value={photo.metadataVersion} /><input type="hidden" name="decision" value="reject" /><button type="submit" className="photo-intake-quiet">Neschváliť</button></form>
        </div> : null}
        {photo.status === 'approved_private' ? <form action={withdrawApprovedPhotoAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="metadataVersion" value={photo.metadataVersion} />
          <button type="submit" className="photo-intake-quiet">Odobrať fotku a zaradiť na odstránenie</button>
        </form> : null}
        {photo.status === 'approved_private' && photo.businessJobId ? <form className="photo-case-draft-action" action={createCaseDraftFromPhotoAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="hidden" name="id" value={photo.id} />
          <button type="submit">Pripraviť alebo otvoriť koncept realizácie</button>
          <small>Predvyplní iba lokalitu a typ objektu. Text sa dopĺňa ručne; zverejnenie vyžaduje samostatné schválenie.</small>
        </form> : null}
      </article>)}
      {!photos.length && !photosResult.error ? <p>Zatiaľ neboli odovzdané žiadne fotografie.</p> : null}</div>
      {photosResult.data && photosResult.data.totalPages > 1 ? <nav className="admin-pagination" aria-label="Stránkovanie fotografií">
        <span>Zobrazené {((photosResult.data.page - 1) * photosResult.data.pageSize) + 1}–{Math.min(photosResult.data.page * photosResult.data.pageSize, photosResult.data.total)} z {photosResult.data.total}</span>
        {photosResult.data.page > 1 ? <a href={photoAdminPageHref(photosResult.data.page - 1, invitePage)}>Novšie fotografie</a> : null}
        <span>Strana {photosResult.data.page} z {photosResult.data.totalPages}</span>
        {photosResult.data.page < photosResult.data.totalPages ? <a href={photoAdminPageHref(photosResult.data.page + 1, invitePage)}>Staršie fotografie</a> : null}
      </nav> : null}
    </section>
  </main>;
}
