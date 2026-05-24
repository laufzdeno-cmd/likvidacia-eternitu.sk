'use client';

import { useMemo, useState } from 'react';

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('421')) return digits;
  if (digits.startsWith('0')) return `421${digits.slice(1)}`;
  return digits ? `421${digits}` : '';
}

export default function ReviewRequestTools({ defaultLink }: { defaultLink: string }) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState(defaultLink);
  const [copied, setCopied] = useState(false);

  const message = useMemo(
    () =>
      `Dobrý deň ${customerName || '[meno]'}, ďakujeme za dôveru pri likvidácii azbestu${
        location ? ` v ${location}` : ' v [lokalita]'
      }. Ak ste boli spokojní, veľmi by nám pomohla recenzia na Google — trvá 2 minúty: ${link || '[link]'}\nĎakujeme, tím ASTANA`,
    [customerName, location, link],
  );
  const whatsappUrl = `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="admin-review-builder">
      <div className="admin-quote-form">
        <label>
          Meno zákazníka
          <input name="customerName" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
        </label>
        <label>
          Telefón
          <input name="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </label>
        <label>
          Lokalita
          <input name="location" placeholder="napr. Košice" value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
        <label>
          Typ objektu
          <select name="objectType" defaultValue="Rodinný dom">
            <option>Rodinný dom</option>
            <option>Hospodárska budova</option>
            <option>Garáž</option>
            <option>Priemyselný objekt</option>
          </select>
        </label>
        <label>
          Dátum realizácie
          <input name="realizationDate" type="date" />
        </label>
        <label>
          Google review link
          <input name="googleReviewLink" placeholder="vlož GBP odkaz" value={link} onChange={(event) => setLink(event.target.value)} required />
        </label>
      </div>
      <label className="admin-form-wide">
        Vygenerovaná správa
        <textarea readOnly rows={5} value={message} />
      </label>
      <div className="admin-action-row">
        <button className="admin-primary-button" type="button" onClick={copyMessage}>
          {copied ? 'Skopírované' : 'Kopírovať správu'}
        </button>
        <a className="admin-primary-link" href={whatsappUrl} target="_blank" rel="noopener">
          Otvoriť WhatsApp
        </a>
      </div>
    </div>
  );
}
