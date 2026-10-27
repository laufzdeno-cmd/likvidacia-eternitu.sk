import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

process.env.DATABASE_URL = '';
process.env.SMTP_HOST = '';
process.env.VERCEL = '';
const { deliverApprovedAuthorityNotice } = await import('../src/server/job-authority-delivery.ts');
const { jobPaymentStatus } = await import('../src/lib/job-payment-status.ts');
const actor = { email: 'operator@example.test', role: 'OPERATOR' };

function transport(result) {
  let state = 'PREPARED', attempts = 0;
  const deliveries = [];
  const notice = { id: 'notice', jobId: 'job', operationId: 'operation', workspaceRevision: 1, recipient: 'customer@example.test', subject: '<Podklady>', text: 'OÚ ŽP: 2026-10-27\nLen toto podanie.', state, attemptId: null };
  return { deliveries, attempts: () => attempts, state: () => state, deps: {
    claim: async () => { if (state !== 'PREPARED') return null; state = 'SENDING'; return { ...notice, state, attemptId: 'one-attempt' }; },
    send: async (input) => { attempts++; deliveries.push(input); if (result instanceof Error) throw result; return result; },
    finalize: async (_id, attemptId, value) => { assert.equal(attemptId, 'one-attempt'); state = value; },
  } };
}
test('concurrent approved clicks send one immutable customer notice with escaped HTML', async () => {
  const fake = transport({ sent: true, status: 'sent' });
  await Promise.all([deliverApprovedAuthorityNotice('notice', actor, fake.deps), deliverApprovedAuthorityNotice('notice', actor, fake.deps)]);
  assert.equal(fake.attempts(), 1); assert.equal(fake.state(), 'SENT');
  assert.equal(fake.deliveries[0].to, 'customer@example.test');
  assert.match(fake.deliveries[0].html, /&lt;Podklady&gt;/);
  assert.doesNotMatch(fake.deliveries[0].text, /RÚVZ/);
});
test('unknown SMTP result and thrown transport cannot trigger an automatic retry', async () => {
  for (const result of [{ sent: false, status: 'uncertain' }, new Error('socket ended after DATA')]) {
    const fake = transport(result); await deliverApprovedAuthorityNotice('notice', actor, fake.deps);
    assert.equal(fake.state(), 'UNCERTAIN');
    await deliverApprovedAuthorityNotice('notice', actor, fake.deps); assert.equal(fake.attempts(), 1);
  }
});
test('a rejected recipient is failed and never silently returned to a sendable state', async () => {
  const fake = transport({ sent: false, status: 'failed' });
  await deliverApprovedAuthorityNotice('notice', actor, fake.deps); assert.equal(fake.state(), 'FAILED');
  await deliverApprovedAuthorityNotice('notice', actor, fake.deps); assert.equal(fake.attempts(), 1);
});
test('private draft generation cannot invoke external AI even with old enabled environment', async () => {
  const source = (await readFile(new URL('../src/server/admin-draft-provider.ts', import.meta.url), 'utf8')).replace("import 'server-only';", '');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const provider = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  process.env.ASTANA_AI_DRAFTS_ENABLED = 'true'; process.env.AI_GATEWAY_API_KEY = 'synthetic-test-credential';
  let requests = 0;
  try {
    assert.equal(provider.getAdminDraftProviderStatus().providerReady, false);
    await assert.rejects(provider.generateAdminDraftWithProvider({ type: 'reply', name: 'Test', locality: 'Poprad', facts: 'Súkromné údaje' }, async () => { requests++; throw new Error('forbidden'); }), /vypnuté/);
    assert.equal(requests, 0);
  } finally { delete process.env.ASTANA_AI_DRAFTS_ENABLED; delete process.env.AI_GATEWAY_API_KEY; }
});
test('cash without invoice and invoices use receipts, not a completion flag or document toggle', () => {
  const ledger = { netReceivedCents: 0, activeInvoicedCents: 0, requiresReview: false, unallocatedReceivedCents: 0, outstandingCents: 0 };
  assert.equal(jobPaymentStatus(null, ledger).state, 'UNKNOWN');
  assert.equal(jobPaymentStatus(123000, ledger).state, 'UNPAID');
  assert.equal(jobPaymentStatus(123000, { ...ledger, netReceivedCents: 30000 }).state, 'PARTIALLY_PAID');
  assert.equal(jobPaymentStatus(123000, { ...ledger, netReceivedCents: 123000 }).state, 'PAID');
  assert.equal(jobPaymentStatus(123000, { ...ledger, netReceivedCents: 123000, activeInvoicedCents: 150000, outstandingCents: 27000 }).state, 'REVIEW');
  assert.equal(jobPaymentStatus(123000, { ...ledger, netReceivedCents: 123000, activeInvoicedCents: 123000, unallocatedReceivedCents: 123000 }).state, 'REVIEW');
});
