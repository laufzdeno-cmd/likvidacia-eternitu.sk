import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { dispatchGmailPriceOfferLabels } from '@/src/server/gmail-price-offer-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const expectedValue = process.env.CRON_SECRET?.trim() || '';
  const suppliedValue = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!expectedValue || !suppliedValue) return false;
  const expected = createHash('sha256').update(expectedValue).digest();
  const supplied = createHash('sha256').update(suppliedValue).digest();
  return timingSafeEqual(expected, supplied);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await dispatchGmailPriceOfferLabels(10);
    return NextResponse.json({ ok: result.attention === 0, ...result }, { status: result.attention ? 503 : 200 });
  } catch (error) {
    console.error('Gmail price-offer label worker failed.', { error: error instanceof Error ? error.name : 'unknown' });
    return NextResponse.json({ ok: false, code: 'GMAIL_PRICE_OFFER_WORKER_FAILED' }, { status: 500 });
  }
}
