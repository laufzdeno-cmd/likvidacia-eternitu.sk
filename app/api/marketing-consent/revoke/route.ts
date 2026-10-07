import { NextRequest, NextResponse } from 'next/server';
import { isMarketingConsentSubject, marketingConsentSubjectCookieName } from '@/src/lib/marketing-consent';
import { revokeMetaCapiOutboxForConsentSubject } from '@/src/server/db';

export const runtime = 'nodejs';

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  return Boolean(origin) && origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  const subject = request.cookies.get(marketingConsentSubjectCookieName)?.value || '';
  const revoked = isMarketingConsentSubject(subject)
    ? await revokeMetaCapiOutboxForConsentSubject(subject)
    : 0;
  const response = NextResponse.json({ ok: true, revoked }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(marketingConsentSubjectCookieName, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  });
  return response;
}
