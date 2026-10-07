import { NextResponse } from 'next/server';
import { getPublishedRealizationCasePhoto } from '@/src/server/db';
import { consumeSharedRateLimit, trustedRateLimitClientIp } from '@/src/server/shared-rate-limit';
import { privatePhotoIntakeStorageReady } from '@/src/server/photo-intake-config';
import { verifiedImageMime } from '@/src/server/photo-intake-policy';
import { readPrivateIntakePhoto } from '@/src/server/photo-intake-storage';
import { getPublicRealizationPhotoVariant, parsePublicRealizationImageWidth, PublicRealizationMediaBusyError } from '@/src/server/public-realization-case-media';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Nenájdené', { status: 404 });
  if (!privatePhotoIntakeStorageReady()) return new NextResponse('Nedostupné', { status: 503 });
  const width = parsePublicRealizationImageWidth(request.url);
  if (width === undefined) {
    return new NextResponse('Neplatná veľkosť', { status: 400 });
  }

  try {
    if (await consumeSharedRateLimit(
      'public-realization-image',
      trustedRateLimitClientIp(request.headers),
      120,
      60_000,
    )) {
      return new NextResponse('Príliš veľa požiadaviek', {
        status: 429,
        headers: { 'Cache-Control': 'no-store, max-age=0', 'Retry-After': '60' },
      });
    }
    const photo = await getPublishedRealizationCasePhoto(id);
    if (!photo || !photo.storageKey.startsWith(`photo-intake/sanitized/${id}/`)) {
      return new NextResponse('Nenájdené', { status: 404 });
    }
    const loadVerifiedSource = async () => {
      const bytes = await readPrivateIntakePhoto(photo.storageKey);
      if (verifiedImageMime(bytes) !== 'image/jpeg') throw new TypeError('invalid-public-photo-mime');
      return bytes;
    };
    const responseBytes = width === null
      ? await loadVerifiedSource()
      : await getPublicRealizationPhotoVariant(photo.storageKey, width, loadVerifiedSource);
    return new NextResponse(new Uint8Array(responseBytes), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(responseBytes.byteLength),
        'Content-Disposition': `inline; filename="realizacia-${id}.jpg"`,
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    if (error instanceof PublicRealizationMediaBusyError) {
      return new NextResponse('Obrázok sa pripravuje, skúste to znova', {
        status: 503,
        headers: { 'Cache-Control': 'no-store, max-age=0', 'Retry-After': '1' },
      });
    }
    if (error instanceof TypeError && error.message === 'invalid-public-photo-mime') {
      return new NextResponse('Súbor sa nedá bezpečne zobraziť', { status: 415 });
    }
    return new NextResponse('Fotografiu sa nepodarilo načítať', { status: 503 });
  }
}
