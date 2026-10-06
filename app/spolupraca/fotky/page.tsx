import type { Metadata } from 'next';
import { listPhotoIntakeRecords } from '@/src/server/db';
import { currentPhotoUploadInvite } from '@/src/server/photo-intake-auth';
import { privatePhotoIntakeEnabled } from '@/src/server/photo-intake-config';
import { isPhotoCategory } from '@/src/server/photo-intake-policy';
import { PhotoIntakeHistory, PhotoIntakeLogin, PhotoIntakeUploader } from './photo-intake-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Súkromné nahrávanie fotiek | ASTANA',
  robots: { index: false, follow: false, noarchive: true },
};

const statuses: Record<string, string> = {
  pending_upload: 'Nahrávanie sa nedokončilo',
  pending_review: 'Čaká na kontrolu',
  approved_private: 'Skontrolované – zatiaľ súkromné',
  rejected: 'Neschválené',
  deletion_pending: 'Čaká na bezpečné odstránenie',
};

export default async function PhotoIntakePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const requestedPage = Number(params.page);
  const requestedPageNumber = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const enabled = privatePhotoIntakeEnabled();
  const invite = enabled ? await currentPhotoUploadInvite() : null;
  const history = invite
    ? await listPhotoIntakeRecords({ inviteId: invite.id, page: requestedPageNumber, pageSize: 50 }).then((data) => ({ data, error: false })).catch(() => ({ data: null, error: true }))
    : { data: null, error: false };
  const rows = history.data?.records ?? [];
  const visibleRows = rows.map(({ id, originalName, locality, categories, status, sizeBytes, metadataVersion }) => ({ id, originalName, locality, categories: categories.filter(isPhotoCategory), status, sizeBytes, metadataVersion }));

  return <main className="photo-intake-page">
    <header><a href="/" aria-label="ASTANA – domovská stránka"><img src="/assets/astana-logo.png" width="150" height="50" alt="ASTANA" /></a><span>Súkromná spolupráca</span></header>
    <div className="photo-intake-content">
      <p className="photo-intake-eyebrow">ASTANA · FOTKY Z TERÉNU</p>
      <h1>Nahraj fotografie z realizácie</h1>
      {invite?.workerLabel ? <p className="photo-intake-assignment">Pozvánka pre: <strong>{invite.workerLabel}</strong></p> : null}
      {invite?.businessJob ? <p className="photo-intake-assignment">Fotky patria k dokončenej zákazke: <strong>{invite.businessJob.demolitionDate}{invite.businessJob.district ? ` · ${invite.businessJob.district}` : ''}</strong></p> : null}
      <p className="photo-intake-intro">Fotografie sa uložia súkromne a najprv ich skontrolujeme. Bez výslovného schválenia ich nezverejníme. Miesto a kategóriu môžeš doplniť aj neskôr. Ak si nie si istý, nechaj ich prázdne. Nepíš mená zákazníkov, ulicu ani presnú adresu.</p>

      {!enabled ? <section className="photo-intake-notice" role="status">
        <strong>Nahrávanie ešte nie je zapnuté.</strong>
        <p>Portál spustíme až po overení súkromného úložiska, prístupových pravidiel a bezpečného uchovávania a odstraňovania fotografií.</p>
      </section> : invite ? <PhotoIntakeUploader inviteId={invite.id} /> : <PhotoIntakeLogin />}

      {invite && history.error ? <section className="photo-intake-history" role="alert"><h2>História dočasne nie je dostupná</h2><p>Fotografie sa nestratili. Obnov stránku o chvíľu alebo kontaktuj správcu.</p></section> : null}
      {invite && visibleRows.length ? <section className="photo-intake-history">
        <h2>Tvoje odoslané fotografie</h2>
        <PhotoIntakeHistory photos={visibleRows} statuses={statuses} />
        {history.data && history.data.totalPages > 1 ? <nav className="admin-pagination" aria-label="Stránkovanie odovzdaných fotografií">
          {history.data.page > 1 ? <a href={`?page=${history.data.page - 1}`}>Novšie fotografie</a> : null}
          <span>Strana {history.data.page} z {history.data.totalPages}</span>
          {history.data.page < history.data.totalPages ? <a href={`?page=${history.data.page + 1}`}>Staršie fotografie</a> : null}
        </nav> : null}
      </section> : null}
      <footer>Prístupový odkaz je určený iba osobám, ktorým ho ASTANA poskytla. Ak sa má zverejniť fotografia alebo lokalita, najprv to musí schváliť správca.</footer>
    </div>
  </main>;
}
