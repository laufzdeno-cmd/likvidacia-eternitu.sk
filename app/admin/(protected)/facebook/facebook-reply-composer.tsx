'use client';

import { useState } from 'react';
import { sendFacebookReplyAction } from './actions';

const templates = [
  {
    label: 'Údaje k naceneniu',
    text: 'Dobrý deň, ďakujeme za správu. Aby sme vedeli pripraviť orientačné nacenenie, pošlite nám prosím obec, približnú výmeru v m² a fotografie strechy alebo materiálu.',
  },
  {
    label: 'Potvrdenie prijatia',
    text: 'Dobrý deň, ďakujeme za doplnenie údajov. Správu sme prijali a po kontrole podkladov sa vám ozveme s ďalším postupom.',
  },
  {
    label: 'Kontakt',
    text: 'Dobrý deň, pre presnejšie posúdenie nám prosím pošlite telefónne číslo a čas, kedy vám môžeme zavolať.',
  },
];

export default function FacebookReplyComposer({
  conversationId,
  csrfToken,
  clientRequestId,
  disabled,
}: {
  conversationId: string;
  csrfToken: string;
  clientRequestId: string;
  disabled: boolean;
}) {
  const [message, setMessage] = useState('');
  return (
    <form action={sendFacebookReplyAction} className="facebook-composer">
      <input type="hidden" name="_csrf" value={csrfToken} />
      <input type="hidden" name="id" value={conversationId} />
      <input type="hidden" name="clientRequestId" value={clientRequestId} />
      <div className="facebook-template-row" aria-label="Pripravené odpovede">
        {templates.map((template) => (
          <button key={template.label} type="button" onClick={() => setMessage(template.text)} disabled={disabled}>
            {template.label}
          </button>
        ))}
      </div>
      <label htmlFor="facebook-message">Skontrolovaná odpoveď</label>
      <textarea
        id="facebook-message"
        name="message"
        rows={6}
        maxLength={2000}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Napíšte odpoveď alebo si vyberte pripravený návrh…"
        required
        disabled={disabled}
      />
      <div className="facebook-composer-footer">
        <span>{message.length} / 2 000 znakov</span>
        <button className="admin-primary-button" type="submit" disabled={disabled || !message.trim()}>
          Skontrolovať a odoslať
        </button>
      </div>
      <small>Asistent text iba pripraví. Správa sa odošle až po vašom kliknutí.</small>
    </form>
  );
}
