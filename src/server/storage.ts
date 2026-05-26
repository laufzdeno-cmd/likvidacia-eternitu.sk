import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { del, get, put } from '@vercel/blob';
import type { LeadFile } from './types';

const localStorageRoot = path.join(process.cwd(), 'storage', 'lead-files');

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

export async function storeLeadFile(leadId: string, file: File): Promise<Omit<LeadFile, 'id' | 'createdAt'>> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const originalName = file.name || 'subor';
  const key = `${leadId}/${randomUUID()}${safeExtension(originalName)}`;
  const s3 = s3Client();

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, bytes, {
      access: 'private',
      contentType: file.type || 'application/octet-stream',
    });
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

export async function deleteStoredLeadFile(file: LeadFile) {
  if (file.storageDriver === 'vercel_blob') {
    await del(file.storageKey);
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
