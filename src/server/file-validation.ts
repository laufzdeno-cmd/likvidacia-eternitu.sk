import { allowedFileExtensions, allowedFileTypes, maxLeadFileSize } from './validation';

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

function fallbackTypeFromExtension(ext: string) {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.heic':
      return 'image/heic';
    case '.heif':
      return 'image/heif';
    case '.pdf':
      return 'application/pdf';
    default:
      return '';
  }
}

export async function validateUploadedLeadFile(file: File) {
  const ext = extension(file.name || '');
  if (!allowedFileExtensions.has(ext)) {
    return 'Povolené sú iba JPG, PNG, WEBP, HEIC alebo PDF súbory.';
  }
  if (file.size <= 0) return 'Nahraný súbor je prázdny.';
  if (file.size > maxLeadFileSize) {
    return 'Jeden súbor môže mať maximálne 10 MB.';
  }

  const declaredType = file.type || '';
  const contentType =
    allowedFileTypes.has(declaredType) && declaredType !== 'application/octet-stream'
      ? declaredType
      : fallbackTypeFromExtension(ext);
  if (!allowedFileTypes.has(contentType)) {
    return 'Povolené sú iba JPG, PNG, WEBP, HEIC alebo PDF súbory.';
  }

  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const isJpeg = contentType === 'image/jpeg' && startsWith(header, [0xff, 0xd8, 0xff]);
  const isPng = contentType === 'image/png' && startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isPdf = contentType === 'application/pdf' && ascii(header, 0, 4) === '%PDF';
  const isWebp = contentType === 'image/webp' && ascii(header, 0, 4) === 'RIFF' && ascii(header, 8, 12) === 'WEBP';
  const isHeic = (contentType === 'image/heic' || contentType === 'image/heif') && looksLikeHeic(header);

  if (!isJpeg && !isPng && !isPdf && !isWebp && !isHeic) {
    return 'Súbor nevyzerá ako povolený typ. Skúste nahrať fotku vo formáte JPG, PNG, WEBP, HEIC alebo PDF.';
  }

  return null;
}
