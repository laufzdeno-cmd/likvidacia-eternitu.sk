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
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.blob.vercel-storage.com https://www.google.com https://www.googleadservices.com https://www.facebook.com https://bzr.openai.com",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      ["script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://bzrcdn.openai.com", isDev ? "'unsafe-eval'" : ''].filter(Boolean).join(' '),
      "connect-src 'self' https://vercel.com https://*.vercel-storage.com https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.facebook.com https://connect.facebook.net https://bzr.openai.com https://bzrcdn.openai.com",
      'upgrade-insecure-requests',
    ].join('; '),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

const noIndexHeaders = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }];
const privateActionHeaders = [
  ...noIndexHeaders,
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
];

const nextConfig = {
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: ['pdfkit', '@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/*': ['./node_modules/@sparticuz/chromium/bin/**/*'],
  },
  outputFileTracingExcludes: {
    '/*': ['./.data/**/*', './storage/**/*', './data/**/*'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  trailingSlash: true,
  async redirects() {
    return [
      { source: '/pre-strecharov/', destination: '/strechari/', permanent: true },
      { source: '/overene-informacie/', destination: '/o-firme/', permanent: true },
    ];
  },
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
      {
        source: '/ponuka/:token',
        headers: privateActionHeaders,
      },
      {
        source: '/recenzie/:token',
        headers: privateActionHeaders,
      },
    ];
  },
};

export default nextConfig;
