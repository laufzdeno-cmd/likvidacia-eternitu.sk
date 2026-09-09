import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog, addLeadFiles, createBusinessJobFromLead, createLead, ensureLeadGoogleAdsOrderId, findLeadBySubmissionId } from '@/src/server/db';
import { validateUploadedLeadFile } from '@/src/server/file-validation';
import { sendLeadEmails } from '@/src/server/mail';
import { storeLeadFile } from '@/src/server/storage';
import { leadSchema, maxLeadFiles } from '@/src/server/validation';
import { hasVerifiedMarketingConsent, marketingConsentCookieName } from '@/src/server/marketing-consent';
import { isControlledQaLead, measurementEligibility, type LeadMeasurementEligibility } from '@/src/server/lead-measurement-eligibility';

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
  try {
    const originUrl = new URL(origin);
    const requestHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (requestHost && originUrl.host === requestHost) return true;
  } catch {
    return false;
  }
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

function success(request: NextRequest, message: string, leadId: string, orderId: string, eligibility: LeadMeasurementEligibility) {
  if (wantsHtml(request)) {
    return NextResponse.redirect(new URL('/?odoslane=1#dopyt', request.url), { status: 303 });
  }
  return NextResponse.json({ ok: true, message, leadId, orderId, ...eligibility });
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
    submissionId: formData.get('submissionId') || '', gclid: formData.get('gclid') || '',
    gbraid: formData.get('gbraid') || '', wbraid: formData.get('wbraid') || '',
    utmSource: formData.get('utmSource') || '', utmMedium: formData.get('utmMedium') || '',
    utmCampaign: formData.get('utmCampaign') || '', utmAdGroup: formData.get('utmAdGroup') || '',
    utmTerm: formData.get('utmTerm') || '', utmContent: formData.get('utmContent') || '',
    campaignId: formData.get('campaignId') || '', adGroupId: formData.get('adGroupId') || '',
    creativeId: formData.get('creativeId') || '', matchType: formData.get('matchType') || '',
    network: formData.get('network') || '', device: formData.get('device') || '',
    landingPage: formData.get('landingPage') || '', firstLandingPage: formData.get('firstLandingPage') || '',
    firstLandingAt: formData.get('firstLandingAt') || '', referrer: formData.get('referrer') || '',
  });

  if (!parsed.success) {
    return failure(request, parsed.error.issues[0]?.message || 'Skontrolujte povinné polia.');
  }

  // Honeypot submissions must stop before they can be deduplicated or measured.
  if (parsed.data.companyWebsite) {
    return failure(request, 'Dopyt sa nepodarilo odoslať.', 400);
  }

  const marketingConsent = hasVerifiedMarketingConsent(request.cookies.get(marketingConsentCookieName)?.value);
  const isQa = isControlledQaLead(parsed.data);

  if (parsed.data.submissionId) {
    const existing = await findLeadBySubmissionId(parsed.data.submissionId);
    if (existing) {
      const identified = await ensureLeadGoogleAdsOrderId(existing);
      return success(request, 'Dopyt sme už prijali.', identified.id, identified.googleAdsOrderId || '', measurementEligibility({
        duplicate: true,
        isQa: isControlledQaLead(existing),
        isSpam: false,
        marketingConsent: false,
      }));
    }
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
    const eligibility = measurementEligibility({ duplicate: false, isQa, isSpam: false, marketingConsent });
    const createdLead = await createLead({
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
      rawData: {
        userAgent: request.headers.get('user-agent') || undefined, wantsRooferRecommendation, selectedRooferId,
        measurement: eligibility,
        attribution: {
          submissionId: parsed.data.submissionId || '', gclid: parsed.data.gclid || '', gbraid: parsed.data.gbraid || '', wbraid: parsed.data.wbraid || '',
          utmSource: parsed.data.utmSource || '', utmMedium: parsed.data.utmMedium || '', utmCampaign: parsed.data.utmCampaign || '',
          utmAdGroup: parsed.data.utmAdGroup || '', utmTerm: parsed.data.utmTerm || '', utmContent: parsed.data.utmContent || '',
          campaignId: parsed.data.campaignId || '', adGroupId: parsed.data.adGroupId || '', creativeId: parsed.data.creativeId || '',
          matchType: parsed.data.matchType || '', network: parsed.data.network || '', device: parsed.data.device || '',
          landingPage: parsed.data.landingPage || request.url, firstLandingPage: parsed.data.firstLandingPage || parsed.data.landingPage || request.url,
          firstLandingAt: parsed.data.firstLandingAt || '', referrer: parsed.data.referrer || '',
        },
      },
    });

    const lead = createdLead.lead;
    if (!createdLead.created) {
      return success(request, 'Dopyt sme už prijali.', lead.id, lead.googleAdsOrderId || '', measurementEligibility({
        duplicate: true,
        isQa: isControlledQaLead(lead),
        isSpam: false,
        marketingConsent: false,
      }));
    }

    await addAuditLog('lead', lead.id, 'measurement_eligibility', 'system', eligibility);

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

    return success(request, 'Ďakujeme! Dopyt sme prijali.', lead.id, lead.googleAdsOrderId || '', eligibility);
  } catch (error) {
    console.error('Lead submit failed', error);
    return failure(request, 'Dopyt sa nepodarilo uložiť. Skúste to prosím znova alebo zavolajte.', 500);
  }
}
