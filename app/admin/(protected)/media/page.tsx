import { requireSuperAdmin } from '@/src/server/auth';
import { listMediaLibraryRecords, type RealizationMediaIntake } from '@/src/server/db';

const statusLabels: Record<string, string> = {
  pending_review: 'Čaká na kontrolu',
  approved_private: 'Interne schválená',
  rejected: 'Neschválená',
};

const categoryLabels: Record<string, string> = {
  family_house: 'Rodinný dom',
  outbuilding: 'Hospodárska budova',
  garage: 'Garáž',
  illegal_dump: 'Nelegálna skládka',
  interior: 'Interiér',
};

function mediaHref(params: { status: string; category: string; usage: string; page: number }) {
  const query = new URLSearchParams();
  if (params.status !== 'all') query.set('status', params.status);
  if (params.category) query.set('category', params.category);
  if (params.usage !== 'all') query.set('usage', params.usage);
  if (params.page > 1) query.set('page', String(params.page));
  return query.size ? `/admin/media?${query}` : '/admin/media';
}

export default async function MediaLibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSuperAdmin();
  const params = await searchParams;
  const allowedStatuses = new Set(['all', 'pending_review', 'approved_private', 'rejected']);
  const status = allowedStatuses.has(params.status || '') ? String(params.status) : 'all';
  const category = Object.hasOwn(categoryLabels, params.category || '') ? String(params.category) : '';
  const usage = params.usage === 'used' || params.usage === 'unused' ? params.usage : 'all';
  const requestedPage = Number(params.page);
  const result = await listMediaLibraryRecords({
    status: status as RealizationMediaIntake['status'] | 'all',
    category,
    usage,
    page: Number.isInteger(requestedPage) ? requestedPage : 1,
    pageSize: 48,
  });

  return <main className="admin-page media-library-page">
    <div className="admin-heading">
      <div><p>Bezpečný prehľad súkromných podkladov</p><h1>Knižnica médií</h1></div>
      <a className="admin-secondary-link" href="/admin/realizacie/fotky">Schvaľovanie fotiek</a>
    </div>

    <section className="admin-card">
      <h2>Čo knižnica robí</h2>
      <p>Fotografie zostávajú v súkromnom úložisku. Tu vidíte ich stav a použitie; nič sa automaticky nezverejní. Verejná fotografia vznikne až po schválení celého konceptu realizácie.</p>
      <form className="admin-filter-bar" method="get">
        <label>Stav
          <select name="status" defaultValue={status}>
            <option value="all">Všetky spracované</option>
            <option value="approved_private">Interne schválené</option>
            <option value="pending_review">Čakajú na kontrolu</option>
            <option value="rejected">Neschválené</option>
          </select>
        </label>
        <label>Typ objektu
          <select name="category" defaultValue={category}>
            <option value="">Všetky typy</option>
            {Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>Použitie
          <select name="usage" defaultValue={usage}>
            <option value="all">Použité aj voľné</option>
            <option value="used">Pripojené ku konceptu</option>
            <option value="unused">Zatiaľ nepoužité</option>
          </select>
        </label>
        <button type="submit">Použiť filtre</button>
        <a href="/admin/media">Zrušiť filtre</a>
      </form>
    </section>

    <section className="admin-stat-grid" aria-label="Súhrn knižnice">
      <article><span>Nájdené fotografie</span><strong>{result.total}</strong></article>
      <article><span>Aktuálna strana</span><strong>{result.page}/{result.totalPages}</strong></article>
    </section>

    <section className="photo-admin-grid media-library-grid" aria-label="Fotografie v knižnici">
      {result.records.map((photo) => <article key={photo.id}>
        <img src={`/api/photo-intake/media/${photo.id}`} alt="Súkromná fotografia v knižnici médií" loading="lazy" />
        <div className="media-library-meta">
          <strong>{photo.originalName}</strong>
          <span className="status-pill">{statusLabels[photo.status] || photo.status}</span>
        </div>
        <small>{photo.locality || 'Lokalita neuvedená'} · {photo.categories.map((item) => categoryLabels[item] || 'Iné').join(', ') || 'typ objektu neuvedený'}</small>
        <small>Nahraná {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(photo.uploadedAt || photo.createdAt))} · {(photo.sizeBytes / 1024 / 1024).toLocaleString('sk-SK', { maximumFractionDigits: 1 })} MB</small>
        {photo.businessJobId ? <a className="admin-secondary-link" href={`/admin/zakazky/${photo.businessJobId}`}>Otvoriť zákazku</a> : <span className="admin-muted">Bez priradenej zákazky</span>}
        {photo.caseUses.length ? <div className="media-library-uses">
          <strong>Použitie v konceptoch</strong>
          {photo.caseUses.map((use) => <a href={`/admin/realizacie/pripady?id=${use.id}`} key={use.id}>{use.title} · {use.lifecycle}</a>)}
        </div> : <span className="admin-muted">Zatiaľ nie je pripojená ku konceptu.</span>}
      </article>)}
      {!result.records.length ? <div className="work-empty"><h2>Žiadne fotografie pre zvolené filtre</h2><p>Skúste zmeniť stav, typ objektu alebo použitie.</p></div> : null}
    </section>

    {result.totalPages > 1 ? <nav className="admin-pagination" aria-label="Stránkovanie knižnice médií">
      <span>Zobrazené {(result.page - 1) * result.pageSize + 1}–{Math.min(result.page * result.pageSize, result.total)} z {result.total}</span>
      {result.page > 1 ? <a href={mediaHref({ status, category, usage, page: result.page - 1 })}>Novšie fotografie</a> : null}
      <span>Strana {result.page} z {result.totalPages}</span>
      {result.page < result.totalPages ? <a href={mediaHref({ status, category, usage, page: result.page + 1 })}>Staršie fotografie</a> : null}
    </nav> : null}
  </main>;
}
