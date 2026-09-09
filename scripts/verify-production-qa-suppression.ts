import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const origin = 'https://likvidacia-eternitu.sk';
const now = Date.now();
const email = `qa-production-${now}@example.test`;
const submissionId = `qa-production-${now}`;

async function acceptedCookie() {
  const response = await fetch(`${origin}/api/consent/`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice: 'accepted' }),
  });
  assert.equal(response.status, 200, 'production consent endpoint is available');
  const value = response.headers.getSetCookie().find((item) => item.startsWith('astana_marketing_consent_v1='));
  assert.ok(value, 'production returned signed consent cookie');
  return value.split(';', 1)[0];
}

function form() {
  return new URLSearchParams({
    fullName: `QA-PROD-${now}`,
    phone: '+421900000000',
    email,
    city: 'Poprad',
    district: 'Poprad',
    objectType: 'Rodinný dom',
    materialType: 'Vlnitý eternit',
    areaEstimate: '120',
    preferredContact: 'Zavolajte mi',
    term: 'Čo najskôr',
    note: `Kontrolovaný QA test ${now}.`,
    gdpr: 'on',
    submissionId,
  });
}

async function submit(cookie: string) {
  const response = await fetch(`${origin}/api/lead/`, {
    method: 'POST',
    headers: { Origin: origin, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: form(),
  });
  return { response, json: await response.json() as Record<string, unknown> };
}

const cookie = await acceptedCookie();
const first = await submit(cookie);
assert.equal(first.response.status, 200, 'QA form request is stored');
assert.equal(first.json.isQa, true, 'QA lead is classified server-side');
assert.equal(first.json.conversionEligible, false, 'QA lead cannot trigger an Ads conversion');
assert.equal(first.json.duplicate, false, 'first QA request is not a duplicate');
assert.equal(typeof first.json.leadId, 'string', 'QA lead has an auditable id');

const second = await submit(cookie);
assert.equal(second.response.status, 200, 'repeat QA request is idempotently accepted');
assert.equal(second.json.duplicate, true, 'repeat QA request is explicitly marked duplicate');
assert.equal(second.json.conversionEligible, false, 'repeat QA request cannot trigger an Ads conversion');
assert.equal(second.json.leadId, first.json.leadId, 'duplicate resolves to the original lead');

const connectionString = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
if (!connectionString) throw new Error('DATABASE_URL or POSTGRES_URL is required to archive the QA trace');
const db = new Pool({ connectionString });
try {
  const leadId = String(first.json.leadId);
  const lead = await db.query<{ id: string; status: string; google_ads_order_id: string | null }>(
    'SELECT id, status, google_ads_order_id FROM leads WHERE id = $1 AND email = $2',
    [leadId, email],
  );
  assert.equal(lead.rowCount, 1, 'one QA lead was created');
  assert.ok(lead.rows[0]?.google_ads_order_id, 'QA lead has one order id for auditability');

  const audit = await db.query<{ action: string; changes: { isQa?: boolean; conversionEligible?: boolean } }>(
    `SELECT action, changes FROM audit_logs
     WHERE entity_type = 'lead' AND entity_id = $1 AND action = 'measurement_eligibility'
     ORDER BY created_at DESC LIMIT 1`,
    [leadId],
  );
  assert.equal(audit.rowCount, 1, 'measurement decision is audit logged');
  assert.equal(audit.rows[0]?.changes.isQa, true, 'audit log records QA classification');
  assert.equal(audit.rows[0]?.changes.conversionEligible, false, 'audit log records conversion suppression');

  await db.query('BEGIN');
  await db.query("UPDATE leads SET status = 'archivovane', updated_at = now() WHERE id = $1", [leadId]);
  await db.query('UPDATE business_jobs SET deleted_at = now(), updated_at = now() WHERE customer_email = $1 AND deleted_at IS NULL', [email]);
  await db.query(
    'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
    [randomUUID(), 'lead', leadId, 'qa_soft_archived', 'system', { email, reason: 'production QA measurement suppression test' }],
  );
  await db.query('COMMIT');

  const archived = await db.query<{ status: string }>('SELECT status FROM leads WHERE id = $1', [leadId]);
  assert.equal(archived.rows[0]?.status, 'archivovane', 'QA lead was soft-archived after the test');

  // A first test attempt may have reached the API before a local DB connection
  // failed. Archive only explicitly marked production QA traces from this run.
  const leftovers = await db.query<{ id: string; email: string }>(
    `SELECT id, email FROM leads
     WHERE email LIKE 'qa-production-%@example.test'
       AND created_at > now() - interval '2 hours'
       AND status <> 'archivovane'`,
  );
  for (const leftover of leftovers.rows) {
    await db.query("UPDATE leads SET status = 'archivovane', updated_at = now() WHERE id = $1", [leftover.id]);
    await db.query('UPDATE business_jobs SET deleted_at = now(), updated_at = now() WHERE customer_email = $1 AND deleted_at IS NULL', [leftover.email]);
    await db.query(
      'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
      [randomUUID(), 'lead', leftover.id, 'qa_soft_archived', 'system', { email: leftover.email, reason: 'recovery after QA test database connection failure' }],
    );
  }
  assert.equal(leftovers.rowCount, 0, 'no active production QA traces remain');
  console.log(`PASS — QA form ${leadId} was stored once, duplicate-suppressed, Ads-ineligible, audit-logged, and soft-archived.`);
} catch (error) {
  await db.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await db.end();
}
