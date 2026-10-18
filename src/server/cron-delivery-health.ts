type DailyNotificationsHealthInput = {
  notificationFailures: number;
  leadEmailFailed: boolean;
  rateLimitCleanupFailed: boolean;
  analyticsFailed: boolean;
  analyticsRemaining: boolean;
  analyticsUnrecoverable: number;
  emailOutbox: {
    pending: number;
    sending: number;
    failed: number;
    unknown: number;
  };
};

type ReviewReminderHealthInput = {
  failed: number;
  unknown: number;
  recovered: number;
};

function result(ok: boolean) {
  return { ok, status: ok ? 200 : 503 } as const;
}

export function evaluateDailyNotificationsHealth(input: DailyNotificationsHealthInput) {
  return result(
    input.notificationFailures === 0
      && !input.leadEmailFailed
      && !input.rateLimitCleanupFailed
      && !input.analyticsFailed
      && !input.analyticsRemaining
      && input.analyticsUnrecoverable === 0
      && input.emailOutbox.pending === 0
      && input.emailOutbox.sending === 0
      && input.emailOutbox.failed === 0
      && input.emailOutbox.unknown === 0,
  );
}

export function evaluateReviewReminderHealth(input: ReviewReminderHealthInput) {
  return result(input.failed === 0 && input.unknown === 0 && input.recovered === 0);
}
