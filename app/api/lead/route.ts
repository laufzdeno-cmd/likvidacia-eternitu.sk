import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog, addLeadFiles, createLead } from '@/src/server/db';
import { sendLeadEmails } from '@/src/server/mail';
import { storeLeadFile } from '@/src/server/storage';
import { allowedFileTypes, leadSchema, maxLeadFileSize, maxLeadFiles } from '@/src/server/validation';

export const runtime = 'nodejs';

const buckets = new Map<string, { count: number; resetAt: number }>();

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
  return bucket.count > 5;
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function wantsHtml(request: NextRequest) {
  return request.headers.get('accept')?.includes('text/html') && !request.headers.get('accept')?.includes('application/json');
}

function failure(request: NextRequest, message: string, status = 400) {
  if (wantsHtml(request)) {
    return NextResponse.redirect(new URL(`/?chyba=${encodeURIComponent(message)}#dopyt`, request.url), { status: 303 });
  }
  return NextResponse.json({ ok: false, message }, { status });
}

function success(request: NextRequest, message: string) {
  if (wantsHtml(request)) {
    return NextResponse.redirect(new URL('/?odoslane=1#dopyt', request.url), { status: 303 });
  }
  return NextResponse.json({ ok: true, message });
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return failure(request, 'Neplatný pôvod požiadavky.', 403);
  }

  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return failure(request, 'Skúste to prosím znova o chvíľu.', 429);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure(request, 'Formulár sa nepodarilo spracovať.');
  }

  const parsed = leadSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    city: formData.get('city'),
    district: formData.get('district'),
    objectType: formData.get('objectType'),
    materialType: formData.get('materialType'),
    areaEstimate: formData.get('areaEstimate') || formData.get('area'),
    roofer: formData.get('roofer'),
    term: formData.get('term'),
    note: formData.get('note'),
    gdpr: formData.get('gdpr'),
    companyWebsite: formData.get('companyWebsite'),
  });

  if (!parsed.success) {
    return failure(request, parsed.error.issues[0]?.message || 'Skontrolujte povinné polia.');
  }

  if (parsed.data.companyWebsite) {
    return failure(request, 'Dopyt sa nepodarilo odoslať.', 400);
  }

  const uploadedFiles = formData
    .getAll('photos')
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (uploadedFiles.length > maxLeadFiles) {
    return failure(request, `Nahrať môžete maximálne ${maxLeadFiles} súborov.`);
  }

  for (const file of uploadedFiles) {
    if (!allowedFileTypes.has(file.type)) {
      return failure(request, 'Povolené sú iba JPG, PNG, WEBP, HEIC alebo PDF súbory.');
    }
    if (file.size > maxLeadFileSize) {
      return failure(request, 'Jeden súbor môže mať maximálne 10 MB.');
    }
  }

  try {
    const lead = await createLead({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      city: parsed.data.city,
      district: parsed.data.district || '',
      objectType: parsed.data.objectType,
      materialType: parsed.data.materialType,
      areaEstimate: parsed.data.areaEstimate,
      roofer: parsed.data.roofer || '',
      term: parsed.data.term || '',
      note: parsed.data.note || '',
      gdpr: true,
      source: 'web',
      rawData: { userAgent: request.headers.get('user-agent') || undefined },
    });

    const stored = [];
    for (const file of uploadedFiles) {
      stored.push(await storeLeadFile(lead.id, file));
    }
    const fileRows = await addLeadFiles(stored);
    await addAuditLog('lead', lead.id, 'files_uploaded', 'system', { count: fileRows.length });

    const mailResult = await sendLeadEmails(lead, fileRows.length);
    await addAuditLog('lead', lead.id, mailResult.sent ? 'lead_email_sent' : 'lead_email_skipped', 'system', mailResult);

    return success(request, 'Dopyt sme prijali. Uložili sme ho do systému a ozveme sa vám s ďalším postupom.');
  } catch (error) {
    console.error('Lead submit failed', error);
    return failure(request, 'Dopyt sa nepodarilo uložiť. Skúste to prosím znova alebo zavolajte.', 500);
  }
}
