import type { PriceOfferMaterialType, PriceOfferStatus } from '@/src/server/types';

export const priceOfferMaterialLabels: Record<PriceOfferMaterialType, string> = {
  VLNITY_ETERNIT: 'Vlnitý eternit (AZC)',
  HLADKY_ETERNIT: 'Hladký eternit',
  AZBESTOVE_RURY: 'Azbestové rúry',
  PODHLADOVE_DOSKY: 'Podhľadové dosky',
  BOLETICKY: 'Boletické panely',
  INE: 'Iné',
};

export const priceOfferStatuses: PriceOfferStatus[] = ['PRIPRAVENA', 'ODOSLANA', 'PRIJATA', 'ZRUSENA'];

export const priceOfferStatusLabels: Record<PriceOfferStatus, string> = {
  PRIPRAVENA: 'Pripravená',
  ODOSLANA: 'Odoslaná',
  PRIJATA: 'Prijatá',
  ZRUSENA: 'Zrušená',
};

export function euro(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value || 0);
}
