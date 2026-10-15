import type { PriceOfferMaterialType } from '@/src/server/types';

export function priceOfferMaterialFromText(value: string): PriceOfferMaterialType {
  const normalized = value.trim().toLocaleLowerCase('sk');
  if (normalized.includes('vlnit')) return 'VLNITY_ETERNIT';
  if (normalized.includes('hladk') || normalized.includes('štvorc')) return 'HLADKY_ETERNIT';
  if (normalized.includes('rú') || normalized.includes('rur')) return 'AZBESTOVE_RURY';
  if (normalized.includes('bolet')) return 'BOLETICKY';
  if (normalized.includes('podhľad') || normalized.includes('podhlad')) return 'PODHLADOVE_DOSKY';
  return 'INE';
}

