import { createHash } from 'node:crypto';
import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { abandonPhotoIntakeSanitizationAttempt, completePhotoIntakeRecord, reservePhotoIntakeSanitizationAttempt } from '@/src/server/db';
import { currentPhotoUploadInvite } from '@/src/server/photo-intake-auth';
import { isApproximateLocality, isPhotoCategory, verifiedImageMime } from '@/src/server/photo-intake-policy';
import { privatePhotoIntakeBlobToken, privatePhotoIntakeEnabled } from '@/src/server/photo-intake-config';
import { PhotoIntakeSourceMissingError, readPrivateIntakePhoto } from '@/src/server/photo-intake-storage';
import { prepareSanitizedPrivatePhoto } from '@/src/server/photo-intake-image';

export const runtime = 'nodejs';
export const maxDuration = 60;

const payloadSchema = z.object({
  mediaId: z.string().uuid(),
  contentType: z.string().max(80),
  locality: z.string().trim().max(120).default(''),
  categories: z.array(z.string().max(40)).max(5).default([]),
  expectedMetadataVersion: z.number().int().positive().default(1),
});

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Neplatný pôvod požiadavky.' }, { status: 403 });
  if (!privatePhotoIntakeEnabled()) return NextResponse.json({ error: 'Súkromné nahrávanie ešte nie je zapnuté.' }, { status: 503 });
  const invite = await currentPhotoUploadInvite();
  if (!invite) return NextResponse.json({ error: 'Nahrávacia relácia už nie je platná.' }, { status: 401 });

  try {
    const payload = payloadSchema.parse(await request.json());
    if (payload.locality && !isApproximateLocality(payload.locality)) return NextResponse.json({ error: 'Uveďte iba obec alebo širšiu oblasť, bez ulice a čísla domu.' }, { status: 400 });
    if (payload.categories.some((item) => !isPhotoCategory(item)) || new Set(payload.categories).size !== payload.categories.length) {
      return NextResponse.json({ error: 'Vyberte iba ponúknuté typy objektov.' }, { status: 400 });
    }
    const attempt = await reservePhotoIntakeSanitizationAttempt(payload.mediaId, invite.id);
    if (!attempt) return NextResponse.json({ error: 'Fotografia sa už bezpečne spracúva alebo jej nahrávacia relácia vypršala. Obnovte stránku a skúste to znova.' }, { status: 409 });
    try {
      const bytes = await readPrivateIntakePhoto(attempt.sourceStorageKey);
      const actualMime = verifiedImageMime(bytes);
      if (!actualMime) throw new Error('PHOTO_INTAKE_UNSUPPORTED_FORMAT');
      const sanitized = await prepareSanitizedPrivatePhoto(bytes, Boolean(attempt.sanitizedAt && actualMime === 'image/jpeg'), async () => undefined);
      // Every attempt gets its own private object key. A lost DB connection or
      // late request can never recreate the source key after retention removes it.
      await put(attempt.targetStorageKey, sanitized, {
        access: 'private',
        token: privatePhotoIntakeBlobToken(),
        contentType: 'image/jpeg',
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      const completed = await completePhotoIntakeRecord({
        id: payload.mediaId,
        inviteId: invite.id,
        storageKey: attempt.sourceStorageKey,
        targetStorageKey: attempt.targetStorageKey,
        sanitizationAttemptId: attempt.id,
        mimeType: 'image/jpeg',
        sizeBytes: sanitized.byteLength,
        contentHash: createHash('sha256').update(sanitized).digest('hex'),
        locality: payload.locality,
        categories: payload.categories,
        expectedMetadataVersion: payload.expectedMetadataVersion,
      });
      if (!completed) return NextResponse.json({ error: 'Fotografiu sa nepodarilo potvrdiť. Obnovte stránku a skúste to znova.' }, { status: 409 });
      return NextResponse.json({ ok: true, status: completed.status, metadataVersion: completed.metadataVersion });
    } finally {
      await abandonPhotoIntakeSanitizationAttempt(attempt.id);
    }
  } catch (error) {
    if (error instanceof PhotoIntakeSourceMissingError) {
      return NextResponse.json({ error: 'Súkromná fotografia sa nenašla. Nahratie môžete bezpečne zopakovať.' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'PHOTO_INTAKE_UNSUPPORTED_FORMAT') {
      return NextResponse.json({ error: 'Obsah fotografie nezodpovedá deklarovanému formátu. Skúste ju uložiť ako JPG alebo PNG.' }, { status: 415 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Potvrdenie fotografie zlyhalo.' }, { status: 400 });
  }
}
