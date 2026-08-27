import { NextResponse } from 'next/server';
import { revokeMetaCapiOutboxForConsentSubject } from '@/src/server/db';
import { marketingConsentSubjectCookieName } from '@/src/lib/marketing-consent';

export const runtime = 'nodejs';

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const cookie = request.headers.get('cookie') || '';
  const rawSubject = cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${marketingConsentSubjectCookieName}=`))
    ?.slice(marketingConsentSubjectCookieName.length + 1) || '';
  let subject = '';
  try {
    subject = decodeURIComponent(rawSubject);
  } catch {
    subject = '';
  }
  const revoked = await revokeMetaCapiOutboxForConsentSubject(subject);
  return NextResponse.json({ ok: true, revoked });
}
