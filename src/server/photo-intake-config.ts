import { createHash, timingSafeEqual } from 'node:crypto';
import { getVercelOidcTokenSync } from '@vercel/oidc';
import { deploymentDatabaseIdentity } from './preview-safety';

type RuntimeEnvironment = Record<string, string | undefined>;

export type PrivatePhotoIntakeBlobOptions =
  | { storeId: string; oidcToken: string; token?: never }
  | { token: string; storeId?: never; oidcToken?: never };

function normalizedBindingResourceId(value: string | undefined) {
  const normalized = value?.trim().replace(/^store_/i, '').toLowerCase() ?? '';
  return /^[a-z0-9][a-z0-9/_-]*$/.test(normalized) ? normalized : '';
}

function normalizedBlobStoreId(value: string | undefined) {
  const normalized = value?.trim().replace(/^store_/i, '') ?? '';
  return /^[a-z0-9]+$/i.test(normalized) ? normalized : '';
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
  const photoStoreId = normalizedBlobStoreId(environment.PHOTO_INTAKE_BLOB_RESOURCE_ID).toLowerCase();
  if (!projectId || !databaseIdentity || !databaseResourceId || !photoStoreId) return null;
  return createHash('sha256')
    .update(JSON.stringify(['photo-intake-oidc-v2', projectId, databaseIdentity, databaseResourceId, photoStoreId]))
    .digest('hex');
}

function oidcPhotoStoreId(environment: RuntimeEnvironment) {
  const providerStoreId = normalizedBlobStoreId(environment.PHOTO_INTAKE_BLOB_STORE_ID);
  const boundStoreId = normalizedBlobStoreId(environment.PHOTO_INTAKE_BLOB_RESOURCE_ID).toLowerCase();
  if (!providerStoreId || !boundStoreId || providerStoreId.toLowerCase() !== boundStoreId) return '';
  const runtimeCanReceiveOidc = Boolean(environment.VERCEL_OIDC_TOKEN?.trim()) || isProductionVercel(environment);
  return runtimeCanReceiveOidc ? providerStoreId : '';
}

export function privatePhotoIntakeUsesOidc(environment: RuntimeEnvironment = process.env) {
  return Boolean(oidcPhotoStoreId(environment));
}

export function privatePhotoIntakeBlobOptions(
  environment: RuntimeEnvironment = process.env,
): PrivatePhotoIntakeBlobOptions {
  const storeId = oidcPhotoStoreId(environment);
  if (storeId) {
    // Pass the request-context token explicitly. Otherwise the Blob SDK can
    // silently fall back to the unrelated global BLOB_READ_WRITE_TOKEN.
    // Vercel guarantees this short-lived token for the lifetime of a function.
    let oidcToken = '';
    try {
      oidcToken = getVercelOidcTokenSync().trim();
    } catch {
      // Provider/context details must not escape this bounded configuration API.
    }
    if (!oidcToken) throw new Error('Súkromné fotoúložisko nemá platné krátkodobé oprávnenie.');
    return { storeId, oidcToken };
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
