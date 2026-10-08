import type { PoolConfig } from 'pg';

type DatabaseEnvironment = Partial<Pick<NodeJS.ProcessEnv, 'NODE_ENV'>>;

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const connectionOverrideKeys = new Set([
  'host',
  'hostaddr',
  'port',
  'service',
  'servicefile',
  'socket',
]);
const tlsOverrideKeys = new Set(['ssl', 'sslcert', 'sslkey', 'sslrootcert']);

function parseDatabaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') throw new Error('protocol');
    if (!parsed.hostname) throw new Error('hostname');
    return parsed;
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
}

export function isLoopbackDatabaseUrl(value: string) {
  const parsed = parseDatabaseUrl(value.trim());
  return loopbackHosts.has(parsed.hostname.trim().toLowerCase().replace(/\.$/, ''));
}

export function normalizeDatabaseUrl(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const parsed = parseDatabaseUrl(trimmed);
  for (const key of [...parsed.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (connectionOverrideKeys.has(normalized)) {
      throw new Error('DATABASE_URL contains an unsupported connection target override.');
    }
  }

  if (isLoopbackDatabaseUrl(trimmed)) return trimmed;

  for (const key of [...parsed.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (tlsOverrideKeys.has(normalized) || normalized === 'sslmode' || normalized === 'uselibpqcompat') {
      parsed.searchParams.delete(key);
    }
  }

  parsed.searchParams.set('sslmode', 'verify-full');
  return parsed.toString();
}

export function assertDatabaseConfiguredForRuntime(
  databaseUrl: string | undefined,
  environment: DatabaseEnvironment = process.env,
) {
  if (environment.NODE_ENV === 'production' && !databaseUrl) {
    throw new Error('DATABASE_URL is required in production.');
  }
}

export function databasePoolConfig(databaseUrl: string, configuredPoolMax?: string): PoolConfig {
  const parsedPoolMax = Number.parseInt(configuredPoolMax || '', 10);
  const max = Number.isSafeInteger(parsedPoolMax) && parsedPoolMax >= 1 && parsedPoolMax <= 50
    ? parsedPoolMax
    : undefined;
  return {
    connectionString: databaseUrl,
    ...(max ? { max } : {}),
  };
}
