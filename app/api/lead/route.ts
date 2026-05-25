import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog, addLeadFiles, createBusinessJobFromLead, createLead } from '@/src/server/db';
import { validateUploadedLeadFile } from '@/src/server/file-validation';
import { sendLeadEmails } from '@/src/server/mail';
import { storeLeadFile } from '@/src/server/storage';
import { leadSchema, maxLeadFiles } from '@/src/server/validation';

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
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk,http://localhost:3000,http://localhost:5173')
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
    district: formData.get('district') || '',
    objectType: formData.get('objectType'),
    materialType: formData.get('materialType'),
    areaEstimate: formData.get('areaEstimate') || formData.get('area'),
    preferredContact: formData.get('preferredContact') || 'Zavolajte mi',
    roofer: formData.get('roofer') || '',
    selectedRooferId: formData.get('selectedRooferId') || '',
    term: formData.get('term') || '',
    note: formData.get('note') || '',
    gdpr: formData.get('gdpr'),
    companyWebsite: formData.get('companyWebsite') || '',
  });

  if (!parsed.success) {
    return failure(request, parsed.error.issues[0]?.message || 'Skontrolujte povinné polia.');
  }

  const uploadedFiles = formData
    .getAll('photos')
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (uploadedFiles.length > maxLeadFiles) {
    return failure(request, `Nahrať môžete maximálne ${maxLeadFiles} súborov.`);
  }

  for (const file of uploadedFiles) {
    const fileError = await validateUploadedLeadFile(file);
    if (fileError) return failure(request, fileError);
  }

  try {
    const rooferValue = parsed.data.roofer || '';
    const wantsRooferRecommendation = rooferValue === 'Chcem odporučiť strechára podľa regiónu';
    const selectedRooferId = parsed.data.selectedRooferId || '';
    const lead = await createLead({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      city: parsed.data.city,
      district: parsed.data.district || '',
      objectType: parsed.data.objectType,
      materialType: parsed.data.materialType,
      areaEstimate: parsed.data.areaEstimate,
      preferredContact: parsed.data.preferredContact || 'Zavolajte mi',
      roofer: rooferValue,
      term: parsed.data.term || '',
      note: parsed.data.note || '',
      gdpr: true,
      source: 'web',
      wantsRooferRecommendation,
      selectedRooferId,
      rawData: { userAgent: request.headers.get('user-agent') || undefined, wantsRooferRecommendation, selectedRooferId },
    });

    const businessJob = await createBusinessJobFromLead(lead);

    const stored = [];
    for (const file of uploadedFiles) {
      stored.push(await storeLeadFile(lead.id, file));
    }
    const fileRows = await addLeadFiles(stored);
    await addAuditLog('lead', lead.id, 'files_uploaded', 'system', { count: fileRows.length });

    let mailResult: Record<string, unknown>;
    try {
      mailResult = await sendLeadEmails(lead, fileRows.length, businessJob.id);
    } catch (error) {
      mailResult = {
        sent: false,
        reason: error instanceof Error ? error.message : 'Email sa nepodarilo odoslať.',
      };
    }
    await addAuditLog('lead', lead.id, mailResult.sent ? 'lead_email_sent' : 'lead_email_error', 'system', mailResult);

    if (mailResult.sent !== true) {
      return failure(
        request,
        'Dopyt sme uložili, ale emailové potvrdenie sa nepodarilo odoslať. Zavolajte nám prosím na 0905 217 946 alebo skúste odoslanie neskôr.',
        502,
      );
    }

    return success(request, 'Ďakujeme! Dopyt sme prijali.');
  } catch (error) {
    console.error('Lead submit failed', error);
    return failure(request, 'Dopyt sa nepodarilo uložiť. Skúste to prosím znova alebo zavolajte.', 500);
  }
}
