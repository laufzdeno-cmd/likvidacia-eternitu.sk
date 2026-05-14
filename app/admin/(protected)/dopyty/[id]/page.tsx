import { notFound } from 'next/navigation';
import { getLeadWithFiles, nextQuoteNumber } from '@/src/server/db';
import { getLeadInsight, statusLabels, tagLabels } from '@/src/server/lead-insights';
import { saveInternalNote, saveLeadStatus } from './actions';

const statuses = [
  'novy',
  'caka_na_doplnenie',
  'naceneny',
  'cenova_ponuka_odoslana',
  'objednane',
  'nevyslo',
  'archivovane',
] as const;

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadWithFiles(id);
  if (!lead) notFound();
  const defaultQuoteNumber = await nextQuoteNumber();
  const insight = getLeadInsight(lead, lead.files.length, lead.quotes.length);

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Dopyt #{lead.id.slice(0, 8)}</p>
          <h1>{lead.fullName}</h1>
        </div>
        <a className="admin-primary-link" href={`/admin/dopyty/${lead.id}/cenova-ponuka?quote=${defaultQuoteNumber}`}>
          Vytvoriť cenovú ponuku
        </a>
      </div>

      <div className="admin-detail-grid">
        <section className="admin-card">
          <h2>Zákazník a lokalita</h2>
          <dl className="admin-dl">
            <dt>Meno</dt><dd>{lead.fullName}</dd>
            <dt>Telefón</dt><dd><a href={`tel:${lead.phone}`}>{lead.phone}</a></dd>
            <dt>Email</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd>
            <dt>Obec / mesto</dt><dd>{lead.city}</dd>
            <dt>Okres</dt><dd>{lead.district || 'neuvedené'}</dd>
            <dt>Prijaté</dt><dd>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lead.createdAt))}</dd>
          </dl>
        </section>

        <section className="admin-card">
          <h2>Údaje z formulára</h2>
          <dl className="admin-dl">
            <dt>Typ objektu</dt><dd>{lead.objectType}</dd>
            <dt>Materiál</dt><dd>{lead.materialType}</dd>
            <dt>Výmera</dt><dd>{lead.areaEstimate} m²</dd>
            <dt>Strechár</dt><dd>{lead.roofer || 'neuvedené'}</dd>
            <dt>Termín</dt><dd>{lead.term || 'neuvedené'}</dd>
            <dt>Poznámka</dt><dd>{lead.note || 'bez poznámky'}</dd>
          </dl>
        </section>

        <section className="admin-card">
          <h2>Status</h2>
          <div className="lead-insight-card">
            <strong>Lead quality score: {insight.qualityScore}/100</strong>
            <div className="tag-list">
              {insight.tags.map((item) => <span key={item}>{tagLabels[item]}</span>)}
            </div>
          </div>
          <form action={saveLeadStatus} className="admin-form-inline">
            <input type="hidden" name="id" value={lead.id} />
            <select name="status" defaultValue={lead.status}>
              {statuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
            </select>
            <button type="submit">Uložiť status</button>
          </form>
          <h2>Interná poznámka</h2>
          <form action={saveInternalNote} className="admin-note-form">
            <input type="hidden" name="id" value={lead.id} />
            <textarea name="internalNote" rows={7} defaultValue={lead.internalNote} placeholder="Interná poznámka pre kanceláriu..." />
            <button type="submit">Uložiť poznámku</button>
          </form>
        </section>

        <section className="admin-card">
          <h2>Fotky a súbory</h2>
          <div className="admin-file-list">
            {lead.files.map((file) => (
              <a key={file.id} href={`/admin/files/${file.id}`} target="_blank">
                <span>{file.originalName}</span>
                <small>{Math.round(file.sizeBytes / 1024)} kB · {file.mimeType}</small>
              </a>
            ))}
            {!lead.files.length ? <p>Zákazník nepriložil fotky.</p> : null}
          </div>
        </section>

        <section className="admin-card">
          <h2>Cenové ponuky</h2>
          <div className="admin-file-list">
            {lead.quotes.map((quote) => (
              <a key={quote.id} href={`/admin/cenove-ponuky/${quote.id}`}>
                <span>{quote.quoteNumber} · {quote.totalWithVat.toLocaleString('sk-SK')} € s DPH</span>
                <small>{quote.status}</small>
              </a>
            ))}
            {!lead.quotes.length ? <p>Zatiaľ nebola vytvorená cenová ponuka.</p> : null}
          </div>
        </section>

        <section className="admin-card">
          <h2>Časová os</h2>
          <ul className="admin-timeline">
            {lead.auditLogs.map((log) => (
              <li key={log.id}>
                <strong>{log.action}</strong>
                <span>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.createdAt))} · {log.actorEmail}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
