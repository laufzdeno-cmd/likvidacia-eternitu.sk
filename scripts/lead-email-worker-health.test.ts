import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateLeadEmailWorkerHealth, type LeadEmailWorkerAttention } from '../src/server/lead-email-worker-health';

const nowMs = Date.parse('2026-10-08T12:00:00.000Z');

function attention(overrides: Partial<LeadEmailWorkerAttention> = {}): LeadEmailWorkerAttention {
  return {
    pending: 0,
    overduePending: 0,
    sending: 0,
    staleSending: 0,
    failed: 0,
    unknown: 0,
    oldestUnresolvedAt: null,
    ...overrides,
  };
}

function evaluate(overrides: Partial<Parameters<typeof evaluateLeadEmailWorkerHealth>[0]> = {}) {
  return evaluateLeadEmailWorkerHealth({
    errors: 0,
    unresolved: 0,
    deferred: 0,
    pendingWithoutSingleRecipientTransport: false,
    attention: attention(),
    nowMs,
    ...overrides,
  });
}

test('unknown or failed backlog makes the worker visibly unhealthy without exposing identifiers', () => {
  for (const backlog of [attention({ unknown: 1 }), attention({ failed: 2 })]) {
    const result = evaluate({ attention: backlog });
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.deepEqual(Object.keys(result.attention).sort(), [
      'failed', 'oldestUnresolvedAgeMinutes', 'overduePending', 'pending', 'sending', 'staleSending', 'unknown',
    ]);
    assert.equal(JSON.stringify(result).includes('leadId'), false);
    assert.equal(JSON.stringify(result).includes('messageId'), false);
    assert.equal(JSON.stringify(result).includes('email'), false);
  }
});

test('only overdue pending or stale sending triggers backlog attention', () => {
  assert.equal(evaluate({ attention: attention({ pending: 1 }) }).status, 200);
  assert.equal(evaluate({ attention: attention({ pending: 1, overduePending: 1 }) }).status, 503);
  assert.equal(evaluate({ attention: attention({ sending: 1 }) }).status, 200);
  assert.equal(evaluate({ attention: attention({ sending: 1, staleSending: 1 }) }).status, 503);
});

test('healthy or sent-only outbox remains successful and reports bounded age only', () => {
  const healthy = evaluate();
  assert.equal(healthy.ok, true);
  assert.equal(healthy.status, 200);

  const waiting = evaluate({ attention: attention({ pending: 1, oldestUnresolvedAt: '2026-10-08T11:53:20.000Z' }) });
  assert.equal(waiting.status, 200);
  assert.equal(waiting.attention.oldestUnresolvedAgeMinutes, 6);
});

test('current run failures use 500 while unresolved or deferred work uses 503', () => {
  assert.equal(evaluate({ errors: 1 }).status, 500);
  assert.equal(evaluate({ unresolved: 1 }).status, 503);
  assert.equal(evaluate({ deferred: 1 }).status, 503);
  assert.equal(evaluate({ pendingWithoutSingleRecipientTransport: true }).status, 503);
});
