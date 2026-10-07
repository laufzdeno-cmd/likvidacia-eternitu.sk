export function priceOfferNumberYear(instant = new Date()) {
  const year = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Bratislava',
    year: 'numeric',
  }).format(instant);
  if (!/^\d{4}$/.test(year)) throw new Error('Rok cenovej ponuky sa nepodarilo určiť.');
  return year;
}
