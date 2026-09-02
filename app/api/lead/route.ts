import { after, NextRequest, NextResponse } from 'next/server';
import { addAuditLog, addLeadFiles, createLeadWithMetaCapiOutbox } from '@/src/server/db';
import { validateUploadedLeadFile } from '@/src/server/file-validation';
import { sendLeadEmails } from '@/src/server/mail';
import { dispatchMetaCapiOutbox, isMetaCapiConfigured, metaMaterialFromLeadValue } from '@/src/server/meta-conversions-api';
import { storeLeadFile } from '@/src/server/storage';
import { leadSchema, maxLeadFiles } from '@/src/server/validation';
import { marketingConsentCookieName, marketingConsentSubjectCookieName } from '@/src/lib/marketing-consent';
import { site } from '@/src/content/site';
import { leadAreaUnknownCode } from '@/src/server/lead-area';

export const runtime = 'nodejs';

const buckets = new Map<string, { count: number; resetAt: number }>();
const rateLimitWindowMs = 10 * 60_000;
const maxSubmissionsPerWindow = 30;

type MetaLeadResponse = {
  eventId: string;
  material: ReturnType<typeof metaMaterialFromLeadValue>;
};

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function hasMetaMarketingConsent(request: NextRequest) {
  return request.cookies.get(marketingConsentCookieName)?.value === 'granted';
}

function metaMarketingConsentSubject(request: NextRequest) {
  const value = request.cookies.get(marketingConsentSubjectCookieName)?.value || '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : '';
}

function submissionId(value: FormDataEntryValue | null) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw) ? raw : null;
}

function rateLimited(ip: string) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > maxSubmissionsPerWindow;
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

function wantsHtml(request: NextRequest) {
  return request.headers.get('accept')?.includes('text/html') && !request.headers.get('accept')?.includes('application/json');
}

function failure(request: NextRequest, message: string, status = 400) {
  if (wantsHtml(request)) {
    return NextResponse.redirect(new URL(`/?chyba=${encodeURIComponent(message)}#dopyt`, request.url), { status: 303 });
  }
  return NextResponse.json({ ok: false, message }, { status });
}

function success(request: NextRequest, message: string, metaLead?: MetaLeadResponse) {
  if (wantsHtml(request)) {
    const url = new URL('/?odoslane=1#dopyt', request.url);
    if (metaLead) {
      url.searchParams.set('meta_lead', metaLead.eventId);
      url.searchParams.set('meta_material', metaLead.material);
    }
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ ok: true, message, metaLead });
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return failure(request, 'Neplatný pôvod požiadavky.', 403);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure(request, 'Formulár sa nepodarilo spracovať.');
  }

  const validatedSubmissionId = submissionId(formData.get('submissionId'));
  if (!validatedSubmissionId) {
    return failure(request, 'Formulár sa nepodarilo bezpečne identifikovať. Obnovte stránku a skúste ho odoslať znova.');
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
    areaEstimateStatus: formData.get('areaEstimateStatus') || 'known',
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

  if (parsed.data.companyWebsite) {
    return failure(request, 'Dopyt sa nepodarilo odoslať.', 400);
  }

  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return failure(request, 'Formulár bol odoslaný viackrát za sebou. Skúste to prosím o pár minút alebo zavolajte 0905 217 946.', 429);
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
    const areaUnknown = parsed.data.areaEstimateStatus === leadAreaUnknownCode;
    const areaEstimate = areaUnknown ? 0 : parsed.data.areaEstimate;
    if (areaEstimate === undefined) return failure(request, 'Zadajte približnú výmeru.');
    const wantsRooferRecommendation = rooferValue === 'Chcem odporučiť strechára podľa regiónu';
    const selectedRooferId = parsed.data.selectedRooferId || '';
    const metaConsentSubject = metaMarketingConsentSubject(request);
    const marketingConsentGranted = hasMetaMarketingConsent(request) && Boolean(metaConsentSubject) && isMetaCapiConfigured();
    const metaMaterial = metaMaterialFromLeadValue(parsed.data.materialType);
    const savedLead = await createLeadWithMetaCapiOutbox({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      city: parsed.data.city,
      district: parsed.data.district || '',
      objectType: parsed.data.objectType,
      materialType: parsed.data.materialType,
      areaEstimate,
      preferredContact: parsed.data.preferredContact || 'Zavolajte mi',
      roofer: rooferValue,
      term: parsed.data.term || '',
      note: parsed.data.note || '',
      gdpr: true,
      source: 'web',
      wantsRooferRecommendation,
      selectedRooferId,
      rawData: {
        userAgent: request.headers.get('user-agent') || undefined,
        wantsRooferRecommendation,
        selectedRooferId,
        areaEstimateStatus: areaUnknown ? leadAreaUnknownCode : 'known',
      },
    }, validatedSubmissionId, marketingConsentGranted ? {
      consentSubject: metaConsentSubject,
      material: metaMaterial,
      eventSourceUrl: `${site.website}/#dopyt`,
      clientIp: ip,
      clientUserAgent: request.headers.get('user-agent') || undefined,
      fbp: request.cookies.get('_fbp')?.value,
      fbc: request.cookies.get('_fbc')?.value,
    } : undefined);
    const lead = savedLead.lead;
    const businessJob = savedLead.businessJob;

    const metaLead: MetaLeadResponse = {
      eventId: lead.id,
      material: metaMaterial,
    };

    if (savedLead.outboxQueued) {
      after(async () => {
        await dispatchMetaCapiOutbox({ limit: 1 }).catch(() => undefined);
      });
    }

    const stored = [];
    if (savedLead.created) {
      for (const file of uploadedFiles) {
        stored.push(await storeLeadFile(lead.id, file));
      }
    }
    const fileRows = await addLeadFiles(stored);
    if (savedLead.created) await addAuditLog('lead', lead.id, 'files_uploaded', 'system', { count: fileRows.length });

    let mailResult: Record<string, unknown>;
    try {
      mailResult = savedLead.created && businessJob
        ? await sendLeadEmails(lead, fileRows.length, businessJob.id)
        : { sent: true, duplicate: true };
    } catch (error) {
      mailResult = {
        sent: false,
        reason: error instanceof Error ? error.message : 'Email sa nepodarilo odoslať.',
      };
    }
    await addAuditLog('lead', lead.id, mailResult.sent ? 'lead_email_sent' : 'lead_email_error', 'system', mailResult);

    return success(request, 'Ďakujeme! Dopyt sme prijali.', marketingConsentGranted ? metaLead : undefined);
  } catch (error) {
    console.error('Lead submit failed', error);
    return failure(request, 'Dopyt sa nepodarilo uložiť. Skúste to prosím znova alebo zavolajte.', 500);
  }
}
