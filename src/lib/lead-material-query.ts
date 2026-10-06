const campaignMaterialValues: Record<string, string> = {
  vlnity: 'Vlnitý eternit',
  plocha: 'Hladký / štvorcový eternit',
  boleticky: 'Boletické panely',
};

export function leadMaterialFromCampaignParam(value: string | null) {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  return Object.hasOwn(campaignMaterialValues, key) ? campaignMaterialValues[key] : undefined;
}
