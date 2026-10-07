import assert from 'node:assert/strict';
import test from 'node:test';
const policyModule = await import('../src/server/lead-submission-policy.ts');
const { createLeadSubmissionFingerprint, sameLeadSubmissionFingerprint, recordLeadAuditNonFatal } = policyModule.default ?? policyModule;
const relayModule = await import('../src/server/astana-local-relay.ts');
const { canSafelyFallbackToLocalRelay, sendLeadThroughAstanaLocalRelay } = relayModule.default ?? relayModule;
const emailPolicyModule = await import('../src/server/email-delivery-policy.ts');
const { classifyRequiredSmtpRecipient, classifySmtpAcceptance, classifySmtpError, isRetryableSmtpFailure } = emailPolicyModule.default ?? emailPolicyModule;

test('lead fingerprints do not depend on input object key order', () => {
  const first = createLeadSubmissionFingerprint({ fullName: 'Jana Nová', city: 'Poprad', areaEstimate: 120 });
  const second = createLeadSubmissionFingerprint({ areaEstimate: 120, city: 'Poprad', fullName: 'Jana Nová' });

  assert.equal(first.canonicalJson, second.canonicalJson);
  assert.equal(first.hash, second.hash);
  assert.equal(sameLeadSubmissionFingerprint(first, second), true);
});

test('an audit write failure does not turn a confirmed customer email into a failed outcome', async () => {
  const confirmedOutcome = { sent: true, customerSent: true, adminSent: true };
  const failures = [];
  const outcome = await recordLeadAuditNonFatal(
    confirmedOutcome,
    async () => { throw new Error('injected audit storage failure'); },
    (error) => failures.push(error),
  );

  assert.equal(outcome, confirmedOutcome);
  assert.deepEqual(outcome, { sent: true, customerSent: true, adminSent: true });
  assert.equal(failures.length, 1);
  assert.match(failures[0].message, /injected audit storage failure/);

  const stillConfirmed = await recordLeadAuditNonFatal(
    confirmedOutcome,
    async () => { throw new Error('another injected audit storage failure'); },
    () => { throw new Error('injected logger failure'); },
  );
  assert.equal(stillConfirmed, confirmedOutcome);
});

test('normalizes customer text, email case, Unicode, and numeric area', () => {
  const first = createLeadSubmissionFingerprint({
    fullName: '  Jana Nová  ',
    email: '  JANA@EXAMPLE.SK ',
    city: 'Z\u030cdiar',
    areaEstimate: '120.0',
  });
  const second = createLeadSubmissionFingerprint({
    fullName: 'Jana Nová',
    email: 'jana@example.sk',
    city: 'Ždiar',
    areaEstimate: 120,
  });

  assert.deepEqual(first.canonical, second.canonical);
  assert.equal(first.hash, second.hash);
});

test('changes to a customer field produce a different fingerprint', () => {
  const first = createLeadSubmissionFingerprint({ fullName: 'Jana Nová', city: 'Poprad' });
  const changed = createLeadSubmissionFingerprint({ fullName: 'Jana Nová', city: 'Kežmarok' });

  assert.notEqual(first.hash, changed.hash);
  assert.equal(sameLeadSubmissionFingerprint(first, changed), false);
});

test('a selected roofer is part of the fingerprint', () => {
  const first = createLeadSubmissionFingerprint({ city: 'Poprad', selectedRooferId: 'roofer-1' });
  const changed = createLeadSubmissionFingerprint({ city: 'Poprad', selectedRooferId: 'roofer-2' });

  assert.notEqual(first.hash, changed.hash);
});

test('ignores server metadata and adds uploaded storage IDs only when explicitly supplied', () => {
  const input = {
    fullName: 'Jana Nová',
    ip: '192.0.2.1',
    userAgent: 'example-agent',
    submissionId: 'server-or-client-token',
    uploadedStorageIds: ['must-not-be-used'],
  };
  const withoutUploads = createLeadSubmissionFingerprint(input);
  const withUploads = createLeadSubmissionFingerprint(input, { uploadedStorageIds: ['photo-b', 'photo-a', 'photo-b'] });

  assert.deepEqual(withoutUploads.canonical, { fullName: 'Jana Nová' });
  assert.deepEqual(withUploads.canonical, { fullName: 'Jana Nová', uploadedStorageIds: ['photo-a', 'photo-b', 'photo-b'] });
  assert.notEqual(withoutUploads.hash, withUploads.hash);
  const oneCopy = createLeadSubmissionFingerprint(input, { uploadedStorageIds: ['photo-a', 'photo-b'] });
  assert.notEqual(oneCopy.hash, withUploads.hash, 'repeated identical attachments must remain part of the fingerprint');
});

test('local relay fallback is allowed only when SMTP is not configured, never after an ambiguous SMTP error', () => {
  assert.equal(canSafelyFallbackToLocalRelay('smtp_then_local_relay', {
    sent: false, customerSent: false, adminSent: false, reason: 'SMTP nie je nastavené.',
  }), true);
  assert.equal(canSafelyFallbackToLocalRelay('smtp_then_local_relay', {
    sent: false, customerSent: false, adminSent: false, reason: 'Spojenie vypršalo.',
  }), false);
  assert.equal(canSafelyFallbackToLocalRelay('smtp_then_local_relay', {
    sent: false, customerSent: true, adminSent: false, reason: 'Interný email zlyhal.',
  }), false);
});

test('local relay never reports delivery from a failed or contradictory response', async () => {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.ASTANA_RELAY_URL;
  const previousSecret = process.env.ASTANA_RELAY_SECRET;
  process.env.ASTANA_RELAY_URL = 'https://www.astana.sk/api/local-relay-test';
  process.env.ASTANA_RELAY_SECRET = 'a'.repeat(32);
  const lead = {
    id: 'd0ea74b2-3075-4e6d-a848-e17dd848f05c',
    fullName: 'Izolovaný test', email: 'test@example.invalid', phone: '+421900000001',
    city: 'Poprad', objectType: 'Rodinný dom', materialType: 'Vlnitý eternit', areaEstimate: 100,
  };

  try {
    for (const response of [
      new Response(JSON.stringify({ ok: true, customerSent: true, adminSent: true }), { status: 503 }),
      new Response(JSON.stringify({ ok: false, customerSent: true, adminSent: true }), { status: 200 }),
    ]) {
      globalThis.fetch = async () => response;
      const result = await sendLeadThroughAstanaLocalRelay(lead, 0);
      assert.equal(result.sent, false);
      assert.equal(result.customerSent, false);
      assert.equal(result.adminSent, false);
      assert.equal(result.customerStatus, 'unknown');
      assert.equal(result.adminStatus, 'unknown');
    }

    globalThis.fetch = async () => new Response(JSON.stringify({ customerSent: true, adminSent: true }), { status: 200 });
    const compatible = await sendLeadThroughAstanaLocalRelay(lead, 0);
    assert.equal(compatible.sent, true, 'a successful legacy relay response without an `ok` field remains compatible');
    assert.equal(compatible.customerStatus, 'sent');
    assert.equal(compatible.adminStatus, 'sent');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.ASTANA_RELAY_URL;
    else process.env.ASTANA_RELAY_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.ASTANA_RELAY_SECRET;
    else process.env.ASTANA_RELAY_SECRET = previousSecret;
  }
});

test('SMTP response rejection is distinguishable from an ambiguous network timeout', () => {
  assert.equal(classifySmtpError({ responseCode: 451, message: 'Try again later' }), 'failed');
  assert.equal(classifySmtpError({ responseCode: 550, message: 'Mailbox unavailable' }), 'failed');
  assert.equal(classifySmtpError({ code: 'ETIMEDOUT', message: 'Connection timed out' }), 'unknown');
  assert.equal(classifySmtpError(new Error('Socket closed after DATA')), 'unknown');
});

test('only explicit temporary SMTP 4xx responses are eligible for bounded automatic retry', () => {
  assert.equal(isRetryableSmtpFailure({ responseCode: 451 }), true);
  assert.equal(isRetryableSmtpFailure({ responseCode: 421 }), true);
  assert.equal(isRetryableSmtpFailure({ responseCode: 550 }), false);
  assert.equal(isRetryableSmtpFailure({ code: 'ETIMEDOUT' }), false);
});

test('SMTP acceptance requires all envelope recipients to be accepted', () => {
  assert.equal(classifySmtpAcceptance({ accepted: ['customer@example.test'], rejected: [] }), 'sent');
  assert.equal(classifySmtpAcceptance({ accepted: [], rejected: ['customer@example.test'] }), 'failed');
  assert.equal(classifySmtpAcceptance({ accepted: ['one@example.test'], rejected: ['two@example.test'] }), 'unknown');
  assert.equal(classifySmtpAcceptance({}), 'unknown');
});

test('cenová ponuka vyžaduje prijatie presne zákazníckou adresou', () => {
  assert.equal(classifyRequiredSmtpRecipient({ accepted: ['customer@example.test', 'astana@astana.sk'], rejected: [] }, 'customer@example.test'), 'sent');
  assert.equal(classifyRequiredSmtpRecipient({ accepted: ['astana@astana.sk'], rejected: ['customer@example.test'] }, 'customer@example.test'), 'failed');
  assert.equal(classifyRequiredSmtpRecipient({ accepted: ['ASTANA <astana@astana.sk>'], rejected: [] }, 'customer@example.test'), 'unknown');
  assert.equal(classifyRequiredSmtpRecipient({ accepted: ['Customer <CUSTOMER@example.test>'], rejected: ['astana@astana.sk'] }, 'customer@example.test'), 'sent');
});
