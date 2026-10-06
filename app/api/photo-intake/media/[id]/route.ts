import { NextRequest, NextResponse } from 'next/server';
import { currentAdminUser } from '@/src/server/auth';
import { getPhotoIntakeRecord } from '@/src/server/db';
import { currentPhotoUploadInvite } from '@/src/server/photo-intake-auth';
import { verifiedImageMime } from '@/src/server/photo-intake-policy';
import { privatePhotoIntakeEnabled, privatePhotoIntakeStorageReady } from '@/src/server/photo-intake-config';
import { readPrivateIntakePhoto } from '@/src/server/photo-intake-storage';
import { normalizePrivatePhoto } from '@/src/server/photo-intake-image';
import { loadAuthorizedPhotoMedia } from '@/src/server/photo-intake-media-access';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Nenájdené', { status: 404 });

  const [invite, admin] = await Promise.all([currentPhotoUploadInvite(), currentAdminUser()]);
  try {
    const result = await loadAuthorizedPhotoMedia({
      admin,
      hasInvite: Boolean(invite),
      inviteId: invite?.id ?? null,
      intakeEnabled: privatePhotoIntakeEnabled(),
      storageReady: privatePhotoIntakeStorageReady(),
      photoId: id,
      lookupRecord: getPhotoIntakeRecord,
      readPrivateBlob: readPrivateIntakePhoto,
    });
    if (result.status !== 200) {
      const message = result.status === 401 ? 'Neprihlásené'
        : result.status === 403 ? 'Zakázané'
          : result.status === 404 ? 'Nenájdené' : 'Nedostupné';
      return new NextResponse(message, { status: result.status });
    }

    const { record, bytes } = result;
    const mime = verifiedImageMime(bytes);
    if (!mime || mime !== record.mimeType) return new NextResponse('Súbor sa nedá bezpečne zobraziť', { status: 415 });
    const normalized = await normalizePrivatePhoto(bytes);
    return new NextResponse(new Uint8Array(normalized), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(normalized.byteLength),
        'Content-Disposition': `inline; filename="photo-${record.id}.jpg"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return new NextResponse('Súkromnú fotografiu sa nepodarilo načítať', { status: 503 });
  }
}
