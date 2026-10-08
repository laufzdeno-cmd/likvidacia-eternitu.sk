import { createHash, timingSafeEqual } from 'node:crypto';

type RuntimeEnvironment = Record<string, string | undefined>;

export function leadBlobRetentionBindingHash(projectId: string, databaseUrl: string, blobToken: string) {
  return createHash('sha256').update(JSON.stringify([projectId, databaseUrl, blobToken]), 'utf8').digest('hex');
}

export function leadBlobRetentionBound(environment: RuntimeEnvironment = process.env) {
  // Preview deployments must never reconcile a store against an unrelated DB.
  if (environment.VERCEL === '1' && environment.VERCEL_ENV !== 'production') return false;
  if (environment.NODE_ENV === 'production' && environment.VERCEL_ENV !== 'production') return false;
  const projectId = environment.VERCEL_PROJECT_ID || '';
  const databaseUrl = environment.DATABASE_URL || '';
  const blobToken = environment.BLOB_READ_WRITE_TOKEN || '';
  const expected = environment.LEAD_BLOB_RETENTION_BINDING_SHA256 || '';
  if (!projectId || !databaseUrl || !blobToken || !/^[0-9a-f]{64}$/i.test(expected)) return false;
  const actual = leadBlobRetentionBindingHash(projectId, databaseUrl, blobToken);
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
