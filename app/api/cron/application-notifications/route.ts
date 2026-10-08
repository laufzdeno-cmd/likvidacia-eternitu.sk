import { NextResponse } from 'next/server';
import { runApplicationNotificationRecovery } from '@/src/server/application-notifications';
import { dispatchOpsAlert } from '@/src/server/ops-alert-dispatch';
import type { OpsAlertReasonCode } from '@/src/server/ops-alert-policy';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const applicationNotifications = await runApplicationNotificationRecovery(2);
    const ok = applicationNotifications.errors === 0
      && applicationNotifications.staleClaimsMarkedUnknown === 0
      && applicationNotifications.health.pending === 0
      && applicationNotifications.health.failed === 0
      && applicationNotifications.health.unknown === 0
      && applicationNotifications.health.staleSending === 0;
    const reasonCodes: OpsAlertReasonCode[] = [];
    if (applicationNotifications.errors > 0) reasonCodes.push('run_errors');
    if (applicationNotifications.staleClaimsMarkedUnknown > 0) reasonCodes.push('stale_claim_recovered');
    if (applicationNotifications.health.pending > 0) reasonCodes.push('pending_backlog');
    if (applicationNotifications.health.failed > 0) reasonCodes.push('failed_delivery');
    if (applicationNotifications.health.unknown > 0) reasonCodes.push('unknown_delivery');
    if (applicationNotifications.health.staleSending > 0) reasonCodes.push('stale_sending');
    const operationsAlert = await dispatchOpsAlert({
      worker: 'application_notifications',
      state: ok ? 'healthy' : 'unhealthy',
      reasonCodes,
      metrics: {
        errors: applicationNotifications.errors,
        stale_claims_marked_unknown: applicationNotifications.staleClaimsMarkedUnknown,
        pending: applicationNotifications.health.pending,
        failed: applicationNotifications.health.failed,
        unknown: applicationNotifications.health.unknown,
        stale_sending: applicationNotifications.health.staleSending,
      },
    });
    return NextResponse.json({
      ok,
      applicationNotifications,
      operationsAlert: operationsAlert.status,
    }, { status: applicationNotifications.errors > 0 ? 500 : ok ? 200 : 503 });
  } catch (error) {
    console.error('Application notification recovery worker failed.', error);
    const operationsAlert = await dispatchOpsAlert({
      worker: 'application_notifications',
      state: 'unhealthy',
      reasonCodes: ['worker_exception'],
      metrics: {},
    });
    return NextResponse.json({
      ok: false,
      error: 'Application notification recovery failed.',
      operationsAlert: operationsAlert.status,
    }, { status: 500 });
  }
}
