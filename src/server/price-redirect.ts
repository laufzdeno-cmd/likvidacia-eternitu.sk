export function priceRedirectTarget(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const normalizedKey = key.toLowerCase();
    const isUtmParameter = /^utm_(source|medium|campaign|content|term|id)$/.test(normalizedKey);
    const isClickId = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'].includes(normalizedKey);
    const quoteParameterLimits: Record<string, number> = {
      material: 40, meta_material: 40, area: 12, m2: 12, plocha: 120, city: 120, mesto: 120, cta: 40,
    };
    const quoteParameterLimit = quoteParameterLimits[normalizedKey];
    if (!isUtmParameter && !isClickId && !quoteParameterLimit) continue;

    const selectedValue = Array.isArray(value) ? value[0] : value;
    if (!query.has(normalizedKey) && typeof selectedValue === 'string' && selectedValue.length > 0) {
      query.set(normalizedKey, selectedValue.slice(0, isUtmParameter ? 200 : isClickId ? 512 : quoteParameterLimit));
    }
  }

  const serialized = query.toString();
  return `/cena-likvidacie-azbestu/${serialized ? `?${serialized}` : ''}`;
}
