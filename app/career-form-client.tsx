'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

function newSubmissionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID().replaceAll('-', '');
  return `${Date.now()}${Math.random().toString(36).slice(2, 14)}`;
}

export default function CareerFormClient() {
  const formRef = useRef<HTMLFormElement>(null);
  const [submissionId, setSubmissionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasAsbestosExperience, setHasAsbestosExperience] = useState<'yes' | 'no' | ''>('');

  useEffect(() => {
    setSubmissionId(newSubmissionId());
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form || isSubmitting || !submissionId) return;
    if (!form.reportValidity()) return;
    setIsSubmitting(true);
    setMessage('Odosielame vašu žiadosť…');
    setIsSuccess(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch('/api/kariera/', {
        method: 'POST', body: new FormData(form), signal: controller.signal, headers: { accept: 'application/json' },
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      const text = result?.message || 'Žiadosť sa nepodarilo odoslať. Skúste to prosím znova.';
      setMessage(text);
      setIsSuccess(Boolean(response.ok && result?.ok));
      if (response.ok && result?.ok) {
        form.reset();
        setHasAsbestosExperience('');
        setSubmissionId(newSubmissionId());
      }
    } catch (error) {
      setMessage(error instanceof Error && error.name === 'AbortError'
        ? 'Odoslanie trvá príliš dlho. Skúste to ešte raz alebo nám zavolajte na 0905 217 946.'
        : 'Žiadosť sa nepodarilo odoslať. Skúste to ešte raz alebo nám zavolajte na 0905 217 946.');
    } finally {
      window.clearTimeout(timeout);
      setIsSubmitting(false);
    }
  }

  return (
    <form ref={formRef} className="career-application-form" onSubmit={submit} noValidate>
      <input type="hidden" name="submissionId" value={submissionId} />
      <div className="career-honeypot" aria-hidden="true">
        <label>Webová stránka<input name="companyWebsite" tabIndex={-1} autoComplete="new-password" disabled data-submit-disabled /></label>
      </div>
      <div className="career-form-grid">
        <label>Meno a priezvisko *<input name="fullName" autoComplete="name" required /></label>
        <label>Telefón *<input name="phone" type="tel" autoComplete="tel" required /></label>
        <label className="career-form-wide">Email *<input name="email" type="email" autoComplete="email" required /></label>
        <label>Mesto alebo okres *<input name="city" autoComplete="address-level2" required /></label>
        <label>Chcem spolupracovať ako *
          <select name="cooperationType" defaultValue="szco" required>
            <option value="szco">živnostník / SZČO</option><option value="crew">partia živnostníkov</option><option value="other">iná forma</option>
          </select>
        </label>
        <label className="career-form-wide">Kde viete pracovať? *
          <input name="workRegions" placeholder="napr. celé Slovensko alebo Poprad a okolie" required />
          <small>Pracujeme po celom Slovensku. Z Popradu vyrážame skoro ráno, aby sme boli na stavbe spravidla medzi 6:00 a 6:30. Strechári, ktorí prídu okolo 8:00, sa tak môžu pripraviť na svoju prácu.</small>
        </label>
        <label>Máte už skúsenosť s azbestom? *
          <select name="hasAsbestosExperience" value={hasAsbestosExperience} onChange={(event) => setHasAsbestosExperience(event.target.value as 'yes' | 'no' | '')} required>
            <option value="" disabled>Vyberte možnosť</option>
            <option value="yes">áno</option>
            <option value="no">nie</option>
          </select>
        </label>
        {hasAsbestosExperience === 'yes' ? <label className="career-form-wide">S čím konkrétne máte skúsenosť pri azbeste? *<textarea name="asbestosExperience" rows={3} placeholder="napr. demontáž eternitu, balenie, ochranné pomôcky, dokumentácia…" required /></label> : null}
        <label className="career-form-wide">Čo viete robiť a aké máte ďalšie pracovné skúsenosti? <textarea name="experience" rows={3} placeholder="napr. demontáže, strechy, práca vo výške, vedenie partie, obsluha techniky…" /></label>
        <label className="career-form-wide">Poznámka <textarea name="note" rows={3} placeholder="Kedy vám môžeme zavolať, počet ľudí v partii, vybavenie…" /></label>
        <label className="career-form-wide career-file-field">Životopis (dobrovoľný)<input name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /><small>PDF, DOC alebo DOCX do 5 MB. Súbor je súkromný a vidí ho len ASTANA pri posúdení žiadosti.</small></label>
      </div>
      <div className="career-checks">
        <label><input name="hasTradeLicense" type="checkbox" required /> Môžem pracovať ako živnostník alebo samostatná partia. *</label>
        <label><input name="workAtHeights" type="checkbox" required /> Mám skúsenosť s prácou vo výške. *</label>
        <label><input name="gdpr" type="checkbox" required /> Súhlasím so spracovaním údajov pre účely výberu spolupráce podľa <a href="/ochrana-osobnych-udajov/" target="_blank" rel="noreferrer">ochrany osobných údajov</a>. *</label>
      </div>
      <button className="button button-primary career-submit" type="submit" disabled={isSubmitting || !submissionId}>{isSubmitting ? 'Odosielame…' : 'Poslať krátku žiadosť'}</button>
      <p className="career-form-help">Bez životopisu je to v poriadku. Ozveme sa vám telefonicky alebo e-mailom.</p>
      {message ? <p className={`career-form-message${isSuccess ? ' is-success' : ' is-error'}`} role="status">{message}</p> : null}
    </form>
  );
}
