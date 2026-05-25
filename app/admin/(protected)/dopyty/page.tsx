import { getLeadInsight, statusLabels, tagLabels, type LeadTag } from '@/src/server/lead-insights';
import { listLeadSummaries } from '@/src/server/db';
import type { LeadStatus } from '@/src/server/types';

const statusOptions: Array<['', string] | [LeadStatus, string]> = [
  ['', 'Všetky statusy'],
  ['novy', 'nový'],
  ['kontaktovany', 'kontaktovaný'],
  ['caka_na_doplnenie', 'čaká na doplnenie'],
  ['naceneny', 'nacenený'],
  ['cenova_ponuka_odoslana', 'cenová ponuka odoslaná'],
  ['objednane', 'objednané'],
  ['v_realizacii', 'v realizácii'],
  ['dokoncena', 'dokončená'],
  ['zrusena', 'zrušená'],
  ['nevyslo', 'nevyšlo'],
  ['archivovane', 'archivované'],
];

const tagOptions: Array<['', string] | [LeadTag, string]> = [
  ['', 'Všetky štítky'],
  ['chyba_fotka', 'chýbajú fotky'],
  ['potrebuje_strechara', 'potrebuje strechára'],
  ['urgentne', 'urgentné'],
  ['nad_100_m2', 'nad 100 m²'],
  ['pripravene_na_nacenenie', 'pripravené na nacenenie'],
];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
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
            Status
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
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dátum</th>
                <th>Zákazník</th>
                <th>Lokalita</th>
                <th>Materiál</th>
                <th>Výmera</th>
                <th>Skóre</th>
                <th>Štítky</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map(({ lead, insight }) => (
                <tr key={lead.id}>
                  <td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lead.createdAt))}</td>
                  <td>
                    <strong>{lead.fullName}</strong>
                    <br />
                    <small>{lead.phone} · {lead.email}</small>
                  </td>
                  <td>{lead.city}{lead.district ? `, ${lead.district}` : ''}</td>
                  <td>{lead.materialType}</td>
                  <td>{lead.areaEstimate} m²</td>
                  <td><span className="score-pill">{insight.qualityScore}/100</span></td>
                  <td>
                    <div className="tag-list">
                      {insight.tags.map((item) => <span key={item}>{tagLabels[item]}</span>)}
                    </div>
                  </td>
                  <td><span className={`status-pill status-${lead.status}`}>{statusLabels[lead.status] || lead.status}</span></td>
                  <td><a className="admin-row-link" href={`/admin/dopyty/${lead.id}`}>Otvoriť</a></td>
                </tr>
              ))}
              {!leads.length ? <tr><td colSpan={9}>Nenašli sa žiadne dopyty pre zvolené filtre.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
