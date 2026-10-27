'use client';

import { useActionState, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { addJobCommunicationAction, prepareJobAuthorityNoticeAction, sendJobAuthorityNoticeAction, type JobLinkedActionState } from './job-linked-actions';
import styles from '../../ponuky/rucna/manual-offer.module.css';

const initial: JobLinkedActionState = { ok: false, message: '' };
export function JobPhotoUpload({ jobId, csrfToken, kind = 'PHOTO' }: { jobId: string; csrfToken: string; kind?: 'PHOTO' | 'AUTHORITY' }) {
  const router = useRouter(); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 12); if (!files.length) return;
    setBusy(true); let saved = 0;
    try {
      for (const file of files) {
        const data = new FormData(); data.set('_csrf', csrfToken); data.set('jobId', jobId); data.set('kind', kind); data.set('file', file);
        const response = await fetch('/api/admin/job-workspace/upload/', { method: 'POST', body: data });
        if (!response.ok) throw new Error('upload'); saved++;
      }
      setMessage(`Súkromne uložené súbory: ${saved}. Na webe sa nezverejnili.`); router.refresh();
    } catch { setMessage(`Uložené súbory: ${saved}. Ďalší sa nepodarilo pridať. Použite podporovaný formát do 3 MB.`); router.refresh(); }
    finally { setBusy(false); event.target.value = ''; }
  }
  return <div className={styles.upload}><label>{kind === 'PHOTO' ? 'Pridať súkromné fotky' : 'Pridať PDF podklady / rozhodnutie úradu'}<input type="file" accept={kind === 'PHOTO' ? 'image/jpeg,image/png,image/webp' : 'application/pdf,.pdf'} multiple disabled={busy} onChange={upload} /></label><p>{busy ? 'Ukladám súkromné súbory…' : kind === 'PHOTO' ? 'Fotky upravíme do WebP, odstránime GPS a ponecháme iba v zákazkovej karte. Naraz najviac 12 fotiek.' : 'PDF ostane súkromné a bez úprav. Potom ho môžete vybrať pri príslušnom úrade.'}</p><p role="status">{message}</p></div>;
}

export function JobCommunicationNote({ jobId, csrfToken }: { jobId: string; csrfToken: string }) {
  const [state, action, pending] = useActionState(addJobCommunicationAction, initial);
  const [eventTime, setEventTime] = useState('');
  const parsedTime = new Date(eventTime);
  const occurredAt = Number.isFinite(parsedTime.valueOf()) ? parsedTime.toISOString() : '';
  return <form action={action} className={styles.panel}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="occurredAt" value={occurredAt} /><h3>Telefonát alebo interná poznámka</h3><div className={styles.grid}><label>Predmet<input name="subject" required maxLength={300} /></label><label>Kedy sa udalosť stala<input type="datetime-local" required value={eventTime} onChange={e => setEventTime(e.target.value)} /></label></div><label>Obsah<textarea name="text" rows={3} maxLength={10000} required /></label><button disabled={pending}>{pending ? 'Ukladám…' : 'Pridať do komunikácie'}</button>{state.message ? <p role="status">{state.message}</p> : null}</form>;
}

export function JobAuthorityApproval({ jobId, revision, csrfToken, operationId }: { jobId: string; revision: number; csrfToken: string; operationId: string }) {
  const [preview, prepare, preparing] = useActionState(prepareJobAuthorityNoticeAction, initial);
  const [sent, send, sending] = useActionState(sendJobAuthorityNoticeAction, initial);
  return <div className={styles.panel}><h3>Informovať zákazníka o podaniach</h3><p>Najprv uložte skutočné dátumy podaní. Náhľad uvedie len úrady, ktorým boli podklady odoslané.</p><form action={prepare}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="revision" value={revision} /><input type="hidden" name="operationId" value={operationId} /><button disabled={preparing}>{preparing ? 'Pripravujem…' : 'Pripraviť náhľad oznámenia'}</button></form>{preview.message ? <p role="status">{preview.message}</p> : null}
    {preview.preview ? <form action={send} className={styles.item}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="noticeId" value={preview.preview.id} /><p><strong>Komu:</strong> {preview.preview.recipient}<br /><strong>Predmet:</strong> {preview.preview.subject}</p><p style={{ whiteSpace: 'pre-wrap' }}>{preview.preview.text}</p><label className={styles.check}><input type="checkbox" name="confirmed" required /><span>Adresát aj skutočné podania sú správne. Schvaľujem odoslanie tohto oznámenia zákazníkovi.</span></label><button disabled={sending || sent.ok}>{sending ? 'Odosielam…' : 'Schváliť a odoslať oznámenie'}</button></form> : null}{sent.message ? <p role="status">{sent.message}</p> : null}
  </div>;
}
