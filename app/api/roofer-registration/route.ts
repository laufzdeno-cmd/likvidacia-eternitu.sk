import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendRooferRegistrationEmail } from '@/src/server/mail';

export const runtime = 'nodejs';

const allowedRegions = [
  'Bratislavský kraj',
  'Trnavský kraj',
  'Trenčiansky kraj',
  'Nitriansky kraj',
  'Žilinský kraj',
  'Banskobystrický kraj',
  'Prešovský kraj',
  'Košický kraj',
  'Celé Slovensko',
];

const allowedJobTypes = ['Šikmé strechy', 'Ploché strechy', 'Priemyselné objekty', 'Hospodárske budovy'];

const registrationSchema = z.object({
  fullName: z.string().trim().min(2, 'Uveďte meno a priezvisko.').max(120),
  companyName: z.string().trim().max(160).optional(),
  phone: z.string().trim().min(6, 'Uveďte telefónne číslo.').max(40),
  email: z.string().trim().email('Uveďte platný email.').max(160),
  regions: z.array(z.enum(allowedRegions as [string, ...string[]])).min(1, 'Vyberte aspoň jeden región.'),
  jobTypes: z.array(z.enum(allowedJobTypes as [string, ...string[]])).default([]),
  message: z.string().trim().max(1200).optional(),
  gdpr: z.literal('on', { error: 'Potvrďte súhlas so spracovaním údajov.' }),
  companyWebsite: z.string().trim().max(200).optional(),
});

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk,http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return fail('Neplatný pôvod požiadavky.', 403);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail('Formulár sa nepodarilo spracovať.');
  }

  const parsed = registrationSchema.safeParse({
    fullName: formData.get('fullName'),
    companyName: formData.get('companyName') || '',
    phone: formData.get('phone'),
    email: formData.get('email'),
    regions: formData.getAll('regions'),
    jobTypes: formData.getAll('jobTypes'),
    message: formData.get('message') || '',
    gdpr: formData.get('gdpr'),
    companyWebsite: formData.get('companyWebsite') || '',
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || 'Skontrolujte povinné polia.');
  }

  if (parsed.data.companyWebsite) {
    return fail('Registráciu sa nepodarilo odoslať.', 400);
  }

  try {
    await sendRooferRegistrationEmail({
      fullName: parsed.data.fullName,
      companyName: parsed.data.companyName || undefined,
      phone: parsed.data.phone,
      email: parsed.data.email,
      regions: parsed.data.regions,
      jobTypes: parsed.data.jobTypes,
      message: parsed.data.message || undefined,
    });

    return NextResponse.json({
      ok: true,
      message: 'Ďakujeme! Vaša registrácia bola prijatá.\nOzveme sa vám do 48 hodín na zadané telefónne číslo.',
    });
  } catch (error) {
    console.error('Roofer registration failed', error);
    return fail('Registráciu sa nepodarilo odoslať. Skúste to prosím znova alebo zavolajte.', 500);
  }
}
