const approvedTransportClaim = ['Doprava po Slovensku od 100 m²', 'Pri ploche od 100 m² dopravu po Slovensku neúčtujeme.'];
const approvedCoverageText = 'Zákazky riešime po celom Slovensku podľa rozsahu a kapacity.';
const knownLegacyTransportClaims = new Set([
  'doprava nad 100 m2 zdarma|pri väčších zákazkách dopravu neúčtujeme',
  'doprava|pri väčších zákazkách dopravu neúčtujeme',
]);

/** Replace the known historical transport wording if it was saved in the editable coverage card. */
export function normalizeHomepageCoverageText(value) {
  const normalized = normalizeLegacyText(value);
  if (
    normalized.includes('doprava nad 100 m2 zdarma')
    || normalized.includes('pri väčších zákazkách dopravu neúčtujeme')
  ) {
    return approvedTransportClaim[1];
  }
  return value;
}

function normalizeLegacyText(value) {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('sk')
    .replace(/²/g, '2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!…]+$/u, '');
}

/** Normalize historical transport copy to the company-approved threshold and wording. */
export function filterHomepageTrustItems(items) {
  const normalized = [];
  let hasTransportClaim = false;

  for (const [title, text] of items) {
    const normalizedPair = `${normalizeLegacyText(title)}|${normalizeLegacyText(text)}`;
    if (knownLegacyTransportClaims.has(normalizedPair)) {
      if (!hasTransportClaim) normalized.push(approvedTransportClaim);
      hasTransportClaim = true;
      continue;
    }

    if (normalizedPair === `${normalizeLegacyText(approvedTransportClaim[0])}|${normalizeLegacyText(approvedTransportClaim[1])}`) {
      if (!hasTransportClaim) normalized.push(approvedTransportClaim);
      hasTransportClaim = true;
      continue;
    }

    normalized.push(
      title.trim().toLocaleLowerCase('sk') === 'od roku 2011'
        ? ['Firma ASTANA pôsobí od roku 2011', 'Pôsobíme na trhu od roku 2011.']
        : [title, text],
    );
  }

  return normalized;
}
