'use client';

import { useEffect, useState } from 'react';

function eur(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function readNumber(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name) as HTMLInputElement | null;
  return Number(input?.value || 0);
}

export default function QuoteLivePreview() {
  const [totals, setTotals] = useState({ withoutVat: 0, withVat: 0, margin: 0, marginPercent: 0, profitPerM2: 0 });

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>('.admin-quote-form');
    if (!form) return;

    const calculate = () => {
      const area = readNumber(form, 'areaEstimate');
      const pricePerM2 = readNumber(form, 'pricePerM2');
      const documentationFee = readNumber(form, 'documentationFee');
      const transportFee = readNumber(form, 'transportFee');
      const surcharge = readNumber(form, 'surcharge');
      const discount = readNumber(form, 'discount');
      const vatRate = readNumber(form, 'vatRate');
      const estimatedCosts = readNumber(form, 'estimatedCosts');
      const withoutVat = Math.max(0, area * pricePerM2 + documentationFee + transportFee + surcharge - discount);
      const withVat = withoutVat * (1 + vatRate / 100);
      const margin = withoutVat - estimatedCosts;
      const marginPercent = withoutVat > 0 ? (margin / withoutVat) * 100 : 0;
      const profitPerM2 = area > 0 ? margin / area : 0;
      setTotals({ withoutVat, withVat, margin, marginPercent, profitPerM2 });
    };

    form.addEventListener('input', calculate);
    calculate();
    return () => form.removeEventListener('input', calculate);
  }, []);

  return (
    <div className="admin-form-wide quote-live-preview" aria-live="polite">
      <article>
        <span>Cena bez DPH</span>
        <strong>{eur(totals.withoutVat)}</strong>
      </article>
      <article>
        <span>Cena s DPH</span>
        <strong>{eur(totals.withVat)}</strong>
      </article>
      <article>
        <span>Odhad marže</span>
        <strong>{eur(totals.margin)}</strong>
        <small>{totals.marginPercent.toFixed(1)} %</small>
      </article>
      <article>
        <span>Zisk na m2</span>
        <strong>{eur(totals.profitPerM2)}</strong>
      </article>
    </div>
  );
}
