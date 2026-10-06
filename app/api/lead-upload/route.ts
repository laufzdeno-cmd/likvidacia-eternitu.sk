import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { consumeApiRateLimit, markLeadUploadDraftUploaded, reserveLeadUploadDraft } from '@/src/server/db';
import { allowedFileTypes, maxLeadFileSize } from '@/src/server/validation';
import { isValidLeadSubmissionId } from '@/src/lib/lead-submission-id.mjs';

export const runtime = 'nodejs';

const uploadPayloadSchema = z.object({
  submissionId: z.string().uuid().refine(isValidLeadSubmissionId),
  replacesPathname: z.string().trim().max(512).optional(),
  replacesPathnames: z.array(z.string().trim().max(512)).max(128).optional(),
  fileFingerprint: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});
const uploadTokenWindowMs = 10 * 60_000;
const maxTokensPerWindow = 40;

function clientIp(request: NextRequest) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && isIP(realIp)) return realIp;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').map((value) => value.trim()).filter(Boolean);
  const proxyIp = forwarded?.at(-1);
  return proxyIp && isIP(proxyIp) ? proxyIp : 'unknown';
}

async function rateLimited(request: NextRequest) {
  const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-dev-auth-secret-change-me');
  if (!secret) throw new Error('AUTH_SECRET is required for upload-token rate limiting.');
  const now = Date.now();
  const windowStartedAt = new Date(Math.floor(now / uploadTokenWindowMs) * uploadTokenWindowMs);
  const key = createHmac('sha256', secret).update(`lead-upload:${clientIp(request)}`).digest('hex');
  return consumeApiRateLimit(key, windowStartedAt, maxTokensPerWindow);
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) return true;
  if (process.env.VERCEL_ENV !== 'preview') return false;
  const previewOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .filter(Boolean)
    .map((host) => `https://${host}`);
  return previewOrigins.includes(origin);
}

function isExpectedPath(pathname: string, submissionId: string) {
  const prefix = `lead-drafts/${submissionId}/`;
  if (!pathname.startsWith(prefix)) return false;
  const filename = pathname.slice(prefix.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|heic|heif)$/i.test(filename);
}

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Nahrávanie fotiek nie je momentálne dostupné.' }, { status: 503 });
  }
  let body: HandleUploadBody;
  try {
    body = await request.json() as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: 'Neplatná požiadavka na nahratie.' }, { status: 400 });
  }

  const uploadType = (body as { type?: string }).type;
  if (uploadType === 'blob.generate-client-token') {
    if (!request.headers.get('origin') || !originAllowed(request)) {
      return NextResponse.json({ error: 'Neplatný pôvod požiadavky.' }, { status: 403 });
    }
    try {
      if (await rateLimited(request)) {
        return NextResponse.json({ error: 'Príliš veľa pokusov o nahratie. Skúste to o pár minút.' }, { status: 429 });
      }
    } catch (error) {
      console.error('Lead photo upload rate limit unavailable', error);
      return NextResponse.json({ error: 'Nahrávanie fotiek je momentálne nedostupné.' }, { status: 503 });
    }
  } else if (uploadType !== 'blob.upload-completed') {
    return NextResponse.json({ error: 'Neplatný typ požiadavky na nahratie.' }, { status: 400 });
  }

  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: z.infer<typeof uploadPayloadSchema>;
        try {
          payload = uploadPayloadSchema.parse(clientPayload ? JSON.parse(clientPayload) : null);
        } catch {
          throw new Error('Neplatná požiadavka na nahratie.');
        }
        if (!isExpectedPath(pathname, payload.submissionId)) throw new Error('Neplatná cesta pre fotku.');
        const predecessors = [...new Set([payload.replacesPathname, ...(payload.replacesPathnames || [])].filter((value): value is string => Boolean(value)))];
        for (const predecessor of predecessors) {
          if (!isExpectedPath(predecessor, payload.submissionId)) throw new Error('Neplatná cesta predchádzajúcej fotky.');
        }
        await reserveLeadUploadDraft(payload.submissionId, pathname, predecessors, 'vercel_blob', payload.fileFingerprint);
        return {
          allowedContentTypes: [...allowedFileTypes],
          maximumSizeInBytes: maxLeadFileSize,
          validUntil: Date.now() + 15 * 60_000,
          addRandomSuffix: false,
          // Every upload attempt gets a unique path. Signed upload URLs can never overwrite an accepted attachment.
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ submissionId: payload.submissionId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = uploadPayloadSchema.parse(JSON.parse(tokenPayload || '{}'));
        if (!isExpectedPath(blob.pathname, payload.submissionId)) throw new Error('Dokončená fotografia sa nezhoduje s rezerváciou.');
        await markLeadUploadDraftUploaded(payload.submissionId, blob.pathname);
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error('Lead photo upload token failed', error);
    return NextResponse.json({ error: 'Fotky sa nepodarilo pripraviť na nahratie.' }, { status: 400 });
  }
}
