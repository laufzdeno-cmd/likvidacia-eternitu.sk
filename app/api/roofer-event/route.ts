import { NextRequest, NextResponse } from 'next/server';
import { recordRooferEvent, type RooferEventType } from '@/src/server/db';

export const runtime = 'nodejs';

const allowedEvents = new Set<RooferEventType>(['card_viewed', 'contact_revealed', 'quote_selected']);

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk,http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      rooferId?: string;
      eventType?: RooferEventType;
      region?: string;
      page?: string;
      referrer?: string;
    };
    const rooferId = String(body.rooferId || '').trim();
    const eventType = body.eventType;

    if (!rooferId || !eventType || !allowedEvents.has(eventType)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await recordRooferEvent(rooferId, eventType, {
      region: body.region || '',
      page: body.page || request.headers.get('referer') || '',
      referrer: body.referrer || request.headers.get('referer') || '',
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
