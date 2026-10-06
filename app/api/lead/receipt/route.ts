import { NextRequest, NextResponse } from 'next/server';
import { consumeSharedRateLimit, trustedRateLimitClientIp } from '@/src/server/shared-rate-limit';
import { leadReceiptSecret, verifyLeadReceiptToken } from '@/src/server/lead-receipt';
import { limitValidLeadReceipt } from '@/src/server/lead-receipt-rate-limit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const receipt = verifyLeadReceiptToken(token, leadReceiptSecret());
  if (receipt) {
    if (await limitValidLeadReceipt(token)) {
      return NextResponse.json({ accepted: false }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(receipt, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    if (await consumeSharedRateLimit('lead-receipt-status', trustedRateLimitClientIp(request.headers), 60, 60_000)) {
      return NextResponse.json({ accepted: false }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
    }
  } catch {
    return NextResponse.json({ accepted: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json({ accepted: false }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
