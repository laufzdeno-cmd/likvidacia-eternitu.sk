import assert from 'node:assert/strict';
import test from 'node:test';

test('business periods use Bratislava calendar dates at UTC month boundaries', async () => {
  const { businessDateKey, businessPeriodBounds, businessTodayKey } = await import('../src/lib/business-period.ts');
  const nearUtcMonthEnd = new Date('2026-01-31T23:30:00.000Z'); // 1 February in Bratislava
  assert.equal(businessTodayKey(nearUtcMonthEnd), '2026-02-01');
  assert.deepEqual(businessPeriodBounds('month', undefined, undefined, nearUtcMonthEnd), {
    from: '2026-02-01', to: '2026-02-28', label: 'Tento mesiac', valid: true,
  });
  assert.deepEqual(businessPeriodBounds('last-month', undefined, undefined, nearUtcMonthEnd), {
    from: '2026-01-01', to: '2026-01-31', label: 'Minulý mesiac', valid: true,
  });
  assert.equal(businessDateKey('2026-01-31T23:30:00.000Z'), '2026-02-01');
});

test('business period rejects malformed or reversed custom ranges', async () => {
  const { businessPeriodBounds } = await import('../src/lib/business-period.ts');
  const now = new Date('2026-10-01T10:00:00.000Z');
  assert.deepEqual(businessPeriodBounds('custom', '2026-02-30', '2026-03-01', now), {
    from: '', to: '', label: 'Neplatné vlastné obdobie', valid: false,
  });
  assert.deepEqual(businessPeriodBounds('custom', '2026-04-01', '2026-03-31', now), {
    from: '', to: '', label: 'Neplatné vlastné obdobie', valid: false,
  });
  assert.deepEqual(businessPeriodBounds('custom', '2026-03-01', '2026-03-31', now), {
    from: '2026-03-01', to: '2026-03-31', label: '2026-03-01 – 2026-03-31', valid: true,
  });
});

test('timestamp filtering uses Bratislava business date, not the UTC date prefix', async () => {
  const { isBusinessDateInPeriod } = await import('../src/lib/business-period.ts');
  const stamp = '2026-01-31T23:30:00.000Z';
  assert.equal(isBusinessDateInPeriod(stamp, '2026-02-01', '2026-02-28'), true);
  assert.equal(isBusinessDateInPeriod(stamp, '2026-01-01', '2026-01-31'), false);
});
