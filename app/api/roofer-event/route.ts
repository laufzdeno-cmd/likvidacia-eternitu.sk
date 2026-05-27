import { NextRequest, NextResponse } from 'next/server';
import { recordRooferEvent, type RooferEventType } from '@/src/server/db';

export const runtime = 'nodejs';

const allowedEvents = new Set<RooferEventType>(['card_viewed', 'contact_revealed', 'quote_selected']);
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 60;

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function rateLimited(ip: string) {
  const now = Date.now();
  const current = buckets.get(ip);
  if (!current || current.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_EVENTS_PER_WINDOW;
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ ok: false }, { status: 429 });
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
