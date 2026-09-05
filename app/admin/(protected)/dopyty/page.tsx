import { getLeadInsight, statusLabels, type LeadTag } from '@/src/server/lead-insights';
import { getLeadQueueCounts, listAdminUsers, listLeadSummaryPage } from '@/src/server/db';
import { requireAdminUser } from '@/src/server/auth';
import { cleanSlovakText } from '@/src/server/slovak-text';
import type { LeadStatus } from '@/src/server/types';
import { restoreLeadAction } from './[id]/actions';

const statusOptions: Array<['', string] | [LeadStatus, string]> = [
  ['', 'Všetky stavy'],
  ['novy', 'Nový'],
  ['kontaktovany', 'Kontaktovaný'],
  ['caka_na_doplnenie', 'Zavolať neskôr'],
  ['naceneny', 'Nacenený'],
  ['cenova_ponuka_odoslana', 'Ponuka odoslaná'],
  ['objednane', 'Prijatý'],
  ['v_realizacii', 'V realizácii'],
  ['dokoncena', 'Dokončený'],
  ['zrusena', 'Zrušený'],
  ['nevyslo', 'Odmietnutý'],
  ['archivovane', 'Archivovaný'],
];

const tagOptions: Array<['', string] | [LeadTag, string]> = [
  ['', 'Všetky štítky'],
  ['chyba_fotka', 'Chýbajú fotky'],
  ['potrebuje_strechara', 'Potrebuje strechára'],
  ['urgentne', 'Urgentné'],
  ['nad_100_m2', 'Nad 100 m2'],
  ['pripravene_na_nacenenie', 'Pripravené na nacenenie'],
];

const queueOptions = [
  { value: 'new', label: 'Nové dopyty', description: 'Ešte bez prvého kontaktu' },
  { value: 'unassigned', label: 'Bez vlastníka', description: 'Treba priradiť zodpovednosť' },
  { value: 'followup', label: 'Follow-up', description: 'Dnes alebo po termíne' },
  { value: 'waiting', label: 'Čaká na doplnenie', description: 'Chýbajú údaje od zákazníka' },
  { value: 'quote', label: 'Pripravené na ponuku', description: 'Možno naceniť' },
  { value: 'active', label: 'V spracovaní', description: 'Kontaktované a rozpracované' },
] as const;

type QueueValue = (typeof queueOptions)[number]['value'];

function isQueue(value: string): value is QueueValue {
  return queueOptions.some((item) => item.value === value);
}

function pageValue(value: string | undefined) {
  const parsed = Number(value || 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function pageSizeValue(value: string | undefined) {
  const parsed = Number(value || 25);
  return parsed === 50 || parsed === 100 ? parsed : 25;
}

function pageHref(params: Record<string, string | undefined>, page: number, pageSize: number) {
  const query = new URLSearchParams();
  for (const key of ['q', 'status', 'tag', 'queue', 'owner']) {
    if (params[key]) query.set(key, params[key] as string);
  }
  if (params.archived === '1') query.set('archived', '1');
  query.set('page', String(page));
  query.set('pageSize', String(pageSize));
  return `/admin/dopyty?${query.toString()}`;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const adminUser = await requireAdminUser();
  const q = (params.q || '').trim();
  const status = (params.status || '') as LeadStatus | '';
  const tag = (params.tag || '') as LeadTag | '';
  const queue = isQueue(params.queue || '') ? params.queue as QueueValue : '';
  const ownerEmail = (params.owner || '').trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const archivedOnly = params.archived === '1' && adminUser.role === 'SUPER_ADMIN';
  const pageSize = pageSizeValue(params.pageSize);
  const [leadPage, queueCounts, adminUsers] = await Promise.all([
    listLeadSummaryPage({ archivedOnly, q, status, tag, queue, ownerEmail, today, page: pageValue(params.page), pageSize }),
    archivedOnly ? Promise.resolve({ total: 0, newLeads: 0, unassigned: 0, followups: 0, waiting: 0, quote: 0, active: 0 }) : getLeadQueueCounts(today),
    listAdminUsers(),
  ]);
  const leads = leadPage.items.map((lead) => ({ lead, insight: getLeadInsight(lead, lead.fileCount, lead.quoteCount) }));
  const ownerName = new Map(adminUsers.map((user) => [user.email, user.name || user.email]));

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Obchodný tok</p>
          <h1>Dopyty</h1>
        </div>
        <div className="admin-heading-meta">{archivedOnly ? `${leadPage.total} archivovaných dopytov` : `${queueCounts.total} aktívnych dopytov`}</div>
      </div>

      {!archivedOnly ? (
        <section className="admin-card admin-work-queues">
          <div className="admin-section-heading">
            <div><p>Práca na dnes</p><h2>Pracovné fronty</h2></div>
            {adminUser.role === 'SUPER_ADMIN' ? <a href="/admin/dopyty?archived=1">Zobraziť archivované</a> : null}
          </div>
          <div className="admin-queue-grid">
            {queueOptions.map((item) => {
              const count = item.value === 'new'
                ? queueCounts.newLeads
                : item.value === 'unassigned'
                  ? queueCounts.unassigned
                  : item.value === 'followup'
                    ? queueCounts.followups
                    : item.value === 'waiting'
                      ? queueCounts.waiting
                      : item.value === 'quote'
                        ? queueCounts.quote
                        : queueCounts.active;
              return <a className={`admin-queue-link${queue === item.value ? ' is-active' : ''}`} href={`/admin/dopyty?queue=${item.value}`} key={item.value}><span>{item.label}</span><strong>{count}</strong><small>{item.description}</small></a>;
            })}
          </div>
        </section>
      ) : (
        <section className="admin-card admin-archive-banner">
          <div><p>Obnovenie je dostupné iba superadminovi</p><h2>Archivované dopyty</h2><span>Dopyty sú iba skryté z aktívnej práce. Auditná história zostáva zachovaná.</span></div>
          <a className="admin-secondary-link" href="/admin/dopyty">Späť na aktívne dopyty</a>
        </section>
      )}

      <section className="admin-card">
        <form className="admin-filter-bar" action="/admin/dopyty" method="get">
          <label>
            Hľadať
            <input name="q" defaultValue={q} placeholder="meno, telefón, obec, materiál..." />
          </label>
          <label>
            Stav
            <select name="status" defaultValue={status}>
              {statusOptions.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Štítok
            <select name="tag" defaultValue={tag}>
              {tagOptions.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Front
            <select name="queue" defaultValue={queue}>
              <option value="">Všetky fronty</option>
              {queueOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            Vlastník
            <select name="owner" defaultValue={ownerEmail}>
              <option value="">Všetci vlastníci</option>
              {adminUsers.map((user) => <option key={user.email} value={user.email}>{user.name || user.email}</option>)}
            </select>
          </label>
          <label>
            Na stránke
            <select name="pageSize" defaultValue={String(pageSize)}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
          {adminUser.role === 'SUPER_ADMIN' ? <label className="admin-checkbox"><input type="checkbox" name="archived" value="1" defaultChecked={archivedOnly} /> Archivované</label> : null}
          <input type="hidden" name="page" value="1" />
          <button type="submit">Filtrovať</button>
          <a href="/admin/dopyty">Reset</a>
        </form>
      </section>

      <section className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table admin-leads-table">
            <thead>
              <tr>
                <th>Dátum</th>
                <th>Meno a telefón</th>
                <th>Lokalita</th>
                <th>Materiál + m2</th>
                <th>Skóre</th>
                <th>Prílohy</th>
                <th>Vlastník / ďalší krok</th>
                <th>Stav</th>
                <th>Akcie</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(({ lead, insight }) => (
                <tr key={lead.id}>
                  <td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lead.createdAt))}</td>
                  <td>
                    <strong>{cleanSlovakText(lead.fullName)}</strong>
                    <br />
                    <a className="admin-tel-link" href={`tel:${lead.phone}`}>{lead.phone}</a>
                    {lead.email ? <small> · {lead.email}</small> : null}
                  </td>
                  <td>{cleanSlovakText(lead.city)}{lead.district ? `, ${cleanSlovakText(lead.district)}` : ''}</td>
                  <td>
                    <strong>{cleanSlovakText(lead.materialType)}</strong>
                    <br />
                    <small>{lead.areaEstimate} m2 · {cleanSlovakText(lead.objectType)}</small>
                  </td>
                  <td><span className="score-pill">{insight.qualityScore}/100</span></td>
                  <td>{lead.fileCount ? <span className="attachment-pill">📎 {lead.fileCount}</span> : <span className="muted">—</span>}</td>
                  <td>
                    <strong>{lead.ownerEmail ? ownerName.get(lead.ownerEmail) || lead.ownerEmail : 'Bez vlastníka'}</strong>
                    {lead.nextAction ? <><br /><small>{cleanSlovakText(lead.nextAction)}</small></> : <><br /><small className="muted">Ďalší krok nie je určený</small></>}
                  </td>
                  <td><span className={`status-pill status-${lead.status}`}>{lead.deletedAt ? 'Archivovaný dopyt' : statusLabels[lead.status] || lead.status}</span></td>
                  <td>
                    <div className="admin-row-actions">
                      {lead.deletedAt ? <><a className="admin-row-link is-muted" href={`/admin/dopyty/${lead.id}`}>Otvoriť</a>{adminUser.role === 'SUPER_ADMIN' ? <form action={restoreLeadAction}><input type="hidden" name="id" value={lead.id} /><button className="admin-row-link is-plum" type="submit">Obnoviť</button></form> : null}</> : <><a className="admin-row-link is-orange" href={`/admin/dopyty/${lead.id}`}>Otvoriť</a><a className="admin-row-link is-plum" href={`/admin/ponuky/nova?lead=${lead.id}`}>Vytvoriť CP</a></>}
                    </div>
                  </td>
                </tr>
              ))}
              {!leads.length ? <tr><td colSpan={9}>Nenašli sa žiadne dopyty pre zvolené filtre.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {leadPage.total > 0 ? (
          <nav className="admin-pagination" aria-label="Stránkovanie dopytov">
            <span>{leadPage.page}. z {leadPage.totalPages} strán · {leadPage.total} dopytov</span>
            <div>
              {leadPage.page > 1 ? <a href={pageHref(params, leadPage.page - 1, pageSize)}>Predchádzajúca</a> : <span className="is-disabled">Predchádzajúca</span>}
              {leadPage.page < leadPage.totalPages ? <a href={pageHref(params, leadPage.page + 1, pageSize)}>Ďalšia</a> : <span className="is-disabled">Ďalšia</span>}
            </div>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
