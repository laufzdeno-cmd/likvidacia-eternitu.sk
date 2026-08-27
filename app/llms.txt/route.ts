import { buildLlmsText } from '@/src/content/verified-company-facts';

export const revalidate = 86_400;

export function GET() {
  return new Response(buildLlmsText(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
