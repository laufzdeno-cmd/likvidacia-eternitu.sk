import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsEventExpired, analyticsEventRetained, analyticsRetentionCutoff, latestAnalyticsCutoff } from '../src/server/analytics-retention-policy.ts';

test('analytics retention subtracts twelve UTC calendar months and clamps leap day', () => {
  for (const [input, expected] of [
    ['2028-02-29T12:34:56.789Z', '2027-02-28T12:34:56.789Z'],
    ['2029-02-28T12:34:56.789Z', '2028-02-28T12:34:56.789Z'],
    ['2027-03-31T23:59:59.999Z', '2026-03-31T23:59:59.999Z'],
    ['2026-10-25T02:30:00+02:00', '2025-10-25T00:30:00.000Z'],
    ['2026-03-29T03:30:00+02:00', '2025-03-29T01:30:00.000Z'],
  ]) {
    const reference = new Date(input);
    const original = reference.toISOString();
    assert.equal(analyticsRetentionCutoff(reference), expected);
    assert.equal(reference.toISOString(), original, 'does not mutate caller clock');
  }
});

test('only strictly older events expire; malformed timestamps are preserved and excluded from reports', () => {
  const cutoff = '2027-02-28T12:34:56.789Z';
  assert.equal(analyticsEventExpired('2027-02-28T12:34:56.788Z', cutoff), true);
  for (const timestamp of [cutoff, '2027-02-28T12:34:56.790Z', '2030-01-01T00:00:00Z']) {
    assert.equal(analyticsEventExpired(timestamp, cutoff), false);
    assert.equal(analyticsEventRetained(timestamp, cutoff), true);
  }
  assert.equal(analyticsEventExpired('damaged', cutoff), false);
  assert.equal(analyticsEventRetained('damaged', cutoff), false);
  assert.throws(() => analyticsRetentionCutoff(new Date('invalid')), /Invalid analytics retention clock/);
});

test('retention watermark cannot move backward and ignores malformed snapshots', () => {
  assert.equal(latestAnalyticsCutoff(undefined, 'bad', '2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z'), '2026-01-02T00:00:00.000Z');
  assert.equal(latestAnalyticsCutoff(undefined, 'bad'), undefined);
});
