const businessTimeZone = 'Europe/Bratislava';

function businessCalendarParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return { year: Number(part('year')), month: Number(part('month')), day: Number(part('day')) };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function validDateKey(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1000 && year <= 9999 && dateKey(year, month, day) === value && month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function businessTodayKey(now = new Date()) {
  const { year, month, day } = businessCalendarParts(now);
  return dateKey(year, month, day);
}

export function businessDateKey(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return businessTodayKey(date);
}

export function isBusinessDateInPeriod(value: string | undefined, from: string, to: string) {
  const date = businessDateKey(value);
  return Boolean(date && from && to && date >= from && date <= to);
}

export function businessPeriodBounds(period: string, from?: string, to?: string, now = new Date()) {
  if (period === 'custom') {
    if (validDateKey(from) && validDateKey(to) && from! <= to!) {
      return { from: from!, to: to!, label: `${from} – ${to}`, valid: true };
    }
    return { from: '', to: '', label: 'Neplatné vlastné obdobie', valid: false };
  }

  const { year, month } = businessCalendarParts(now);
  if (period === 'year') return { from: `${year}-01-01`, to: `${year}-12-31`, label: 'Tento rok', valid: true };
  if (period === 'last-month') {
    const previous = new Date(Date.UTC(year, month - 2, 1));
    const previousYear = previous.getUTCFullYear();
    const previousMonth = previous.getUTCMonth() + 1;
    const end = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
    return { from: dateKey(previousYear, previousMonth, 1), to: dateKey(previousYear, previousMonth, end), label: 'Minulý mesiac', valid: true };
  }

  const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: dateKey(year, month, 1), to: dateKey(year, month, end), label: 'Tento mesiac', valid: true };
}
