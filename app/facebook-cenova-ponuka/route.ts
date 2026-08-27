import { NextRequest, NextResponse } from 'next/server';

const FORWARDED_QUERY_KEYS = new Set(['fbclid']);
const UTM_KEY_PATTERN = /^utm_[a-z0-9_]{1,64}$/i;

/**
 * Meta Page CTAs reject URL fragments in their saved destination. This fixed,
 * first-party transition route preserves attribution parameters and forwards
 * visitors to the only allowed target: the homepage quote form.
 */
function redirectToQuoteForm(request: NextRequest) {
  const destination = new URL('/', request.nextUrl.origin);

  for (const [key, value] of request.nextUrl.searchParams) {
    if (UTM_KEY_PATTERN.test(key) || FORWARDED_QUERY_KEYS.has(key)) {
      destination.searchParams.append(key, value);
    }
  }

  destination.hash = 'dopyt';

  const response = NextResponse.redirect(destination, 307);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export function GET(request: NextRequest) {
  return redirectToQuoteForm(request);
}

export function HEAD(request: NextRequest) {
  return redirectToQuoteForm(request);
}
