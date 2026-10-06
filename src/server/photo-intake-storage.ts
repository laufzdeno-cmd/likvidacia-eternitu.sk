import { get } from '@vercel/blob';
import { maxIntakePhotoBytes } from './photo-intake-policy';
import { privatePhotoIntakeBlobToken } from './photo-intake-config';

export class PhotoIntakeSourceMissingError extends Error {
  constructor() {
    super('Súkromná fotografia sa nenašla.');
  }
}

export async function readPrivateIntakePhoto(storageKey: string) {
  const result = await get(storageKey, { access: 'private', useCache: false, token: privatePhotoIntakeBlobToken() });
  if (!result) throw new PhotoIntakeSourceMissingError();
  if (result.statusCode !== 200 || !result.stream) throw new Error('Súkromnú fotografiu sa nepodarilo načítať.');

  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      length += value.byteLength;
      if (length > maxIntakePhotoBytes) {
        await reader.cancel();
        throw new Error('Fotografia presahuje povolenú veľkosť.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}
