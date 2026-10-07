import { NextRequest, NextResponse } from 'next/server';
import { BlobNotFoundError, get, head } from '@vercel/blob';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { addAuditLog, claimLeadEmailOutbox, consumeApiRateLimit, createLeadSubmission, getExistingLeadSubmission, getLeadSubmissionForRetry, hasConfirmedLeadEmail, LeadSubmissionConflictError, markLeadUploadDraftUploaded, recordAcceptedLeadAnalytics, recordLeadEmailRecipientResult, supersedeLeadUploadDraft, trackUnreservedLegacyLeadPhoto } from '@/src/server/db';
import { collectSubmittedLeadPhotos, validateLeadFileMetadata, validateLeadImageBytes, validateUploadedLeadFile } from '@/src/server/file-validation';
import { sendLeadEmails } from '@/src/server/mail';
import { attachDirectLeadUpload, deleteStoredLeadFile, readStoredLeadFile, storeLeadFile, type DirectLeadUpload } from '@/src/server/storage';
import { createLeadSubmissionFingerprint, recordLeadAuditNonFatal } from '@/src/server/lead-submission-policy';
import { parseLeadAttribution } from '@/src/server/lead-attribution';
import { analyticsConsentCookieName, isMarketingConsentSubject, marketingConsentCookieName, marketingConsentSubjectCookieName } from '@/src/lib/marketing-consent';
import { leadSchema, maxLeadFiles, maxLeadFileSize } from '@/src/server/validation';
import { createLeadReceiptToken, leadReceiptSecret } from '@/src/server/lead-receipt';
import { createNativeLeadSubmissionId, nativeLeadRetryWindowMs } from '@/src/server/native-lead-id';
import { createAcceptedLeadConversion } from '@/src/server/lead-conversion';
import type { PendingMetaLead } from '@/src/lib/marketing-consent';
import { isValidLeadSubmissionId } from '@/src/lib/lead-submission-id.mjs';
import type { LeadFile } from '@/src/server/types';
import { isTrustedVercelDeploymentOrigin } from '@/src/server/public-request-origin';

export const runtime = 'nodejs';

const rateLimitWindowMs = 10 * 60_000;
const maxSubmissionsPerWindow = 30;
const localBuckets = new Map<string, { count: number; resetAt: number }>();

const directLeadPhotoSchema = z.object({
  pathname: z.string().trim().min(1).max(512),
  originalName: z.string().trim().min(1).max(255),
  submissionId: z.string().uuid().refine(isValidLeadSubmissionId),
});

type DirectLeadPhoto = z.infer<typeof directLeadPhotoSchema>;
type VerifiedDirectLeadPhoto = DirectLeadUpload & { sha256: string };

class MissingLeadPhotoError extends Error {
  constructor(readonly pathname: string, message: string) {
    super(message);
    this.name = 'MissingLeadPhotoError';
  }
}

class LeadPhotoInputError extends Error {}

function missingLeadPhoto(pathname: string) {
  return new MissingLeadPhotoError(pathname, 'Fotky v úložisku sa nenašli. Údaje formulára zostali zachované; stlačte znova Odoslať a chýbajúcu fotku nahráme ešte raz.');
}

async function cleanUnlinkedMultipartFiles(submissionId: string, files: Awaited<ReturnType<typeof storeLeadFile>>[]) {
  const cleanup = await Promise.allSettled(files.map(deleteStoredLeadFile));
  const retirement = await Promise.allSettled(files
    .filter((file) => file.storageDriver !== 'local' && file.storageKey.startsWith('lead-drafts/'))
    .map((file) => supersedeLeadUploadDraft(submissionId, file.storageKey)));
  if (cleanup.some((result) => result.status === 'rejected') || retirement.some((result) => result.status === 'rejected')) {
    console.error('Unlinked multipart lead-file cleanup was incomplete.');
  }
}

function clientIp(request: NextRequest) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && isIP(realIp)) return realIp;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').map((value) => value.trim()).filter(Boolean);
  const proxyIp = forwarded?.at(-1);
  return proxyIp && isIP(proxyIp) ? proxyIp : 'unknown';
}

async function rateLimited(request: NextRequest) {
  const now = Date.now();
  const windowStartedAt = new Date(Math.floor(now / rateLimitWindowMs) * rateLimitWindowMs);
  const ip = clientIp(request);
  if (process.env.NODE_ENV !== 'production') {
    const bucket = localBuckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
      localBuckets.set(ip, { count: 1, resetAt: now + rateLimitWindowMs });
      return false;
    }
    bucket.count += 1;
    return bucket.count > maxSubmissionsPerWindow;
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required for lead rate limiting.');
  const key = createHmac('sha256', secret).update(`lead-submit:${ip}`).digest('hex');
  return consumeApiRateLimit(key, windowStartedAt, maxSubmissionsPerWindow);
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin) || isTrustedVercelDeploymentOrigin(origin);
}

function wantsHtml(request: NextRequest) {
  return request.headers.get('accept')?.includes('text/html') && !request.headers.get('accept')?.includes('application/json');
}

function failure(request: NextRequest, message: string, status = 400, details?: { retryPhotoPathname?: string }) {
  if (wantsHtml(request)) {
    const safeMessage = message.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character] || character);
    return new NextResponse(`<!doctype html><html lang="sk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dopyt sa nepodarilo odoslať</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:42rem;margin:10vh auto;padding:1.5rem;color:#192744"><h1>Dopyt sa nepodarilo odoslať</h1><p>${safeMessage}</p><p>Formulár nebol potvrdený ako prijatý. Vráťte sa v prehliadači o krok späť; ak sa údaje neobnovia, zavolajte nám na <a href="tel:+421905217946">0905 217 946</a>.</p><p><a href="/#dopyt">Otvoriť formulár</a></p></body></html>`, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  return NextResponse.json({ ok: false, message, ...details }, { status });
}

function success(request: NextRequest, message: string, emailSent = true, metaLead: PendingMetaLead | null = null) {
  if (wantsHtml(request)) {
    const token = createLeadReceiptToken(emailSent, leadReceiptSecret());
    return NextResponse.redirect(new URL(`/dopyt-prijaty/?dopyt_receipt=${encodeURIComponent(token)}`, request.url), { status: 303 });
  }
  return NextResponse.json({ ok: true, message, emailSent, ...(metaLead ? { metaLead } : {}) });
}

async function hashFile(file: File) {
  const hash = createHash('sha256');
  const reader = file.stream().getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
    }
  } finally {
    reader.releaseLock();
  }
  return hash.digest('hex');
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

async function readPrivateBlobBytes(pathname: string, expectedSize: number) {
  let response: Awaited<ReturnType<typeof get>>;
  try {
    response = await get(pathname, {
      access: 'private',
      useCache: false,
    });
  } catch (error) {
    if (error instanceof BlobNotFoundError) throw missingLeadPhoto(pathname);
    throw error;
  }
  if (!response) throw missingLeadPhoto(pathname);
  if (response.statusCode !== 200 || !response.stream) throw new Error('Private lead photo storage did not return readable bytes.');
  const reader = response.stream.getReader();
  const chunks: Buffer[] = [];
  let length = 0;
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      if (!value) continue;
      length += value.length;
      if (length > maxLeadFileSize) throw new LeadPhotoInputError('Fotografia prekročila povolenú veľkosť 10 MB.');
      chunks.push(Buffer.from(value));
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (length !== expectedSize) throw new LeadPhotoInputError('Fotografia sa nepreniesla celá. Vyberte ju prosím znova.');
  return Buffer.concat(chunks, length);
}

async function verifyDirectLeadPhotos(photos: DirectLeadPhoto[]): Promise<VerifiedDirectLeadPhoto[]> {
  const verified: VerifiedDirectLeadPhoto[] = [];
  for (const photo of photos) {
    if (!validDirectLeadPhotoPath(photo)) throw new LeadPhotoInputError('Nahraná fotka nemá platnú cestu. Vyberte ju prosím znova.');
    let metadata: Awaited<ReturnType<typeof head>>;
    try {
      metadata = await head(photo.pathname);
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        throw missingLeadPhoto(photo.pathname);
      }
      throw error;
    }
    if (metadata.pathname !== photo.pathname) throw new LeadPhotoInputError('Nahraná fotka sa nenašla. Vyberte ju prosím znova.');
    const file = { name: photo.originalName, size: metadata.size, type: metadata.contentType };
    const metadataError = validateLeadFileMetadata(file);
    if (metadataError) throw new LeadPhotoInputError(metadataError);
    const bytes = await readPrivateBlobBytes(photo.pathname, metadata.size);
    const imageError = await validateLeadImageBytes(file, bytes);
    if (imageError) throw new LeadPhotoInputError(imageError);
    try {
      await markLeadUploadDraftUploaded(photo.submissionId, metadata.pathname);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rezervácia prílohy sa nenašla')) {
        // Pre-reservation clients could finish a private upload before this release.
        // Queue only the verified, same-submission object for delayed cleanup;
        // never delete a pathname supplied by the client in this request.
        await trackUnreservedLegacyLeadPhoto(photo.submissionId, metadata.pathname, metadata.etag);
        throw new MissingLeadPhotoError(photo.pathname, 'Fotky boli nahrané pred obnovením ich bezpečnej rezervácie. Údaje formulára zostali zachované; stlačte znova Odoslať a chýbajúcu fotku nahráme ešte raz.');
      }
      throw error;
    }
    verified.push({
      originalName: safeOriginalName(photo.originalName),
      storageKey: metadata.pathname,
      mimeType: metadata.contentType,
      sizeBytes: metadata.size,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return verified;
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return failure(request, 'Neplatný pôvod požiadavky.', 403);
  }

  let isRateLimited: boolean;
  try {
    isRateLimited = await rateLimited(request);
  } catch (error) {
    console.error('Lead rate limit unavailable', error instanceof Error ? error.message : 'unknown');
    return failure(request, 'Dopyt sa teraz nepodarilo bezpečne prijať. Údaje formulára zostali zachované; skúste to o chvíľu znova.', 503);
  }
  if (isRateLimited) {
    return failure(request, 'Formulár bol odoslaný viackrát za sebou. Skúste to prosím o pár minút alebo zavolajte 0905 217 946.', 429);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure(request, 'Formulár sa nepodarilo spracovať.');
  }

  const parsed = leadSchema.safeParse({
    submissionId: formData.get('submissionId') || '',
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

  const submittedPhotos = collectSubmittedLeadPhotos(formData.getAll('photos'));
  if (submittedPhotos.error) return failure(request, submittedPhotos.error);
  const uploadedFiles = submittedPhotos.files;

  const directPhotoEntries = formData.getAll('uploadedPhotos');
  let directPhotos: DirectLeadPhoto[] = [];
  if (directPhotoEntries.length) {
    if (directPhotoEntries.length !== 1 || typeof directPhotoEntries[0] !== 'string' || !directPhotoEntries[0].trim()) {
      return failure(request, 'Fotky sa nepodarilo overiť. Vyberte ich prosím znova.');
    }
    try {
      const parsedDirectPhotos = directLeadPhotoSchema.array().max(maxLeadFiles).safeParse(JSON.parse(directPhotoEntries[0]));
      if (!parsedDirectPhotos.success) return failure(request, 'Fotky sa nepodarilo overiť. Vyberte ich prosím znova.');
      if (new Set(parsedDirectPhotos.data.map((photo) => photo.pathname)).size !== parsedDirectPhotos.data.length) {
        return failure(request, 'Rovnakú fotku môžete priložiť iba raz.');
      }
      directPhotos = parsedDirectPhotos.data;
    } catch {
      return failure(request, 'Fotky sa nepodarilo overiť. Vyberte ich prosím znova.');
    }
  }

  let submissionId = parsed.data.submissionId || directPhotos[0]?.submissionId || '';
  if (submissionId && directPhotos.some((photo) => photo.submissionId !== submissionId)) {
    return failure(request, 'Fotky nepatria k tomuto formuláru. Obnovte stránku a vyberte ich znova.', 400);
  }

  if (uploadedFiles.length + directPhotos.length > maxLeadFiles) {
    return failure(request, `Nahrať môžete maximálne ${maxLeadFiles} súborov.`);
  }

  for (const file of uploadedFiles) {
    const fileError = await validateUploadedLeadFile(file);
    if (fileError) return failure(request, fileError);
  }

  let unlinkedMultipartFiles: Awaited<ReturnType<typeof storeLeadFile>>[] = [];
  try {
    const rooferValue = parsed.data.roofer || '';
    const wantsRooferRecommendation = rooferValue === 'Chcem odporučiť strechára podľa regiónu';
    const selectedRooferId = parsed.data.selectedRooferId || '';
    const leadAttribution = parseLeadAttribution(formData.get('leadAttribution'), {
      analytics: request.cookies.get(analyticsConsentCookieName)?.value === 'granted',
      marketing: request.cookies.get(marketingConsentCookieName)?.value === 'granted',
    });
    const analyticsConsentAtSubmit = request.cookies.get(analyticsConsentCookieName)?.value === 'granted';
    const marketingConsentAtSubmit = request.cookies.get(marketingConsentCookieName)?.value === 'granted';
    const marketingConsentSubject = request.cookies.get(marketingConsentSubjectCookieName)?.value || '';
    const submittedAnalyticsSessionId = String(formData.get('analyticsSessionId') || '');
    const analyticsSessionId = analyticsConsentAtSubmit
      ? (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submittedAnalyticsSessionId)
        ? submittedAnalyticsSessionId
        : randomUUID())
      : '';
    const input = {
      submissionId,
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
        userAgent: request.headers.get('user-agent') || undefined,
        wantsRooferRecommendation,
        selectedRooferId,
        ...(analyticsSessionId ? { analyticsConsentAtSubmit: true, analyticsSessionId } : {}),
        ...(marketingConsentAtSubmit && isMarketingConsentSubject(marketingConsentSubject)
          ? { marketingConsentAtSubmit: true, marketingConsentSubjectAtSubmit: marketingConsentSubject }
          : {}),
        ...(leadAttribution ? { attribution: leadAttribution } : {}),
      },
    };
    const multipartFingerprints = await Promise.all(uploadedFiles.map(async (file) =>
      `${safeOriginalName(file.name)}:${file.type}:${file.size}:${await hashFile(file)}`,
    ));
    const fingerprint = createLeadSubmissionFingerprint(input, {
      uploadedStorageIds: [
        ...directPhotos.map((photo) => photo.pathname),
        ...multipartFingerprints,
      ],
    });

    const isNativeRetry = !submissionId;
    const now = Date.now();
    let previousNativeSubmissionId = '';
    if (isNativeRetry) {
      const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-dev-auth-secret-change-me');
      submissionId = createNativeLeadSubmissionId(fingerprint.hash, secret, now);
      previousNativeSubmissionId = createNativeLeadSubmissionId(fingerprint.hash, secret, now - nativeLeadRetryWindowMs);
      input.submissionId = submissionId;
    }

    let existingFingerprintMismatch = false;
    let existing = null;
    try {
      existing = await getExistingLeadSubmission(submissionId, fingerprint.hash);
    } catch (error) {
      if (error instanceof LeadSubmissionConflictError) existingFingerprintMismatch = true;
      else throw error;
    }
    if (!existing && previousNativeSubmissionId && previousNativeSubmissionId !== submissionId) {
      const previous = await getExistingLeadSubmission(previousNativeSubmissionId, fingerprint.hash);
      const previousCreatedAt = previous ? Date.parse(previous.lead.createdAt) : Number.NaN;
      if (previous && Number.isFinite(previousCreatedAt) && now - previousCreatedAt >= 0 && now - previousCreatedAt <= nativeLeadRetryWindowMs) {
        submissionId = previousNativeSubmissionId;
        input.submissionId = submissionId;
        existing = previous;
      }
    }
    if (existing) {
      try {
        await recordAcceptedLeadAnalytics(existing.lead);
      } catch (error) {
        console.error('Accepted lead analytics could not be recorded; lead remains safely stored.', error);
      }
      let emailSent = false;
      try {
        emailSent = await hasConfirmedLeadEmail(existing.lead.id);
      } catch (error) {
        console.error('Could not read lead email status after an idempotent retry.', error);
      }
      return success(
        request,
        emailSent ? 'Dopyt už bol prijatý a potvrdenie bolo odoslané.' : 'Dopyt už bol prijatý. Potvrdenie emailom ešte overujeme; nemusíte ho odosielať znova.',
        emailSent,
        existing.lead.rawData?.marketingConsentAtSubmit === true
          ? createAcceptedLeadConversion(input.submissionId, existing.lead.materialType)
          : null,
      );
    }

    let verifiedDirectPhotos: VerifiedDirectLeadPhoto[];
    try {
      verifiedDirectPhotos = await verifyDirectLeadPhotos(directPhotos);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fotky sa nepodarilo overiť. Vyberte ich prosím znova.';
      if (error instanceof MissingLeadPhotoError) {
        return failure(request, message, 409, { retryPhotoPathname: error.pathname });
      }
      if (error instanceof LeadPhotoInputError) return failure(request, message);
      if (message.includes('Rezervácia prílohy sa nenašla')) {
      return failure(request, 'Fotky boli nahrané pred obnovením ich bezpečnej rezervácie. Údaje formulára zostali zachované; stlačte znova Odoslať a fotky nahráme ešte raz.', 409);
      }
      console.error('Private lead-photo verification unavailable.', error instanceof Error ? error.name : 'unknown');
      return failure(request, 'Úložisko fotiek teraz neodpovedá. Údaje formulára zostali zachované; skúste to o chvíľu znova alebo zavolajte 0905 217 946.', 503);
    }

    if (existingFingerprintMismatch) {
      const prior = await getLeadSubmissionForRetry(submissionId);
      if (prior) {
        const submittedCustomerFingerprint = createLeadSubmissionFingerprint(input);
        const acceptedCustomerFingerprint = createLeadSubmissionFingerprint(prior.lead);
        const submittedAttachmentFingerprints = [
          ...verifiedDirectPhotos.map((photo) => attachmentFingerprint(photo.originalName, photo.mimeType, photo.sizeBytes, photo.sha256)),
          ...await Promise.all(uploadedFiles.map(async (file) => attachmentFingerprint(
            file.name,
            file.type,
            file.size,
            await hashFile(file),
          ))),
        ].sort();
        const acceptedAttachmentFingerprints = (await existingAttachmentFingerprints(prior.files)).sort();
        const sameCustomer = submittedCustomerFingerprint.hash === acceptedCustomerFingerprint.hash;
        const sameAttachments = JSON.stringify(submittedAttachmentFingerprints) === JSON.stringify(acceptedAttachmentFingerprints);

        if (!sameCustomer || !sameAttachments) {
          return failure(request, 'Tento dopyt už bol prijatý, ale údaje alebo fotky sa od prijatej verzie líšia. Nevytvárajte nový dopyt; overte prijatie telefonicky na 0905 217 946.', 409);
        }

        await Promise.all(verifiedDirectPhotos.map((photo) => supersedeLeadUploadDraft(submissionId, photo.storageKey)));
        let emailSent = false;
        try {
          emailSent = await hasConfirmedLeadEmail(prior.lead.id);
        } catch (error) {
          console.error('Could not read lead email status after a content-verified retry.', error);
        }
        return success(
          request,
          emailSent ? 'Dopyt už bol prijatý a potvrdenie bolo odoslané.' : 'Dopyt už bol prijatý. Potvrdenie emailom ešte overujeme; nemusíte ho odosielať znova.',
          emailSent,
          prior.lead.rawData?.marketingConsentAtSubmit === true
            ? createAcceptedLeadConversion(input.submissionId, prior.lead.materialType)
            : null,
        );
      }
    }

    const stored = [];
    for (const [retryPosition, file] of uploadedFiles.entries()) {
      const storedFile = await storeLeadFile(submissionId, file, retryPosition);
      unlinkedMultipartFiles.push(storedFile);
      stored.push(storedFile);
    }
    for (const photo of verifiedDirectPhotos) stored.push(attachDirectLeadUpload(submissionId, photo));

    const submission = await createLeadSubmission({ ...input, submissionHash: fingerprint.hash }, stored);
    try {
      await recordAcceptedLeadAnalytics(submission.lead);
    } catch (error) {
      console.error('Accepted lead analytics could not be recorded; lead remains safely stored.', error);
    }
    if (submission.duplicate) {
      await cleanUnlinkedMultipartFiles(submissionId, unlinkedMultipartFiles);
      unlinkedMultipartFiles = [];
      let emailSent = false;
      try {
        emailSent = await hasConfirmedLeadEmail(submission.lead.id);
      } catch (error) {
        console.error('Could not read lead email status after duplicate submission.', error);
      }
      return success(
        request,
        emailSent ? 'Dopyt už bol prijatý a potvrdenie bolo odoslané.' : 'Dopyt už bol prijatý. Potvrdenie emailom ešte overujeme; nemusíte ho odosielať znova.',
        emailSent,
        submission.lead.rawData?.marketingConsentAtSubmit === true
          ? createAcceptedLeadConversion(input.submissionId, submission.lead.materialType)
          : null,
      );
    }
    unlinkedMultipartFiles = [];

    let mailResult: {
      sent: boolean;
      customerSent: boolean;
      adminSent: boolean;
      reason?: string;
    } = { sent: false, customerSent: false, adminSent: false, reason: 'Email sa nepodarilo odoslať.' };
    try {
      let recipientsRecorded = 0;
      try {
        mailResult = await sendLeadEmails(submission.lead, submission.files.length, submission.businessJobId, {
          claim: (role) => claimLeadEmailOutbox(submission.lead.id, role),
          record: async (role, result, attemptLockedAt) => {
            const recorded = await recordLeadEmailRecipientResult(submission.lead.id, role, result, attemptLockedAt);
            if (!recorded) throw new Error('Výsledok odoslania už nepatrí aktívnemu pokusu.');
            recipientsRecorded += 1;
          },
        });
      } catch (error) {
        let customerConfirmed = false;
        try {
          customerConfirmed = await hasConfirmedLeadEmail(submission.lead.id);
        } catch {
          // The committed lead and per-recipient outbox remain the source of truth.
        }
        mailResult = {
          sent: false,
          customerSent: customerConfirmed,
          adminSent: false,
          reason: error instanceof Error ? error.message : 'Výsledok emailu sa nepodarilo potvrdiť.',
        };
      }
      if (recipientsRecorded > 0) {
        mailResult = await recordLeadAuditNonFatal(
          mailResult,
          () => addAuditLog('lead', submission.lead.id, mailResult.sent ? 'lead_email_sent' : 'lead_email_error', 'system', mailResult),
          (error) => console.error('Lead email result was confirmed, but its audit log failed.', error),
        );
      }
    } catch (error) {
      // The lead has already been committed. Do not tell the customer to resubmit it.
      console.error('Lead was accepted, but email processing needs recovery.', error);
      mailResult = { sent: false, customerSent: false, adminSent: false, reason: 'Potvrdenie emailom ešte overujeme.' };
    }

    const message = mailResult.customerSent
      ? 'Dopyt sme prijali. Potvrdenie sme odoslali na váš email.'
      : 'Dopyt sme prijali. Potvrdenie emailom ešte overujeme; nemusíte formulár odosielať znova.';
    return success(request, message, mailResult.customerSent,
      submission.lead.rawData?.marketingConsentAtSubmit === true
        ? createAcceptedLeadConversion(input.submissionId, submission.lead.materialType)
        : null,
    );
  } catch (error) {
    if (error instanceof LeadSubmissionConflictError) {
      if (unlinkedMultipartFiles.length) {
        await cleanUnlinkedMultipartFiles(submissionId, unlinkedMultipartFiles);
      }
      return failure(request, error.message, 409);
    }
    // A failed response after COMMIT may be ambiguous. Keep files until a reconciler
    // can prove they are unreferenced; deleting here could break a committed lead.
    console.error('Lead submit failed', error);
    return failure(request, 'Výsledok odoslania sa nepodarilo potvrdiť. Neobnovujte stránku ani nevytvárajte nový dopyt; skúste odoslanie zopakovať z tohto otvoreného formulára, prípadne zavolajte 0905 217 946.', 503);
  }
}

function attachmentFingerprint(name: string, mimeType: string, sizeBytes: number, sha256: string) {
  return `${safeOriginalName(name)}:${mimeType}:${sizeBytes}:${sha256}`;
}

async function existingAttachmentFingerprints(files: LeadFile[]) {
  const fingerprints: string[] = [];
  for (const file of files) {
    const bytes = await readStoredLeadFile(file);
    fingerprints.push(attachmentFingerprint(
      file.originalName,
      file.mimeType,
      file.sizeBytes,
      createHash('sha256').update(bytes).digest('hex'),
    ));
  }
  return fingerprints;
}
