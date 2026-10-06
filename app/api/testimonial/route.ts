import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { consumeApiRateLimit, createTestimonial } from '@/src/server/db';
import { publicTestimonialConsentVersion } from '@/src/lib/testimonial-consent';
import { testimonialPublicContentHash } from '@/src/server/testimonial-policy';
import { bindPublicTestimonialConsent } from '@/src/lib/testimonial-consent';
import { createTestimonialReceiptToken, testimonialReceiptSecret } from '@/src/server/testimonial-receipt';

export const runtime = 'nodejs';

const requestWindowMs = 60_000;
const maxRequestsPerWindow = 3;

const testimonialSchema = z.object({
  submissionId: z.string().uuid('Obnovte formulár a skúste to znova.'),
  customerName: z.string().trim().min(2, 'Zadajte meno alebo iniciály.').max(120),
  customerEmail: z.string().trim().email('Zadajte platný email.').max(160).optional().or(z.literal('')),
  location: z.string().trim().max(120).optional().or(z.literal('')),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(20, 'Referencia musí mať aspoň 20 znakov.').max(1200),
  consentPublication: z.union([z.literal('on'), z.literal('true'), z.literal(true)]),
  website: z.string().trim().max(1000).optional().or(z.literal('')),
});

function clientIp(request: NextRequest) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && isIP(realIp)) return realIp;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').map((value) => value.trim()).filter(Boolean);
  const proxyIp = forwarded?.at(-1);
  return proxyIp && isIP(proxyIp) ? proxyIp : 'unknown';
}

async function rateLimited(request: NextRequest) {
  const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-dev-auth-secret-change-me');
  if (!secret) throw new Error('AUTH_SECRET is required for testimonial rate limiting.');
  const now = Date.now();
  const windowStartedAt = new Date(Math.floor(now / requestWindowMs) * requestWindowMs);
  const key = createHmac('sha256', secret).update(`testimonial-public:v1:${clientIp(request)}`).digest('hex');
  return consumeApiRateLimit(key, windowStartedAt, maxRequestsPerWindow);
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function failure(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return failure('Neplatný pôvod požiadavky.', 403);
  }

  try {
    if (await rateLimited(request)) return failure('Skúste to prosím znova o chvíľu.', 429);
  } catch {
    return failure('Formulár je momentálne nedostupný. Skúste to neskôr.', 503);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure('Referenciu sa nepodarilo spracovať.');
  }

  const parsed = testimonialSchema.safeParse({
    submissionId: formData.get('submissionId'),
    customerName: formData.get('customerName'),
    customerEmail: formData.get('customerEmail') || '',
    location: formData.get('location') || '',
    rating: formData.get('rating') || 5,
    text: formData.get('text'),
    consentPublication: formData.get('consentPublication'),
    website: formData.get('website') || '',
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message || 'Skontrolujte polia referencie.');
  }

  if (parsed.data.website) {
    return failure('Referenciu sa nepodarilo odoslať.', 400);
  }

  try {
    await createTestimonial({
      submissionId: parsed.data.submissionId,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail || '',
      location: parsed.data.location || '',
      rating: parsed.data.rating,
      text: parsed.data.text,
      status: 'draft',
      consentPublication: true,
      consentEvidence: bindPublicTestimonialConsent(testimonialPublicContentHash(parsed.data.customerName, parsed.data.rating, parsed.data.text)),
      consentCapturedAt: new Date().toISOString(),
      consentVersion: publicTestimonialConsentVersion,
      source: 'public',
    }, 'public');
  } catch (error) {
    if (error instanceof Error && error.message === 'TESTIMONIAL_IDEMPOTENCY_CONFLICT') {
      return failure('Formulár sa zmenil. Obnovte stránku a odošlite referenciu znova.', 409);
    }
    console.error('Public testimonial could not be stored.', error);
    return failure('Referenciu sa nepodarilo bezpečne uložiť. Skúste to neskôr.', 503);
  }

  if ((request.headers.get('accept') || '').includes('text/html') && !(request.headers.get('accept') || '').includes('application/json')) {
    const receipt = createTestimonialReceiptToken(testimonialReceiptSecret());
    const response = new NextResponse(null, {
      status: 303,
      headers: { Location: `/recenzie/?referencia_receipt=${encodeURIComponent(receipt)}` },
    });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }
  return NextResponse.json({
    ok: true,
    message: 'Ďakujeme. Referenciu sme prijali a zobrazí sa až po schválení.',
  });
}
