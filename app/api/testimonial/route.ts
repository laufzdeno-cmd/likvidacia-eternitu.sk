import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createTestimonial } from '@/src/server/db';

export const runtime = 'nodejs';

const buckets = new Map<string, { count: number; resetAt: number }>();

const testimonialSchema = z.object({
  customerName: z.string().trim().min(2, 'Zadajte meno alebo iniciály.').max(120),
  customerEmail: z.string().trim().email('Zadajte platný email.').max(160).optional().or(z.literal('')),
  location: z.string().trim().max(120).optional().or(z.literal('')),
  rating: z.coerce.number().min(1).max(5),
  text: z.string().trim().min(20, 'Referencia musí mať aspoň 20 znakov.').max(1200),
  consentPublication: z.union([z.literal('on'), z.literal('true'), z.literal(true)]),
  website: z.string().trim().max(1000).optional().or(z.literal('')),
});

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function rateLimited(ip: string) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 3;
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

  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return failure('Skúste to prosím znova o chvíľu.', 429);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure('Referenciu sa nepodarilo spracovať.');
  }

  const parsed = testimonialSchema.safeParse({
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

  await createTestimonial(
    {
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail || '',
      location: parsed.data.location || '',
      rating: parsed.data.rating,
      text: parsed.data.text,
      status: 'draft',
      consentPublication: true,
      source: 'public',
    },
    'public',
  );

  return NextResponse.json({
    ok: true,
    message: 'Ďakujeme. Referenciu sme prijali a zobrazí sa až po schválení.',
  });
}
