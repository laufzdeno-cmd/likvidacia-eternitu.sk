import { notFound } from 'next/navigation';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import { getJobPrivateDocument, getManualPriceOffer } from '@/src/server/job-workspace-db';
import { getAdminSetting, listAdminUsers } from '@/src/server/db';
import ManualOfferStateForms from './offer-state-forms';
import ManualImportForm from '../import-form';
import styles from '../manual-offer.module.css';

const statusLabels = { DRAFT: 'Na overenie', SENT_VERIFIED: 'Odoslaná · čakáme na odpoveď', ACCEPTED: 'Prijatá', DEFERRED: 'Odložená', REJECTED: 'Odmietnutá' };
const money = (value: number | null) => value === null ? 'Zatiaľ nedoplnené' : new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value / 100);

export default async function ImportedOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminUser();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const offer = await getManualPriceOffer(id, actor);
  if (!offer) notFound();
  const pdf = await getJobPrivateDocument(offer.pdf.documentId, actor);
  const [users, defaultOwner] = await Promise.all([listAdminUsers(), getAdminSetting('job_workspace_default_responsible_email')]);
  return <main className="admin-page"><header className="admin-heading"><div><p>Pôvodná PDF ponuka · revízia {offer.revision}</p><h1>CP {offer.originalNumber}</h1><span>{offer.contactPerson} · {offer.address}</span></div><a href="/admin/ponuky">Všetky ponuky</a></header>
    <div className={styles.workspace}><section className={styles.panel}><span className={styles.pill}>{statusLabels[offer.status]}</span><div className={styles.grid}><div><h2>{offer.contactPerson}</h2><p>{offer.email}<br />{offer.phone}<br />{offer.address}</p></div><div><h3>Suma podľa originálu</h3><p>Bez DPH: <strong>{money(offer.totalWithoutVatCents)}</strong><br />S DPH: <strong>{money(offer.totalWithVatCents)}</strong></p><p>Vystavená: {offer.issuedOn || 'Zatiaľ neurčené'}<br />Odoslaná: {offer.sentOn || 'Zatiaľ neoverené'}</p></div></div>
      {pdf ? <a href={`/api/admin/job-workspace/documents/${pdf.id}/`} target="_blank" rel="noreferrer">Zobraziť pôvodné PDF →</a> : <p>Originál si vyžaduje kontrolu superadmina.</p>}{offer.jobId ? <p><a href={`/admin/zakazky/${offer.jobId}`}>Otvoriť súvisiacu zákazku →</a></p> : null}
      <div className={styles.scroller}><table className={styles.table}><thead><tr><th>Položka</th><th>Množstvo</th><th>Jednotka</th><th>Cena / jedn. bez DPH</th><th>Celkom bez DPH</th></tr></thead><tbody>{offer.items.map(item => <tr key={item.id}><td>{item.description}</td><td>{item.quantity ?? '—'}</td><td>{item.unit || '—'}</td><td>{money(item.unitPriceWithoutVatCents)}</td><td>{money(item.totalWithoutVatCents)}</td></tr>)}</tbody></table></div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{offer.note}</p>{offer.outcomeReason ? <p><strong>Dôvod výsledku:</strong> {offer.outcomeReason}</p> : null}{offer.sentEvidence ? <p>Dôkaz pôvodného odoslania: {offer.sentEvidence}</p> : null}<small>Zaevidoval/a {offer.createdBy} · {offer.createdAt}. Originál PDF sa úpravou evidencie neprepisuje.</small>
    </section>{offer.status === 'DRAFT' && pdf ? <details><summary>Opraviť overené údaje konceptu</summary><ManualImportForm csrfToken={csrfTokenForEmail(actor.email)} jobId={offer.jobId || undefined} offer={offer} initialDocument={{ id: pdf.id, originalName: pdf.fileName, sha256: pdf.sha256, href: `/api/admin/job-workspace/documents/${pdf.id}/` }} /></details> : null}<ManualOfferStateForms offer={offer} csrfToken={csrfTokenForEmail(actor.email)} defaultOwner={defaultOwner || ''} owners={users.filter(user => user.active && ['OPERATOR', 'SUPER_ADMIN'].includes(user.role)).map(user => ({ name: user.name, email: user.email }))} /></div>
  </main>;
}
