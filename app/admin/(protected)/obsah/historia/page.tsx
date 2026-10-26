import { csrfTokenForEmail, requireSuperAdmin } from '@/src/server/auth';
import { listSiteContent, listSiteContentVersions, siteContentSnapshotHash } from '@/src/server/db';
import { restoreSiteContentVersionAction } from '../actions';

const actionLabels = {
  baseline: 'Východisková verzia',
  saved: 'Uložená úprava',
  restored: 'Obnovená verzia',
} as const;

function changedKeyCount(current: Record<string, string>, candidate: Record<string, string>) {
  const keys = new Set([...Object.keys(current), ...Object.keys(candidate)]);
  return [...keys].filter((key) => current[key] !== candidate[key]).length;
}

export default async function SiteContentHistoryPage({ searchParams }: { searchParams: Promise<{ stav?: string; verzia?: string }> }) {
  const admin = await requireSuperAdmin();
  const [stored, versions, params] = await Promise.all([listSiteContent(), listSiteContentVersions(50), searchParams]);
  const current = Object.fromEntries(stored.map((item) => [item.key, item.value]));
  const currentHash = siteContentSnapshotHash(current);
  const csrfToken = csrfTokenForEmail(admin.email);
  const statusMessage = params.stav === 'obnovene'
    ? 'Staršia verzia bola obnovená a zapísaná ako nová auditovateľná verzia.'
    : params.stav === 'konflikt'
      ? 'Obsah sa medzitým zmenil alebo verzia už nie je dostupná. Obnovte stránku a skontrolujte históriu znova.'
      : params.stav === 'potvrdenie'
        ? 'Obnova sa nevykonala. Do potvrdzovacieho poľa napíšte presne OBNOVIŤ.'
        : '';

  return <main className="admin-page content-history-page">
    <div className="admin-heading">
      <div><p>Bezpečná obnova bez mazania histórie</p><h1>História obsahu</h1></div>
      <a className="admin-secondary-link" href="/admin/obsah">Späť na Obsah a GEO</a>
    </div>
    {statusMessage ? <div className={`admin-alert ${params.stav === 'obnovene' ? 'is-success' : ''}`} role="status">{statusMessage}</div> : null}

    <section className="admin-card">
      <h2>Ako funguje obnova</h2>
      <p>Obnova nikdy nevymaže históriu. Vybraná snímka sa uloží ako nová aktuálna verzia a zapíše sa do auditu. Menia sa iba povolené texty úvodnej stránky; ponuky, dopyty, meranie ani fotografie sa nemenia.</p>
    </section>

    <section className="content-version-list" aria-label="Uložené verzie obsahu">
      {versions.map((version) => {
        const isCurrent = version.contentHash === currentHash;
        const changed = changedKeyCount(current, version.values);
        return <article className={`admin-card content-version-card ${params.verzia === version.id ? 'is-restored' : ''}`} key={version.id}>
          <header>
            <div><p>{actionLabels[version.action]}</p><h2>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(version.createdAt))}</h2></div>
            <span className="status-pill">{isCurrent ? 'Aktuálna' : `${changed} rozdielnych polí`}</span>
          </header>
          <dl className="admin-dl">
            <div><dt>Uložil</dt><dd>{version.createdBy}</dd></div>
            <div><dt>Kontrolný odtlačok</dt><dd><code>{version.contentHash.slice(0, 12)}</code></dd></div>
          </dl>
          {!isCurrent ? <form action={restoreSiteContentVersionAction} className="admin-form-stack">
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="versionId" value={version.id} />
            <input type="hidden" name="expectedCurrentHash" value={currentHash} />
            <label>Pre potvrdenie napíšte OBNOVIŤ
              <input name="confirmation" required autoComplete="off" />
            </label>
            <button className="admin-danger-outline" type="submit">Obnoviť túto verziu</button>
          </form> : <p className="admin-muted">Táto verzia je práve použitá na webe.</p>}
        </article>;
      })}
      {!versions.length ? <section className="work-empty"><h2>História zatiaľ nevznikla</h2><p>Prvá východisková a nová verzia sa vytvoria pri najbližšom bezpečnom uložení textov.</p></section> : null}
    </section>
  </main>;
}
