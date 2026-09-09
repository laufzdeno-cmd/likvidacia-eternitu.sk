export type GoogleAdsOrderPrefix = 'ET' | 'AZ';

function bratislavaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bratislava', year: '2-digit', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}${value('month')}${value('day')}`;
}

export function googleAdsOrderDate(date = new Date()) { return bratislavaDateParts(date); }

export function formatGoogleAdsOrderId(prefix: GoogleAdsOrderPrefix, sequence: number, date = new Date()) {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999_999) {
    throw new Error('Poradové číslo Google Ads referencie musí byť v rozsahu 1 až 999999.');
  }
  return `AST-${prefix}-${googleAdsOrderDate(date)}-${String(sequence).padStart(6, '0')}`;
}

export function derivedGoogleAdsOrderIds(orderId: string) {
  return { form: orderId, qualified: `${orderId}-Q`, won: `${orderId}-W` } as const;
}
