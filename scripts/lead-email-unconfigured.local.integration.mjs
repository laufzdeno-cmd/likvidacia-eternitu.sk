import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('unconfigured lead transport preserves the outbox until a local SMTP transport is configured', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'astana-lead-unconfigured-'));
  const dbPath = path.join(directory, 'local-db.json');
  const recipients = [];
  const sockets = new Set();
  const smtpServer = createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 isolated SMTP ready\r\n');
    let buffer = '';
    let inData = false;
    socket.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        if (inData) {
          if (line === '.') {
            inData = false;
            socket.write('250 queued locally\r\n');
          }
        } else if (/^EHLO |^HELO /i.test(line)) socket.write('250 localhost\r\n');
        else if (/^MAIL FROM:/i.test(line)) socket.write('250 sender accepted\r\n');
        else if (/^RCPT TO:/i.test(line)) {
          recipients.push(line.toLowerCase());
          socket.write('250 recipient accepted\r\n');
        } else if (line === 'DATA') {
          inData = true;
          socket.write('354 send message\r\n');
        } else if (line === 'QUIT') socket.end('221 bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  const envKeys = ['DATABASE_URL', 'ASTANA_LOCAL_DB_PATH', 'NODE_ENV', 'VERCEL_ENV',
    'LEAD_EMAIL_DELIVERY_MODE', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS',
    'LEAD_TO_EMAIL', 'FROM_EMAIL', 'AUTH_SECRET', 'CRON_SECRET', 'ASTANA_RELAY_URL', 'ASTANA_RELAY_SECRET'];
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  try {
    await new Promise((resolve) => smtpServer.listen(0, '127.0.0.1', resolve));
    const address = smtpServer.address();
    assert.ok(address && typeof address !== 'string');
    process.env.DATABASE_URL = '';
    process.env.ASTANA_LOCAL_DB_PATH = dbPath;
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;
    process.env.LEAD_EMAIL_DELIVERY_MODE = 'smtp';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.ASTANA_RELAY_URL;
    delete process.env.ASTANA_RELAY_SECRET;
    process.env.SMTP_PORT = String(address.port);
    process.env.SMTP_SECURE = 'false';
    process.env.LEAD_TO_EMAIL = 'admin@astana.sk';
    process.env.FROM_EMAIL = 'astana@astana.sk';
    process.env.AUTH_SECRET = 'isolated-lead-email-test-secret';
    process.env.CRON_SECRET = 'isolated-lead-email-cron-secret';

    const db = await import('../src/server/db.ts');
    const mail = await import('../src/server/mail.ts');
    const { GET } = await import('../app/api/cron/lead-email-delivery/route.ts');
    const submissionId = randomUUID();
    const created = await db.createLeadSubmission({
      submissionId, submissionHash: `unconfigured-${submissionId}`,
      fullName: 'TEST – nekontaktovať', phone: '+421900000001', email: 'customer@example.invalid',
      city: 'Poprad', district: 'Poprad', objectType: 'Rodinný dom', materialType: 'Vlnitý eternit',
      areaEstimate: 100, preferredContact: 'Emailom', term: 'Do mesiaca', note: 'Izolovaný test',
      gdpr: true, source: 'integration-test',
    }, []);
    const request = new Request('http://127.0.0.1/api/cron/lead-email-delivery/', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });

    assert.equal(mail.hasLeadEmailTransportConfiguration(), false);
    let claims = 0;
    const direct = await mail.sendLeadEmails(created.lead, 0, created.businessJobId, {
      claim: async () => { claims += 1; return false; },
      record: async () => { throw new Error('No delivery can be recorded without a transport'); },
    });
    assert.equal(direct.sent, false);
    assert.equal(claims, 0);
    const missingSmtp = await GET(request);
    assert.equal(missingSmtp.status, 503);
    assert.equal((await missingSmtp.json()).code, 'LEAD_EMAIL_TRANSPORT_NOT_CONFIGURED');

    process.env.LEAD_EMAIL_DELIVERY_MODE = 'local_relay';
    assert.equal(mail.hasLeadEmailTransportConfiguration(), false);
    const missingRelay = await GET(request);
    assert.equal(missingRelay.status, 503);
    process.env.LEAD_EMAIL_DELIVERY_MODE = 'smtp_then_local_relay';
    process.env.ASTANA_RELAY_URL = 'https://www.astana.sk/lead-relay';
    process.env.ASTANA_RELAY_SECRET = 'isolated-relay-secret-with-enough-length';
    assert.equal(mail.hasLeadEmailTransportConfiguration(), true, 'hybrid may use a configured relay when SMTP is absent');
    delete process.env.ASTANA_RELAY_URL;
    delete process.env.ASTANA_RELAY_SECRET;
    process.env.LEAD_EMAIL_DELIVERY_MODE = 'smtp';
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_USER = 'incomplete-auth';
    assert.equal(mail.hasLeadEmailTransportConfiguration(), false);
    assert.equal((await GET(request)).status, 503);
    delete process.env.SMTP_USER;

    const before = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.deepEqual(before.leadEmailOutbox.filter((row) => row.leadId === created.lead.id)
      .map((row) => [row.status, row.attempts]), [['pending', 0], ['pending', 0]]);
    assert.deepEqual(recipients, []);

    assert.equal(mail.hasLeadEmailTransportConfiguration(), true);
    const delivered = await GET(request);
    assert.equal(delivered.status, 200);
    const result = await delivered.json();
    assert.equal(result.sent, 1);
    assert.deepEqual(recipients.sort(), ['rcpt to:<admin@astana.sk>', 'rcpt to:<customer@example.invalid>']);
    const after = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.deepEqual(after.leadEmailOutbox.filter((row) => row.leadId === created.lead.id)
      .map((row) => [row.status, row.attempts]), [['sent', 1], ['sent', 1]]);
    assert.equal((await db.listPendingLeadEmailDeliveries()).length, 0);

    const partialId = randomUUID();
    const partial = await db.createLeadSubmission({
      submissionId: partialId, submissionHash: `partial-${partialId}`,
      fullName: 'TEST – nekontaktovať', phone: '+421900000002', email: 'partial@example.invalid',
      city: 'Poprad', district: 'Poprad', objectType: 'Rodinný dom', materialType: 'Vlnitý eternit',
      areaEstimate: 100, preferredContact: 'Emailom', term: 'Do mesiaca', note: 'Izolovaný test',
      gdpr: true, source: 'integration-test',
    }, []);
    const customerClaim = await db.claimLeadEmailOutbox(partial.lead.id, 'customer');
    assert.ok(customerClaim);
    assert.equal(await db.recordLeadEmailRecipientResult(partial.lead.id, 'customer', { status: 'sent' }, customerClaim), true);
    process.env.LEAD_EMAIL_DELIVERY_MODE = 'smtp_then_local_relay';
    delete process.env.SMTP_HOST;
    process.env.ASTANA_RELAY_URL = 'https://www.astana.sk/lead-relay';
    process.env.ASTANA_RELAY_SECRET = 'isolated-relay-secret-with-enough-length';
    let relayCalls = 0;
    globalThis.fetch = async () => { relayCalls += 1; throw new Error('Isolated test forbids external relay requests'); };
    process.env.LEAD_EMAIL_DELIVERY_MODE = 'local_relay';
    const relayOnlyResponse = await GET(request);
    assert.equal(relayOnlyResponse.status, 503);
    assert.equal((await relayOnlyResponse.json()).outbox.pending, 1);
    assert.equal(relayCalls, 0);
    process.env.LEAD_EMAIL_DELIVERY_MODE = 'smtp_then_local_relay';
    assert.equal(mail.hasLeadEmailTransportConfiguration(), true);
    const deferredResponse = await GET(request);
    assert.equal(deferredResponse.status, 503);
    const deferredResult = await deferredResponse.json();
    assert.equal(deferredResult.outbox.pending, 1);
    assert.equal(deferredResult.processed, 0);
    assert.equal(relayCalls, 0);
    const deferredSnapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.deepEqual(deferredSnapshot.leadEmailOutbox.filter((row) => row.leadId === partial.lead.id)
      .map((row) => [row.status, row.attempts]), [['sent', 1], ['pending', 0]]);

    const singleIds = [partial.lead.id];
    for (let index = 0; index < 4; index += 1) {
      const id = randomUUID();
      const oneSided = await db.createLeadSubmission({
        submissionId: id, submissionHash: `one-sided-${id}`,
        fullName: 'TEST – nekontaktovať', phone: '+421900000003', email: `single${index}@example.invalid`,
        city: 'Poprad', district: 'Poprad', objectType: 'Rodinný dom', materialType: 'Vlnitý eternit',
        areaEstimate: 100, preferredContact: 'Emailom', term: 'Do mesiaca', note: 'Izolovaný test',
        gdpr: true, source: 'integration-test',
      }, []);
      const token = await db.claimLeadEmailOutbox(oneSided.lead.id, 'customer');
      assert.ok(token);
      assert.equal(await db.recordLeadEmailRecipientResult(oneSided.lead.id, 'customer', { status: 'sent' }, token), true);
      singleIds.push(oneSided.lead.id);
    }
    const pairId = randomUUID();
    const pair = await db.createLeadSubmission({
      submissionId: pairId, submissionHash: `pair-${pairId}`,
      fullName: 'TEST – nekontaktovať', phone: '+421900000004', email: 'pair@example.invalid',
      city: 'Poprad', district: 'Poprad', objectType: 'Rodinný dom', materialType: 'Vlnitý eternit',
      areaEstimate: 100, preferredContact: 'Emailom', term: 'Do mesiaca', note: 'Izolovaný test',
      gdpr: true, source: 'integration-test',
    }, []);
    globalThis.fetch = async (input) => {
      assert.equal(new URL(input).hostname, 'www.astana.sk');
      relayCalls += 1;
      return new Response(JSON.stringify({ customerSent: true, adminSent: true }), { status: 200 });
    };
    const pairResponse = await GET(request);
    assert.equal(pairResponse.status, 503, 'older one-sided rows remain visible even after the pair succeeds');
    const pairResult = await pairResponse.json();
    assert.equal(pairResult.sent, 1, 'the later deliverable pair is not starved by five older one-sided rows');
    assert.equal(pairResult.outbox.pending, 5);
    assert.equal(relayCalls, 1);
    const pairSnapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.deepEqual(pairSnapshot.leadEmailOutbox.filter((row) => row.leadId === pair.lead.id)
      .map((row) => [row.status, row.attempts]), [['sent', 1], ['sent', 1]]);
    for (const id of singleIds) {
      assert.deepEqual(pairSnapshot.leadEmailOutbox.filter((row) => row.leadId === id)
        .map((row) => [row.status, row.attempts]), [['sent', 1], ['pending', 0]]);
    }

    process.env.SMTP_HOST = '127.0.0.1';
    const resumedResponse = await GET(request);
    assert.equal(resumedResponse.status, 200);
    assert.equal((await resumedResponse.json()).sent, 5);
    assert.equal(relayCalls, 1);
    assert.deepEqual(recipients.sort(), [
      ...Array(6).fill('rcpt to:<admin@astana.sk>'), 'rcpt to:<customer@example.invalid>',
    ]);
    const resumedSnapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    for (const id of singleIds) {
      assert.deepEqual(resumedSnapshot.leadEmailOutbox.filter((row) => row.leadId === id)
        .map((row) => [row.status, row.attempts]), [['sent', 1], ['sent', 1]]);
    }

    const uncertainId = randomUUID();
    const uncertain = await db.createLeadSubmission({
      submissionId: uncertainId, submissionHash: `uncertain-${uncertainId}`,
      fullName: 'TEST – nekontaktovať', phone: '+421900000005', email: 'uncertain@example.invalid',
      city: 'Poprad', district: 'Poprad', objectType: 'Rodinný dom', materialType: 'Vlnitý eternit',
      areaEstimate: 100, preferredContact: 'Emailom', term: 'Do mesiaca', note: 'Izolovaný test',
      gdpr: true, source: 'integration-test',
    }, []);
    const uncertainCustomerClaim = await db.claimLeadEmailOutbox(uncertain.lead.id, 'customer');
    assert.ok(uncertainCustomerClaim);
    assert.equal(await db.recordLeadEmailRecipientResult(uncertain.lead.id, 'customer', { status: 'unknown' }, uncertainCustomerClaim), true);
    const uncertainResponse = await GET(request);
    assert.equal(uncertainResponse.status, 503, 'an unresolved recipient must keep monitoring visibly unhealthy');
    const uncertainResult = await uncertainResponse.json();
    assert.equal(uncertainResult.sent, 0, 'one successful internal message is not a fully sent inquiry');
    assert.equal(uncertainResult.unresolved, 1);
    const uncertainSnapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.deepEqual(uncertainSnapshot.leadEmailOutbox.filter((row) => row.leadId === uncertain.lead.id)
      .map((row) => [row.status, row.attempts]), [['unknown', 1], ['sent', 1]]);
    assert.equal(uncertainSnapshot.auditLogs.some((row) => row.entityId === uncertain.lead.id && row.action === 'lead_email_sent'), false);
    assert.equal(uncertainSnapshot.auditLogs.some((row) => row.entityId === uncertain.lead.id && row.action === 'lead_email_error'), true);

    process.env.LEAD_EMAIL_DELIVERY_MODE = 'local_relay';
    process.env.ASTANA_RELAY_URL = 'https://www.astana.sk/lead-relay';
    process.env.ASTANA_RELAY_SECRET = 'isolated-relay-secret-with-enough-length';
    const failedHttpId = randomUUID();
    const failedHttp = await db.createLeadSubmission({
      submissionId: failedHttpId, submissionHash: `failed-http-${failedHttpId}`,
      fullName: 'TEST – nekontaktovať', phone: '+421900000006', email: 'http-failure@example.invalid',
      city: 'Poprad', district: 'Poprad', objectType: 'Rodinný dom', materialType: 'Vlnitý eternit',
      areaEstimate: 100, preferredContact: 'Emailom', term: 'Do mesiaca', note: 'Izolovaný HTTP relay test',
      gdpr: true, source: 'integration-test',
    }, []);
    globalThis.fetch = async () => new Response(
      JSON.stringify({ ok: true, customerSent: true, adminSent: true }), { status: 503 },
    );
    const failedHttpResponse = await GET(request);
    assert.equal(failedHttpResponse.status, 503, 'an ambiguous relay result is recorded but must remain visible to monitoring');
    const failedHttpResult = await failedHttpResponse.json();
    assert.equal(failedHttpResult.ok, false);
    assert.equal(failedHttpResult.sent, 0);
    assert.equal(failedHttpResult.unresolved, 1);
    const failedHttpSnapshot = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.deepEqual(failedHttpSnapshot.leadEmailOutbox.filter((row) => row.leadId === failedHttp.lead.id)
      .map((row) => [row.status, row.attempts]), [['unknown', 1], ['unknown', 1]]);
    assert.equal(failedHttpSnapshot.auditLogs.some((row) => row.entityId === failedHttp.lead.id && row.action === 'lead_email_sent'), false);
    assert.equal(failedHttpSnapshot.auditLogs.some((row) => row.entityId === failedHttp.lead.id && row.action === 'lead_email_error'), true);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => smtpServer.close(resolve));
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved).toLowerCase(), path.resolve(os.tmpdir()).toLowerCase());
    assert.match(path.basename(resolved), /^astana-lead-unconfigured-[A-Za-z0-9]+$/);
    await rm(resolved, { recursive: true, force: true });
  }
});
