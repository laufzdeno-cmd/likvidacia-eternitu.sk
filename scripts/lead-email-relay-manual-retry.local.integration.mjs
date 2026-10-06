import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('relay partial result needs evidence before one-recipient SMTP recovery', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'astana-relay-manual-retry-'));
  const dbPath = path.join(directory, 'local-db.json');
  const capturedRecipients = [];
  const capturedMessages = [];
  const server = createServer((socket) => {
    socket.setEncoding('utf8');
    socket.write('220 local SMTP test ready\r\n');
    let buffer = '';
    let inData = false;
    let messageLines = [];
    socket.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        if (inData) {
          if (line === '.') {
            inData = false;
            capturedMessages.push(messageLines.join('\n'));
            messageLines = [];
            socket.write('250 queued locally\r\n');
          } else {
            messageLines.push(line);
          }
        } else if (/^EHLO |^HELO /i.test(line)) {
          socket.write('250 localhost\r\n');
        } else if (/^MAIL FROM:/i.test(line)) {
          socket.write('250 sender accepted\r\n');
        } else if (/^RCPT TO:/i.test(line)) {
          capturedRecipients.push(line);
          socket.write('250 recipient accepted\r\n');
        } else if (line === 'DATA') {
          inData = true;
          socket.write('354 send message\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 bye\r\n');
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });
  });
  const envKeys = ['DATABASE_URL', 'ASTANA_LOCAL_DB_PATH', 'NODE_ENV', 'LEAD_EMAIL_DELIVERY_MODE',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'LEAD_TO_EMAIL', 'FROM_EMAIL', 'AUTH_SECRET'];
  const oldEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    process.env.DATABASE_URL = '';
    process.env.ASTANA_LOCAL_DB_PATH = dbPath;
    process.env.NODE_ENV = 'test';
    process.env.LEAD_EMAIL_DELIVERY_MODE = 'local_relay';
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(address.port);
    process.env.SMTP_SECURE = 'false';
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.LEAD_TO_EMAIL = 'admin@astana.sk';
    process.env.FROM_EMAIL = 'astana@astana.sk';
    process.env.AUTH_SECRET = 'isolated-local-manual-retry-test';

    const db = await import('../src/server/db.ts');
    const { canManuallyRetryLeadEmail, sendLeadEmailToRecipient } = await import('../src/server/mail.ts');
    assert.equal(canManuallyRetryLeadEmail(), true);
    const submissionId = randomUUID();
    const created = await db.createLeadSubmission({
      submissionId, submissionHash: `manual-${submissionId}`, fullName: 'Test doručenia',
      phone: '+421900000001', email: 'customer@example.invalid', city: 'Poprad', district: 'Poprad',
      objectType: 'Rodinný dom', materialType: 'Vlnitý eternit', areaEstimate: 100,
      preferredContact: 'Emailom', term: 'Do mesiaca', note: 'Izolovaný test', gdpr: true, source: 'integration-test',
    }, []);
    const leadId = created.lead.id;
    const customerClaim = await db.claimLeadEmailOutbox(leadId, 'customer');
    const internalClaim = await db.claimLeadEmailOutbox(leadId, 'internal');
    assert.ok(customerClaim && internalClaim);
    assert.equal(await db.recordLeadEmailRecipientResult(leadId, 'customer', { status: 'sent' }, customerClaim), true);
    assert.equal(await db.recordLeadEmailRecipientResult(leadId, 'internal', { status: 'unknown' }, internalClaim), true);

    assert.equal(await db.prepareLeadEmailRecipientManualRetry(leadId, 'internal', 'admin@astana.sk', 'provider_rejected'), false);
    assert.equal(await db.resolveLeadEmailRecipientDelivery(leadId, 'internal', 'failed', 'admin@astana.sk', 'provider_rejected', 'yes'), true);
    assert.equal(await db.prepareLeadEmailRecipientManualRetry(leadId, 'customer', 'admin@astana.sk', 'provider_rejected'), false);
    const manualClaim = await db.prepareLeadEmailRecipientManualRetry(leadId, 'internal', 'admin@astana.sk', 'provider_rejected');
    assert.ok(manualClaim);
    assert.equal(await db.prepareLeadEmailRecipientManualRetry(leadId, 'internal', 'admin@astana.sk', 'provider_rejected'), false);

    const result = await sendLeadEmailToRecipient(created.lead, 'internal', 2, created.businessJobId);
    assert.equal(result.status, 'sent');
    assert.equal(await db.recordLeadEmailRecipientResult(leadId, 'internal', { ...result, retryable: false }, manualClaim, 'admin@astana.sk'), true);
    assert.deepEqual(capturedRecipients.map((line) => line.toLowerCase()), ['rcpt to:<admin@astana.sk>']);
    assert.equal(capturedMessages.length, 1, 'manual retry sends exactly one internal message');
    assert.ok(capturedMessages[0].includes(`/admin/dopyty/${leadId}/`), 'internal email opens the lead detail with private attachments');
    assert.ok(capturedMessages[0].includes('2 fotografie'), 'HTML email reports its photo attachment count');
    assert.ok(capturedMessages[0].includes(`/admin/zakazky/${created.businessJobId}/`), 'related job remains separately accessible');
    const healthAfterRetry = await db.getSystemHealth();
    assert.equal(healthAfterRetry.lastEmailSent?.entityId, leadId);
    assert.equal(healthAfterRetry.lastEmailSent?.action, 'lead_email_delivery_sent', 'manual retry success must appear in admin health');
    assert.equal(healthAfterRetry.lastEmailError?.action, 'lead_email_delivery_unknown', 'unknown delivery remains a historical event');
    const snapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.equal(snapshot.leadEmailOutbox.find((row) => row.leadId === leadId && row.recipientRole === 'customer').status, 'sent');
    assert.equal(snapshot.leadEmailOutbox.find((row) => row.leadId === leadId && row.recipientRole === 'internal').status, 'sent');
    assert.equal(snapshot.auditLogs.filter((row) => row.entityId === leadId && row.action === 'lead_email_manual_retry_started').length, 1);
    assert.equal((await db.listPendingLeadEmailDeliveries(25, true)).some((row) => row.lead.id === leadId), false);
  } finally {
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await new Promise((resolve) => server.close(resolve));
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved).toLowerCase(), path.resolve(os.tmpdir()).toLowerCase());
    assert.match(path.basename(resolved), /^astana-relay-manual-retry-[A-Za-z0-9]+$/);
    await rm(resolved, { recursive: true, force: true });
  }
});
