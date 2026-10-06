export type PriceOfferPricingInput = {
  areaM2: number;
  pricePerM2WithoutVat: number;
  documentationFeeWithoutVat: number;
  includeDocumentation: boolean;
  documentationPromotion: boolean;
  includeTransport: boolean;
  transportRoundTripKm: number;
  transportPricePerKm: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePriceOfferPricing(input: PriceOfferPricingInput, vatRate: number) {
  const materialPriceWithoutVat = money(input.areaM2 * input.pricePerM2WithoutVat);
  const documentationWithoutVat = input.includeDocumentation && !input.documentationPromotion
    ? money(input.documentationFeeWithoutVat)
    : 0;
  const transportWithoutVat = input.includeTransport
    ? money(input.transportRoundTripKm * input.transportPricePerKm)
    : 0;
  const totalWithoutVat = money(materialPriceWithoutVat + documentationWithoutVat + transportWithoutVat);
  const totalWithVat = money(totalWithoutVat * (1 + vatRate / 100));
  return { materialPriceWithoutVat, documentationWithoutVat, transportWithoutVat, totalWithoutVat, totalWithVat };
}

export function reconcilePriceOfferGrossLines(input: {
  materialWithoutVat: number;
  documentationWithoutVat: number;
  transportWithoutVat: number;
  vatRate: number;
  includeDocumentation: boolean;
  documentationPromotion: boolean;
  includeTransport: boolean;
  totalWithVat: number;
}) {
  const multiplier = 1 + input.vatRate / 100;
  const materialWithVat = money(input.materialWithoutVat * multiplier);
  const documentationWithVat = money(input.documentationWithoutVat * multiplier);
  const transportWithVat = money(input.transportWithoutVat * multiplier);
  const adjustment = money(input.totalWithVat - materialWithVat - documentationWithVat - transportWithVat);
  const adjustTransport = input.includeTransport;
  const adjustDocumentation = !adjustTransport && input.includeDocumentation && !input.documentationPromotion;
  return {
    materialWithVat: !adjustTransport && !adjustDocumentation ? money(materialWithVat + adjustment) : materialWithVat,
    documentationWithVat: adjustDocumentation ? money(documentationWithVat + adjustment) : documentationWithVat,
    transportWithVat: adjustTransport ? money(transportWithVat + adjustment) : transportWithVat,
  };
}
