import localityDataset from '../data/slovakia-locality-points.json';
import type { PublishedRealizationCase } from '../server/types';

type LocalityType = 'obec' | 'okres';
type SvgPointRow = readonly [name: string, type: LocalityType, x: number, y: number];
type Dataset = { locations: readonly SvgPointRow[] };
type CaseLocality = Pick<PublishedRealizationCase, 'id' | 'locality' | 'localityPrecision'> & { lifecycle?: string };
export type PublishedRealizationMapPoint = Readonly<{ caseId: string; x: number; y: number }>;

const bundledDataset = localityDataset as unknown as Dataset;
const estimatedNamePattern = /(?:\b(?:cca|asi|odhad(?:om|nut\w*)?|približne|priblizne|okolie|blízko|blizko|neviem|neznáme|nezname)\b|[?~])/iu;

function normalizeLocalityName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!normalized || estimatedNamePattern.test(normalized)) return null;
  return normalized.toLocaleLowerCase('sk-SK');
}

function normalizeCaseLocality(value: unknown, type: LocalityType): string | null {
  if (typeof value !== 'string') return null;
  // Older drafts may store the precision as a prefix (for example "okres Poprad").
  // Strip only the prefix matching the already-declared precision; never infer it.
  const prefix = type === 'okres' ? /^okres\s+/iu : /^obec\s+/iu;
  return normalizeLocalityName(value.replace(prefix, ''));
}

/**
 * Maps published case localities only to a unique official ZBGIS point at the
 * case's declared precision. It never infers a district from a municipality
 * (or vice versa), nor derives coordinates from customer/photo data.
 */
export function mapPublishedRealizationLocalityPoints(
  cases: readonly CaseLocality[],
  dataset: Dataset = bundledDataset,
): PublishedRealizationMapPoint[] {
  const index = new Map<string, SvgPointRow[]>();
  for (const row of dataset.locations) {
    if (!Array.isArray(row) || row.length !== 4) continue;
    const [name, type, x, y] = row;
    if ((type !== 'obec' && type !== 'okres') || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    const normalized = normalizeLocalityName(name);
    if (!normalized) continue;
    const key = `${type}\u0000${normalized}`;
    const matches = index.get(key) ?? [];
    matches.push(row);
    index.set(key, matches);
  }

  const points: PublishedRealizationMapPoint[] = [];
  for (const item of cases) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) continue;
    if ('lifecycle' in item && item.lifecycle !== 'published') continue;
    const type = item.localityPrecision === 'municipality'
      ? 'obec'
      : item.localityPrecision === 'district' ? 'okres' : null;
    if (!type) continue;
    const name = normalizeCaseLocality(item.locality, type);
    if (!name) continue;
    const matches = index.get(`${type}\u0000${name}`) ?? [];
    if (matches.length !== 1) continue;
    const [, , x, y] = matches[0];
    points.push({ caseId: item.id, x, y });
  }
  return points;
}
