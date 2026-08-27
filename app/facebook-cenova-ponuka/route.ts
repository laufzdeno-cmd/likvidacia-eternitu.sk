import type { NextRequest } from 'next/server';

const FORWARDED_QUERY_KEYS = new Set(['fbclid']);
const UTM_KEY_PATTERN = /^utm_[a-z0-9_]{1,64}$/i;

export const runtime = 'nodejs';

/**
 * Meta Page CTAs reject URL fragments in their saved destination. This fixed,
 * first-party transition route preserves attribution parameters and forwards
 * visitors to the only allowed target: the homepage quote form.
 */
function redirectToQuoteForm(request: NextRequest) {
  const source = new URL(request.url);
  const destination = new URL('/', source);

  for (const [key, value] of source.searchParams) {
    if (UTM_KEY_PATTERN.test(key) || FORWARDED_QUERY_KEYS.has(key)) {
      destination.searchParams.append(key, value);
    }
  }

  destination.hash = 'dopyt';

  return new Response(null, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Location: destination.toString(),
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

export function GET(request: NextRequest) {
  return redirectToQuoteForm(request);
}

export function HEAD(request: NextRequest) {
  return redirectToQuoteForm(request);
}
