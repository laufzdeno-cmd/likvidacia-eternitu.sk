import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';
import { dispatchOpsAlert } from '../src/server/ops-alert-dispatch.ts';
import { getOpsAlertConfiguration } from '../src/server/ops-alert-policy.ts';

const readyEnvironment = {
  OPS_ALERT_ENABLED: 'true',
  OPS_ALERT_WEBHOOK_URL: 'https://alerts.example.test/hooks/astana',
  OPS_ALERT_SIGNING_SECRET: 'ops-alert-test-secret-that-is-long-enough',
  OPS_ALERT_REPEAT_MINUTES: '60',
};

const unhealthyObservation = {
  worker: 'lead_email_delivery',
  state: 'unhealthy',
  reasonCodes: ['unknown_delivery', 'failed_delivery'],
  metrics: { unknown: 2, failed: 1, forbidden_email_metric: 999 },
};

const publicDns = async () => ['93.184.216.34'];

test('operations alert configuration is default-off and rejects unsafe endpoints', () => {
  assert.deepEqual(getOpsAlertConfiguration({}), { status: 'disabled' });
  assert.equal(getOpsAlertConfiguration({ ...readyEnvironment, OPS_ALERT_WEBHOOK_URL: 'http://alerts.example.test/hook' }).status, 'misconfigured');
  assert.equal(getOpsAlertConfiguration({ ...readyEnvironment, OPS_ALERT_WEBHOOK_URL: 'https://127.0.0.1/hook' }).status, 'misconfigured');
  assert.equal(getOpsAlertConfiguration({ ...readyEnvironment, OPS_ALERT_WEBHOOK_URL: 'https://10.0.0.2/hook' }).status, 'misconfigured');
  assert.equal(getOpsAlertConfiguration({ ...readyEnvironment, OPS_ALERT_WEBHOOK_URL: 'https://[::ffff:127.0.0.1]/hook' }).status, 'misconfigured');
  assert.equal(getOpsAlertConfiguration({ ...readyEnvironment, OPS_ALERT_SIGNING_SECRET: 'short' }).status, 'misconfigured');
  assert.equal(getOpsAlertConfiguration({ ...readyEnvironment, OPS_ALERT_REPEAT_MINUTES: '5' }).status, 'misconfigured');
  assert.equal(getOpsAlertConfiguration(readyEnvironment).status, 'ready');
});

test('signed webhook contains only fixed operational data and confirms its durable claim', async () => {
  const claimId = randomUUID();
  const calls = [];
  const completed = [];
  const released = [];
  const observedAt = '2026-10-08T09:00:00.000Z';
  const result = await dispatchOpsAlert(unhealthyObservation, {
    environment: readyEnvironment,
    now: () => new Date(observedAt),
    store: {
      claim: async () => ({
        claimId,
        worker: 'lead_email_delivery',
        state: 'unhealthy',
        transition: 'degraded',
        fingerprint: 'a'.repeat(64),
      }),
      complete: async (input) => { completed.push(input); return true; },
      release: async (worker, id) => { released.push({ worker, id }); return true; },
    },
    transport: async (input) => {
      calls.push(input);
      return 'accepted';
    },
    resolveAddresses: publicDns,
  });

  assert.deepEqual(result, { status: 'sent' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.href, readyEnvironment.OPS_ALERT_WEBHOOK_URL);
  assert.equal(calls[0].pinnedAddress, '93.184.216.34');
  const body = calls[0].body;
  const payload = JSON.parse(body);
  assert.deepEqual(payload.reasonCodes, ['failed_delivery', 'unknown_delivery']);
  assert.deepEqual(payload.metrics, { unknown: 2, failed: 1 });
  assert.equal(payload.eventId, claimId);
  assert.equal(payload.observedAt, observedAt);
  assert.doesNotMatch(body, /@|smtp|https?:|secret|forbidden_email_metric/i);
  const expectedSignature = createHmac('sha256', readyEnvironment.OPS_ALERT_SIGNING_SECRET)
    .update(`${observedAt}.${body}`)
    .digest('hex');
  assert.equal(calls[0].headers['x-astana-alert-signature'], `sha256=${expectedSignature}`);
  assert.equal(completed.length, 1);
  assert.equal(released.length, 0);
});

test('failed webhook releases the claim and cannot change worker delivery state', async () => {
  const claimId = randomUUID();
  let completed = 0;
  let released = 0;
  const result = await dispatchOpsAlert(unhealthyObservation, {
    environment: readyEnvironment,
    store: {
      claim: async () => ({ claimId, worker: 'lead_email_delivery', state: 'unhealthy', transition: 'repeated', fingerprint: 'b'.repeat(64) }),
      complete: async () => { completed += 1; return true; },
      release: async () => { released += 1; return true; },
    },
    transport: async () => 'rejected',
    resolveAddresses: publicDns,
  });
  assert.deepEqual(result, { status: 'failed' });
  assert.equal(completed, 0);
  assert.equal(released, 1);
});

test('state-store outage is fail-closed and never emits an unclaimed alert', async () => {
  let fetches = 0;
  const dependencies = {
    environment: readyEnvironment,
    now: () => new Date('2026-10-08T09:07:00.000Z'),
    store: {
      claim: async () => { throw new Error('database unavailable'); },
      complete: async () => false,
      release: async () => false,
    },
    transport: async () => {
      fetches += 1;
      return 'accepted';
    },
    resolveAddresses: publicDns,
  };
  const first = await dispatchOpsAlert(unhealthyObservation, dependencies);
  const second = await dispatchOpsAlert(unhealthyObservation, dependencies);
  assert.deepEqual(first, { status: 'failed' });
  assert.deepEqual(second, { status: 'failed' });
  assert.equal(fetches, 0);

  const healthy = await dispatchOpsAlert({
    worker: 'lead_email_delivery', state: 'healthy', reasonCodes: [], metrics: {},
  }, dependencies);
  assert.deepEqual(healthy, { status: 'failed' });
});

test('DNS alias resolving to an internal address is rejected before fetch', async () => {
  let fetches = 0;
  let releases = 0;
  const result = await dispatchOpsAlert(unhealthyObservation, {
    environment: readyEnvironment,
    store: {
      claim: async () => ({
        claimId: randomUUID(), worker: 'lead_email_delivery', state: 'unhealthy',
        transition: 'degraded', fingerprint: 'c'.repeat(64),
      }),
      complete: async () => true,
      release: async () => { releases += 1; return true; },
    },
    resolveAddresses: async () => ['127.0.0.1'],
    transport: async () => { fetches += 1; return 'accepted'; },
  });
  assert.deepEqual(result, { status: 'failed' });
  assert.equal(fetches, 0);
  assert.equal(releases, 1);
});

test('ambiguous network result preserves the claim and stable event ID for retry', async () => {
  const claimId = randomUUID();
  const ids = [];
  let releases = 0;
  const dependencies = {
    environment: readyEnvironment,
    store: {
      claim: async () => ({
        claimId, worker: 'lead_email_delivery', state: 'unhealthy',
        transition: 'degraded', fingerprint: 'd'.repeat(64),
      }),
      complete: async () => true,
      release: async () => { releases += 1; return true; },
    },
    resolveAddresses: publicDns,
    transport: async (input) => {
      ids.push(input.headers['x-astana-alert-id']);
      return 'unknown';
    },
  };
  assert.deepEqual(await dispatchOpsAlert(unhealthyObservation, dependencies), { status: 'delivery_unknown' });
  assert.deepEqual(await dispatchOpsAlert(unhealthyObservation, dependencies), { status: 'delivery_unknown' });
  assert.deepEqual(ids, [claimId, claimId]);
  assert.equal(releases, 0);
});

test('a resolver that never settles is bounded by the absolute delivery deadline', async () => {
  let transports = 0;
  let releases = 0;
  const startedAt = Date.now();
  const result = await dispatchOpsAlert(unhealthyObservation, {
    environment: readyEnvironment,
    timeoutMs: 20,
    store: {
      claim: async () => ({
        claimId: randomUUID(), worker: 'lead_email_delivery', state: 'unhealthy',
        transition: 'degraded', fingerprint: 'f'.repeat(64),
      }),
      complete: async () => true,
      release: async () => { releases += 1; return true; },
    },
    resolveAddresses: async () => new Promise(() => undefined),
    transport: async () => { transports += 1; return 'accepted'; },
  });
  assert.deepEqual(result, { status: 'failed' });
  assert.ok(Date.now() - startedAt < 500);
  assert.equal(transports, 0);
  assert.equal(releases, 1);
});
