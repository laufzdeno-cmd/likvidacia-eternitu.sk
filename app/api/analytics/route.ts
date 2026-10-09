import { NextRequest, NextResponse } from 'next/server';
import { recordAnalyticsEvent } from '@/src/server/db';
import { analyticsConsentCookieName, marketingConsentCookieName } from '@/src/lib/marketing-consent';
import { analyticsOriginAllowed, publicAnalyticsPayloadSchema } from '@/src/server/public-analytics-policy';
import { consumeSharedRateLimit, trustedRateLimitClientIp } from '@/src/server/shared-rate-limit';
import { AnalyticsBodyTooLargeError, readAnalyticsRequestBody } from '@/src/server/analytics-request-body';

export const runtime = 'nodejs';

const maximumBodyBytes = 16 * 1024;

export async function POST(request: NextRequest) {
  if (!analyticsOriginAllowed(request.headers.get('origin'), process.env.NODE_ENV)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  // Client-side consent checks are not a security boundary. Enforce the same
  // choice here so stale or manually crafted requests cannot create analytics.
  if (request.cookies.get(analyticsConsentCookieName)?.value !== 'granted') {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  // Invalid and oversized requests consume the same quota before any body read.
  try {
    if (await consumeSharedRateLimit(
      'analytics-event-address',
      trustedRateLimitClientIp(request.headers),
      80,
      60_000,
    )) return NextResponse.json({ ok: false }, { status: 429 });
  } catch (error) {
    console.error('Analytics rate limit unavailable', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let rawBody: string;
  try {
    rawBody = await readAnalyticsRequestBody(request, maximumBodyBytes);
  } catch (error) {
    return NextResponse.json({ ok: false }, { status: error instanceof AnalyticsBodyTooLargeError ? 413 : 400 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = publicAnalyticsPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const payload = parsed.data;
  const metadata = { ...payload.metadata };
  if (request.cookies.get(marketingConsentCookieName)?.value !== 'granted') delete metadata.adClickIds;

  await recordAnalyticsEvent({
    sessionId: payload.sessionId,
    eventType: payload.eventType,
    path: payload.path,
    referrer: payload.referrer,
    device: payload.device,
    viewportWidth: payload.viewportWidth,
    utmSource: payload.utmSource,
    utmMedium: payload.utmMedium,
    utmCampaign: payload.utmCampaign,
    metadata,
  });

  return NextResponse.json({ ok: true });
}
