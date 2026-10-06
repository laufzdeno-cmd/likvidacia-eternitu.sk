import type { SiteContentItem } from './types';

function normalizeFaqQuestion(question: string) {
  return question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sk-SK')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isLegalFaqQuestion(question: string) {
  const normalized = normalizeFaqQuestion(question);
  const concernsLegalAction = /povol|rozhod|oznam|suhlas|schval/.test(normalized);
  const mentionsAuthority = normalized.includes('ruvz') || normalized.includes('urad verejneho zdravotnictva');
  const mentionsRelevantWork = /azbest|eternit|prac|demontaz|likvidac/.test(normalized);
  return concernsLegalAction && (mentionsAuthority || mentionsRelevantWork);
}

function keepLegalFaqCurrent(savedFaq: string, defaultFaq: string) {
  const required = defaultFaq
    .split('\n')
    .filter((line) => {
      return isLegalFaqQuestion(line.split('|', 1)[0] ?? '');
    });

  if (required.length === 0) return savedFaq;

  const canonicalLine = required[0];
  const lines = savedFaq.split('\n');
  const matchingIndexes = lines.flatMap((line, index) =>
    isLegalFaqQuestion(line.split('|', 1)[0] ?? '') ? [index] : []);

  if (matchingIndexes.length === 0) return [...lines, canonicalLine].join('\n');

  const firstMatchingIndex = matchingIndexes[0];
  return lines
    .filter((line, index) => !isLegalFaqQuestion(line.split('|', 1)[0] ?? '') || index === firstMatchingIndex)
    .map((line, index) => index === firstMatchingIndex ? canonicalLine : line)
    .join('\n');
}

/** Defaults fill missing keys; a statutory FAQ answer stays canonical without writing to the database. */
export function mergeSiteContent(defaults: Record<string, string>, items: SiteContentItem[]) {
  const saved = Object.fromEntries(items.map(({ key, value }) => [key, value]));
  if (typeof saved.faqItems === 'string' && typeof defaults.faqItems === 'string') {
    saved.faqItems = keepLegalFaqCurrent(saved.faqItems, defaults.faqItems);
  }
  return { ...defaults, ...saved };
}
