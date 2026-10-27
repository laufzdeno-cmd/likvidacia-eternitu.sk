'use client';

import { useEffect, useRef, useState } from 'react';
import { publicTestimonialConsentWording } from '@/src/lib/testimonial-consent';

export default function TestimonialForm({
  initialSubmissionId,
  requestToken = '',
  initialCustomerName = '',
  googleReviewLink = '',
}: {
  initialSubmissionId: string;
  requestToken?: string;
  initialCustomerName?: string;
  googleReviewLink?: string;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [submittedGoogleLink, setSubmittedGoogleLink] = useState('');
  const submissionId = useRef(initialSubmissionId);
  const interactionAttempted = useRef(false);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (message && !pending) messageRef.current?.focus({ preventScroll: true });
  }, [error, message, pending]);

  function recordInteraction() {
    if (!requestToken || interactionAttempted.current) return;
    interactionAttempted.current = true;
    void fetch('/api/testimonial/interaction/', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token: requestToken }),
    }).catch(() => undefined);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage('Odosielame…');
    setError(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      if (!submissionId.current) submissionId.current = crypto.randomUUID();
      const body = new FormData(form);
      body.set('submissionId', submissionId.current);
      if (requestToken) body.set('requestToken', requestToken);
      const response = await fetch('/api/testimonial', {
        method: 'POST',
        body,
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; message?: string; googleReviewLink?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.message || 'Referenciu sa nepodarilo odoslať.');
      form.reset();
      submissionId.current = '';
      setSubmittedGoogleLink(result.googleReviewLink || googleReviewLink);
      setMessage(result.message || 'Ďakujeme. Referenciu sme prijali na kontrolu.');
    } catch (submitError) {
      setError(true);
      setMessage(submitError instanceof Error && submitError.name === 'AbortError'
        ? 'Odoslanie trvá príliš dlho. Skúste to prosím znova.'
        : submitError instanceof Error ? submitError.message : 'Referenciu sa nepodarilo odoslať.');
    } finally {
      window.clearTimeout(timeout);
      setPending(false);
    }
  }

  return <form
    className="testimonial-public-form"
    method="post"
    action="/api/testimonial"
    onSubmit={submit}
    onPointerDownCapture={recordInteraction}
    onKeyDownCapture={recordInteraction}
    onFocusCapture={recordInteraction}
    onInputCapture={recordInteraction}
    aria-busy={pending}
  >
    <input type="hidden" name="submissionId" value={submissionId.current} />
    {requestToken ? <input type="hidden" name="requestToken" value={requestToken} /> : null}
    <label>Meno alebo iniciály<input name="customerName" autoComplete="name" minLength={2} maxLength={120} placeholder="Napr. Ján P." defaultValue={initialCustomerName} required disabled={pending} /></label>
    {requestToken
      ? <p className="testimonial-public-privacy">E-mail je bezpečne prevzatý z osobného odkazu a nezverejní sa.</p>
      : <label>E-mail (neuverejníme)<input name="customerEmail" type="email" autoComplete="email" maxLength={160} placeholder="Voliteľné" disabled={pending} /></label>}
    <fieldset className="testimonial-star-rating" disabled={pending}>
      <legend>Hodnotenie</legend>
      <div className="testimonial-star-options">
        {[1, 2, 3, 4, 5].map(rating => (
          <label className="testimonial-star-option" key={rating}>
            <input type="radio" name="rating" value={rating} defaultChecked={rating === 5} required disabled={pending}
              aria-label={`${rating} ${rating === 1 ? 'hviezdička' : rating === 5 ? 'hviezdičiek' : 'hviezdičky'}`} />
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3Z" />
            </svg>
          </label>
        ))}
      </div>
    </fieldset>
    <label className="testimonial-public-wide">Vaša skúsenosť<textarea name="text" minLength={20} maxLength={1200} rows={5} required placeholder="Čo sme pre vás urobili a ako prebiehala spolupráca?" disabled={pending} /></label>
    <label className="testimonial-public-honeypot" aria-hidden="true">Webová stránka<input name="website" type="text" tabIndex={-1} autoComplete="new-password" disabled={pending} /></label>
    <label className="testimonial-public-consent testimonial-public-wide"><input name="consentPublication" type="checkbox" value="on" required disabled={pending} /><span>{publicTestimonialConsentWording}</span></label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? 'Odosielame…' : 'Odoslať skúsenosť'}</button>
    <p className="testimonial-public-privacy testimonial-public-wide">Referenciu najprv skontrolujeme. Zverejníme ju až po schválení a nebudeme meniť jej význam. <a href="/ochrana-osobnych-udajov/">Ochrana osobných údajov</a></p>
    <p
      ref={messageRef}
      className={`testimonial-public-message${error ? ' is-error' : ''}`}
      role={error ? 'alert' : 'status'}
      aria-live={error ? 'assertive' : 'polite'}
      aria-atomic="true"
      tabIndex={message && !pending ? -1 : undefined}
    >
      {message}
    </p>
    {submittedGoogleLink && !error ? <p className="testimonial-public-wide testimonial-public-google">
      Ak chcete, svoju skúsenosť môžete rovnakým spôsobom pridať aj na Google. Túto možnosť ponúkame všetkým zákazníkom bez ohľadu na hodnotenie.{' '}
      <a href={submittedGoogleLink} target="_blank" rel="noopener noreferrer">Pridať Google hodnotenie</a>
    </p> : null}
  </form>;
}
