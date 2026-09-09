import { NextRequest, NextResponse } from 'next/server';
import { createMarketingConsentToken, marketingConsentCookieName, marketingConsentMaxAgeSeconds } from '@/src/server/marketing-consent';

export const runtime = 'nodejs';

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  try {
    return Boolean(origin && host && new URL(origin).host === host);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { choice?: unknown } | null;
  const choice = body?.choice === 'accepted' || body?.choice === 'rejected' ? body.choice : null;
  if (!choice) return NextResponse.json({ ok: false }, { status: 400 });

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
  const response = NextResponse.json({ ok: true, choice });
  if (choice === 'rejected') {
    response.cookies.set(marketingConsentCookieName, '', { ...cookieOptions, maxAge: 0 });
    return response;
  }

  const token = createMarketingConsentToken();
  if (!token) return NextResponse.json({ ok: false, reason: 'consent_signing_unavailable' }, { status: 503 });
  response.cookies.set(marketingConsentCookieName, token, { ...cookieOptions, maxAge: marketingConsentMaxAgeSeconds });
  return response;
}
