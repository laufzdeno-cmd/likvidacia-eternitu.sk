import { createHash, timingSafeEqual } from 'node:crypto';

function currentStorageBinding() {
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const token = process.env.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN?.trim();
  if (!projectId || !databaseUrl || !token) return null;
  return createHash('sha256').update(JSON.stringify([projectId, databaseUrl, token])).digest('hex');
}

export function privatePhotoIntakeBlobToken() {
  const token = process.env.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error('Samostatný token súkromného úložiska fotiek nie je nastavený.');
  return token;
}

export function privatePhotoIntakeStorageReady() {
  const expected = currentStorageBinding();
  const configured = process.env.PHOTO_INTAKE_RETENTION_BINDING_SHA256?.trim().toLowerCase();
  if (process.env.PHOTO_INTAKE_PRIVATE_STORE_VERIFIED !== 'true' || !expected || !configured
    || !/^[a-f0-9]{64}$/.test(configured)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(configured, 'hex'));
}

export function privatePhotoIntakeEnabled() {
  return process.env.PHOTO_INTAKE_ENABLED === 'true'
    && photoIntakeRetentionRequested()
    && privatePhotoIntakeStorageReady()
    && (process.env.PHOTO_UPLOAD_SESSION_SECRET?.length ?? 0) >= 32;
}

export function photoIntakeRetentionRequested() {
  return process.env.PHOTO_INTAKE_RETENTION_ENABLED === 'true';
}
