import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('local lead email cannot send archived work and permanent deletion clears outbox and legacy audit PII', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'astana-lead-email-safety-'));
  const dbPath = path.join(directory, 'local-db.json');
  const oldEnv = Object.fromEntries(['DATABASE_URL', 'ASTANA_LOCAL_DB_PATH', 'NODE_ENV', 'LEAD_EMAIL_DELIVERY_MODE', 'SMTP_HOST', 'LEAD_TO_EMAIL', 'FROM_EMAIL', 'AUTH_SECRET']
    .map((key) => [key, process.env[key]]));
  process.env.DATABASE_URL = '';
  process.env.ASTANA_LOCAL_DB_PATH = dbPath;
  process.env.NODE_ENV = 'test';
  process.env.LEAD_EMAIL_DELIVERY_MODE = 'smtp_then_local_relay';
  process.env.SMTP_HOST = 'smtp.invalid';
  process.env.LEAD_TO_EMAIL = 'admin@astana.sk';
  process.env.FROM_EMAIL = 'info@astana.sk';
  process.env.AUTH_SECRET = 'local-isolated-test-secret';
  try {
    const db = await import('../src/server/db.ts');
    const { canManuallyRetryLeadEmail } = await import('../src/server/mail.ts');
    assert.equal(canManuallyRetryLeadEmail(), true, 'configured hybrid uses SMTP for manual retry');
    delete process.env.SMTP_HOST;
    assert.equal(canManuallyRetryLeadEmail(), false, 'hybrid without SMTP cannot offer manual retry');
    process.env.SMTP_HOST = '   ';
    assert.equal(canManuallyRetryLeadEmail(), false, 'blank SMTP host is not configured');
    process.env.SMTP_HOST = 'smtp.invalid';
    process.env.LEAD_EMAIL_DELIVERY_MODE = 'local_relay';
    assert.equal(canManuallyRetryLeadEmail(), true, 'local relay permits explicit single-recipient SMTP recovery when configured');
    delete process.env.SMTP_HOST;
    assert.equal(canManuallyRetryLeadEmail(), false, 'local relay without SMTP cannot offer single-recipient recovery');
    process.env.SMTP_HOST = 'smtp.invalid';
    process.env.LEAD_EMAIL_DELIVERY_MODE = 'smtp_then_local_relay';
    const submissionId = randomUUID();
    const created = await db.createLeadSubmission({
      submissionId, submissionHash: `safety-${submissionId}`, fullName: 'Test lokálnej bezpečnosti',
      phone: '+421900000001', email: 'test@example.invalid', city: 'Poprad', district: 'Poprad',
      objectType: 'Rodinný dom', materialType: 'Vlnitý eternit', areaEstimate: 100,
      preferredContact: 'Emailom', term: 'Do mesiaca', note: 'Izolovaný test', gdpr: true, source: 'integration-test',
    }, []);
    const id = created.lead.id;
    assert.ok((await db.listPendingLeadEmailDeliveries()).some((row) => row.lead.id === id));
    const token = await db.claimLeadEmailOutbox(id, 'internal');
    assert.ok(token);
    assert.equal(await db.archiveLead(id, 'admin@example.invalid', 'Aktívne odosielanie'), null);
    assert.equal(await db.recordLeadEmailRecipientResult(id, 'internal', {
      status: 'unknown', reason: 'SMTP error customer-pii@example.invalid', messageId: '<customer-pii@example.invalid>',
    }, token), true);
    let snapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    const internal = snapshot.leadEmailOutbox.find((row) => row.leadId === id && row.recipientRole === 'internal');
    assert.match(internal.messageId, /^hmac-sha256:[a-f0-9]{64}$/);
    assert.doesNotMatch(JSON.stringify(internal), /customer-pii@example\.invalid/);
    assert.doesNotMatch(JSON.stringify(snapshot.auditLogs.find((row) => row.entityId === id && row.action === 'lead_email_delivery_unknown')), /customer-pii@example\.invalid/);
    assert.ok(await db.archiveLead(id, 'admin@example.invalid', 'Test archivácie'));
    snapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.ok(snapshot.leadEmailOutbox.filter((row) => row.leadId === id).every((row) => row.status === 'unknown' && row.retryable === false));
    assert.equal((await db.listPendingLeadEmailDeliveries()).some((row) => row.lead.id === id), false);
    assert.equal(await db.claimLeadEmailOutbox(id, 'customer'), false);
    assert.equal(await db.prepareLeadEmailRecipientManualRetry(id, 'internal', 'admin@example.invalid', 'provider_rejected'), false);
    assert.equal(await db.resolveLeadEmailRecipientDelivery(id, 'internal', 'failed', 'admin@example.invalid', 'provider_rejected', 'yes'), false);
    const customer = snapshot.leadEmailOutbox.find((row) => row.leadId === id && row.recipientRole === 'customer');
    customer.status = 'pending';
    await writeFile(dbPath, JSON.stringify(snapshot), 'utf8');
    assert.equal((await db.listPendingLeadEmailDeliveries()).some((row) => row.lead.id === id), false, 'legacy pending archived row is excluded');
    assert.equal(await db.claimLeadEmailOutbox(id, 'customer'), false);
    assert.ok(await db.restoreLead(id, 'admin@example.invalid'));
    assert.equal((await db.listPendingLeadEmailDeliveries()).some((row) => row.lead.id === id), false, 'restore does not resend frozen email');
    snapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.equal(snapshot.leadEmailOutbox.find((row) => row.leadId === id && row.recipientRole === 'customer').status, 'unknown');
    assert.ok(await db.archiveLead(id, 'admin@example.invalid', 'Test zmazania'));
    snapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    snapshot.auditLogs.push({ id: randomUUID(), entityType: 'lead', entityId: id, action: 'historic_unsafe_error',
      actorEmail: 'system:test', changes: { rawReason: 'customer-pii@example.invalid' }, createdAt: new Date().toISOString() });
    await writeFile(dbPath, JSON.stringify(snapshot), 'utf8');
    assert.ok(await db.destroyArchivedLead(id, 'admin@example.invalid', 'customer-pii@example.invalid'));
    snapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.equal(snapshot.leadEmailOutbox.some((row) => row.leadId === id), false);
    const survivingAudits = snapshot.auditLogs.filter((row) => row.entityType === 'lead' && row.entityId === id);
    assert.deepEqual(survivingAudits.map((row) => row.action), ['lead_deleted']);
    assert.doesNotMatch(JSON.stringify(survivingAudits), /customer-pii@example\.invalid/);
  } finally {
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved).toLowerCase(), path.resolve(os.tmpdir()).toLowerCase());
    assert.match(path.basename(resolved), /^astana-lead-email-safety-[A-Za-z0-9]+$/);
    await rm(resolved, { recursive: true, force: true });
  }
});
