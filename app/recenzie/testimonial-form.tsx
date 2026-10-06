'use client';

import { useRef, useState } from 'react';
import { publicTestimonialConsentWording } from '@/src/lib/testimonial-consent';

export default function TestimonialForm({ initialSubmissionId }: { initialSubmissionId: string }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const submissionId = useRef(initialSubmissionId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage('');
    setError(false);
    try {
      if (!submissionId.current) submissionId.current = crypto.randomUUID();
      const body = new FormData(form);
      body.set('submissionId', submissionId.current);
      const response = await fetch('/api/testimonial', {
        method: 'POST',
        body,
        headers: { Accept: 'application/json' },
      });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || 'Referenciu sa nepodarilo odoslať.');
      form.reset();
      submissionId.current = '';
      setMessage(result.message || 'Ďakujeme. Referenciu sme prijali na kontrolu.');
    } catch (submitError) {
      setError(true);
      setMessage(submitError instanceof Error ? submitError.message : 'Referenciu sa nepodarilo odoslať.');
    } finally {
      setPending(false);
    }
  }

  return <form className="testimonial-public-form" method="post" action="/api/testimonial" onSubmit={submit}>
    <input type="hidden" name="submissionId" value={submissionId.current} />
    <label>Meno alebo iniciály<input name="customerName" autoComplete="name" minLength={2} maxLength={120} placeholder="Napr. Ján P." required disabled={pending} /></label>
    <label>E-mail (neuverejníme)<input name="customerEmail" type="email" autoComplete="email" maxLength={160} placeholder="Voliteľné" disabled={pending} /></label>
    <label>Hodnotenie<select name="rating" defaultValue="5" disabled={pending}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} z 5</option>)}</select></label>
    <label className="testimonial-public-wide">Vaša skúsenosť<textarea name="text" minLength={20} maxLength={1200} rows={5} required placeholder="Čo sme pre vás urobili a ako prebiehala spolupráca?" disabled={pending} /></label>
    <label className="testimonial-public-honeypot" aria-hidden="true">Webová stránka<input name="website" type="text" tabIndex={-1} autoComplete="new-password" disabled={pending} /></label>
    <label className="testimonial-public-consent testimonial-public-wide"><input name="consentPublication" type="checkbox" value="on" required disabled={pending} /> {publicTestimonialConsentWording}</label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? 'Odosielam…' : 'Odoslať skúsenosť'}</button>
    <p className="testimonial-public-privacy testimonial-public-wide">Referenciu najprv skontrolujeme. Zverejníme ju až po schválení a nebudeme meniť jej význam. <a href="/ochrana-osobnych-udajov/">Ochrana osobných údajov</a></p>
    <p className={`testimonial-public-message${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">{message}</p>
  </form>;
}
