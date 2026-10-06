export const publicTestimonialConsentVersion = 'testimonial-public-fields-v3';

export const publicTestimonialConsentWording =
  'Súhlasím so zverejnením presne týchto údajov: moje meno alebo iniciály, text skúsenosti, hodnotenie a dátum odoslania. E-mail nebude zverejnený. Tento súhlas nepokrýva zverejnenie žiadnych ďalších údajov.';

export const adminTestimonialConsentVersion = 'testimonial-admin-exact-wording-v4';
export const testimonialConsentEvidenceMaxLength = 2400;
export const adminTestimonialConsentInstruction =
  'Pri schválení uveďte presné celé znenie, ktoré zákazník odsúhlasil, nie jeho zhrnutie. Znenie aj zdroj a dátum sa uložia iba ako súkromný dôkaz súhlasu.';

export const testimonialConsentEvidenceSources = [
  'webový formulár',
  'e-mail',
  'SMS',
  'WhatsApp',
  'písomný súhlas',
  'osobne',
] as const;

export type TestimonialConsentEvidenceSource = (typeof testimonialConsentEvidenceSources)[number];

const WORDING_PREFIX = 'Presné znenie súhlasu: ';

export function formatAdminTestimonialConsentEvidence(
  wording: string,
  source: TestimonialConsentEvidenceSource,
  date: string,
  contentHash: string,
) {
  return `${WORDING_PREFIX}${wording.trim()}\nOdtlačok schváleného znenia: ${contentHash}\nZdroj súhlasu: ${source}; dátum súhlasu: ${date}.`;
}

export function bindPublicTestimonialConsent(contentHash: string) {
  return `${publicTestimonialConsentWording}\nOdtlačok schváleného znenia: ${contentHash}`;
}

function isValidConsentDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);
  return Number.isFinite(date.getTime())
    && date.toISOString().slice(0, 10) === value
    && value >= '2000-01-01'
    && value <= today;
}

export function isValidAdminTestimonialConsentEvidence(value: string, expectedContentHash?: string) {
  const marker = '\nOdtlačok schváleného znenia: ';
  const markerIndex = value.indexOf(marker);
  if (markerIndex < WORDING_PREFIX.length) return false;
  const wording = value.slice(WORDING_PREFIX.length, markerIndex).trim();
  if (wording.length < 10 || wording.length > 2000) return false;
  const metadata = value.slice(markerIndex + marker.length);
  const match = /^([a-f0-9]{64})\nZdroj súhlasu: (webový formulár|e-mail|SMS|WhatsApp|písomný súhlas|osobne); dátum súhlasu: (\d{4}-\d{2}-\d{2})\.$/u.exec(metadata);
  if (!match) return false;
  return (!expectedContentHash || match[1] === expectedContentHash) && isValidConsentDate(match[3]);
}

export function parseAdminTestimonialConsentEvidence(value: string, expectedContentHash?: string) {
  if (!isValidAdminTestimonialConsentEvidence(value, expectedContentHash)) return null;
  const marker = '\nOdtlačok schváleného znenia: ';
  const markerIndex = value.indexOf(marker);
  const metadata = value.slice(markerIndex + marker.length);
  const match = /^[a-f0-9]{64}\nZdroj súhlasu: (webový formulár|e-mail|SMS|WhatsApp|písomný súhlas|osobne); dátum súhlasu: (\d{4}-\d{2}-\d{2})\.$/u.exec(metadata);
  if (!match) return null;
  return {
    wording: value.slice(WORDING_PREFIX.length, markerIndex).trim(),
    source: match[1] as TestimonialConsentEvidenceSource,
    date: match[2],
  };
}
