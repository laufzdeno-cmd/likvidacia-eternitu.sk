'use client';

import { useActionState, useState } from 'react';
import { createPhotoInviteAction, type PhotoInviteActionState } from './actions';

const initial: PhotoInviteActionState = {};

type PhotoJobOption = { id: string; demolitionDate: string; district: string; status: string };

export default function InviteTool({ csrfToken, enabled, jobs }: { csrfToken: string; enabled: boolean; jobs: PhotoJobOption[] }) {
  const [state, action, pending] = useActionState(createPhotoInviteAction, initial);
  const [openingUpload, setOpeningUpload] = useState(false);
  const [openingError, setOpeningError] = useState('');

  async function openUploadForAdmin() {
    if (!state.code || openingUpload) return;
    setOpeningUpload(true);
    setOpeningError('');
    try {
      const response = await fetch('/api/photo-intake/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: state.code }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Nahrávanie sa nepodarilo otvoriť.');
      window.location.assign('/spolupraca/fotky');
    } catch (error) {
      setOpeningError(error instanceof Error ? error.message : 'Nahrávanie sa nepodarilo otvoriť.');
      setOpeningUpload(false);
    }
  }

  return <div>
    <form action={action} className="admin-quote-form">
      <input type="hidden" name="_csrf" value={csrfToken} />
      <label>Pracovník / partia
        <input name="workerLabel" type="text" required minLength={2} maxLength={100} autoComplete="off" placeholder="Napr. Partia Poprad" />
        <small>Interné označenie na rozlíšenie odovzdaných fotografií; na verejnej stránke sa nezobrazí.</small>
      </label>
      <label>Dokončená zákazka
        <select name="businessJobId" required defaultValue="" disabled={!jobs.length}>
          <option value="" disabled>Vyberte dokončenú zákazku</option>
          {jobs.map((job) => <option key={job.id} value={job.id}>{job.demolitionDate}{job.district ? ` · ${job.district}` : ''} · {job.status}</option>)}
        </select>
        <small>Fotografie budú priradené k tejto zákazke. Meno zákazníka ani presná adresa sa pracovníkovi nezobrazia.</small>
      </label>
      <label>Platnosť kódu
        <select name="days" defaultValue="7"><option value="1">1 deň</option><option value="3">3 dni</option><option value="7">7 dní</option><option value="14">14 dní</option><option value="30">30 dní</option></select>
      </label>
      <button className="admin-primary-button" disabled={pending || !enabled || !jobs.length} type="submit">{pending ? 'Vytváram…' : 'Vytvoriť jednorazový kód'}</button>
    </form>
    {!enabled ? <p role="status">Tlačidlo zostáva vypnuté. Zapne sa až po potvrdení private úložiska a serverových kľúčov.</p> : null}
    {enabled && !jobs.length ? <p role="status">Nie je dostupná dokončená zákazka. Najprv ju evidujte v administrácii; bez priradenej zákazky kód nevytvoríme.</p> : null}
    {state.error ? <p className="photo-intake-error" role="alert">{state.error}</p> : null}
    {state.code ? <div className="photo-admin-created-code" role="status">
      <strong>Kód sa zobrazí iba teraz. Môžete s ním nahrať fotky sami alebo ho poslať pracovníkovi bezpečným súkromným kanálom.</strong>
      <p>Platný do {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.expiresAt || ''))}.</p>
      <button className="admin-primary-button" type="button" disabled={openingUpload} onClick={() => void openUploadForAdmin()}>{openingUpload ? 'Otváram nahrávanie…' : 'Nahrať fotky teraz'}</button>
      <textarea readOnly rows={3} value={state.code} aria-label="Jednorazový prístupový kód" onFocus={(event) => event.currentTarget.select()} />
      <small>Kód je jednorazový. Po jeho použití ho už nemožno zobraziť ani znovu použiť.</small>
      {openingError ? <p className="photo-intake-error" role="alert">{openingError}</p> : null}
    </div> : null}
  </div>;
}
