import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolConfig } from 'pg';
import {
  deploymentDatabaseIdentity,
  isVerifiedIsolatedStaging,
  stagingDatabaseMarkerMatches,
  type DeploymentSafetyEnvironment,
} from '../src/server/preview-safety';

type QueryResult = { rowCount: number | null; rows: Array<Record<string, unknown>> };
type StagingClient = {
  query: (sql: string, values?: unknown[]) => Promise<QueryResult>;
  release: () => void;
};
type StagingPool = {
  connect: () => Promise<StagingClient>;
  end: () => Promise<void>;
};
type StagingPoolFactory = (config: PoolConfig) => StagingPool;

function parseArguments(argv: string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name !== '--confirm-project' && name !== '--confirm-database-resource') {
      throw new Error(`Neznámy parameter: ${name}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Parameter ${name} nemá hodnotu.`);
    if (values.has(name)) throw new Error(`Parameter ${name} bol zadaný viackrát.`);
    values.set(name, value);
    index += 1;
  }
  for (const name of ['--confirm-project', '--confirm-database-resource']) {
    if (!values.has(name)) throw new Error(`Chýba povinný parameter ${name}.`);
  }
  return {
    projectId: values.get('--confirm-project')!,
    databaseResourceId: values.get('--confirm-database-resource')!,
  };
}

function stagingValidationEnvironment(environment: DeploymentSafetyEnvironment) {
  return {
    ...environment,
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_TARGET_ENV: 'staging',
  } satisfies DeploymentSafetyEnvironment;
}

export function stagingDatabaseSsl(connectionString: string) {
  if (!deploymentDatabaseIdentity(connectionString)) {
    throw new Error('Databázová URL obsahuje nepovolený cieľ alebo TLS nastavenie.');
  }
  const parsed = new URL(connectionString);
  const hostname = parsed.hostname.trim().toLowerCase().replace(/\.$/, '');
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return undefined;
  return { rejectUnauthorized: true } as const;
}

export function stagingDatabasePoolConfig(connectionString: string): PoolConfig {
  const parsed = new URL(connectionString);
  const database = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  const hostname = parsed.hostname.replace(/^\[(.*)\]$/, '$1');
  return {
    host: hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 5432,
    database,
    user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    ssl: stagingDatabaseSsl(connectionString),
    max: 1,
    connectionTimeoutMillis: 5_000,
  };
}

export async function bootstrapStagingDatabase({
  argv = process.argv.slice(2),
  environment = process.env,
  poolFactory = (config: PoolConfig): StagingPool => new Pool(config) as unknown as StagingPool,
}: {
  argv?: string[];
  environment?: DeploymentSafetyEnvironment;
  poolFactory?: StagingPoolFactory;
} = {}) {
  const confirmed = parseArguments(argv);
  const validatedEnvironment = stagingValidationEnvironment(environment);
  if (confirmed.projectId !== validatedEnvironment.VERCEL_PROJECT_ID?.trim()) {
    throw new Error('Potvrdené Vercel project ID sa nezhoduje so staging konfiguráciou.');
  }
  if (confirmed.databaseResourceId !== validatedEnvironment.DATABASE_RESOURCE_ID?.trim()) {
    throw new Error('Potvrdené database resource ID sa nezhoduje so staging konfiguráciou.');
  }
  if (!isVerifiedIsolatedStaging(validatedEnvironment)) {
    throw new Error('Staging zdroje nemajú úplnú bezpečnú väzbu; databáza sa nemenila.');
  }

  const connectionString = validatedEnvironment.DATABASE_URL!.trim();
  const marker = validatedEnvironment.STAGING_DATABASE_MARKER!.trim().toLowerCase();
  const pool = poolFactory(stagingDatabasePoolConfig(connectionString));
  let client: StagingClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [1377690931, 2]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS astana_environment_guard (
        environment text PRIMARY KEY,
        marker text NOT NULL
      )
    `);
    await client.query(
      "INSERT INTO astana_environment_guard (environment, marker) VALUES ('staging', $1) ON CONFLICT (environment) DO NOTHING",
      [marker],
    );
    const stored = await client.query(
      "SELECT marker FROM astana_environment_guard WHERE environment = 'staging' FOR UPDATE",
    );
    if (stored.rowCount !== 1 || !stagingDatabaseMarkerMatches(stored.rows[0]?.marker, validatedEnvironment)) {
      throw new Error('Staging databáza už obsahuje inú identitu; zmena bola vrátená späť.');
    }
    await client.query('COMMIT');
    return { databaseResourceId: confirmed.databaseResourceId, status: 'ready' as const };
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

const isDirectInvocation = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectInvocation) {
  bootstrapStagingDatabase()
    .then((result) => console.log(`PASS: staging databáza ${result.databaseResourceId} má overený identifikačný marker.`))
    .catch((error) => {
      console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
