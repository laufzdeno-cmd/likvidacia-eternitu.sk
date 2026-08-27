import { NextResponse } from 'next/server';
import { dispatchMetaCapiOutbox } from '@/src/server/meta-conversions-api';
import { cronAuthorizationStatus } from '@/src/server/cron-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authorizationStatus = cronAuthorizationStatus(request);
  if (authorizationStatus) return NextResponse.json({ error: 'Unauthorized' }, { status: authorizationStatus });
  const result = await dispatchMetaCapiOutbox({ limit: 25 });
  return NextResponse.json({ ok: true, ...result });
}
