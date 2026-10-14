import type { SiteContentItem } from './types';

function normalizeFaqQuestion(question: string) {
  return question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sk-SK')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function containsLegacyEarlyArrivalClaim(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sk-SK')
    .replace(/\s+/g, ' ');
  return /\b6[:.]00\b|\b6[:.]30\b|skoro rano|skory (?:prichod|vyjazd)/.test(normalized);
}

function keepWorkingHoursCurrent(savedValue: string, defaultValue: string) {
  const currentByKey = new Map(
    defaultValue
      .split('\n')
      .filter((line) => /8:00[^\n]*18:00/.test(line))
      .map((line) => [normalizeFaqQuestion(line.split('|', 1)[0] ?? ''), line]),
  );
  if (currentByKey.size === 0) return savedValue;

  return savedValue
    .split('\n')
    .map((line) => {
      if (!containsLegacyEarlyArrivalClaim(line)) return line;
      const key = normalizeFaqQuestion(line.split('|', 1)[0] ?? '');
      return currentByKey.get(key) ?? line;
    })
    .join('\n');
}

type CanonicalLegalFaq = 'notice' | 'authorization-scope';

function legalFaqKind(question: string): CanonicalLegalFaq | undefined {
  const normalized = normalizeFaqQuestion(question);
  const mentionsAuthority = normalized.includes('ruvz') || normalized.includes('urad verejneho zdravotnictva');
  const mentionsRelevantWork = /azbest|eternit|prac|demontaz|likvidac/.test(normalized);
  const explicitlyAsksAboutPermit = /\bpovolen(?:ie|ia|iu|im|i|iami|iach)\b/.test(normalized);
  const explicitlyAsksAboutAsbestosNotice = /oznam/.test(normalized)
    && /odstran/.test(normalized)
    && /azbest/.test(normalized);
  const asksAboutAuthorityDecision = /rozhod|suhlas|schval/.test(normalized) && mentionsAuthority;
  if ((explicitlyAsksAboutPermit && (mentionsAuthority || mentionsRelevantWork))
    || explicitlyAsksAboutAsbestosNotice
    || asksAboutAuthorityDecision) {
    return 'notice';
  }
  const asksAboutCompanyAuthorization = /opravnen/.test(normalized)
    && /firma|spolocnost|drzitel|rozsah|odstran/.test(normalized)
    && /azbest|eternit/.test(normalized);
  if (asksAboutCompanyAuthorization) return 'authorization-scope';
  return undefined;
}

function keepLegalFaqCurrent(savedFaq: string, defaultFaq: string) {
  const required = new Map<CanonicalLegalFaq, string>();
  defaultFaq
    .split('\n')
    .forEach((line) => {
      const kind = legalFaqKind(line.split('|', 1)[0] ?? '');
      if (kind && !required.has(kind)) required.set(kind, line);
    });

  if (required.size === 0) return savedFaq;

  const lines = savedFaq.split('\n');
  const emitted = new Set<CanonicalLegalFaq>();
  const current = lines.flatMap((line) => {
    const kind = legalFaqKind(line.split('|', 1)[0] ?? '');
    if (!kind || !required.has(kind)) return [line];
    if (emitted.has(kind)) return [];
    emitted.add(kind);
    return [required.get(kind)!];
  });

  for (const [kind, canonicalLine] of required) {
    if (!emitted.has(kind)) current.push(canonicalLine);
  }

  return current.join('\n');
}

/** Defaults fill missing keys; a statutory FAQ answer stays canonical without writing to the database. */
export function mergeSiteContent(defaults: Record<string, string>, items: SiteContentItem[]) {
  const saved = Object.fromEntries(items.map(({ key, value }) => [key, value]));
  if (typeof saved.faqItems === 'string' && typeof defaults.faqItems === 'string') {
    saved.faqItems = keepLegalFaqCurrent(saved.faqItems, defaults.faqItems);
    saved.faqItems = keepWorkingHoursCurrent(saved.faqItems, defaults.faqItems);
  }
  if (typeof saved.rooferItems === 'string' && typeof defaults.rooferItems === 'string') {
    saved.rooferItems = keepWorkingHoursCurrent(saved.rooferItems, defaults.rooferItems);
  }
  return { ...defaults, ...saved };
}
