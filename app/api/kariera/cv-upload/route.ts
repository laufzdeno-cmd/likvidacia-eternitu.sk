import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { head } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCareerApplicationBySubmissionId, markCareerCvUploadUploaded, reserveCareerCvUpload } from '@/src/server/db';
import { careerCvUploadContentTypes, maxCareerCvBytes, validateCareerCvReservation, isCareerCvUploadPath } from '@/src/server/career-cv-policy';
import { consumeSharedRateLimit, trustedRateLimitClientIp } from '@/src/server/shared-rate-limit';

export const runtime = 'nodejs';

const payloadSchema = z.object({
  submissionId: z.string(),
  originalName: z.string(),
  expectedSize: z.number(),
  expectedSha256: z.string(),
});
const callbackPayloadSchema = z.object({ submissionId: z.string(), pathname: z.string() });

class UploadRequestError extends Error {
  constructor(readonly status: number) { super('Career CV upload request rejected.'); }
}

function tokenOriginAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk')
    .split(',').map((value) => value.trim()).filter(Boolean);
  if (allowed.includes(origin)) return true;
  if (process.env.VERCEL_ENV === 'preview') {
    const previewOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
      .filter(Boolean).map((host) => `https://${host}`);
    if (previewOrigins.includes(origin)) return true;
  }
  if (process.env.NODE_ENV === 'production') return false;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) && origin === request.nextUrl.origin;
}

function privateBlobMatches(url: string, pathname: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(parsed.hostname) &&
      decodeURIComponent(parsed.pathname.slice(1)) === pathname && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Nahrávanie životopisu je momentálne nedostupné.' }, { status: 503 });
  }
  let body: HandleUploadBody;
  try {
    if (Number(request.headers.get('content-length') || 0) > 16_384) throw new Error('oversized token request');
    body = await request.json() as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: 'Neplatná požiadavka na nahratie.' }, { status: 400 });
  }

  const eventType = (body as { type?: string })?.type;
  if (eventType === 'blob.generate-client-token') {
    if (!tokenOriginAllowed(request)) {
      return NextResponse.json({ error: 'Neplatný pôvod požiadavky.' }, { status: 403 });
    }
    try {
      const clientIp = trustedRateLimitClientIp(request.headers);
      if (await consumeSharedRateLimit('career-cv-token-address', clientIp, 12, 10 * 60_000)) {
        return NextResponse.json({ error: 'Príliš veľa pokusov o nahratie. Skúste to neskôr.' }, { status: 429 });
      }
    } catch (error) {
      console.error('Career CV token rate limit unavailable', error instanceof Error ? error.message : 'unknown');
      return NextResponse.json({ error: 'Nahrávanie životopisu je momentálne nedostupné.' }, { status: 503 });
    }
  } else if (eventType !== 'blob.upload-completed') {
    return NextResponse.json({ error: 'Neplatný typ požiadavky na nahratie.' }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let rawPayload: unknown;
        try { rawPayload = JSON.parse(clientPayload || 'null'); } catch { throw new UploadRequestError(400); }
        const parsed = payloadSchema.safeParse(rawPayload);
        if (!parsed.success || !validateCareerCvReservation({ ...parsed.data, pathname })) {
          throw new UploadRequestError(400);
        }
        const application = await getCareerApplicationBySubmissionId(parsed.data.submissionId);
        if (!application || !application.cvExpected || application.cv) {
          throw new UploadRequestError(409);
        }
        await reserveCareerCvUpload({ ...parsed.data, pathname });
        return {
          allowedContentTypes: [...careerCvUploadContentTypes],
          maximumSizeInBytes: maxCareerCvBytes,
          validUntil: Date.now() + 15 * 60_000,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ submissionId: parsed.data.submissionId, pathname }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const parsed = callbackPayloadSchema.safeParse(JSON.parse(tokenPayload || 'null'));
        if (!parsed.success || !isCareerCvUploadPath(parsed.data.submissionId, parsed.data.pathname) ||
            blob.pathname !== parsed.data.pathname || !privateBlobMatches(blob.url, parsed.data.pathname)) {
          throw new Error('Nahraný životopis sa nezhoduje so súkromnou rezerváciou.');
        }
        const stored = await head(blob.pathname);
        if (stored.pathname !== blob.pathname || !privateBlobMatches(stored.url, blob.pathname) ||
            !Number.isSafeInteger(stored.size) || stored.size <= 0 || stored.size > maxCareerCvBytes ||
            !careerCvUploadContentTypes.includes(stored.contentType as typeof careerCvUploadContentTypes[number])) {
          throw new Error('Súkromný životopis sa nepodarilo potvrdiť.');
        }
        if (!await markCareerCvUploadUploaded(parsed.data.submissionId, blob.pathname, stored.size)) {
          throw new Error('Nahraný životopis sa nezhoduje s rezervovanou veľkosťou.');
        }
      },
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Career CV upload token or callback failed', error instanceof Error ? error.message : 'unknown');
    // Blob retries failed signed completion callbacks; callers must not treat
    // callback delivery as proof that the private object is safely attached.
    return NextResponse.json({ error: 'Životopis sa nepodarilo pripraviť na nahratie.' },
      { status: eventType === 'blob.upload-completed' ? 500 : error instanceof UploadRequestError ? error.status : 503 });
  }
}
