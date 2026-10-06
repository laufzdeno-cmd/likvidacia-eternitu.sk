import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { del, get, put } from '@vercel/blob';
import { markLeadUploadDraftUploaded, reserveLeadUploadDraft } from './db';
import type { CareerApplicationCv, LeadFile } from './types';
import { isCareerCvUploadPath } from './career-cv-policy';

const localStorageRoot = path.join(process.cwd(), 'storage', 'lead-files');
const localCareerStorageRoot = path.join(process.cwd(), 'storage', 'career-cv');

async function webStreamToBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function safeExtension(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return ext && ext.length <= 8 ? ext : '';
}

export type DirectLeadUpload = {
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
};

export function attachDirectLeadUpload(leadId: string, upload: DirectLeadUpload): Omit<LeadFile, 'id' | 'createdAt'> {
  return {
    leadId,
    originalName: upload.originalName,
    storageDriver: 'vercel_blob',
    storageKey: upload.storageKey,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
  };
}

function s3Client() {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return undefined;

  return {
    bucket,
    client: new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  };
}

export async function storeLeadFile(leadId: string, file: File, retryPosition = 0): Promise<Omit<LeadFile, 'id' | 'createdAt'>> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const originalName = file.name || 'subor';
  const key = `lead-drafts/${leadId}/${randomUUID()}${safeExtension(originalName)}`;
  const s3 = s3Client();
  const storageDriver = process.env.BLOB_READ_WRITE_TOKEN ? 'vercel_blob' : s3 ? 's3' : undefined;

  if (storageDriver) {
    const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-dev-auth-secret-change-me');
    if (!secret) throw new Error('AUTH_SECRET is required to fingerprint private lead attachments.');
    const fileFingerprint = createHmac('sha256', secret).update(`multipart:${retryPosition}:`).update(bytes).digest('hex');
    await reserveLeadUploadDraft(leadId, key, undefined, storageDriver, fileFingerprint);
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, bytes, {
      access: 'private',
      contentType: file.type || 'application/octet-stream',
    });
    await markLeadUploadDraftUploaded(leadId, blob.pathname);
    return {
      leadId,
      originalName,
      storageDriver: 'vercel_blob',
      storageKey: blob.pathname,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    };
  }

  if (s3) {
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: bytes,
        ContentType: file.type || 'application/octet-stream',
        Metadata: {
          leadId,
          originalName: encodeURIComponent(originalName),
        },
      }),
    );
    await markLeadUploadDraftUploaded(leadId, key);
    return {
      leadId,
      originalName,
      storageDriver: 's3',
      storageKey: key,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('S3 or Vercel Blob storage is required in production.');
  }

  const localPath = path.join(localStorageRoot, key);
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, bytes);
  return {
    leadId,
    originalName,
    storageDriver: 'local',
    storageKey: key,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  };
}

export async function readStoredLeadFile(file: LeadFile) {
  if (file.storageDriver === 'vercel_blob') {
    const response = await get(file.storageKey, { access: 'private', useCache: false });
    if (!response || response.statusCode !== 200 || !response.stream) {
      throw new Error('Blob file not found.');
    }
    return webStreamToBuffer(response.stream);
  }

  if (file.storageDriver === 's3') {
    const s3 = s3Client();
    if (!s3) throw new Error('S3 storage is not configured.');
    const response = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: file.storageKey }));
    const body = response.Body;
    if (!body) throw new Error('File body is empty.');
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  const fullPath = path.normalize(path.join(localStorageRoot, file.storageKey));
  if (!fullPath.startsWith(path.normalize(localStorageRoot))) {
    throw new Error('Invalid file path.');
  }
  return readFile(fullPath);
}

export async function deleteStoredLeadFile(file: Pick<LeadFile, 'storageDriver' | 'storageKey'> & { blobEtag?: string }) {
  if (file.storageDriver === 'vercel_blob') {
    await del(file.storageKey, file.blobEtag ? { ifMatch: file.blobEtag } : undefined);
    return;
  }

  if (file.storageDriver === 's3') {
    const s3 = s3Client();
    if (!s3) throw new Error('S3 storage is not configured.');
    await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: file.storageKey }));
    return;
  }

  const fullPath = path.normalize(path.join(localStorageRoot, file.storageKey));
  if (!fullPath.startsWith(path.normalize(localStorageRoot))) {
    throw new Error('Invalid file path.');
  }
  await rm(fullPath, { force: true });
}

export async function storeCareerApplicationCv(applicationId: string, file: File): Promise<CareerApplicationCv> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const originalName = file.name || 'zivotopis';
  const key = `${applicationId}/${randomUUID()}${safeExtension(originalName)}`;
  const s3 = s3Client();
  const mimeType = file.type || 'application/octet-stream';

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`career-cv/${key}`, bytes, { access: 'private', contentType: mimeType });
    return { originalName, storageDriver: 'vercel_blob', storageKey: blob.pathname, mimeType, sizeBytes: file.size };
  }
  if (s3) {
    const storageKey = `career-cv/${key}`;
    await s3.client.send(new PutObjectCommand({
      Bucket: s3.bucket,
      Key: storageKey,
      Body: bytes,
      ContentType: mimeType,
      Metadata: { applicationId, originalName: encodeURIComponent(originalName) },
    }));
    return { originalName, storageDriver: 's3', storageKey, mimeType, sizeBytes: file.size };
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Súkromné úložisko pre životopis nie je nastavené.');
  const localPath = path.join(localCareerStorageRoot, key);
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, bytes);
  return { originalName, storageDriver: 'local', storageKey: key, mimeType, sizeBytes: file.size };
}

export async function storeCareerApplicationCvAtReservedPath(submissionId: string, pathname: string, file: File): Promise<CareerApplicationCv> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !isCareerCvUploadPath(submissionId, pathname)) {
    throw new Error('Súkromná rezervácia životopisu nie je dostupná.');
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length <= 0 || bytes.length > 5 * 1024 * 1024) {
    throw new Error('Neplatná veľkosť životopisu.');
  }
  const mimeType = file.type || 'application/octet-stream';
  const blob = await put(pathname, bytes, {
    access: 'private', contentType: mimeType, addRandomSuffix: false, allowOverwrite: false,
  });
  if (blob.pathname !== pathname) throw new Error('Životopis bol uložený pod nesprávnou cestou.');
  return { originalName: file.name, storageDriver: 'vercel_blob', storageKey: pathname, mimeType, sizeBytes: bytes.length };
}

export async function readStoredCareerApplicationCv(file: CareerApplicationCv) {
  if (file.storageDriver === 'vercel_blob') {
    const response = await get(file.storageKey, { access: 'private', useCache: false });
    if (!response || response.statusCode !== 200 || !response.stream) throw new Error('Životopis sa nenašiel.');
    return webStreamToBuffer(response.stream);
  }
  if (file.storageDriver === 's3') {
    const s3 = s3Client();
    if (!s3) throw new Error('Súkromné úložisko nie je nastavené.');
    const response = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: file.storageKey }));
    if (!response.Body) throw new Error('Životopis je prázdny.');
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  const fullPath = path.normalize(path.join(localCareerStorageRoot, file.storageKey));
  if (!fullPath.startsWith(path.normalize(localCareerStorageRoot))) throw new Error('Neplatná cesta k životopisu.');
  return readFile(fullPath);
}
