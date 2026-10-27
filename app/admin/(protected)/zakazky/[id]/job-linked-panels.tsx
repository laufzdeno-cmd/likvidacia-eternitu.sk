import { randomUUID } from 'node:crypto';
import { getBusinessJobFinance, listPriceOffers } from '@/src/server/db';
import { getJobWorkspace, listAuthorityNotices, listJobCommunications, listJobPrivateDocuments, listManualPriceOffers } from '@/src/server/job-workspace-db';
import type { JobWorkspaceActor } from '@/src/server/job-workspace-types';
import { JobAuthorityApproval, JobCommunicationNote, JobPhotoUpload } from './job-interactions';
import styles from '../../ponuky/rucna/manual-offer.module.css';
import { jobPaymentStatus } from '@/src/lib/job-payment-status';

type Props = { jobId: string; actor: JobWorkspaceActor; csrfToken?: string; archived?: boolean };
const euro = (cents: number) => new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export async function JobOffersPanel({ jobId, actor, archived }: Props) {
  const [manual, generated] = await Promise.all([listManualPriceOffers(actor, { jobId }), listPriceOffers({ jobId })]);
  return <div><h2>Ponuky zákazky</h2>{!archived ? <p><a href={`/admin/ponuky/rucna?jobId=${jobId}`}>+ Zaevidovať pôvodnú PDF ponuku</a> · <a href={`/admin/ponuky/nova?zakazka=${jobId}`}>Vytvoriť ponuku v admine</a></p> : null}<div className={styles.grid}>{manual.map(offer => <article className={styles.panel} key={offer.id}><strong>{offer.originalNumber}</strong><p>Pôvodné PDF · {({ DRAFT: 'Na overenie', SENT_VERIFIED: 'Odoslaná', ACCEPTED: 'Prijatá', DEFERRED: 'Odložená', REJECTED: 'Odmietnutá' })[offer.status]}</p><a href={`/admin/ponuky/rucna/${offer.id}`}>Otvoriť ponuku →</a></article>)}{generated.map(offer => <article className={styles.panel} key={offer.id}><strong>{offer.number}</strong><p>Ponuka vytvorená v admine</p><a href={`/admin/ponuky/${offer.id}`}>Otvoriť ponuku →</a></article>)}</div>{!manual.length && !generated.length ? <p>K zákazke zatiaľ nie je pripojená ponuka.</p> : null}</div>;
}

export async function JobCommunicationPanel({ jobId, actor, csrfToken = '', archived }: Props) {
  const [messages, notices] = await Promise.all([listJobCommunications(jobId, actor), listAuthorityNotices(jobId, actor)]);
  return <div><h2>Komunikácia a poznámky</h2>{!archived ? <JobCommunicationNote jobId={jobId} csrfToken={csrfToken} /> : null}<p>{actor.role === 'SUPER_ADMIN' ? <a href="/admin/nastavenia/gmail">Skontrolovať správy z Gmailu →</a> : 'Do karty sa zobrazia iba správy z Gmailu priradené a skontrolované superadminom.'}</p>{messages.map(message => <details className={styles.panel} key={message.id}><summary><strong>{message.subject}</strong> · {new Date(message.occurredAt).toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava' })}</summary><small>{message.source === 'GMAIL' ? 'Gmail · overené priradenie' : 'Ručný záznam'} · {message.direction === 'NOTE' ? 'Interná poznámka' : message.direction === 'INBOUND' ? 'Prijatý email' : 'Odoslaný email'}</small><p>Od: {message.sender} {message.recipient ? ` · Komu: ${message.recipient}` : ''}</p><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.text}</p>{message.documentIds.map((id, i) => <p key={id}><a href={`/api/admin/job-workspace/documents/${id}/`}>Súkromná príloha {i + 1}</a></p>)}<small>Zaevidoval/a {message.createdBy} · {message.createdAt}</small></details>)}{notices.map(notice => <details className={styles.panel} key={notice.id}><summary><strong>{notice.subject}</strong> · {({ PREPARED: 'Pripravený náhľad', SENDING: 'Prebieha / čaká na overenie', SENT: 'Prijaté poštovým serverom', FAILED: 'Neprijaté serverom', UNCERTAIN: 'Nejasný výsledok · preveriť poštu' })[notice.state]}</summary><p>Komu: {notice.recipient}</p><p style={{ whiteSpace: 'pre-wrap' }}>{notice.text}</p><small>{notice.createdBy} · {notice.createdAt}</small></details>)}</div>;
}

export async function JobPhotosPanel({ jobId, actor, csrfToken = '', archived }: Props) {
  const documents = await listJobPrivateDocuments(jobId, actor);
  const photos = documents.filter(document => document.kind === 'PHOTO');
  return <div><h2>Fotky a súkromné doklady</h2>{!archived ? <><JobPhotoUpload jobId={jobId} csrfToken={csrfToken} /><JobPhotoUpload kind="AUTHORITY" jobId={jobId} csrfToken={csrfToken} /></> : null}<div className={styles.grid}>{photos.map(photo => <a href={`/api/admin/job-workspace/documents/${photo.id}/`} target="_blank" rel="noreferrer" key={photo.id} className={styles.panel}><img src={`/api/admin/job-workspace/documents/${photo.id}/?thumbnail=1`} alt={photo.fileName} loading="lazy" width={320} height={210} style={{ width: '100%', height: 210, objectFit: 'contain' }} /><small>{photo.fileName} · kliknutím zväčšiť</small></a>)}</div>{documents.filter(d => d.kind !== 'PHOTO').map(document => <p key={document.id}><a href={`/api/admin/job-workspace/documents/${document.id}/`}>{document.fileName}</a></p>)}<p>Pridanie do zákazky neznamená zverejnenie. Publikovanie realizácie ostáva samostatným schvaľovaním.</p></div>;
}

export async function JobAuthorityNoticePanel({ jobId, actor, csrfToken = '', archived }: Props) {
  if (archived) return <p>Archivovaná karta je iba na čítanie.</p>;
  const card = await getJobWorkspace(jobId, actor);
  return <JobAuthorityApproval jobId={jobId} csrfToken={csrfToken} revision={card.revision} operationId={randomUUID()} />;
}

export async function JobPaymentSummary({ jobId, actor }: Props) {
  if (actor.role !== 'SUPER_ADMIN') return <p>Úhrady a vyúčtovanie spravuje superadmin. Stav vykonania práce je samostatný.</p>;
  const [finance, card] = await Promise.all([getBusinessJobFinance(jobId), getJobWorkspace(jobId, actor)]);
  if (!('settlement' in card)) return null;
  const total = card.settlement.actualAmountWithVatCents ?? card.settlement.agreedAmountWithVatCents;
  const paid = finance.netReceivedCents;
  const { balanceCents: balance, label, review, conflict } = jobPaymentStatus(total, finance);
  return <div className={styles.panel}><strong className={review ? styles.notice : styles.pill}>{label}</strong><div className={styles.grid}><p>Celková cena<br /><strong>{total === null ? 'Zatiaľ neurčená' : euro(total)}</strong></p><p>Prijaté platby po stornách<br /><strong>{euro(paid)}</strong></p><p>{balance !== null && balance < 0 ? 'Preplatok' : 'Zostáva uhradiť'}<br /><strong>{balance === null ? 'Na doplnenie' : euro(Math.abs(balance))}</strong></p></div>{review ? <p className={styles.notice}>{conflict ? 'Suma aktívnych faktúr sa líši od celkovej ceny zákazky. Skontrolujte vyúčtovanie.' : 'Platby alebo ich priradenie si vyžadujú kontrolu. Zákazku zatiaľ neoznačujeme ako vyrovnanú.'}</p> : null}<p>{card.settlement.documentType === 'INVOICE' ? 'Vyúčtovanie faktúrou' : card.settlement.documentType === 'OTHER_DOCUMENT' ? 'Iný doklad / ručná evidencia' : 'Typ dokladu zatiaľ nebol určený'}. Hotovosť či prevod sa eviduje pri skutočnej platbe.</p><a href="#fakturacia">Zaevidovať doklad alebo platbu →</a></div>;
}
