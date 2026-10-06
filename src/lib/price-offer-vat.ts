export function resolvePriceOfferVatRate(
  input: { vatRate?: number | string | null; totalWithoutVat: number; totalWithVat: number },
  fallback = 23,
) {
  const storedRate = typeof input.vatRate === 'string' && input.vatRate.trim() !== ''
    ? Number(input.vatRate)
    : input.vatRate;
  if (typeof storedRate === 'number' && Number.isFinite(storedRate) && storedRate >= 0 && storedRate <= 100) {
    return Math.round(storedRate * 100) / 100;
  }
  if (input.totalWithoutVat > 0 && input.totalWithVat >= input.totalWithoutVat) {
    const inferred = (input.totalWithVat / input.totalWithoutVat - 1) * 100;
    if (Number.isFinite(inferred) && inferred >= 0 && inferred <= 100) return Math.round(inferred * 100) / 100;
  }
  return fallback;
}
