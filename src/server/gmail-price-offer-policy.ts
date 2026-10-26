export const gmailPriceOfferMaxAttempts = 8;

export function normalizeRfc822MessageId(value: unknown) {
  const normalized = String(value || '').trim();
  if (!/^<[^<>\s@]{1,160}@[A-Za-z0-9.-]{1,190}>$/.test(normalized) || normalized.length > 360) return '';
  return normalized;
}

export function gmailMessageSearchQuery(messageId: string) {
  const normalized = normalizeRfc822MessageId(messageId);
  if (!normalized) throw new Error('Neplatný Message-ID pre Gmail označenie.');
  return `in:sent rfc822msgid:${normalized.slice(1, -1)}`;
}

export function gmailRetryDelayMinutes(attempts: number) {
  const sequence = [2, 5, 10, 20, 45, 90, 180, 360];
  return sequence[Math.max(0, Math.min(sequence.length - 1, attempts - 1))];
}

export function gmailErrorCode(value: unknown) {
  const code = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_:-]/g, '_').slice(0, 80);
  return code || 'unknown_error';
}
