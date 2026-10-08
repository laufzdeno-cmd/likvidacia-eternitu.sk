import { createHash, timingSafeEqual } from 'node:crypto';

type RuntimeEnvironment = Record<string, string | undefined>;

function currentStorageBinding(environment: RuntimeEnvironment = process.env) {
  const projectId = environment.VERCEL_PROJECT_ID?.trim();
  const databaseUrl = environment.DATABASE_URL?.trim();
  const token = environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN?.trim();
  if (!projectId || !databaseUrl || !token) return null;
  return createHash('sha256').update(JSON.stringify([projectId, databaseUrl, token])).digest('hex');
}

export function privatePhotoIntakeBlobToken() {
  const token = process.env.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error('Samostatný token súkromného úložiska fotiek nie je nastavený.');
  return token;
}

export function privatePhotoIntakeStorageReady(environment: RuntimeEnvironment = process.env) {
  const expected = currentStorageBinding(environment);
  const configured = environment.PHOTO_INTAKE_RETENTION_BINDING_SHA256?.trim().toLowerCase();
  if (environment.PHOTO_INTAKE_PRIVATE_STORE_VERIFIED !== 'true' || !expected || !configured
    || !/^[a-f0-9]{64}$/.test(configured)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(configured, 'hex'));
}

export function privatePhotoIntakeEnabled(environment: RuntimeEnvironment = process.env) {
  return environment.PHOTO_INTAKE_ENABLED === 'true'
    && photoIntakeRetentionRequested(environment)
    && privatePhotoIntakeStorageReady(environment)
    && (environment.PHOTO_UPLOAD_SESSION_SECRET?.length ?? 0) >= 32;
}

export function photoIntakeRetentionRequested(environment: RuntimeEnvironment = process.env) {
  return environment.PHOTO_INTAKE_RETENTION_ENABLED === 'true';
}
