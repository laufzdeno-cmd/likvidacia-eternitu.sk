import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { get, put, del } from '@vercel/blob';
import sharp from 'sharp';
import { privatePhotoIntakeBlobOptions, privatePhotoIntakeStorageReady } from './photo-intake-config';
import { verifiedImageMime, safePhotoName } from './photo-intake-policy';
import { deploymentDatabaseAccessBlocked } from './preview-safety';
import { extractJobPdf, validateJobPdf } from './job-pdf-extraction';
import type { JobPdfExtraction } from './job-pdf-extraction';
import type { JobPrivateDocument, JobWorkspaceActor } from './job-workspace-types';

export const jobPrivateMaxPhotoBytes = 3 * 1024 * 1024;
const documentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const objectPathPattern = /^job-workspace\/[0-9a-f-]{36}\/(?:original\.pdf|photo\.webp|thumbnail\.webp)$/;
export type PrivateDocumentRepository = {
  register: (document: Omit<JobPrivateDocument, 'createdAt' | 'createdBy'>, actor: JobWorkspaceActor) => Promise<JobPrivateDocument>;
};

function localRoot() {
  return path.resolve(process.env.ASTANA_JOB_PRIVATE_ROOT || path.join(process.cwd(), '.data', 'job-workspace-files'));
}
function assertLocalStorage() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') throw new Error('Súkromné úložisko zákaziek nie je overené.');
}
function assertStorageWriteAllowed() {
  if (deploymentDatabaseAccessBlocked()) throw new Error('Zápis do úložiska je v tomto náhľade vypnutý.');
}
function checkedObjectPath(value: string) {
  if (!objectPathPattern.test(value)) throw new Error('Neplatný súkromný súbor.');
  return value;
}
function localPath(key: string) {
  const root = localRoot();
  const resolved = path.resolve(root, checkedObjectPath(key));
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('Neplatná cesta súboru.');
  return resolved;
}

async function putPrivate(key: string, bytes: Buffer, mime: string) {
  assertStorageWriteAllowed();
  checkedObjectPath(key);
  if (privatePhotoIntakeStorageReady()) {
    const result = await put(key, bytes, { ...privatePhotoIntakeBlobOptions(), access: 'private', contentType: mime, addRandomSuffix: false, allowOverwrite: false });
    return `blob:${result.pathname}`;
  }
  assertLocalStorage();
  const target = localPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
  return `local:${key}`;
}

export async function readJobPrivateBytes(storageKey: string, maxBytes = 4 * 1024 * 1024): Promise<Buffer> {
  const separator = storageKey.indexOf(':');
  const driver = storageKey.slice(0, separator);
  const key = checkedObjectPath(storageKey.slice(separator + 1));
  if (driver === 'local') {
    assertLocalStorage();
    const bytes = await readFile(localPath(key));
    if (bytes.length > maxBytes) throw new Error('Súbor presahuje povolenú veľkosť.');
    return bytes;
  }
  if (driver !== 'blob' || !privatePhotoIntakeStorageReady()) throw new Error('Súkromné úložisko nie je dostupné.');
  const result = await get(key, { ...privatePhotoIntakeBlobOptions(), access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error('Súkromný súbor sa nenašiel.');
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new Error('Súbor presahuje povolenú veľkosť.'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, length);
}

async function removeUnregisteredObject(storageKey: string) {
  // Compensation applies only to this request's newly generated path. Registered customer files are never deleted here.
  const separator = storageKey.indexOf(':');
  const driver = storageKey.slice(0, separator);
  const key = checkedObjectPath(storageKey.slice(separator + 1));
  if (driver === 'local') { assertLocalStorage(); await unlink(localPath(key)).catch(() => undefined); }
  else if (driver === 'blob' && privatePhotoIntakeStorageReady()) await del(key, privatePhotoIntakeBlobOptions());
}

function requireActor(actor: JobWorkspaceActor) {
  if (!['OPERATOR', 'SUPER_ADMIN'].includes(actor.role) || !actor.email) throw new Error('Nemáte oprávnenie na súkromné súbory.');
}

export async function prepareJobPhoto(bytes: Uint8Array) {
  if (!bytes.byteLength || bytes.byteLength > jobPrivateMaxPhotoBytes) throw new Error('Fotografia môže mať najviac 3 MB.');
  if (!verifiedImageMime(bytes)) throw new Error('Vyberte fotografiu JPG, PNG alebo WebP.');
  const input = sharp(Buffer.from(bytes), { failOn: 'error', sequentialRead: true, limitInputPixels: 25_000_000 });
  const meta = await input.metadata();
  if (!meta.width || !meta.height || meta.width * meta.height > 25_000_000 || (meta.pages || 1) !== 1) throw new Error('Fotografia má nepovolené rozmery alebo obsahuje viac snímok.');
  // Sharp strips EXIF, GPS and other metadata by default. No withMetadata() call is used.
  const optimized = await input.clone().rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
  const thumbnail = await input.clone().rotate().resize({ width: 480, height: 360, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72, effort: 3 }).toBuffer();
  return { optimized, thumbnail };
}

export async function storeJobPrivateUpload(input: {
  bytes: Uint8Array; originalName: string; mime: string; kind: 'PDF' | 'PHOTO' | 'AUTHORITY'; jobId?: string | null;
}, actor: JobWorkspaceActor, repository: PrivateDocumentRepository): Promise<{ document: JobPrivateDocument; extraction: JobPdfExtraction | null }> {
  requireActor(actor);
  if (input.jobId && !documentIdPattern.test(input.jobId)) throw new Error('Neplatná zákazka.');
  const id = randomUUID();
  const uploaded: string[] = [];
  let registrationAttempted = false;
  let extraction: JobPdfExtraction | null = null;
  let bytes = Buffer.from(input.bytes);
  let thumbnail: Buffer | null = null;
  let mime: string;
  let key: string;
  if (input.kind === 'PHOTO') {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.mime)) throw new Error('Vyberte fotografiu JPG, PNG alebo WebP.');
    const result = await prepareJobPhoto(bytes);
    bytes = result.optimized;
    thumbnail = result.thumbnail;
    mime = 'image/webp'; key = `job-workspace/${id}/photo.webp`;
  } else {
    if (input.mime !== 'application/pdf') throw new Error('Vyberte PDF dokument.');
    validateJobPdf(bytes);
    extraction = await extractJobPdf(bytes);
    mime = 'application/pdf'; key = `job-workspace/${id}/original.pdf`;
  }
  try {
    const storageKey = await putPrivate(key, bytes, mime);
    uploaded.push(storageKey);
    let thumbnailStorageKey: string | null = null;
    if (thumbnail) {
      thumbnailStorageKey = await putPrivate(`job-workspace/${id}/thumbnail.webp`, thumbnail, 'image/webp');
      uploaded.push(thumbnailStorageKey);
    }
    registrationAttempted = true;
    const document = await repository.register({ id, jobId: input.jobId || null, offerDraftId: null, storageKey, fileName: safePhotoName(input.originalName), mime, size: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex'), thumbnailStorageKey, kind: input.kind }, actor);
    return { document, extraction };
  } catch (error) {
    // A failed database acknowledgement can mean the record committed. Preserve private bytes until reconciliation;
    // deleting them on an ambiguous commit would break an already registered original.
    if (!registrationAttempted) for (const storageKey of uploaded) await removeUnregisteredObject(storageKey).catch(() => undefined);
    throw error;
  }
}

export function privateDocumentPublicView(document: JobPrivateDocument) {
  return { id: document.id, jobId: document.jobId, originalName: document.fileName, mime: document.mime, size: document.size, sha256: document.sha256, kind: document.kind, createdAt: document.createdAt,
    href: `/api/admin/job-workspace/documents/${document.id}/`, thumbnailHref: document.thumbnailStorageKey ? `/api/admin/job-workspace/documents/${document.id}/?thumbnail=1` : null };
}
