import { NextResponse } from 'next/server';
import {
  addAuditLog,
  claimLeadEmailOutbox,
  getLeadEmailOutboxAttention,
  getLeadEmailOutboxHealth,
  listLeadEmailOutbox,
  listPendingLeadEmailDeliveries,
  markStaleLeadEmailClaimsUnknown,
  recordLeadEmailRecipientResult,
} from '@/src/server/db';
import { leadDeliveryMode } from '@/src/server/astana-local-relay';
import { evaluateLeadEmailWorkerHealth } from '@/src/server/lead-email-worker-health';
import { hasLeadEmailTransportConfiguration, hasUsableLeadSmtpConfiguration, sendLeadEmailToRecipient, sendLeadEmails } from '@/src/server/mail';

export const runtime = 'nodejs';

const MAX_DELIVERIES_PER_RUN = 5;
const LOOKAHEAD_LIMIT = 25;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

async function deliverPendingLeadEmail(
  pendingDelivery: Awaited<ReturnType<typeof listPendingLeadEmailDeliveries>>[number],
  mode: ReturnType<typeof leadDeliveryMode>,
) {
  const { lead, pendingRoles } = pendingDelivery;
  if (pendingRoles.length === 1 && (mode === 'local_relay' || !hasUsableLeadSmtpConfiguration())) {
    // The relay sends a pair, never one recipient. Do not claim a one-sided attempt it cannot safely send.
    return { sent: false, deferred: true };
  }
  if ((mode === 'local_relay' || mode === 'smtp_then_local_relay') && pendingRoles.length === 2) {
    await sendLeadEmails(lead, pendingDelivery.fileCount, pendingDelivery.businessJobId, {
      claim: (role) => claimLeadEmailOutbox(lead.id, role),
      record: async (role, delivery, attemptToken) => {
        const recorded = await recordLeadEmailRecipientResult(lead.id, role, delivery, attemptToken);
        if (!recorded) throw new Error('outbox_result_not_recorded');
      },
    });
  } else if (mode !== 'local_relay') {
    for (const role of pendingRoles) {
      const attemptToken = await claimLeadEmailOutbox(lead.id, role);
      if (!attemptToken) continue;

      let delivery;
      try {
        delivery = await sendLeadEmailToRecipient(lead, role, pendingDelivery.fileCount, pendingDelivery.businessJobId);
      } catch {
        // An interrupted/ambiguous send must remain unknown, never be auto-retried.
        delivery = { status: 'unknown' as const, reason: 'Výsledok odoslania sa nepodarilo potvrdiť.' };
      }

      const recorded = await recordLeadEmailRecipientResult(lead.id, role, delivery, attemptToken);
      if (!recorded) throw new Error('outbox_result_not_recorded');
    }
  }

  const recipientStatuses = await listLeadEmailOutbox(lead.id);
  const allSent = (['customer', 'internal'] as const).every((role) =>
    recipientStatuses.some((item) => item.recipientRole === role && item.status === 'sent'));
  await addAuditLog('lead', lead.id, allSent ? 'lead_email_sent' : 'lead_email_error', 'lead-email-cron', {
    processedRoles: pendingRoles,
    statuses: recipientStatuses.map(({ recipientRole, status, attempts }) => ({ recipientRole, status, attempts })),
  });
  return { sent: allSent };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await markStaleLeadEmailClaimsUnknown();
    const mode = leadDeliveryMode();
    if (!hasLeadEmailTransportConfiguration(mode)) {
      return NextResponse.json({ ok: false, code: 'LEAD_EMAIL_TRANSPORT_NOT_CONFIGURED', outbox: await getLeadEmailOutboxHealth() }, { status: 503 });
    }
    const pairsOnly = mode === 'local_relay' || (mode === 'smtp_then_local_relay' && !hasUsableLeadSmtpConfiguration());
    const pendingDeliveries = await listPendingLeadEmailDeliveries(LOOKAHEAD_LIMIT, pairsOnly);
    let sent = 0;
    let unresolved = 0;
    let errors = 0;
    let deferred = 0;

    for (const delivery of pendingDeliveries.slice(0, MAX_DELIVERIES_PER_RUN)) {
      try {
        const result = await deliverPendingLeadEmail(delivery, mode);
        if ('deferred' in result && result.deferred) deferred += 1;
        else if (result.sent) sent += 1;
        else unresolved += 1;
      } catch {
        // Do not return or log lead data, recipient addresses, or provider diagnostics.
        errors += 1;
      }
    }

    const outbox = await getLeadEmailOutboxHealth();
    const attention = await getLeadEmailOutboxAttention();
    const pendingWithoutSingleRecipientTransport = pairsOnly && outbox.pending > 0;
    const workerHealth = evaluateLeadEmailWorkerHealth({
      errors,
      unresolved,
      deferred,
      pendingWithoutSingleRecipientTransport,
      attention,
    });
    return NextResponse.json({
      ok: workerHealth.ok,
      considered: pendingDeliveries.length,
      processed: sent + unresolved + errors,
      sent,
      unresolved,
      deferred,
      errors,
      outbox,
      attention: workerHealth.attention,
    }, { status: workerHealth.status });
  } catch {
    // Keep the response safe for callers and monitoring systems.
    return NextResponse.json({ ok: false, error: 'Lead email delivery worker failed', code: 'LEAD_EMAIL_WORKER_FAILED' }, { status: 500 });
  }
}
