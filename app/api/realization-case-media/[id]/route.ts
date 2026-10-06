import { NextResponse } from 'next/server';
import { getPublishedRealizationCasePhoto } from '@/src/server/db';
import { privatePhotoIntakeStorageReady } from '@/src/server/photo-intake-config';
import { verifiedImageMime } from '@/src/server/photo-intake-policy';
import { readPrivateIntakePhoto } from '@/src/server/photo-intake-storage';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Nenájdené', { status: 404 });
  if (!privatePhotoIntakeStorageReady()) return new NextResponse('Nedostupné', { status: 503 });

  try {
    const photo = await getPublishedRealizationCasePhoto(id);
    if (!photo || !photo.storageKey.startsWith(`photo-intake/sanitized/${id}/`)) {
      return new NextResponse('Nenájdené', { status: 404 });
    }
    const bytes = await readPrivateIntakePhoto(photo.storageKey);
    if (verifiedImageMime(bytes) !== 'image/jpeg') return new NextResponse('Súbor sa nedá bezpečne zobraziť', { status: 415 });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `inline; filename="realizacia-${id}.jpg"`,
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return new NextResponse('Fotografiu sa nepodarilo načítať', { status: 503 });
  }
}
