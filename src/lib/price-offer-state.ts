import type { PriceOfferStatus } from '@/src/server/types';

export function priceOfferUpdateLifecycle(existing?: { status?: PriceOfferStatus; sentAt?: string }) {
  if (existing?.status === 'PRIJATA') {
    return { allowed: false as const, status: 'PRIJATA' as const, sentAt: existing.sentAt, requiresResend: false };
  }
  if (existing?.status === 'ODOSIELA' || existing?.status === 'NEISTY_STAV') {
    return { allowed: false as const, status: existing.status, sentAt: existing.sentAt, requiresResend: false };
  }
  const requiresResend = existing?.status === 'ODOSLANA';
  return {
    allowed: true as const,
    status: 'PRIPRAVENA' as const,
    sentAt: requiresResend ? undefined : existing?.sentAt,
    requiresResend,
  };
}
