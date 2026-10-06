export const MAX_PRICE_OFFER_NOTE_LENGTH = 500;

export function validatePriceOfferNote(value: unknown): string {
  const note = typeof value === 'string' ? value.trim() : '';
  if (note.length > MAX_PRICE_OFFER_NOTE_LENGTH) {
    throw new Error(`Poznámka v cenovej ponuke môže mať najviac ${MAX_PRICE_OFFER_NOTE_LENGTH} znakov.`);
  }
  return note;
}
