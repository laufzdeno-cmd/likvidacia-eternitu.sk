import { notFound } from 'next/navigation';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import { canManuallyRetryLeadEmail } from '@/src/server/mail';
import { findDuplicateLeads, getLatestPriceOffersByInquiryIds, getLeadWithFiles, getRoofer, listAdminUsers, listLeadEmailOutbox, listMatchingRoofers, nextQuoteNumber } from '@/src/server/db';
import { getLeadInsight, statusLabels, tagLabels } from '@/src/server/lead-insights';
import { cleanSlovakText, leadEventLabel } from '@/src/server/slovak-text';
import { formatLeadArea } from '@/src/server/lead-area';
import { archiveLeadAction, cancelLeadFollowup, deleteLeadFileAction, destroyArchivedLeadAction, resendLeadEmailRecipientAfterReview, resolveLeadEmailDeliveryAfterReview, saveInternalNote, saveLeadWorkflow, setLeadTestDataAction } from './actions';

const statuses = [
  'novy',
  'kontaktovany',
  'naceneny',
  'cenova_ponuka_odoslana',
  'objednane',
  'nevyslo',
  'caka_na_doplnenie',
  'v_realizacii',
  'dokoncena',
  'zrusena',
] as const;

const pipelineStages = [
  { value: 'novy', label: 'Nový' },
  { value: 'kontaktovat', label: 'Kontaktovať' },
  { value: 'kontaktovany', label: 'Kontaktovaný' },
  { value: 'cenova_ponuka_odoslana', label: 'Ponuka' },
  { value: 'v_realizacii', label: 'Realizácia' },
  { value: 'dokoncena', label: 'Uzavretý' },
] as const;

function pipelineIndex(status: string, nextAction?: string) {
  if (status === 'novy' && nextAction) return 1;
  if (status === 'novy') return 0;
  if (status === 'caka_na_doplnenie') return 1;
  if (status === 'kontaktovany') return 2;
  if (status === 'naceneny' || status === 'cenova_ponuka_odoslana' || status === 'objednane') return 3;
  if (status === 'v_realizacii') return 4;
  if (status === 'dokoncena') return 5;
  return -1;
}

function fileSize(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} kB`;
}

function workflowAuditText(changes: Record<string, unknown>) {
  const previous = changes.previousWorkflow as { status?: string; ownerEmail?: string; nextAction?: string; followupDate?: string } | undefined;
  const next = changes.nextWorkflow as { status?: string; ownerEmail?: string; nextAction?: string; followupDate?: string } | undefined;
  if (!previous || !next) return '';
  const owner = next.ownerEmail || 'bez vlastníka';
  const action = next.nextAction || 'ďalší krok neurčený';
  const followup = next.followupDate ? ` · termín ${next.followupDate}` : '';
  return `Vlastník: ${owner} · Ďalší krok: ${action}${followup}`;
}

function leadAttribution(rawData: Record<string, unknown> | undefined) {
  const value = rawData?.attribution;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const attribution = value as Record<string, unknown>;
  const text = (key: string) => typeof attribution[key] === 'string' ? cleanSlovakText(attribution[key] as string) : '';
  const utmSource = text('utmSource');
  const utmMedium = text('utmMedium');
  const utmCampaign = text('utmCampaign');
  const utmContent = text('utmContent');
  const utmTerm = text('utmTerm');
  const utmId = text('utmId');
  const landingPath = text('landingPath');
  const clickSources = [attribution.gclid || attribution.gbraid || attribution.wbraid ? 'Google Ads' : '', attribution.fbclid ? 'Meta' : ''].filter(Boolean);
  if (!utmSource && !utmMedium && !utmCampaign && !utmContent && !utmTerm && !utmId && !landingPath && !clickSources.length) return null;
  return { utmSource, utmMedium, utmCampaign, utmContent, utmTerm, utmId, landingPath, clickSources };
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminUser = await requireAdminUser();
  const lead = await getLeadWithFiles(id, true);
  if (!lead) notFound();
  const [defaultQuoteNumber, matchingRoofers, selectedRoofer, adminUsers, duplicateLeads, priceOfferMap] = await Promise.all([
    nextQuoteNumber(),
    listMatchingRoofers(lead),
    lead.selectedRooferId ? getRoofer(lead.selectedRooferId) : Promise.resolve(null),
    listAdminUsers(),
    findDuplicateLeads(id),
    getLatestPriceOffersByInquiryIds([lead.id]),
  ]);
  const latestPriceOffer = priceOfferMap.get(lead.id);
  const emailOutbox = await listLeadEmailOutbox(id);
  const insight = getLeadInsight(lead, lead.files.length, lead.quotes.length);
  const attribution = leadAttribution(lead.rawData);
  const hasProtectedQuotes = lead.quotes.some((quote) => !['draft', 'cancelled'].includes(quote.status));
  const wantsRoofer = lead.wantsRooferRecommendation || cleanSlovakText(lead.roofer).toLowerCase().includes('strechár');

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Dopyt #{lead.id.slice(0, 8)}</p>
          <h1>{cleanSlovakText(lead.fullName)}{lead.isTestData ? ' · TEST' : ''}</h1>
        </div>
        {!lead.deletedAt ? <a className="admin-primary-link" href={`/admin/ponuky/nova?lead=${lead.id}&quote=${defaultQuoteNumber}`}>
          + Vytvoriť cenovú ponuku
        </a> : null}
      </div>

      <div className="admin-lead-layout">
        <div className="admin-lead-main">
          {duplicateLeads.length ? (
            <section className="admin-card admin-duplicate-warning">
              <div className="admin-section-heading">
                <div><p>Overte pred ďalším kontaktom</p><h2>Možné duplicitné dopyty</h2></div>
                <span className="admin-warning-badge">Iba návrh</span>
              </div>
              <p>Našli sa podobné údaje. Nič sa automaticky nespája ani nemaže.</p>
              <div className="admin-duplicate-list">
                {duplicateLeads.map((duplicate) => (
                  <a href={`/admin/dopyty/${duplicate.leadId}`} key={duplicate.leadId}>
                    <strong>{cleanSlovakText(duplicate.fullName)}</strong>
                    <span>{duplicate.reasons.join(', ')} · {cleanSlovakText(duplicate.city) || 'bez lokality'}</span>
                    <small>{duplicate.email} · {duplicate.phone}</small>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
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
              <dt>Výmera</dt><dd>{formatLeadArea(lead)}</dd>
              <dt>Typ objektu</dt><dd>{cleanSlovakText(lead.objectType)}</dd>
              <dt>Termín</dt><dd>{cleanSlovakText(lead.term) || 'Neuvedené'}</dd>
              <dt>Preferovaný kontakt</dt><dd>{cleanSlovakText(lead.preferredContact)}</dd>
              <dt>Poznámka zákazníka</dt><dd>{cleanSlovakText(lead.note) || 'Bez poznámky'}</dd>
            </dl>
          </section>

          {attribution ? <section className="admin-card" aria-labelledby="lead-attribution-title">
            <h2 id="lead-attribution-title">Zdroj dopytu</h2>
            <p>Údaje sa uložili iba v rozsahu povolenom súhlasom pri odoslaní formulára.</p>
            <dl className="admin-dl">
              {attribution.utmSource ? <><dt>Zdroj kampane</dt><dd>{attribution.utmSource}</dd></> : null}
              {attribution.utmMedium ? <><dt>Typ kampane</dt><dd>{attribution.utmMedium}</dd></> : null}
              {attribution.utmCampaign ? <><dt>Názov kampane</dt><dd>{attribution.utmCampaign}</dd></> : null}
              {attribution.utmContent ? <><dt>Reklama / kreatíva</dt><dd>{attribution.utmContent}</dd></> : null}
              {attribution.utmTerm ? <><dt>Hľadaný výraz</dt><dd>{attribution.utmTerm}</dd></> : null}
              {attribution.utmId ? <><dt>ID kampane</dt><dd>{attribution.utmId}</dd></> : null}
              {attribution.landingPath ? <><dt>Prvá zaznamenaná stránka</dt><dd>{attribution.landingPath}</dd></> : null}
              {attribution.clickSources.length ? <><dt>Reklamný klik</dt><dd>{attribution.clickSources.join(', ')} · identifikátor skrytý</dd></> : null}
            </dl>
          </section> : null}

          {emailOutbox.length ? <section className="admin-card" aria-labelledby="lead-email-status-title">
            <h2 id="lead-email-status-title">Doručenie emailov</h2>
            <p>Stav dopytu a stav emailov sú samostatné. Pri neistom výsledku email neposielame automaticky znova.</p>
            {!lead.deletedAt && emailOutbox.some((delivery) => delivery.status === 'unknown' || delivery.status === 'failed')
              ? <p className="admin-alert" role="alert">Dopyt je uložený v CRM, aj keď doručenie emailu nie je potvrdené. Spracujte ho priamo tu, nečakajte na interné upozornenie. Overte schránku a záznam poskytovateľa; ak zákazníkovi potvrdenie nedošlo, ozvite sa mu podľa preferovaného kontaktu. Odoslanie neopakujte naslepo, aby zákazník nedostal duplicitný email.</p>
              : null}
            <dl className="admin-dl">
              {emailOutbox.map((delivery) => <div key={delivery.recipientRole}>
                <dt>{delivery.recipientRole === 'customer' ? 'Potvrdenie zákazníkovi' : 'Interné upozornenie'}</dt>
                <dd>
                  {({ pending: 'Čaká na odoslanie', sending: 'Odosiela sa', sent: 'Odoslanie potvrdené', failed: 'Odoslanie zlyhalo', unknown: 'Doručenie treba overiť' } as const)[delivery.status]}
                  {delivery.attempts ? ` · pokusov: ${delivery.attempts}` : ''}
                  {delivery.messageId ? <small className="admin-muted">{delivery.messageId.startsWith('hmac-sha256:') || delivery.messageId.startsWith('sha256:') ? 'Odtlačok ID správy' : 'ID správy'}: {cleanSlovakText(delivery.messageId).slice(0, 180)}</small> : null}
                  {delivery.lastError ? <small className="admin-muted">{cleanSlovakText(delivery.lastError).slice(0, 240)}</small> : null}
                  {!lead.deletedAt && (delivery.status === 'unknown' || (delivery.status === 'failed' && !delivery.retryable && !delivery.manualRetryReady)) ? <form action={resolveLeadEmailDeliveryAfterReview} className="admin-form-stack">
                    <input type="hidden" name="_csrf" value={csrfTokenForEmail(adminUser.email)} />
                    <input type="hidden" name="id" value={lead.id} />
                    <input type="hidden" name="recipientRole" value={delivery.recipientRole} />
                    <label>Výsledok kontroly
                      <select name="outcome" required defaultValue="">
                        <option value="" disabled>Vyberte potvrdený výsledok</option>
                        {delivery.status === 'unknown' ? <option value="sent">Doručenie je potvrdené — už neposielať</option> : null}
                        <option value="failed">{canManuallyRetryLeadEmail() ? 'Nedoručenie je potvrdené — povoliť samostatný retry' : 'Nedoručenie je potvrdené — zaznamenať stav'}</option>
                      </select>
                    </label>
                    <label>Čo kontrola potvrdila? (bez obsahu emailu a osobných údajov)
                      <select name="evidence" required defaultValue="">
                        <option value="" disabled>Vyberte dôkaz</option>
                        {delivery.status === 'unknown' ? <option value="inbox_message_found">Správa sa našla v schránke</option> : null}
                        <option value="provider_rejected">Poskytovateľ potvrdil odmietnutie</option>
                      </select>
                    </label>
                    <label className="admin-checkbox"><input name="checkedDelivery" type="checkbox" value="yes" required /> Skontroloval som schránku aj záznam poskytovateľa; tento krok email neodosiela.</label>
                    <button className="admin-primary-button" type="submit">Uložiť výsledok kontroly</button>
                  </form> : null}
                  {!lead.deletedAt && delivery.manualRetryReady && canManuallyRetryLeadEmail() ? <form action={resendLeadEmailRecipientAfterReview} className="admin-form-stack">
                    <input type="hidden" name="_csrf" value={csrfTokenForEmail(adminUser.email)} />
                    <input type="hidden" name="id" value={lead.id} />
                    <input type="hidden" name="recipientRole" value={delivery.recipientRole} />
                    <label className="admin-checkbox"><input name="checkedDelivery" type="checkbox" value="yes" required /> Skontroloval som schránku a log; tento konkrétny email nebol doručený.</label>
                    <label>Čo kontrola potvrdila? (bez obsahu emailu a osobných údajov)
                      <select name="evidence" required defaultValue="">
                        <option value="" disabled>Vyberte dôkaz nedoručenia</option>
                        <option value="provider_rejected">Poskytovateľ potvrdil odmietnutie</option>
                      </select>
                    </label>
                    <button className="admin-primary-button" type="submit">Po kontrole zopakovať iba tento email</button>
                  </form> : null}
                </dd>
              </div>)}
            </dl>
            {emailOutbox.some((delivery) => delivery.status === 'unknown' || delivery.status === 'failed' || delivery.status === 'sending')
              ? <p className="admin-warning-badge">Pred opakovaným odoslaním skontrolujte doručenú poštu aj log poskytovateľa. Zamedzíte duplicitnému emailu.</p>
              : null}
          </section> : null}

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
                      {!lead.deletedAt ? <form action={deleteLeadFileAction} data-confirm-delete-file={file.originalName}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="fileId" value={file.id} />
                        <button className="admin-danger-outline" type="submit">Zmazať</button>
                      </form> : null}
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
                  {workflowAuditText(log.changes) ? <p>{cleanSlovakText(workflowAuditText(log.changes))}</p> : null}
                  {log.changes?.note ? <p>{cleanSlovakText(String(log.changes.note))}</p> : null}
                </article>
              ))}
              {!lead.auditLogs.length ? <p>Zatiaľ bez aktivity.</p> : null}
            </div>
          </section>
        </div>

        <aside className="admin-lead-side">
          {adminUser.role === 'SUPER_ADMIN' ? <section className="admin-card" aria-labelledby="lead-test-classification-title">
            <h2 id="lead-test-classification-title">Obchodné reporty</h2>
            <p>{lead.isTestData ? 'Tento dopyt je označený ako testovací a nezapočítava sa do obchodných dashboardov. V CRM zostáva zachovaný.' : 'Dopyt sa započítava do obchodných dashboardov. Označenie testu nič nemaže a nemení jeho stav v CRM.'}</p>
            <form action={setLeadTestDataAction} className="admin-note-form">
              <input type="hidden" name="_csrf" value={csrfTokenForEmail(adminUser.email)} />
              <input type="hidden" name="id" value={lead.id} />
              <input type="hidden" name="isTestData" value={lead.isTestData ? 'false' : 'true'} />
              <label>Dôvod zmeny (povinný)
                <select name="reason" required defaultValue="">
                  <option value="" disabled>Vyberte dôvod</option>
                  <option>Lokálny test formulára</option>
                  <option>Test doručovania emailov</option>
                  <option>Testovacie CRM údaje</option>
                  <option>Iný dôvod bez osobných údajov</option>
                </select>
              </label>
              <button className="admin-secondary-link" type="submit">{lead.isTestData ? 'Vrátiť do obchodných reportov' : 'Označiť ako testovací dopyt'}</button>
            </form>
          </section> : null}
          <section className="admin-card">
            <h2>Stav a akcie</h2>
            <div className="lead-insight-card">
              <strong>Skóre dopytu: {insight.qualityScore}/100</strong>
              <div className="tag-list">
                {insight.tags.map((item) => <span key={item}>{tagLabels[item]}</span>)}
              </div>
            </div>
            <div className="lead-pipeline" aria-label="Obchodný pipeline">
              {pipelineStages.map((stage, index) => (
                <span className={index <= pipelineIndex(lead.status, lead.nextAction) ? 'is-complete' : ''} key={`${stage.label}-${index}`}>
                  <b>{index + 1}</b>{stage.label}
                </span>
              ))}
            </div>
            {!lead.deletedAt ? <form action={saveLeadWorkflow} className="admin-note-form">
              <input type="hidden" name="id" value={lead.id} />
              <label>Stav
                <select name="status" defaultValue={lead.status}>
                  {statuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
                </select>
              </label>
              <label>Vlastník dopytu
                <select name="ownerEmail" defaultValue={lead.ownerEmail || ''}>
                  <option value="">Bez vlastníka</option>
                  {adminUsers.filter((user) => user.active).map((user) => <option key={user.id} value={user.email}>{user.name || user.email} · {user.role === 'SUPER_ADMIN' ? 'superadmin' : 'operátor'}</option>)}
                </select>
              </label>
              <label>Ďalší krok
                <input name="nextAction" defaultValue={lead.nextAction || ''} maxLength={500} placeholder="Napr. zavolať a overiť rozsah práce" />
              </label>
              <label>Termín kontaktovania
                <input type="date" name="followupDate" defaultValue={lead.followupDate || ''} />
              </label>
              <label>Poznámka k follow-upu
                <textarea name="followupNote" rows={3} defaultValue={lead.followupNote || ''} placeholder="Napr. zavolať o 3 mesiace po streche..." />
              </label>
              <label>Dôvod odmietnutia
                <textarea name="rejectionReason" rows={3} placeholder="Cena vysoká, vybral konkurenciu..." />
              </label>
              <button className="admin-primary-button" type="submit">Uložiť stav</button>
            </form> : <p className="admin-muted">Archivovaný dopyt je v režime iba na čítanie. Pre zmenu ho najprv obnovte.</p>}
            {!lead.deletedAt ? (
              <div className="admin-danger-zone">
                <h3>Správa dopytu</h3>
                <p>Dopyt sa skryje z aktívneho zoznamu, ale zostane zachovaný v auditnej histórii a bude ho možné obnoviť.</p>
                <form action={archiveLeadAction} data-confirm-submit="Dopyt sa archivuje z aktívneho zoznamu. História zostane zachovaná. Pokračovať?">
                  <input type="hidden" name="id" value={lead.id} />
                  <label>Dôvod archivácie
                    <input name="reason" required minLength={3} maxLength={500} placeholder="Napr. duplicitný alebo neaktuálny dopyt" />
                  </label>
                  <button className="admin-danger-outline" type="submit">Archivovať dopyt</button>
                </form>
              </div>
            ) : null}
            {adminUser.role === 'SUPER_ADMIN' && lead.deletedAt ? (
              <div className="admin-danger-zone">
                <h3>Trvalé odstránenie</h3>
                {hasProtectedQuotes ? <p>Trvalé odstránenie je zablokované, pretože dopyt má aktívnu alebo historickú cenovú ponuku. Najprv ju zrušte alebo archivujte.</p> : <>
                  <p>Odstráni údaje dopytu, prílohy a koncept cenovej ponuky. Auditná stopa zostane zachovaná. Táto akcia sa nedá vrátiť.</p>
                  <form action={destroyArchivedLeadAction} data-confirm-submit="Dopyt, jeho prílohy a koncept cenovej ponuky sa trvalo odstránia. Zostane iba minimálny záznam o odstránení. Pokračovať?">
                    <input type="hidden" name="id" value={lead.id} />
                    <label>Dôvod odstránenia
                      <input name="reason" required minLength={3} maxLength={500} placeholder="Napr. duplicitný testovací dopyt" />
                    </label>
                    <label>Potvrdenie
                      <input name="confirmation" required pattern="TRVALO ODSTRÁNIŤ" placeholder="Napíšte TRVALO ODSTRÁNIŤ" />
                    </label>
                    <button className="admin-danger-outline" type="submit">Odstrániť natrvalo</button>
                  </form>
                </>}
              </div>
            ) : null}
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
              {latestPriceOffer ? <a key={latestPriceOffer.id} href={`/admin/ponuky/${latestPriceOffer.id}`}>
                <span>{`CP ${latestPriceOffer.number} · ${latestPriceOffer.totalWithVat.toLocaleString('sk-SK')} € s DPH`}</span>
                <small>{latestPriceOffer.status === 'PRIPRAVENA' ? 'Pripravená · neodoslaná' : latestPriceOffer.status === 'ODOSIELA' ? 'Odosielanie' : latestPriceOffer.status === 'NEISTY_STAV' ? 'Overiť odoslanie' : latestPriceOffer.status === 'ODOSLANA' ? 'Odoslaná' : latestPriceOffer.status === 'PRIJATA' ? 'Prijatá' : latestPriceOffer.status === 'ZRUSENA' ? 'Zrušená' : latestPriceOffer.status}</small>
              </a> : null}
              {!lead.quotes.length && !latestPriceOffer ? <p>Zatiaľ nebola vytvorená cenová ponuka.</p> : null}
            </div>
            {!lead.deletedAt ? <a className="admin-primary-link is-plum-full" href={`/admin/ponuky/nova?lead=${lead.id}`}>+ Vytvoriť cenovú ponuku</a> : null}
          </section>

          <section className="admin-card">
            <h2>Interná poznámka</h2>
            {!lead.deletedAt ? <form action={saveInternalNote} className="admin-note-form">
              <input type="hidden" name="id" value={lead.id} />
              <textarea name="internalNote" rows={7} defaultValue={lead.internalNote} placeholder="Interná poznámka pre kanceláriu..." />
              <button className="admin-secondary-link" type="submit">Uložiť poznámku</button>
            </form> : <p className="admin-muted">Archivovaný dopyt je v režime iba na čítanie.</p>}
          </section>

          <section className="admin-card">
            <h2>Follow-up</h2>
            {lead.followupDate ? (
              <>
                <p>📅 Zavolať: <strong>{lead.followupDate}</strong>{lead.followupDate < new Date().toISOString().slice(0, 10) ? <span className="admin-warning-badge">Po termíne</span> : null}</p>
                {lead.followupNote ? <p>{lead.followupNote}</p> : null}
                {!lead.deletedAt ? <form action={cancelLeadFollowup}>
                  <input type="hidden" name="id" value={lead.id} />
                  <button className="admin-danger-outline" type="submit">Zrušiť follow-up</button>
                </form> : null}
              </>
            ) : <p>Termín kontaktovania nie je nastavený.</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
