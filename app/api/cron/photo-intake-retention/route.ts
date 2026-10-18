import { BlobNotFoundError, del, head } from '@vercel/blob';
import { NextResponse } from 'next/server';
import {
  claimDuePhotoIntakeDeletions,
  claimPhotoIntakeSanitizationCleanups,
  completePhotoIntakeDeletion,
  completePhotoIntakeSanitizationCleanup,
  failPhotoIntakeSanitizationCleanup,
  markPhotoIntakeDeletionFailed,
} from '@/src/server/db';
import { photoIntakeRetentionRequested, privatePhotoIntakeBlobOptions, privatePhotoIntakeStorageReady, type PrivatePhotoIntakeBlobOptions } from '@/src/server/photo-intake-config';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function deletePrivateBlobOrConfirmAbsent(storageKey: string, blobOptions: PrivatePhotoIntakeBlobOptions) {
  try {
    await del(storageKey, blobOptions);
    return;
  } catch (deleteError) {
    if (deleteError instanceof BlobNotFoundError) return;

    // A provider request can succeed remotely and still fail locally before
    // the response is observed. A retry may therefore find no object. Only a
    // provider-confirmed absence is safe to treat as an already completed
    // object deletion; every other condition remains retryable.
    try {
      await head(storageKey, blobOptions);
    } catch (headError) {
      if (headError instanceof BlobNotFoundError) return;
      throw headError;
    }
    throw deleteError;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!photoIntakeRetentionRequested()) return NextResponse.json({ ok: true, skipped: true, reason: 'Photo retention is disabled.' });
  if (!privatePhotoIntakeStorageReady()) return NextResponse.json({ ok: false, error: 'Private photo storage is not verified or its delete token is unavailable.' }, { status: 503 });

  let candidates;
  let sanitizationCleanups;
  try {
    sanitizationCleanups = await claimPhotoIntakeSanitizationCleanups(50);
    candidates = await claimDuePhotoIntakeDeletions(50);
  } catch (error) {
    console.error('Photo intake retention claim failed.', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ ok: false, error: 'Retention queue unavailable.' }, { status: 503 });
  }

  const blobOptions = privatePhotoIntakeBlobOptions();
  let deleted = 0;
  let failed = 0;
  let temporaryDeleted = 0;
  for (const cleanup of sanitizationCleanups) {
    try {
      if (cleanup.storageDriver !== 'vercel_blob') throw new Error('Unsupported private storage driver.');
      await deletePrivateBlobOrConfirmAbsent(cleanup.storageKey, blobOptions);
      if (!await completePhotoIntakeSanitizationCleanup(cleanup.id)) {
        throw new Error('PHOTO_INTAKE_SANITIZATION_CLEANUP_COMPLETION_FAILED');
      }
      temporaryDeleted += 1;
    } catch (error) {
      try { await failPhotoIntakeSanitizationCleanup(cleanup.id); } catch { /* Daily worker retries the durable cleanup row. */ }
      console.error('Photo intake sanitization cleanup failed.', error instanceof Error ? error.name : 'unknown');
      failed += 1;
    }
  }
  for (const candidate of candidates) {
    try {
      if (candidate.storageDriver !== 'vercel_blob') throw new Error('Unsupported private storage driver.');
      await deletePrivateBlobOrConfirmAbsent(candidate.storageKey, blobOptions);
      if (!await completePhotoIntakeDeletion(candidate.id)) {
        throw new Error('PHOTO_INTAKE_RETENTION_COMPLETION_FAILED');
      }
      deleted += 1;
    } catch (error) {
      try {
        await markPhotoIntakeDeletionFailed(candidate.id);
      } catch {
        console.error('Photo intake retention retry state could not be saved.');
      }
      console.error('Photo intake retention deletion failed.', error instanceof Error ? error.name : 'unknown');
      failed += 1;
    }
  }

  const ok = failed === 0;
  return NextResponse.json(
    { ok, checked: candidates.length, cleanupChecked: sanitizationCleanups.length, deleted, temporaryDeleted, failed },
    { status: ok ? 200 : 503 },
  );
}
