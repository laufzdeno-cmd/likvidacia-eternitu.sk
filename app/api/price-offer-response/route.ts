import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { submitPublicPriceOfferResponse } from '@/src/server/db';
import { consumeSharedRateLimit, trustedRateLimitClientIp } from '@/src/server/shared-rate-limit';

export const runtime = 'nodejs';

const bodySchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{40,80}$/),
  response: z.enum(['ACCEPTED', 'DEFERRED', 'DECLINED']),
  reasonCode: z.enum(['', 'price', 'timing', 'selected_other', 'no_longer_needed', 'other']).default(''),
  requestedFollowUpAt: z.string().trim().max(10).default(''),
  confirmedReview: z.literal(true),
}).strict();

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

function response(ok: boolean, status: number, message: string) {
  return NextResponse.json({ ok, message }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return response(false, 403, 'Požiadavku sa nepodarilo bezpečne overiť.');
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return response(false, 415, 'Nepodporovaný formát požiadavky.');
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(contentLength) || contentLength > 4096) return response(false, 413, 'Požiadavka je príliš veľká.');

  let parsed: z.infer<typeof bodySchema>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 4096) return response(false, 413, 'Požiadavka je príliš veľká.');
    parsed = bodySchema.parse(JSON.parse(rawBody));
  } catch {
    return response(false, 400, 'Skontrolujte vybrané údaje.');
  }

  const tokenRateKey = createHash('sha256').update(parsed.token, 'utf8').digest('hex');
  try {
    const [ipLimited, tokenLimited] = await Promise.all([
      consumeSharedRateLimit('price-offer-response-ip', trustedRateLimitClientIp(request.headers), 12, 60_000),
      consumeSharedRateLimit('price-offer-response-token', tokenRateKey, 8, 60_000),
    ]);
    if (ipLimited || tokenLimited) return response(false, 429, 'Príliš veľa pokusov. Skúste to o chvíľu.');
  } catch {
    return response(false, 503, 'Bezpečnostnú kontrolu sa nepodarilo dokončiť. Skúste to neskôr.');
  }

  try {
    const result = await submitPublicPriceOfferResponse(parsed);
    if (result.status === 'created' || result.status === 'idempotent') {
      return response(true, 200, 'Vyjadrenie sme prijali na kontrolu.');
    }
    if (result.status === 'conflict') return response(false, 409, 'Cez tento odkaz už bolo uložené iné vyjadrenie. Kontaktujte nás, ak ho potrebujete zmeniť.');
    if (result.status === 'invalid') return response(false, 400, 'Skontrolujte vybrané údaje.');
    return response(false, 404, 'Odkaz nie je platný alebo už vypršal.');
  } catch {
    return response(false, 503, 'Vyjadrenie sa teraz nepodarilo uložiť. Skúste to neskôr.');
  }
}
