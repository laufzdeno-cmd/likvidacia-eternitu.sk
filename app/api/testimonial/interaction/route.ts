import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordPublicReviewInteraction } from '@/src/server/db';
import { consumeSharedRateLimit, trustedRateLimitClientIp } from '@/src/server/shared-rate-limit';

export const runtime = 'nodejs';

const requestWindowMs = 60_000;
const maxRequestsPerWindow = 12;
const bodySchema = z.object({ token: z.string().trim().regex(/^[A-Za-z0-9_-]{40,80}$/) }).strict();

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (!origin || (fetchSite && fetchSite !== 'same-origin')) return false;
  const allowed = new Set((process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk')
    .split(',').map((item) => item.trim()).filter(Boolean));
  try {
    allowed.add(new URL(request.url).origin);
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

async function rateLimited(request: NextRequest) {
  return consumeSharedRateLimit(
    'review-interaction',
    trustedRateLimitClientIp(request.headers),
    maxRequestsPerWindow,
    requestWindowMs,
  );
}

function response(ok: boolean, status: number) {
  return NextResponse.json({ ok }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return response(false, 403);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return response(false, 415);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(contentLength) || contentLength > 2048) return response(false, 413);
  try {
    if (await rateLimited(request)) return response(false, 429);
  } catch {
    return response(false, 503);
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 2048) return response(false, 413);
    parsed = bodySchema.parse(JSON.parse(rawBody));
  } catch {
    return response(false, 400);
  }

  try {
    const recorded = await recordPublicReviewInteraction(parsed.token);
    return recorded ? response(true, 200) : response(false, 404);
  } catch {
    return response(false, 503);
  }
}
