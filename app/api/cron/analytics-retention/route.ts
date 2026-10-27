import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runAnalyticsRetention } from '@/src/server/db';
import { vercelCronRequestAllowed } from '@/src/server/preview-safety';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() ?? '';
  const expected = `Bearer ${secret}`;
  const authorization = request.headers.get('authorization') ?? '';
  if (!secret || Buffer.byteLength(authorization) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  // A direct invocation must retain the proxy's production-only cron boundary.
  // Unit/integration tests use explicit test mode and their own isolated storage.
  const isolatedTest = process.env.NODE_ENV === 'test' && !process.env.VERCEL;
  if (!isolatedTest && !vercelCronRequestAllowed(process.env, request.method, new URL(request.url).pathname, authorization)) {
    return NextResponse.json({ ok: false, error: 'Analytics retention is disabled for this deployment.' }, { status: 403 });
  }
  try {
    const result = await runAnalyticsRetention();
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    // Counts/cutoff only in successful responses; never log events, metadata or DB errors.
    console.error('Analytics retention failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ ok: false, error: 'Analytics retention is unavailable.' }, { status: 503 });
  }
}
