import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { get, head } from '@vercel/blob';
import { z } from 'zod';
import { addAuditLog, addLeadFiles, createBusinessJobFromLead, createLeadSubmission, LeadSubmissionConflictError } from '@/src/server/db';
import { validateLeadFileHeader, validateLeadFileMetadata, validateUploadedLeadFile } from '@/src/server/file-validation';
import { sendLeadEmails } from '@/src/server/mail';
import { attachDirectLeadUpload, storeLeadFile, type DirectLeadUpload } from '@/src/server/storage';
import { leadSchema, maxLeadFiles } from '@/src/server/validation';

export const runtime = 'nodejs';

const buckets = new Map<string, { count: number; resetAt: number }>();
const rateLimitWindowMs = 10 * 60_000;
const maxSubmissionsPerWindow = 30;

const directLeadPhotoSchema = z.object({
  pathname: z.string().trim().min(1).max(512),
  originalName: z.string().trim().min(1).max(255),
  submissionId: z.string().uuid(),
});

type DirectLeadPhoto = z.infer<typeof directLeadPhotoSchema>;

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
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

function success(request: NextRequest, message: string, details: { emailSent?: boolean; duplicate?: boolean } = {}) {
  if (wantsHtml(request)) {
    return NextResponse.redirect(new URL('/?odoslane=1#dopyt', request.url), { status: 303 });
  }
  return NextResponse.json({ ok: true, message, ...details });
}

function submissionFingerprint(input: {
  fullName: string; phone: string; email: string; city: string; district: string; objectType: string; materialType: string;
  areaEstimate: number; preferredContact: string; roofer: string; selectedRooferId: string; term: string; note: string;
}) {
  const value = JSON.stringify({
    fullName: input.fullName.trim(), phone: input.phone.trim(), email: input.email.trim().toLowerCase(), city: input.city.trim(),
    district: input.district.trim(), objectType: input.objectType.trim(), materialType: input.materialType.trim(),
    areaEstimate: input.areaEstimate, preferredContact: input.preferredContact.trim(), roofer: input.roofer.trim(),
    selectedRooferId: input.selectedRooferId.trim(), term: input.term.trim(), note: input.note.trim(),
  });
  return createHash('sha256').update(value).digest('hex');
}

function validDirectLeadPhotoPath(photo: DirectLeadPhoto) {
  const prefix = `lead-drafts/${photo.submissionId}/`;
  if (!photo.pathname.startsWith(prefix)) return false;
  const filename = photo.pathname.slice(prefix.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|heic|heif)$/i.test(filename);
}

function safeOriginalName(name: string) {
  return name.replace(/[\u0000-\u001f\\/:*?"<>|]/g, '_').trim().slice(0, 180) || 'fotka';
}

async function readPrivateBlobHeader(pathname: string) {
  const response = await get(pathname, {
    access: 'private',
    useCache: false,
  });
  if (!response || response.statusCode !== 200 || !response.stream) throw new Error('Nahraná fotka sa nenašla.');
  const reader = response.stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < 32) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      length += value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(Math.min(length, 32));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = bytes.length - offset;
    if (remaining <= 0) break;
    bytes.set(chunk.slice(0, remaining), offset);
    offset += Math.min(chunk.length, remaining);
  }
  return bytes;
}

async function verifyDirectLeadPhotos(photos: DirectLeadPhoto[]): Promise<DirectLeadUpload[]> {
  const verified: DirectLeadUpload[] = [];
  for (const photo of photos) {
    if (!validDirectLeadPhotoPath(photo)) throw new Error('Nahraná fotka nemá platnú cestu. Vyberte ju prosím znova.');
    const metadata = await head(photo.pathname);
    if (metadata.pathname !== photo.pathname) throw new Error('Nahraná fotka sa nenašla. Vyberte ju prosím znova.');
    const file = { name: photo.originalName, size: metadata.size, type: metadata.contentType };
    const metadataError = validateLeadFileMetadata(file);
    if (metadataError) throw new Error(metadataError);
    const headerError = validateLeadFileHeader(file, await readPrivateBlobHeader(photo.pathname));
    if (headerError) throw new Error(headerError);
    verified.push({
      originalName: safeOriginalName(photo.originalName),
      storageKey: metadata.pathname,
      mimeType: metadata.contentType,
      sizeBytes: metadata.size,
    });
  }
  return verified;
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

  const parsed = leadSchema.safeParse({
    submissionId: formData.get('submissionId'),
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

  const rawDirectPhotos = formData.get('uploadedPhotos');
  let directPhotos: DirectLeadPhoto[] = [];
  if (typeof rawDirectPhotos === 'string' && rawDirectPhotos.trim()) {
    try {
      const parsedDirectPhotos = directLeadPhotoSchema.array().max(maxLeadFiles).safeParse(JSON.parse(rawDirectPhotos));
      if (!parsedDirectPhotos.success) return failure(request, 'Fotky sa nepodarilo overiť. Vyberte ich prosím znova.');
      if (new Set(parsedDirectPhotos.data.map((photo) => photo.pathname)).size !== parsedDirectPhotos.data.length) {
        return failure(request, 'Rovnakú fotku môžete priložiť iba raz.');
      }
      directPhotos = parsedDirectPhotos.data;
    } catch {
      return failure(request, 'Fotky sa nepodarilo overiť. Vyberte ich prosím znova.');
    }
  }

  if (uploadedFiles.length + directPhotos.length > maxLeadFiles) {
    return failure(request, `Nahrať môžete maximálne ${maxLeadFiles} súborov.`);
  }

  for (const file of uploadedFiles) {
    const fileError = await validateUploadedLeadFile(file);
    if (fileError) return failure(request, fileError);
  }

  let verifiedDirectPhotos: DirectLeadUpload[];
  try {
    verifiedDirectPhotos = await verifyDirectLeadPhotos(directPhotos);
  } catch (error) {
    return failure(request, error instanceof Error ? error.message : 'Fotky sa nepodarilo overiť. Vyberte ich prosím znova.');
  }

  try {
    const rooferValue = parsed.data.roofer || '';
    const wantsRooferRecommendation = rooferValue === 'Chcem odporučiť strechára podľa regiónu';
    const selectedRooferId = parsed.data.selectedRooferId || '';
    const input = {
      submissionId: parsed.data.submissionId,
      submissionHash: submissionFingerprint({
        fullName: parsed.data.fullName, phone: parsed.data.phone, email: parsed.data.email, city: parsed.data.city,
        district: parsed.data.district || '', objectType: parsed.data.objectType, materialType: parsed.data.materialType,
        areaEstimate: parsed.data.areaEstimate, preferredContact: parsed.data.preferredContact || 'Zavolajte mi',
        roofer: rooferValue, selectedRooferId, term: parsed.data.term || '', note: parsed.data.note || '',
      }),
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
    };
    const submission = await createLeadSubmission(input);
    const lead = submission.lead;

    const businessJob = submission.businessJobId
      ? { id: submission.businessJobId }
      : await createBusinessJobFromLead(lead);

    if (submission.duplicate) {
      return success(request, 'Dopyt už máme uložený. Nemusíte ho odosielať znova.', { duplicate: true, emailSent: false });
    }

    const stored = [];
    for (const file of uploadedFiles) {
      stored.push(await storeLeadFile(lead.id, file));
    }
    for (const photo of verifiedDirectPhotos) {
      stored.push(attachDirectLeadUpload(lead.id, photo));
    }
    const fileRows = await addLeadFiles(stored);
    await addAuditLog('lead', lead.id, 'files_uploaded', 'system', { count: fileRows.length });

    let mailResult: {
      sent: boolean;
      customerSent: boolean;
      adminSent: boolean;
      reason?: string;
    };
    try {
      mailResult = await sendLeadEmails(lead, fileRows.length, businessJob.id);
    } catch (error) {
      mailResult = {
        sent: false,
        customerSent: false,
        adminSent: false,
        reason: error instanceof Error ? error.message : 'Email sa nepodarilo odoslať.',
      };
    }
    await addAuditLog('lead', lead.id, mailResult.sent ? 'lead_email_sent' : 'lead_email_error', 'system', mailResult);

    if (!mailResult.customerSent) {
      return success(request, 'Dopyt sme prijali. Potvrdzovací e-mail sa momentálne nepodarilo odovzdať e-mailovému serveru; dopyt už neposielajte znova.', { emailSent: false });
    }

    return success(request, 'Ďakujeme! Dopyt sme prijali.', { emailSent: true });
  } catch (error) {
    if (error instanceof LeadSubmissionConflictError) return failure(request, error.message, 409);
    console.error('Lead submit failed', error);
    return failure(request, 'Dopyt sa nepodarilo uložiť. Skúste to prosím znova alebo zavolajte.', 500);
  }
}
