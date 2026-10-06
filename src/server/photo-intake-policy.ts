import { maxIntakePhotoPixels } from './photo-intake-limits.mjs';

export { maxIntakePhotoPixels };

export const photoCategories = [
  'family_house',
  'outbuilding',
  'garage',
  'illegal_dump',
  'interior',
] as const;

export type PhotoCategory = (typeof photoCategories)[number];

export const maxIntakePhotoBytes = 20 * 1024 * 1024;
export const maxIntakePhotosPerInvite = 40;
export const photoIntakeRetentionDays = {
  pendingUpload: 1,
  pendingReview: 30,
  approvedPrivate: 180,
  rejected: 7,
  deletionRetry: 1,
} as const;
export const allowedIntakePhotoTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function isPhotoCategory(value: string): value is PhotoCategory {
  return (photoCategories as readonly string[]).includes(value);
}

export function isApproximateLocality(value: string) {
  const locality = value.trim();
  if (locality.length < 2 || locality.length > 120) return false;
  // A locality is for an anonymized case-study/map, never a street address.
  if (/\d/.test(locality)) return false;
  return !/(?:^|\s)(?:ul\.?|ulica|námestie|nám\.?|súpisné číslo|číslo domu)(?:\s|$)/iu.test(locality);
}

export function isPublishableRealizationLocality(value: string, precision: 'none' | 'municipality' | 'district') {
  const locality = value.trim();
  if (precision === 'none') return locality.length === 0;
  return isApproximateLocality(locality);
}

export function safePhotoName(value: string) {
  const name = value
    .replace(/[\\/\0-\x1f\x7f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return name || 'fotografia';
}

export function verifiedImageMime(bytes: Uint8Array): (typeof allowedIntakePhotoTypes)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}
