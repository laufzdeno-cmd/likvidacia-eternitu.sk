import { NextResponse, type NextRequest } from 'next/server';
import { deploymentRequestBlocked } from './src/server/preview-safety';

export function proxy(request: NextRequest) {
  if (deploymentRequestBlocked(process.env.VERCEL_ENV, process.env.NODE_ENV, request.method, request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: 'Testovacia verzia neprijíma odoslania, kým nemá oddelené úložisko.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
      },
    );
  }
  if (request.nextUrl.pathname === '/spolupraca/fotky' || request.nextUrl.pathname.startsWith('/spolupraca/fotky/')) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/spolupraca/fotky/:path*'],
};
