type ClassificationAudit = {
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  changes?: Record<string, unknown>;
};

/** Reapplies the latest audited classification when a stale local snapshot is persisted. */
export function mergeLatestTestClassifications<T extends { id: string; isTestData?: boolean }>(
  records: T[],
  auditLogs: ClassificationAudit[],
  entityType: 'lead' | 'business_job',
): T[] {
  const action = entityType === 'lead' ? 'lead_test_classification_changed' : 'business_job_test_classification_changed';
  const latest = new Map<string, { createdAt: string; value: boolean }>();
  for (const log of auditLogs) {
    if (log.entityType !== entityType || log.action !== action || typeof log.changes?.next !== 'boolean') continue;
    const previous = latest.get(log.entityId);
    if (!previous || log.createdAt >= previous.createdAt) latest.set(log.entityId, { createdAt: log.createdAt, value: log.changes.next });
  }
  return records.map((record) => ({ ...record, isTestData: latest.get(record.id)?.value ?? Boolean(record.isTestData) }));
}
