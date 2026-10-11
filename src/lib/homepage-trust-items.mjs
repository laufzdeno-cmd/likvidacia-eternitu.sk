import { transportPolicy } from '../content/transport-policy.mjs';

const currentTransportDisclosure = [transportPolicy.title, transportPolicy.full];
const approvedCoverageText = 'Zákazky riešime po celom Slovensku podľa rozsahu a kapacity.';
const knownLegacyTransportClaims = new Set([
  'doprava nad 100 m2 zdarma|pri väčších zákazkách dopravu neúčtujeme',
  'doprava|pri väčších zákazkách dopravu neúčtujeme',
  'doprava po slovensku od 100 m2|pri ploche od 100 m2 dopravu po slovensku neúčtujeme',
  'doprava podľa zákazky|prípadná doprava je samostatne uvedená v cenovej ponuke',
]);

/** Keep historical transport wording in editable content aligned with the approved policy. */
export function normalizeHomepageCoverageText(value) {
  const normalized = normalizeLegacyText(value);
  if (
    normalized.includes('doprava nad 100 m2 zdarma')
    || normalized.includes('pri väčších zákazkách dopravu neúčtujeme')
    || normalized.includes('pri ploche od 100 m2 dopravu po slovensku neúčtujeme')
    || normalized.includes('prípadná doprava je samostatne uvedená v cenovej ponuke')
  ) {
    return transportPolicy.full;
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

/** Normalize historical transport copy to the approved threshold policy. */
export function filterHomepageTrustItems(items) {
  const normalized = [];
  let hasTransportClaim = false;

  for (const [title, text] of items) {
    const normalizedPair = `${normalizeLegacyText(title)}|${normalizeLegacyText(text)}`;
    if (knownLegacyTransportClaims.has(normalizedPair)) {
      if (!hasTransportClaim) normalized.push(currentTransportDisclosure);
      hasTransportClaim = true;
      continue;
    }

    if (normalizedPair === `${normalizeLegacyText(currentTransportDisclosure[0])}|${normalizeLegacyText(currentTransportDisclosure[1])}`) {
      if (!hasTransportClaim) normalized.push(currentTransportDisclosure);
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
