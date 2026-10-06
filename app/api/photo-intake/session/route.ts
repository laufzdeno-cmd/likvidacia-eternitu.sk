import { createHash, createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { NextRequest, NextResponse } from 'next/server';
import { consumeApiRateLimit, consumePhotoUploadInviteByHash } from '@/src/server/db';
import { clearPhotoUploadSession, setPhotoUploadSession } from '@/src/server/photo-intake-auth';
import { privatePhotoIntakeEnabled } from '@/src/server/photo-intake-config';

export const runtime = 'nodejs';

const attemptWindowMs = 10 * 60_000;
const maxAttemptsPerWindow = 8;

function sameOrigin(request: NextRequest) {
  return request.headers.get('origin') === request.nextUrl.origin;
}

function trustedClientIp(request: NextRequest) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && isIP(realIp)) return realIp;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').map((value) => value.trim()).filter(Boolean);
  const proxyIp = forwarded?.at(-1);
  return proxyIp && isIP(proxyIp) ? proxyIp : 'unknown';
}

async function isRateLimited(request: NextRequest) {
  const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-dev-auth-secret-change-me');
  if (!secret) throw new Error('AUTH_SECRET is required for photo-intake rate limiting.');
  const current = Date.now();
  const windowStartedAt = new Date(Math.floor(current / attemptWindowMs) * attemptWindowMs);
  const bucketKey = createHmac('sha256', secret).update(`photo-intake-session:v1:${trustedClientIp(request)}`).digest('hex');
  return consumeApiRateLimit(bucketKey, windowStartedAt, maxAttemptsPerWindow);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Neplatný pôvod požiadavky.' }, { status: 403 });
  try {
    const body = await request.json() as { code?: unknown; logout?: unknown };
    if (body.logout === true) {
      await clearPhotoUploadSession();
      return NextResponse.json({ ok: true });
    }
    if (!privatePhotoIntakeEnabled()) return NextResponse.json({ error: 'Súkromné nahrávanie ešte nie je zapnuté.' }, { status: 503 });
    if (await isRateLimited(request)) return NextResponse.json({ error: 'Príliš veľa pokusov. Skúste to o 10 minút.' }, { status: 429 });
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (code.length < 32 || code.length > 100) return NextResponse.json({ error: 'Kód nie je platný alebo už bol použitý.' }, { status: 401 });
    const tokenHash = createHash('sha256').update(code).digest('hex');
    const invite = await consumePhotoUploadInviteByHash(tokenHash);
    if (!invite) return NextResponse.json({ error: 'Kód nie je platný alebo už bol použitý.' }, { status: 401 });
    await setPhotoUploadSession(invite.id, invite.expiresAt);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Prihlásenie sa nepodarilo. Skúste to neskôr.' }, { status: 503 });
  }
}
