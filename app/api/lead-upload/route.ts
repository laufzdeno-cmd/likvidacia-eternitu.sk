import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { allowedFileTypes, maxLeadFileSize } from '@/src/server/validation';

export const runtime = 'nodejs';

const uploadPayloadSchema = z.object({ submissionId: z.string().uuid() });
const uploadTokenWindowMs = 10 * 60_000;
const maxTokensPerWindow = 40;
const tokenBuckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function rateLimited(ip: string) {
  const now = Date.now();
  const bucket = tokenBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    tokenBuckets.set(ip, { count: 1, resetAt: now + uploadTokenWindowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > maxTokensPerWindow;
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
  if (!originAllowed(request)) return NextResponse.json({ error: 'Neplatný pôvod požiadavky.' }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Nahrávanie fotiek nie je momentálne dostupné.' }, { status: 503 });
  }
  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ error: 'Príliš veľa pokusov o nahratie. Skúste to o pár minút.' }, { status: 429 });
  }

  let body: HandleUploadBody;
  try {
    body = await request.json() as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: 'Neplatná požiadavka na nahratie.' }, { status: 400 });
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
        return {
          allowedContentTypes: [...allowedFileTypes],
          maximumSizeInBytes: maxLeadFileSize,
          validUntil: Date.now() + 15 * 60_000,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error('Lead photo upload token failed', error);
    return NextResponse.json({ error: 'Fotky sa nepodarilo pripraviť na nahratie.' }, { status: 400 });
  }
}
