import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SEARCH_PATH;

if (!databaseUrl) throw new Error('DATABASE_URL is required.');
if (!schema || !/^preview_[a-z0-9_]+$/.test(schema)) {
  throw new Error('DATABASE_SEARCH_PATH must be an explicit preview_* schema.');
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  const result = await client.query(
    'SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1',
    [schema],
  );
  if (result.rowCount !== 1) throw new Error(`Preview schema ${schema} was not created.`);
  console.log(`Preview schema ready: ${schema}`);
} finally {
  await client.end();
}
