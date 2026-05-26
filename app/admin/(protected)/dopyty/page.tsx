import { getLeadInsight, statusLabels, type LeadTag } from '@/src/server/lead-insights';
import { listLeadSummaries } from '@/src/server/db';
import { cleanSlovakText } from '@/src/server/slovak-text';
import type { LeadStatus } from '@/src/server/types';

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
  ['nad_100_m2', 'Nad 100 m²'],
  ['pripravene_na_nacenenie', 'Pripravené na nacenenie'],
];

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const q = (params.q || '').trim();
  const status = (params.status || '') as LeadStatus | '';
  const tag = (params.tag || '') as LeadTag | '';
  const qNormalized = normalize(q);
  const leads = (await listLeadSummaries())
    .map((lead) => ({ lead, insight: getLeadInsight(lead, lead.fileCount, lead.quoteCount) }))
    .filter(({ lead, insight }) => {
      const haystack = normalize([lead.fullName, lead.phone, lead.email, lead.city, lead.district, lead.materialType, lead.objectType].join(' '));
      return (!q || haystack.includes(qNormalized)) && (!status || lead.status === status) && (!tag || insight.tags.includes(tag));
    });

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Obchodný tok</p>
          <h1>Dopyty</h1>
        </div>
      </div>

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
                <th>Materiál + m²</th>
                <th>Skóre</th>
                <th>Prílohy</th>
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
                    <small>{lead.areaEstimate} m² · {cleanSlovakText(lead.objectType)}</small>
                  </td>
                  <td><span className="score-pill">{insight.qualityScore}/100</span></td>
                  <td>{lead.fileCount ? <span className="attachment-pill">📎 {lead.fileCount}</span> : <span className="muted">—</span>}</td>
                  <td><span className={`status-pill status-${lead.status}`}>{statusLabels[lead.status] || lead.status}</span></td>
                  <td>
                    <div className="admin-row-actions">
                      <a className="admin-row-link is-orange" href={`/admin/dopyty/${lead.id}`}>Otvoriť</a>
                      <a className="admin-row-link is-plum" href={`/admin/ponuky/nova?lead=${lead.id}`}>Vytvoriť CP</a>
                    </div>
                  </td>
                </tr>
              ))}
              {!leads.length ? <tr><td colSpan={8}>Nenašli sa žiadne dopyty pre zvolené filtre.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
