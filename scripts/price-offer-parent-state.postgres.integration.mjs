import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

let pglite;
let server;

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startDatabase() {
  const port = await availablePort();
  pglite = await PGlite.create();
  server = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.ADMIN_EMAIL = '';
}

function offerInput(parents, explicitJob = true) {
  return {
    jobId: explicitJob ? parents.jobId : '',
    objectType: 'Rodinný dom', objectAddress: 'Testovacia 1', municipality: 'Poprad', district: 'Poprad',
    contactPerson: `QA ${parents.label}`, phone: '0900000000', email: `${parents.label.toLowerCase()}@example.invalid`,
    realizationTerm: 'Dohodou', materialType: 'VLNITY_ETERNIT', areaM2: 10, pricePerM2WithoutVat: 10,
    documentationFeeWithoutVat: 0, includeDocumentation: false, documentationPromotion: false,
    includeTransport: false, transportFrom: '', transportTo: '', transportRoundTripKm: 0, transportPricePerKm: 0.7,
    validUntil: '2027-12-31', sourceInquiry: `dopyt:${parents.leadId}`,
  };
}

let db;

async function createParents(label) {
  const submissionId = randomUUID();
  const result = await db.createLeadSubmission({
    submissionId,
    submissionHash: 'b'.repeat(64),
    fullName: `QA ${label}`,
    phone: '0900000000',
    email: `${label.toLowerCase()}@example.invalid`,
    city: 'Poprad', district: 'Poprad', objectType: 'Rodinný dom', materialType: 'Vlnitý eternit',
    areaEstimate: 10, preferredContact: 'Email', gdpr: true, source: 'postgres-parent-integration',
  }, []);
  return { leadId: result.lead.id, jobId: result.businessJobId, label };
}

async function statuses(parents) {
  const result = await pglite.query(
    'SELECT (SELECT status FROM leads WHERE id = $1) AS lead, (SELECT status FROM business_jobs WHERE id = $2) AS job',
    [parents.leadId, parents.jobId],
  );
  return result.rows[0];
}

let exitCode = 0;
try {
  await startDatabase();
  db = await import('../src/server/db.ts');

  const normal = await createParents('PgNormal');
  const normalOffer = await db.savePriceOffer(offerInput(normal), 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(normal), { lead: 'naceneny', job: 'DOPYT' });
  const noSendClaim = await db.claimPriceOfferForSending(normalOffer.id, 'qa-operator@example.invalid');
  await db.finishPriceOfferSending(normalOffer.id, noSendClaim.sendAttemptId, 'not_sent', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(normal), { lead: 'naceneny', job: 'DOPYT' });
  const sentClaim = await db.claimPriceOfferForSending(normalOffer.id, 'qa-operator@example.invalid');
  await db.finishPriceOfferSending(normalOffer.id, sentClaim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(normal), { lead: 'cenova_ponuka_odoslana', job: 'PONUKA_ODOSLANA' });
  await db.updatePriceOfferStatus(normalOffer.id, 'PRIJATA', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(normal), { lead: 'objednane', job: 'PONUKA_POTVRDENA' });

  const advanced = await createParents('PgAdvanced');
  await pglite.query("UPDATE leads SET status = 'dokoncena' WHERE id = $1", [advanced.leadId]);
  await pglite.query("UPDATE business_jobs SET status = 'DOKONCENA' WHERE id = $1", [advanced.jobId]);
  const advancedOffer = await db.savePriceOffer(offerInput(advanced), 'qa-operator@example.invalid');
  const advancedClaim = await db.claimPriceOfferForSending(advancedOffer.id, 'qa-operator@example.invalid');
  await db.finishPriceOfferSending(advancedOffer.id, advancedClaim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  await db.updatePriceOfferStatus(advancedOffer.id, 'PRIJATA', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(advanced), { lead: 'dokoncena', job: 'DOKONCENA' }, 'pokročilé PostgreSQL stavy sa nesmú vrátiť');

  const uncertain = await createParents('PgUncertain');
  const uncertainOffer = await db.savePriceOffer(offerInput(uncertain), 'qa-operator@example.invalid');
  const uncertainClaim = await db.claimPriceOfferForSending(uncertainOffer.id, 'qa-operator@example.invalid');
  await db.finishPriceOfferSending(uncertainOffer.id, uncertainClaim.sendAttemptId, 'unknown', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(uncertain), { lead: 'naceneny', job: 'DOPYT' });
  await assert.rejects(db.confirmUncertainPriceOfferSent(uncertainOffer.id, 'qa-operator@example.invalid', 'voľný text'), /platný interný dôkaz/);
  const confirmed = await db.confirmUncertainPriceOfferSent(uncertainOffer.id, 'qa-operator@example.invalid', 'provider_confirmed');
  assert.equal(confirmed?.status, 'ODOSLANA');
  assert.equal(confirmed?.sendAttemptId, undefined);
  assert.deepEqual(await statuses(uncertain), { lead: 'cenova_ponuka_odoslana', job: 'PONUKA_ODOSLANA' });

  const direct = await createParents('PgDirect');
  const directOffer = await db.savePriceOffer(offerInput(direct, false), 'qa-operator@example.invalid');
  assert.equal(directOffer.jobId, '');
  const directClaim = await db.claimPriceOfferForSending(directOffer.id, 'qa-operator@example.invalid');
  await db.finishPriceOfferSending(directOffer.id, directClaim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(direct), { lead: 'cenova_ponuka_odoslana', job: 'PONUKA_ODOSLANA' });

  const ambiguous = await createParents('PgAmbiguous');
  await pglite.query('DROP INDEX business_jobs_lead_id_uq');
  const columns = await pglite.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'business_jobs'
     ORDER BY ordinal_position`,
  );
  const columnNames = columns.rows.map((row) => String(row.column_name));
  const quotedColumns = columnNames.map((name) => `"${name.replaceAll('"', '""')}"`).join(', ');
  const selectColumns = columnNames.map((name) => name === 'id' ? '$1::uuid' : `"${name.replaceAll('"', '""')}"`).join(', ');
  const secondAmbiguousJobId = randomUUID();
  await pglite.query(
    `INSERT INTO business_jobs (${quotedColumns}) SELECT ${selectColumns} FROM business_jobs WHERE id = $2`,
    [secondAmbiguousJobId, ambiguous.jobId],
  );
  const ambiguousOffer = await db.savePriceOffer(offerInput(ambiguous, false), 'qa-operator@example.invalid');
  const ambiguousClaim = await db.claimPriceOfferForSending(ambiguousOffer.id, 'qa-operator@example.invalid');
  await db.finishPriceOfferSending(ambiguousOffer.id, ambiguousClaim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  const ambiguousJobs = await pglite.query('SELECT status FROM business_jobs WHERE lead_id = $1 ORDER BY id', [ambiguous.leadId]);
  assert.equal((await statuses(ambiguous)).lead, 'cenova_ponuka_odoslana');
  assert.deepEqual(ambiguousJobs.rows.map((row) => row.status), ['DOPYT', 'DOPYT'], 'nejednoznačná väzba nesmie posunúť žiadnu zákazku');

  const rollback = await createParents('PgRollback');
  const rollbackOffer = await db.savePriceOffer(offerInput(rollback), 'qa-operator@example.invalid');
  const rollbackClaim = await db.claimPriceOfferForSending(rollbackOffer.id, 'qa-operator@example.invalid');
  await pglite.query(`ALTER TABLE business_jobs ADD CONSTRAINT qa_forbid_offer_sent
    CHECK (id <> '${rollback.jobId}'::uuid OR status <> 'PONUKA_ODOSLANA')`);
  await assert.rejects(
    db.finishPriceOfferSending(rollbackOffer.id, rollbackClaim.sendAttemptId, 'sent', 'qa-operator@example.invalid'),
    /qa_forbid_offer_sent|check constraint/i,
  );
  assert.equal((await db.getPriceOffer(rollbackOffer.id))?.status, 'ODOSIELA', 'chyba rodiča musí rollbacknúť aj ponuku');
  assert.deepEqual(await statuses(rollback), { lead: 'naceneny', job: 'DOPYT' }, 'chyba rodiča nesmie čiastočne posunúť dopyt');
  await pglite.query('ALTER TABLE business_jobs DROP CONSTRAINT qa_forbid_offer_sent');
  await db.finishPriceOfferSending(rollbackOffer.id, rollbackClaim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(rollback), { lead: 'cenova_ponuka_odoslana', job: 'PONUKA_ODOSLANA' });

  const audits = await pglite.query(
    `SELECT changes FROM audit_logs
     WHERE action LIKE 'price_offer_%' OR changes ? 'reasonCode'`,
  );
  const serializedAuditChanges = JSON.stringify(audits.rows.map((row) => row.changes));
  for (const pii of ['0900000000', '@example.invalid', 'QA PgNormal', 'QA PgAdvanced', 'QA PgUncertain']) {
    assert.doesNotMatch(serializedAuditChanges, new RegExp(pii.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `audit nesmie obsahovať PII: ${pii}`);
  }
  assert.match(serializedAuditChanges, /provider_confirmed/);
  console.log('PASS: PostgreSQL price-offer synchronizácia rodičov má monotónnu paritu, manuálne potvrdenie a transakčný rollback.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try {
    await server?.stop();
    await pglite?.close();
  } catch (error) {
    console.error('Cleanup failed:', error);
    exitCode = 1;
  }
}
process.exit(exitCode);
