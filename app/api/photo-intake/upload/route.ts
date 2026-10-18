import { issueSignedToken, presignUrl } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPhotoIntakeRecord, getPhotoIntakeRecord, markPhotoIntakeUploadTokenIssued } from '@/src/server/db';
import { currentPhotoUploadInvite } from '@/src/server/photo-intake-auth';
import { allowedIntakePhotoTypes, maxIntakePhotoBytes, safePhotoName } from '@/src/server/photo-intake-policy';
import { privatePhotoIntakeBlobOptions, privatePhotoIntakeEnabled } from '@/src/server/photo-intake-config';

export const runtime = 'nodejs';

const payloadSchema = z.object({
  pathname: z.string().trim().min(1).max(500),
  mediaId: z.string().uuid(),
  originalName: z.string().trim().min(1).max(240),
  contentType: z.enum(allowedIntakePhotoTypes),
});

const extensions = new Set(['jpg', 'jpeg', 'png', 'webp']);

function expectedPath(pathname: string, inviteId: string, mediaId: string) {
  const match = /^crew-intake\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.([a-z0-9]+)$/i.exec(pathname);
  return Boolean(match && match[1].toLowerCase() === inviteId.toLowerCase()
    && match[2].toLowerCase() === mediaId.toLowerCase() && extensions.has(match[3].toLowerCase()));
}

export async function POST(request: NextRequest) {
  if (!privatePhotoIntakeEnabled()) return NextResponse.json({ error: 'Súkromné nahrávanie ešte nie je zapnuté.' }, { status: 503 });
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Neplatný pôvod požiadavky.' }, { status: 403 });

  try {
    const payload = payloadSchema.parse(await request.json());
    const invite = await currentPhotoUploadInvite();
    if (!invite) throw new Error('Relácia nahrávania už nie je platná.');
    if (!expectedPath(payload.pathname, invite.id, payload.mediaId)) throw new Error('Cesta k fotografii nepatrí tejto pozvánke.');
    const extension = payload.originalName.split('.').pop()?.toLowerCase() || '';
    if (!extensions.has(extension)) throw new Error('Tento formát fotografie nie je podporovaný.');
    const storageKey = payload.pathname;
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
    const validUntil = Math.min(Date.now() + 10 * 60_000, new Date(invite.expiresAt).getTime());
    if (validUntil <= Date.now()) throw new Error('Relácia nahrávania už vypršala.');
    const token = await issueSignedToken({
      ...privatePhotoIntakeBlobOptions(),
      pathname: storageKey,
      operations: ['put'],
      allowedContentTypes: [payload.contentType],
      maximumSizeInBytes: maxIntakePhotoBytes,
      validUntil,
    });
    const { presignedUrl } = await presignUrl(token, {
      operation: 'put',
      pathname: storageKey,
      access: 'private',
      allowedContentTypes: [payload.contentType],
      maximumSizeInBytes: maxIntakePhotoBytes,
      validUntil,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    if (!await markPhotoIntakeUploadTokenIssued(payload.mediaId, invite.id, storageKey)) {
      throw new Error('Rezervácia už nie je aktívna a nový odkaz sa nevydá.');
    }
    return NextResponse.json({ presignedUrl, validUntil }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // The message may contain a private pathname or provider response. Keep
    // logs and the public response deliberately free of storage identifiers.
    console.error('Photo intake upload request rejected.', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Fotografiu sa nepodarilo pripraviť na nahratie.' }, { status: 400 });
  }
}
