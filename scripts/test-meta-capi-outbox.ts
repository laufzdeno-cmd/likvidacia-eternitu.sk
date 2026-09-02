import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

async function main() {
const testDirectory = await mkdtemp(path.join(os.tmpdir(), 'astana-meta-outbox-'));
process.env.ASTANA_LOCAL_DB_PATH = path.join(testDirectory, 'local-db.json');
process.env.DATABASE_URL = '';
process.env.CRON_SECRET = 'test-cron-secret';

const {
  claimMetaCapiOutboxEvents,
  createLeadWithMetaCapiOutbox,
  getMetaCapiOutboxStatus,
  revokeMetaCapiOutboxForConsentSubject,
  settleMetaCapiOutboxEvent,
} = await import('../src/server/db');
const { cronAuthorizationStatus } = await import('../src/server/cron-auth');

let leadCounter = 0;

function leadInput() {
  leadCounter += 1;
  return {
    fullName: `Testovací zákazník ${leadCounter}`,
    phone: '0905217946',
    email: `meta-outbox-${leadCounter}@example.test`,
    city: 'Nitra',
    district: 'Nitra',
    objectType: 'Rodinný dom',
    materialType: 'Vlnitý eternit',
    areaEstimate: 120,
    gdpr: true,
    source: 'test',
  };
}

function outboxInput(consentSubject?: string) {
  return {
    consentSubject: consentSubject || randomUUID(),
    material: 'vlnity' as const,
    eventSourceUrl: 'https://www.likvidacia-eternitu.sk/#dopyt',
    clientIp: '203.0.113.10',
    clientUserAgent: 'ASTANA Meta outbox test',
    fbp: 'fb.1.1.test',
    fbc: 'fb.1.1.test',
  };
}

async function createQueuedLead(consentSubject?: string) {
  const created = await createLeadWithMetaCapiOutbox(leadInput(), randomUUID(), outboxInput(consentSubject));
  assert.equal(created.created, true);
  assert.equal(created.outboxQueued, true);
  assert.equal(created.businessJob.leadId, created.lead.id, 'Nový lead musí mať naviazanú presne jednu zákazku.');
  return created;
}

try {
  // 1. Jeden dopyt vytvorí presne jeden trvalý záznam vo fronte.
  const first = await createQueuedLead();
  const firstStatus = await getMetaCapiOutboxStatus(first.lead.id);
  assert.equal(firstStatus?.state, 'pending');

  // 2. Úspešné odoslanie prejde do sent.
  const firstClaim = await claimMetaCapiOutboxEvents({ limit: 1 });
  assert.equal(firstClaim[0]?.eventId, first.lead.id);
  await settleMetaCapiOutboxEvent(first.lead.id, firstClaim[0]?.leaseToken || '', { sent: true, status: 200 });
  assert.equal((await getMetaCapiOutboxStatus(first.lead.id))?.state, 'sent');

  // 3.–5. Dočasná chyba sa opakuje so stabilným event_id a event_time.
  const retry = await createQueuedLead();
  const retryClaim = await claimMetaCapiOutboxEvents({ limit: 1 });
  assert.equal(retryClaim[0]?.eventId, retry.lead.id);
  assert.equal(retryClaim[0]?.eventTime, retry.lead.createdAt);
  await settleMetaCapiOutboxEvent(retry.lead.id, retryClaim[0]?.leaseToken || '', { sent: false, status: 503 });
  const retryStatus = await getMetaCapiOutboxStatus(retry.lead.id);
  assert.equal(retryStatus?.state, 'retrying');
  assert.equal(retryStatus?.eventId, retry.lead.id);
  assert.equal(retryStatus?.eventTime, retry.lead.createdAt);

  // 6. Po páde workeru prevezme expirovaný prenájom ďalší worker.
  const restart = await createQueuedLead();
  const restartClaim = await claimMetaCapiOutboxEvents({ limit: 1 });
  const recovered = await claimMetaCapiOutboxEvents({ limit: 10, at: new Date(Date.now() + 3 * 60_000) });
  assert.ok(recovered.some((item) => item.eventId === restart.lead.id));
  assert.ok(restartClaim.some((item) => item.eventId === restart.lead.id));

  // 7. Dvaja dispatcheri nemôžu získať tú istú udalosť súčasne.
  const concurrent = await createQueuedLead();
  const [dispatcherA, dispatcherB] = await Promise.all([
    claimMetaCapiOutboxEvents({ limit: 50 }),
    claimMetaCapiOutboxEvents({ limit: 50 }),
  ]);
  const concurrentClaims = [...dispatcherA, ...dispatcherB].filter((item) => item.eventId === concurrent.lead.id);
  assert.equal(concurrentClaims.length, 1);

  // 8. Opakované dočasné chyby skončia stabilne v permanently_failed.
  const exhausted = await createQueuedLead();
  let nextAttemptAt = new Date();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const claims = await claimMetaCapiOutboxEvents({ limit: 50, at: nextAttemptAt });
    const claim = claims.find((item) => item.eventId === exhausted.lead.id);
    assert.ok(claim);
    await settleMetaCapiOutboxEvent(exhausted.lead.id, claim?.leaseToken || '', { sent: false, status: 503, at: nextAttemptAt });
    const status = await getMetaCapiOutboxStatus(exhausted.lead.id);
    nextAttemptAt = new Date(status?.nextAttemptAt || Date.now() + 4 * 60_000);
  }
  assert.equal((await getMetaCapiOutboxStatus(exhausted.lead.id))?.state, 'permanently_failed');

  // 9. Rovnaký submissionId nevytvorí druhý dopyt ani druhú udalosť.
  const submissionId = randomUUID();
  const duplicateFirst = await createLeadWithMetaCapiOutbox(leadInput(), submissionId, outboxInput());
  const duplicateSecond = await createLeadWithMetaCapiOutbox(leadInput(), submissionId, outboxInput());
  assert.equal(duplicateFirst.created, true);
  assert.equal(duplicateSecond.created, false);
  assert.equal(duplicateFirst.lead.id, duplicateSecond.lead.id);
  assert.equal(duplicateFirst.businessJob.id, duplicateSecond.businessJob.id);
  assert.equal(duplicateSecond.outboxQueued, false, 'Retry nesmie vytvoriť ani znovu zaradiť CAPI udalosť.');
  assert.equal((await getMetaCapiOutboxStatus(duplicateFirst.lead.id))?.eventId, duplicateFirst.lead.id);

  // 10. Odvolanie súhlasu pred ďalším pokusom zablokuje opakovanie.
  const consentSubject = randomUUID();
  const revoked = await createQueuedLead(consentSubject);
  const revokeClaim = (await claimMetaCapiOutboxEvents({ limit: 50 })).find((item) => item.eventId === revoked.lead.id);
  assert.ok(revokeClaim);
  await settleMetaCapiOutboxEvent(revoked.lead.id, revokeClaim?.leaseToken || '', { sent: false, status: 503 });
  assert.equal(await revokeMetaCapiOutboxForConsentSubject(consentSubject), 1);
  assert.equal((await getMetaCapiOutboxStatus(revoked.lead.id))?.state, 'permanently_failed');
  const afterRevocation = await claimMetaCapiOutboxEvents({ limit: 50, at: new Date(Date.now() + 2 * 60 * 60_000) });
  assert.equal(afterRevocation.some((item) => item.eventId === revoked.lead.id), false);

  // 11. Cron odmietne požiadavku bez tajného Authorization headera.
  const unauthorized = cronAuthorizationStatus(new Request('https://www.likvidacia-eternitu.sk/api/cron/meta-capi'));
  assert.equal(unauthorized, 401);

  console.log('PASS: 11/11 Meta CAPI outbox checks');
} finally {
  await rm(testDirectory, { recursive: true, force: true });
}
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
