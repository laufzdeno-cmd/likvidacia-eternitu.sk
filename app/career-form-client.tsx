'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import styles from './kariera/career.module.css';

const directCvThresholdBytes = 3_500_000;

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fingerprintSubmission(data: FormData, cv?: File) {
  const cvSha256 = cv ? await sha256(cv) : '';
  const fields: Array<[string, string | { name: string; size: number; type: string; lastModified: number; sha256: string }]> = [];
  data.forEach((value, name) => {
    if (name === 'submissionId') return;
    fields.push([name, value instanceof File
      ? { name: value.name, size: value.size, type: value.type, lastModified: value.lastModified, sha256: name === 'cv' ? cvSha256 : '' }
      : value]);
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fields)));
  return {
    fingerprint: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    cvSha256,
  };
}

function newSubmissionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID().replaceAll('-', '');
  return `${Date.now()}${Math.random().toString(36).slice(2, 14)}`;
}

export default function CareerFormClient() {
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const pendingCvUpload = useRef<{ submissionId: string; sha256: string; pathname: string } | null>(null);
  const submissionIdRef = useRef('');
  const lastAttempt = useRef<{ fingerprint: string; submissionId: string } | null>(null);
  const [submissionId, setSubmissionIdState] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [settledAttempt, setSettledAttempt] = useState(0);
  const [hasAsbestosExperience, setHasAsbestosExperience] = useState<'yes' | 'no' | ''>('');

  function replaceSubmissionId(next: string) {
    submissionIdRef.current = next;
    const field = formRef.current?.elements.namedItem('submissionId');
    if (field instanceof HTMLInputElement) field.value = next;
    setSubmissionIdState(next);
  }

  useEffect(() => {
    const initialId = newSubmissionId();
    submissionIdRef.current = initialId;
    setSubmissionIdState(initialId);
  }, []);

  useEffect(() => {
    if (settledAttempt > 0 && message && !isSubmitting) messageRef.current?.focus({ preventScroll: true });
  }, [isSubmitting, message, settledAttempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form || isSubmitting || !submissionIdRef.current) return;
    if (!form.reportValidity()) return;
    const selectedCv = form.elements.namedItem('cv');
    const selectedFile = selectedCv instanceof HTMLInputElement ? selectedCv.files?.[0] : undefined;
    const cv = selectedFile?.name ? selectedFile : undefined;
    if (cv && cv.size > 5 * 1024 * 1024) {
      setMessage('Životopis môže mať maximálne 5 MB. Vyberte menší súbor alebo žiadosť pošlite bez životopisu.');
      setIsSuccess(false);
      setIsAccepted(false);
      setSettledAttempt((attempt) => attempt + 1);
      return;
    }
    const submissionData = new FormData(form);
    setIsSubmitting(true);
    setMessage('Odosielame vašu žiadosť…');
    setIsSuccess(false);
    setIsAccepted(false);
    const controller = new AbortController();
    const directUpload = Boolean(cv && cv.size > directCvThresholdBytes);
    const timeout = window.setTimeout(() => controller.abort(), directUpload ? 120_000 : 30_000);
    let applicationAccepted = false;
    try {
      const identity = await fingerprintSubmission(submissionData, cv);
      let activeSubmissionId = submissionIdRef.current;
      if (lastAttempt.current && lastAttempt.current.fingerprint !== identity.fingerprint) {
        activeSubmissionId = newSubmissionId();
        replaceSubmissionId(activeSubmissionId);
        pendingCvUpload.current = null;
      } else if (lastAttempt.current) {
        activeSubmissionId = lastAttempt.current.submissionId;
        replaceSubmissionId(activeSubmissionId);
      }
      submissionData.set('submissionId', activeSubmissionId);
      lastAttempt.current = { fingerprint: identity.fingerprint, submissionId: activeSubmissionId };
      let response: Response;
      let result: { ok?: boolean; accepted?: boolean; uploadRequired?: boolean; uploadMissing?: boolean; uploadExpired?: boolean; message?: string } | null;
      if (directUpload && cv) {
        const digest = identity.cvSha256;
        const metadata = new FormData();
        submissionData.forEach((value, name) => metadata.append(name, value));
        metadata.delete('cv');
        metadata.set('cvIntent', 'on');
        metadata.set('cvExpectedSize', String(cv.size));
        metadata.set('cvExpectedSha256', digest);
        const preparation = await fetch('/api/kariera/', {
          method: 'POST', body: metadata, signal: controller.signal, headers: { accept: 'application/json' },
        });
        const prepared = await preparation.json().catch(() => null) as typeof result;
        applicationAccepted = Boolean(prepared?.accepted);
        if (preparation.status !== 202 || !prepared?.uploadRequired) {
          response = preparation;
          result = prepared;
        } else {
          const pending = pendingCvUpload.current?.submissionId === activeSubmissionId && pendingCvUpload.current.sha256 === digest
            ? pendingCvUpload.current : null;
          let pathname = pending?.pathname || '';
          if (!pathname) {
            const extension = cv.name.split('.').pop()?.toLowerCase();
            if (!['pdf', 'doc', 'docx'].includes(extension || '')) throw new Error('Neplatný formát životopisu.');
            pathname = `career-cv/${activeSubmissionId}/${crypto.randomUUID()}.${extension}`;
            pendingCvUpload.current = { submissionId: activeSubmissionId, sha256: digest, pathname };
          }
          const finalize = async () => {
            metadata.set('cvPathname', pathname);
            const nextResponse = await fetch('/api/kariera/', {
              method: 'POST', body: metadata, signal: controller.signal, headers: { accept: 'application/json' },
            });
            return { response: nextResponse, result: await nextResponse.json().catch(() => null) as typeof result };
          };
          // An interrupted Blob response can still mean the object was stored.
          // Check that exact reservation first; if absent, upload to the same path.
          let completed = pending ? await finalize() : null;
          if (!completed || completed.result?.uploadMissing) {
            if (completed?.result?.uploadExpired) {
              const extension = cv.name.split('.').pop()?.toLowerCase();
              if (!['pdf', 'doc', 'docx'].includes(extension || '')) throw new Error('Neplatný formát životopisu.');
              pathname = `career-cv/${activeSubmissionId}/${crypto.randomUUID()}.${extension}`;
              pendingCvUpload.current = { submissionId: activeSubmissionId, sha256: digest, pathname };
            }
            const { upload } = await import('@vercel/blob/client');
            const blob = await upload(pathname, cv, {
              access: 'private',
              handleUploadUrl: '/api/kariera/cv-upload/',
              clientPayload: JSON.stringify({ submissionId: activeSubmissionId, originalName: cv.name, expectedSize: cv.size, expectedSha256: digest }),
              abortSignal: controller.signal,
            });
            if (blob.pathname !== pathname) throw new Error('Životopis sa nezhoduje s rezervovanou cestou.');
            completed = await finalize();
          }
          response = completed.response;
          result = completed.result;
        }
      } else {
        response = await fetch('/api/kariera/', {
          method: 'POST', body: submissionData, signal: controller.signal, headers: { accept: 'application/json' },
        });
        result = await response.json().catch(() => null) as typeof result;
      }
      const text = result?.message || 'Žiadosť sa nepodarilo odoslať. Skúste to prosím znova.';
      setMessage(text);
      setIsSuccess(Boolean(response.ok && result?.ok));
      setIsAccepted(Boolean(result?.accepted && !(response.ok && result?.ok)));
      if (response.ok && result?.ok) {
        form.reset();
        setHasAsbestosExperience('');
        lastAttempt.current = null;
        replaceSubmissionId(newSubmissionId());
        pendingCvUpload.current = null;
      }
    } catch (error) {
      setMessage(applicationAccepted
        ? 'Žiadosť sme prijali, ale životopis sa ešte nepodarilo bezpečne pripojiť. Ponechajte údaje aj súbor a skúste odoslanie znova.'
        : error instanceof Error && error.name === 'AbortError'
          ? 'Odoslanie trvá príliš dlho. Skúste to ešte raz alebo nám zavolajte na 0905 217 946.'
          : 'Žiadosť sa nepodarilo odoslať. Skúste to ešte raz alebo nám zavolajte na 0905 217 946.');
      setIsAccepted(applicationAccepted);
    } finally {
      window.clearTimeout(timeout);
      setSettledAttempt((attempt) => attempt + 1);
      setIsSubmitting(false);
    }
  }

  const messageIsError = Boolean(message && !isAccepted && !isSuccess && !isSubmitting);
  const messageStateClass = !message ? '' : isAccepted ? ' is-warning' : isSuccess ? ' is-success' : isSubmitting ? '' : ' is-error';
  const messageStyleClass = !message || isSubmitting
    ? ''
    : isAccepted
      ? styles.warning
      : isSuccess
        ? styles.success
        : styles.error;

  return (
    <form ref={formRef} className={`career-application-form ${styles.applicationForm}`} onSubmit={submit} noValidate aria-busy={isSubmitting}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <div className={`career-honeypot ${styles.honeypot}`} aria-hidden="true">
        <label>Webová stránka<input name="companyWebsite" tabIndex={-1} autoComplete="new-password" disabled data-submit-disabled /></label>
      </div>
      <div className={`career-form-grid ${styles.formGrid}`}>
        <label>Meno a priezvisko *<input name="fullName" autoComplete="name" required disabled={isSubmitting} /></label>
        <label>Telefón *<input name="phone" type="tel" autoComplete="tel" required disabled={isSubmitting} /></label>
        <label className={`career-form-wide ${styles.formWide}`}>Email *<input name="email" type="email" autoComplete="email" required disabled={isSubmitting} /></label>
        <label>Mesto alebo okres *<input name="city" autoComplete="address-level2" required disabled={isSubmitting} /></label>
        <label>Chcem spolupracovať ako *
          <select name="cooperationType" defaultValue="szco" required disabled={isSubmitting}>
            <option value="szco">živnostník / SZČO</option><option value="crew">partia živnostníkov</option><option value="other">iná forma</option>
          </select>
        </label>
        <label className={`career-form-wide ${styles.formWide}`}>Kde viete pracovať? *
          <input name="workRegions" placeholder="napr. celé Slovensko alebo Poprad a okolie" required disabled={isSubmitting} />
          <small>Pracujeme po celom Slovensku v pracovných dňoch od 8:00 do 18:00. Konkrétny čas nástupu potvrdíme podľa lokality, počasia a nadväznosti prác.</small>
        </label>
        <label>Máte už skúsenosť s azbestom? *
          <select name="hasAsbestosExperience" value={hasAsbestosExperience} onChange={(event) => setHasAsbestosExperience(event.target.value as 'yes' | 'no' | '')} required disabled={isSubmitting}>
            <option value="" disabled>Vyberte možnosť</option>
            <option value="yes">áno</option>
            <option value="no">nie</option>
          </select>
        </label>
        {hasAsbestosExperience === 'yes' ? <label className={`career-form-wide ${styles.formWide}`}>S čím konkrétne máte skúsenosť pri azbeste? *<textarea name="asbestosExperience" rows={3} placeholder="napr. demontáž eternitu, balenie, ochranné pomôcky, dokumentácia…" required disabled={isSubmitting} /></label> : null}
        <label className={`career-form-wide ${styles.formWide}`}>Čo viete robiť a aké máte ďalšie pracovné skúsenosti? <textarea name="experience" rows={3} placeholder="napr. demontáže, strechy, práca vo výške, vedenie partie, obsluha techniky…" disabled={isSubmitting} /></label>
        <label className={`career-form-wide ${styles.formWide}`}>Poznámka <textarea name="note" rows={3} placeholder="Kedy vám môžeme zavolať, počet ľudí v partii, vybavenie…" disabled={isSubmitting} /></label>
        <label className={`career-form-wide career-file-field ${styles.formWide} ${styles.fileField}`}>Životopis (dobrovoľný)<input name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={isSubmitting} /><small>PDF, DOC alebo DOCX do 5 MB. Súbor je súkromný a vidí ho len ASTANA pri posúdení žiadosti.</small></label>
      </div>
      <div className={`career-checks ${styles.checks}`}>
        <label><input name="hasTradeLicense" type="checkbox" required disabled={isSubmitting} /> Môžem pracovať ako živnostník alebo samostatná partia. *</label>
        <label><input name="workAtHeights" type="checkbox" required disabled={isSubmitting} /> Mám skúsenosť s prácou vo výške. *</label>
        <label><input name="gdpr" type="checkbox" required disabled={isSubmitting} /><span>Súhlasím so spracovaním údajov pre účely výberu spolupráce podľa <a href="/ochrana-osobnych-udajov/" target="_blank" rel="noreferrer">ochrany osobných údajov</a>. *</span></label>
      </div>
      <button className={`button button-primary career-submit ${styles.submit}`} type="submit" disabled={isSubmitting || !submissionId}>{isSubmitting ? 'Odosielame…' : 'Poslať krátku žiadosť'}</button>
      <p className={`career-form-help ${styles.formHelp}`}>Bez životopisu je to v poriadku. Ozveme sa vám telefonicky alebo e-mailom.</p>
      <p
        ref={messageRef}
        className={`career-form-message ${styles.formMessage}${messageStateClass}${messageStyleClass ? ` ${messageStyleClass}` : ''}`}
        role={messageIsError ? 'alert' : 'status'}
        aria-live={messageIsError ? 'assertive' : 'polite'}
        aria-atomic="true"
        tabIndex={message && !isSubmitting ? -1 : undefined}
      >
        {message}
      </p>
    </form>
  );
}
