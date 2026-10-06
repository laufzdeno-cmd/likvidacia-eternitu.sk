import { createHash, randomUUID } from 'node:crypto';
import { get as getPrivateBlob } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addAuditLog, attachCareerApplicationCv, attachCareerCvUpload, createCareerApplication, getCareerApplicationBySubmissionId, getCareerCvUploadByPath, listApplicationNotificationStatuses, reserveCareerCvUpload } from '@/src/server/db';
import { validateCareerCvFile } from '@/src/server/file-validation';
import { processCareerApplicationNotificationBatch } from '@/src/server/application-notifications';
import { publicNotificationSummary } from '@/src/server/application-notification-policy';
import { storeCareerApplicationCv, storeCareerApplicationCvAtReservedPath } from '@/src/server/storage';
import { consumeSharedRateLimit, trustedRateLimitClientIp } from '@/src/server/shared-rate-limit';

export const runtime = 'nodejs';

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

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return process.env.NODE_ENV !== 'production';
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk')
    .split(',').map((item) => item.trim()).filter(Boolean);
  return allowed.includes(origin);
}

function sameApplicationPayload(application: Awaited<ReturnType<typeof createCareerApplication>>['application'], input: {
  fullName: string; phone: string; email: string; city: string; cooperationType: 'szco' | 'crew' | 'other';
  workRegions: string; hasTradeLicense: boolean; workAtHeights: boolean; hasAsbestosExperience: boolean;
  asbestosExperience: string; experience: string; note: string; privacyConsent: boolean;
}) {
  return application.fullName === input.fullName && application.phone === input.phone && application.email === input.email &&
    application.city === input.city && application.cooperationType === input.cooperationType &&
    application.workRegions === input.workRegions && application.hasTradeLicense === input.hasTradeLicense &&
    application.workAtHeights === input.workAtHeights && application.hasAsbestosExperience === input.hasAsbestosExperience &&
    application.asbestosExperience === input.asbestosExperience && application.experience === input.experience &&
    application.note === input.note && application.privacyConsent === input.privacyConsent;
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
  const cv = formData.get('cv');
  if (cv != null && !(cv instanceof File)) return response('Neplatná príloha životopisu.');
  if (cv instanceof File && cv.name && cv.size === 0) return response('Priložený životopis je prázdny.');
  const hasCv = cv instanceof File && cv.size > 0;
  const cvIntent = formData.get('cvIntent') === 'on';
  const cvExpectedSize = formData.get('cvExpectedSize');
  const cvExpectedSha256 = formData.get('cvExpectedSha256');
  const cvPathname = formData.get('cvPathname');
  if (cvPathname != null && typeof cvPathname !== 'string') return response('Neplatný odkaz na životopis.');
  if (cvIntent && hasCv) return response('Životopis pošlite iba jedným spôsobom.');
  if (cvIntent && (typeof cvExpectedSize !== 'string' || !/^[1-9][0-9]{0,6}$/.test(cvExpectedSize)
    || Number(cvExpectedSize) > 5 * 1024 * 1024)) return response('Životopis môže mať maximálne 5 MB.');
  if (cvIntent && (typeof cvExpectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(cvExpectedSha256))) {
    return response('Neplatný odtlačok životopisu.');
  }
  if (cvPathname && (!cvIntent || !new RegExp(`^career-cv/${parsed.data.submissionId}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(pdf|doc|docx)$`, 'i').test(cvPathname))) {
    return response('Neplatný odkaz na životopis.');
  }
  if (cvIntent && !process.env.BLOB_READ_WRITE_TOKEN) return response('Súkromné nahrávanie životopisu je teraz nedostupné. Skúste to neskôr alebo pošlite žiadosť bez prílohy.', 503);
  if (hasCv) {
    const cvError = await validateCareerCvFile(cv);
    if (cvError) return response(cvError);
  }
  const expected = {
    fullName: parsed.data.fullName, phone: parsed.data.phone, email: parsed.data.email, city: parsed.data.city,
    cooperationType: parsed.data.cooperationType, workRegions: parsed.data.workRegions, hasTradeLicense: true,
    workAtHeights: true, hasAsbestosExperience: parsed.data.hasAsbestosExperience === 'yes',
    asbestosExperience: parsed.data.asbestosExperience, experience: parsed.data.experience, note: parsed.data.note, privacyConsent: true,
  };
  let existing: Awaited<ReturnType<typeof getCareerApplicationBySubmissionId>>;
  try {
    const clientIp = trustedRateLimitClientIp(request.headers);
    if (await consumeSharedRateLimit('career-application-attempt-address', clientIp, 30, 10 * 60_000)) {
      return response('Formulár bol odoslaný viackrát za sebou. Skúste to o pár minút alebo nám zavolajte na 0905 217 946.', 429);
    }
    existing = await getCareerApplicationBySubmissionId(parsed.data.submissionId);
    if (existing && !sameApplicationPayload(existing, expected)) {
      return response('Táto žiadosť už bola odoslaná s inými údajmi. Nový formulár prosím odošlite ako novú žiadosť.', 409);
    }
    if (existing && !existing.cvExpected && (hasCv || cvIntent)) {
      return response('K tejto žiadosti pôvodne nebol priložený životopis. Novú žiadosť odošlite samostatne.', 409);
    }
    if (cvIntent && existing?.cv && existing.cv.sha256 !== cvExpectedSha256) {
      return response('K tejto žiadosti už evidujeme iný životopis. Pôvodný súbor sme ponechali bez zmeny.', 409);
    }
    if (existing?.cvExpected && !existing.cv && !hasCv && !cvIntent) {
      return NextResponse.json({ ok: false, accepted: true, notificationStatus: 'pending',
        message: 'Žiadosť sme prijali, ale životopis zatiaľ chýba. Priložte pôvodný súbor a skúste odoslanie znova s rovnakými údajmi.' }, { status: 409 });
    }
    if (!existing) {
      const [addressLimited, emailLimited] = await Promise.all([
        consumeSharedRateLimit('career-application-address', clientIp, 10, 10 * 60_000),
        consumeSharedRateLimit('career-application-email', parsed.data.email.toLowerCase(), 3, 10 * 60_000),
      ]);
      if (addressLimited || emailLimited) return response('Formulár bol odoslaný viackrát za sebou. Skúste to o pár minút alebo nám zavolajte na 0905 217 946.', 429);
    }
  } catch (error) {
    console.error('Career application idempotency or rate limit unavailable', error instanceof Error ? error.message : 'unknown');
    return response('Žiadosť sa teraz nepodarilo bezpečne overiť. Skúste to o chvíľu znova.', 503);
  }

  let persistedApplicationId: string | undefined;
  try {
    const saved = await createCareerApplication({
      submissionId: parsed.data.submissionId, fullName: parsed.data.fullName, phone: parsed.data.phone, email: parsed.data.email,
      city: parsed.data.city, cooperationType: parsed.data.cooperationType, workRegions: parsed.data.workRegions,
      hasTradeLicense: true, workAtHeights: true, hasAsbestosExperience: parsed.data.hasAsbestosExperience === 'yes',
      asbestosExperience: parsed.data.asbestosExperience, experience: parsed.data.experience, note: parsed.data.note, privacyConsent: true,
      cvExpected: hasCv || cvIntent,
    });
    persistedApplicationId = saved.application.id;
    if (!sameApplicationPayload(saved.application, expected)) {
      return response('Táto žiadosť už bola odoslaná s inými údajmi. Nový formulár prosím odošlite ako novú žiadosť.', 409);
    }
    if (!saved.application.cvExpected && (hasCv || cvIntent)) {
      return response('K tejto žiadosti pôvodne nebol priložený životopis. Novú žiadosť odošlite samostatne.', 409);
    }
    if (cvIntent && saved.application.cv && saved.application.cv.sha256 !== cvExpectedSha256) {
      return response('K tejto žiadosti už evidujeme iný životopis. Pôvodný súbor sme ponechali bez zmeny.', 409);
    }
    if (saved.application.cvExpected && !saved.application.cv && !hasCv && !cvIntent) {
      return NextResponse.json({ ok: false, accepted: true, notificationStatus: 'pending',
        message: 'Žiadosť sme prijali, ale životopis zatiaľ chýba. Priložte pôvodný súbor a skúste odoslanie znova s rovnakými údajmi.' }, { status: 409 });
    }

    let application = saved.application;
    if (cvIntent && !cvPathname && !application.cv) {
      return NextResponse.json({ ok: false, accepted: true, uploadRequired: true, notificationStatus: 'pending',
        message: 'Žiadosť sme prijali. Teraz bezpečne nahráme životopis.' }, { status: 202 });
    }
    if (cvPathname) {
      try {
        const upload = await getCareerCvUploadByPath(parsed.data.submissionId, cvPathname);
        if (!upload) {
          return NextResponse.json({ ok: false, accepted: true, uploadMissing: true, uploadExpired: true,
            message: 'Žiadosť evidujeme, no životopis sa ešte nenahral. Skúste odoslanie znova s tým istým súborom.' }, { status: 409 });
        }
        if (upload.applicationId !== application.id || upload.expectedSize !== Number(cvExpectedSize)
          || upload.expectedSha256 !== cvExpectedSha256) {
          return response('Tento životopis nepatrí k žiadosti.', 409);
        }
        if (upload.status === 'deleting' || upload.status === 'deletion_pending' || upload.status === 'deleted') {
          return NextResponse.json({ ok: false, accepted: true, uploadMissing: true, uploadExpired: true,
            message: 'Žiadosť evidujeme, ale pôvodné nahratie životopisu už vypršalo. Skúste ho priložiť znova.' }, { status: 409 });
        }
        if (application.cv) {
          if (application.cv.storageKey !== cvPathname || application.cv.sha256 !== upload.expectedSha256) {
            return response('K tejto žiadosti už evidujeme iný životopis. Pôvodný súbor sme ponechali bez zmeny.', 409);
          }
        } else {
          const blob = await getPrivateBlob(cvPathname, { access: 'private', useCache: false });
          if (!blob) {
            // Leave a margin before token renewal closes at 23 hours.
            const uploadExpired = new Date(upload.createdAt).getTime() < Date.now() - 22 * 60 * 60_000;
            return NextResponse.json({ ok: false, accepted: true, uploadMissing: true, uploadExpired,
              message: 'Žiadosť evidujeme, no životopis sa ešte nenahral. Skúste odoslanie znova s tým istým súborom.' }, { status: 409 });
          }
          if (blob.statusCode !== 200 || blob.blob.size !== upload.expectedSize || blob.blob.size > 5 * 1024 * 1024) {
            throw new Error('Súkromný životopis nie je dostupný alebo nesúhlasí jeho veľkosť.');
          }
          const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
          if (bytes.length !== upload.expectedSize || createHash('sha256').update(bytes).digest('hex') !== upload.expectedSha256) {
            throw new Error('Súkromný životopis sa nezhoduje s rezerváciou.');
          }
          const verifiedFile = new File([bytes], upload.originalName, { type: blob.blob.contentType });
          const cvError = await validateCareerCvFile(verifiedFile);
          if (cvError) return response(cvError, 409);
          const attached = await attachCareerCvUpload(parsed.data.submissionId, cvPathname, {
            originalName: upload.originalName, storageDriver: 'vercel_blob', storageKey: cvPathname,
            mimeType: blob.blob.contentType, sizeBytes: bytes.length, sha256: upload.expectedSha256,
          });
          if (!attached || attached.cv?.storageKey !== cvPathname) throw new Error('Životopis sa nepodarilo bezpečne pripojiť.');
          application = attached;
        }
      } catch (error) {
        console.error('Career application saved; direct private CV attachment needs retry', { applicationId: application.id, error });
        return NextResponse.json({ ok: false, accepted: true, notificationStatus: 'pending',
          message: 'Žiadosť sme prijali, ale životopis sa zatiaľ nepodarilo bezpečne pripojiť. Ponechajte súbor a skúste odoslanie znova.' }, { status: 503 });
      }
    }
    if (hasCv) {
      try {
        const digest = createHash('sha256').update(Buffer.from(await cv.arrayBuffer())).digest('hex');
        if (application.cv && !application.cv.sha256) {
          return NextResponse.json({
            ok: false,
            accepted: true,
            notificationStatus: 'pending',
            message: 'Žiadosť sme prijali a pôvodný životopis bezpečne ponechali. Súbor už nevieme bezpečne porovnať, preto ho neprepíšeme.',
          }, { status: 409 });
        }
        if (application.cv?.sha256 && application.cv.sha256 !== digest) {
          return response('K tejto žiadosti už evidujeme iný životopis. Pôvodný súbor sme ponechali bez zmeny.', 409);
        }
        if (!application.cv) {
          let withCv;
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            const extension = cv.name.split('.').pop()?.toLowerCase();
            if (!['pdf', 'doc', 'docx'].includes(extension || '')) throw new Error('Neplatný formát životopisu.');
            const pathname = `career-cv/${parsed.data.submissionId}/${randomUUID()}.${extension}`;
            await reserveCareerCvUpload({ submissionId: parsed.data.submissionId, pathname,
              originalName: cv.name, expectedSize: cv.size, expectedSha256: digest });
            const stored = await storeCareerApplicationCvAtReservedPath(parsed.data.submissionId, pathname, cv);
            withCv = await attachCareerCvUpload(parsed.data.submissionId, pathname, { ...stored, sha256: digest });
          } else if (process.env.NODE_ENV !== 'production') {
            const stored = await storeCareerApplicationCv(application.id, cv);
            withCv = await attachCareerApplicationCv(application.id, { ...stored, sha256: digest });
          } else {
            throw new Error('Súkromné úložisko životopisu nie je nastavené.');
          }
          if (!withCv) throw new Error('Životopis sa nepodarilo pripojiť k žiadosti.');
          if (withCv.cv?.sha256 && withCv.cv.sha256 !== digest) {
            return response('K tejto žiadosti už evidujeme iný životopis. Pôvodný súbor sme ponechali bez zmeny.', 409);
          }
          application = withCv;
        }
      } catch (error) {
        console.error('Career application saved; private CV attachment will need retry', { applicationId: application.id, error });
        return NextResponse.json({
          ok: false,
          accepted: true,
          notificationStatus: 'pending',
          message: 'Žiadosť sme prijali a bezpečne uložili, no prílohu sa nepodarilo pripojiť. Formulár aj súbor zostali zachované — skúste odoslať znova, použije sa tá istá žiadosť.',
        }, { status: 503 });
      }
    }

    try {
      await processCareerApplicationNotificationBatch(application.id);
    } catch (error) {
      console.error('Career application saved; notification remains in persistent outbox', { applicationId: application.id, error });
    }
    const notifications = await listApplicationNotificationStatuses('career_application', [application.id]).catch((error) => {
      console.error('Career notification status could not be read after saving', { applicationId: application.id, error });
      return [];
    });
    await addAuditLog('career_application', application.id, 'career_application_notification_status', 'system',
      Object.fromEntries(notifications.map((item) => [item.recipient, item.status]))).catch((error) => {
        console.error('Career notification audit could not be written', { applicationId: application.id, error });
      });
    return NextResponse.json({
      ok: true,
      accepted: true,
      notificationStatus: publicNotificationSummary(notifications),
      message: saved.duplicate ? 'Vašu žiadosť už evidujeme. Ďakujeme.' : 'Ďakujeme. Žiadosť sme prijali a čo najskôr sa vám ozveme.',
    });
  } catch (error) {
    console.error('Career application failed', error);
    if (persistedApplicationId) {
      const notifications = await listApplicationNotificationStatuses('career_application', [persistedApplicationId]).catch(() => []);
      return NextResponse.json({
        ok: true,
        accepted: true,
        notificationStatus: publicNotificationSummary(notifications),
        message: 'Žiadosť sme prijali a bezpečne uložili. Potvrdenie e-mailom sa ešte spracúva.',
      });
    }
    return response('Žiadosť sa nepodarilo uložiť. Skúste to prosím znova alebo zavolajte 0905 217 946.', 500);
  }
}
