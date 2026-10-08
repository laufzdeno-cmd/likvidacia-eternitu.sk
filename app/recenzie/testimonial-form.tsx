'use client';

import { useEffect, useRef, useState } from 'react';
import { publicTestimonialConsentWording } from '@/src/lib/testimonial-consent';

export default function TestimonialForm({ initialSubmissionId }: { initialSubmissionId: string }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const submissionId = useRef(initialSubmissionId);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (message && !error && !pending) messageRef.current?.focus({ preventScroll: true });
  }, [error, message, pending]);

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
      const response = await fetch('/api/testimonial', {
        method: 'POST',
        body,
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.message || 'Referenciu sa nepodarilo odoslať.');
      form.reset();
      submissionId.current = '';
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

  return <form className="testimonial-public-form" method="post" action="/api/testimonial" onSubmit={submit} aria-busy={pending}>
    <input type="hidden" name="submissionId" value={submissionId.current} />
    <label>Meno alebo iniciály<input name="customerName" autoComplete="name" minLength={2} maxLength={120} placeholder="Napr. Ján P." required disabled={pending} /></label>
    <label>E-mail (neuverejníme)<input name="customerEmail" type="email" autoComplete="email" maxLength={160} placeholder="Voliteľné" disabled={pending} /></label>
    <label>Hodnotenie<select name="rating" defaultValue="5" disabled={pending}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} z 5</option>)}</select></label>
    <label className="testimonial-public-wide">Vaša skúsenosť<textarea name="text" minLength={20} maxLength={1200} rows={5} required placeholder="Čo sme pre vás urobili a ako prebiehala spolupráca?" disabled={pending} /></label>
    <label className="testimonial-public-honeypot" aria-hidden="true">Webová stránka<input name="website" type="text" tabIndex={-1} autoComplete="new-password" disabled={pending} /></label>
    <label className="testimonial-public-consent testimonial-public-wide"><input name="consentPublication" type="checkbox" value="on" required disabled={pending} /> {publicTestimonialConsentWording}</label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? 'Odosielame…' : 'Odoslať skúsenosť'}</button>
    <p className="testimonial-public-privacy testimonial-public-wide">Referenciu najprv skontrolujeme. Zverejníme ju až po schválení a nebudeme meniť jej význam. <a href="/ochrana-osobnych-udajov/">Ochrana osobných údajov</a></p>
    <p
      ref={messageRef}
      className={`testimonial-public-message${error ? ' is-error' : ''}`}
      role={error ? 'alert' : 'status'}
      aria-live={error ? 'assertive' : 'polite'}
      aria-atomic="true"
      tabIndex={message && !error && !pending ? -1 : undefined}
    >
      {message}
    </p>
  </form>;
}
