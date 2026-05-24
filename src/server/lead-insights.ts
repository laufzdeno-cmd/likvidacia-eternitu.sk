import type { Lead, LeadStatus } from './types';

export type LeadTag =
  | 'chyba_fotka'
  | 'potrebuje_strechara'
  | 'urgentne'
  | 'nad_100_m2'
  | 'pripravene_na_nacenenie';

export type LeadInsight = {
  ageHours: number;
  fileCount: number;
  quoteCount: number;
  qualityScore: number;
  tags: LeadTag[];
};

export const tagLabels: Record<LeadTag, string> = {
  chyba_fotka: 'chýbajú fotky',
  potrebuje_strechara: 'potrebuje strechára',
  urgentne: 'urgentné',
  nad_100_m2: 'nad 100 m²',
  pripravene_na_nacenenie: 'pripravené na nacenenie',
};

export const statusLabels: Record<LeadStatus, string> = {
  novy: 'nový',
  kontaktovany: 'kontaktovaný',
  caka_na_doplnenie: 'čaká na doplnenie',
  naceneny: 'nacenený',
  cenova_ponuka_odoslana: 'cenová ponuka odoslaná',
  objednane: 'objednané',
  v_realizacii: 'v realizácii',
  dokoncena: 'dokončená',
  zrusena: 'zrušená',
  nevyslo: 'nevyšlo',
  archivovane: 'archivované',
};

function normalized(value?: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function getLeadInsight(lead: Lead, fileCount = 0, quoteCount = 0): LeadInsight {
  const ageHours = Math.max(0, Math.round((Date.now() - new Date(lead.createdAt).getTime()) / 36_000) / 10);
  const tags: LeadTag[] = [];
  const roofer = normalized(lead.roofer);
  const term = normalized(lead.term);

  if (fileCount === 0) tags.push('chyba_fotka');
  if (lead.wantsRooferRecommendation || lead.selectedRooferId || roofer.includes('potrebujem') || roofer.includes('chcem odporucit')) tags.push('potrebuje_strechara');
  if (term.includes('najskor') || term.includes('urgent') || term.includes('co naj')) tags.push('urgentne');
  if (lead.areaEstimate >= 100) tags.push('nad_100_m2');

  const score =
    (lead.fullName && lead.phone && lead.email ? 20 : 0) +
    (lead.city ? 15 : 0) +
    (lead.objectType && lead.materialType ? 20 : 0) +
    (lead.areaEstimate > 0 ? 20 : 0) +
    (fileCount > 0 ? 20 : 0) +
    (lead.note || lead.term || lead.roofer ? 5 : 0);

  if (score >= 75 && fileCount > 0) tags.push('pripravene_na_nacenenie');

  return {
    ageHours,
    fileCount,
    quoteCount,
    qualityScore: Math.min(100, score),
    tags,
  };
}
