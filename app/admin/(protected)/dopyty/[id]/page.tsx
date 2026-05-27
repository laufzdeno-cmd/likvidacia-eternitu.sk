import { notFound } from 'next/navigation';
import { getLeadWithFiles, getRoofer, listMatchingRoofers, nextQuoteNumber } from '@/src/server/db';
import { getLeadInsight, statusLabels, tagLabels } from '@/src/server/lead-insights';
import { cleanSlovakText, leadEventLabel } from '@/src/server/slovak-text';
import { cancelLeadFollowup, deleteLeadFileAction, saveInternalNote, saveLeadWorkflow } from './actions';

const statuses = [
  'novy',
  'kontaktovany',
  'cenova_ponuka_odoslana',
  'objednane',
  'nevyslo',
  'caka_na_doplnenie',
  'v_realizacii',
  'dokoncena',
  'zrusena',
  'archivovane',
] as const;

function fileSize(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} kB`;
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadWithFiles(id);
  if (!lead) notFound();
  const [defaultQuoteNumber, matchingRoofers, selectedRoofer] = await Promise.all([
    nextQuoteNumber(),
    listMatchingRoofers(lead),
    lead.selectedRooferId ? getRoofer(lead.selectedRooferId) : Promise.resolve(null),
  ]);
  const insight = getLeadInsight(lead, lead.files.length, lead.quotes.length);
  const wantsRoofer = lead.wantsRooferRecommendation || cleanSlovakText(lead.roofer).toLowerCase().includes('strechár');

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Dopyt #{lead.id.slice(0, 8)}</p>
          <h1>{cleanSlovakText(lead.fullName)}</h1>
        </div>
        <a className="admin-primary-link" href={`/admin/ponuky/nova?lead=${lead.id}&quote=${defaultQuoteNumber}`}>
          + Vytvoriť cenovú ponuku
        </a>
      </div>

      <div className="admin-lead-layout">
        <div className="admin-lead-main">
          <section className="admin-card">
            <h2>Zákazník</h2>
            <dl className="admin-dl">
              <dt>Meno</dt><dd>{cleanSlovakText(lead.fullName)}</dd>
              <dt>Telefón</dt><dd><a className="admin-tel-link" href={`tel:${lead.phone}`}>{lead.phone}</a></dd>
              <dt>Email</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd>
              <dt>Lokalita</dt><dd>{cleanSlovakText(lead.city)}</dd>
              <dt>Okres</dt><dd>{cleanSlovakText(lead.district) || 'Neuvedené'}</dd>
              <dt>Dátum prijatia</dt><dd>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lead.createdAt))}</dd>
            </dl>
          </section>

          <section className="admin-card">
            <h2>Dopyt</h2>
            <dl className="admin-dl">
              <dt>Materiál</dt><dd>{cleanSlovakText(lead.materialType)}</dd>
              <dt>Výmera</dt><dd>{lead.areaEstimate} m2</dd>
              <dt>Typ objektu</dt><dd>{cleanSlovakText(lead.objectType)}</dd>
              <dt>Termín</dt><dd>{cleanSlovakText(lead.term) || 'Neuvedené'}</dd>
              <dt>Preferovaný kontakt</dt><dd>{cleanSlovakText(lead.preferredContact)}</dd>
              <dt>Poznámka zákazníka</dt><dd>{cleanSlovakText(lead.note) || 'Bez poznámky'}</dd>
            </dl>
          </section>

          <section className="admin-card">
            <h2>Strechár</h2>
            <p>Zákazník chce strechára? <strong>{wantsRoofer ? 'Áno' : 'Nie'}</strong></p>
            {wantsRoofer ? (
              <>
                {selectedRoofer ? <p>Priradený strechár: <strong>{selectedRoofer.name}</strong> · <a href={`tel:${selectedRoofer.phone}`}>{selectedRoofer.phone}</a></p> : null}
                <details className="admin-details-modal">
                  <summary>Hľadať strechára podľa lokality</summary>
                  <div className="admin-file-list">
                    {matchingRoofers.map((roofer) => (
                      <a key={roofer.id} href="/admin/strechari">
                        <span>{roofer.name} · {roofer.phone || 'bez telefónu'}</span>
                        <small>{roofer.region} · {roofer.districts.join(', ') || 'okresy neuvedené'}</small>
                      </a>
                    ))}
                    {!matchingRoofers.length ? <p>V tejto lokalite zatiaľ nie je aktívny partner. Preverte ručne.</p> : null}
                  </div>
                </details>
              </>
            ) : null}
          </section>

          <section className="admin-card">
            <h2>Prílohy</h2>
            <div className="admin-attachment-grid">
              {lead.files.map((file) => (
                <article key={file.id} className="admin-attachment-card">
                  {file.mimeType.startsWith('image/') ? <img src={`/admin/files/${file.id}`} alt={file.originalName} /> : <div className="admin-file-icon">📎</div>}
                  <div>
                    <strong>{file.originalName}</strong>
                    <small>{fileSize(file.sizeBytes)} · {file.mimeType}</small>
                    <div className="admin-row-actions">
                      <a className="admin-row-link is-plum" href={`/admin/files/${file.id}`} target="_blank">Zobraziť</a>
                      <form action={deleteLeadFileAction} data-confirm-delete-file={file.originalName}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="fileId" value={file.id} />
                        <button className="admin-danger-outline" type="submit">Zmazať</button>
                      </form>
                    </div>
                  </div>
                </article>
              ))}
              {!lead.files.length ? <p>Zákazník nepriložil fotky.</p> : null}
            </div>
          </section>

          <section className="admin-card">
            <h2>Časová os</h2>
            <div className="admin-timeline">
              {lead.auditLogs.map((log) => (
                <article key={log.id}>
                  <span>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.createdAt))} · {log.actorEmail || 'systém'}</span>
                  <strong>{leadEventLabel(log.action, log.changes)}</strong>
                  {log.changes?.note ? <p>{cleanSlovakText(String(log.changes.note))}</p> : null}
                </article>
              ))}
              {!lead.auditLogs.length ? <p>Zatiaľ bez aktivity.</p> : null}
            </div>
          </section>
        </div>

        <aside className="admin-lead-side">
          <section className="admin-card">
            <h2>Stav a akcie</h2>
            <div className="lead-insight-card">
              <strong>Skóre dopytu: {insight.qualityScore}/100</strong>
              <div className="tag-list">
                {insight.tags.map((item) => <span key={item}>{tagLabels[item]}</span>)}
              </div>
            </div>
            <form action={saveLeadWorkflow} className="admin-note-form">
              <input type="hidden" name="id" value={lead.id} />
              <label>Stav
                <select name="status" defaultValue={lead.status}>
                  {statuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
                </select>
              </label>
              <label>Dátum kedy zavolať
                <input type="date" name="followupDate" defaultValue={lead.followupDate || ''} />
              </label>
              <label>Poznámka k follow-upu
                <textarea name="followupNote" rows={3} defaultValue={lead.followupNote || ''} placeholder="Napr. zavolať o 3 mesiace po streche..." />
              </label>
              <label>Dôvod odmietnutia
                <textarea name="rejectionReason" rows={3} placeholder="Cena vysoká, vybral konkurenciu..." />
              </label>
              <button className="admin-primary-button" type="submit">Uložiť stav</button>
            </form>
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
            <a className="admin-primary-link is-plum-full" href={`/admin/ponuky/nova?lead=${lead.id}`}>+ Vytvoriť cenovú ponuku</a>
          </section>

          <section className="admin-card">
            <h2>Interná poznámka</h2>
            <form action={saveInternalNote} className="admin-note-form">
              <input type="hidden" name="id" value={lead.id} />
              <textarea name="internalNote" rows={7} defaultValue={lead.internalNote} placeholder="Interná poznámka pre kanceláriu..." />
              <button className="admin-secondary-link" type="submit">Uložiť poznámku</button>
            </form>
          </section>

          <section className="admin-card">
            <h2>Follow-up</h2>
            {lead.followupDate ? (
              <>
                <p>📅 Zavolať: <strong>{lead.followupDate}</strong></p>
                {lead.followupNote ? <p>{lead.followupNote}</p> : null}
                <form action={cancelLeadFollowup}>
                  <input type="hidden" name="id" value={lead.id} />
                  <button className="admin-danger-outline" type="submit">Zrušiť follow-up</button>
                </form>
              </>
            ) : <p>Follow-up nie je nastavený.</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
