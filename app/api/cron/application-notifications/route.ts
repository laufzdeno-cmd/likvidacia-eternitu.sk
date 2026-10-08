import { NextResponse } from 'next/server';
import { runApplicationNotificationRecovery } from '@/src/server/application-notifications';

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
    return NextResponse.json({
      ok,
      applicationNotifications,
    }, { status: applicationNotifications.errors > 0 ? 500 : ok ? 200 : 503 });
  } catch (error) {
    console.error('Application notification recovery worker failed.', error);
    return NextResponse.json({
      ok: false,
      error: 'Application notification recovery failed.',
    }, { status: 500 });
  }
}
