const storageKey = 'astana:price-quote-draft:v1';
const maxDraftAgeMs = 10 * 60_000;

const leadMaterialByCalculatorKey: Record<string, string> = {
  vlnity: 'Vlnitý eternit',
  hladky: 'Hladký / štvorcový eternit',
  boleticky: 'Boletické panely',
  neviem: 'Neviem posúdiť',
};

export type PriceQuoteDraft = {
  area: number;
  material: string;
  city: string;
  createdAt: number;
};

export function createPriceQuoteDraft(areaValue: string, materialKey: string, cityValue: string, now = Date.now()): PriceQuoteDraft | null {
  const area = Number(areaValue);
  const material = leadMaterialByCalculatorKey[materialKey];
  const city = cityValue.trim().replace(/\s+/g, ' ');
  if (!Number.isInteger(area) || area < 1 || area > 500 || !material || city.length > 120) return null;
  return { area, material, city: city.length >= 2 ? city : '', createdAt: now };
}

function isPriceQuoteDraft(value: unknown, now: number): value is PriceQuoteDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<PriceQuoteDraft>;
  return Number.isInteger(draft.area) && Number(draft.area) >= 1 && Number(draft.area) <= 500
    && Object.values(leadMaterialByCalculatorKey).includes(String(draft.material))
    && typeof draft.city === 'string' && draft.city.length <= 120
    && (draft.city === '' || draft.city.trim().length >= 2)
    && typeof draft.createdAt === 'number' && now >= draft.createdAt && now - draft.createdAt <= maxDraftAgeMs;
}

export function savePriceQuoteDraft(draft: PriceQuoteDraft, storage: Pick<Storage, 'setItem'>): boolean {
  try {
    storage.setItem(storageKey, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function takePriceQuoteDraft(storage: Pick<Storage, 'getItem' | 'removeItem'>, now = Date.now()): PriceQuoteDraft | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(storageKey);
    storage.removeItem(storageKey);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPriceQuoteDraft(parsed, now) ? parsed : null;
  } catch {
    return null;
  }
}

export function applyPriceQuoteDraft(form: HTMLFormElement, draft: PriceQuoteDraft) {
  const area = form.querySelector<HTMLInputElement>('[name="areaEstimate"]');
  const material = form.querySelector<HTMLSelectElement>('[name="materialType"]');
  const city = form.querySelector<HTMLInputElement>('[name="city"]');
  if (area) area.value = String(draft.area);
  if (material && Array.from(material.options).some((option) => option.value === draft.material)) material.value = draft.material;
  if (city && draft.city) city.value = draft.city;
}
