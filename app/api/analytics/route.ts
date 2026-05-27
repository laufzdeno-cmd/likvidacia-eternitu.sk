import { NextRequest, NextResponse } from 'next/server';
import { recordAnalyticsEvent } from '@/src/server/db';
import type { AnalyticsEventType } from '@/src/server/types';

export const runtime = 'nodejs';

const allowedEventTypes = new Set<AnalyticsEventType>([
  'page_view',
  'quote_section_view',
  'form_start',
  'form_submit_success',
  'form_submit_error',
  'cta_click',
  'phone_click',
  'price_calculator_change',
  'gallery_filter',
  'reviews_expand',
  'roofer_registration_success',
]);

const buckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function rateLimited(ip: string) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 80;
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

function cleanText(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventType = cleanText(payload.eventType) as AnalyticsEventType;
  const sessionId = cleanText(payload.sessionId);
  if (!sessionId || !allowedEventTypes.has(eventType)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await recordAnalyticsEvent({
    sessionId,
    eventType,
    path: cleanText(payload.path, '/'),
    referrer: cleanText(payload.referrer),
    device: cleanText(payload.device, 'desktop') as 'desktop' | 'tablet' | 'mobile',
    viewportWidth: Number(payload.viewportWidth || 0) || undefined,
    utmSource: cleanText(payload.utmSource),
    utmMedium: cleanText(payload.utmMedium),
    utmCampaign: cleanText(payload.utmCampaign),
    metadata: typeof payload.metadata === 'object' && payload.metadata !== null ? (payload.metadata as Record<string, unknown>) : {},
  });

  return NextResponse.json({ ok: true });
}
