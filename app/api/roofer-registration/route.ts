import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRooferRegistration } from '@/src/server/db';
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
] as const;

const allowedSpecializations = [
  'Betónová krytina',
  'Pálená škridla',
  'Plechová krytina',
  'Plochá / rovná strecha',
  'Iné',
] as const;

const businessTypes = ['sro', 'szco', 'other'] as const;
const roofTrussOptions = ['yes', 'no', 'by_scope'] as const;

const optionalWebsite = z.string().trim().max(240, 'Webová stránka je príliš dlhá.').refine(
  (value) => !value || /^https?:\/\/[^\s]+$/i.test(value),
  'Webová stránka musí začínať na https:// alebo http://.',
);

const registrationSchema = z.object({
  submissionId: z.string().trim().min(16).max(120).regex(/^[a-zA-Z0-9_-]+$/),
  businessType: z.enum(businessTypes, { error: 'Vyberte formu podnikania.' }),
  companyName: z.string().trim().min(2, 'Uveďte názov firmy alebo obchodné meno.').max(160),
  companyId: z.string().trim().max(30, 'IČO je príliš dlhé.').optional().default(''),
  contactPerson: z.string().trim().min(2, 'Uveďte meno človeka, s ktorým budeme komunikovať.').max(120),
  phone: z.string().trim().min(6, 'Uveďte telefónne číslo.').max(40),
  email: z.string().trim().email('Uveďte platný email.').max(160),
  website: optionalWebsite.optional().default(''),
  serviceRegions: z.array(z.enum(allowedRegions)).min(1, 'Vyberte aspoň jeden kraj.'),
  specializations: z.array(z.enum(allowedSpecializations)).min(1, 'Vyberte aspoň jednu špecializáciu.'),
  otherSpecialization: z.string().trim().max(180, 'Doplnenie špecializácie je príliš dlhé.').optional().default(''),
  canBuildRoofTruss: z.enum(roofTrussOptions, { error: 'Vyberte, či realizujete aj nový krov.' }),
  acceptCustomerReferrals: z.boolean(),
  consentPublicProfile: z.boolean(),
  privacyConsent: z.literal(true, { error: 'Potvrďte súhlas so spracovaním údajov.' }),
  note: z.string().trim().max(1500, 'Poznámka je príliš dlhá.').optional().default(''),
});

const legacyRegistrationSchema = z.object({
  submissionId: z.string().trim().min(16).max(120).regex(/^[a-zA-Z0-9_-]+$/),
  fullName: z.string().trim().min(2, 'Uveďte meno a priezvisko.').max(120),
  companyName: z.string().trim().max(160).optional().default(''),
  phone: z.string().trim().min(6, 'Uveďte telefónne číslo.').max(40),
  email: z.string().trim().email('Uveďte platný email.').max(160),
  regions: z.array(z.enum(allowedRegions)).min(1, 'Vyberte aspoň jeden región.'),
  jobTypes: z.array(z.string().trim().max(120)).default([]),
  message: z.string().trim().max(1500).optional().default(''),
  gdpr: z.literal('on', { error: 'Potvrďte súhlas so spracovaním údajov.' }),
});

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) return true;

  // Keep local form testing possible without allowing loopback origins in production.
  if (process.env.NODE_ENV !== 'production') {
    try {
      const parsed = new URL(origin);
      const isLoopback = parsed.protocol === 'http:' &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
      if (isLoopback) return true;
    } catch {
      return false;
    }
  }

  return false;
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value : '';
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === 'on' || formData.get(name) === 'true';
}

function submissionIdValue(formData: FormData) {
  const value = stringValue(formData.get('submissionId')).trim();
  return /^[a-zA-Z0-9_-]{16,120}$/.test(value) ? value : randomUUID();
}

function normalizeRegions(regions: readonly string[]): Array<(typeof allowedRegions)[number]> {
  const unique = [...new Set(regions)].filter((region): region is (typeof allowedRegions)[number] =>
    (allowedRegions as readonly string[]).includes(region),
  );
  return unique.includes('Celé Slovensko') ? ['Celé Slovensko'] : unique;
}

function legacySpecializations(jobTypes: string[]) {
  const known = jobTypes.filter((value): value is (typeof allowedSpecializations)[number] =>
    (allowedSpecializations as readonly string[]).includes(value),
  );
  if (known.length) return { specializations: [...new Set(known)], otherSpecialization: '' };
  return { specializations: ['Iné' as const], otherSpecialization: jobTypes.join(', ').slice(0, 180) };
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return fail('Neplatný pôvod požiadavky.', 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail('Formulár sa nepodarilo spracovať.');
  }

  if (stringValue(formData.get('companyWebsite')).trim()) {
    return fail('Registráciu sa nepodarilo odoslať.');
  }

  const submissionId = submissionIdValue(formData);
  const hasNewFields = formData.has('businessType') || formData.has('serviceRegions[]') || formData.has('specializations[]');
  let registration: z.infer<typeof registrationSchema>;

  if (hasNewFields) {
    const parsed = registrationSchema.safeParse({
      submissionId,
      businessType: stringValue(formData.get('businessType')),
      companyName: stringValue(formData.get('companyName')),
      companyId: stringValue(formData.get('companyId')),
      contactPerson: stringValue(formData.get('contactPerson')),
      phone: stringValue(formData.get('phone')),
      email: stringValue(formData.get('email')),
      website: stringValue(formData.get('website')),
      serviceRegions: formData.getAll('serviceRegions[]').map(String),
      specializations: formData.getAll('specializations[]').map(String),
      otherSpecialization: stringValue(formData.get('otherSpecialization')),
      canBuildRoofTruss: stringValue(formData.get('canBuildRoofTruss')),
      acceptCustomerReferrals: checked(formData, 'acceptCustomerReferrals'),
      consentPublicProfile: checked(formData, 'consentPublicProfile'),
      privacyConsent: checked(formData, 'privacyConsent'),
      note: stringValue(formData.get('note')),
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Skontrolujte povinné polia.');
    registration = { ...parsed.data, serviceRegions: normalizeRegions(parsed.data.serviceRegions) };
  } else {
    const parsed = legacyRegistrationSchema.safeParse({
      submissionId,
      fullName: stringValue(formData.get('fullName')),
      companyName: stringValue(formData.get('companyName')),
      phone: stringValue(formData.get('phone')),
      email: stringValue(formData.get('email')),
      regions: formData.getAll('regions').map(String),
      jobTypes: formData.getAll('jobTypes').map(String),
      message: stringValue(formData.get('message')),
      gdpr: formData.get('gdpr'),
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Skontrolujte povinné polia.');
    const specialization = legacySpecializations(parsed.data.jobTypes);
    registration = {
      submissionId: parsed.data.submissionId,
      businessType: 'other',
      companyName: parsed.data.companyName || parsed.data.fullName,
      companyId: '',
      contactPerson: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      website: '',
      serviceRegions: normalizeRegions(parsed.data.regions),
      specializations: specialization.specializations,
      otherSpecialization: specialization.otherSpecialization,
      canBuildRoofTruss: 'by_scope',
      acceptCustomerReferrals: false,
      consentPublicProfile: false,
      privacyConsent: true,
      note: parsed.data.message,
    };
  }

  try {
    const saved = await createRooferRegistration(registration);
    if (!saved.duplicate) {
      try {
        const emailResult = await sendRooferRegistrationEmail({ ...registration, id: saved.registration.id });
        if (!emailResult.sent) console.warn('Roofer registration email was not sent:', emailResult.reason);
      } catch (error) {
        console.error('Roofer registration email failed after database save', error);
      }
    }

    return NextResponse.json({
      ok: true,
      message: saved.duplicate
        ? 'Táto registrácia už bola prijatá. Ďakujeme.'
        : 'Ďakujeme! Registráciu sme prijali a najprv si ju interne skontrolujeme.',
    });
  } catch (error) {
    console.error('Roofer registration failed', error);
    return fail('Registráciu sa nepodarilo uložiť. Skúste to prosím znova alebo zavolajte.', 500);
  }
}
