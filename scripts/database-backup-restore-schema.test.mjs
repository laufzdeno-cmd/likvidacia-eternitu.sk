import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('fresh database schema recreates the legacy Google Ads order counter carried by backups', async () => {
  const database = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert.match(database, /CREATE TABLE IF NOT EXISTS astana_google_ads_order_counters \([\s\S]*?order_date text NOT NULL,[\s\S]*?domain_code text NOT NULL,[\s\S]*?last_value integer NOT NULL CHECK \(last_value >= 1 AND last_value <= 999999\),[\s\S]*?PRIMARY KEY \(order_date, domain_code\)[\s\S]*?\);/);
});

test('fresh database schema preserves all legacy delivery evidence carried by backups', async () => {
  const database = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  for (const table of [
    'lead_email_delivery_outbox',
    'meta_capi_delivery_outbox',
    'meta_capi_outbox',
    'meta_conversion_outbox',
    'schema_migrations',
  ]) {
    assert.match(database, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`));
  }
  assert.match(database, /lead_email_delivery_outbox[\s\S]*?UNIQUE \(lead_id, kind\)/);
  assert.match(database, /meta_capi_delivery_outbox[\s\S]*?event_id uuid PRIMARY KEY REFERENCES leads\(id\) ON DELETE CASCADE/);
  assert.match(database, /meta_conversion_outbox[\s\S]*?lead_id uuid NOT NULL REFERENCES leads\(id\) ON DELETE CASCADE/);
  assert.match(database, /New code never writes to these[\s\S]*?restored without silently dropping historical operational evidence/);
});
