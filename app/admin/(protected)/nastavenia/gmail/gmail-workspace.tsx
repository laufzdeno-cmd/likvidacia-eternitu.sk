'use client';

import { useActionState } from 'react';
import type { JobMailConfiguration, JobMailStagedMessage } from '@/src/server/job-mail-types';
import { manageJobGmailAction, type GmailWorkspaceState } from './actions';
import styles from '../../ponuky/rucna/manual-offer.module.css';

const initial: GmailWorkspaceState = { ok: false, message: '' };
type JobOption = { id: string; name: string; location: string };
function Feedback({ state }: { state: GmailWorkspaceState }) { return state.message ? <p role="status" className={state.ok ? styles.success : styles.notice}>{state.message}{state.documentId ? <> <a href={`/admin/ponuky/rucna?documentId=${state.documentId}`}>Otvoriť import ponuky →</a></> : null}</p> : null; }

export function GmailConfiguration({ config, csrfToken, ready }: { config: JobMailConfiguration; csrfToken: string; ready: boolean }) {
  const [state, action, pending] = useActionState(manageJobGmailAction, initial);
  const [labels, labelsAction, labelsPending] = useActionState(manageJobGmailAction, initial);
  return <section className={styles.panel}><p className={styles.eyebrow}>{config.enabled ? 'Čítanie povolené' : 'Čítanie je vypnuté'}</p><h2>Rozsah firemnej komunikácie</h2><p>Správy a prílohy zostávajú v schválených prevádzkových službách. Neposielajú sa externému AI. Gmail heslo sem nevkladajte.</p><p>Google oprávnenie môže umožňovať prístup k celej schránke. Vybrané štítky obmedzujú našu synchronizáciu, samotné oprávnenie Googlu tým nezúžime.</p>
    <form action={labelsAction}><input type="hidden" name="_csrf" value={csrfToken} /><button name="task" value="labels" disabled={!ready || labelsPending}>{labelsPending ? 'Načítavam…' : 'Načítať firemné štítky z Gmailu'}</button></form><Feedback state={labels} />{labels.labels?.length ? <ul>{labels.labels.map(label => <li key={label.id}><strong>{label.name}</strong> · ID: <code>{label.id}</code></li>)}</ul> : null}
    <form action={action}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="revision" value={config.revision} /><div className={styles.grid}><label>ID povolených štítkov, oddelené čiarkou<input name="labels" defaultValue={config.labelIds.join(', ')} maxLength={2000} /></label><label>Správy od dátumu<input type="date" name="since" required defaultValue={config.since} /></label><label>Veľkosť jednej dávky<select name="limit" defaultValue={config.maxMessages}><option value="10">10 správ</option><option value="20">20 správ</option><option value="25">25 správ</option></select></label></div><label className={styles.check}><input type="checkbox" name="verificationAcknowledged" defaultChecked={config.verificationAcknowledged} /><span>Overil/a som súhlas a režim Google pre povolenú firemnú schránku.</span></label><label className={styles.check}><input type="checkbox" name="enabled" defaultChecked={config.enabled} disabled={!ready} /><span>Povoliť čítanie iba uvedenej firemnej komunikácie.</span></label><button name="task" value="configure" disabled={pending}>Uložiť rozsah</button></form><Feedback state={state} />
    <GmailSingleAction csrfToken={csrfToken} task="disable" label="Vypnúť čítanie Gmailu" />
    <details><summary>Odpojiť Gmail úplne</summary><p>Odpojenie zastaví aj zelené označovanie ponúk. Už schválené záznamy v zákazkách zostanú zachované.</p><GmailSingleAction csrfToken={csrfToken} task="disconnect" label="Odpojiť účet" confirmation /></details>
  </section>;
}

export function GmailSingleAction({ csrfToken, task, label, disabled, confirmation = false }: { csrfToken: string; task: string; label: string; disabled?: boolean; confirmation?: boolean }) {
  const [state, action, pending] = useActionState(manageJobGmailAction, initial);
  return <form action={action} className={styles.panel}><input type="hidden" name="_csrf" value={csrfToken} />{confirmation ? <label className={styles.check}><input type="checkbox" name="confirmed" required /><span>Potvrdzujem odpojenie firemnej schránky.</span></label> : null}<button name="task" value={task} disabled={disabled || pending}>{pending ? 'Pracujem…' : label}</button><Feedback state={state} /></form>;
}

export function GmailMessageReview({ message, csrfToken, jobs }: { message: JobMailStagedMessage; csrfToken: string; jobs: JobOption[] }) {
  const [state, action, pending] = useActionState(manageJobGmailAction, initial);
  return <details className={styles.panel}><summary><strong>{message.subject || 'Bez predmetu'}</strong> · {new Date(message.occurredAt).toLocaleDateString('sk-SK')} · {message.review === 'PENDING' ? 'Na kontrolu' : message.review === 'LINKED' ? 'Priradené' : 'Vynechané'}</summary><p>Od: {message.sender}<br />Komu: {message.recipients.join(', ')}</p><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.text}</p>{message.matches.map(match => <p key={match.jobId}>Návrh: <a href={`/admin/zakazky/${match.jobId}`}>karta zákazky</a> · {match.reasons.join(' · ')}. Vyžaduje kontrolu.</p>)}
    {message.review === 'PENDING' ? <form action={action}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="task" value="review" /><input type="hidden" name="id" value={message.id} /><label>Skontrolovaná zákazka<select name="jobId" defaultValue={message.matches.length === 1 ? message.matches[0].jobId : ''}><option value="">Vyberte podľa zákazníka a čísla ponuky</option>{jobs.map(job => <option value={job.id} key={job.id}>{job.name} · {job.location} · {job.id.slice(0, 8)}</option>)}</select></label><label className={styles.check}><input type="checkbox" name="confirmed" required /><span>Skontroloval/a som obsah a prípadné priradenie k správnej zákazke.</span></label><div className={styles.footer}><button name="decision" value="LINK" disabled={pending}>Priradiť ku karte</button><button name="decision" value="IGNORE" disabled={pending}>Vynechať správu</button></div><Feedback state={state} /></form> : message.linkedJobId ? <p><a href={`/admin/zakazky/${message.linkedJobId}`}>Otvoriť priradenú kartu →</a></p> : null}
    {message.review !== 'IGNORED' ? message.pdfAttachments.map(attachment => <GmailPdfImport key={attachment.attachmentId} csrfToken={csrfToken} messageId={message.id} attachmentId={attachment.attachmentId} name={attachment.filename} />) : null}
  </details>;
}
function GmailPdfImport({ csrfToken, messageId, attachmentId, name }: { csrfToken: string; messageId: string; attachmentId: string; name: string }) {
  const [state, action, pending] = useActionState(manageJobGmailAction, initial);
  return <form action={action}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={messageId} /><input type="hidden" name="attachmentId" value={attachmentId} /><p>{name}</p><button name="task" value="pdf" disabled={pending}>{pending ? 'Ukladám…' : 'Pripraviť PDF na zaevidovanie'}</button><Feedback state={state} /></form>;
}
