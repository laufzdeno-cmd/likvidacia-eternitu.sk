import sharp from 'sharp';
import { maxIntakePhotoPixels } from './photo-intake-limits.mjs';

const maxPhotoBytes = 20 * 1024 * 1024;

export async function normalizePrivatePhoto(bytes: Uint8Array) {
  if (bytes.byteLength <= 0 || bytes.byteLength > maxPhotoBytes) throw new Error('Neplatná veľkosť fotografie.');
  const source = Buffer.from(bytes);
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(source, {
      failOn: 'error',
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new Error('Fotografiu sa nepodarilo prečítať. Skúste ju uložiť ako JPG alebo PNG.');
  }
  if (!metadata.width || !metadata.height) throw new Error('Fotografii sa nepodarilo zistiť rozmery. Skúste ju uložiť ako JPG alebo PNG.');
  if (metadata.width * metadata.height > maxIntakePhotoPixels) {
    throw new Error('Fotografia má viac ako 25 megapixelov. Pred nahratím ju zmenšite alebo vyberte menší záber.');
  }
  const input = sharp(source, {
    limitInputPixels: maxIntakePhotoPixels,
    failOn: 'error',
    sequentialRead: true,
  });
  const normalized = await input
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  if (!normalized.length) throw new Error('Fotografia sa nepodarila dekódovať.');
  return normalized;
}

export async function prepareSanitizedPrivatePhoto(
  bytes: Uint8Array,
  alreadySanitized: boolean,
  persist: (sanitized: Buffer) => Promise<void>,
) {
  if (alreadySanitized) return Buffer.from(bytes);
  const sanitized = await normalizePrivatePhoto(bytes);
  await persist(sanitized);
  return sanitized;
}
