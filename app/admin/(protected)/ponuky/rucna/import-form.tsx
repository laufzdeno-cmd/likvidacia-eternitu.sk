'use client';

import { useActionState, useState, type ChangeEvent } from 'react';
import { useFormStatus } from 'react-dom';
import type { ManualPriceOffer, ManualPriceOfferInput, ManualPriceOfferItem } from '@/src/server/job-workspace-types';
import { importManualOfferAction, updateManualOfferAction, type ManualOfferActionState } from './actions';
import styles from './manual-offer.module.css';

type Upload = { id: string; originalName: string; sha256: string; href: string };
type Extraction = { state: string; text: string; reason: string; suggestions: Array<{ field: string; value: string; sourceText: string; confidence: string }> };
const emptyState: ManualOfferActionState = { ok: false, message: '' };
const cents = (value: string) => value.trim() === '' ? null : Math.round(Number(value.replace(',', '.')) * 100);
const suggestionLabels: Record<string, string> = { originalNumber: 'Číslo ponuky', issuedOn: 'Vystavená', email: 'Email zákazníka', phone: 'Telefón zákazníka', totalWithVatCents: 'Celkom s DPH' };
function SaveButton() { const { pending } = useFormStatus(); return <button disabled={pending} type="submit">{pending ? 'Ukladám…' : 'Uložiť overenú PDF ponuku'}</button>; }

export default function ManualImportForm({ csrfToken, jobId = '', initialDocument = null, offer }: { csrfToken: string; jobId?: string; initialDocument?: Upload | null; offer?: ManualPriceOffer }) {
  const [state, action] = useActionState(offer ? updateManualOfferAction : importManualOfferAction, emptyState);
  const [document, setDocument] = useState<Upload | null>(initialDocument);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [items, setItems] = useState<ManualPriceOfferItem[]>(offer?.items || []);
  const [fields, setFields] = useState({ originalNumber: offer?.originalNumber || '', issuedOn: offer?.issuedOn || '', contactPerson: offer?.contactPerson || '', email: offer?.email || '', phone: offer?.phone || '', address: offer?.address || '', net: offer?.totalWithoutVatCents == null ? '' : String(offer.totalWithoutVatCents / 100), gross: offer?.totalWithVatCents == null ? '' : String(offer.totalWithVatCents / 100), note: offer?.note || '' });
  const update = (key: keyof typeof fields, value: string) => setFields(previous => ({ ...previous, [key]: value }));
  const payload: ManualPriceOfferInput = { originalNumber: fields.originalNumber, issuedOn: fields.issuedOn || null, contactPerson: fields.contactPerson, email: fields.email, phone: fields.phone, address: fields.address, jobId: jobId || null, items, totalWithoutVatCents: cents(fields.net), totalWithVatCents: cents(fields.gross), currency: 'EUR', note: fields.note, pdf: { documentId: document?.id || '', sha256: document?.sha256 || '', originalName: document?.originalName || '' } };
  function useSuggestions() {
    setFields(previous => {
      const next = { ...previous };
      for (const suggestion of extraction?.suggestions || []) {
        if (suggestion.field === 'totalWithVatCents' && /^\d+$/.test(suggestion.value)) next.gross = String(Number(suggestion.value) / 100);
        else if (['originalNumber', 'issuedOn', 'email', 'phone'].includes(suggestion.field)) next[suggestion.field as 'originalNumber' | 'issuedOn' | 'email' | 'phone'] = suggestion.value;
      }
      return next;
    });
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setDocument(null); setExtraction(null); setUploading(true); setUploadMessage('');
    try {
      const data = new FormData(); data.set('_csrf', csrfToken); data.set('file', file); data.set('kind', 'PDF'); if (jobId) data.set('jobId', jobId);
      const response = await fetch('/api/admin/job-workspace/upload/', { method: 'POST', body: data });
      const body = await response.json(); if (!response.ok) throw new Error('upload');
      setDocument(body.document); setExtraction(body.extraction); setUploadMessage('PDF je súkromne uložené. Pred zaevidovaním skontrolujte každé pole.');
    } catch { setUploadMessage('PDF sa nepodarilo nahrať. Použite platné PDF do 3 MB a skúste znova.'); }
    finally { setUploading(false); }
  }

  return <div className={styles.workspace}>
    <section className={styles.upload}><p className={styles.eyebrow}>1 · Súkromný originál</p><h2>{offer ? 'Zachovaný originál' : 'Nahrať Jarkinu ponuku'}</h2><p>Originál uchováme bez úprav. Z obsahu pripravíme návrhy údajov na kontrolu priamo v našom systéme.</p>{!offer ? <label>PDF do 3 MB<input type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={upload} /></label> : null}<p role="status">{uploading ? 'Nahrávam a čítam PDF…' : uploadMessage}</p>{document ? <a href={document.href} target="_blank" rel="noreferrer">Otvoriť originál: {document.originalName}</a> : null}</section>
    {extraction ? <details className={styles.extraction} open><summary>Rozpoznaný text a návrhy na kontrolu</summary><p>{extraction.state === 'TEXT' ? 'Návrhy nie sú automaticky schválené. Porovnajte ich s originálom a doplňte formulár.' : 'Tento dokument treba doplniť ručne. Originál ostáva uložený.'}</p>{extraction.suggestions?.map((suggestion, index) => <p key={index}><strong>{suggestionLabels[suggestion.field] || 'Údaj'}: {suggestion.field === 'totalWithVatCents' ? `${Number(suggestion.value) / 100} €` : String(suggestion.value)}</strong><small>{suggestion.sourceText}</small></p>)}{extraction.suggestions?.length ? <button type="button" onClick={useSuggestions}>Preniesť návrhy do formulára</button> : null}<pre>{extraction.text}</pre></details> : null}
    <form className={styles.form} action={action}>
      <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {offer ? <><input type="hidden" name="id" value={offer.id} /><input type="hidden" name="revision" value={offer.revision} /></> : null}
      <p className={styles.eyebrow}>2 · Overené údaje ponuky</p><h2>Pôvodné číslo a obsah</h2>
      <div className={styles.grid}>
        <label>Pôvodné číslo CP<input required maxLength={120} readOnly={Boolean(offer)} value={fields.originalNumber} onChange={e => update('originalNumber', e.target.value)} /></label>
        <label>Dátum vystavenia<input type="date" value={fields.issuedOn} onChange={e => update('issuedOn', e.target.value)} /><small>Neznámy dátum nechajte prázdny.</small></label>
        <label>Meno / firma<input required maxLength={300} value={fields.contactPerson} onChange={e => update('contactPerson', e.target.value)} /></label>
        <label>Email<input type="email" value={fields.email} onChange={e => update('email', e.target.value)} /></label>
        <label>Telefón<input type="tel" maxLength={100} value={fields.phone} onChange={e => update('phone', e.target.value)} /></label>
        <label>Adresa / miesto realizácie<input maxLength={1000} value={fields.address} onChange={e => update('address', e.target.value)} /></label>
      </div>
      <div className={styles.sectionHeading}><h3>Položky tak, ako sú v PDF</h3><button type="button" onClick={() => setItems(previous => [...previous, { id: crypto.randomUUID(), description: '', unit: '', quantity: null, unitPriceWithoutVatCents: null, totalWithoutVatCents: null, vatRate: null }])}>+ Pridať položku</button></div>
      {items.map((item, index) => <fieldset key={item.id} className={styles.item}><legend>Položka {index + 1}</legend><label>Popis<input required maxLength={1000} value={item.description} onChange={e => setItems(previous => previous.map(x => x.id === item.id ? { ...x, description: e.target.value } : x))} /></label><div className={styles.grid}>{([['unit', 'Jednotka'], ['quantity', 'Množstvo'], ['unitPriceWithoutVatCents', 'Cena / jedn. bez DPH €'], ['totalWithoutVatCents', 'Položka bez DPH €'], ['vatRate', 'DPH %']] as const).map(([key, label]) => <label key={key}>{label}<input type={key === 'unit' ? 'text' : 'number'} min={key === 'unit' ? undefined : 0} step="any" value={item[key] === null ? '' : key.includes('Cents') ? Number(item[key]) / 100 : item[key]} onChange={e => setItems(previous => previous.map(x => x.id === item.id ? { ...x, [key]: key === 'unit' ? e.target.value : e.target.value === '' ? null : key.includes('Cents') ? cents(e.target.value) : Number(e.target.value) } : x))} /></label>)}</div><button type="button" onClick={() => setItems(previous => previous.filter(x => x.id !== item.id))}>Odobrať položku</button></fieldset>)}
      <div className={styles.grid}><label>Celkom bez DPH €<input type="number" min="0" step="0.01" value={fields.net} onChange={e => update('net', e.target.value)} /></label><label>Celkom s DPH €<input type="number" min="0" step="0.01" value={fields.gross} onChange={e => update('gross', e.target.value)} /></label></div>
      <label>Interná poznámka<textarea maxLength={10000} rows={3} value={fields.note} onChange={e => update('note', e.target.value)} /></label>
      <p className={styles.notice}>Prázdny údaj znamená „zatiaľ nevieme“. Sumy porovnajte s originálom; ručné zaevidovanie zákazníkovi nič neodošle.</p>
      <label className={styles.check}><input type="checkbox" required /><span>Porovnal/a som číslo, zákazníka a obsah ponuky s pôvodným PDF.</span></label>
      <fieldset disabled={!document || uploading || state.ok} className={styles.footer}><SaveButton /></fieldset>
      {state.message ? <p role="status" className={state.ok ? styles.success : styles.notice}>{state.message}{state.id ? <> <a href={`/admin/ponuky/rucna/${state.id}`}>Otvoriť zaevidovanú ponuku →</a></> : null}</p> : null}
    </form>
  </div>;
}
