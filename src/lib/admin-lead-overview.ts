import type { PriceOfferStatus } from '@/src/server/types';

export type LeadOfferFilter = '' | 'none' | 'prepared' | 'waiting' | 'accepted' | 'attention' | 'cancelled';

export const leadOfferFilterOptions: Array<{ value: Exclude<LeadOfferFilter, ''>; label: string; description: string }> = [
  { value: 'none', label: 'Treba vytvoriť CP', description: 'Dopyty bez cenovej ponuky' },
  { value: 'prepared', label: 'Hotová – neodoslaná', description: 'Ponuka je pripravená na kontrolu alebo odoslanie' },
  { value: 'waiting', label: 'Odoslaná alebo odložená', description: 'Čakáme na rozhodnutie alebo uložený termín kontaktu' },
  { value: 'accepted', label: 'Prijatá', description: 'Zákazník ponuku prijal' },
  { value: 'attention', label: 'Treba preveriť', description: 'Odosielanie prebieha alebo má neistý výsledok' },
  { value: 'cancelled', label: 'Neúspešná alebo zrušená', description: 'Ponuka neprešla alebo bola zrušená' },
];

export function isLeadOfferFilter(value: string | undefined): value is LeadOfferFilter {
  return value === '' || leadOfferFilterOptions.some((item) => item.value === value);
}

export function leadOfferFilterMatches(status: PriceOfferStatus | undefined, filter: LeadOfferFilter) {
  if (!filter) return true;
  if (filter === 'none') return !status;
  if (filter === 'prepared') return status === 'PRIPRAVENA';
  if (filter === 'waiting') return status === 'ODOSLANA' || status === 'ODLOZENA';
  if (filter === 'accepted') return status === 'PRIJATA';
  if (filter === 'attention') return status === 'ODOSIELA' || status === 'NEISTY_STAV';
  return status === 'NEUSPESNA' || status === 'ZRUSENA';
}

export function leadOfferPresentation(status?: PriceOfferStatus) {
  if (!status) return { state: 'none', label: 'Bez CP', detail: 'Treba vytvoriť cenovú ponuku' } as const;
  if (status === 'PRIPRAVENA') return { state: 'prepared', label: 'Hotová – neodoslaná', detail: 'Pripravená na kontrolu alebo odoslanie' } as const;
  if (status === 'ODOSLANA') return { state: 'waiting', label: 'Odoslaná – čakáme', detail: 'Čakáme na rozhodnutie zákazníka' } as const;
  if (status === 'ODLOZENA') return { state: 'waiting', label: 'Odložená', detail: 'Má naplánovaný ďalší kontakt' } as const;
  if (status === 'PRIJATA') return { state: 'accepted', label: 'Prijatá', detail: 'Zákazník ponuku prijal' } as const;
  if (status === 'NEUSPESNA') return { state: 'cancelled', label: 'Neúspešná', detail: 'Výsledok a dôvod sú zaevidované' } as const;
  if (status === 'ODOSIELA') return { state: 'attention', label: 'Odosielanie', detail: 'Odoslanie práve prebieha' } as const;
  if (status === 'NEISTY_STAV') return { state: 'attention', label: 'Overiť odoslanie', detail: 'Treba skontrolovať odoslanú poštu' } as const;
  return { state: 'cancelled', label: 'Zrušená', detail: 'Ponuka je zrušená' } as const;
}

export function leadFollowupPresentation(followupDate: string | undefined, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(followupDate || '')) return null;
  const date = followupDate!;
  const formatted = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Bratislava' })
    .format(new Date(`${date}T12:00:00Z`));
  if (date < today) return { tone: 'danger', label: `Po termíne · ${formatted}` } as const;
  if (date === today) return { tone: 'warning', label: 'Kontaktovať dnes' } as const;
  return { tone: 'neutral', label: `Kontaktovať ${formatted}` } as const;
}
