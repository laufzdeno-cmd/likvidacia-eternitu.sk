'use client';

import { upload } from '@vercel/blob/client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { isApproximateLocality, photoCategories, type PhotoCategory, maxIntakePhotoBytes, allowedIntakePhotoTypes } from '@/src/server/photo-intake-policy';
import { photoSelectionNotice, splitPhotoSelection } from '@/src/lib/photo-intake-selection';

const categoryLabels: Record<PhotoCategory, string> = {
  family_house: 'Rodinný dom',
  outbuilding: 'Hospodárska budova',
  garage: 'Garáž',
  illegal_dump: 'Nelegálna skládka',
  interior: 'Interiér',
};

type Draft = { key: string; file: File; previewUrl: string; previewError?: boolean; locality: string; categories: PhotoCategory[]; mediaId?: string; transferred?: boolean; metadataVersion?: number; confirmation?: { locality: string; categories: PhotoCategory[] }; status?: string; error?: string };
type HistoryPhoto = { id: string; originalName: string; locality: string; categories: PhotoCategory[]; status: string; sizeBytes: number; metadataVersion: number };

export function PhotoIntakeLogin() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/photo-intake/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Prihlásenie sa nepodarilo.');
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Prihlásenie sa nepodarilo.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="photo-intake-login" onSubmit={submit}>
    <label htmlFor="invite-code">Jednorazový prístupový kód</label>
    <input id="invite-code" type="password" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required maxLength={100} />
    <button type="submit" disabled={busy || code.length < 32}>{busy ? 'Overujem…' : 'Otvoriť nahrávanie'}</button>
    {message ? <p role="alert">{message}</p> : null}
  </form>;
}

export function PhotoIntakeUploader({ inviteId }: { inviteId: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const previewUrls = useRef(new Set<string>());

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current.clear();
  }, []);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const selected = splitPhotoSelection(Array.from(files), drafts.length);
    const fresh = selected.accepted.map((file) => ({
      key: `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      locality: '',
      categories: [],
    }));
    fresh.forEach((draft) => previewUrls.current.add(draft.previewUrl));
    setDrafts((current) => [...current, ...fresh].slice(0, 20));
    setMessage(photoSelectionNotice(fresh.length, selected.rejectedCount));
  }

  function removeDraft(key: string) {
    const draft = drafts.find((item) => item.key === key);
    if (draft) {
      URL.revokeObjectURL(draft.previewUrl);
      previewUrls.current.delete(draft.previewUrl);
    }
    setDrafts((current) => current.filter((item) => item.key !== key));
  }

  function updateDraft(key: string, update: Partial<Draft>) {
    setDrafts((current) => current.map((item) => item.key === key ? { ...item, ...update } : item));
  }

  async function sendDraft(draft: Draft) {
    if (draft.locality && !isApproximateLocality(draft.locality)) {
      updateDraft(draft.key, { error: 'Uveď iba obec alebo širšiu oblasť bez ulice a čísla domu, prípadne lokalitu zatiaľ nechaj prázdnu.' });
      return;
    }
    if (!allowedIntakePhotoTypes.includes(draft.file.type as (typeof allowedIntakePhotoTypes)[number])) {
      updateDraft(draft.key, { error: 'Tento formát nevieme bezpečne spracovať. Vyberte JPG, PNG alebo WebP.' });
      return;
    }
    if (draft.file.size <= 0 || draft.file.size > maxIntakePhotoBytes) {
      updateDraft(draft.key, { error: 'Súbor je prázdny alebo väčší ako 20 MB.' });
      return;
    }

    const mediaId = draft.mediaId || crypto.randomUUID();
    let transferred = draft.transferred === true;
    let metadataVersion = draft.metadataVersion;
    let confirmation = draft.confirmation || { locality: draft.locality, categories: [...draft.categories] };
    const metadataChanged = () => draft.locality !== confirmation.locality
      || draft.categories.length !== confirmation.categories.length
      || draft.categories.some((category) => !confirmation.categories.includes(category));

    async function saveMetadata(expectedMetadataVersion: number) {
      const response = await fetch('/api/photo-intake/metadata/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mediaId, locality: draft.locality, categories: draft.categories, expectedMetadataVersion }),
      });
      const result = await response.json() as { error?: string; metadataVersion?: number };
      if (!response.ok) throw new Error(result.error || 'Popis sa nepodarilo uložiť. Obnov stránku a skontroluj uložený stav.');
      if (typeof result.metadataVersion !== 'number' || !Number.isInteger(result.metadataVersion)
        || result.metadataVersion <= expectedMetadataVersion) {
        throw new Error('Uloženie sa nepodarilo potvrdiť. Obnov stránku a skontroluj popis fotografie.');
      }
      metadataVersion = result.metadataVersion;
      confirmation = { locality: draft.locality, categories: [...draft.categories] };
      updateDraft(draft.key, { metadataVersion, confirmation, status: 'Nahraté – čaká na kontrolu', error: '' });
    }

    async function confirmUpload() {
      updateDraft(draft.key, { confirmation, status: 'Overujem fotografiu…' });
      const response = await fetch('/api/photo-intake/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId, contentType: draft.file.type, locality: confirmation.locality, categories: confirmation.categories, expectedMetadataVersion: metadataVersion || 1 }),
      });
      const result = await response.json() as { error?: string; metadataVersion?: number };
      if (!response.ok) {
        const error = new Error(result.error || 'Server nepotvrdil fotografiu.') as Error & { status: number };
        error.status = response.status;
        throw error;
      }
      if (typeof result.metadataVersion !== 'number' || !Number.isInteger(result.metadataVersion)
        || result.metadataVersion < 1) {
        throw new Error('Potvrdenie sa nepodarilo overiť. Skús to znova alebo obnov stránku.');
      }
      transferred = true;
      metadataVersion = result.metadataVersion;
      updateDraft(draft.key, { mediaId, transferred, metadataVersion, status: 'Nahraté – čaká na kontrolu', error: '' });
      if (metadataChanged()) await saveMetadata(result.metadataVersion);
    }

    setBusy(true);
    setMessage('');
    updateDraft(draft.key, { mediaId, error: '', status: metadataVersion ? 'Ukladám popis…' : 'Nahrávam…' });
    try {
      if (transferred && metadataVersion) {
        if (metadataChanged()) await saveMetadata(metadataVersion);
        else updateDraft(draft.key, { status: 'Nahraté – čaká na kontrolu', error: '' });
        return;
      }
      if (draft.mediaId && !transferred) {
        try {
          await confirmUpload();
          return;
        } catch (error) {
          // Re-upload only when the server knows the private source is missing.
          // An uncertain response or a conflict must keep the same media ID for recovery.
          if (metadataVersion || !(error instanceof Error) || !('status' in error) || error.status !== 404) throw error;
        }
      }
      if (!transferred) {
        const extension = draft.file.name.split('.').pop()?.toLowerCase() || '';
        const pathname = `crew-intake/${inviteId}/${mediaId}.${extension}`;
        await upload(pathname, draft.file, {
          access: 'private',
          handleUploadUrl: '/api/photo-intake/upload',
          contentType: draft.file.type,
          clientPayload: JSON.stringify({ mediaId, originalName: draft.file.name, contentType: draft.file.type }),
          multipart: true,
        });
        transferred = true;
        updateDraft(draft.key, { mediaId, transferred, status: 'Overujem fotografiu…' });
      }
      await confirmUpload();
    } catch (error) {
      updateDraft(draft.key, {
        mediaId,
        transferred,
        metadataVersion,
        status: metadataVersion ? 'Nahraté – čaká na kontrolu' : 'Nahratie nepotvrdené',
        error: error instanceof Error ? error.message : 'Nahratie sa nepodarilo.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/photo-intake/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logout: true }) });
    window.location.reload();
  }

  return <section className="photo-intake-uploader">
    <div className="photo-intake-toolbar"><p>Prístup je dočasný a obmedzený iba na nahrávanie tvojich fotiek.</p><button type="button" className="photo-intake-quiet" onClick={logout}>Odhlásiť</button></div>
    <label className="photo-intake-file-picker">
      <span>Vybrať fotografie</span>
      <small>JPG, PNG alebo WebP · najviac 20 MB a 25 Mpx na fotku · do 20 fotiek naraz. Fotky z iPhonu ulož ako JPG. Väčšie zábery pred nahratím zmenši.</small>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ''; }} />
    </label>
    {drafts.map((draft) => <article className="photo-intake-draft" key={draft.key}>
      <div className="photo-intake-draft-title"><strong>{draft.file.name}</strong><small>{(draft.file.size / 1024 / 1024).toLocaleString('sk-SK', { maximumFractionDigits: 1 })} MB</small></div>
      <div className="photo-intake-draft-content">
        {draft.previewError ? <div className="photo-intake-preview-fallback" role="img" aria-label={`Náhľad nie je dostupný pre ${draft.file.name}`}>Náhľad nie je dostupný v tomto prehliadači</div> : <Image className="photo-intake-preview" src={draft.previewUrl} alt={`Náhľad fotografie ${draft.file.name}`} width={480} height={360} sizes="(max-width: 640px) 100vw, 220px" unoptimized onError={() => updateDraft(draft.key, { previewError: true })} />}
        <div className="photo-intake-draft-fields">
          <label>Lokalita – obec alebo širšia oblasť (nepovinné)
            <input disabled={busy} value={draft.locality} maxLength={120} placeholder="Napríklad Poprad alebo okres Poprad" onChange={(event) => updateDraft(draft.key, { locality: event.target.value })} />
            <small>Ak si nie si istý, nechaj prázdne a doplníme ju neskôr. Neuvádzaj ulicu, číslo domu, mená ani presnú adresu.</small>
          </label>
          <fieldset><legend>Čo je na fotografii? (nepovinné)</legend>
            <div className="photo-intake-tags">{photoCategories.map((category) => <label key={category}>
              <input type="checkbox" disabled={busy} checked={draft.categories.includes(category)} onChange={(event) => updateDraft(draft.key, { categories: event.target.checked ? [...draft.categories, category] : draft.categories.filter((item) => item !== category) })} />
              {categoryLabels[category]}
            </label>)}</div>
          </fieldset>
        </div>
      </div>
      <div className="photo-intake-actions">
        <button type="button" disabled={busy} onClick={() => void sendDraft(draft)}>{draft.metadataVersion ? 'Uložiť lokalitu a kategórie' : draft.transferred ? 'Potvrdiť nahratie' : 'Nahrať fotografiu'}</button>
        {draft.status ? <span role="status">{draft.status}</span> : null}
        <button type="button" className="photo-intake-quiet" disabled={busy} onClick={() => removeDraft(draft.key)}>Odstrániť zo zoznamu</button>
      </div>
      {draft.error ? <p className="photo-intake-error" role="alert">{draft.error}</p> : null}
    </article>)}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}

export function PhotoIntakeHistory({ photos, statuses }: { photos: HistoryPhoto[]; statuses: Record<string, string> }) {
  return <div className="photo-intake-grid">{photos.map((photo) => <PhotoIntakeHistoryItem key={photo.id} photo={photo} statusLabel={statuses[photo.status] || 'Čaká na spracovanie'} />)}</div>;
}

function PhotoIntakeHistoryItem({ photo, statusLabel }: { photo: HistoryPhoto; statusLabel: string }) {
  const [clientReady, setClientReady] = useState(false);
  const [locality, setLocality] = useState(photo.locality);
  const [categories, setCategories] = useState<PhotoCategory[]>(photo.categories);
  const [metadataVersion, setMetadataVersion] = useState(photo.metadataVersion);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setClientReady(true), []);

  async function saveMetadata() {
    if ((locality && !isApproximateLocality(locality))) {
      setMessage('Uveď iba obec alebo širšiu oblasť bez ulice a čísla domu, prípadne lokalitu zatiaľ nechaj prázdnu.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/photo-intake/metadata/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: photo.id, locality, categories, expectedMetadataVersion: metadataVersion }),
      });
      const result = await response.json() as { error?: string; metadataVersion?: number };
      if (!response.ok) throw new Error(result.error || 'Popis sa nepodarilo uložiť.');
      setMetadataVersion(result.metadataVersion || metadataVersion + 1);
      setMessage('Popis fotografie je uložený. Fotografia zostáva súkromná.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Popis sa nepodarilo uložiť.');
    } finally {
      setBusy(false);
    }
  }

  return <article data-client-ready={clientReady ? 'true' : 'false'}>
    {photo.status !== 'pending_upload' && photo.status !== 'deletion_pending' ? <img src={`/api/photo-intake/media/${photo.id}`} alt="Súkromný náhľad odovzdanej fotografie" /> : <div className="photo-intake-pending" aria-hidden="true">{photo.status === 'deletion_pending' ? 'Fotografia čaká na odstránenie' : 'Náhľad zatiaľ nie je dostupný'}</div>}
    <strong>{photo.originalName}</strong>
    <span>{statusLabel} · {(photo.sizeBytes / 1024 / 1024).toLocaleString('sk-SK', { maximumFractionDigits: 1 })} MB</span>
    {photo.status === 'pending_review' ? <div className="photo-intake-history-edit">
      <label>Lokalita – obec alebo širšia oblasť
        <input value={locality} maxLength={120} disabled={busy} placeholder="Napríklad Poprad alebo okres Poprad" onChange={(event) => setLocality(event.target.value)} />
        <small>Bez ulice, čísla domu, mien a presnej adresy.</small>
      </label>
      <fieldset><legend>Čo je na fotografii?</legend><div className="photo-intake-tags">{photoCategories.map((category) => <label key={category}>
        <input type="checkbox" checked={categories.includes(category)} disabled={busy} onChange={(event) => setCategories((current) => event.target.checked ? [...current, category] : current.filter((item) => item !== category))} />
        {categoryLabels[category]}
      </label>)}</div></fieldset>
      <button type="button" disabled={busy} onClick={() => void saveMetadata()}>{busy ? 'Ukladám…' : 'Uložiť miesto a kategóriu'}</button>
      {message ? <p role="status">{message}</p> : null}
    </div> : <small>{photo.locality || 'Lokalita neuvedená'}{photo.categories.length ? ` · ${photo.categories.map((category) => categoryLabels[category]).join(', ')}` : ''}</small>}
  </article>;
}
