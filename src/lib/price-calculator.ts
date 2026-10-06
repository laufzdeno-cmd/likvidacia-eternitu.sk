import { applyPriceQuoteDraft, createPriceQuoteDraft, savePriceQuoteDraft } from './price-quote-prefill';

type PriceAnalytics = (event: string, properties: Record<string, string>) => void;

const priceRates: Record<string, { min: number; max: number }> = {
  vlnity: { min: 8, max: 14 },
  plocha: { min: 9, max: 15 },
  boleticky: { min: 11, max: 18 },
  neviem: { min: 8, max: 16 },
};

const materialAliases: Record<string, string> = {
  hladky: 'plocha',
};

function applyCampaignPrefill(areaInput: HTMLInputElement, cityInput: HTMLInputElement | null, materialButtons: HTMLButtonElement[]) {
  let params: URLSearchParams;
  try { params = new URLSearchParams(window.location.search); } catch { return; }
  const plochaParam = params.get('plocha');
  const areaValue = params.get('area') ?? params.get('m2') ?? (plochaParam && /^\d+$/.test(plochaParam) ? plochaParam : null);
  const cityValue = params.get('city') ?? params.get('mesto');
  const rawMaterial = (params.get('material') ?? params.get('meta_material') ?? (plochaParam && !/^\d+$/.test(plochaParam) ? plochaParam : '')).trim().toLowerCase();
  const materialKey = ({
    vlnity: 'vlnity', vlnity_eternit: 'vlnity', plocha: 'hladky', hladky: 'hladky',
    hladky_eternit: 'hladky', boleticky: 'boleticky', neviem: 'neviem',
  } as Record<string, string>)[rawMaterial];

  if (areaValue && /^(?:[1-9]\d{0,2}|500)$/.test(areaValue)) areaInput.value = areaValue;
  if (cityInput && cityValue) cityInput.value = cityValue.slice(0, 120);
  if (!materialKey) return;
  const selected = materialButtons.find((button) => button.dataset.priceMaterial === materialKey);
  if (!selected) return;
  materialButtons.forEach((button) => {
    const active = button === selected;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

const formatPrice = (value: number) =>
  `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 }).format(Math.round(value / 10) * 10)} €`;

/** Binds every rendered estimate calculator to one consistent set of rates and interactions. */
export function initializePriceCalculators(trackAnalytics?: PriceAnalytics) {
  const calculators = Array.from(document.querySelectorAll<HTMLElement>('[data-price-calculator], .price-calculator'));
  const cleanups: Array<() => void> = [];

  calculators.forEach((calculator) => {
    const areaInput = calculator.querySelector<HTMLInputElement>('[data-price-area]');
    const areaOutput = calculator.querySelector<HTMLOutputElement>('[data-price-area-output]');
    const minOutput = calculator.querySelector<HTMLElement>('[data-price-min]');
    const maxOutput = calculator.querySelector<HTMLElement>('[data-price-max]');
    const cityInput = calculator.querySelector<HTMLInputElement>('[data-price-city]');
    const quoteLink = calculator.querySelector<HTMLAnchorElement>('[data-price-quote]');
    const transferStatus = calculator.querySelector<HTMLElement>('[data-price-transfer-status]');
    const materialButtons = Array.from(calculator.querySelectorAll<HTMLButtonElement>('[data-price-material]'));
    if (!areaInput || !areaOutput || !minOutput || !maxOutput) return;

    applyCampaignPrefill(areaInput, cityInput, materialButtons);
    const selectedMaterial = materialButtons.find((button) => button.classList.contains('is-active'))?.dataset.priceMaterial || 'vlnity';
    let activeMaterial = materialAliases[selectedMaterial] || selectedMaterial;

    const update = () => {
      const area = Number(areaInput.value);
      const rates = priceRates[activeMaterial] || priceRates.vlnity;
      areaOutput.textContent = `${area} m2`;
      minOutput.textContent = formatPrice(area * rates.min);
      maxOutput.textContent = formatPrice(area * rates.max);
    };

    const onAreaInput = () => update();
    const onAreaChange = () => {
      update();
      trackAnalytics?.('price_calculator_change', { material: activeMaterial, area: areaInput.value });
    };
    const onMaterialClick = (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const rawMaterial = button.dataset.priceMaterial || 'vlnity';
      activeMaterial = materialAliases[rawMaterial] || rawMaterial;
      materialButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      update();
      trackAnalytics?.('price_calculator_change', { material: activeMaterial, area: areaInput.value });
    };
    const onQuoteClick = (event: Event) => {
      const selectedKey = materialButtons.find((button) => button.classList.contains('is-active'))?.dataset.priceMaterial || 'vlnity';
      const draft = createPriceQuoteDraft(areaInput.value, selectedKey, cityInput?.value || '');
      if (!draft) return;
      const form = document.querySelector<HTMLFormElement>('.lead-form');
      if (form) applyPriceQuoteDraft(form, draft);
      else {
        let saved = false;
        try { saved = savePriceQuoteDraft(draft, window.sessionStorage); } catch { /* Storage can be unavailable in restricted browsers. */ }
        if (!saved) {
          event.preventDefault();
          if (transferStatus) transferStatus.hidden = false;
        }
      }
    };

    areaInput.addEventListener('input', onAreaInput);
    areaInput.addEventListener('change', onAreaChange);
    materialButtons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(button.classList.contains('is-active') || (!materialButtons.some((item) => item.classList.contains('is-active')) && index === 0)));
      button.addEventListener('click', onMaterialClick);
    });
    quoteLink?.addEventListener('click', onQuoteClick);
    update();
    cleanups.push(() => {
      areaInput.removeEventListener('input', onAreaInput);
      areaInput.removeEventListener('change', onAreaChange);
      materialButtons.forEach((button) => button.removeEventListener('click', onMaterialClick));
      quoteLink?.removeEventListener('click', onQuoteClick);
    });
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}
