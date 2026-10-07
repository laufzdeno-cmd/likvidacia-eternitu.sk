import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = await mkdtemp(join(tmpdir(), 'astana-meta-consent-local-'));
const localDbPath = join(root, 'local-db.json');

function makeLead(submissionId, consentSubject) {
  return {
    submissionId,
    submissionHash: `hash-${submissionId}`,
    fullName: 'Meta local test',
    phone: '0905123456',
    email: 'meta-local@example.invalid',
    city: 'Poprad',
    district: 'Poprad',
    objectType: 'Rodinný dom',
    materialType: 'Vlnitý eternit',
    areaEstimate: 100,
    gdpr: true,
    source: 'isolated-local-test',
    rawData: {
      marketingConsentAtSubmit: true,
      marketingConsentSubjectAtSubmit: consentSubject,
      attribution: { fbclid: 'local-secret-click', landingPath: '/cena-likvidacie-azbestu/' },
    },
  };
}

try {
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.ASTANA_LOCAL_DB_PATH = localDbPath;
  process.env.CONVERSION_EVENT_SECRET = 'isolated-local-conversion-secret';
  const db = await import('../src/server/db.ts');

  const revokedBeforeCreate = randomUUID();
  assert.equal(await db.revokeMetaCapiOutboxForConsentSubject(revokedBeforeCreate), 0);
  const afterTombstone = await db.createLeadSubmission(makeLead(randomUUID(), revokedBeforeCreate), []);
  let local = JSON.parse(await readFile(localDbPath, 'utf8'));
  let storedLead = local.leads.find((lead) => lead.id === afterTombstone.lead.id);
  assert.equal(storedLead.rawData.marketingConsentAtSubmit, undefined);
  assert.equal(storedLead.rawData.marketingConsentSubjectAtSubmit, undefined);
  assert.equal(local.metaCapiOutbox.some((row) => row.leadId === afterTombstone.lead.id), false);

  const missingSecretSubject = randomUUID();
  delete process.env.CONVERSION_EVENT_SECRET;
  process.env.NODE_ENV = 'production';
  process.env.VERCEL_ENV = 'production';
  const withoutOutbox = await db.createLeadSubmission(makeLead(randomUUID(), missingSecretSubject), []);
  local = JSON.parse(await readFile(localDbPath, 'utf8'));
  assert.equal(local.metaCapiOutbox.some((row) => row.leadId === withoutOutbox.lead.id), false);
  assert.equal(await db.revokeMetaCapiOutboxForConsentSubject(missingSecretSubject), 1);
  local = JSON.parse(await readFile(localDbPath, 'utf8'));
  storedLead = local.leads.find((lead) => lead.id === withoutOutbox.lead.id);
  assert.equal(storedLead.rawData.marketingConsentAtSubmit, undefined);
  assert.equal(storedLead.rawData.marketingConsentSubjectAtSubmit, undefined);
  assert.equal(storedLead.rawData.attribution.fbclid, undefined);

  process.env.CONVERSION_EVENT_SECRET = 'isolated-local-conversion-secret';
  process.env.NODE_ENV = 'test';
  delete process.env.VERCEL_ENV;
  const concurrentSubject = randomUUID();
  const [concurrentLead] = await Promise.all([
    db.createLeadSubmission(makeLead(randomUUID(), concurrentSubject), []),
    db.revokeMetaCapiOutboxForConsentSubject(concurrentSubject),
  ]);
  local = JSON.parse(await readFile(localDbPath, 'utf8'));
  storedLead = local.leads.find((lead) => lead.id === concurrentLead.lead.id);
  assert.equal(storedLead.rawData.marketingConsentAtSubmit, undefined);
  assert.equal(storedLead.rawData.marketingConsentSubjectAtSubmit, undefined);
  const concurrentOutbox = local.metaCapiOutbox.find((row) => row.leadId === concurrentLead.lead.id);
  if (concurrentOutbox) {
    assert.equal(concurrentOutbox.status, 'cancelled');
    assert.equal(concurrentOutbox.retryable, false);
  }
  assert.equal(local.metaCapiOutbox.some((row) => row.leadId === concurrentLead.lead.id && row.retryable), false);
  assert.match(JSON.stringify(local.metaCapiConsentRevocations), new RegExp(concurrentSubject, 'i'));

  console.log('PASS: local Meta consent tombstone and create/revoke race; no network or production access.');
} finally {
  await rm(root, { recursive: true, force: true });
}
