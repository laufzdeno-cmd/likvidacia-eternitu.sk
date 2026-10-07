import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { dispatchMetaCapiOutbox, isMetaCapiConfigured } from '@/src/server/meta-conversions-api';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || '';
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!secret || !supplied) return false;
  const expected = createHash('sha256').update(secret).digest();
  const actual = createHash('sha256').update(supplied).digest();
  return timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!isMetaCapiConfigured()) {
    return NextResponse.json({ ok: false, code: 'META_CAPI_NOT_CONFIGURED' }, { status: 503 });
  }
  try {
    const result = await dispatchMetaCapiOutbox({ limit: 10 });
    const unresolved = result.failed + result.unknown;
    return NextResponse.json({ ok: unresolved === 0, ...result }, { status: unresolved > 0 ? 503 : 200 });
  } catch (error) {
    console.error('Meta CAPI worker failed.', { error: error instanceof Error ? error.name : 'unknown' });
    return NextResponse.json({ ok: false, code: 'META_CAPI_WORKER_FAILED' }, { status: 500 });
  }
}
