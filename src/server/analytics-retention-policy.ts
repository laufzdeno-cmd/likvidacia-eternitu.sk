/** Standalone analytics only. Business attribution and advertising outboxes are separate records. */
export const ANALYTICS_RETENTION_MONTHS = 12;

export function analyticsRetentionCutoff(referenceTime = new Date()): string {
  if (!Number.isFinite(referenceTime.getTime())) throw new Error('Invalid analytics retention clock.');
  const cutoff = new Date(referenceTime);
  const originalDay = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const monthEnd = new Date(cutoff);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  cutoff.setUTCDate(Math.min(originalDay, monthEnd.getUTCDate()));
  return cutoff.toISOString();
}

export function normalizedAnalyticsCutoff(value: unknown): string | undefined {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

export function latestAnalyticsCutoff(...values: (string | undefined)[]): string | undefined {
  return values.map(normalizedAnalyticsCutoff).filter((value): value is string => Boolean(value)).sort().at(-1);
}

/** Malformed stored timestamps are preserved for inspection, never silently deleted. */
export function analyticsEventExpired(createdAt: string, cutoff: string): boolean {
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) && timestamp < Date.parse(cutoff);
}

export function analyticsEventRetained(createdAt: string, cutoff: string): boolean {
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) && timestamp >= Date.parse(cutoff);
}
