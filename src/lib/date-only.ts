const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function calendarPartsInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
  return { year: Number(part('year')), month: Number(part('month')), day: Number(part('day')) };
}

export function slovakCalendarDateAfterDays(days: number, now = new Date()) {
  if (!Number.isSafeInteger(days)) throw new TypeError('Počet dní musí byť celé číslo.');
  const { year, month, day } = calendarPartsInTimeZone(now, 'Europe/Bratislava');
  if (!year || !month || !day) throw new TypeError('Slovenský kalendárny dátum sa nepodarilo určiť.');
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function isValidIsoCalendarDate(value: string) {
  const match = ISO_DATE_ONLY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}
