import { createHash, timingSafeEqual } from 'node:crypto';

export type DeploymentSafetyEnvironment = Partial<Pick<NodeJS.ProcessEnv,
  | 'NODE_ENV'
  | 'VERCEL'
  | 'VERCEL_ENV'
  | 'VERCEL_TARGET_ENV'
  | 'VERCEL_URL'
  | 'VERCEL_PROJECT_ID'
  | 'VERCEL_OIDC_TOKEN'
  | 'DATABASE_URL'
  | 'DATABASE_RESOURCE_ID'
  | 'BLOB_READ_WRITE_TOKEN'
  | 'BLOB_RESOURCE_ID'
  | 'PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN'
  | 'PHOTO_INTAKE_BLOB_RESOURCE_ID'
  | 'CRON_SECRET'
  | 'STAGING_WRITE_ENABLED'
  | 'STAGING_MAIL_OVERRIDE_TO'
  | 'STAGING_DATABASE_MARKER'
  | 'STAGING_RESOURCE_BINDING_SHA256'
  | 'PRODUCTION_DATABASE_IDENTITY_FINGERPRINT_SHA256'
  | 'PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256'
  | 'PRODUCTION_BLOB_RESOURCE_ID_FINGERPRINT_SHA256'
  | 'PRODUCTION_PHOTO_INTAKE_BLOB_RESOURCE_ID_FINGERPRINT_SHA256'
  | 'ASTANA_HARNESS_CHILD'
  | 'ASTANA_HARNESS_FULL_BUILD'
  | 'ASTANA_ISOLATED_PG_RUN_TOKEN'
  | 'ASTANA_ISOLATED_PG_URL'
  | 'NEXT_PUBLIC_SITE_URL'
>>;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const singleEmail = (value: string | undefined) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(normalized) ? normalized : '';
};

function safeHexEqual(actual: string | undefined, expected: string) {
  const normalized = actual?.trim().toLowerCase() ?? '';
  if (!/^[a-f0-9]{64}$/.test(normalized)) return false;
  return timingSafeEqual(Buffer.from(normalized, 'hex'), Buffer.from(expected, 'hex'));
}

export function deploymentResourceFingerprint(value: string | undefined) {
  return sha256(value?.trim() ?? '');
}

export function deploymentDatabaseIdentity(value: string | undefined) {
  try {
    const parsed = new URL(value?.trim() ?? '');
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') return '';
    const targetOverrideKeys = new Set(['host', 'hostaddr', 'port', 'service', 'servicefile', 'socket']);
    const tlsOverrideKeys = new Set(['ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']);
    for (const key of parsed.searchParams.keys()) {
      const normalizedKey = key.toLowerCase();
      if (targetOverrideKeys.has(normalizedKey) || tlsOverrideKeys.has(normalizedKey)) return '';
    }
    const sslMode = parsed.searchParams.get('sslmode')?.trim().toLowerCase();
    if (sslMode && !['require', 'verify-ca', 'verify-full'].includes(sslMode)) return '';
    const hostname = parsed.hostname.trim().toLowerCase().replace(/\.$/, '').replace(/-pooler(?=\.)/, '');
    if (!hostname) return '';
    const port = parsed.port || '5432';
    const database = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    if (!database || database.includes('/')) return '';
    return `${hostname}:${port}/${database}`;
  } catch {
    return '';
  }
}

export function vercelBlobStoreId(value: string | undefined) {
  const token = value?.trim() ?? '';
  const parts = token.split('_');
  if (parts.length < 5 || parts[0] !== 'vercel' || parts[1] !== 'blob' || parts[2] !== 'rw') return '';
  return /^[a-z0-9]+$/i.test(parts[3] ?? '') ? parts[3].toLowerCase() : '';
}

export function stagingResourceBinding(environment: DeploymentSafetyEnvironment = process.env) {
  const databaseIdentity = deploymentDatabaseIdentity(environment.DATABASE_URL);
  const leadBlobStoreId = vercelBlobStoreId(environment.BLOB_READ_WRITE_TOKEN);
  const photoBlobStoreId = environment.PHOTO_INTAKE_BLOB_RESOURCE_ID?.trim().replace(/^store_/i, '').toLowerCase() ?? '';
  return sha256(JSON.stringify([
    environment.VERCEL_PROJECT_ID?.trim() ?? '',
    environment.VERCEL_TARGET_ENV?.trim() ?? '',
    databaseIdentity,
    environment.DATABASE_RESOURCE_ID?.trim() ?? '',
    leadBlobStoreId,
    environment.BLOB_RESOURCE_ID?.trim().toLowerCase() ?? '',
    photoBlobStoreId,
    environment.PHOTO_INTAKE_BLOB_RESOURCE_ID?.trim().toLowerCase() ?? '',
    environment.STAGING_DATABASE_MARKER?.trim().toLowerCase() ?? '',
    singleEmail(environment.STAGING_MAIL_OVERRIDE_TO),
  ]));
}

export function isCustomStagingTarget(environment: DeploymentSafetyEnvironment = process.env) {
  return environment.VERCEL === '1'
    && environment.VERCEL_ENV === 'preview'
    && environment.VERCEL_TARGET_ENV === 'staging';
}

/** The full-build harness may use only its own loopback PostgreSQL, never a deployed resource. */
export function isVerifiedLocalBuildHarness(environment: DeploymentSafetyEnvironment = process.env) {
  if (environment.NODE_ENV !== 'production' || environment.VERCEL === '1') return false;
  if (environment.ASTANA_HARNESS_CHILD !== '1' || environment.ASTANA_HARNESS_FULL_BUILD !== '1') return false;
  if (!/^[a-f0-9]{32}$/i.test(environment.ASTANA_ISOLATED_PG_RUN_TOKEN?.trim() ?? '')) return false;
  const databaseUrl = environment.DATABASE_URL?.trim() ?? '';
  if (!databaseUrl || databaseUrl !== environment.ASTANA_ISOLATED_PG_URL?.trim()) return false;
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') return false;
    const targetOverrideKeys = new Set(['host', 'hostaddr', 'port', 'service', 'servicefile', 'socket']);
    for (const key of parsed.searchParams.keys()) {
      if (targetOverrideKeys.has(key.toLowerCase())) return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return hostname === '127.0.0.1' || hostname === 'localhost';
  } catch {
    return false;
  }
}

/** Staging writes are enabled only for an explicitly bound, non-production resource set. */
export function isVerifiedIsolatedStaging(environment: DeploymentSafetyEnvironment = process.env) {
  if (!isCustomStagingTarget(environment) || environment.STAGING_WRITE_ENABLED !== 'true') return false;
  if (!environment.VERCEL_PROJECT_ID?.trim() || !environment.DATABASE_URL?.trim() || !environment.DATABASE_RESOURCE_ID?.trim()
    || !environment.BLOB_READ_WRITE_TOKEN?.trim() || !environment.BLOB_RESOURCE_ID?.trim()
    || !environment.PHOTO_INTAKE_BLOB_RESOURCE_ID?.trim()
    || (!environment.VERCEL_OIDC_TOKEN?.trim() && !environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN?.trim())) return false;
  if (!/^[a-f0-9]{64}$/i.test(environment.STAGING_DATABASE_MARKER?.trim() ?? '')) return false;
  if (!singleEmail(environment.STAGING_MAIL_OVERRIDE_TO)) return false;
  const databaseIdentity = deploymentDatabaseIdentity(environment.DATABASE_URL);
  const leadBlobStoreId = vercelBlobStoreId(environment.BLOB_READ_WRITE_TOKEN);
  const photoResourceId = environment.PHOTO_INTAKE_BLOB_RESOURCE_ID.trim().replace(/^store_/i, '').toLowerCase();
  const photoTokenStoreId = vercelBlobStoreId(environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN);
  const photoBlobStoreId = photoTokenStoreId || photoResourceId;
  if (!databaseIdentity || !leadBlobStoreId || !photoBlobStoreId || leadBlobStoreId === photoBlobStoreId) return false;
  if (leadBlobStoreId !== environment.BLOB_RESOURCE_ID.trim().toLowerCase()) return false;
  if (photoBlobStoreId !== photoResourceId || (environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN?.trim() && !photoTokenStoreId)) return false;
  if (!safeHexEqual(environment.STAGING_RESOURCE_BINDING_SHA256, stagingResourceBinding(environment))) return false;

  const databaseResourcePairs = [
    [environment.PRODUCTION_DATABASE_IDENTITY_FINGERPRINT_SHA256, databaseIdentity],
    [environment.PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256, environment.DATABASE_RESOURCE_ID],
  ] as const;
  if (!databaseResourcePairs.every(([productionFingerprint, stagingValue]) => {
    const normalized = productionFingerprint?.trim().toLowerCase() ?? '';
    return /^[a-f0-9]{64}$/.test(normalized) && !safeHexEqual(normalized, deploymentResourceFingerprint(stagingValue));
  })) return false;

  const productionBlobFingerprints = [
    environment.PRODUCTION_BLOB_RESOURCE_ID_FINGERPRINT_SHA256,
    environment.PRODUCTION_PHOTO_INTAKE_BLOB_RESOURCE_ID_FINGERPRINT_SHA256,
  ];
  return productionBlobFingerprints.every((productionFingerprint) => {
    const normalized = productionFingerprint?.trim().toLowerCase() ?? '';
    return /^[a-f0-9]{64}$/.test(normalized)
      && !safeHexEqual(normalized, deploymentResourceFingerprint(leadBlobStoreId))
      && !safeHexEqual(normalized, deploymentResourceFingerprint(photoBlobStoreId));
  });
}

export function stagingDatabaseMarkerMatches(actualMarker: unknown, environment: DeploymentSafetyEnvironment = process.env) {
  if (!isVerifiedIsolatedStaging(environment) || typeof actualMarker !== 'string') return false;
  const expected = environment.STAGING_DATABASE_MARKER?.trim().toLowerCase() ?? '';
  return safeHexEqual(actualMarker, expected);
}

export function stagingMailOverride(environment: DeploymentSafetyEnvironment = process.env) {
  return isVerifiedIsolatedStaging(environment) ? singleEmail(environment.STAGING_MAIL_OVERRIDE_TO) : '';
}

/** Deployed DB access needs either live Production identity or verified isolated Staging. */
export function deploymentDatabaseAccessBlocked(environment: DeploymentSafetyEnvironment = process.env) {
  if (environment.NODE_ENV !== 'production') return false;
  if (isVerifiedLocalBuildHarness(environment)) return false;
  if (environment.VERCEL !== '1') return true;
  if (environment.VERCEL_ENV === 'production' && environment.VERCEL_TARGET_ENV === 'production') return false;
  return !isVerifiedIsolatedStaging(environment);
}

const canonicalProductionHosts = new Set(['likvidacia-eternitu.sk', 'www.likvidacia-eternitu.sk']);
const signedLeadBlobCallbackPath = '/api/lead-upload/';

function isCanonicalProductionHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return canonicalProductionHosts.has(normalized);
}

/**
 * Vercel invokes Cron Jobs on the production deployment URL and authenticates
 * them with CRON_SECRET. The route handler performs the same authorization
 * check again before any work starts.
 */
export function vercelCronRequestAllowed(
  environment: DeploymentSafetyEnvironment,
  method: string,
  pathname: string,
  authorization: string | null,
) {
  const secret = environment.CRON_SECRET?.trim() ?? '';
  const expectedAuthorization = `Bearer ${secret}`;
  if (
    environment.NODE_ENV !== 'production'
    || environment.VERCEL !== '1'
    || environment.VERCEL_ENV !== 'production'
    || environment.VERCEL_TARGET_ENV !== 'production'
    || method.toUpperCase() !== 'GET'
    || !/^\/api\/cron(?:\/|$)/i.test(pathname)
    || !secret
    || authorization?.length !== expectedAuthorization.length
  ) return false;
  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expectedAuthorization));
}

/**
 * Vercel Blob signs upload-completion callbacks and targets the immutable
 * deployment which minted the token. Only that deployment may bypass the
 * staged-production write guard, and the route still cryptographically verifies
 * the signature before touching storage or the database.
 */
export function signedBlobCompletionCallbackAllowed(
  environment: DeploymentSafetyEnvironment,
  method: string,
  pathname: string,
  hostname: string,
  signature: string | null,
) {
  const deploymentHostname = environment.VERCEL_URL?.trim().toLowerCase() ?? '';
  return environment.NODE_ENV === 'production'
    && environment.VERCEL === '1'
    && environment.VERCEL_ENV === 'production'
    && environment.VERCEL_TARGET_ENV === 'production'
    && method.toUpperCase() === 'POST'
    && pathname === signedLeadBlobCallbackPath
    && /^[a-f0-9]{64}$/i.test(signature?.trim() ?? '')
    && Boolean(deploymentHostname)
    && hostname.trim().toLowerCase() === deploymentHostname;
}

export function deploymentRequestBlocked(
  environment: DeploymentSafetyEnvironment,
  method: string,
  pathname: string,
  hostname: string,
) {
  const normalizedMethod = method.toUpperCase();
  const cronRequest = /^\/api\/cron(?:\/|$)/i.test(pathname);
  if (isVerifiedIsolatedStaging(environment)) return cronRequest;

  const liveProduction = environment.NODE_ENV === 'production'
    && environment.VERCEL === '1'
    && environment.VERCEL_ENV === 'production'
    && environment.VERCEL_TARGET_ENV === 'production'
    && isCanonicalProductionHost(hostname);
  if (liveProduction) return false;

  const stagedProduction = environment.NODE_ENV === 'production'
    && environment.VERCEL === '1'
    && environment.VERCEL_ENV === 'production'
    && environment.VERCEL_TARGET_ENV === 'production';
  const stagedPrivateRoute = /^\/(?:admin|spolupraca\/fotky)(?:\/|$)/i.test(pathname);
  if (stagedProduction && (/^\/api(?:\/|$)/i.test(pathname) || /^\/dopyt-prijaty(?:\/|$)/i.test(pathname) || stagedPrivateRoute)) return true;

  if (environment.NODE_ENV !== 'production') return false;
  if (cronRequest) return true;
  return !['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod);
}

/** Runtime requests never run schema migrations in shared Production. */
export function runtimeSchemaInitializationAllowed(environment: DeploymentSafetyEnvironment = process.env) {
  return environment.NODE_ENV !== 'production'
    || isVerifiedIsolatedStaging(environment)
    || isVerifiedLocalBuildHarness(environment);
}
