export async function persistAcceptedLeadAnalyticsBatch<T>(
  records: T[],
  persist: (record: T) => Promise<unknown>,
  onError?: (record: T, error: unknown) => void,
): Promise<{ recovered: number; failed: boolean }> {
  let recovered = 0;
  let failed = false;

  for (const record of records) {
    try {
      if (await persist(record)) recovered += 1;
      else failed = true;
    } catch (error) {
      failed = true;
      onError?.(record, error);
    }
  }

  return { recovered, failed };
}
