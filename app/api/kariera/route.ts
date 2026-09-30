import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addAuditLog, attachCareerApplicationCv, createCareerApplication } from '@/src/server/db';
import { validateCareerCvFile } from '@/src/server/file-validation';
import { sendCareerApplicationEmails } from '@/src/server/mail';
import { storeCareerApplicationCv } from '@/src/server/storage';

export const runtime = 'nodejs';

const buckets = new Map<string, { count: number; resetAt: number }>();
const applicationSchema = z.object({
  submissionId: z.string().trim().min(16).max(120).regex(/^[a-zA-Z0-9_-]+$/),
  fullName: z.string().trim().min(2, 'Uveďte meno a priezvisko.').max(120),
  phone: z.string().trim().min(6, 'Uveďte telefónne číslo.').max(40),
  email: z.string().trim().email('Uveďte platný email.').max(160),
  city: z.string().trim().min(2, 'Uveďte mesto alebo okres.').max(120),
  cooperationType: z.enum(['szco', 'crew', 'other'], { error: 'Vyberte formu spolupráce.' }),
  workRegions: z.string().trim().min(2, 'Uveďte, kde viete pracovať.').max(240),
  hasTradeLicense: z.literal('on', { error: 'Potvrďte, že môžete pracovať ako živnostník alebo partia.' }),
  workAtHeights: z.literal('on', { error: 'Potvrďte skúsenosť s prácou vo výške.' }),
  hasAsbestosExperience: z.enum(['yes', 'no'], { error: 'Uveďte, či máte skúsenosť s azbestom.' }),
  asbestosExperience: z.string().trim().max(1500, 'Opis skúsenosti s azbestom je príliš dlhý.').optional().default(''),
  experience: z.string().trim().max(1500, 'Skúsenosť je príliš dlhá.').optional().default(''),
  note: z.string().trim().max(1500, 'Poznámka je príliš dlhá.').optional().default(''),
  gdpr: z.literal('on', { error: 'Potvrďte súhlas so spracovaním údajov.' }),
  companyWebsite: z.string().trim().max(240).optional().default(''),
});

function response(message: string, status = 400) {
  return NextResponse.json({ ok: status < 400, message }, { status });
}

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function rateLimited(ip: string) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 10;
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk')
    .split(',').map((item) => item.trim()).filter(Boolean);
  return allowed.includes(origin);
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return response('Neplatný pôvod požiadavky.', 403);
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return response('Formulár sa nepodarilo spracovať.');
  }
  const parsed = applicationSchema.safeParse({
    submissionId: formData.get('submissionId'), fullName: formData.get('fullName'), phone: formData.get('phone'),
    email: formData.get('email'), city: formData.get('city'), cooperationType: formData.get('cooperationType'),
    workRegions: formData.get('workRegions'), hasTradeLicense: formData.get('hasTradeLicense'), workAtHeights: formData.get('workAtHeights'),
    hasAsbestosExperience: formData.get('hasAsbestosExperience'), asbestosExperience: formData.get('asbestosExperience') || '',
    experience: formData.get('experience') || '', note: formData.get('note') || '', gdpr: formData.get('gdpr'),
    companyWebsite: formData.get('companyWebsite') || '',
  });
  if (!parsed.success) return response(parsed.error.issues[0]?.message || 'Skontrolujte povinné polia.');
  if (parsed.data.hasAsbestosExperience === 'yes' && !parsed.data.asbestosExperience) {
    return response('Stručne napíšte, s čím máte skúsenosť pri azbeste.');
  }
  if (parsed.data.companyWebsite) return response('Žiadosť sa nepodarilo odoslať.');
  if (rateLimited(clientIp(request))) return response('Formulár bol odoslaný viackrát za sebou. Skúste to o pár minút alebo zavolajte 0905 217 946.', 429);

  const cv = formData.get('cv');
  if (cv instanceof File && cv.size > 0) {
    const cvError = await validateCareerCvFile(cv);
    if (cvError) return response(cvError);
  }

  try {
    const saved = await createCareerApplication({
      submissionId: parsed.data.submissionId, fullName: parsed.data.fullName, phone: parsed.data.phone, email: parsed.data.email,
      city: parsed.data.city, cooperationType: parsed.data.cooperationType, workRegions: parsed.data.workRegions,
      hasTradeLicense: true, workAtHeights: true, hasAsbestosExperience: parsed.data.hasAsbestosExperience === 'yes',
      asbestosExperience: parsed.data.asbestosExperience, experience: parsed.data.experience, note: parsed.data.note, privacyConsent: true,
    });
    if (saved.duplicate) return NextResponse.json({ ok: true, message: 'Vašu žiadosť už evidujeme. Ďakujeme.' });

    let application = saved.application;
    if (cv instanceof File && cv.size > 0) {
      const stored = await storeCareerApplicationCv(application.id, cv);
      const withCv = await attachCareerApplicationCv(application.id, stored);
      if (!withCv) throw new Error('Životopis sa nepodarilo pripojiť k žiadosti.');
      application = withCv;
    }

    const mailResult = await sendCareerApplicationEmails(application);
    await addAuditLog('career_application', application.id, mailResult.sent ? 'career_application_email_sent' : 'career_application_email_error', 'system', mailResult);
    if (!mailResult.customerSent || !mailResult.adminSent) {
      console.error('Career application relay delivery failed', { applicationId: application.id, reason: mailResult.reason || 'unknown' });
      return response('Žiadosť sme bezpečne uložili, ale potvrdenie sa momentálne nepodarilo odoslať. Zavolajte nám prosím na 0905 217 946.', 503);
    }
    return NextResponse.json({ ok: true, message: 'Ďakujeme. Žiadosť sme prijali a čo najskôr sa vám ozveme.' });
  } catch (error) {
    console.error('Career application failed', error);
    return response('Žiadosť sa nepodarilo uložiť. Skúste to prosím znova alebo zavolajte 0905 217 946.', 500);
  }
}
