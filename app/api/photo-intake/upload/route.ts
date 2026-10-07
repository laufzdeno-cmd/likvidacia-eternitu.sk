import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPhotoIntakeRecord, getActivePhotoUploadInvite, getPhotoIntakeRecord, markPhotoIntakeUploadTokenIssued } from '@/src/server/db';
import { currentPhotoUploadInvite } from '@/src/server/photo-intake-auth';
import { allowedIntakePhotoTypes, maxIntakePhotoBytes, safePhotoName } from '@/src/server/photo-intake-policy';
import { privatePhotoIntakeBlobToken, privatePhotoIntakeEnabled } from '@/src/server/photo-intake-config';

export const runtime = 'nodejs';

const payloadSchema = z.object({
  mediaId: z.string().uuid(),
  originalName: z.string().trim().min(1).max(240),
  contentType: z.enum(allowedIntakePhotoTypes),
});

const extensions = new Set(['jpg', 'jpeg', 'png', 'webp']);

function parsePayload(value: string | null | undefined) {
  return payloadSchema.parse(value ? JSON.parse(value) : null);
}

function expectedPath(pathname: string, inviteId: string, mediaId: string) {
  const match = /^crew-intake\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.([a-z0-9]+)$/i.exec(pathname);
  return Boolean(match && match[1].toLowerCase() === inviteId.toLowerCase()
    && match[2].toLowerCase() === mediaId.toLowerCase() && extensions.has(match[3].toLowerCase()));
}

export async function POST(request: NextRequest) {
  let body: HandleUploadBody;
  try {
    body = await request.json() as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: 'Neplatná požiadavka na nahratie.' }, { status: 400 });
  }
  const uploadType = (body as { type?: string }).type;
  if (uploadType === 'blob.generate-client-token') {
    if (!privatePhotoIntakeEnabled()) return NextResponse.json({ error: 'Súkromné nahrávanie ešte nie je zapnuté.' }, { status: 503 });
    if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Neplatný pôvod požiadavky.' }, { status: 403 });
  } else if (uploadType !== 'blob.upload-completed') {
    return NextResponse.json({ error: 'Neplatný typ požiadavky na nahratie.' }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      token: privatePhotoIntakeBlobToken(),
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const invite = await currentPhotoUploadInvite();
        if (!invite) throw new Error('Relácia nahrávania už nie je platná.');
        const payload = parsePayload(clientPayload);
        if (!expectedPath(pathname, invite.id, payload.mediaId)) throw new Error('Cesta k fotografii nepatrí tejto pozvánke.');
        const extension = payload.originalName.split('.').pop()?.toLowerCase() || '';
        if (!extensions.has(extension)) throw new Error('Tento formát fotografie nie je podporovaný.');
        const storageKey = pathname;
        const prior = await getPhotoIntakeRecord(payload.mediaId, invite.id);
        if (!prior) {
          await createPhotoIntakeRecord({
            id: payload.mediaId,
            inviteId: invite.id,
            storageKey,
            originalName: safePhotoName(payload.originalName),
          });
        } else if (prior.storageKey !== storageKey || prior.status !== 'pending_upload') {
          throw new Error('Táto fotografia už bola spracovaná alebo rezervovaná.');
        }
        if (!await markPhotoIntakeUploadTokenIssued(payload.mediaId, invite.id, storageKey)) {
          throw new Error('Rezervácia už nie je aktívna a nový token sa nevydá.');
        }
        return {
          allowedContentTypes: [payload.contentType],
          maximumSizeInBytes: maxIntakePhotoBytes,
          validUntil: Math.min(Date.now() + 10 * 60_000, new Date(invite.expiresAt).getTime()),
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ inviteId: invite.id, mediaId: payload.mediaId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = z.object({ inviteId: z.string().uuid(), mediaId: z.string().uuid() }).parse(JSON.parse(tokenPayload || '{}'));
        if (!expectedPath(blob.pathname, payload.inviteId, payload.mediaId)) throw new Error('Dokončený upload sa nezhoduje s rezerváciou.');
        const [invite, record] = await Promise.all([
          getActivePhotoUploadInvite(payload.inviteId),
          getPhotoIntakeRecord(payload.mediaId, payload.inviteId),
        ]);
        // This callback may be delayed or retried. It must never delete the Blob
        // based on a stale DB snapshot; retention first claims the row atomically.
        if (!privatePhotoIntakeEnabled() || !invite || !record || record.storageKey !== blob.pathname
          || !['pending_upload', 'pending_review'].includes(record.status)) {
          throw new Error('Pozvánka alebo rezervácia už nie je aktívna. Súkromný objekt zostáva v bezpečnej retenčnej fronte.');
        }
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    // The message may contain a private pathname or provider response. Keep
    // logs and the public response deliberately free of storage identifiers.
    console.error('Photo intake upload request rejected.', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Fotografiu sa nepodarilo pripraviť na nahratie.' }, { status: 400 });
  }
}
