import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  evaluateDailyNotificationsHealth,
  evaluateReviewReminderHealth,
} from '../src/server/cron-delivery-health.ts';

const healthyDailyInput = () => ({
  notificationFailures: 0,
  leadEmailFailed: false,
  rateLimitCleanupFailed: false,
  analyticsFailed: false,
  analyticsRemaining: false,
  analyticsUnrecoverable: 0,
  emailOutbox: { pending: 0, sending: 0, failed: 0, unknown: 0 },
});

test('daily notification health returns 503 for every unresolved internal delivery state', () => {
  assert.deepEqual(evaluateDailyNotificationsHealth(healthyDailyInput()), { ok: true, status: 200 });

  const unhealthy = [
    { notificationFailures: 1 },
    { leadEmailFailed: true },
    { rateLimitCleanupFailed: true },
    { analyticsFailed: true },
    { analyticsRemaining: true },
    { analyticsUnrecoverable: 1 },
    { emailOutbox: { pending: 1, sending: 0, failed: 0, unknown: 0 } },
    { emailOutbox: { pending: 0, sending: 1, failed: 0, unknown: 0 } },
    { emailOutbox: { pending: 0, sending: 0, failed: 1, unknown: 0 } },
    { emailOutbox: { pending: 0, sending: 0, failed: 0, unknown: 1 } },
  ];
  for (const change of unhealthy) {
    const input = { ...healthyDailyInput(), ...change };
    assert.deepEqual(evaluateDailyNotificationsHealth(input), { ok: false, status: 503 });
  }
});

test('review reminder health returns 503 for failed, unknown or stale recovered delivery', () => {
  assert.deepEqual(evaluateReviewReminderHealth({ failed: 0, unknown: 0, recovered: 0 }), { ok: true, status: 200 });
  assert.deepEqual(evaluateReviewReminderHealth({ failed: 1, unknown: 0, recovered: 0 }), { ok: false, status: 503 });
  assert.deepEqual(evaluateReviewReminderHealth({ failed: 0, unknown: 1, recovered: 0 }), { ok: false, status: 503 });
  assert.deepEqual(evaluateReviewReminderHealth({ failed: 0, unknown: 0, recovered: 1 }), { ok: false, status: 503 });
});

test('cron routes expose evaluated health as their HTTP status without invoking a worker in tests', async () => {
  const [dailyRoute, reviewRoute] = await Promise.all([
    readFile(new URL('../app/api/cron/notifications/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/cron/review-reminders/route.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(dailyRoute, /evaluateDailyNotificationsHealth\(\{/);
  assert.match(dailyRoute, /\{ status: health\.status \}/);
  assert.match(reviewRoute, /evaluateReviewReminderHealth\(\{ failed, unknown, recovered \}\)/);
  assert.match(reviewRoute, /status: health\.status/);
  assert.doesNotMatch(reviewRoute, /\{ ok: true, processed: smtpAccepted \+ failed \+ unknown/);
});
