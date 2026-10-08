import { createHash, timingSafeEqual } from 'node:crypto';

export type DeploymentSafetyEnvironment = Partial<Pick<NodeJS.ProcessEnv,
  | 'NODE_ENV'
  | 'VERCEL'
  | 'VERCEL_ENV'
  | 'VERCEL_TARGET_ENV'
  | 'VERCEL_PROJECT_ID'
  | 'DATABASE_URL'
  | 'DATABASE_RESOURCE_ID'
  | 'BLOB_READ_WRITE_TOKEN'
  | 'PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN'
  | 'STAGING_WRITE_ENABLED'
  | 'STAGING_MAIL_OVERRIDE_TO'
  | 'STAGING_DATABASE_MARKER'
  | 'STAGING_RESOURCE_BINDING_SHA256'
  | 'PRODUCTION_DATABASE_FINGERPRINT_SHA256'
  | 'PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256'
  | 'PRODUCTION_BLOB_FINGERPRINT_SHA256'
  | 'PRODUCTION_PHOTO_INTAKE_BLOB_FINGERPRINT_SHA256'
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

export function stagingResourceBinding(environment: DeploymentSafetyEnvironment = process.env) {
  return sha256(JSON.stringify([
    environment.VERCEL_PROJECT_ID?.trim() ?? '',
    environment.VERCEL_TARGET_ENV?.trim() ?? '',
    environment.DATABASE_URL?.trim() ?? '',
    environment.DATABASE_RESOURCE_ID?.trim() ?? '',
    environment.BLOB_READ_WRITE_TOKEN?.trim() ?? '',
    environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN?.trim() ?? '',
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
  if (!environment.VERCEL_PROJECT_ID?.trim() || !environment.DATABASE_URL?.trim() || !environment.DATABASE_RESOURCE_ID?.trim() || !environment.BLOB_READ_WRITE_TOKEN?.trim() || !environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN?.trim()) return false;
  if (!/^[a-f0-9]{64}$/i.test(environment.STAGING_DATABASE_MARKER?.trim() ?? '')) return false;
  if (!singleEmail(environment.STAGING_MAIL_OVERRIDE_TO)) return false;
  if (!safeHexEqual(environment.STAGING_RESOURCE_BINDING_SHA256, stagingResourceBinding(environment))) return false;

  const resourcePairs = [
    [environment.PRODUCTION_DATABASE_FINGERPRINT_SHA256, environment.DATABASE_URL],
    [environment.PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256, environment.DATABASE_RESOURCE_ID],
    [environment.PRODUCTION_BLOB_FINGERPRINT_SHA256, environment.BLOB_READ_WRITE_TOKEN],
    [environment.PRODUCTION_PHOTO_INTAKE_BLOB_FINGERPRINT_SHA256, environment.PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN],
  ] as const;
  return resourcePairs.every(([productionFingerprint, stagingValue]) => {
    const normalized = productionFingerprint?.trim().toLowerCase() ?? '';
    return /^[a-f0-9]{64}$/.test(normalized) && !safeHexEqual(normalized, deploymentResourceFingerprint(stagingValue));
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

function isCanonicalProductionHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return canonicalProductionHosts.has(normalized);
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
