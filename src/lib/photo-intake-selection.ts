export function splitPhotoSelection<T>(selected: T[], currentCount: number, maximum = 20) {
  const remaining = Math.max(0, maximum - Math.max(0, currentCount));
  const accepted = selected.slice(0, remaining);
  return {
    accepted,
    rejectedCount: selected.length - accepted.length,
    remainingAfterSelection: remaining - accepted.length,
  };
}

export function photoSelectionNotice(acceptedCount: number, rejectedCount: number) {
  if (rejectedCount <= 0) return '';
  return `Pridané fotografie: ${Math.max(0, acceptedCount)}. Nepridané fotografie: ${rejectedCount}. Uvoľni miesto odstránením už nahratých položiek zo zoznamu.`;
}
