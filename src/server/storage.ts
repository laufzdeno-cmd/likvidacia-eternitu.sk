import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { LeadFile } from './types';

const localStorageRoot = path.join(process.cwd(), 'storage', 'lead-files');

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
    throw new Error('S3 storage is required in production.');
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
