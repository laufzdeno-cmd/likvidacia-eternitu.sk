import { createHash, timingSafeEqual } from 'node:crypto';

type RuntimeEnvironment = Record<string, string | undefined>;

export function careerCvRetentionBound(environment: RuntimeEnvironment = process.env) {
  if (environment.CAREER_CV_RETENTION_DELETE_ENABLED !== '1'
      || environment.CAREER_CV_PRIVATE_STORE_CONFIRMED !== '1') return false;
  if (environment.VERCEL === '1' && environment.VERCEL_ENV !== 'production') return false;
  if (environment.NODE_ENV === 'production' && environment.VERCEL_ENV !== 'production') return false;
  const projectId = environment.VERCEL_PROJECT_ID || '';
  const databaseUrl = environment.DATABASE_URL || '';
  const blobToken = environment.BLOB_READ_WRITE_TOKEN || '';
  const expected = environment.CAREER_CV_RETENTION_BINDING_SHA256 || '';
  if (!projectId || !databaseUrl || !blobToken || !/^[0-9a-f]{64}$/i.test(expected)) return false;
  const actual = createHash('sha256').update(JSON.stringify([projectId, databaseUrl, blobToken]), 'utf8').digest();
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
