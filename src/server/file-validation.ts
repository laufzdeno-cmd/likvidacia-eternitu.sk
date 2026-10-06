import sharp from 'sharp';
import { leadPhotoContentType } from '../lib/lead-photo-content-type';
import { allowedFileExtensions, allowedFileTypes, maxLeadFileSize } from './validation';

export const maxLeadPhotoPixels = 50_000_000;

function extension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/);
  return match?.[0] ?? '';
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function looksLikeHeic(bytes: Uint8Array) {
  if (bytes.length < 12 || ascii(bytes, 4, 8) !== 'ftyp') return false;
  const brand = ascii(bytes, 8, 12).toLowerCase();
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
}

type LeadFileInput = {
  name: string;
  size: number;
  type: string;
};

function leadContentType(file: LeadFileInput) {
  return leadPhotoContentType(file.name || '', file.type || '');
}

export function validateLeadFileMetadata(file: LeadFileInput) {
  const ext = extension(file.name || '');
  if (!allowedFileExtensions.has(ext)) {
    return 'Povolené sú iba JPG, JPEG, PNG alebo WEBP súbory. Fotku z iPhonu uložte ako JPG.';
  }
  if (file.size <= 0) return 'Nahraný súbor je prázdny.';
  if (file.size > maxLeadFileSize) {
    return 'Jeden súbor môže mať maximálne 10 MB.';
  }
  if (!allowedFileTypes.has(leadContentType(file))) {
    return 'Povolené sú iba JPG, JPEG, PNG alebo WEBP súbory. Fotku z iPhonu uložte ako JPG.';
  }
  return null;
}

export function validateLeadFileHeader(file: LeadFileInput, header: Uint8Array) {
  const contentType = leadContentType(file);
  const isJpeg = contentType === 'image/jpeg' && startsWith(header, [0xff, 0xd8, 0xff]);
  const isPng = contentType === 'image/png' && startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isWebp = contentType === 'image/webp' && ascii(header, 0, 4) === 'RIFF' && ascii(header, 8, 12) === 'WEBP';
  const isHeic = (contentType === 'image/heic' || contentType === 'image/heif') && looksLikeHeic(header);

  if (!isJpeg && !isPng && !isWebp && !isHeic) {
    return 'Súbor nevyzerá ako povolený typ. Skúste nahrať fotku vo formáte JPG, JPEG, PNG alebo WEBP.';
  }
  return null;
}

function completeLeadImageContainer(file: LeadFileInput, bytes: Uint8Array) {
  const contentType = leadContentType(file);
  if (contentType === 'image/png') {
    const iend = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
    return bytes.length >= 20 && startsWith(bytes.subarray(bytes.length - iend.length), iend);
  }
  if (contentType === 'image/jpeg') {
    return bytes.length >= 4 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }
  if (contentType === 'image/webp') {
    if (bytes.length < 12) return false;
    const declaredSize = new DataView(bytes.buffer, bytes.byteOffset + 4, 4).getUint32(0, true);
    return declaredSize + 8 === bytes.length;
  }
  return true;
}

export function collectSubmittedLeadPhotos(entries: FormDataEntryValue[]) {
  const files: File[] = [];
  for (const entry of entries) {
    if (!(entry instanceof File)) {
      return { files: [], error: 'Fotky sa nepodarilo spracovať. Vyberte ich prosím znova.' };
    }
    // Browsers submit one nameless, empty File when an optional file input is untouched.
    if (entry.name === '' && entry.size === 0) continue;
    files.push(entry);
  }
  return { files, error: null };
}

export function detectLeadFileContentType(header: Uint8Array): string | null {
  if (startsWith(header, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (ascii(header, 0, 4) === 'RIFF' && ascii(header, 8, 12) === 'WEBP') return 'image/webp';
  if (looksLikeHeic(header)) {
    const brand = ascii(header, 8, 12).toLowerCase();
    return brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx' ? 'image/heic' : 'image/heif';
  }
  return null;
}

export async function validateLeadImageBytes(file: LeadFileInput, bytes: Uint8Array) {
  const metadataError = validateLeadFileMetadata(file);
  if (metadataError) return metadataError;
  if (bytes.byteLength !== file.size) return 'Fotografia sa nepreniesla celá. Vyberte ju prosím znova.';
  const headerError = validateLeadFileHeader(file, bytes.subarray(0, 32));
  if (headerError) return headerError;
  if (!completeLeadImageContainer(file, bytes)) {
    return 'Fotografia je poškodená alebo sa nedá otvoriť. Skúste inú fotku vo formáte JPG alebo PNG.';
  }
  const source = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(source, { failOn: 'error', sequentialRead: true }).metadata();
  } catch {
    return 'Fotografiu sa nepodarilo prečítať. Skúste ju uložiť ako JPG alebo PNG.';
  }
  if (!metadata.width || !metadata.height) return 'Fotografii sa nepodarilo zistiť rozmery. Vyberte ju prosím znova.';
  if (metadata.width * metadata.height > maxLeadPhotoPixels) {
    return 'Fotografia má viac ako 50 megapixelov. Pred nahratím ju zmenšite alebo vyberte menší záber.';
  }
  try {
    await sharp(source, { limitInputPixels: maxLeadPhotoPixels, failOn: 'error', sequentialRead: true }).stats();
  } catch {
    return 'Fotografia je poškodená alebo sa nedá otvoriť. Skúste inú fotku vo formáte JPG alebo PNG.';
  }
  return null;
}

export async function validateUploadedLeadFile(file: File) {
  const metadataError = validateLeadFileMetadata(file);
  if (metadataError) return metadataError;
  return validateLeadImageBytes(file, new Uint8Array(await file.arrayBuffer()));
}

export async function validateCareerCvFile(file: File) {
  const ext = extension(file.name || '');
  if (!['.pdf', '.doc', '.docx'].includes(ext)) return 'Životopis môžete priložiť iba vo formáte PDF, DOC alebo DOCX.';
  if (file.size <= 0) return 'Priložený životopis je prázdny.';
  if (file.size > 5 * 1024 * 1024) return 'Životopis môže mať maximálne 5 MB.';

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const pdf = ext === '.pdf' && ascii(header, 0, 5) === '%PDF-';
  const doc = ext === '.doc' && startsWith(header, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const docx = ext === '.docx' && startsWith(header, [0x50, 0x4b, 0x03, 0x04]);
  if (!pdf && !doc && !docx) return 'Priložený súbor nemá platný formát PDF, DOC alebo DOCX.';
  return null;
}
