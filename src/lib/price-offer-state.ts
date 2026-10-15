import type { PriceOfferStatus } from '@/src/server/types';

export function priceOfferUpdateLifecycle(existing?: { status?: PriceOfferStatus; sentAt?: string }) {
  if (existing?.status === 'PRIJATA' || existing?.status === 'ODOSLANA' || existing?.status === 'ODLOZENA' || existing?.status === 'NEUSPESNA') {
    return { allowed: false as const, status: existing.status, sentAt: existing.sentAt, requiresResend: false };
  }
  if (existing?.status === 'ODOSIELA' || existing?.status === 'NEISTY_STAV') {
    return { allowed: false as const, status: existing.status, sentAt: existing.sentAt, requiresResend: false };
  }
  return {
    allowed: true as const,
    status: 'PRIPRAVENA' as const,
    sentAt: existing?.sentAt,
    requiresResend: false,
  };
}
