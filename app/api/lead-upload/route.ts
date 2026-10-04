import { BlobNotFoundError, head, issueSignedToken, presignUrl } from '@vercel/blob';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  confirmLeadUploadDraft,
  consumeLeadUploadRateLimit,
  reserveLeadUploadDraft,
} from '@/src/server/db';
import { allowedFileTypes, maxLeadFileSize } from '@/src/server/validation';

export const runtime = 'nodejs';

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'] as const;
const uploadRequestSchema = z.object({
  action: z.enum(['prepare', 'confirm']),
  submissionId: z.string().uuid(),
  fileId: z.string().uuid(),
  extension: z.enum(allowedExtensions),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  sizeBytes: z.number().int().positive().max(maxLeadFileSize),
}).strict();
const uploadTokenWindowMs = 10 * 60_000;
const maxRequestsPerWindow = 48;
const signedUploadLifetimeMs = 5 * 60_000;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function clientIp(request: NextRequest) {
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for')
    ?.split(',')
    .map((value) => value.trim())
    .find((value) => isIP(value));
  if (vercelForwarded) return vercelForwarded;
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && isIP(realIp)) return realIp;
  const forwarded = request.headers.get('x-forwarded-for')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const clientIpValue = forwarded?.find((value) => isIP(value));
  return clientIpValue || 'unknown';
}

async function rateLimited(request: NextRequest) {
  const secret = process.env.BLOB_READ_WRITE_TOKEN || '';
  if (!secret) throw new Error('Súkromné úložisko nie je nastavené.');
  const bucketStart = new Date(Math.floor(Date.now() / uploadTokenWindowMs) * uploadTokenWindowMs);
  const bucketKey = createHmac('sha256', secret)
    .update(`lead-upload:${clientIp(request)}`)
    .digest('hex');
  return consumeLeadUploadRateLimit(bucketKey, bucketStart, maxRequestsPerWindow);
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  if (origin === request.nextUrl.origin) return true;
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

function extensionMatchesContentType(
  extension: typeof allowedExtensions[number],
  contentType: z.infer<typeof uploadRequestSchema>['contentType'],
) {
  if (extension === '.jpg' || extension === '.jpeg') return contentType === 'image/jpeg';
  if (extension === '.png') return contentType === 'image/png';
  if (extension === '.webp') return contentType === 'image/webp';
  return contentType === 'image/heic' || contentType === 'image/heif';
}

function privateUploadHeaders(contentType: string) {
  return {
    'Content-Type': contentType,
    'x-content-type': contentType,
    'x-vercel-blob-access': 'private',
    'x-add-random-suffix': '0',
    'x-allow-overwrite': '0',
    'x-cache-control-max-age': '60',
  };
}

async function confirmExistingUpload(input: {
  submissionId: string;
  fileId: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
}) {
  const existing = await head(input.storageKey);
  if (existing.pathname !== input.storageKey
    || existing.size !== input.sizeBytes
    || existing.contentType !== input.contentType) {
    throw new Error('Nahraná fotka sa nezhoduje s vybraným súborom.');
  }
  await confirmLeadUploadDraft({
    submissionId: input.submissionId,
    clientFileId: input.fileId,
    storageKey: input.storageKey,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    blobEtag: existing.etag,
  });
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return json({ error: 'Neplatný pôvod požiadavky.' }, 403);
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.DATABASE_URL) {
    return json({ error: 'Nahrávanie fotiek nie je momentálne dostupné.' }, 503);
  }
  try {
    if (await rateLimited(request)) {
      return json({ error: 'Príliš veľa pokusov o nahratie. Skúste to o pár minút.' }, 429);
    }
  } catch {
    return json({ error: 'Nahrávanie fotiek nie je momentálne dostupné.' }, 503);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'Neplatná požiadavka na nahratie.' }, 400);
  }
  if (rawBody && typeof rawBody === 'object' && 'type' in rawBody) {
    return json({ error: 'Stránka bola aktualizovaná. Obnovte ju a priložte fotky znova.' }, 409);
  }

  const parsed = uploadRequestSchema.safeParse(rawBody);
  if (!parsed.success) return json({ error: 'Neplatná požiadavka na nahratie.' }, 400);
  if (!allowedFileTypes.has(parsed.data.contentType)
    || !extensionMatchesContentType(parsed.data.extension, parsed.data.contentType)) {
    return json({ error: 'Prípona fotky nezodpovedá jej formátu.' }, 400);
  }

  const { action, submissionId, fileId, extension, contentType, sizeBytes } = parsed.data;
  try {
    const reservation = await reserveLeadUploadDraft({
      submissionId,
      clientFileId: fileId,
      extension,
      contentType,
      sizeBytes,
    });
    const pathname = reservation.storageKey;

    try {
      await confirmExistingUpload({ submissionId, fileId, storageKey: pathname, contentType, sizeBytes });
      return json({ ok: true, uploaded: true, pathname });
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error;
      if (action === 'confirm') {
        return json({ error: 'Nahraná fotka sa ešte nenašla. Skúste odoslanie znova.' }, 409);
      }
    }

    const validUntil = Date.now() + signedUploadLifetimeMs;
    const signedToken = await issueSignedToken({
      pathname,
      operations: ['put'],
      validUntil,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: sizeBytes,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      access: 'private',
      operation: 'put',
      pathname,
      validUntil,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: sizeBytes,
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 60,
    });

    return json({
      ok: true,
      uploaded: false,
      pathname,
      presignedUrl,
      uploadHeaders: privateUploadHeaders(contentType),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const safeMessage = /fotk|súbor|príloh|nahr/.test(message.toLowerCase())
      ? message
      : 'Fotky sa nepodarilo pripraviť na nahratie.';
    console.error('Lead private photo upload preparation failed', error instanceof Error ? error.name : 'unknown');
    return json({ error: safeMessage }, 400);
  }
}
