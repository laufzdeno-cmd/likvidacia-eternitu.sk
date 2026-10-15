import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { reconcileAdminAutopilot } from '@/src/server/admin-autopilot';

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
  try {
    const result = await reconcileAdminAutopilot({ actorEmail: 'cron:admin-autopilot', limit: 50 });
    const { blockedOfferJobIds, ...counts } = result;
    return NextResponse.json({ ok: true, ...counts, blockedOffers: blockedOfferJobIds.length }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'assistant_failed' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

