import { createHash, timingSafeEqual } from 'node:crypto';
import { deploymentDatabaseIdentity } from './preview-safety';

type RuntimeEnvironment = Record<string, string | undefined>;

export type PrivatePhotoIntakeBlobOptions =
  | { storeId: string; token?: never; oidcToken?: never }
  | { token: string; storeId?: never; oidcToken?: never };

function normalizedBindingResourceId(value: string | undefined) {
  const normalized = value?.trim().replace(/^store_/i, '').toLowerCase() ?? '';
  return /^[a-z0-9][a-z0-9/_-]*$/.test(normalized) ? normalized : '';
}

function normalizedBlobStoreId(value: string | undefined) {
  const normalized = value?.trim().replace(/^store_/i, '').toLowerCase() ?? '';
  return /^[a-z0-9]+$/.test(normalized) ? normalized : '';
}

function isProductionVercel(environment: RuntimeEnvironment) {
  return environment.VERCEL === '1'
    && environment.VERCEL_ENV === 'production'
    && environment.VERCEL_TARGET_ENV === 'production';
}

export function privatePhotoIntakeStorageBinding(environment: RuntimeEnvironment = process.env) {
  const projectId = environment.VERCEL_PROJECT_ID?.trim();
  const databaseIdentity = deploymentDatabaseIdentity(environment.DATABASE_URL);
  const databaseResourceId = normalizedBindingResourceId(environment.DATABASE_RESOURCE_ID);
  const photoStoreId = normalizedBlobStoreId(environment.PHOTO_INTAKE_BLOB_RESOURCE_ID);
  if (!projectId || !databaseIdentity || !databaseResourceId || !photoStoreId) return null;
  return createHash('sha256')
    .update(JSON.stringify(['photo-intake-oidc-v2', projectId, databaseIdentity, databaseResourceId, photoStoreId]))
    .digest('hex');
}

export function privatePhotoIntakeUsesOidc(environment: RuntimeEnvironment = process.env) {
  return Boolean(environment.VERCEL_OIDC_TOKEN?.trim()
    && normalizedBlobStoreId(environment.PHOTO_INTAKE_BLOB_RESOURCE_ID));
}

export function privatePhotoIntakeBlobOptions(
  environment: RuntimeEnvironment = process.env,
): PrivatePhotoIntakeBlobOptions {
  const storeId = normalizedBlobStoreId(environment.PHOTO_INTAKE_BLOB_RESOURCE_ID);
  if (environment.VERCEL_OIDC_TOKEN?.trim() && storeId) {
    // Do not pass the OIDC token itself. The SDK reads and refreshes the
    // short-lived VERCEL_OIDC_TOKEN while the explicit store id prevents a
    // fallback to the unrelated default Blob store connected to the project.
    return { storeId };
  }

  // A long-lived token is accepted only by local/isolated test tooling. Live
  // Production must fail closed until its Blob connection has been upgraded.
  const token = environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN?.trim();
  if (!isProductionVercel(environment) && token) return { token };
  throw new Error('Súkromné fotoúložisko nemá platné krátkodobé oprávnenie.');
}

export function privatePhotoIntakeStorageReady(environment: RuntimeEnvironment = process.env) {
  const expected = privatePhotoIntakeStorageBinding(environment);
  const configured = environment.PHOTO_INTAKE_RETENTION_BINDING_SHA256?.trim().toLowerCase();
  const hasCredential = privatePhotoIntakeUsesOidc(environment)
    || (!isProductionVercel(environment) && Boolean(environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN?.trim()));
  if (environment.PHOTO_INTAKE_PRIVATE_STORE_VERIFIED !== 'true' || !hasCredential || !expected || !configured
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
