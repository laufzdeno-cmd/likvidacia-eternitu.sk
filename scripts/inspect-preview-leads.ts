import { Client } from 'pg';

const schema = process.env.DATABASE_SEARCH_PATH || 'preview_gate2_20260813';
if (!/^preview_[a-z0-9_]+$/.test(schema)) throw new Error('Refusing to inspect a non-preview schema.');

const client = new Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const { rows } = await client.query(
  `select *
   from ${schema}.leads
   order by created_at`,
);
console.log(JSON.stringify(rows, null, 2));
await client.end();
