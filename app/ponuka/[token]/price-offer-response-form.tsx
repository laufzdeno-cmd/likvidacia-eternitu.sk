'use client';

import { useEffect, useRef, useState } from 'react';

type ResponseChoice = 'ACCEPTED' | 'DEFERRED' | 'DECLINED';

export default function PriceOfferResponseForm({ token, today, maxDate }: { token: string; today: string; maxDate: string }) {
  const [choice, setChoice] = useState<ResponseChoice | ''>('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (message) messageRef.current?.focus({ preventScroll: true });
  }, [message]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = String(data.get('response') || '') as ResponseChoice;
    if (!response) return;
    setPending(true);
    setError(false);
    setMessage('Ukladáme vaše vyjadrenie…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const apiResponse = await fetch('/api/price-offer-response/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          token,
          response,
          reasonCode: response === 'DECLINED' ? String(data.get('reasonCode') || '') : '',
          requestedFollowUpAt: response === 'DEFERRED' ? String(data.get('requestedFollowUpAt') || '') : '',
          confirmedReview: data.get('confirmedReview') === 'yes',
        }),
        signal: controller.signal,
      });
      const result = await apiResponse.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!apiResponse.ok || !result?.ok) throw new Error(result?.message || 'Vyjadrenie sa nepodarilo uložiť.');
      setSubmitted(true);
      setMessage('Vyjadrenie sme prijali. Pred ďalším krokom ho skontroluje náš tím.');
    } catch (submitError) {
      setError(true);
      setMessage(submitError instanceof Error && submitError.name === 'AbortError'
        ? 'Ukladanie trvá príliš dlho. Skúste to prosím znova.'
        : submitError instanceof Error ? submitError.message : 'Vyjadrenie sa nepodarilo uložiť.');
    } finally {
      window.clearTimeout(timeout);
      setPending(false);
    }
  }

  if (submitted) {
    return <div className="private-action-success" role="status">
      <h2>Ďakujeme za odpoveď</h2>
      <p>Vaše vyjadrenie je uložené. ASTANA ho skontroluje a podľa potreby vás bude kontaktovať.</p>
    </div>;
  }

  return <form className="private-action-form" onSubmit={submit} aria-busy={pending}>
    <fieldset disabled={pending}>
      <legend>Ako sa chcete k ponuke vyjadriť?</legend>
      <label className="private-action-choice">
        <input type="radio" name="response" value="ACCEPTED" required onChange={() => setChoice('ACCEPTED')} />
        <span><strong>Ponuku prijímam</strong><small>Náš tím vaše vyjadrenie skontroluje a ozve sa k ďalšiemu postupu.</small></span>
      </label>
      <label className="private-action-choice">
        <input type="radio" name="response" value="DEFERRED" required onChange={() => setChoice('DEFERRED')} />
        <span><strong>Potrebujem viac času</strong><small>Vyberte dátum, od ktorého vás môžeme znovu kontaktovať.</small></span>
      </label>
      <label className="private-action-choice">
        <input type="radio" name="response" value="DECLINED" required onChange={() => setChoice('DECLINED')} />
        <span><strong>Ponuku nevyužijem</strong><small>Krátky dôvod nám pomôže zlepšiť službu.</small></span>
      </label>
    </fieldset>

    {choice === 'DEFERRED' ? <label>Kontaktovať ma najskôr
      <input name="requestedFollowUpAt" type="date" min={today} max={maxDate} required disabled={pending} />
    </label> : null}

    {choice === 'DECLINED' ? <label>Dôvod
      <select name="reasonCode" required defaultValue="" disabled={pending}>
        <option value="" disabled>Vyberte možnosť</option>
        <option value="price">Cena</option>
        <option value="timing">Nevyhovuje mi termín</option>
        <option value="selected_other">Vybral/a som inú ponuku</option>
        <option value="no_longer_needed">Službu už nepotrebujem</option>
        <option value="other">Iný dôvod</option>
      </select>
    </label> : null}

    <label className="private-action-confirmation">
      <input name="confirmedReview" type="checkbox" value="yes" required disabled={pending} />
      <span>Rozumiem, že moje vyjadrenie ešte skontroluje pracovník ASTANA a až potom ho zaeviduje do zákazky.</span>
    </label>
    <button type="submit" disabled={pending}>{pending ? 'Ukladáme…' : 'Odoslať vyjadrenie'}</button>
    <p className="private-action-note">Odkaz je súkromný a jednorazový. Neobsahuje celé meno, email, telefón ani presnú adresu zákazky.</p>
    <p ref={messageRef} className={`private-action-message${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'} tabIndex={message ? -1 : undefined} aria-live={error ? 'assertive' : 'polite'}>{message}</p>
  </form>;
}
