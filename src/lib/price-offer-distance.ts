export function roundTripDistanceKm(oneWayMeters: unknown): number | null {
  const meters = Number(oneWayMeters);
  if (!Number.isFinite(meters) || meters <= 0 || meters > 2_000_000) return null;
  return Math.round((meters / 1000) * 2 * 100) / 100;
}
