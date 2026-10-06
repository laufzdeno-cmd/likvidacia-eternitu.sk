import { NextRequest, NextResponse } from 'next/server';
import { leadReceiptSecret, verifyLeadReceiptToken } from '@/src/server/lead-receipt';
import { limitValidLeadReceipt } from '@/src/server/lead-receipt-rate-limit';
import { consumeSharedRateLimit, trustedRateLimitClientIp } from '@/src/server/shared-rate-limit';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Content-Type': 'text/html; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

function document(title: string, message: string, accepted: boolean) {
  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} | ASTANA</title>
  <style>
    :root{color-scheme:light;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}
    body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:#f5f7fa;color:#17253f}
    main{width:min(100%,580px);padding:clamp(24px,5vw,48px);background:#fff;border:1px solid #dce5ec;border-radius:20px;box-shadow:0 18px 48px #17253f14}
    .brand{margin:0 0 28px;color:#bf3d2b;font-weight:800;letter-spacing:.1em}
    .mark{display:grid;place-items:center;width:54px;height:54px;border-radius:50%;background:${accepted ? '#e9f6ec' : '#fff2ed'};color:${accepted ? '#327341' : '#ae4935'};font-size:30px;font-weight:700}
    h1{font-size:clamp(1.7rem,5vw,2.25rem);line-height:1.2;margin:20px 0 14px}
    p{font-size:1rem;line-height:1.65;margin:0 0 16px}
    .note{padding:16px 18px;border-radius:12px;background:#f1f7f9}
    a{color:#a83224;font-weight:700;text-underline-offset:3px}
    a:focus-visible{outline:3px solid #17253f;outline-offset:4px}
    .links{display:flex;gap:20px;flex-wrap:wrap;margin-top:28px}
  </style>
</head>
<body>
  <main>
    <p class="brand">ASTANA</p>
    <div class="mark" aria-hidden="true">${accepted ? '✓' : '!'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${accepted
      ? '<p class="note">Nezáväznú cenovú ponuku vám pošleme čo najskôr, najneskôr do 24 hodín.</p>'
      : '<p class="note">Ak ste formulár práve odoslali, neposielajte ho hneď znova. Zavolajte nám a výsledok overíme.</p>'}
    <div class="links"><a href="/">Späť na hlavnú stránku</a><a href="tel:+421905217946">Zavolať 0905 217 946</a></div>
  </main>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('dopyt_receipt') || '';
  const receipt = verifyLeadReceiptToken(token, leadReceiptSecret());
  if (!receipt) {
    try {
      if (await consumeSharedRateLimit('lead-receipt-status', trustedRateLimitClientIp(request.headers), 60, 60_000)) {
        return new NextResponse(document('Príliš veľa kontrol', 'Počkajte chvíľu a skúste potvrdenie otvoriť znova.', false), {
          status: 429,
          headers: responseHeaders,
        });
      }
    } catch {
      return new NextResponse(document('Potvrdenie je dočasne nedostupné', 'Výsledok teraz nevieme bezpečne overiť. Ak ste formulár odoslali, neposielajte ho hneď znova.', false), {
        status: 503,
        headers: responseHeaders,
      });
    }
    return new NextResponse(document('Potvrdenie sa nepodarilo overiť', 'Výsledok odoslania zatiaľ nevieme bezpečne potvrdiť.', false), {
      status: 404,
      headers: responseHeaders,
    });
  }
  if (await limitValidLeadReceipt(token)) {
    return new NextResponse(document('Príliš veľa kontrol', 'Počkajte chvíľu a skúste potvrdenie otvoriť znova.', false), {
      status: 429,
      headers: responseHeaders,
    });
  }
  const message = receipt.emailSent
    ? 'Váš dopyt sme bezpečne prijali a potvrdenie odoslali na zadaný email.'
    : 'Váš dopyt sme bezpečne prijali. Potvrdenie emailom ešte overujeme; formulár nemusíte posielať znova.';
  return new NextResponse(document('Dopyt sme prijali', message, true), { headers: responseHeaders });
}
