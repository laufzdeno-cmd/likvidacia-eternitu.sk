import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';

async function freeLoopbackPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

const makeLead = (submissionId, consent, consentSubject = randomUUID()) => ({
  submissionId,
  submissionHash: `hash-${submissionId}`,
  fullName: 'Meta test',
  phone: '0905123456',
  email: 'meta-test@example.invalid',
  city: 'Poprad',
  district: 'Poprad',
  objectType: 'Rodinný dom',
  materialType: 'Vlnitý eternit',
  areaEstimate: 100,
  gdpr: true,
  source: 'isolated-test',
  rawData: {
    userAgent: 'Isolated test agent',
    ...(consent ? { marketingConsentAtSubmit: true, marketingConsentSubjectAtSubmit: consentSubject, attribution: { fbclid: 'secret-fb-click', gclid: 'secret-google-click', landingPath: '/cena-likvidacie-azbestu/' } } : {}),
  },
});

let database;
let socket;
let inspect;
let exitCode = 0;
try {
  const port = await freeLoopbackPort();
  database = await PGlite.create();
  socket = new PGLiteSocketServer({ db: database, port, host: '127.0.0.1', maxConnections: 8 });
  await socket.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.NEXT_PUBLIC_META_PIXEL_ID = '123456789012345';
  process.env.META_CAPI_ACCESS_TOKEN = 'isolated-secret';
  process.env.META_GRAPH_API_VERSION = 'v99.0';
  process.env.CONVERSION_EVENT_SECRET = 'isolated-stable-conversion-secret';

  const db = await import('../src/server/db.ts');
  const { createAcceptedLeadConversion } = await import('../src/server/lead-conversion.ts');
  inspect = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, idleTimeoutMillis: 1000 });

  const withoutConsentId = randomUUID();
  const withoutConsent = await db.createLeadSubmission(makeLead(withoutConsentId, false), []);
  assert.equal(Number((await inspect.query('SELECT count(*) FROM lead_meta_capi_outbox')).rows[0].count), 0);

  await inspect.query(`CREATE TABLE meta_capi_delivery_outbox (
    event_id uuid PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
    consent_subject uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), event_time timestamptz NOT NULL,
    material text NOT NULL, event_source_url text NOT NULL, client_ip text, client_user_agent text, fbp text, fbc text,
    state text NOT NULL, attempt_count integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 5,
    next_attempt_at timestamptz NOT NULL DEFAULT now(), lease_token uuid, lease_expires_at timestamptz,
    last_attempt_at timestamptz, sent_at timestamptz, last_status integer, last_error_code text, updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  const legacySubject = randomUUID();
  await inspect.query(
    `INSERT INTO meta_capi_delivery_outbox
      (event_id,consent_subject,event_time,material,event_source_url,client_ip,client_user_agent,fbp,fbc,state)
     VALUES ($1,$2,now(),'vlnity','https://likvidacia-eternitu.sk/cena-likvidacie-azbestu/','192.0.2.1','legacy-agent','fbp-secret','fbc-secret','pending')`,
    [withoutConsent.lead.id, legacySubject],
  );
  await db.migrateLegacyMetaCapiOutbox(inspect);
  const migrated = (await inspect.query('SELECT * FROM lead_meta_capi_outbox WHERE lead_id=$1', [withoutConsent.lead.id])).rows[0];
  assert.equal(migrated.event_id, createAcceptedLeadConversion(withoutConsentId, 'Vlnitý eternit').eventId);
  assert.equal(migrated.consent_subject, legacySubject);
  const legacyTerminal = (await inspect.query('SELECT * FROM meta_capi_delivery_outbox WHERE event_id=$1', [withoutConsent.lead.id])).rows[0];
  assert.equal(legacyTerminal.state, 'permanently_failed');
  assert.equal(legacyTerminal.last_error_code, 'migrated_to_privacy_safe_outbox');
  for (const field of ['client_ip', 'client_user_agent', 'fbp', 'fbc']) assert.equal(legacyTerminal[field], null);
  assert.equal(await db.revokeMetaCapiOutboxForConsentSubject(legacySubject), 1);

  const consentId = randomUUID();
  const sentSubject = randomUUID();
  const accepted = await db.createLeadSubmission(makeLead(consentId, true, sentSubject), []);
  const stored = await inspect.query('SELECT * FROM lead_meta_capi_outbox WHERE lead_id=$1', [accepted.lead.id]);
  assert.equal(stored.rowCount, 1);
  assert.equal(stored.rows[0].event_id, createAcceptedLeadConversion(consentId, 'Vlnitý eternit').eventId);
  for (const forbidden of ['email', 'phone', 'client_ip', 'client_user_agent', 'fbp', 'fbc']) {
    assert.equal(Object.hasOwn(stored.rows[0], forbidden), false, `outbox must not contain ${forbidden}`);
  }

  const concurrent = await Promise.all([db.claimMetaCapiOutboxEvents(1), db.claimMetaCapiOutboxEvents(1)]);
  assert.equal(concurrent.flat().length, 1, 'one event may be claimed by only one worker');
  const firstClaim = concurrent.flat()[0];
  let senderCalls = 0;
  const firstInput = await db.prepareClaimedMetaCapiEvent(firstClaim);
  assert.ok(firstInput);
  const firstOutcome = await (async (event) => {
    senderCalls += 1;
    assert.equal(event.eventId, createAcceptedLeadConversion(consentId, 'Vlnitý eternit').eventId);
    return { status: 'sent', httpStatus: 200, retryable: false };
  })(firstInput);
  const sent = await db.settleClaimedMetaCapiEvent(firstClaim, firstOutcome);
  assert.equal(sent, 'sent');
  assert.equal(senderCalls, 1);
  assert.equal(await db.revokeMetaCapiOutboxForConsentSubject(sentSubject), 1);
  const sentAfterRevoke = (await inspect.query('SELECT status,retryable FROM lead_meta_capi_outbox WHERE lead_id=$1', [accepted.lead.id])).rows[0];
  assert.deepEqual(sentAfterRevoke, { status: 'sent', retryable: false });
  const sentRevokedRaw = (await inspect.query('SELECT raw_data FROM leads WHERE id=$1', [accepted.lead.id])).rows[0].raw_data;
  assert.equal(sentRevokedRaw.marketingConsentAtSubmit, undefined);
  assert.equal(sentRevokedRaw.marketingConsentSubjectAtSubmit, undefined);
  assert.equal(sentRevokedRaw.attribution.fbclid, undefined);

  const revokeId = randomUUID();
  const revokedLead = await db.createLeadSubmission(makeLead(revokeId, true), []);
  const [revokeClaim] = await db.claimMetaCapiOutboxEvents(1);
  assert.equal(revokeClaim.eventId, createAcceptedLeadConversion(revokeId, 'Vlnitý eternit').eventId);
  assert.equal(await db.revokeMetaCapiConsentForLead(revokedLead.lead.id, 'isolated-test'), 1);
  let revokedSenderCalls = 0;
  const revokedInput = await db.prepareClaimedMetaCapiEvent(revokeClaim);
  if (revokedInput) revokedSenderCalls += 1;
  assert.equal(revokedInput, null, 'revocation invalidates the previous claim');
  assert.equal(revokedSenderCalls, 0);
  const revokedRaw = (await inspect.query('SELECT raw_data FROM leads WHERE id=$1', [revokedLead.lead.id])).rows[0].raw_data;
  assert.equal(revokedRaw.marketingConsentAtSubmit, undefined);
  assert.equal(revokedRaw.attribution.fbclid, undefined);
  assert.equal(revokedRaw.attribution.gclid, undefined);

  const subjectRevokeId = randomUUID();
  const subject = randomUUID();
  const subjectRevokedLead = await db.createLeadSubmission(makeLead(subjectRevokeId, true, subject), []);
  const [subjectClaim] = await db.claimMetaCapiOutboxEvents(1);
  assert.equal(subjectClaim.eventId, createAcceptedLeadConversion(subjectRevokeId, 'Vlnitý eternit').eventId);
  assert.equal(await db.revokeMetaCapiOutboxForConsentSubject(subject), 1);
  assert.equal(await db.prepareClaimedMetaCapiEvent(subjectClaim), null);
  const subjectRevokedOutbox = (await inspect.query('SELECT status,retryable FROM lead_meta_capi_outbox WHERE lead_id=$1', [subjectRevokedLead.lead.id])).rows[0];
  assert.deepEqual(subjectRevokedOutbox, { status: 'unknown', retryable: false }, 'revoked in-flight send remains terminal and is never retried');
  assert.equal(await db.settleClaimedMetaCapiEvent(subjectClaim, { status: 'sent', retryable: false, httpStatus: 200 }), null, 'a late sender result loses its invalidated claim and cannot overwrite revoked state');
  const subjectAfterLateSettle = (await inspect.query('SELECT status,retryable FROM lead_meta_capi_outbox WHERE lead_id=$1', [subjectRevokedLead.lead.id])).rows[0];
  assert.deepEqual(subjectAfterLateSettle, { status: 'unknown', retryable: false });
  assert.equal((await db.claimMetaCapiOutboxEvents(1)).length, 0, 'revoked in-flight state is not claimable again');
  const subjectRevokedRaw = (await inspect.query('SELECT raw_data FROM leads WHERE id=$1', [subjectRevokedLead.lead.id])).rows[0].raw_data;
  assert.equal(subjectRevokedRaw.marketingConsentSubjectAtSubmit, undefined);

  const missingSecretSubject = randomUUID();
  const previousConversionSecret = process.env.CONVERSION_EVENT_SECRET;
  const previousNodeEnvironment = process.env.NODE_ENV;
  const previousVercelIdentity = process.env.VERCEL;
  const previousVercelEnvironment = process.env.VERCEL_ENV;
  const previousVercelTargetEnvironment = process.env.VERCEL_TARGET_ENV;
  delete process.env.CONVERSION_EVENT_SECRET;
  process.env.NODE_ENV = 'production';
  process.env.VERCEL = '1';
  process.env.VERCEL_ENV = 'production';
  process.env.VERCEL_TARGET_ENV = 'production';
  const missingSecretId = randomUUID();
  const missingSecretLead = await db.createLeadSubmission(makeLead(missingSecretId, true, missingSecretSubject), []);
  assert.equal(
    Number((await inspect.query('SELECT count(*) FROM lead_meta_capi_outbox WHERE lead_id=$1', [missingSecretLead.lead.id])).rows[0].count),
    0,
    'a missing conversion secret must fail closed without creating an event',
  );
  assert.equal(await db.revokeMetaCapiOutboxForConsentSubject(missingSecretSubject), 1, 'revocation must still find a lead without an outbox row');
  const missingSecretRaw = (await inspect.query('SELECT raw_data FROM leads WHERE id=$1', [missingSecretLead.lead.id])).rows[0].raw_data;
  assert.equal(missingSecretRaw.marketingConsentAtSubmit, undefined);
  assert.equal(missingSecretRaw.marketingConsentSubjectAtSubmit, undefined);
  assert.equal(missingSecretRaw.attribution.fbclid, undefined);
  process.env.CONVERSION_EVENT_SECRET = previousConversionSecret;
  process.env.NODE_ENV = previousNodeEnvironment;
  if (previousVercelIdentity === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = previousVercelIdentity;
  if (previousVercelEnvironment === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previousVercelEnvironment;
  if (previousVercelTargetEnvironment === undefined) delete process.env.VERCEL_TARGET_ENV;
  else process.env.VERCEL_TARGET_ENV = previousVercelTargetEnvironment;

  const afterRevocationId = randomUUID();
  const afterRevocationLead = await db.createLeadSubmission(makeLead(afterRevocationId, true, missingSecretSubject), []);
  const afterRevocationRaw = (await inspect.query('SELECT raw_data FROM leads WHERE id=$1', [afterRevocationLead.lead.id])).rows[0].raw_data;
  assert.equal(afterRevocationRaw.marketingConsentAtSubmit, undefined, 'a consent tombstone must neutralize a later submission');
  assert.equal(afterRevocationRaw.marketingConsentSubjectAtSubmit, undefined);
  assert.equal(
    Number((await inspect.query('SELECT count(*) FROM lead_meta_capi_outbox WHERE lead_id=$1', [afterRevocationLead.lead.id])).rows[0].count),
    0,
    'a later submission for a revoked subject must never enqueue Meta delivery',
  );

  const concurrentSubject = randomUUID();
  const concurrentId = randomUUID();
  const [concurrentLead] = await Promise.all([
    db.createLeadSubmission(makeLead(concurrentId, true, concurrentSubject), []),
    db.revokeMetaCapiOutboxForConsentSubject(concurrentSubject),
  ]);
  const concurrentRaw = (await inspect.query('SELECT raw_data FROM leads WHERE id=$1', [concurrentLead.lead.id])).rows[0].raw_data;
  assert.equal(concurrentRaw.marketingConsentAtSubmit, undefined, 'create/revoke race must finish with consent removed');
  assert.equal(concurrentRaw.marketingConsentSubjectAtSubmit, undefined);
  const concurrentOutbox = await inspect.query('SELECT status,retryable FROM lead_meta_capi_outbox WHERE lead_id=$1', [concurrentLead.lead.id]);
  if (concurrentOutbox.rowCount) assert.deepEqual(concurrentOutbox.rows[0], { status: 'cancelled', retryable: false });
  assert.equal(
    Number((await inspect.query("SELECT count(*) FROM lead_meta_capi_outbox WHERE lead_id=$1 AND retryable=true", [concurrentLead.lead.id])).rows[0].count),
    0,
    'no race ordering may leave a deliverable event behind',
  );

  const staleId = randomUUID();
  const staleLead = await db.createLeadSubmission(makeLead(staleId, true), []);
  const [staleClaim] = await db.claimMetaCapiOutboxEvents(1);
  await inspect.query("UPDATE lead_meta_capi_outbox SET claimed_until=now()-interval '1 minute' WHERE id=$1", [staleClaim.id]);
  const [reclaimed] = await db.claimMetaCapiOutboxEvents(1);
  assert.equal(reclaimed.eventId, createAcceptedLeadConversion(staleId, 'Vlnitý eternit').eventId);
  assert.equal(reclaimed.attempt, 2);
  const reclaimedInput = await db.prepareClaimedMetaCapiEvent(reclaimed);
  assert.ok(reclaimedInput);
  assert.equal(reclaimedInput.eventId, createAcceptedLeadConversion(staleId, 'Vlnitý eternit').eventId, 'retry must preserve the original event_id');
  await db.settleClaimedMetaCapiEvent(reclaimed, { status: 'unknown', retryable: true, errorCode: 'transport_unknown' });
  const unknownRow = (await inspect.query('SELECT status,retryable FROM lead_meta_capi_outbox WHERE lead_id=$1', [staleLead.lead.id])).rows[0];
  assert.deepEqual(unknownRow, { status: 'unknown', retryable: true });

  const deleteId = randomUUID();
  const deletedLead = await db.createLeadSubmission(makeLead(deleteId, true), []);
  await db.archiveLead(deletedLead.lead.id, 'isolated-test', 'isolated cleanup');
  await db.destroyArchivedLead(deletedLead.lead.id, 'isolated-test', 'isolated cleanup');
  assert.equal(Number((await inspect.query('SELECT count(*) FROM lead_meta_capi_outbox WHERE lead_id=$1', [deletedLead.lead.id])).rows[0].count), 0);

  const audits = await inspect.query("SELECT changes::text FROM audit_logs WHERE action LIKE 'meta_capi_%'");
  const auditText = audits.rows.map((row) => row.changes).join('\n');
  assert.doesNotMatch(auditText, /meta-test@example\.invalid|0905123456|secret-fb-click|secret-google-click/);
  console.log('PASS: isolated Meta CAPI outbox; no real fetch, form, email or production action.');
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  try { await inspect?.end(); } catch (error) { exitCode = 1; console.error(error); }
  process.exit(exitCode);
}
