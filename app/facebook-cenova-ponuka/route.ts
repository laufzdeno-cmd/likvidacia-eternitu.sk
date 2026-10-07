const ATTRIBUTION_PARAMETERS = [
  ['utm_source', 160],
  ['utm_medium', 160],
  ['utm_campaign', 160],
  ['utm_content', 160],
  ['utm_term', 160],
  ['utm_id', 160],
  ['gclid', 512],
  ['fbclid', 512],
  ['gbraid', 512],
  ['wbraid', 512],
] as const;

const UNSAFE_VALUE_PATTERN = /[\r\n\u0000-\u001f\u007f]/u;

export const runtime = 'nodejs';

function quoteFormLocation(request: Request): string {
  const source = new URL(request.url);
  const forwarded = new URLSearchParams();

  for (const [parameter, maximumLength] of ATTRIBUTION_PARAMETERS) {
    const value = source.searchParams.get(parameter)?.trim();
    if (!value || value.length > maximumLength || UNSAFE_VALUE_PATTERN.test(value)) continue;
    forwarded.set(parameter, value);
  }

  const query = forwarded.toString();
  return `${query ? `/?${query}` : '/'}#dopyt`;
}

/**
 * Facebook Page CTAs do not reliably retain a URL fragment. This fixed,
 * first-party transition keeps only bounded campaign attribution and always
 * continues to the homepage quote form on the current origin.
 */
function redirectToQuoteForm(request: Request): Response {
  return new Response(null, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Location: quoteFormLocation(request),
      'Referrer-Policy': 'same-origin',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

export function GET(request: Request): Response {
  return redirectToQuoteForm(request);
}

export function HEAD(request: Request): Response {
  return redirectToQuoteForm(request);
}
