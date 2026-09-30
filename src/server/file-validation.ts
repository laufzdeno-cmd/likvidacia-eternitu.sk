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
    default:
      return '';
  }
}

type LeadFileInput = {
  name: string;
  size: number;
  type: string;
};

function leadContentType(file: LeadFileInput) {
  const ext = extension(file.name || '');
  const declaredType = file.type || '';
  return allowedFileTypes.has(declaredType) && declaredType !== 'application/octet-stream'
    ? declaredType
    : fallbackTypeFromExtension(ext);
}

export function validateLeadFileMetadata(file: LeadFileInput) {
  const ext = extension(file.name || '');
  if (!allowedFileExtensions.has(ext)) {
    return 'Povolené sú iba JPG, JPEG, PNG, WEBP alebo HEIC súbory.';
  }
  if (file.size <= 0) return 'Nahraný súbor je prázdny.';
  if (file.size > maxLeadFileSize) {
    return 'Jeden súbor môže mať maximálne 10 MB.';
  }
  if (!allowedFileTypes.has(leadContentType(file))) {
    return 'Povolené sú iba JPG, JPEG, PNG, WEBP alebo HEIC súbory.';
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
    return 'Súbor nevyzerá ako povolený typ. Skúste nahrať fotku vo formáte JPG, JPEG, PNG, WEBP alebo HEIC.';
  }
  return null;
}

export async function validateUploadedLeadFile(file: File) {
  const metadataError = validateLeadFileMetadata(file);
  if (metadataError) return metadataError;

  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  return validateLeadFileHeader(file, header);
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
