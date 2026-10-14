import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { claimReviewReminder, listDueReviewReminders, recordReviewReminderResult, recoverStaleReviewRequestDeliveries } from '@/src/server/db';
import { sendReviewRequestEmail } from '@/src/server/review-request-mail';
import { getReviewRequestSettings } from '@/src/server/review-request-settings';

export const runtime = 'nodejs';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || '';
  const authorization = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (!secret || authorization.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const recovered = await recoverStaleReviewRequestDeliveries('cron:review-reminders');
  const settings = await getReviewRequestSettings();
  if (!settings.reminderEnabled) {
    return NextResponse.json({ ok: true, disabled: true, processed: 0, recovered }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const due = await listDueReviewReminders(settings.batchLimit);
  let smtpAccepted = 0;
  let failed = 0;
  let unknown = 0;
  for (const requestItem of due) {
    const claimed = await claimReviewReminder(requestItem.id, requestItem.revision, 'cron:review-reminders');
    if (!claimed) continue;
    const outcome = await sendReviewRequestEmail(claimed.request, claimed.token, settings.reminderBody, { reminder: true });
    const completed = await recordReviewReminderResult(
      claimed.request.id,
      claimed.request.revision,
      outcome,
      'cron:review-reminders',
    );
    if (!completed) {
      unknown += 1;
      continue;
    }
    if (outcome.status === 'smtp_accepted') smtpAccepted += 1;
    else if (outcome.status === 'delivery_failed') failed += 1;
    else unknown += 1;
  }

  return NextResponse.json(
    { ok: true, processed: smtpAccepted + failed + unknown, smtpAccepted, failed, unknown, recovered },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
