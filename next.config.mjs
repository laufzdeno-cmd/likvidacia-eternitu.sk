/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.blob.vercel-storage.com https://www.googletagmanager.com https://googleads.g.doubleclick.net https://www.google.com https://google.com https://www.google.sk https://pagead2.googlesyndication.com https://www.googleadservices.com",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      ["script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.googleadservices.com https://www.google.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net", isDev ? "'unsafe-eval'" : ''].filter(Boolean).join(' '),
      "connect-src 'self' https://*.vercel-storage.com https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://ad.doubleclick.net https://www.google.com https://google.com https://www.google.sk",
      "frame-src 'self' https://www.googletagmanager.com",
      'upgrade-insecure-requests',
    ].join('; '),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

const noIndexHeaders = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }];

const nextConfig = {
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: ['pdfkit', '@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/*': ['./node_modules/@sparticuz/chromium/bin/**/*'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  trailingSlash: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/admin/:path*',
        headers: noIndexHeaders,
      },
      {
        source: '/api/:path*',
        headers: noIndexHeaders,
      },
    ];
  },
};

export default nextConfig;
