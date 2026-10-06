import { createHash, timingSafeEqual } from 'node:crypto';

export function leadBlobRetentionBindingHash(projectId: string, databaseUrl: string, blobToken: string) {
  return createHash('sha256').update(JSON.stringify([projectId, databaseUrl, blobToken]), 'utf8').digest('hex');
}

export function leadBlobRetentionBound() {
  // Preview deployments must never reconcile a store against an unrelated DB.
  if (process.env.VERCEL === '1' && process.env.VERCEL_ENV !== 'production') return false;
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'production') return false;
  const projectId = process.env.VERCEL_PROJECT_ID || '';
  const databaseUrl = process.env.DATABASE_URL || '';
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN || '';
  const expected = process.env.LEAD_BLOB_RETENTION_BINDING_SHA256 || '';
  if (!projectId || !databaseUrl || !blobToken || !/^[0-9a-f]{64}$/i.test(expected)) return false;
  const actual = leadBlobRetentionBindingHash(projectId, databaseUrl, blobToken);
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
